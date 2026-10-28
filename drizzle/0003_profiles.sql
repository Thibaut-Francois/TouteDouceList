CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `recurrences` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
CREATE INDEX `recurrences_profile_idx` ON `recurrences` (`profile_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
CREATE INDEX `tasks_profile_status_due_idx` ON `tasks` (`profile_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_profile_completed_idx` ON `tasks` (`profile_id`,`completed_at`);