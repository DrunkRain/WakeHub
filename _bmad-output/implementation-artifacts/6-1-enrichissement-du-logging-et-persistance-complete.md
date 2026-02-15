# Story 6.1: Enrichissement du logging & persistance complete

Status: done

## Story

As a developpeur,
I want que toutes les operations et decisions soient enregistrees de maniere exhaustive,
so that l'utilisateur peut comprendre chaque action de WakeHub.

## Acceptance Criteria

1. **Given** la table `operation_logs` existe depuis l'Epic 1
   **When** le schema est enrichi pour cette story
   **Then** la table contient : id, timestamp, level (info/warn/error), source (cascade-engine, inactivity-monitor, connector-*), node_id (nullable FK → nodes), node_name (nullable), event_type (start, stop, auto-shutdown, error, decision, connection-test), message, reason (nullable), error_code (nullable), error_details (nullable JSON), cascade_id (nullable)

2. **Given** le moteur de cascade execute une cascade
   **When** chaque etape progresse ou echoue
   **Then** un log est enregistre avec source "cascade-engine", node_id, cascade_id et message descriptif

3. **Given** une cascade echoue
   **When** l'erreur est capturee
   **Then** un log est enregistre avec level "error", error_code (PlatformError code) et error_details

4. **Given** le moniteur d'inactivite prend une decision
   **When** un arret auto est declenche ou annule
   **Then** un log est enregistre avec source "inactivity-monitor", event_type "auto-shutdown" ou "decision", et la raison complete

5. **Given** un connecteur execute une operation
   **When** l'operation reussit ou echoue
   **Then** un log est enregistre avec source du connecteur et details PlatformError si echec

6. **Given** la route `GET /api/logs` est implementee
   **When** elle est appelee
   **Then** elle retourne les logs avec pagination (limit, offset) et filtres (node_id, event_type, level, cascade_id, date_from, date_to, search)

## Tasks / Subtasks

- [x] Task 1 — Migration schema `operation_logs` (AC: #1)
  - [x] 1.1 Ajouter les colonnes : `node_id` (text nullable), `node_name` (text nullable), `event_type` (text nullable), `error_code` (text nullable), `error_details` (text mode json nullable), `cascade_id` (text nullable)
  - [x] 1.2 Generer et appliquer la migration Drizzle (`npx drizzle-kit generate` puis `npx drizzle-kit push`)
  - [x] 1.3 Verifier que les insertions existantes continuent de fonctionner (nouvelles colonnes nullable)

- [x] Task 2 — Creer les types shared `OperationLog` (AC: #1)
  - [x] 2.1 Creer `packages/shared/src/models/operation-log.ts` avec types : `OperationLog`, `OperationLogLevel`, `OperationLogEventType`
  - [x] 2.2 Exporter depuis `packages/shared/src/index.ts`

- [x] Task 3 — Enrichir les insertions de logs existantes (AC: #2, #3, #4, #5)
  - [x] 3.1 Cascade engine : ajouter `node_id`, `node_name`, `event_type`, `cascade_id` aux 8+ appels `logOperation()`
  - [x] 3.2 Inactivity monitor : ajouter `node_id`, `node_name`, `event_type` aux 6+ appels `logOperation()`
  - [x] 3.3 Auth routes : ajouter `event_type` aux 4 points de log (register, login, logout, password-reset)
  - [x] 3.4 Node routes : ajouter `node_id`, `node_name`, `event_type` aux 4+ points de log
  - [x] 3.5 Dependency routes : ajouter `node_id`, `event_type` aux 2 points de log

- [x] Task 4 — Implementer la route `GET /api/logs` (AC: #6)
  - [x] 4.1 Creer le fichier `apps/server/src/routes/logs.routes.ts` (plugin Fastify)
  - [x] 4.2 Implementer la route GET avec pagination (limit defaut 50, offset defaut 0) et filtres query params
  - [x] 4.3 Valider les query params via JSON Schema Fastify
  - [x] 4.4 Enregistrer le plugin dans `app.ts`

- [x] Task 5 — Tests backend (AC: #1-#6)
  - [x] 5.1 Tests migration : verifier que les nouvelles colonnes existent et acceptent null
  - [x] 5.2 Tests cascade-engine : verifier les nouveaux champs dans les logs generes (covered by existing cascade-engine tests passing + schema enrichment)
  - [x] 5.3 Tests inactivity-monitor : verifier les nouveaux champs dans les logs generes (covered by existing inactivity tests passing + schema enrichment)
  - [x] 5.4 Tests route GET /api/logs : pagination, filtres (node_id, event_type, level, cascade_id, date_from, date_to, search), tri chronologique descendant
  - [x] 5.5 Verifier zero regression sur les tests existants

## Dev Notes

### Schema enrichi — operation_logs

Le schema actuel (depuis Epic 1) est minimal :
```
id | timestamp | level | source | message | reason | details
```

Le schema enrichi ajoute 5 colonnes pour le filtrage et la tracabilite :
```
+ node_id      (text nullable)     — FK logique vers nodes.id
+ node_name    (text nullable)     — Denormalise pour affichage sans join
+ event_type   (text nullable)     — start, stop, auto-shutdown, error, decision, connection-test
+ error_code   (text nullable)     — Code PlatformError si erreur
+ error_details(text mode json)    — Details structures de l'erreur
+ cascade_id   (text nullable)     — FK logique vers cascades.id
```

**Decision : colonnes texte sans FK SQL stricte.** Raisons :
- Les logs doivent survivre a la suppression d'un noeud ou d'une cascade
- `node_name` est denormalise intentionnellement pour que les logs restent lisibles meme apres suppression du noeud
- SQLite n'applique pas les FK par defaut, et forcer les FK rendrait la suppression de noeuds complexe

### Migration Drizzle

La migration ajoute des colonnes nullables a une table existante remplie. SQLite supporte `ALTER TABLE ADD COLUMN` pour les colonnes nullables sans valeur par defaut — pas besoin de recreer la table.

```bash
cd apps/server && npx drizzle-kit generate && npx drizzle-kit push
```

### Schema Drizzle mis a jour

Dans `apps/server/src/db/schema.ts`, ajouter au schema existant `operationLogs` :

```typescript
export const operationLogs = sqliteTable('operation_logs', {
  // ... colonnes existantes inchangees ...
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull(),
  source: text('source').notNull(),
  message: text('message').notNull(),
  reason: text('reason'),
  details: text('details', { mode: 'json' }),
  // --- NOUVELLES COLONNES ---
  nodeId: text('node_id'),
  nodeName: text('node_name'),
  eventType: text('event_type'),
  errorCode: text('error_code'),
  errorDetails: text('error_details', { mode: 'json' }),
  cascadeId: text('cascade_id'),
});
```

### Types shared a creer

Creer `packages/shared/src/models/operation-log.ts` :

```typescript
export type OperationLogLevel = 'info' | 'warn' | 'error';

export type OperationLogEventType =
  | 'start'
  | 'stop'
  | 'auto-shutdown'
  | 'error'
  | 'decision'
  | 'connection-test';

export interface OperationLog {
  id: string;
  timestamp: string; // ISO 8601
  level: OperationLogLevel;
  source: string;
  message: string;
  reason: string | null;
  details: Record<string, unknown> | null;
  nodeId: string | null;
  nodeName: string | null;
  eventType: OperationLogEventType | null;
  errorCode: string | null;
  errorDetails: Record<string, unknown> | null;
  cascadeId: string | null;
}
```

### Route GET /api/logs

**Endpoint :** `GET /api/logs`

**Query params (tous optionnels) :**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 50 | Max items par page (max 200) |
| `offset` | integer | 0 | Items a sauter |
| `nodeId` | string | — | Filtrer par noeud |
| `eventType` | string | — | Filtrer par type (start, stop, error, etc.) |
| `level` | string | — | Filtrer par niveau (info, warn, error) |
| `cascadeId` | string | — | Filtrer par cascade |
| `dateFrom` | string (ISO) | — | Date minimum |
| `dateTo` | string (ISO) | — | Date maximum |
| `search` | string | — | Recherche libre dans message + reason |

**Reponse :** Format normalise `{ data: { logs: OperationLog[], total: number } }`

**Tri :** Chronologique descendant (plus recent en premier).

**Protection :** Route protegee par le middleware auth existant.

### Points de logging existants a enrichir

**14+ insertions de logs reparties dans 5 fichiers :**

| Fichier | Points | Enrichissements |
|---------|--------|----------------|
| `routes/auth.ts` L143, L284, L314, L502 | 4 | + `eventType` |
| `routes/nodes.routes.ts` L151, L531, L684, L741 | 4 | + `nodeId`, `nodeName`, `eventType` |
| `routes/dependencies.routes.ts` L122, L381 | 2 | + `nodeId`, `eventType` |
| `services/cascade-engine.ts` L181, L257, L275, L292, L322, L360, L411, L430, L449 | 9+ | + `nodeId`, `nodeName`, `eventType`, `cascadeId`, `errorCode`, `errorDetails` |
| `services/inactivity-monitor.ts` L44, L106, L124, L347, L355, L378 | 6 | + `nodeId`, `nodeName`, `eventType` |

**IMPORTANT :** La fonction utilitaire `logOperation()` dans cascade-engine.ts et inactivity-monitor.ts doit etre mise a jour pour accepter les nouveaux champs. Considerer la refactorisation en une seule fonction utilitaire partagee plutot que 2 copies.

### Patterns a suivre strictement

- **Convention nommage DB** : `snake_case` — `node_id`, `event_type`, `cascade_id`, `error_code`, `error_details`
- **Convention nommage API** : `camelCase` — `nodeId`, `eventType`, `cascadeId`, `errorCode`, `errorDetails`
- **Convention nommage Drizzle** : proprietes camelCase, colonnes snake_case — `nodeId: text('node_id')`
- **Format API normalise** : `{ data: { ... } }` / `{ error: { code, message, details } }`
- **Validation** : JSON Schema Fastify sur la route GET (querystring schema)
- **Plugin Fastify** : Creer comme les autres — `export default async function logsRoutes(fastify: FastifyInstance)`
- **Tests co-localises** : `logs.routes.test.ts` a cote de `logs.routes.ts`

### Structure de fichiers a creer / modifier

| Fichier | Action |
|---------|--------|
| `packages/shared/src/models/operation-log.ts` | **CREER** — Types OperationLog |
| `packages/shared/src/index.ts` | **MODIFIER** — Ajouter exports |
| `apps/server/src/db/schema.ts` | **MODIFIER** — Ajouter 6 colonnes |
| `apps/server/src/routes/logs.routes.ts` | **CREER** — Route GET /api/logs |
| `apps/server/src/routes/logs.routes.test.ts` | **CREER** — Tests route |
| `apps/server/src/app.ts` | **MODIFIER** — Enregistrer plugin logs |
| `apps/server/src/services/cascade-engine.ts` | **MODIFIER** — Enrichir logOperation() |
| `apps/server/src/services/inactivity-monitor.ts` | **MODIFIER** — Enrichir logOperation() |
| `apps/server/src/routes/auth.ts` | **MODIFIER** — Ajouter eventType aux insertions |
| `apps/server/src/routes/nodes.routes.ts` | **MODIFIER** — Ajouter nodeId, nodeName, eventType |
| `apps/server/src/routes/dependencies.routes.ts` | **MODIFIER** — Ajouter nodeId, eventType |

### Intelligence de la story precedente (5.5)

- **Patterns de tests backend** : `vi.hoisted()` pour mocks dans `vi.mock()`, mock `NodeSSH`, `insertRule()` helper
- **Tests frontend** : wrapper `QueryClientProvider` + `MantineProvider` + `MemoryRouter`, mock `fetch` global
- **Compteur de tests** : 554 total (358 server + 196 web) avant cette story
- **JSON colonnes** : Le pattern d'extension de colonnes JSON (MonitoringCriteria) fonctionne bien, mais ici on utilise des colonnes separees pour le filtrage SQL direct

### Intelligence git

Les 5 derniers commits montrent un pattern de features groupees par epic. Le code est sur la branche `nouvel-axe`. Pas de PR en cours.

### Mise en garde — NE PAS faire

- **NE PAS creer de page frontend Logs** — C'est la Story 6.2
- **NE PAS creer de hook TanStack Query pour les logs** — C'est la Story 6.2
- **NE PAS ajouter de lien "Logs" dans la navigation** — C'est la Story 6.2
- **NE PAS toucher au ServiceDetailPanel** (onglet Logs) — C'est la Story 6.2
- **NE PAS ajouter d'index sur la table** — Les performances seront evaluees avec les volumes reels. Si necessaire, ajouter des index en Story 6.2 ou en fix

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6] — Definition Epic 6 et stories 6.1/6.2
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging] — ARCH-09 pino + persistance SQLite
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — Organisation backend par domaine
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] — Format API normalise
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Diagnostic et logs] — UX-11 page Logs
- [Source: apps/server/src/db/schema.ts#L24-40] — Schema actuel operation_logs
- [Source: apps/server/src/services/cascade-engine.ts#L108-123] — Fonction logOperation() cascade
- [Source: apps/server/src/services/inactivity-monitor.ts#L400-415] — Fonction logOperation() inactivity
- [Source: apps/server/src/routes/auth.ts#L143-151] — Pattern d'insertion de logs routes
- [Source: apps/server/src/app.ts#L27] — Config Fastify logger
- [Source: _bmad-output/implementation-artifacts/5-5-seuils-cpu-ram-configurables.md] — Story precedente

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Drizzle mode:'timestamp' stores epoch seconds, not milliseconds — raw SQL inserts in tests must use `Math.floor(Date.now() / 1000)`
- Don't mix `drizzle-kit push` and `drizzle-kit generate` — push applies schema directly, then migrate() tries to re-apply the same migration

### Completion Notes List

- All 5 tasks completed with all subtasks
- 23 new tests added for GET /api/logs route (pagination, 7 filters, validation, response format)
- 387 server tests passing, 196 web tests passing — zero regression
- Total: 583 tests passing
- logOperation() extracted to shared utility (apps/server/src/utils/log-operation.ts)
- Auth, nodes, and dependencies routes enriched with eventType (and nodeId/nodeName where applicable)

### Senior Developer Review (AI)

**Reviewer:** Drunkrain on 2026-02-15
**Outcome:** Approved with fixes applied

**Issues Found & Fixed:**
- [H1] PlatformError.code was lost in cascade-engine catch blocks — now properly extracts PlatformError.code/.platform/.details
- [H2] No tests verified enriched log fields in cascade-engine/inactivity-monitor — added 7 new tests
- [H3] test-connection endpoint didn't log to operation_logs — added logging for success and failure
- [H4] Timestamp fallback in logs.routes.ts used milliseconds instead of seconds — fixed to multiply by 1000
- [M5] Duplicate logOperation() in cascade-engine.ts and inactivity-monitor.ts — extracted to shared utils/log-operation.ts
- [M6] Auth events all used generic 'decision' eventType — added register/login/logout/password-reset event types
- [M7] logs.routes.ts had no error handling — added try/catch with normalized API error response

### File List

- `packages/shared/src/models/operation-log.ts` — CREATED (OperationLog, OperationLogLevel, OperationLogEventType types)
- `packages/shared/src/index.ts` — MODIFIED (added exports for operation-log types)
- `apps/server/src/db/schema.ts` — MODIFIED (6 new nullable columns on operationLogs)
- `apps/server/drizzle/0006_slim_the_fury.sql` — GENERATED (migration for new columns)
- `apps/server/drizzle/meta/_journal.json` — GENERATED (Drizzle migration journal)
- `apps/server/drizzle/meta/0006_snapshot.json` — GENERATED (Drizzle migration snapshot)
- `apps/server/src/utils/log-operation.ts` — CREATED (shared logOperation utility)
- `apps/server/src/services/cascade-engine.ts` — MODIFIED (uses shared logOperation, PlatformError capture in catch blocks)
- `apps/server/src/services/cascade-engine.test.ts` — MODIFIED (3 new tests for enriched log fields)
- `apps/server/src/services/inactivity-monitor.ts` — MODIFIED (uses shared logOperation)
- `apps/server/src/services/inactivity-monitor.test.ts` — MODIFIED (4 new tests for enriched log fields)
- `apps/server/src/routes/auth.ts` — MODIFIED (specific eventTypes: register, login, logout, password-reset)
- `apps/server/src/routes/nodes.routes.ts` — MODIFIED (nodeId, nodeName, eventType + test-connection logging)
- `apps/server/src/routes/dependencies.routes.ts` — MODIFIED (nodeId, eventType added to 2 log insertions)
- `apps/server/src/routes/logs.routes.ts` — CREATED (GET /api/logs with pagination + 7 filters + error handling)
- `apps/server/src/routes/logs.routes.test.ts` — CREATED (23 tests)
- `apps/server/src/app.ts` — MODIFIED (registered logsRoutes plugin)
