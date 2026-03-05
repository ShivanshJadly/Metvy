ALTER TABLE "frontend"."ResumeRequest" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "frontend"."ResumeRequest" ADD COLUMN "chatId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "frontend"."ResumeRequest" ADD CONSTRAINT "ResumeRequest_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "frontend"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
