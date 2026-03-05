import { Pool } from "pg";
import { env } from "@/lib/env";

const pool = new Pool({
  host: env.DB_CONNECTION_NAME
    ? `/cloudsql/${env.DB_CONNECTION_NAME}`
    : env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  ssl: env.DB_CONNECTION_NAME
    ? false // Unix socket doesn't need SSL
    : env.NODE_ENV === "production"
      ? { rejectUnauthorized: false } // Direct IP in production needs SSL
      : false, // Local proxy doesn't need SSL
  max: 5, // Fewer connections in Cloud Run
  min: 0, // No persistent connections
  idleTimeoutMillis: 30_000, // Close after 30s idle
  connectionTimeoutMillis: 10_000, // Fail fast
  allowExitOnIdle: true,
});

/**
 * Search for relevant resumes using vector similarity
 */
export async function searchResumes(
  queryEmbedding: number[],
  options: {
    k?: number;
    filter?: Record<string, any>;
  } = {}
) {
  const startTime = performance.now();
  const { k = 20, filter } = options;

  // Validate embedding dimensions
  if (queryEmbedding.length !== 1536) {
    throw new Error(
      `Invalid embedding dimensions: expected 1536, got ${queryEmbedding.length}`
    );
  }

  try {
    // Build SQL query with pgvector similarity
    let sqlQuery = `
      SELECT
        e.embedding_id,
        e.candidate_id,
        e.resume_id,
        e.document,
        e.metadata,
        1 - (e.embedding <=> $1::vector) as similarity
      FROM public.embeddings e
      WHERE 1=1
    `;

    const params: any[] = [JSON.stringify(queryEmbedding)];
    let paramIndex = 2;

    // Add filters
    if (filter?.candidate_id) {
      sqlQuery += ` AND e.candidate_id = $${paramIndex}`;
      params.push(filter.candidate_id);
      paramIndex++;
    }

    if (filter?.resume_id) {
      sqlQuery += ` AND e.resume_id = $${paramIndex}`;
      params.push(filter.resume_id);
      paramIndex++;
    }

    if (filter?.min_similarity) {
      sqlQuery += ` AND (1 - (e.embedding <=> $1::vector)) >= $${paramIndex}`;
      params.push(filter.min_similarity);
      paramIndex++;
    }

    // Order by similarity and limit
    sqlQuery += `
      ORDER BY e.embedding <=> $1::vector
      LIMIT $${paramIndex}
    `;
    params.push(k);

    // Execute query
    const result = await pool.query(sqlQuery, params);

    // console.log("vector search results ::", result);
    // console.log("vector search results ::", result.rows);

    const searchTime = performance.now() - startTime;

    return {
      results: result.rows.map((row) => ({
        embedding_id: row.embedding_id,
        candidate_id: row.candidate_id,
        resume_id: row.resume_id,
        similarity: Number.parseFloat(row.similarity),
        text: row.document,
        metadata: row.metadata,
      })),
      searchTime,
      query: `${queryEmbedding.slice(0, 3).join(", ")}...`,
      count: result.rows.length,
    };
  } catch (error) {
    console.error("Vector search failed:", error);
    throw error;
  }
}

// /**
//  * Create HNSW index for faster approximate search
//  * Run this once after you have some data
//  */
// export async function createHNSWIndex() {
//   const vectorStore = getVectorStore();

//   console.log("Creating HNSW index...");
//   const startTime = performance.now();

//   await vectorStore.createHnswIndex({
//     dimensions: 1536, // text-embedding-3-small
//     m: 16, // connections per layer
//     efConstruction: 64, // size of dynamic candidate list
//   });

//   const indexTime = performance.now() - startTime;
//   console.log(`✅ HNSW index created in ${indexTime.toFixed(2)}ms`);
// }

// /**
//  * Close database connection
//  */
// export async function closeVectorStore() {
//   if (vectorStoreInstance) {
//     await vectorStoreInstance.end();
//     vectorStoreInstance = null;
//   }
// }
