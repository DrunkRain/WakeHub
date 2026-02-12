CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`ip_address` text NOT NULL,
	`mac_address` text,
	`ssh_user` text,
	`ssh_credentials_encrypted` text,
	`api_url` text,
	`api_credentials_encrypted` text,
	`service_url` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
