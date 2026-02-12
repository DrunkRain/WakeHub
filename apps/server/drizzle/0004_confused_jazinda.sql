CREATE TABLE `dependency_links` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_type` text NOT NULL,
	`parent_id` text NOT NULL,
	`child_type` text NOT NULL,
	`child_id` text NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_dependency_link` ON `dependency_links` (`parent_type`,`parent_id`,`child_type`,`child_id`);