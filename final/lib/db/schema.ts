// db/schema/index.ts
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  // check,
  date,
  doublePrecision,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

// ============================================================
// SCHEMAS
// ============================================================

// Frontend schema - managed by Drizzle migrations
export const frontendSchema = pgSchema("frontend");

// Resume schema - managed by Python backend (read-only for frontend)
// export const resumeSchema = pgSchema("public");

// ============================================================
// ENUMS - Frontend
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("status", [
  "active",
  "suspended",
  "deleted",
]);

// ============================================================
// FRONTEND TABLES (Drizzle manages these)
// ============================================================

export const user = frontendSchema.table("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const chat = frontendSchema.table("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export const message = frontendSchema.table("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),

  parentMessageId: uuid("parent_message_id").references(
    (): AnyPgColumn => message.id
  ),

  // Store resume IDs from vector search results
  resumeIds: uuid("resume_ids").array().default(sql`'{}'`),

  // Store candidate IDs from search results
  candidateIds: uuid("candidate_ids").array().default(sql`'{}'`),

  similarityScores:
    jsonb("similarity_scores").$type<
      Array<{ resumeId: string; score: number }>
    >(),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const resumeRequests = frontendSchema.table(
  "ResumeRequest",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId").references(() => chat.id), // Link to the chat
    resumeIds: uuid("resume_ids").array().notNull().default(sql`'{}'`),
    candidateIds: uuid("candidate_ids").array().notNull().default(sql`'{}'`),
    requestMessage: text("request_message"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    // Add these indexes
    userIdIdx: index("idx_resume_requests_user_id").on(table.userId),
    statusIdx: index("idx_resume_requests_status").on(table.status),
    statusCreatedIdx: index("idx_resume_requests_status_created").on(
      table.status,
      table.createdAt
    ),
    resumeIdsIdx: index("idx_resume_requests_resume_ids").using(
      "gin",
      table.resumeIds
    ),
    candidateIdsIdx: index("idx_resume_requests_candidate_ids").using(
      "gin",
      table.candidateIds
    ),
  })
);

export type ResumeRequest = InferSelectModel<typeof resumeRequests>;
export type NewResumeRequest = InferInsertModel<typeof resumeRequests>;

// ============================================================
// RESUME TABLES (Read-only - Python backend manages these)
// ============================================================

// Type-only definitions for querying existing tables in public schema
// These tables are created and managed by your Python Cloud Function
// Drizzle will NOT create migrations for these

export const candidates = pgTable(
  "candidates",
  {
    candidateId: uuid("candidate_id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }),
    location: varchar("location").notNull(),
    skills: varchar("skills", { length: 255 }).array(),
    careerPathSummary: text("career_path_summary"),
    totalYearsExperience: doublePrecision("total_years_experience"),
    keyDomains: varchar("key_domains", { length: 255 }).array(),
    achievements: varchar("achievements", { length: 255 }).array(),
    hobbies: varchar("hobbies", { length: 255 }).array(),
    academicSummary: text("academic_summary"),
    latestResumeId: uuid("latest_resume_id"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index("idx_candidates_email").on(table.email),
    skillsIdx: index("idx_candidates_skills").using("gin", table.skills),
    keyDomainsIdx: index("idx_candidates_key_domains").using(
      "gin",
      table.keyDomains
    ),
  })
);

export const resumes = pgTable(
  "resumes",
  {
    resumeId: uuid("resume_id").primaryKey(),
    candidateId: uuid("candidate_id"),
    gcsBucket: varchar("gcs_bucket", { length: 255 }).notNull(),
    gcsFilePath: varchar("gcs_file_path", { length: 1024 }).notNull(),
    // Use varchar instead of enum since enum is in public schema
    status: varchar("status", { length: 50 }).notNull(),
    isPaid: boolean("is_paid").notNull(),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_resumes_candidate_id").on(table.candidateId),
    gcsPathIdx: index("idx_resumes_gcs_path").on(table.gcsFilePath),
    statusIdx: index("idx_resumes_status").on(table.status),
  })
);

export const education = pgTable(
  "education",
  {
    educationId: uuid("education_id").primaryKey(),
    candidateId: uuid("candidate_id").notNull(),
    // Use varchar instead of enum
    level: varchar("level", { length: 50 }).notNull(),
    institutionName: varchar("institution_name", { length: 255 }).notNull(),
    degreeOrCertificate: varchar("degree_or_certificate", {
      length: 255,
    }).notNull(),
    majorOrSpecialization: varchar("major_or_specialization", { length: 255 }),
    yearOfPassing: integer("year_of_passing").notNull(),
    score: doublePrecision("score"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_education_candidate_id").on(table.candidateId),
  })
);

export const jobs = pgTable(
  "jobs",
  {
    jobId: uuid("job_id").primaryKey(),
    candidateId: uuid("candidate_id").notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    companyDescription: text("company_description"),
    companyTags: varchar("company_tags", { length: 255 }).array(),
    roleTitle: varchar("role_title", { length: 255 }).notNull(),
    roleDescription: text("role_description"),
    roleTags: varchar("role_tags", { length: 255 }).array(),
    durationMonths: doublePrecision("duration_months"),
    domainTags: varchar("domain_tags", { length: 255 }).array(),
    achievementsSummary: text("achievements_summary"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_jobs_candidate_id").on(table.candidateId),
    companyTagsIdx: index("idx_jobs_company_tags").using(
      "gin",
      table.companyTags
    ),
    roleTagsIdx: index("idx_jobs_role_tags").using("gin", table.roleTags),
  })
);

export const internships = pgTable(
  "internships",
  {
    internshipId: uuid("internship_id").primaryKey(),
    candidateId: uuid("candidate_id").notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    companyDescription: text("company_description"),
    companyTags: varchar("company_tags", { length: 255 }).array(),
    roleTitle: varchar("role_title", { length: 255 }).notNull(),
    roleDescription: text("role_description"),
    roleTags: varchar("role_tags", { length: 255 }).array(),
    durationMonths: doublePrecision("duration_months"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_internships_candidate_id").on(table.candidateId),
  })
);

export const projects = pgTable(
  "projects",
  {
    projectId: uuid("project_id").primaryKey(),
    candidateId: uuid("candidate_id").notNull(),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    projectDescription: text("project_description"),
    technologiesUsed: varchar("technologies_used", { length: 255 }).array(),
    roleInProject: varchar("role_in_project", { length: 255 }),
    tags: varchar("tags", { length: 255 }).array(),
    durationMonths: doublePrecision("duration_months"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_projects_candidate_id").on(table.candidateId),
  })
);

export const embeddings = pgTable(
  "embeddings",
  {
    embeddingId: uuid("embedding_id").primaryKey(),
    candidateId: uuid("candidate_id").notNull(),
    resumeId: uuid("resume_id"),
    // pgvector column - 1536 dimensions for gemini-embedding-001
    embedding: vector("embedding", { dimensions: 1536 }),
    document: text("document").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    candidateIdIdx: index("idx_embeddings_candidate_id").on(table.candidateId),
    resumeIdIdx: index("idx_embeddings_resume_id").on(table.resumeId),
    metadataIdx: index("idx_embeddings_metadata").using("gin", table.metadata),
  })
);

// ============================================================
// TYPE EXPORTS
// ============================================================

// Frontend types
export type User = InferSelectModel<typeof user>;
export type Chat = InferSelectModel<typeof chat>;
export type DBMessage = InferSelectModel<typeof message>;
export type NewDBMessage = InferInsertModel<typeof message>;

// Resume types (for read operations)
export type Candidate = InferSelectModel<typeof candidates>;
export type Resume = InferSelectModel<typeof resumes>;
export type Education = InferSelectModel<typeof education>;
export type Job = InferSelectModel<typeof jobs>;
export type Internship = InferSelectModel<typeof internships>;
export type Project = InferSelectModel<typeof projects>;
export type Embedding = InferSelectModel<typeof embeddings>;

// ============================================================
// HELPER TYPES
// ============================================================

export type ResumeStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "ARCHIVED";

export type EducationLevel =
  | "10th Grade"
  | "12th Grade"
  | "Diploma"
  | "Undergraduate"
  | "Postgraduate"
  | "PhD"
  | "Other";

export type SearchResult = {
  resume_id: string;
  candidate_id: string;
  similarity: number;
  skills: string[];
  total_years_experience: number | null;
  key_domains: string[];
  career_path_summary: string | null;
  education: Education[];
  job_experiences: Job[];
  internships: Internship[];
  projects: Project[];
};
