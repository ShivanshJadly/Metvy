CREATE SCHEMA IF NOT EXISTS "frontend";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('active', 'suspended', 'deleted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidates" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(50),
	"location" varchar NOT NULL,
	"skills" varchar(255)[],
	"career_path_summary" text,
	"total_years_experience" double precision,
	"key_domains" varchar(255)[],
	"achievements" varchar(255)[],
	"hobbies" varchar(255)[],
	"academic_summary" text,
	"latest_resume_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frontend"."Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"lastContext" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "education" (
	"education_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"level" varchar(50) NOT NULL,
	"institution_name" varchar(255) NOT NULL,
	"degree_or_certificate" varchar(255) NOT NULL,
	"major_or_specialization" varchar(255),
	"year_of_passing" integer NOT NULL,
	"score" double precision,
	"summary" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embeddings" (
	"embedding_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"resume_id" uuid,
	"embedding" vector(1536),
	"document" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "internships" (
	"internship_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"company_description" text,
	"company_tags" varchar(255)[],
	"role_title" varchar(255) NOT NULL,
	"role_description" text,
	"role_tags" varchar(255)[],
	"duration_months" double precision,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"company_description" text,
	"company_tags" varchar(255)[],
	"role_title" varchar(255) NOT NULL,
	"role_description" text,
	"role_tags" varchar(255)[],
	"duration_months" double precision,
	"domain_tags" varchar(255)[],
	"achievements_summary" text,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frontend"."Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"parent_message_id" uuid,
	"resume_ids" uuid[] DEFAULT '{}',
	"candidate_ids" uuid[] DEFAULT '{}',
	"similarity_scores" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_description" text,
	"technologies_used" varchar(255)[],
	"role_in_project" varchar(255),
	"tags" varchar(255)[],
	"duration_months" double precision,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resumes" (
	"resume_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid,
	"gcs_bucket" varchar(255) NOT NULL,
	"gcs_file_path" varchar(1024) NOT NULL,
	"status" varchar(50) NOT NULL,
	"is_paid" boolean NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frontend"."User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"email" varchar(64) NOT NULL,
	"password" varchar(64),
	"phoneNumber" varchar(20),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "frontend"."Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "frontend"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "frontend"."Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "frontend"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "frontend"."Message" ADD CONSTRAINT "Message_parent_message_id_Message_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "frontend"."Message"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidates_email" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidates_skills" ON "candidates" USING gin ("skills");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidates_key_domains" ON "candidates" USING gin ("key_domains");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_education_candidate_id" ON "education" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embeddings_candidate_id" ON "embeddings" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embeddings_resume_id" ON "embeddings" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embeddings_metadata" ON "embeddings" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_internships_candidate_id" ON "internships" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_candidate_id" ON "jobs" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_company_tags" ON "jobs" USING gin ("company_tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_role_tags" ON "jobs" USING gin ("role_tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_candidate_id" ON "projects" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resumes_candidate_id" ON "resumes" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resumes_gcs_path" ON "resumes" USING btree ("gcs_file_path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resumes_status" ON "resumes" USING btree ("status");
