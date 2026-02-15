CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`ip_address` text,
	`mac_address` text,
	`ssh_user` text,
	`ssh_credentials_encrypted` text,
	`parent_id` text,
	`capabilities` text DEFAULT '{}',
	`platform_ref` text,
	`service_url` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`confirm_before_shutdown` integer DEFAULT true NOT NULL,
	`discovered` integer DEFAULT false NOT NULL,
	`configured` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_nodes_parent_id` ON `nodes` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_nodes_type` ON `nodes` (`type`);--> statement-breakpoint
CREATE INDEX `idx_nodes_status` ON `nodes` (`status`);