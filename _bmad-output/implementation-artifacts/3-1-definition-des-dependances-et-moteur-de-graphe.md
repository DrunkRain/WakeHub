# Story 3.1 : Definition des dependances & moteur de graphe

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want definir les liens de dependance entre mes machines, VMs et conteneurs,
So that WakeHub connait l'ordre de demarrage et d'arret de mes services.

## Acceptance Criteria (BDD)

1. **Given** la table `dependency_links` n'existe pas encore
   **When** la migration Drizzle s'execute pour cette story
   **Then** la table `dependency_links` est creee avec les colonnes : id, parent_type (enum: machine, resource), parent_id, child_type (enum: machine, resource), child_id, is_shared (boolean, defaut false), created_at
   **And** un index unique empeche les doublons (parent_type + parent_id + child_type + child_id)

2. **Given** le service `dependency-graph.ts` est implemente
   **When** il est utilise
   **Then** il peut calculer la chaine de dependances complete pour un service donne (ascendante et descendante)
   **And** il detecte les dependances partagees (une ressource parent avec plusieurs enfants)
   **And** il detecte les cycles et refuse les liens qui en creeraient
   **And** il expose les methodes : `getUpstreamChain(nodeId)`, `getDownstreamDependents(nodeId)`, `isSharedDependency(nodeId)`, `validateLink(parentId, childId)`

3. **Given** je suis sur la page de detail d'une machine ou resource
   **When** la section Dependances est affichee
   **Then** je vois la liste des dependances actuelles (parents et enfants) avec leur nom et type
   **And** un bouton "Ajouter une dependance" est disponible

4. **Given** je clique sur "Ajouter une dependance"
   **When** le formulaire d'ajout s'affiche
   **Then** je peux selectionner une ressource parente (dont depend cette ressource) ou une ressource enfante (qui depend de cette ressource) depuis une liste deroulante
   **And** je peux marquer la dependance comme "partagee" via une checkbox

5. **Given** je selectionne une dependance et confirme
   **When** le lien est valide (pas de cycle, pas de doublon)
   **Then** le lien est enregistre en base (table `dependency_links`)
   **And** un toast de succes s'affiche
   **And** la liste des dependances se met a jour
   **And** l'operation est enregistree dans les logs

6. **Given** je selectionne une dependance qui creerait un cycle
   **When** je confirme l'ajout
   **Then** un message d'erreur s'affiche ("Ce lien creerait un cycle de dependances")
   **And** le lien n'est pas cree

7. **Given** les routes API `POST /api/dependencies`, `GET /api/dependencies?resourceId=X`, `DELETE /api/dependencies/:id` sont implementees
   **When** elles sont appelees
   **Then** elles utilisent le format de reponse normalise `{ data }` / `{ error }`
   **And** la validation JSON Schema Fastify est appliquee

8. **Given** je consulte les dependances d'une ressource
   **When** la chaine est calculee
   **Then** le service `dependency-graph` retourne la chaine complete (ex: NAS -> VM-Media -> Jellyfin) avec le statut de chaque maillon

## Tasks / Subtasks

- [x] Task 1 — Schema DB et migration (AC: #1)
  - [x] 1.1 Ajouter la table `dependencyLinks` dans `apps/server/src/db/schema.ts` avec Drizzle ORM
  - [x] 1.2 Generer la migration SQL via `npx drizzle-kit generate`
  - [x] 1.3 Verifier que la migration s'applique correctement et que l'index unique est cree
  - [x] 1.4 Ajouter les tests de schema dans `apps/server/src/db/schema.test.ts`

- [x] Task 2 — Types partages (AC: #7, #8)
  - [x] 2.1 Ajouter les types `DependencyLink`, `DependencyNodeType`, `DependencyChainNode` dans `packages/shared/src/index.ts`

- [x] Task 3 — Service dependency-graph (AC: #2, #6, #8)
  - [x] 3.1 Creer `apps/server/src/services/dependency-graph.ts`
  - [x] 3.2 Implementer `getUpstreamChain(nodeType, nodeId)` — retourne la chaine ascendante ordonnee
  - [x] 3.3 Implementer `getDownstreamDependents(nodeType, nodeId)` — retourne les dependants descendants
  - [x] 3.4 Implementer `isSharedDependency(nodeType, nodeId)` — detecte si un noeud a plusieurs enfants
  - [x] 3.5 Implementer `validateLink(parentType, parentId, childType, childId)` — detecte cycles et doublons
  - [x] 3.6 Creer `apps/server/src/services/dependency-graph.test.ts` avec tests exhaustifs (cycles, chaines, partage)

- [x] Task 4 — Routes API dependencies (AC: #5, #6, #7)
  - [x] 4.1 Creer `apps/server/src/routes/dependencies.routes.ts`
  - [x] 4.2 Implementer `POST /api/dependencies` — creer un lien (avec validation cycle)
  - [x] 4.3 Implementer `GET /api/dependencies` — lister les liens (filtrable par nodeType + nodeId)
  - [x] 4.4 Implementer `GET /api/dependencies/chain` — retourner la chaine complete avec statuts
  - [x] 4.5 Implementer `DELETE /api/dependencies/:id` — supprimer un lien
  - [x] 4.6 Implementer `PATCH /api/dependencies/:id` — modifier is_shared
  - [x] 4.7 Ajouter les schemas JSON Fastify pour tous les status codes (200, 400, 401, 404, 409)
  - [x] 4.8 Logger chaque operation dans `operation_logs`
  - [x] 4.9 Enregistrer le plugin dans `app.ts`
  - [x] 4.10 Creer `apps/server/src/routes/dependencies.routes.test.ts`

- [x] Task 5 — API hooks frontend (AC: #3, #4, #5)
  - [x] 5.1 Creer `apps/web/src/api/dependencies.api.ts` avec les hooks TanStack Query
  - [x] 5.2 `useNodeDependencies(nodeType, nodeId)` — GET query
  - [x] 5.3 `useCreateDependency()` — POST mutation
  - [x] 5.4 `useDeleteDependency()` — DELETE mutation
  - [x] 5.5 `useUpdateDependency()` — PATCH mutation
  - [x] 5.6 `useDependencyChain(nodeType, nodeId)` — GET query pour la chaine

- [x] Task 6 — Section dependances sur machine-detail-page (AC: #3, #4, #5, #6)
  - [x] 6.1 Ajouter la section "Dependances" dans `machine-detail-page.tsx` (apres la section resources)
  - [x] 6.2 Afficher la liste des parents et enfants avec nom, type et statut
  - [x] 6.3 Ajouter le bouton "Ajouter une dependance" ouvrant une modal
  - [x] 6.4 Modal d'ajout : select du type (parent/enfant), select de la ressource cible, checkbox "partagee"
  - [x] 6.5 Gerer les erreurs (cycle, doublon) avec toast
  - [x] 6.6 Bouton supprimer sur chaque lien existant (avec confirmation)

- [x] Task 7 — Section dependances sur resource detail (AC: #3, #4, #5, #6)
  - [x] 7.1 Creer une route `/resources/:id` avec page de detail de resource (ou integrer dans machine-detail)
  - [x] 7.2 Reutiliser le composant de section dependances de la Task 6

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **premiere de l'Epic 3** et introduit le concept central de WakeHub : le graphe de dependances entre les elements d'infrastructure. Elle pose les fondations pour les cascades de demarrage/arret (Epic 4).

**Le modele de donnees** utilise un systeme generique ou chaque noeud du graphe est identifie par un couple `(nodeType, nodeId)` ou `nodeType` peut etre `'machine'` ou `'resource'`. Cela permet de creer des dependances entre n'importe quels elements : machine → resource, resource → resource, machine → machine.

**Ordre d'implementation recommande :** Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7

### Exigences techniques detaillees

**Schema de la table `dependency_links` (Task 1) :**

```typescript
// Dans apps/server/src/db/schema.ts
export const dependencyLinks = sqliteTable('dependency_links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  parentType: text('parent_type', { enum: ['machine', 'resource'] }).notNull(),
  parentId: text('parent_id').notNull(),
  childType: text('child_type', { enum: ['machine', 'resource'] }).notNull(),
  childId: text('child_id').notNull(),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('unique_dependency_link').on(table.parentType, table.parentId, table.childType, table.childId),
]);
```

**Important :** Pas de foreign key sur `parentId`/`childId` car ils referent soit a `machines.id` soit a `resources.id` selon le `*Type`. La validation d'existence se fait dans la couche service/route.

**Service dependency-graph.ts (Task 3) :**

Le service est un module pur (fonctions) qui recoit l'instance `db` en parametre. Il ne depend pas des connecteurs.

```typescript
// apps/server/src/services/dependency-graph.ts
import { eq, and, or } from 'drizzle-orm';
import { dependencyLinks } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

type NodeType = 'machine' | 'resource';

interface ChainNode {
  nodeType: NodeType;
  nodeId: string;
  name: string;
  status: string;
}

// Retourne la chaine ascendante (parents recursifs)
export async function getUpstreamChain(
  db: BetterSQLite3Database,
  nodeType: NodeType,
  nodeId: string,
): Promise<ChainNode[]> { ... }

// Retourne les dependants descendants (enfants recursifs)
export async function getDownstreamDependents(
  db: BetterSQLite3Database,
  nodeType: NodeType,
  nodeId: string,
): Promise<ChainNode[]> { ... }

// Verifie si un noeud est une dependance partagee (>1 enfant)
export async function isSharedDependency(
  db: BetterSQLite3Database,
  nodeType: NodeType,
  nodeId: string,
): Promise<boolean> { ... }

// Valide un lien : verifie existence des noeuds, doublons et cycles
export async function validateLink(
  db: BetterSQLite3Database,
  parentType: NodeType,
  parentId: string,
  childType: NodeType,
  childId: string,
): Promise<{ valid: boolean; error?: string }> { ... }
```

**Detection de cycles :** Parcours DFS depuis le child propose en suivant les liens descendants. Si on retrouve le parent propose dans la chaine, c'est un cycle.

```typescript
// Algorithme de detection de cycle
async function wouldCreateCycle(db, parentType, parentId, childType, childId): Promise<boolean> {
  // On part du parent propose et on remonte ses ancetres
  // Si on retrouve le child dans les ancetres, c'est un cycle
  const visited = new Set<string>();
  const queue: Array<{ type: NodeType; id: string }> = [{ type: parentType, id: parentId }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.type}:${current.id}`;
    if (key === `${childType}:${childId}`) return true; // Cycle detecte
    if (visited.has(key)) continue;
    visited.add(key);

    // Remonter les parents de current
    const parents = await db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.childType, current.type),
        eq(dependencyLinks.childId, current.id),
      ));

    for (const p of parents) {
      queue.push({ type: p.parentType as NodeType, id: p.parentId });
    }
  }
  return false;
}
```

**Routes API (Task 4) :**

| Endpoint | Methode | Usage | Reponse |
|----------|---------|-------|---------|
| `/api/dependencies` | POST | Creer un lien | `{ data: DependencyLink }` |
| `/api/dependencies` | GET | Lister (filtre `?nodeType=X&nodeId=Y`) | `{ data: DependencyLink[] }` |
| `/api/dependencies/:id` | DELETE | Supprimer un lien | `{ data: { success: true } }` |
| `/api/dependencies/:id` | PATCH | Modifier is_shared | `{ data: DependencyLink }` |
| `/api/dependencies/chain` | GET | Chaine complete (`?nodeType=X&nodeId=Y`) | `{ data: { upstream: ChainNode[], downstream: ChainNode[] } }` |

**Body POST /api/dependencies :**
```json
{
  "parentType": "machine",
  "parentId": "uuid-machine",
  "childType": "resource",
  "childId": "uuid-resource",
  "isShared": false
}
```

**Codes d'erreur specifiques :**
- `CYCLE_DETECTED` (409) — Le lien creerait un cycle
- `DUPLICATE_LINK` (409) — Le lien existe deja
- `NODE_NOT_FOUND` (404) — Le parent ou l'enfant n'existe pas
- `SELF_REFERENCE` (400) — Un noeud ne peut pas dependre de lui-meme

### Conformite architecture obligatoire

**Conventions de nommage (ARCH-17) :**
- DB : `snake_case` — `dependency_links`, `parent_type`, `parent_id`, `child_type`, `child_id`, `is_shared`
- API JSON : `camelCase` — `parentType`, `parentId`, `childType`, `childId`, `isShared`
- Fichiers : `kebab-case` — `dependency-graph.ts`, `dependencies.routes.ts`
- Types/Interfaces : `PascalCase` — `DependencyLink`, `DependencyChainNode`

**Organisation backend par domaine (ARCH-18) :**
- Service dans `services/` — `dependency-graph.ts` (logique de graphe pure)
- Routes dans `routes/` — `dependencies.routes.ts` (CRUD + endpoints)
- Schema dans `db/schema.ts` — ajout de la table `dependencyLinks`

**Format API normalise (ARCH-11) :**
- Succes : `{ data: { ... } }`
- Erreur : `{ error: { code, message, details? } }`

**Validation JSON Schema Fastify (ARCH-04) :**
- OBLIGATOIRE sur toutes les routes : `schema.body` + `schema.response` pour TOUS les status codes retournes (200, 400, 401, 404, 409)

**Enregistrement du plugin routes (ARCH-18) :**
- Ajouter `import dependenciesRoutes from './routes/dependencies.routes.js'` dans `app.ts`
- Enregistrer avec `app.register(dependenciesRoutes)`

**Logging (ARCH-09) :**
- Double destination : pino stdout + insert `operation_logs`
- Logger : creation lien, suppression lien, modification is_shared, tentative cycle
- Source : `'dependencies'`

**Tests co-localises (ARCH-15) :**
- `dependency-graph.ts` → `dependency-graph.test.ts`
- `dependencies.routes.ts` → `dependencies.routes.test.ts`

### Librairies et frameworks requis

**Aucune nouvelle dependance** — tout est deja disponible dans le projet :

| Package | Deja dans | Usage dans cette story |
|---------|-----------|----------------------|
| `drizzle-orm` | apps/server | Schema table + requetes |
| `better-sqlite3` | apps/server | Driver SQLite |
| `@mantine/core` | apps/web | Modal, Select, Checkbox, Badge |
| `@mantine/notifications` | apps/web | Toast succes/erreur |
| `@tanstack/react-query` | apps/web | Hooks mutations/queries |

### Structure de fichiers

**Fichiers a CREER :**

```
apps/server/src/
├── services/
│   ├── dependency-graph.ts              ← Service logique de graphe
│   └── dependency-graph.test.ts         ← Tests service
└── routes/
    ├── dependencies.routes.ts           ← Routes CRUD dependencies
    └── dependencies.routes.test.ts      ← Tests routes

apps/web/src/
└── api/
    └── dependencies.api.ts              ← Hooks TanStack Query
```

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/db/schema.ts` | Ajouter table `dependencyLinks` |
| `apps/server/src/app.ts` | Enregistrer le plugin `dependenciesRoutes` |
| `packages/shared/src/index.ts` | Ajouter types `DependencyLink`, `DependencyNodeType`, `DependencyChainNode` |
| `apps/web/src/features/machines/machine-detail-page.tsx` | Ajouter section Dependances |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/connectors/*` — aucun changement
- `apps/server/src/routes/resources.routes.ts` — aucun changement
- `apps/server/src/routes/machines.routes.ts` — aucun changement
- `apps/server/src/middleware/auth.middleware.ts` — deja fonctionnel

### Exigences de tests

**Framework :** Vitest (deja configure)
**Commande :** `npm run test -w @wakehub/server`

**Tests backend obligatoires :**

**1. `apps/server/src/services/dependency-graph.test.ts` :**
- `getUpstreamChain()` retourne la chaine ascendante correcte (A → B → C)
- `getUpstreamChain()` retourne un tableau vide pour un noeud sans parent
- `getDownstreamDependents()` retourne les dependants descendants
- `getDownstreamDependents()` retourne un tableau vide pour un noeud sans enfant
- `isSharedDependency()` retourne true quand un noeud a >1 enfant
- `isSharedDependency()` retourne false quand un noeud a 0 ou 1 enfant
- `validateLink()` retourne `{ valid: true }` pour un lien valide
- `validateLink()` detecte les cycles simples (A → B → A)
- `validateLink()` detecte les cycles indirects (A → B → C → A)
- `validateLink()` detecte les doublons
- `validateLink()` detecte les auto-references (A → A)
- `validateLink()` detecte les noeuds inexistants

**2. `apps/server/src/routes/dependencies.routes.test.ts` :**
- `POST /api/dependencies` cree un lien valide → 200
- `POST /api/dependencies` refuse un cycle → 409
- `POST /api/dependencies` refuse un doublon → 409
- `POST /api/dependencies` refuse un noeud inexistant → 404
- `POST /api/dependencies` refuse une auto-reference → 400
- `GET /api/dependencies?nodeType=X&nodeId=Y` retourne les liens du noeud
- `GET /api/dependencies/chain?nodeType=X&nodeId=Y` retourne la chaine complete
- `DELETE /api/dependencies/:id` supprime un lien → 200
- `DELETE /api/dependencies/:id` retourne 404 si inexistant
- `PATCH /api/dependencies/:id` modifie is_shared → 200
- Toutes les operations sont loguees dans `operation_logs`

**Pattern de test pour le service (utiliser DB de test) :**
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema.js';

// Creer machines et resources de test en DB
// Puis tester les fonctions du service avec de vrais liens
```

### Intelligence des stories precedentes (Epic 2)

**Patterns etablis a reutiliser :**
1. **Pattern routes Fastify** : plugin async, schemas body + response pour tous status codes, error handler pour validation
2. **Pattern tests routes** : `app.inject()`, DB de test SQLite, cleanup `beforeEach`, mock fetch si necessaire
3. **Pattern shared types** : exporter depuis `packages/shared/src/index.ts`, importer avec `@wakehub/shared`
4. **Pattern logging** : `operationLogs.insert()` + `fastify.log.info()` dans chaque handler
5. **Pattern frontend hooks** : `useMutation` pour POST/DELETE/PATCH, `useQuery` pour GET, invalidation des queries liees

**Differences avec Epic 2 :**
- Premiere fois qu'on cree un **service** (logique metier dans `services/`) — pas juste des routes CRUD
- Le service `dependency-graph` est **pur** (pas de connecteur externe, pas de fetch) — plus simple a tester
- Les noeuds sont polymorphes (`machine` ou `resource`) — necessite une resolution de nom/statut dynamique

### Anti-patterns a eviter

- NE PAS stocker le graphe complet en memoire — requeter la DB a chaque appel (le graphe sera petit, SQLite est rapide)
- NE PAS utiliser de librairie de graphe npm (graphology, etc.) — l'algorithme BFS/DFS est trivial pour ce cas d'usage
- NE PAS creer de foreign keys sur parentId/childId — ils sont polymorphes (machine ou resource)
- NE PAS modifier les tables `machines` ou `resources` — le lien est dans `dependency_links`
- NE PAS ajouter de route `/api/resources/:id` complete dans cette story — se concentrer sur les dependances
- NE PAS pre-optimiser avec du cache — les requetes SQLite sont suffisamment rapides

### Project Structure Notes

- Le dossier `services/` n'existe pas encore dans `apps/server/src/` — il sera cree pour cette story
- La table `dependency_links` n'a pas de `updatedAt` — un lien est cree ou supprime, pas modifie (sauf `is_shared`)
- Le champ `is_shared` est un marqueur utilisateur, pas calcule automatiquement — c'est l'admin qui decide si une dependance est partagee
- La suppression d'une machine/resource via CASCADE dans les tables `machines`/`resources` ne supprime PAS automatiquement les `dependency_links` car il n'y a pas de FK — il faudra gerer le nettoyage dans le DELETE handler ou accepter les liens orphelins (a discuter)

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.1] — User story, acceptance criteria, FRs couverts (FR13, FR14, FR15)
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — dependency-graph.ts, dependencies.routes.ts
- **Architecture structure** : [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — services/ et routes/
- **PRD** : [Source: _bmad-output/planning-artifacts/prd.md#FR13-FR17] — Exigences fonctionnelles dependances
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dependency Configuration] — Section dependances, formulaire ajout, graphe
- **Stories precedentes** : [Source: _bmad-output/implementation-artifacts/2-3-*.md] — Patterns routes, tests, shared types

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Aucun probleme rencontre.

### Completion Notes List

- Task 1: Table `dependency_links` ajoutee au schema Drizzle avec index unique sur (parent_type, parent_id, child_type, child_id). Migration 0004 generee. 9 tests schema passent.
- Task 2: Types `DependencyLink`, `DependencyNodeType`, `DependencyChainNode` ajoutes dans `@wakehub/shared`.
- Task 3: Service `dependency-graph.ts` cree avec 4 fonctions publiques (getUpstreamChain, getDownstreamDependents, isSharedDependency, validateLink). Detection de cycles par BFS. 13 tests passent.
- Task 4: Routes CRUD `dependencies.routes.ts` avec POST/GET/DELETE/PATCH + chain endpoint. Schemas JSON Fastify pour tous codes (200, 400, 401, 404, 409). Logging dans operation_logs. Plugin enregistre dans app.ts. 15 tests passent.
- Task 5: Hooks TanStack Query pour le frontend dans `dependencies.api.ts` (useNodeDependencies, useCreateDependency, useDeleteDependency, useUpdateDependency, useDependencyChain).
- Task 6: Section "Dependances" ajoutee dans machine-detail-page.tsx avec liste parents/enfants, modal d'ajout (direction + type + cible + partage), modal de suppression, gestion d'erreurs par toast.
- Task 7: Page resource-detail-page.tsx creee avec section dependances identique. Route `/resources/:id` ajoutee au router.

### File List

**Crees:**
- `apps/server/src/services/dependency-graph.ts`
- `apps/server/src/services/dependency-graph.test.ts`
- `apps/server/src/routes/dependencies.routes.ts`
- `apps/server/src/routes/dependencies.routes.test.ts`
- `apps/server/drizzle/0004_confused_jazinda.sql`
- `apps/web/src/api/dependencies.api.ts`
- `apps/web/src/features/machines/resource-detail-page.tsx`

**Modifies:**
- `apps/server/src/db/schema.ts` — ajout table dependencyLinks
- `apps/server/src/db/schema.test.ts` — ajout tests dependency_links
- `apps/server/src/app.ts` — enregistrement plugin dependenciesRoutes
- `packages/shared/src/index.ts` — ajout types DependencyLink, DependencyNodeType, DependencyChainNode
- `apps/web/src/features/machines/machine-detail-page.tsx` — section dependances
- `apps/web/src/router.tsx` — route /resources/:id

## Change Log

- 2026-02-11: Implementation complete de la story 3-1. 7 taches implementees, 178/178 tests backend passent, frontend build OK.
