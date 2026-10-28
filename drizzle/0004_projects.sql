CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "projects_status_check" CHECK("projects"."status" IN ('open', 'done'))
);
--> statement-breakpoint
CREATE INDEX `projects_space_status_idx` ON `projects` (`space_id`,`status`);--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "stages_dates_check" CHECK("stages"."start_date" <= "stages"."end_date")
);
--> statement-breakpoint
CREATE INDEX `stages_project_position_idx` ON `stages` (`project_id`,`position`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `stage_id` text REFERENCES stages(id);--> statement-breakpoint
CREATE INDEX `tasks_stage_idx` ON `tasks` (`stage_id`);