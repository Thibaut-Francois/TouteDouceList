CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` text NOT NULL,
	`ip_hash` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`success` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_space_time_idx` ON `login_attempts` (`space_id`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `recurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`rrule` text NOT NULL,
	`preset` text NOT NULL,
	`start_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_generated_date` text,
	`deleted_at` integer,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recurrences_priority_check" CHECK("recurrences"."priority" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE INDEX `recurrences_space_idx` ON `recurrences` (`space_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_space_idx` ON `sessions` (`space_id`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`recurrence_id` text,
	`occurrence_date` text,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurrence_id`) REFERENCES `recurrences`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_priority_check" CHECK("tasks"."priority" BETWEEN 1 AND 4),
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" IN ('open', 'done'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_recurrence_occurrence_uq` ON `tasks` (`recurrence_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `tasks_space_status_due_idx` ON `tasks` (`space_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_space_completed_idx` ON `tasks` (`space_id`,`completed_at`);