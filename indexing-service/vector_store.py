import logging
from typing import Any
from uuid import UUID as PyUUID

import sqlalchemy
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from database import DatabaseService

logger = logging.getLogger(__name__)


class VectorStoreService:
    def __init__(
        self,
        db_service: DatabaseService,
        google_api_key: str,
        embedding_model_name: str = "gemini-embedding-001",
        output_dimensionality: int = 1536,
    ):
        self.db_service = db_service
        self.output_dimensionality = output_dimensionality

        logger.info(
            "Initializing VectorStoreService with existing DB connection pool..."
        )

        try:
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=embedding_model_name,
                google_api_key=google_api_key,
            )

            logger.info(
                f"Initialized GoogleGenerativeAIEmbeddings ({output_dimensionality} dimensions)"
            )

        except Exception as e:
            logger.critical(
                f"Failed to initialize VectorStoreService: {e}", exc_info=True
            )
            raise

    def add_embedding(
        self,
        candidate_id: PyUUID,
        resume_id: PyUUID,
        text_content: str,
        metadata: dict[str, Any],
    ):
        """
        Adds an embedding directly to the embeddings table.
        """
        logger.info(f"Creating embedding for resume {resume_id}...")

        try:
            # Generate embedding
            embedding_vector = self.embeddings.embed_query(
                text_content,
                task_type="RETRIEVAL_DOCUMENT",
                title=f"Resume:{resume_id}",
                output_dimensionality=self.output_dimensionality,
            )

            if len(embedding_vector) != self.output_dimensionality:
                logger.warning(
                    f"Embedding dimension mismatch: got {len(embedding_vector)}, "
                    f"expected {self.output_dimensionality}. "
                    f"Update schema or configure output_dimensionality."
                )

            # Insert into embeddings table
            stmt = sqlalchemy.text("""
                INSERT INTO embeddings (
                    candidate_id, resume_id, embedding, document, metadata
                ) VALUES (
                    :candidate_id, :resume_id, :embedding, :document, :metadata
                )
            """)

            with self.db_service.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        stmt,
                        {
                            "candidate_id": candidate_id,
                            "resume_id": resume_id,
                            "embedding": str(
                                embedding_vector
                            ),  # pg8000 handles list to string
                            "document": text_content,
                            "metadata": metadata,  # Will be cast to JSONB
                        },
                    )

            logger.info(f"Successfully added embedding for resume {resume_id}")

        except Exception as e:
            logger.error(
                f"Error adding embedding for resume {resume_id}: {e}", exc_info=True
            )
            raise

    def delete_embedding(self, resume_id: PyUUID):
        """Deletes embedding by resume_id."""
        logger.info(f"Deleting embedding for resume {resume_id}...")

        try:
            stmt = sqlalchemy.text("""
                DELETE FROM embeddings WHERE resume_id = :resume_id
            """)

            with self.db_service.db_pool.connect() as conn:
                with conn.begin():
                    result = conn.execute(stmt, {"resume_id": resume_id})

            if result.rowcount > 0:
                logger.info(f"Successfully deleted embedding for resume {resume_id}")
            else:
                logger.warning(f"No embedding found for resume {resume_id}")

        except Exception as e:
            logger.error(
                f"Error deleting embedding for resume {resume_id}: {e}", exc_info=True
            )
            # Don't raise - archiving should continue even if embedding wasn't found
