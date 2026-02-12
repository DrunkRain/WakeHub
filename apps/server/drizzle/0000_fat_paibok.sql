CREATE TABLE `operation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`reason` text,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`security_question` text NOT NULL,
	`security_answer_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);