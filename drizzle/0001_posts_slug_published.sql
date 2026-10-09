DROP INDEX "posts_created_idx";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reading_minutes" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("published_at");