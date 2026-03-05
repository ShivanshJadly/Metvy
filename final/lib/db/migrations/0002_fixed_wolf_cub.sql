CREATE TABLE IF NOT EXISTS "frontend"."ResumeRequest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"resume_ids" uuid[] DEFAULT '{}' NOT NULL,
	"candidate_ids" uuid[] DEFAULT '{}' NOT NULL,
	"request_message" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "frontend"."ResumeRequest" ADD CONSTRAINT "ResumeRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "frontend"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
