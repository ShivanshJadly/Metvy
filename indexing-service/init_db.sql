-- ============================================================
-- Resume RAG Application - PostgreSQL Schema
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For UUID generation
CREATE EXTENSION IF NOT EXISTS vector;       -- For vector column type and functions

-- ============================================================
-- SECTION 2: ENUMS
-- ============================================================

-- Resume status enum
CREATE TYPE resume_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- Education level enum (matching Pydantic model)
CREATE TYPE education_level AS ENUM (
    '10th Grade',
    '12th Grade',
    'Diploma',
    'Undergraduate',
    'Postgraduate',
    'PhD',
    'Other'
);

-- ============================================================
-- SECTION 3: MAIN TABLES
-- ============================================================

-- 1. Candidates Table (Master record for a person)
CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "candidate_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "location" VARCHAR(255) NOT NULL, -- remove
    "phone_number" VARCHAR(50),
    "skills" VARCHAR[] DEFAULT '{}',
    "career_path_summary" TEXT,
    "total_years_experience" FLOAT,
    "key_domains" VARCHAR[] DEFAULT '{}',
    "achievements" VARCHAR[] DEFAULT '{}',
    "hobbies" VARCHAR[] DEFAULT '{}',
    "academic_summary" TEXT,

    -- Link to the LATEST active resume (deferred constraint for circular dependency)
    "latest_resume_id" UUID,

    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Resumes Table (Tracks individual uploads)
CREATE TABLE IF NOT EXISTS "public"."resumes" (
    "resume_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "gcs_bucket" VARCHAR(255) NOT NULL,
    "gcs_file_path" VARCHAR(1024) NOT NULL,
    "status" resume_status NOT NULL DEFAULT 'PENDING',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Add deferred foreign key constraint for circular dependency
ALTER TABLE "public"."candidates"
ADD CONSTRAINT fk_candidates_latest_resume
FOREIGN KEY (latest_resume_id)
REFERENCES public.resumes(resume_id)
ON DELETE SET NULL
ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS "public"."education" (
    "education_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "level" education_level NOT NULL,
    "institution_name" VARCHAR(255) NOT NULL, -- remove
    "degree_or_certificate" VARCHAR(255) NOT NULL, -- remove
    "major_or_specialization" VARCHAR(255), -- remove
    "year_of_passing" INTEGER NOT NULL CHECK (year_of_passing > 1950),
    "score" FLOAT CHECK (score >= 0 AND score <= 100),
    "summary" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Jobs Table (One-to-Many with Candidates)
CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "job_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "company_name" VARCHAR(255) NOT NULL, -- remove
    "company_description" TEXT,
    "company_tags" VARCHAR[] DEFAULT '{}',
    "role_title" VARCHAR(255) NOT NULL, -- remove
    "role_description" TEXT,
    "role_tags" VARCHAR[] DEFAULT '{}',
    "duration_months" FLOAT,
    "domain_tags" VARCHAR[] DEFAULT '{}',
    "achievements_summary" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Internships Table (One-to-Many with Candidates)
CREATE TABLE IF NOT EXISTS "public"."internships" (
    "internship_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "company_name" VARCHAR(255) NOT NULL, -- remove
    "company_description" TEXT,
    "company_tags" VARCHAR[] DEFAULT '{}',
    "role_title" VARCHAR(255) NOT NULL, -- remove
    "role_description" TEXT,
    "role_tags" VARCHAR[] DEFAULT '{}',
    "duration_months" FLOAT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Projects Table (One-to-Many with Candidates)
CREATE TABLE IF NOT EXISTS "public"."projects" (
    "project_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "project_name" VARCHAR(255) NOT NULL,
    "project_description" TEXT,
    "technologies_used" VARCHAR[] DEFAULT '{}',
    "role_in_project" VARCHAR(255),
    "tags" VARCHAR[] DEFAULT '{}',
    "duration_months" FLOAT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."embeddings" (
    "embedding_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "candidate_id" UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "resume_id" UUID REFERENCES public.resumes(resume_id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Vector embedding (768 dimensions - configure Gemini output_dimensionality to 768)
    -- Alternative: Use 3072 for full Gemini default, or 1536 for balanced performance
    "embedding" vector(1536),

    -- Text content for the embedding
    "document" TEXT NOT NULL,

    -- Metadata for filtering and retrieval
    "metadata" JSONB DEFAULT '{}',

    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 4: INDEXES
-- ============================================================

-- Foreign key indexes for performance
CREATE INDEX idx_resumes_candidate_id ON public.resumes(candidate_id);
CREATE INDEX idx_education_candidate_id ON public.education(candidate_id);
CREATE INDEX idx_jobs_candidate_id ON public.jobs(candidate_id);
CREATE INDEX idx_internships_candidate_id ON public.internships(candidate_id);
CREATE INDEX idx_projects_candidate_id ON public.projects(candidate_id);
CREATE INDEX idx_embeddings_candidate_id ON public.embeddings(candidate_id);
CREATE INDEX idx_embeddings_resume_id ON public.embeddings(resume_id);

-- GCS file path index for deduplication and lookups
CREATE INDEX idx_resumes_gcs_path ON public.resumes(gcs_file_path);

-- Status and timestamp indexes for common queries
CREATE INDEX idx_resumes_status ON public.resumes(status);
CREATE INDEX idx_resumes_status_created ON public.resumes(status, created_at DESC);

-- Email lookup optimization
CREATE INDEX idx_candidates_email ON public.candidates(email);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_embeddings_metadata ON public.embeddings USING GIN (metadata);

-- Array indexes for tag searches (if needed for filtering)
CREATE INDEX idx_candidates_skills ON public.candidates USING GIN (skills);
CREATE INDEX idx_candidates_key_domains ON public.candidates USING GIN (key_domains);
CREATE INDEX idx_jobs_company_tags ON public.jobs USING GIN (company_tags);
CREATE INDEX idx_jobs_role_tags ON public.jobs USING GIN (role_tags);

-- ============================================================
-- SECTION 5: TRIGGERS
-- ============================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER handle_updated_at_candidates
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_resumes
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_education
    BEFORE UPDATE ON public.education
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_jobs
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_internships
    BEFORE UPDATE ON public.internships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_projects
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_embeddings
    BEFORE UPDATE ON public.embeddings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;

-- ============================================================
-- SECTION 6: VECTOR INDEXES (Run AFTER data population)
-- ============================================================
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- For 5-7K vectors, sequential scans may be faster initially
-- Uncomment and run after you have significant data:

-- Option 1: HNSW index (better for larger datasets and quality searches)
-- CREATE INDEX CONCURRENTLY embeddings_vector_hnsw_idx
-- ON public.embeddings
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Option 2: IVFFlat index (faster build time, good for 5-7K vectors)
-- CREATE INDEX CONCURRENTLY embeddings_vector_ivfflat_idx
-- ON public.embeddings
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 50);

-- ============================================================
-- USAGE NOTES
-- ============================================================

-- 1. Vector Dimensions: Schema uses 768 dimensions. Configure Gemini API:
--    vertexai.init(project="your-project", location="us-central1")
--    model = TextEmbeddingModel.from_pretrained("text-embedding-004")
--    embeddings = model.get_embeddings([text], output_dimensionality=768)

-- 2. Circular Foreign Key: Use deferred constraints when inserting:
--    BEGIN;
--    SET CONSTRAINTS fk_candidates_latest_resume DEFERRED;
--    INSERT INTO candidates (...) VALUES (...);
--    INSERT INTO resumes (...) VALUES (...);
--    UPDATE candidates SET latest_resume_id = ... WHERE candidate_id = ...;
--    COMMIT;

-- 3. Resume Updates: When a new resume is uploaded for existing candidate:
--    UPDATE resumes SET status = 'ARCHIVED' WHERE candidate_id = ? AND resume_id != ?;
--    UPDATE candidates SET latest_resume_id = ? WHERE candidate_id = ?;

-- 4. Vector Index: For 5-7K vectors, test performance without index first.
--    Sequential scans may be faster. Add index only if queries are slow.

-- 5. Partitioning: Not needed for 5-7K records. Consider if you exceed 100K+.
