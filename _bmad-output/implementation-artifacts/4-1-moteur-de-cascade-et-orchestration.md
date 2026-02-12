# Story 4.1 : Moteur de cascade et orchestration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want que WakeHub demarre automatiquement toute la chaine de dependances quand je lance un service,
So that je n'ai pas a demarrer chaque machine/VM/conteneur manuellement.

## Acceptance Criteria (BDD)

1. **Given** la table `cascades` n'existe pas encore
   **When** la migration Drizzle s'execute pour cette story
   **Then** la table `cascades` est creee avec les colonnes : id, resource_id, type (enum: start, stop), status (enum: pending, in_progress, completed, failed), current_step, total_steps, failed_step, error_code, error_message, started_at, completed_at

2. **Given** le service `cascade-engine.ts` est implemente
   **When** une cascade de demarrage est demandee pour un service
   **Then** le moteur utilise `dependency-graph.getUpstreamChain()` pour obtenir la chaine complete
   **And** il demarre chaque dependance dans l'ordre (de la racine vers le service cible) en appelant le connecteur correspondant (`start()`)
   **And** il attend que chaque dependance soit operationnelle (via `getStatus()` avec polling) avant de passer a la suivante
   **And** chaque etape a un timeout configurable (30 secondes par defaut, NFR4)

3. **Given** une dependance partagee est deja en cours de demarrage par une autre cascade
   **When** le moteur rencontre cette dependance
   **Then** il attend que le demarrage en cours se termine au lieu de lancer un deuxieme demarrage
   **And** la cascade continue normalement une fois la dependance partagee operationnelle

4. **Given** une cascade de demarrage est en cours
   **When** une etape echoue (erreur du connecteur ou timeout)
   **Then** la cascade s'arrete a l'etape en echec
   **And** l'enregistrement cascade en base est mis a jour avec : status=failed, failed_step, error_code, error_message
   **And** les dependances deja demarrees restent actives (pas de rollback automatique)
   **And** l'erreur est enregistree dans les logs avec le detail de la plateforme

5. **Given** une cascade de demarrage reussit
   **When** toutes les dependances et le service cible sont operationnels
   **Then** l'enregistrement cascade en base est mis a jour avec : status=completed, completed_at
   **And** l'operation est enregistree dans les logs

6. **Given** une cascade d'arret est demandee pour un service
   **When** le moteur execute l'arret
   **Then** il utilise `dependency-graph.getDownstreamDependents()` pour identifier les enfants
   **And** il arrete dans l'ordre inverse (du service cible vers les dependances racine)
   **And** avant d'arreter chaque dependance, il verifie via `isSharedDependency()` et `getDownstreamDependents()` qu'aucun autre service actif ne l'utilise

7. **Given** une dependance partagee est utilisee par un autre service actif
   **When** le moteur tente de l'arreter
   **Then** il saute cette dependance (la laisse active)
   **And** la raison est enregistree dans les logs ("Arret de [nom] annule — dependant actif : [service]")

8. **Given** les routes API sont implementees
   **When** `POST /api/cascades/start` est appele avec un resource_id
   **Then** une cascade de demarrage est lancee de maniere asynchrone
   **And** la reponse retourne immediatement l'ID de la cascade avec status=pending

9. **Given** les routes API sont implementees
   **When** `POST /api/cascades/stop` est appele avec un resource_id
   **Then** une cascade d'arret est lancee de maniere asynchrone
   **And** la reponse retourne immediatement l'ID de la cascade

## Tasks / Subtasks

- [x] Task 1 — Schema DB : table `cascades` + types partages (AC: #1)
  - [x] 1.1 Ajouter la table `cascades` dans `schema.ts` avec toutes les colonnes specifiees
  - [x] 1.2 Generer la migration Drizzle (`npx drizzle-kit generate`)
  - [x] 1.3 Ajouter les types `CascadeRecord`, `CascadeType`, `CascadeStatus` dans `packages/shared/src/index.ts`
  - [x] 1.4 Verifier que le build compile

- [x] Task 2 — Connector factory : resolution de connecteur par noeud (AC: #2)
  - [x] 2.1 Creer `apps/server/src/services/connector-factory.ts`
  - [x] 2.2 Implementer `createConnectorForNode(db, chainNode)` qui retourne `PlatformConnector | null`
  - [x] 2.3 Gerer les machines physiques → WolSshConnector (avec dechiffrement credentials)
  - [x] 2.4 Gerer les machines proxmox/docker → retourner `null` (pas de start/stop direct)
  - [x] 2.5 Gerer les resources VM → ProxmoxConnector (avec apiUrl + credentials de la machine parente + platformRef)
  - [x] 2.6 Gerer les resources container → DockerConnector (avec apiUrl de la machine parente + platformRef)
  - [x] 2.7 Tests unitaires dans `connector-factory.test.ts`

- [x] Task 3 — Service cascade-engine (AC: #2, #3, #4, #5, #6, #7)
  - [x] 3.1 Creer `apps/server/src/services/cascade-engine.ts`
  - [x] 3.2 Implementer `executeCascadeStart(db, cascadeId, resourceId)` — chaine ascendante, demarrage sequentiel racine→cible
  - [x] 3.3 Implementer `executeCascadeStop(db, cascadeId, resourceId)` — chaine descendante, arret inverse cible→racine avec protection partagee
  - [x] 3.4 Implementer le polling de statut avec timeout configurable (30s par defaut)
  - [x] 3.5 Gerer les dependances partagees deja en cours de demarrage (attente au lieu de double-lancement)
  - [x] 3.6 Gerer les erreurs : arret a l'etape en echec, mise a jour cascade record, pas de rollback
  - [x] 3.7 Logger toutes les operations dans `operation_logs` avec details (source: 'cascade-engine')
  - [x] 3.8 Tests unitaires dans `cascade-engine.test.ts`

- [x] Task 4 — Routes API cascade (AC: #8, #9)
  - [x] 4.1 Creer `apps/server/src/routes/cascades.routes.ts`
  - [x] 4.2 `POST /api/cascades/start` — cree le record cascade, lance l'execution en background (fire-and-forget), retourne immediatement
  - [x] 4.3 `POST /api/cascades/stop` — idem pour l'arret
  - [x] 4.4 `GET /api/cascades/:id` — retourne l'etat courant d'une cascade (pour polling avant SSE)
  - [x] 4.5 Schemas Fastify JSON pour tous les status codes (200, 400, 401, 404)
  - [x] 4.6 Enregistrer les routes dans `app.ts`
  - [x] 4.7 Tests dans `cascades.routes.test.ts` (10 tests)

- [x] Task 5 — Build et verification finale
  - [x] 5.1 Verifier que le build frontend passe (tsc) ✓
  - [x] 5.2 Verifier que tous les tests backend passent (210 tests, 0 failed) ✓

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **premiere de l'Epic 4** (Dashboard & Controle d'Alimentation). Elle construit le **moteur de cascade** — le coeur du systeme qui orchestre le demarrage/arret des services en respectant l'ordre des dependances.

C'est une story **purement backend** : service + routes. Pas de frontend. Les stories suivantes ajoutent le SSE (4.2), le dashboard (4.3), le feedback visuel (4.4), et le panel detail (4.5).

**FRs couverts :** FR18, FR19, FR21, FR22, FR23, FR24, FR25, FR26

### Exigences techniques detaillees

**Task 1 — Schema cascades :**

La table `cascades` suit les memes conventions DB que le reste du projet (UUID text PK, snake_case colonnes, integer timestamps avec `mode: 'timestamp'`).

```typescript
// Dans schema.ts :
export const cascades = sqliteTable('cascades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resourceId: text('resource_id').notNull(),
  type: text('type', { enum: ['start', 'stop'] }).notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] }).notNull().default('pending'),
  currentStep: integer('current_step').notNull().default(0),
  totalSteps: integer('total_steps').notNull().default(0),
  failedStep: integer('failed_step'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
```

Types partages dans `packages/shared/src/index.ts` :

```typescript
export type CascadeType = 'start' | 'stop';
export type CascadeStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface CascadeRecord {
  id: string;
  resourceId: string;
  type: CascadeType;
  status: CascadeStatus;
  currentStep: number;
  totalSteps: number;
  failedStep: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
```

**Task 2 — Connector factory :**

Le but est de centraliser la logique de creation d'un connecteur a partir d'un noeud de la chaine. Chaque `ChainNode` a un `nodeType` ('machine' | 'resource') et un `nodeId`.

Logique de resolution :
- **machine type=physical** → `WolSshConnector({ host: machine.ipAddress, macAddress: machine.macAddress, sshUser: machine.sshUser, sshPassword: decrypt(machine.sshCredentialsEncrypted) })`
- **machine type=proxmox** → retourner `null` (on ne peut pas start/stop un serveur Proxmox directement, c'est un API server)
- **machine type=docker** → retourner `null` (on ne peut pas start/stop un hote Docker directement)
- **resource type=vm** → trouver la machine parente (via `resource.machineId`), creer `ProxmoxConnector({ apiUrl: machine.apiUrl, ...decryptCredentials(machine.apiCredentialsEncrypted), resourceRef: resource.platformRef })`
- **resource type=container** → trouver la machine parente, creer `DockerConnector({ apiUrl: machine.apiUrl, resourceRef: resource.platformRef })`

**Important :** Les credentials sont chiffres en AES-256-GCM. Utiliser `decrypt()` de `utils/crypto.ts`.

**Important :** Le ProxmoxConnector accepte deux modes d'auth dans son constructeur : `{ apiUrl, username, password }` ou `{ apiUrl, tokenId, tokenSecret }`. Les credentials dechiffres sont un JSON stringifie contenant soit `{ username, password }` soit `{ tokenId, tokenSecret }`.

Signature existante des connecteurs :
```typescript
// WolSshConnector constructor
new WolSshConnector({ host, macAddress, sshUser, sshPassword })

// ProxmoxConnector constructor
new ProxmoxConnector({ apiUrl, username?, password?, tokenId?, tokenSecret?, resourceRef?: { node, vmid } })

// DockerConnector constructor
new DockerConnector({ apiUrl, resourceRef?: { containerId } })
```

**Note :** Les connecteurs existants ont `start()`, `stop()`, `getStatus()`, `testConnection()`. Verifier les signatures exactes dans `connector.interface.ts`.

**Task 3 — Cascade engine :**

Architecture du service :

```typescript
// cascade-engine.ts

// Fonction principale START
export async function executeCascadeStart(
  db: BetterSQLite3Database<any>,
  cascadeId: string,
  resourceId: string,
  options?: { stepTimeoutMs?: number }
): Promise<void>

// Fonction principale STOP
export async function executeCascadeStop(
  db: BetterSQLite3Database<any>,
  cascadeId: string,
  resourceId: string,
  options?: { stepTimeoutMs?: number }
): Promise<void>
```

**Flow de demarrage (START) :**

1. Determiner le type du noeud cible (machine ou resource) via lookup DB
2. Appeler `getUpstreamChain(db, nodeType, nodeId)` → retourne `ChainNode[]`
3. **Verifier l'ordre** : `getUpstreamChain` retourne les noeuds via BFS depuis la cible en remontant. L'ordre retourne est [cible, parent, grand-parent, ...]. Pour le demarrage, **il faut inverser** : `chain.reverse()` pour avoir [racine, ..., parent, cible]
4. Mettre a jour le cascade record : `status='in_progress'`, `totalSteps=chain.length`
5. Pour chaque noeud de la chaine :
   a. `createConnectorForNode(db, node)` → connector ou null
   b. Si `null` → skip (machine proxmox/docker, pas de start direct)
   c. **Verifier si la dependance est deja en cours de demarrage** : checker en DB si une autre cascade `in_progress` contient ce noeud. Si oui, attendre (poll la cascade existante jusqu'a completion)
   d. Appeler `connector.start()`
   e. Poll `connector.getStatus()` toutes les 2 secondes, timeout a 30s (configurable)
   f. Si status = 'online'/'running' → succes, mettre a jour `currentStep++`
   g. Si timeout ou erreur → `PlatformError` catch, mettre a jour cascade record (failed_step, error_code, error_message), loguer, sortir de la boucle
6. Si toutes les etapes OK → `status='completed'`, `completedAt=now`
7. Loguer l'operation dans `operation_logs`

**Flow d'arret (STOP) :**

1. Obtenir les dependants downstream : `getDownstreamDependents(db, nodeType, nodeId)` → les enfants du service cible (recursivement)
2. Obtenir la chaine upstream : `getUpstreamChain(db, nodeType, nodeId)` → les parents du service cible
3. Construire la chaine d'arret complete : **enfants downstream d'abord (feuilles→cible), puis la cible, puis parents upstream (cible→racine)**. C'est l'inverse exact de l'ordre de demarrage.
4. Pour chaque noeud de la chaine d'arret :
   a. `createConnectorForNode(db, node)` → connector ou null
   b. Si `null` → skip
   c. **Protection dependance partagee** : verifier `isSharedDependency(db, node.nodeType, node.nodeId)`. Si partagee, verifier avec `getDownstreamDependents(db, node.nodeType, node.nodeId)` si d'autres dependants **en dehors de cette cascade** sont actifs (status 'running'/'online'). Si oui → skip avec log "Arret de [nom] annule — dependant actif : [service]"
   d. Appeler `connector.stop()`
   e. Poll `connector.getStatus()` — attendre 'offline'/'stopped'
   f. Mettre a jour `currentStep++`
5. Si toutes les etapes OK → `status='completed'`

**Polling pattern :**

```typescript
async function pollUntilStatus(
  connector: PlatformConnector,
  targetStatuses: string[],
  timeoutMs: number = 30_000,
  intervalMs: number = 2_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await connector.getStatus();
    if (targetStatuses.includes(status)) return status;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new PlatformError('TIMEOUT', `Timeout waiting for status ${targetStatuses.join('/')}`, 'cascade');
}
```

**Detection cascade en cours sur dependance partagee (AC #3) :**

Checker dans la table `cascades` si une cascade `in_progress` de type `start` existe pour une resource qui fait partie de la meme chaine. Approche simplifiee : verifier si le noeud a un status 'starting' ou si une cascade in_progress reference un noeud ancetre.

Approche recommandee : au lieu de tracker les cascades sur chaque noeud individuellement, simplement verifier le statut du noeud. Si `getStatus()` retourne 'online'/'running', skip le start. Si le noeud est deja en train de demarrer (status intermediaire), attendre via polling. Le connecteur `getStatus()` reflete l'etat reel.

**Task 4 — Routes :**

```typescript
// POST /api/cascades/start
// Body: { resourceId: string }
// Response 200: { data: CascadeRecord }

// POST /api/cascades/stop
// Body: { resourceId: string }
// Response 200: { data: CascadeRecord }

// GET /api/cascades/:id
// Response 200: { data: CascadeRecord }
// Response 404: { error: { code: 'NOT_FOUND', message: '...' } }
```

**Pattern fire-and-forget pour l'execution async :**

```typescript
// Dans le handler POST /api/cascades/start :
const cascadeId = crypto.randomUUID();
const now = new Date();

// Creer le record en base
await fastify.db.insert(cascades).values({
  id: cascadeId,
  resourceId: body.resourceId,
  type: 'start',
  status: 'pending',
  currentStep: 0,
  totalSteps: 0,
  startedAt: now,
});

// Lancer en background (ne pas await)
executeCascadeStart(fastify.db, cascadeId, body.resourceId)
  .catch((err) => {
    fastify.log.error({ cascadeId, err }, 'Cascade start failed unexpectedly');
  });

// Retourner immediatement
const [cascade] = await fastify.db.select().from(cascades).where(eq(cascades.id, cascadeId));
return { data: formatCascade(cascade) };
```

**Validation avant lancement :**
- Verifier que le `resourceId` existe dans la table `resources` ou `machines`
- Retourner 404 si non trouve
- Retourner 400 si une cascade `in_progress` existe deja pour cette resource (eviter les doublons)

### Conformite architecture obligatoire

**Format API (ARCH-11) :**
- Succes : `{ data: CascadeRecord }`
- Erreur : `{ error: { code, message } }`
- Codes erreur : `NOT_FOUND`, `CASCADE_IN_PROGRESS`, `VALIDATION_ERROR`

**Schemas Fastify (ARCH-04) :**
- Response schemas pour TOUS les status codes retournes (200, 400, 401, 404)
- Body schema avec required fields

**Nommage (ARCH-17) :**
- DB : `cascades`, `resource_id`, `started_at` (snake_case)
- API JSON : `resourceId`, `startedAt` (camelCase)
- Fichiers : `cascade-engine.ts`, `cascades.routes.ts` (kebab-case)
- Service : fonctions exportees (pas de classe)

**Organisation (ARCH-18) :**
- Service : `apps/server/src/services/cascade-engine.ts`
- Factory : `apps/server/src/services/connector-factory.ts`
- Routes : `apps/server/src/routes/cascades.routes.ts`
- Tests co-localises

### Librairies et frameworks requis

**Aucune nouvelle dependance.** Tout est deja installe :

| Package | Usage dans cette story |
|---------|----------------------|
| `drizzle-orm` | Schema cascades, requetes DB |
| `better-sqlite3` | Base de donnees |
| `vitest` | Tests unitaires |

### Structure de fichiers

**Fichiers a CREER :**

| Fichier | Description |
|---------|-------------|
| `apps/server/src/services/connector-factory.ts` | Resolution connecteur par noeud |
| `apps/server/src/services/connector-factory.test.ts` | Tests connector factory |
| `apps/server/src/services/cascade-engine.ts` | Moteur de cascade (start/stop) |
| `apps/server/src/services/cascade-engine.test.ts` | Tests cascade engine |
| `apps/server/src/routes/cascades.routes.ts` | Routes API cascade |
| `apps/server/src/routes/cascades.routes.test.ts` | Tests routes |
| `apps/server/drizzle/XXXX_*.sql` | Migration cascades table |

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/db/schema.ts` | Ajouter table `cascades` |
| `apps/server/src/app.ts` | Register `cascadesRoutes` |
| `packages/shared/src/index.ts` | Ajouter types `CascadeRecord`, `CascadeType`, `CascadeStatus` |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/services/dependency-graph.ts` — service existant, deja complet
- `apps/server/src/connectors/*.ts` — connecteurs existants, ne pas modifier
- `apps/server/src/utils/crypto.ts` — utilitaire existant
- Tous les fichiers frontend — cette story est purement backend

### Exigences de tests

**Framework :** Vitest (backend)
**Commande :** `npm run test -w @wakehub/server`

**Tests a creer :**

**`connector-factory.test.ts` :**
- Machine physique → retourne un WolSshConnector
- Machine proxmox → retourne null
- Machine docker → retourne null
- Resource VM (machine parente proxmox) → retourne un ProxmoxConnector
- Resource container (machine parente docker) → retourne un DockerConnector
- Machine inexistante → throw erreur

**`cascade-engine.test.ts` :**
- Cascade start reussie : chaine de 2 noeuds, connecteurs mockes, verifie l'ordre d'appel start() + polling
- Cascade start echouee : timeout sur un noeud, verifie status=failed + failed_step en DB
- Cascade start skip machine proxmox : machine proxmox dans la chaine, verifie qu'elle est skippee
- Cascade stop reussie : arret dans l'ordre inverse
- Cascade stop avec dependance partagee active : verifie que la dependance est skippee avec log
- Verifier que les operation_logs sont crees avec source='cascade-engine'

**`cascades.routes.test.ts` :**
- POST /api/cascades/start avec resourceId valide → 200 + cascade record
- POST /api/cascades/start avec resourceId inexistant → 404
- POST /api/cascades/stop avec resourceId valide → 200
- GET /api/cascades/:id existant → 200 + cascade record
- GET /api/cascades/:id inexistant → 404

**Note :** Pour les tests du cascade engine, mocker les connecteurs (`vi.mock`) et le service `dependency-graph`. Utiliser le pattern etabli dans les stories precedentes.

**Rappel mock pattern :** Pour les connecteurs utilisant `ssh2` et `wake_on_lan`, utiliser `globalThis.__lastSshClient` pour le tracking d'instance (le prototype mocking ne marche pas avec les class field assignments). Pour les tests de la factory et du cascade engine, il est plus simple de mocker les constructeurs des connecteurs directement.

### Intelligence des stories precedentes (Epic 3)

**Patterns etablis a reutiliser :**
1. **Service functions (pas classes)** : `dependency-graph.ts` exporte des fonctions qui prennent `db` en premier parametre. Suivre le meme pattern pour `cascade-engine.ts` et `connector-factory.ts`.
2. **BetterSQLite3Database<any>** : utiliser ce type pour le parametre `db` (pas `BetterSQLite3Database` sans generic)
3. **operation_logs insert pattern** : `{ timestamp: new Date(), level: 'info', source: 'cascade-engine', message: '...', reason: 'cascade-start', details: { cascadeId, step, ... } }`
4. **Fastify route plugin pattern** : async function, registree dans app.ts
5. **Test setup** : `beforeEach` cleanup des tables, `app.inject()` pour les routes

**Bugs TS corriges en Epic 3 :**
- `BetterSQLite3Database<any>` obligatoire pour compat `fastify.db`

**Fonctions dependency-graph existantes :**

```typescript
// apps/server/src/services/dependency-graph.ts
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

interface ChainNode {
  nodeType: 'machine' | 'resource';
  nodeId: string;
  name: string;
  status: string;
}

// Retourne les parents (upstream) — BFS depuis le noeud, remonte vers les racines
// L'ORDRE retourne est du plus proche au plus lointain : [parent, grand-parent, ...]
// Pour cascade start : il faut INVERSER (racine d'abord)
export function getUpstreamChain(db: BetterSQLite3Database<any>, nodeType: string, nodeId: string): ChainNode[]

// Retourne les enfants (downstream) — dependants directs
export function getDownstreamDependents(db: BetterSQLite3Database<any>, nodeType: string, nodeId: string): ChainNode[]

// Verifie si un noeud est partage (a plus d'un enfant)
export function isSharedDependency(db: BetterSQLite3Database<any>, nodeType: string, nodeId: string): boolean
```

**Important :** `getUpstreamChain` est **synchrone** (pas async). Les fonctions dependency-graph lisent la DB de facon synchrone (better-sqlite3 est synchrone). Le cascade engine wrapper ces appels dans un contexte async.

### Anti-patterns a eviter

- NE PAS creer de SSE manager — c'est la story 4.2
- NE PAS creer de composants frontend — cette story est purement backend
- NE PAS modifier les connecteurs existants — utiliser leur interface actuelle
- NE PAS modifier `dependency-graph.ts` — utiliser les fonctions existantes
- NE PAS faire de rollback automatique en cas d'echec — les dependances deja demarrees restent actives
- NE PAS bloquer la requete HTTP pendant l'execution de la cascade — fire-and-forget + retour immediat
- NE PAS utiliser `setInterval` pour le polling — utiliser une boucle `while` avec `setTimeout` promise

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.1]
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-04, ARCH-07, ARCH-11, ARCH-17, ARCH-18]
- **PRD** : [Source: _bmad-output/planning-artifacts/prd.md#FR18-FR26] — Controle d'alimentation
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#ServiceTile, CascadeProgress]
- **Stories precedentes** : [Source: _bmad-output/implementation-artifacts/3-1-*.md, 3-2-*.md, 3-3-*.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
