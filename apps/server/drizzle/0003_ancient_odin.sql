CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`platform_ref` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`service_url` text,
	`inactivity_timeout` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade
);
