CREATE TABLE `cascades` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`total_steps` integer DEFAULT 0 NOT NULL,
	`failed_step` integer,
	`error_code` text,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cascades_node_id` ON `cascades` (`node_id`);