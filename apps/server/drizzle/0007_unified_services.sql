-- Migration 0007: Unification machines+resources → services

-- 1. Creer la table services
CREATE TABLE `services` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `ip_address` text,
  `mac_address` text,
  `ssh_user` text,
  `ssh_credentials_encrypted` text,
  `api_url` text,
  `api_credentials_encrypted` text,
  `service_url` text,
  `status` text NOT NULL DEFAULT 'unknown',
  `platform_ref` text,
  `inactivity_timeout` integer,
  `parent_id` text REFERENCES `services`(`id`),
  `pinned_to_dashboard` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
-- 2. Copier les machines dans services
INSERT INTO `services` (
  `id`, `name`, `type`, `ip_address`, `mac_address`, `ssh_user`,
  `ssh_credentials_encrypted`, `api_url`, `api_credentials_encrypted`,
  `service_url`, `status`, `pinned_to_dashboard`, `created_at`, `updated_at`
)
SELECT
  `id`, `name`, `type`, `ip_address`, `mac_address`, `ssh_user`,
  `ssh_credentials_encrypted`, `api_url`, `api_credentials_encrypted`,
  `service_url`, `status`, `pinned_to_dashboard`, `created_at`, `updated_at`
FROM `machines`;
--> statement-breakpoint
-- 3. Copier les resources dans services (avec parent_id = machine_id)
INSERT INTO `services` (
  `id`, `name`, `type`, `service_url`, `status`, `platform_ref`,
  `inactivity_timeout`, `parent_id`, `pinned_to_dashboard`,
  `created_at`, `updated_at`
)
SELECT
  `id`, `name`, `type`, `service_url`, `status`, `platform_ref`,
  `inactivity_timeout`, `machine_id`, `pinned_to_dashboard`,
  `created_at`, `updated_at`
FROM `resources`;
--> statement-breakpoint
-- 4. Ajouter is_structural a dependency_links
ALTER TABLE `dependency_links` ADD COLUMN `is_structural` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- 5. Creer les dependency_links structurels pour les anciennes relations machine→resource
INSERT OR IGNORE INTO `dependency_links` (
  `id`, `parent_type`, `parent_id`, `child_type`, `child_id`,
  `is_shared`, `is_structural`, `created_at`
)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'service', `machine_id`, 'service', `id`,
  0, 1, `created_at`
FROM `resources`;
--> statement-breakpoint
-- 6. Mettre a jour les valeurs parent_type/child_type existantes
-- UPDATE OR IGNORE pour eviter les conflits avec les liens structurels crees en etape 5
UPDATE OR IGNORE `dependency_links` SET `parent_type` = 'service' WHERE `parent_type` IN ('machine', 'resource');
--> statement-breakpoint
UPDATE OR IGNORE `dependency_links` SET `child_type` = 'service' WHERE `child_type` IN ('machine', 'resource');
--> statement-breakpoint
-- Supprimer les liens non-mis-a-jour (doublons des liens structurels)
DELETE FROM `dependency_links` WHERE `parent_type` IN ('machine', 'resource') OR `child_type` IN ('machine', 'resource');
--> statement-breakpoint
-- 7. Renommer resource_id → service_id dans cascades
ALTER TABLE `cascades` RENAME COLUMN `resource_id` TO `service_id`;
--> statement-breakpoint
-- 8. Supprimer les anciennes tables
DROP TABLE `resources`;
--> statement-breakpoint
DROP TABLE `machines`;
