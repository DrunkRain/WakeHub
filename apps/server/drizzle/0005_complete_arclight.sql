CREATE TABLE `inactivity_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`timeout_minutes` integer DEFAULT 30 NOT NULL,
	`monitoring_criteria` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_inactivity_rules_node_id` ON `inactivity_rules` (`node_id`);--> statement-breakpoint
CREATE INDEX `idx_inactivity_rules_enabled` ON `inactivity_rules` (`is_enabled`);