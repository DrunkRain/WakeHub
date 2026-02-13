# Story 4.1: Moteur de cascade & orchestration deux couches

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur homelab,
I want que WakeHub orchestre automatiquement le démarrage et l'arrêt de toute la chaîne de dépendances quand je lance ou arrête un service,
so that je n'ai pas à démarrer/arrêter chaque machine, VM et conteneur manuellement — un clic suffit.

## Acceptance Criteria

### AC1 : Table `cascades` et migration Drizzle
- Une nouvelle table `cascades` est créée via migration Drizzle avec les colonnes : `id` (TEXT PK UUID), `node_id` (TEXT FK → nodes, ON DELETE CASCADE), `type` (TEXT enum: 'start', 'stop'), `status` (TEXT enum: 'pending', 'in_progress', 'completed', 'failed'), `current_step` (INTEGER default 0), `total_steps` (INTEGER default 0), `failed_step` (INTEGER nullable), `error_code` (TEXT nullable), `error_message` (TEXT nullable), `started_at` (INTEGER timestamp), `completed_at` (INTEGER timestamp nullable)
- La FK `node_id` utilise `foreignKey()` dans les contraintes de table (pattern établi, évite TS7022)
- Un index est créé sur `node_id` pour les requêtes par noeud

### AC2 : Service `cascade-engine.ts` — cascade de démarrage
- Le moteur de cascade résout d'abord les dépendances fonctionnelles (Layer 2) via `getUpstreamChain()` du `dependency-graph.ts`, ordonnées des plus profondes aux plus proches
- Pour chaque noeud à démarrer (dépendances + cible), le moteur remonte l'arbre d'hébergement (Layer 1, via `parentId`) et s'assure que chaque parent est online du haut vers le bas
- Le démarrage est toujours **séquentiel** (jamais parallèle) — un noeud à la fois
- Avant de démarrer un noeud, le moteur vérifie son statut actuel : si déjà `online`, il est sauté (pas de redémarrage inutile)
- Chaque étape a un timeout configurable (constante `CASCADE_STEP_TIMEOUT_MS`, défaut 30 000ms)
- Après `start()`, le moteur poll le statut via `getStatus()` jusqu'à confirmation `online` ou timeout
- La progression est enregistrée : chaque étape met à jour `current_step` et `total_steps` dans la table `cascades`

### AC3 : Service `cascade-engine.ts` — cascade d'arrêt (3 phases)
- **Phase 1 — Arrêt structurel** : le moteur récupère tous les enfants structurels (Layer 1, via `parentId`, récursivement en bottom-up leaf-first), et les arrête un par un via leur connecteur. Chaque enfant arrêté est marqué `offline` en DB
- **Phase 2 — Arrêt du noeud cible** : le noeud demandé est arrêté via son connecteur, poll jusqu'à confirmation `offline`
- **Phase 3 — Nettoyage conditionnel upstream** : pour chaque dépendance fonctionnelle upstream (Layer 2) du noeud éteint :
  - Si la dépendance n'a **aucun dépendant actif** (hors noeuds éteints dans cette cascade) ET `confirmBeforeShutdown` est **désactivé** → arrêter automatiquement (+ ses propres enfants structurels)
  - Si la dépendance n'a aucun dépendant actif ET `confirmBeforeShutdown` est **activé** → ne PAS arrêter, enregistrer dans les logs comme "extinction proposée" (la notification sera implémentée en Story 4.2 SSE)
  - Si la dépendance a des **dépendants actifs** → ne pas arrêter, enregistrer la raison dans les logs
  - Appliquer récursivement la Phase 3 aux dépendances des dépendances éteintes

### AC4 : Sélection du connecteur via la factory
- Le cascade engine utilise `ConnectorFactory.getConnector()` pour obtenir le bon connecteur selon le type du noeud et la capacité du parent
- Machine physique → WoL/SSH, VM/LXC → Proxmox API du parent, Conteneur → Docker API du parent
- Le noeud parent est chargé depuis la DB quand nécessaire pour obtenir ses capacités
- Les credentials sont déchiffrées via `decrypt()` avant d'être passées au connecteur

### AC5 : Protection des dépendances partagées
- Avant d'arrêter un noeud (Phase 3 du stop), le moteur vérifie via `getDownstreamDependents()` qu'aucun dépendant actif n'existe en dehors de la cascade en cours
- Les noeuds déjà éteints dans cette même cascade ne comptent PAS comme "dépendants actifs"
- Si un dépendant actif externe est trouvé, le noeud est laissé actif et la raison est enregistrée dans `operation_logs`

### AC6 : Gestion des erreurs et échecs
- Si une étape échoue (erreur connecteur ou timeout), la cascade s'arrête à l'étape en échec
- L'enregistrement `cascades` est mis à jour : `status='failed'`, `failed_step`, `error_code`, `error_message`
- Les dépendances déjà démarrées restent actives (pas de rollback)
- L'erreur est enregistrée dans `operation_logs` avec source `cascade-engine`, le `node_id` et le `cascade_id`

### AC7 : Callback de progression (préparation SSE)
- Le cascade engine accepte un callback optionnel `onProgress(event)` qui est appelé à chaque changement d'état :
  - `cascade-started` : cascade créée
  - `step-progress` : nouvelle étape en cours (nodeId, stepIndex, totalSteps)
  - `node-status-change` : statut d'un noeud changé en DB (nodeId, newStatus)
  - `cascade-complete` : cascade terminée (succès ou échec)
- Ce callback sera branché sur le SSE manager en Story 4.2
- Sans callback, le moteur fonctionne normalement (logs + DB uniquement)

### AC8 : Routes API cascades
- `POST /api/cascades/start` — Body : `{ nodeId: string }`. Lance une cascade de démarrage de manière asynchrone. Retourne immédiatement `{ data: { cascade: { id, nodeId, type: 'start', status: 'pending' } } }`
- `POST /api/cascades/stop` — Body : `{ nodeId: string }`. Lance une cascade d'arrêt. Retourne immédiatement `{ data: { cascade: { id, nodeId, type: 'stop', status: 'pending' } } }`
- `GET /api/cascades/:id` — Retourne l'état actuel d'une cascade `{ data: { cascade: { id, nodeId, type, status, currentStep, totalSteps, failedStep, errorCode, errorMessage, startedAt, completedAt } } }`
- Toutes les routes sont protégées par le middleware d'authentification
- Les réponses déclarent des schemas pour tous les codes HTTP (200, 400, 404, 500)

### AC9 : Types partagés dans @wakehub/shared
- Les types `Cascade`, `CascadeType` ('start' | 'stop'), `CascadeStatus` ('pending' | 'in_progress' | 'completed' | 'failed'), `StartCascadeRequest`, `StopCascadeRequest`, `CascadeResponse` sont définis dans le package shared
- Les types sont réexportés depuis `packages/shared/src/index.ts`

### AC10 : Logging exhaustif des opérations
- Chaque étape de cascade (démarrage d'un noeud, arrêt, skip, erreur) est enregistrée dans `operation_logs` avec :
  - `source: 'cascade-engine'`
  - `level: 'info'` pour les opérations normales, `'warn'` pour les skips (dépendance partagée, confirm before shutdown), `'error'` pour les échecs
  - `reason` : explication humaine de la décision (ex: "Dépendance partagée — dépendant actif: qBittorrent", "Extinction proposée — confirmBeforeShutdown activé")
  - Les champs `details` JSON incluent le `cascadeId` pour corrélation

## Tasks / Subtasks

- [x] Task 1 : Types partagés (AC: #9)
  - [x] 1.1 Créer `packages/shared/src/models/cascade.ts` avec `Cascade`, `CascadeType`, `CascadeStatus`
  - [x] 1.2 Créer `packages/shared/src/api/cascades.ts` avec `StartCascadeRequest`, `StopCascadeRequest`, `CascadeResponse`, `CascadeDetailResponse`
  - [x] 1.3 Réexporter depuis `packages/shared/src/index.ts`

- [x] Task 2 : Schema Drizzle et migration (AC: #1)
  - [x] 2.1 Ajouter la table `cascades` dans `apps/server/src/db/schema.ts` avec `foreignKey()` pour la FK `node_id`
  - [x] 2.2 Ajouter un index sur `node_id`
  - [x] 2.3 Générer la migration Drizzle (`npx drizzle-kit generate`)
  - [x] 2.4 Vérifier que la migration s'applique sans erreur

- [x] Task 3 : Fonctions utilitaires de traversée d'arbre Layer 1 (AC: #2, #3)
  - [x] 3.1 Dans `cascade-engine.ts`, implémenter `getStructuralAncestors(nodeId, db)` — remonte la chaîne `parentId` depuis un noeud jusqu'à la racine (retourne du plus haut au plus bas)
  - [x] 3.2 Implémenter `getStructuralDescendants(nodeId, db)` — récupère récursivement tous les enfants via `parentId` (retourne en bottom-up, leaf-first)
  - [x] 3.3 Écrire les tests unitaires pour ces deux fonctions

- [x] Task 4 : Service cascade-engine.ts — démarrage (AC: #2, #4, #7)
  - [x] 4.1 Créer `apps/server/src/services/cascade-engine.ts`
  - [x] 4.2 Implémenter `executeCascadeStart(nodeId, db, options?)` :
    - Créer l'enregistrement cascade en DB (status: pending)
    - Calculer le plan d'exécution : getUpstreamChain (Layer 2) → pour chaque noeud, getStructuralAncestors (Layer 1)
    - Dédupliquer les noeuds déjà online
    - Calculer `total_steps`
    - Exécuter séquentiellement : pour chaque noeud, getConnector → start → pollStatus → update DB status
    - Appeler `onProgress` à chaque étape
    - Gérer timeout et erreurs
  - [x] 4.3 Implémenter `pollNodeStatus(node, connector, timeoutMs)` — poll périodique (1s) du statut jusqu'à confirmation ou timeout
  - [x] 4.4 Écrire les tests unitaires (mock connectors, mock DB) : cascade simple, cascade avec dépendances, noeud déjà online sauté, timeout, erreur connecteur

- [x] Task 5 : Service cascade-engine.ts — arrêt 3 phases (AC: #3, #4, #5, #7)
  - [x] 5.1 Implémenter `executeCascadeStop(nodeId, db, options?)` :
    - Phase 1 : getStructuralDescendants → arrêter chaque enfant (leaf-first) via connecteur → marquer offline en DB
    - Phase 2 : arrêter le noeud cible → poll → marquer offline
    - Phase 3 : getUpstreamChain (Layer 2) → pour chaque dépendance upstream, vérifier dépendants actifs → arrêter si orphelin et confirmBeforeShutdown désactivé → récursif
  - [x] 5.2 Implémenter la logique de protection des dépendances partagées (AC #5)
  - [x] 5.3 Implémenter la logique `confirmBeforeShutdown` (AC #3, Phase 3)
  - [x] 5.4 Écrire les tests unitaires : arrêt simple, arrêt avec enfants structurels, protection dépendance partagée, confirmBeforeShutdown activé/désactivé, nettoyage récursif des deps

- [x] Task 6 : Routes API cascades (AC: #8)
  - [x] 6.1 Créer `apps/server/src/routes/cascades.routes.ts` comme `FastifyPluginAsync`
  - [x] 6.2 Implémenter `POST /api/cascades/start` — valide nodeId, crée cascade, lance executeCascadeStart en async (pas d'await), retourne immédiatement
  - [x] 6.3 Implémenter `POST /api/cascades/stop` — valide nodeId, crée cascade, lance executeCascadeStop en async, retourne immédiatement
  - [x] 6.4 Implémenter `GET /api/cascades/:id` — retourne l'état de la cascade
  - [x] 6.5 Enregistrer le plugin dans `apps/server/src/app.ts` avec prefix `/api/cascades`
  - [x] 6.6 Écrire les tests : création cascade start/stop, récupération état, noeud inexistant (404), non authentifié (401), schemas de réponse

- [x] Task 7 : Logging des opérations (AC: #10)
  - [x] 7.1 Intégrer l'insertion dans `operation_logs` à chaque étape du cascade engine (source: 'cascade-engine')
  - [x] 7.2 Logger les décisions : skip (noeud déjà online), protection dépendance partagée, confirmBeforeShutdown, erreur
  - [x] 7.3 Inclure `cascadeId` dans les `details` JSON pour corrélation

- [x] Task 8 : Validation et intégration (AC: #1-10)
  - [x] 8.1 Lancer `npm test -w apps/server` — tous les tests passent (247)
  - [x] 8.2 Lancer `tsc --noEmit` — compilation TypeScript OK
  - [x] 8.3 Lancer `docker compose up --build -d` — build réussi, serveur démarre sans erreur
  - [x] 8.4 Vérifier les compteurs de tests : 247 tests serveur (ajout 39 tests cascade)

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage dans cette story |
|---|---|---|
| TypeScript | strict mode | Partout |
| Fastify | ~5.x | Routes API backend (cascades) |
| Drizzle ORM | ~0.45.x | ORM code-first SQLite — table `cascades` |
| better-sqlite3 | ~11.x | Driver SQLite |
| Vitest | latest | Framework de test |
| node-ssh | latest | Utilisé par WolSshConnector (déjà installé) |
| wake_on_lan | latest | Utilisé par WolSshConnector (déjà installé) |

**Aucune nouvelle dépendance à installer.** Cette story est purement backend et réutilise les connecteurs et le service DAG existants.

### Contraintes architecturales critiques

1. **Modèle deux couches — distinction structurelle vs fonctionnelle** : Le cascade engine combine deux types de relations :
   - **Layer 1 (structurel)** : relations parent-enfant via `parentId` dans la table `nodes`. Détermine le canal de commande. Parent OFF → enfant forcément OFF.
   - **Layer 2 (fonctionnel)** : liens de dépendance via la table `dependency_links`. Détermine l'ordre de démarrage et le nettoyage conditionnel à l'arrêt.
   - Le service `dependency-graph.ts` gère UNIQUEMENT la Layer 2. Le cascade engine gère la Layer 1 directement via des requêtes DB sur `parentId`.

2. **Exécution asynchrone fire-and-forget** : Les routes `POST /api/cascades/start` et `POST /api/cascades/stop` lancent la cascade en arrière-plan et retournent immédiatement l'ID de cascade. Le client poll via `GET /api/cascades/:id` pour suivre la progression (en attendant le SSE de la Story 4.2).
   ```typescript
   // Dans la route POST
   const cascade = await createCascadeRecord(db, nodeId, 'start');
   // Fire-and-forget — pas d'await
   executeCascadeStart(nodeId, db, { cascadeId: cascade.id, onProgress }).catch(err => {
     fastify.log.error({ err, cascadeId: cascade.id }, 'Cascade failed');
   });
   return { data: { cascade } };
   ```

3. **Service pur avec injection DB** : Le cascade engine reçoit `db` en paramètre (même pattern que `dependency-graph.ts`). Il ne dépend PAS de l'instance Fastify globale. Les connecteurs sont instanciés via la factory.

4. **Callback onProgress découplé du SSE** : Le cascade engine accepte un callback optionnel `onProgress` pour les événements temps réel. En Story 4.1, ce callback est simplement logué. En Story 4.2, il sera branché sur le SSE manager. Cela permet de tester le moteur indépendamment du SSE.
   ```typescript
   interface CascadeOptions {
     cascadeId: string;
     onProgress?: (event: CascadeProgressEvent) => void;
     decryptFn?: (ciphertext: string) => string;
   }

   type CascadeProgressEvent =
     | { type: 'cascade-started'; cascadeId: string; nodeId: string; totalSteps: number }
     | { type: 'step-progress'; cascadeId: string; nodeId: string; stepIndex: number; totalSteps: number; currentNodeId: string; currentNodeName: string }
     | { type: 'node-status-change'; nodeId: string; status: NodeStatus }
     | { type: 'cascade-complete'; cascadeId: string; nodeId: string; success: boolean; error?: { code: string; message: string } };
   ```

5. **Séquentiel, jamais parallèle** (NFR17) : Le moteur exécute chaque étape l'une après l'autre. Pas de `Promise.all()` sur les démarrages. Cela évite les race conditions sur les APIs Proxmox/Docker et les conflits d'état.

6. **Pas de rollback sur échec** : Si une étape de cascade échoue, les dépendances déjà démarrées restent actives. L'utilisateur peut relancer manuellement. Le rollback automatique est trop risqué (double-échec possible, état incohérent).

7. **Poll status avec backoff** : Après `connector.start()` ou `connector.stop()`, le moteur poll `connector.getStatus()` toutes les secondes pendant `CASCADE_STEP_TIMEOUT_MS` (30s). Si le statut ne change pas dans ce délai → timeout error.

### Conventions de nommage

| Couche | Convention | Exemples Story 4.1 |
|---|---|---|
| Table DB | `snake_case` pluriel | `cascades` |
| Colonnes DB | `snake_case` | `node_id`, `current_step`, `total_steps`, `failed_step`, `error_code`, `started_at` |
| JSON API | `camelCase` | `nodeId`, `currentStep`, `totalSteps`, `failedStep`, `errorCode`, `startedAt` |
| Fichiers | `kebab-case` | `cascade-engine.ts`, `cascades.routes.ts` |
| Types | `PascalCase` | `Cascade`, `CascadeType`, `CascadeStatus`, `CascadeProgressEvent` |
| Constantes | `SCREAMING_SNAKE` | `CASCADE_STEP_TIMEOUT_MS`, `CASCADE_POLL_INTERVAL_MS` |
| Codes erreur | `SCREAMING_SNAKE` | `CASCADE_STEP_TIMEOUT`, `CASCADE_NODE_NOT_FOUND`, `CASCADE_ALREADY_RUNNING` |

### Codes d'erreur à implémenter

| Code | Quand | Message |
|---|---|---|
| `CASCADE_NODE_NOT_FOUND` | nodeId inexistant dans POST | "Noeud introuvable" |
| `CASCADE_STEP_TIMEOUT` | Timeout pendant poll status | "Timeout : le noeud [name] n'a pas répondu dans les [X]s" |
| `CASCADE_CONNECTOR_ERROR` | Erreur connecteur (start/stop) | Message PlatformError original |
| `CASCADE_NOT_FOUND` | GET /api/cascades/:id avec id invalide | "Cascade introuvable" |

### Architecture Compliance

#### Algorithme de démarrage (executeCascadeStart)

```
executeCascadeStart(targetNodeId)
│
├── 1. Résoudre le plan d'exécution
│   ├── getUpstreamChain(targetNodeId) → [depA, depB, ...]  (Layer 2, deep-first)
│   ├── Pour chaque dep (+ target) : getStructuralAncestors() → [root, parent1, parent2]  (Layer 1)
│   ├── Aplatir en liste ordonnée, dédupliquer
│   └── Filtrer les noeuds déjà online → plan final
│
├── 2. Créer cascade en DB (status: in_progress, total_steps: plan.length)
│
├── 3. Pour chaque noeud du plan (séquentiel) :
│   ├── Charger le noeud parent (si VM/LXC/container)
│   ├── getConnector(node.type, { parentNode, decryptFn })
│   ├── DB: node.status = 'starting'
│   ├── onProgress({ type: 'step-progress', ... })
│   ├── connector.start(node)
│   ├── pollNodeStatus(node, connector, CASCADE_STEP_TIMEOUT_MS)
│   ├── DB: node.status = 'online'
│   ├── onProgress({ type: 'node-status-change', ... })
│   ├── DB: cascade.current_step++
│   └── Log operation (source: cascade-engine)
│
├── 4a. Succès → DB: cascade.status = 'completed', completed_at
│   └── onProgress({ type: 'cascade-complete', success: true })
│
└── 4b. Échec → DB: cascade.status = 'failed', failed_step, error
    └── onProgress({ type: 'cascade-complete', success: false, error })
```

#### Algorithme d'arrêt (executeCascadeStop)

```
executeCascadeStop(targetNodeId)
│
├── Phase 1: Arrêt structurel (enfants du noeud cible)
│   ├── getStructuralDescendants(targetNodeId) → [child1, child2, ...] (leaf-first)
│   ├── Pour chaque enfant :
│   │   ├── connector.stop() si noeud online
│   │   ├── pollNodeStatus() ou marquer offline directement
│   │   ├── DB: node.status = 'offline'
│   │   ├── Ajouter à stoppedNodeIds (pour Phase 3)
│   │   └── Log + onProgress
│   └── (tous les enfants structurels sont offline)
│
├── Phase 2: Arrêt du noeud cible
│   ├── connector.stop()
│   ├── pollNodeStatus() → 'offline'
│   ├── DB: node.status = 'offline'
│   ├── Ajouter à stoppedNodeIds
│   └── Log + onProgress
│
└── Phase 3: Nettoyage conditionnel upstream
    ├── allStoppedIds = [...stoppedNodeIds]  (tracking pour protection partagée)
    ├── getUpstreamChain(targetNodeId) → [depA, depB, ...] (Layer 2)
    ├── Pour chaque dépendance upstream (la plus proche d'abord) :
    │   ├── getDownstreamDependents(depId) → dépendants
    │   ├── Filtrer dépendants : exclure ceux dans allStoppedIds
    │   ├── Si dépendants actifs restants → SKIP + log raison
    │   ├── Si aucun dépendant actif ET confirmBeforeShutdown ON → SKIP + log "extinction proposée"
    │   ├── Si aucun dépendant actif ET confirmBeforeShutdown OFF →
    │   │   ├── Phase 1 récursive : arrêter enfants structurels de dep
    │   │   ├── Arrêter dep
    │   │   ├── Ajouter dep + ses enfants à allStoppedIds
    │   │   └── Récursion : vérifier les deps upstream de dep (Phase 3 récursive)
    │   └── Log + onProgress
    └── (dépendances inutilisées nettoyées)
```

#### Patterns backend établis à reproduire

**Pattern route Fastify** (cf. `nodes.routes.ts`) :
```typescript
const cascadesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    }
    throw error;
  });

  // POST /api/cascades/start
  fastify.post('/start', {
    schema: {
      body: { type: 'object', required: ['nodeId'], properties: { nodeId: { type: 'string' } } },
      response: { 200: cascadeResponseSchema, 400: errorResponseSchema, 404: errorResponseSchema, 500: errorResponseSchema }
    }
  }, async (request, reply) => { ... });
};
export default cascadesRoutes;
```

**Pattern enregistrement plugin** (cf. `app.ts`) :
```typescript
import cascadesRoutes from './routes/cascades.routes.js';
// ...
app.register(cascadesRoutes, { prefix: '/api/cascades' });
```

**Pattern logging dual** (cf. routes existantes) :
```typescript
fastify.log.info({ cascadeId, nodeId, step }, 'Cascade step completed');
await db.insert(operationLogs).values({
  id: crypto.randomUUID(),
  timestamp: new Date(),
  level: 'info',
  source: 'cascade-engine',
  message: `Noeud ${nodeName} démarré (étape ${step}/${total})`,
  reason: null,
  details: JSON.stringify({ cascadeId, nodeId }),
});
```

**Pattern connector factory** (cf. `connector-factory.ts`) :
```typescript
import { getConnector } from '../connectors/connector-factory.js';
import { decrypt } from '../utils/crypto.js';

// Pour un VM/LXC/container, charger le parent pour ses capabilities
const parentNode = node.parentId ? await db.select().from(nodes).where(eq(nodes.id, node.parentId)).get() : undefined;
const connector = getConnector(node.type, { parentNode, decryptFn: decrypt });
await connector.start(node);
```

**Pattern erreur structurée** :
```typescript
reply.status(404).send({ error: { code: 'CASCADE_NODE_NOT_FOUND', message: 'Noeud introuvable' } });
```

### Librairies et frameworks — exigences spécifiques

#### Drizzle ORM — table `cascades`

```typescript
// apps/server/src/db/schema.ts — AJOUTER après dependencyLinks
export const cascades = sqliteTable('cascades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nodeId: text('node_id').notNull(),
  type: text('type', { enum: ['start', 'stop'] }).notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] }).notNull().default('pending'),
  currentStep: integer('current_step').notNull().default(0),
  totalSteps: integer('total_steps').notNull().default(0),
  failedStep: integer('failed_step'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => [
  foreignKey({ columns: [table.nodeId], foreignColumns: [nodes.id] }).onDelete('cascade'),
  index('idx_cascades_node_id').on(table.nodeId),
]);
```

- Utiliser `foreignKey()` dans le tableau de contraintes (pas `.references()` inline) — évite TS7022 sur la référence à `nodes`
- Migration : `npx drizzle-kit generate` puis vérifier le SQL généré

#### Fastify — schemas JSON (CRITIQUE)

- Chaque route DOIT déclarer `schema.response` pour **tous** les codes HTTP retournés (200, 400, 404, 500)
- Sans cela, le build Docker échoue silencieusement (leçon Epic 2)
- Format erreur uniforme : `{ error: { code: string, message: string, details?: object } }`

#### ConnectorFactory — déjà implémenté

Le `getConnector(nodeType, options)` existe dans `apps/server/src/connectors/connector-factory.ts` :
- `physical` → `WolSshConnector`
- `vm`/`lxc` → `ProxmoxConnector` (si parent a `proxmox_api` capability + `decryptFn`)
- `container` → `DockerConnector` (si parent a `docker_api` capability)

**IMPORTANT** : Le cascade engine doit charger le noeud parent depuis la DB pour les VM/LXC/containers, car le connecteur a besoin des capabilities du parent pour contrôler l'enfant.

### Project Structure Notes

#### Fichiers à créer

```
packages/shared/src/
  models/cascade.ts               ← NOUVEAU : types Cascade, CascadeType, CascadeStatus
  api/cascades.ts                 ← NOUVEAU : types requête/réponse API
  index.ts                        ← MODIFIER : réexporter les nouveaux types

apps/server/src/
  services/
    cascade-engine.ts             ← NOUVEAU : moteur de cascade (fonctions pures)
    cascade-engine.test.ts        ← NOUVEAU : tests cascade engine (~25+ tests)
  routes/
    cascades.routes.ts            ← NOUVEAU : routes POST start/stop + GET :id
    cascades.routes.test.ts       ← NOUVEAU : tests routes (~8+ tests)
  db/schema.ts                    ← MODIFIER : ajouter table cascades
  app.ts                          ← MODIFIER : enregistrer cascadesRoutes

apps/server/drizzle/
  0004_*.sql                      ← NOUVEAU : migration auto-générée
```

#### Alignement avec la structure existante

- Le répertoire `services/` existe déjà (`dependency-graph.ts`) — `cascade-engine.ts` s'y ajoute naturellement
- Les tests sont co-localisés (`cascade-engine.test.ts` à côté de `cascade-engine.ts`)
- Le pattern de route Fastify est identique à `nodes.routes.ts` et `dependencies.routes.ts`
- Aucun conflit de structure détecté

### Exigences de tests

#### Tests cascade-engine.ts — scénarios à couvrir

**Fonctions utilitaires Layer 1 :**
- `getStructuralAncestors` : noeud racine (pas de parent) → liste vide
- `getStructuralAncestors` : noeud avec 2 parents (physique→VM→conteneur) → retourne [physique, VM]
- `getStructuralDescendants` : noeud feuille → liste vide
- `getStructuralDescendants` : noeud avec enfants récursifs → retourne en bottom-up (leaf-first)

**Cascade de démarrage :**
- Démarrage d'un noeud sans dépendance → démarre juste le noeud (+ ses parents structurels)
- Démarrage avec dépendances (A dépend de B, B dépend de C) → démarre C, puis B, puis A
- Démarrage avec parents structurels (conteneur sur VM sur machine physique) → démarre machine, VM, puis conteneur
- Démarrage combiné Layer 1 + Layer 2 → ordre correct
- Noeud déjà online → sauté (pas de redémarrage)
- Dépendance partagée déjà online → sautée
- Timeout d'une étape → cascade failed, failed_step enregistré
- Erreur connecteur → cascade failed, error_code/error_message enregistrés
- Callback onProgress appelé à chaque étape

**Cascade d'arrêt :**
- Arrêt d'un noeud simple (pas d'enfants, pas de deps) → juste le noeud
- Arrêt avec enfants structurels → enfants arrêtés en leaf-first puis le noeud
- Phase 3 — dépendance orpheline avec confirmBeforeShutdown OFF → arrêtée automatiquement
- Phase 3 — dépendance orpheline avec confirmBeforeShutdown ON → pas arrêtée, loggée
- Phase 3 — dépendance partagée avec dépendant actif externe → protégée
- Phase 3 — nettoyage récursif des deps (dep éteinte → ses propres deps vérifiées)

#### Tests cascades.routes.ts — scénarios à couvrir

- `POST /api/cascades/start` — création réussie, retourne cascade ID immédiatement
- `POST /api/cascades/stop` — création réussie
- `POST /api/cascades/start` — nodeId inexistant → 404
- `POST /api/cascades/start` — body invalide → 400
- `GET /api/cascades/:id` — retourne état cascade
- `GET /api/cascades/:id` — id inexistant → 404
- Non authentifié → 401

#### Pattern de test — mock connecteurs

```typescript
// OBLIGATOIRE : vi.hoisted() pour les mocks utilisés dans vi.mock()
const mockStart = vi.hoisted(() => vi.fn());
const mockStop = vi.hoisted(() => vi.fn());
const mockGetStatus = vi.hoisted(() => vi.fn());

vi.mock('../connectors/connector-factory.js', () => ({
  getConnector: vi.fn().mockReturnValue({
    start: mockStart,
    stop: mockStop,
    getStatus: mockGetStatus,
    testConnection: vi.fn(),
  }),
}));
```

**Pattern test in-memory DB** (cf. `nodes.routes.test.ts`) :
```typescript
let db: ReturnType<typeof drizzle>;
let sqlite: Database.Database;

beforeAll(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
});
```

#### Compteurs de tests attendus

- Tests serveur actuels : ~208 → objectif : ~240+ (ajout ~32 tests cascade engine + routes)
- Tests web actuels : ~106 → pas de changement (cette story est backend-only)
- Commandes : `npm test -w apps/server`

### Leçons des stories précédentes (Epic 2-3) à appliquer

1. **FK self-referencing Drizzle** : `foreignKey()` dans les contraintes de table, pas `.references()` inline → évite TS7022. **Directement applicable** pour la FK `node_id` de `cascades` vers `nodes`.

2. **`vi.hoisted()` obligatoire** : Toute fonction mock utilisée dans une factory `vi.mock()` doit être déclarée via `vi.hoisted()`. Sinon erreur de hoisting.

3. **Fastify response schemas requis pour TOUS les codes HTTP** : Si une route retourne 400/404/500 sans schema déclaré, le build Docker échoue. **Toujours** déclarer les schemas.

4. **`additionalProperties: true`** sur les schemas JSON Fastify quand l'objet contient des champs dynamiques.

5. **Imports inutilisés = échec build Docker** : Le `tsc -b` strict dans le Dockerfile rejette les imports non utilisés. Toujours vérifier avec `tsc --noEmit`.

6. **Pattern `sanitizeNode()`** : Ne JAMAIS retourner `sshCredentialsEncrypted` dans les réponses API. Le cascade engine charge les noeuds depuis la DB mais ne doit pas exposer les credentials dans les événements de progression.

7. **`credentials: 'include'`** obligatoire côté frontend sur tous les appels fetch — utiliser `apiFetch`. (Pour les stories frontend futures.)

### Intelligence Git

```
699f046 feat: implement stories 2-4 to 3-2 — nodes UI, dependencies & graph visualization
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

- Le codebase a été reconstruit depuis zéro à partir de l'Epic 1 (commit `b736b54`)
- Les connecteurs WoL/SSH, Proxmox, Docker sont tous fonctionnels et testés
- Le service DAG (`dependency-graph.ts`) est en place avec `getUpstreamChain`, `getDownstreamDependents`, `isSharedDependency`, `validateLink`
- La connector factory est opérationnelle pour les 3 types de noeuds
- Toutes les stories Epic 2-3 sont en état `review` — code stable

### Information technique récente

- **Drizzle ORM ~0.45.x** : API stable, pas de breaking changes récents. Le pattern `sqliteTable()` + `foreignKey()` en contraintes est le pattern recommandé pour éviter les types circulaires.
- **Fastify ~5.x** : Exécution asynchrone fire-and-forget dans les routes Fastify : ne PAS `await` la cascade. Utiliser `.catch()` pour capturer les erreurs non-gérées et les logger. Fastify gère les rejections non-catchées via son error handler, mais il vaut mieux être explicite.
- **Poll pattern** : Utiliser `setTimeout` dans une boucle async (`while` + `await new Promise(r => setTimeout(r, interval))`) plutôt que `setInterval`. Plus propre pour les tests et le contrôle de flux.

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Cette story est le **coeur fonctionnel** du produit — le "clic magique" qui orchestre tout l'allumage/extinction
- Le moteur de cascade sera consommé par :
  - Story 4.2 (SSE) pour le feedback temps réel
  - Story 4.3 (Dashboard) pour le bouton "Démarrer"
  - Story 4.5 (ServiceDetailPanel) pour le bouton "Arrêter"
  - Story 5.1 (Inactivité) pour l'arrêt automatique
- Taille attendue des cascades : 2-8 étapes typiquement (homelab = quelques dizaines de noeuds max)
- Performance cible : cascade complète < 2 minutes (NFR2), timeout par étape 30s (NFR4)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.1] — Critères d'acceptation, FRs FR21-FR33, FR47
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — SSE, connecteurs, cascade-engine placement
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Nommage, tests co-localisés, format API
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — Placement services/, routes/, connectors/
- [Source: _bmad-output/planning-artifacts/prd.md#FR18-FR28] — Exigences fonctionnelles contrôle d'alimentation
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-06-UX-08] — ServiceTile, CascadeProgress (stories frontend futures)
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-02-12.md] — Modèle deux couches, règles d'orchestration
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-12-cascade-structurelle-vs-dependance.md] — Distinction structurel vs fonctionnel, 3 phases stop
- [Source: _bmad-output/implementation-artifacts/2-1-ajout-machine-physique-et-base-technique.md] — Pattern FK, PlatformError, connecteurs
- [Source: _bmad-output/implementation-artifacts/3-1-definition-des-dependances-et-moteur-de-graphe.md] — Service DAG, patterns routes, leçons
- [Source: _bmad-output/implementation-artifacts/3-2-visualisation-du-graphe-de-dependances.md] — Dernier état du code, compteurs de tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Implementation Plan

- Types partagés dans @wakehub/shared (Cascade, CascadeType, CascadeStatus, requêtes/réponses API)
- Schema Drizzle avec table `cascades` (FK via foreignKey(), index sur node_id), migration 0004
- Fonctions utilitaires Layer 1 : `getStructuralAncestors` (root→parent) et `getStructuralDescendants` (leaf-first)
- `executeCascadeStart` : résolution du plan (Layer 2 deep-first + Layer 1 ancestors), déduplication online, exécution séquentielle, poll status, gestion timeout/erreurs
- `executeCascadeStop` : 3 phases (arrêt structurel descendants, arrêt cible, nettoyage conditionnel upstream avec protection partagée + confirmBeforeShutdown)
- Routes Fastify : POST /start, POST /stop (fire-and-forget), GET /:id, schemas response complets
- Logging exhaustif dans operation_logs avec cascadeId pour corrélation
- Callback onProgress découplé pour intégration SSE future (Story 4.2)

### Completion Notes List

- Story créée par le moteur de contexte BMad Method
- Analyse exhaustive de tous les artefacts : epics, PRD, architecture, UX, brainstorming, sprint change proposal, 8 stories précédentes
- Intelligence git extraite des 7 derniers commits
- 7 leçons critiques des Epics 2-3 intégrées comme garde-fous
- Algorithmes START et STOP détaillés avec diagrammes ASCII
- Pattern fire-and-forget pour l'exécution asynchrone des cascades
- Callback onProgress conçu pour l'intégration SSE future (Story 4.2)
- Distinction structurelle vs fonctionnelle intégrée dès la conception (sprint change proposal)
- Aucune nouvelle dépendance requise — réutilisation complète de l'existant

### File List

**Nouveaux fichiers :**
- `packages/shared/src/models/cascade.ts` — Types Cascade, CascadeType, CascadeStatus
- `packages/shared/src/api/cascades.ts` — Types requête/réponse API cascades
- `apps/server/src/services/cascade-engine.ts` — Moteur de cascade (Layer 1+2, start/stop, poll, logging)
- `apps/server/src/services/cascade-engine.test.ts` — Tests unitaires cascade engine (30 tests)
- `apps/server/src/routes/cascades.routes.ts` — Routes API POST start/stop, GET :id
- `apps/server/src/routes/cascades.routes.test.ts` — Tests routes cascades (9 tests)
- `apps/server/drizzle/0004_romantic_reptil.sql` — Migration table cascades

**Fichiers modifiés :**
- `packages/shared/src/index.ts` — Réexport types cascade
- `apps/server/src/db/schema.ts` — Ajout table cascades avec FK et index
- `apps/server/src/app.ts` — Enregistrement plugin cascadesRoutes

### Change Log

- **2026-02-13** — Implémentation complète de la Story 4.1 : moteur de cascade deux couches (Layer 1 structurel + Layer 2 fonctionnel), routes API, types partagés, migration Drizzle, 39 nouveaux tests (247 total serveur)
