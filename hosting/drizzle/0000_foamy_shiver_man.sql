CREATE TABLE `assessment_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`contract` text NOT NULL,
	`manifest` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`state` text NOT NULL,
	`hash` text,
	`error` text,
	`submission_token` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assessment_jobs_created_at_idx` ON `assessment_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `signer_locks` (
	`name` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`submission_token` text NOT NULL
);
