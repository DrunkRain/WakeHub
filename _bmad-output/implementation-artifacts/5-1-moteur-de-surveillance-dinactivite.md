# Story 5.1 : Moteur de surveillance d'inactivité

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Créé: 2026-02-13 | Epic 5: Arrêt Automatique sur Inactivité | FRs: FR34-FR39 -->

## Story

As a administrateur,
I want que WakeHub surveille l'activité de mes services et les éteigne automatiquement après un délai d'inactivité,
So that mon homelab ne consomme pas d'électricité inutilement.

## Acceptance Criteria (BDD)

### AC1 : Schéma de base de données — table `inactivity_rules`

**Given** la table `inactivity_rules` n'existe pas encore
**When** la migration Drizzle s'exécute
**Then** la table est créée avec : `id` (UUID PK), `node_id` (FK → nodes, CASCADE delete), `timeout_minutes` (entier, défaut 30), `monitoring_criteria` (JSON : types de critères actifs), `is_enabled` (booléen, défaut true), `created_at`, `updated_at`

### AC2 : Service `inactivity-monitor.ts` — boucle de vérification

**Given** le service `inactivity-monitor.ts` est implémenté
**When** il est démarré avec le serveur
**Then** il exécute une boucle de vérification périodique (toutes les minutes) pour chaque nœud actif ayant une règle d'inactivité activée

### AC3 : Vérification des critères d'activité

**Given** un nœud actif a une règle d'inactivité configurée
**When** le moniteur vérifie l'activité
**Then** il interroge les critères configurables : connexions réseau, activité CPU/RAM, dernier accès
**And** si aucune activité → incrémente le compteur d'inactivité

### AC4 : Déclenchement d'arrêt automatique

**Given** le délai d'inactivité est dépassé
**When** le moniteur le détecte
**Then** il déclenche une cascade d'arrêt via le `cascade-engine`
**And** un événement SSE `auto-shutdown` est émis
**And** l'opération est enregistrée dans les logs avec la raison

### AC5 : Annulation sur détection d'activité

**Given** de l'activité est détectée sur un nœud
**When** le compteur d'inactivité est en cours
**Then** le compteur est remis à zéro et l'arrêt est annulé

### AC6 : Routes API pour gestion des règles

**Given** les routes API sont implémentées
**When** `GET /api/inactivity-rules?nodeId=X` et `PUT /api/inactivity-rules/:id` sont appelées
**Then** les règles sont retournées ou mises à jour avec le format `{ data }` / `{ error }` standard

## Tasks / Subtasks

- [x] **Task 1 : Schéma Drizzle & migration** (AC: #1)
  - [x] 1.1 Ajouter la table `inactivityRules` dans `apps/server/src/db/schema.ts`
  - [x] 1.2 Définir les colonnes : `id` (text PK, UUID), `nodeId` (text FK → nodes, CASCADE delete), `timeoutMinutes` (integer, défaut 30), `monitoringCriteria` (text, JSON), `isEnabled` (integer boolean, défaut true), `createdAt`, `updatedAt`
  - [x] 1.3 Créer les index : `idx_inactivity_rules_node_id`, `idx_inactivity_rules_enabled`
  - [x] 1.4 Générer la migration Drizzle (`npx drizzle-kit generate`)

- [x] **Task 2 : Types partagés** (AC: #1, #6)
  - [x] 2.1 Créer `packages/shared/src/models/inactivity-rule.ts` avec les types `InactivityRule`, `MonitoringCriteria`
  - [x] 2.2 Créer `packages/shared/src/api/inactivity-rules.ts` avec `InactivityRuleResponse`, `UpdateInactivityRuleRequest`
  - [x] 2.3 Ajouter le type SSE `auto-shutdown` dans `packages/shared/src/models/sse-event.ts`
  - [x] 2.4 Exporter tout depuis `packages/shared/src/index.ts`

- [x] **Task 3 : Service `inactivity-monitor.ts`** (AC: #2, #3, #4, #5)
  - [x] 3.1 Créer `apps/server/src/services/inactivity-monitor.ts` avec des fonctions exportées (pas de classe)
  - [x] 3.2 Implémenter `startInactivityMonitor(db, sseManager, decryptFn)` — initialise le `setInterval` (60s)
  - [x] 3.3 Implémenter `stopInactivityMonitor()` — arrête l'intervalle (pour shutdown propre)
  - [x] 3.4 Implémenter `checkAllInactivityRules(db, sseManager, decryptFn)` — boucle sur toutes les règles actives
  - [x] 3.5 Implémenter la logique de vérification d'activité par critère (réseau, CPU/RAM, dernier accès) — **Phase 1 : "last access" seulement** (ping/SSH check), les autres critères seront des stubs retournant `true` (actif)
  - [x] 3.6 Implémenter le compteur d'inactivité en mémoire (`Map<nodeId, { inactiveMinutes: number }>`)
  - [x] 3.7 Intégrer `executeCascadeStop()` du cascade-engine pour le déclenchement d'arrêt
  - [x] 3.8 Émettre l'événement SSE `auto-shutdown` via `sseManager.broadcast()`
  - [x] 3.9 Logger chaque opération via `operationLogs` (déclenchement, annulation, erreur)
  - [x] 3.10 Réinitialiser le compteur quand une activité est détectée

- [x] **Task 4 : Routes API inactivity-rules** (AC: #6)
  - [x] 4.1 Créer `apps/server/src/routes/inactivity-rules.routes.ts`
  - [x] 4.2 Implémenter `GET /api/inactivity-rules?nodeId=X` — retourne les règles pour un nœud
  - [x] 4.3 Implémenter `PUT /api/inactivity-rules/:id` — met à jour une règle existante
  - [x] 4.4 Implémenter `POST /api/inactivity-rules` — crée une règle pour un nœud (appelé automatiquement à la création de nœud ou manuellement)
  - [x] 4.5 Ajouter la validation JSON Schema Fastify sur toutes les routes
  - [x] 4.6 Ajouter le error handler standard au plugin

- [x] **Task 5 : Intégration serveur** (AC: #2)
  - [x] 5.1 Enregistrer les routes dans `apps/server/src/app.ts` avec `prefix: '/api/inactivity-rules'`
  - [x] 5.2 Appeler `startInactivityMonitor(db, sseManager, decryptFn)` après le démarrage du serveur
  - [x] 5.3 Appeler `stopInactivityMonitor()` dans le hook `onClose` de Fastify

- [x] **Task 6 : Tests unitaires** (AC: tous)
  - [x] 6.1 Créer `apps/server/src/services/inactivity-monitor.test.ts`
  - [x] 6.2 Tester : démarrage/arrêt du moniteur
  - [x] 6.3 Tester : détection d'inactivité et incrémentation du compteur
  - [x] 6.4 Tester : déclenchement de cascade stop après timeout
  - [x] 6.5 Tester : réinitialisation du compteur sur activité détectée
  - [x] 6.6 Tester : émission de l'événement SSE `auto-shutdown`
  - [x] 6.7 Tester : logging des opérations
  - [x] 6.8 Tester les routes API (GET, PUT, POST) avec validation

## Dev Notes

### Patterns architecturaux CRITIQUES à respecter

1. **Fonctions exportées, PAS de classes** — Les services existants (`cascade-engine.ts`, `dependency-graph.ts`) exportent des fonctions async pures. Le `inactivity-monitor` DOIT suivre le même pattern. Exception : le state interne (compteurs, intervalle) est stocké dans des variables de module.

2. **Injection de dépendances par paramètres** — `db: BetterSQLite3Database<typeof schema>`, `sseManager: SSEManager`, `decryptFn` passés en arguments, jamais importés directement.

3. **Format API unifié** — Toutes les réponses : `{ data: { ... } }` en succès, `{ error: { code, message, details? } }` en erreur. JSON Schema validation Fastify native.

4. **Logging via `operationLogs`** — Chaque opération significative insérée dans la table `operation_logs` avec : `level`, `source: 'inactivity-monitor'`, `message`, `reason`, `details` (JSON).

5. **SSE broadcast pattern** — Utiliser `sseManager.broadcast('auto-shutdown', { nodeId, reason, ruleId, timestamp })`. Le type `auto-shutdown` est nouveau et doit être ajouté aux types SSE partagés.

6. **Schéma Drizzle** — Suivre le pattern exact de la table `cascades` :
   - `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`
   - `integer('...', { mode: 'timestamp' }).$defaultFn(() => new Date())` pour les timestamps
   - `integer('...', { mode: 'boolean' })` pour les booléens
   - `foreignKey()` + `.onDelete('cascade')` dans le bloc de table
   - Index nommés `idx_{table}_{column}`

7. **Nommage** — Fichiers TS en `kebab-case`, colonnes DB en `snake_case`, propriétés API en `camelCase`, types en `PascalCase`.

### Détails d'implémentation du moniteur d'inactivité

#### Architecture du compteur en mémoire

```typescript
// State interne au module (pas de classe)
const inactivityCounters = new Map<string, number>(); // nodeId → minutes d'inactivité
let monitorInterval: NodeJS.Timeout | null = null;
const MONITOR_INTERVAL_MS = 60_000; // 1 minute
```

#### Logique de `checkAllInactivityRules`

```
1. SELECT toutes les inactivityRules WHERE isEnabled = true
2. JOIN avec nodes WHERE status = 'online' AND configured = true
3. Pour chaque règle :
   a. Vérifier les critères de monitoring configurés
   b. Si aucune activité détectée :
      - Incrémenter inactivityCounters[nodeId] de 1
      - Si counter >= rule.timeoutMinutes :
        → Appeler executeCascadeStop(nodeId, db, options)
        → sseManager.broadcast('auto-shutdown', ...)
        → Insert dans operationLogs
        → Supprimer le counter
   c. Si activité détectée :
      - Remettre inactivityCounters[nodeId] à 0
      - Logger si le compteur était > 0 (annulation)
```

#### Phase 1 : Critères de monitoring simplifiés

Pour cette story, implémenter un système extensible mais avec des vérifications simplifiées :

- **`last_access`** (IMPLÉMENTÉ) : Vérifier si le nœud répond à un ping SSH rapide via le connector existant. Si le nœud a un `sshUser` + credentials, tenter une commande légère. Sinon, considérer le critère comme "actif" (safe fallback).
- **`network_connections`** (STUB) : Retourner `true` (actif) — sera implémenté dans une future story si besoin.
- **`cpu_ram_activity`** (STUB) : Retourner `true` (actif) — sera implémenté dans une future story si besoin.

Le champ `monitoring_criteria` en JSON permet d'activer/désactiver chaque critère :
```json
{
  "lastAccess": true,
  "networkConnections": false,
  "cpuRamActivity": false
}
```

Un nœud est considéré "inactif" uniquement si **tous les critères activés** retournent inactif.

#### Intégration avec le cascade-engine

```typescript
import { executeCascadeStop } from './cascade-engine.js';

// Créer un enregistrement cascade avant l'exécution
const [cascade] = await db.insert(cascades).values({
  nodeId,
  type: 'stop',
}).returning();

const onProgress = (event: CascadeProgressEvent) => {
  // Broadcaster les événements de progression normaux
  broadcastCascadeEvent(sseManager, event);
};

// Fire-and-forget comme dans cascades.routes.ts
executeCascadeStop(nodeId, db, {
  cascadeId: cascade.id,
  onProgress,
  decryptFn,
}).catch((err) => {
  // Logger l'erreur mais ne pas crasher le moniteur
  logOperation(db, 'error', 'inactivity-monitor', ...);
});

// Broadcaster l'événement auto-shutdown SÉPARÉMENT
sseManager.broadcast('auto-shutdown', {
  nodeId,
  nodeName: node.name,
  ruleId: rule.id,
  reason: 'inactivity',
  inactiveMinutes: counter,
  timestamp: new Date().toISOString(),
});
```

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `apps/server/src/services/inactivity-monitor.ts` | Service principal de surveillance |
| `apps/server/src/services/inactivity-monitor.test.ts` | Tests unitaires du service |
| `apps/server/src/routes/inactivity-rules.routes.ts` | Routes API CRUD |
| `apps/server/src/routes/inactivity-rules.routes.test.ts` | Tests des routes (optionnel) |
| `packages/shared/src/models/inactivity-rule.ts` | Types modèle |
| `packages/shared/src/api/inactivity-rules.ts` | Types API request/response |

### Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/db/schema.ts` | Ajouter table `inactivityRules` + export |
| `apps/server/src/app.ts` | Enregistrer routes + démarrer/arrêter moniteur |
| `packages/shared/src/models/sse-event.ts` | Ajouter type `SSEAutoShutdownEvent` et `'auto-shutdown'` à `SSEEventType` |
| `packages/shared/src/index.ts` | Exporter les nouveaux types |

### Patterns de test (de Story 4.5)

- **`vi.hoisted()`** obligatoire pour les variables mock utilisées dans `vi.mock()` factory functions
- **Zustand store reset** : Ajouter `useCascadeStore.setState({ cascades: {} })` en `beforeEach` si applicable
- **Pas d'imports inutilisés** — `tsc -b` en mode strict échoue en Docker build
- Tests co-localisés : `foo.ts` à côté de `foo.test.ts` (pas de dossier `__tests__`)
- Framework : Vitest

### Conventions de nommage DB

| Convention | Exemple |
|-----------|---------|
| Table | `inactivity_rules` (snake_case, pluriel) |
| Colonne | `node_id`, `timeout_minutes`, `is_enabled` |
| FK pattern | `{table_singular}_id` → `node_id` |
| Index | `idx_inactivity_rules_node_id` |
| Drizzle variable | `inactivityRules` (camelCase) |

### Project Structure Notes

- Le service `inactivity-monitor.ts` rejoint `cascade-engine.ts` et `dependency-graph.ts` dans `apps/server/src/services/`
- Les routes suivent le pattern existant : `inactivity-rules.routes.ts` dans `apps/server/src/routes/`
- Les types partagés suivent la séparation `models/` vs `api/` dans `packages/shared/src/`
- Aucun conflit détecté avec la structure existante

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Stack]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing Standards]
- [Source: _bmad-output/planning-artifacts/prd.md#Surveillance d'Inactivité]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Idle/Inactivity Monitoring]
- [Source: apps/server/src/services/cascade-engine.ts — pattern fonctions exportées, logOperation, CascadeProgressEvent]
- [Source: apps/server/src/sse/sse-manager.ts — SSEManager.broadcast()]
- [Source: apps/server/src/db/schema.ts — pattern tables Drizzle, cascades, operationLogs]
- [Source: apps/server/src/routes/cascades.routes.ts — pattern routes Fastify, fire-and-forget, broadcastCascadeEvent]
- [Source: apps/server/src/routes/nodes.routes.ts — pattern CRUD, sanitization, PATCH updates]
- [Source: packages/shared/src/models/sse-event.ts — SSEEventType, pattern événements SSE]
- [Source: _bmad-output/implementation-artifacts/4-5-servicedetailpanel-et-arret-manuel.md — learnings tests Mantine, vi.hoisted()]

### Intelligence Git (commits récents)

Les 4 derniers commits montrent un pattern de développement par épic/story avec des commits atomiques :
- `aa247c9` feat: implement Epic 4 (cascade, SSE, dashboard) + code review fixes
- `699f046` feat: implement stories 2-4 to 3-2
- `74bf6c5` feat: implement Proxmox & Docker connectors
- `79382af` feat: implement Story 2.1

Le cascade-engine et le SSE manager sont stables et en production depuis Epic 4.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed net.Socket mock in tests (class-based mock instead of vi.fn for constructor compatibility)
- Fixed SQL syntax in route tests (single quotes for string literals in SQLite)

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- Task 1: Table `inactivity_rules` ajoutée au schéma Drizzle avec FK cascade, 2 index, migration 0005 générée
- Task 2: Types `InactivityRule`, `MonitoringCriteria`, `SSEAutoShutdownEvent` créés dans packages/shared, exportés depuis index.ts
- Task 3: Service `inactivity-monitor.ts` implémenté — boucle périodique 60s, compteur en mémoire, intégration cascade-engine fire-and-forget, broadcast SSE auto-shutdown, logging operationLogs. Phase 1 : critère `lastAccess` via TCP port 22, stubs pour `networkConnections` et `cpuRamActivity`
- Task 4: Routes API CRUD (GET/PUT/POST) avec validation JSON Schema Fastify, error handler standard
- Task 5: Routes enregistrées dans app.ts, moniteur démarré après boot et arrêté dans onClose hook
- Task 6: 30 tests ajoutés (18 service + 12 routes) — tous passent, 0 régression (309 server tests, 176 web tests)

### Change Log

- 2026-02-13: Implémentation complète Story 5.1 — moteur de surveillance d'inactivité avec boucle périodique, détection d'activité (Phase 1: TCP check), déclenchement cascade stop auto, événements SSE, routes API CRUD, 30 tests unitaires
- 2026-02-13: Code review — 7 issues corrigées (3 HIGH, 4 MEDIUM) :
  - H1: Extraction `broadcastCascadeEvent` dans `sse/broadcast-helpers.ts` (élimine duplication avec cascades.routes.ts)
  - H2: POST /api/inactivity-rules retourne 201 au lieu de 200
  - H3: Suppression paramètre `_decryptFn` inutilisé dans `checkLastAccess`
  - M1: Requête N+1 remplacée par un JOIN unique (inactivity_rules ⋈ nodes)
  - M2: Suppression du double cast `as unknown as Node`, utilisation du type Drizzle natif
  - M3: Chemins relatifs dans les tests de routes remplacés par `__dirname`-based paths
  - M4: Protection contre les cascades concurrentes dans `triggerAutoShutdown` + 2 tests ajoutés

### File List

**Fichiers créés :**
- `apps/server/src/services/inactivity-monitor.ts` — Service principal de surveillance d'inactivité
- `apps/server/src/services/inactivity-monitor.test.ts` — Tests unitaires du service (20 tests)
- `apps/server/src/routes/inactivity-rules.routes.ts` — Routes API CRUD pour les règles
- `apps/server/src/routes/inactivity-rules.routes.test.ts` — Tests des routes API (12 tests)
- `apps/server/src/sse/broadcast-helpers.ts` — Helper partagé broadcastCascadeEvent (extrait du code review)
- `packages/shared/src/models/inactivity-rule.ts` — Types InactivityRule, MonitoringCriteria
- `packages/shared/src/api/inactivity-rules.ts` — Types API request/response
- `apps/server/drizzle/0005_complete_arclight.sql` — Migration SQLite pour table inactivity_rules

**Fichiers modifiés :**
- `apps/server/src/db/schema.ts` — Ajout table `inactivityRules` avec FK, index
- `apps/server/src/app.ts` — Enregistrement routes + démarrage/arrêt moniteur
- `apps/server/src/routes/cascades.routes.ts` — Import broadcastCascadeEvent depuis sse/broadcast-helpers.ts (suppression duplication)
- `packages/shared/src/models/sse-event.ts` — Ajout type `SSEAutoShutdownEvent` et `'auto-shutdown'` à `SSEEventType`
- `packages/shared/src/index.ts` — Export des nouveaux types inactivity-rule et SSE
