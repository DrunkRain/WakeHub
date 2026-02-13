CREATE TABLE `dependency_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dependency_links_unique` ON `dependency_links` (`from_node_id`,`to_node_id`);--> statement-breakpoint
CREATE INDEX `idx_dependency_links_from` ON `dependency_links` (`from_node_id`);--> statement-breakpoint
CREATE INDEX `idx_dependency_links_to` ON `dependency_links` (`to_node_id`);