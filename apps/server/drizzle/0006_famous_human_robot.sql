ALTER TABLE `machines` ADD `pinned_to_dashboard` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `pinned_to_dashboard` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `resources` SET `pinned_to_dashboard` = 1 WHERE `service_url` IS NOT NULL;