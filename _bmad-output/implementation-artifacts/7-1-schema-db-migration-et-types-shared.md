# Story 7.1 : Schema DB + Migration + Types Shared

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developpeur,
I want migrer le schema de base de donnees vers un modele unifie "services" et mettre a jour les types partages,
so that toutes les entites gerees (physique, Proxmox, Docker, VM, conteneur) soient au meme niveau dans une seule table.

## Acceptance Criteria (BDD)

1. **Given** la migration Drizzle est executee
   **When** je consulte la base de donnees
   **Then** la table `services` existe avec les colonnes : id, name, type, ip_address, mac_address, ssh_user, ssh_credentials_encrypted, api_url, api_credentials_encrypted, service_url, status, platform_ref, inactivity_timeout, parent_id, pinned_to_dashboard, created_at, updated_at
   **And** la colonne `type` accepte les valeurs : 'physical', 'proxmox', 'docker', 'vm', 'container'
   **And** la colonne `status` accepte les valeurs : 'online', 'offline', 'running', 'stopped', 'paused', 'unknown', 'error'
   **And** la colonne `parent_id` est une FK nullable vers services(id)

2. **Given** la migration est executee sur une base avec des machines et resources existantes
   **When** la migration se termine
   **Then** chaque ancienne machine est presente dans `services` avec son type original (physical/proxmox/docker)
   **And** chaque ancienne resource est presente dans `services` avec son type original (vm/container) et `parent_id` = ancien `machine_id`
   **And** la table `resources` n'existe plus
   **And** la table `machines` n'existe plus

3. **Given** la migration est executee
   **When** je consulte `dependency_links`
   **Then** la colonne `is_structural` existe (boolean, default false)
   **And** un dependency_link structurel (is_structural=true) existe pour chaque ancienne relation machine→resource (sauf si un lien existait deja)
   **And** toutes les valeurs `parent_type` et `child_type` sont `'service'`

4. **Given** la migration est executee
   **When** je consulte la table `cascades`
   **Then** la colonne s'appelle `service_id` (renommee depuis `resource_id`)
   **And** les donnees existantes sont preservees

5. **Given** les types shared sont mis a jour
   **When** j'importe depuis `@wakehub/shared`
   **Then** le type `Service` existe avec tous les champs (y compris `platformRef`, `inactivityTimeout`, `parentId`)
   **And** `ServiceType` = `'physical' | 'proxmox' | 'docker' | 'vm' | 'container'`
   **And** `ServiceStatus` = `'online' | 'offline' | 'running' | 'stopped' | 'paused' | 'unknown' | 'error'`
   **And** les types `Machine`, `Resource`, `MachineType`, `ResourceType`, `MachineStatus`, `ResourceStatus` n'existent plus
   **And** `DependencyNodeType` = `'service'`
   **And** `DependencyLink` inclut `isStructural: boolean`

6. **Given** les types SSE/Cascade sont mis a jour
   **When** j'importe depuis `@wakehub/shared`
   **Then** `CascadeRecord.serviceId` remplace `CascadeRecord.resourceId`
   **And** les types SSE events utilisent `serviceId` au lieu de `resourceId`
   **And** `StatusChangeEvent` utilise `serviceId` et n'a plus de champ `resourceType`

7. **Given** le schema Drizzle est mis a jour
   **When** je lance `tsc --noEmit` sur `apps/server`
   **Then** le schema compile (MAIS les routes/services ne compileront pas — attendu, fixe en story 7-2)

8. **Given** les types shared sont mis a jour
   **When** je lance `tsc --noEmit` sur `packages/shared`
   **Then** le package shared compile sans erreur

## Tasks / Subtasks

- [x] Task 1 — Mettre a jour le schema Drizzle (AC: #1, #3, #4)
  - [x] 1.1 Definir la table `services` dans schema.ts (fusion des colonnes machines + resources + nouveaux champs)
  - [x] 1.2 Supprimer les definitions `machines` et `resources` de schema.ts
  - [x] 1.3 Ajouter `isStructural` a la table `dependencyLinks` dans schema.ts
  - [x] 1.4 Mettre a jour les enums `parentType`/`childType` de dependency_links : uniquement `'service'`
  - [x] 1.5 Renommer `resourceId` → `serviceId` dans la table `cascades` (Drizzle mapping vers colonne `service_id`)

- [x] Task 2 — Ecrire la migration SQL (AC: #1, #2, #3, #4)
  - [x] 2.1 Creer le fichier migration SQL `0007_*.sql` (voir Dev Notes pour le contenu exact)
  - [x] 2.2 Creer le snapshot JSON correspondant dans `drizzle/meta/`
  - [x] 2.3 Mettre a jour `drizzle/meta/_journal.json` avec la nouvelle entree
  - [x] 2.4 Tester la migration sur une base vierge
  - [x] 2.5 Tester la migration sur une base avec des donnees existantes (machines + resources + dependency_links + cascades)

- [x] Task 3 — Mettre a jour les types shared (AC: #5, #6)
  - [x] 3.1 Remplacer `Machine` par `Service` (avec tous les champs fusionnes + platformRef, inactivityTimeout, parentId)
  - [x] 3.2 Remplacer `MachineType` par `ServiceType`, `MachineStatus`+`ResourceStatus` par `ServiceStatus`
  - [x] 3.3 Supprimer `Resource`, `ResourceType`, `DiscoveredResource` (le DiscoveredResource du connector interface reste)
  - [x] 3.4 Garder `ProxmoxPlatformRef`, `DockerPlatformRef`, `PlatformRef` (utilises par Service.platformRef)
  - [x] 3.5 Mettre a jour `DependencyNodeType` = `'service'`
  - [x] 3.6 Ajouter `isStructural: boolean` a `DependencyLink`
  - [x] 3.7 Mettre a jour `CascadeRecord` : `resourceId` → `serviceId`
  - [x] 3.8 Mettre a jour les types SSE : `resourceId` → `serviceId`, supprimer `resourceType` de StatusChangeEvent
  - [x] 3.9 Mettre a jour `GraphNode` si necessaire

- [x] Task 4 — Tests schema (AC: #7, #8)
  - [x] 4.1 Ajouter des tests pour verifier que la table `services` a les bonnes colonnes (PRAGMA table_info)
  - [x] 4.2 Ajouter un test pour verifier que `dependency_links` a la colonne `is_structural`
  - [x] 4.3 Ajouter un test pour la FK `parent_id` → services
  - [x] 4.4 Verifier que `tsc --noEmit` passe sur `packages/shared`
  - [x] 4.5 Verifier que le schema Drizzle (apps/server schema.ts) compile

## Dev Notes

### Vue d'ensemble

Cette story est la **fondation** du refactoring Epic 7. Elle modifie le schema DB et les types partages. **Apres cette story, les routes backend et le frontend NE COMPILERONT PAS** — c'est attendu et sera corrige par les stories 7-2 et 7-3.

**Points critiques :**
- La migration doit etre **idempotente** et gerer les bases existantes avec des donnees
- Les types shared sont importes par ~20 fichiers frontend et ~10 fichiers backend — les changements casseront la compilation partout sauf dans `packages/shared` lui-meme
- Le schema Drizzle doit etre ecrit AVANT la migration SQL (Drizzle genere les snapshots)
- Les connecteurs (`connector.interface.ts`) ont leur propre `DiscoveredResource` interface — elle NE CHANGE PAS (c'est une abstraction de decouverte, pas un type DB)

### Schema Drizzle — Table `services`

```typescript
export const services = sqliteTable('services', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['physical', 'proxmox', 'docker', 'vm', 'container'],
  }).notNull(),
  ipAddress: text('ip_address'),          // nullable pour vm/container
  macAddress: text('mac_address'),         // nullable
  sshUser: text('ssh_user'),              // nullable
  sshCredentialsEncrypted: text('ssh_credentials_encrypted'), // nullable
  apiUrl: text('api_url'),                // nullable
  apiCredentialsEncrypted: text('api_credentials_encrypted'), // nullable
  serviceUrl: text('service_url'),         // nullable
  status: text('status', {
    enum: ['online', 'offline', 'running', 'stopped', 'paused', 'unknown', 'error'],
  }).notNull().default('unknown'),
  platformRef: text('platform_ref', { mode: 'json' }), // nullable — JSON pour VM/container
  inactivityTimeout: integer('inactivity_timeout'),     // nullable — ms
  parentId: text('parent_id').references(() => services.id), // nullable — FK vers service parent
  pinnedToDashboard: integer('pinned_to_dashboard', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**IMPORTANT :** La colonne `ip_address` devient **nullable** (etait NOT NULL dans machines). Les VMs et conteneurs n'ont pas d'IP propre dans notre modele — ils heritent de la machine parente.

### Schema Drizzle — dependency_links mis a jour

```typescript
export const dependencyLinks = sqliteTable('dependency_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  parentType: text('parent_type', { enum: ['service'] }).notNull(),
  parentId: text('parent_id').notNull(),
  childType: text('child_type', { enum: ['service'] }).notNull(),
  childId: text('child_id').notNull(),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  isStructural: integer('is_structural', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('unique_dependency_link').on(table.parentType, table.parentId, table.childType, table.childId),
]);
```

### Schema Drizzle — cascades mis a jour

```typescript
export const cascades = sqliteTable('cascades', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull(),   // RENOMME depuis resource_id
  type: text('type', { enum: ['start', 'stop'] }).notNull(),
  // ... reste inchange
});
```

### Migration SQL — Contenu a ecrire manuellement

**ATTENTION :** Ne PAS utiliser `drizzle-kit generate` pour cette migration. Ecrire le SQL manuellement car Drizzle ne sait pas migrer les donnees.

```sql
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

-- 4. Ajouter is_structural a dependency_links
ALTER TABLE `dependency_links` ADD COLUMN `is_structural` integer NOT NULL DEFAULT 0;

-- 5. Creer les dependency_links structurels pour les anciennes relations machine→resource
-- (seulement si un lien n'existait pas deja)
INSERT OR IGNORE INTO `dependency_links` (
  `id`, `parent_type`, `parent_id`, `child_type`, `child_id`,
  `is_shared`, `is_structural`, `created_at`
)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'service', `machine_id`, 'service', `id`,
  0, 1, `created_at`
FROM `resources`;

-- 6. Mettre a jour les valeurs parent_type/child_type existantes
UPDATE `dependency_links` SET `parent_type` = 'service' WHERE `parent_type` IN ('machine', 'resource');
UPDATE `dependency_links` SET `child_type` = 'service' WHERE `child_type` IN ('machine', 'resource');

-- 7. Renommer resource_id → service_id dans cascades
ALTER TABLE `cascades` RENAME COLUMN `resource_id` TO `service_id`;

-- 8. Supprimer les anciennes tables
DROP TABLE `resources`;
DROP TABLE `machines`;
```

### Snapshot JSON

Apres avoir ecrit le schema.ts et la migration SQL, il faut creer le fichier snapshot :
- Copier `drizzle/meta/0006_snapshot.json` comme base
- Modifier pour refleter le nouveau schema (services au lieu de machines+resources)
- Mettre a jour le hash et les colonnes

**Alternative plus simple :** Apres avoir mis a jour `schema.ts`, lancer `npx drizzle-kit generate` qui creera un nouveau snapshot. Puis REMPLACER le SQL genere par notre migration manuelle. Le snapshot sera correct.

### Strategie de generation du snapshot

1. Mettre a jour `schema.ts` avec le nouveau schema
2. Lancer `npx drizzle-kit generate` — cela cree `0007_xxx.sql` + `0007_snapshot.json` + met a jour `_journal.json`
3. **REMPLACER** le contenu du fichier SQL genere par notre migration manuelle (ci-dessus)
4. Le snapshot et le journal seront deja corrects

### Types Shared — Modifications exactes

**Remplacer :**
```typescript
// AVANT
export type MachineType = 'physical' | 'proxmox' | 'docker';
export type MachineStatus = 'online' | 'offline' | 'unknown' | 'error';
export interface Machine { ... }
export type ResourceType = 'vm' | 'container';
export type ResourceStatus = 'running' | 'stopped' | 'paused' | 'unknown' | 'error';
export interface Resource { ... }
export interface DiscoveredResource { ... }

// APRES
export type ServiceType = 'physical' | 'proxmox' | 'docker' | 'vm' | 'container';
export type ServiceStatus = 'online' | 'offline' | 'running' | 'stopped' | 'paused' | 'unknown' | 'error';
export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  ipAddress: string | null;
  macAddress: string | null;
  sshUser: string | null;
  apiUrl: string | null;
  serviceUrl: string | null;
  status: ServiceStatus;
  platformRef: PlatformRef | null;
  inactivityTimeout: number | null;
  parentId: string | null;
  pinnedToDashboard: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Garder :** `ProxmoxPlatformRef`, `DockerPlatformRef`, `PlatformRef` — utilises par `Service.platformRef`

**Supprimer :** `DiscoveredResource` du shared (l'interface dans `connector.interface.ts` reste)

**Modifier DependencyNodeType :**
```typescript
// AVANT
export type DependencyNodeType = 'machine' | 'resource';
// APRES
export type DependencyNodeType = 'service';
```

**Modifier DependencyLink :**
```typescript
export interface DependencyLink {
  id: string;
  parentType: DependencyNodeType;
  parentId: string;
  childType: DependencyNodeType;
  childId: string;
  isShared: boolean;
  isStructural: boolean;  // NOUVEAU
  createdAt: string;
}
```

**Modifier SSE Events :**
```typescript
// resourceId → serviceId dans TOUS les events
export interface StatusChangeEvent {
  serviceId: string;     // RENOMME
  // resourceType SUPPRIME — plus besoin, tout est service
  status: string;
  timestamp: string;
}

export interface CascadeProgressEvent {
  cascadeId: string;
  serviceId: string;     // RENOMME
  step: number;
  totalSteps: number;
  currentDependency: { id: string; name: string; status: string };
}

export interface CascadeCompleteEvent {
  cascadeId: string;
  serviceId: string;     // RENOMME
  success: true;
}

export interface CascadeErrorEvent {
  cascadeId: string;
  serviceId: string;     // RENOMME
  failedStep: number;
  error: { code: string; message: string };
}

export interface CascadeRecord {
  id: string;
  serviceId: string;     // RENOMME
  type: CascadeType;
  status: CascadeStatus;
  // ... reste inchange
}
```

**Modifier GraphNode :**
```typescript
export interface GraphNode {
  id: string;
  name: string;
  nodeType: DependencyNodeType;  // sera toujours 'service'
  subType: string;               // 'physical', 'proxmox', 'docker', 'vm', 'container'
  status: string;
  isShared: boolean;
}
```

### Fichiers existants impactes (cette story UNIQUEMENT)

| Fichier | Action |
|---------|--------|
| `apps/server/src/db/schema.ts` | Reecrire : services, dependency_links, cascades |
| `apps/server/drizzle/0007_*.sql` | Creer : migration manuelle |
| `apps/server/drizzle/meta/0007_snapshot.json` | Creer via drizzle-kit |
| `apps/server/drizzle/meta/_journal.json` | Mettre a jour via drizzle-kit |
| `packages/shared/src/index.ts` | Reecrire : tous les types |
| `apps/server/src/db/schema.test.ts` | Ajouter : tests pour services, is_structural, parent_id FK |

### Fichiers a NE PAS modifier (stories 7-2 et 7-3)

- Toutes les routes backend (machines.routes.ts, resources.routes.ts, etc.)
- Tous les services backend (cascade-engine.ts, dependency-graph.ts, etc.)
- Tous les fichiers frontend
- Les connecteurs (connector.interface.ts garde son `DiscoveredResource`)

### Migrations existantes (pour reference)

| Migration | Contenu |
|-----------|---------|
| 0000 | users, operation_logs |
| 0001 | sessions |
| 0002 | machines |
| 0003 | resources (FK → machines) |
| 0004 | dependency_links + unique index |
| 0005 | cascades |
| 0006 | ALTER machines + resources ADD pinned_to_dashboard |

### Pattern des tests schema existants

Le fichier `schema.test.ts` utilise des PRAGMA SQLite pour verifier les colonnes :
```typescript
const cols = sqlite.pragma(`table_info('services')`) as { name: string; type: string; notnull: number }[];
```
Suivre ce pattern pour les nouveaux tests.

### Etat attendu apres cette story

- `tsc --noEmit` sur `packages/shared` : PASSE
- `tsc --noEmit` sur `apps/server` : ECHOUE (routes/services importent les anciens types — fixe en 7-2)
- `tsc --noEmit` sur `apps/web` : ECHOUE (composants importent les anciens types — fixe en 7-3)
- Migration sur base vierge : PASSE
- Migration sur base avec donnees : PASSE
- Tests schema (`schema.test.ts`) : PASSENT

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-11.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7]
- [Source: apps/server/src/db/schema.ts — schema actuel]
- [Source: packages/shared/src/index.ts — types actuels]
- [Source: apps/server/drizzle/meta/_journal.json — journal migrations]
- [Source: apps/server/src/connectors/connector.interface.ts — DiscoveredResource a ne PAS modifier]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Migration SQL requires `--> statement-breakpoint` between each SQL statement (Drizzle migrator runs statements individually via better-sqlite3's `prepare()`)
- Drizzle-kit `--custom` generates snapshot based on PREVIOUS state, not current schema — snapshot must be written manually
- Self-referencing FK in Drizzle requires `AnySQLiteColumn` import: `parentId: text('parent_id').references((): AnySQLiteColumn => services.id)`

### Completion Notes List

- Task 1: Updated schema.ts — `machines`+`resources` removed, `services` table with all 17 columns, `dependencyLinks` updated with `isStructural` and `'service'` only enums, `cascades.resourceId` → `serviceId`
- Task 2: Manual migration SQL (0007_unified_services.sql) with 10 statements + breakpoints. Snapshot and journal created manually since drizzle-kit interactive mode not usable in CLI
- Task 3: Shared types fully updated — `Service` replaces `Machine`+`Resource`, `ServiceType` includes 5 values, `ServiceStatus` unified, SSE events use `serviceId`, `DependencyNodeType='service'`, `DependencyLink.isStructural` added
- Task 4: 18 schema tests pass (14 existing + 4 new: services columns, ip_address nullable, parent_id FK, is_structural, service_id rename, data insertion tests). `tsc --noEmit` passes on packages/shared. Schema.ts compiles (route errors expected, fixed in 7-2)

### Change Log

- 2026-02-11: Story 7-1 implementation complete — DB schema unified (machines+resources→services), shared types updated, migration SQL written, 18 tests pass

### File List

- apps/server/src/db/schema.ts (modified — services table, dependency_links updated, cascades updated)
- apps/server/drizzle/0007_unified_services.sql (created — migration SQL)
- apps/server/drizzle/meta/0007_snapshot.json (created — snapshot for new schema)
- apps/server/drizzle/meta/_journal.json (modified — new migration entry)
- apps/server/src/db/schema.test.ts (modified — 18 tests including new services/is_structural/parent_id/service_id tests)
- packages/shared/src/index.ts (modified — Service, ServiceType, ServiceStatus, DependencyNodeType, DependencyLink.isStructural, SSE events serviceId)
