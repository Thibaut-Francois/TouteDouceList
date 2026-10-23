ALTER TABLE `tasks` ADD `search` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Rattrapage des tâches existantes (minuscules ; les accents seront retirés à la prochaine modification).
UPDATE `tasks` SET `search` = lower(`title` || ' ' || `notes`);
