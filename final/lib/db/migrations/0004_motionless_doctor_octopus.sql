CREATE INDEX IF NOT EXISTS "idx_resume_requests_user_id" ON "frontend"."ResumeRequest" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resume_requests_status" ON "frontend"."ResumeRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resume_requests_status_created" ON "frontend"."ResumeRequest" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resume_requests_resume_ids" ON "frontend"."ResumeRequest" USING gin ("resume_ids");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resume_requests_candidate_ids" ON "frontend"."ResumeRequest" USING gin ("candidate_ids");