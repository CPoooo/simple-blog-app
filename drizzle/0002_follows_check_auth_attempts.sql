CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_attempts_key_created_idx" ON "auth_attempts" USING btree ("key","created_at");--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_no_self" CHECK ("follows"."follower_id" <> "follows"."following_id");