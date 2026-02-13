# Story 3.1: Définition des dépendances et moteur de graphe

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur homelab,
I want définir les liens de dépendance fonctionnelle entre les noeuds de mon infrastructure et disposer d'un moteur de graphe (DAG) qui valide ces liens,
so that le système puisse calculer les chaînes de dépendances complètes, détecter les cycles, et protéger les dépendances partagées lors des opérations de cascade (démarrage/arrêt).

## Acceptance Criteria

### AC1 : Table `dependency_links` et migration Drizzle
- Une nouvelle table `dependency_links` est créée via migration Drizzle avec les colonnes : `id` (TEXT PK), `from_node_id` (TEXT FK → nodes, ON DELETE CASCADE), `to_node_id` (TEXT FK → nodes, ON DELETE CASCADE), `created_at` (INTEGER)
- Un index unique existe sur `(from_node_id, to_node_id)` pour empêcher les doublons
- Des index séparés existent sur `from_node_id` et `to_node_id` pour les requêtes performantes
- Sémantique : `from_node_id` "dépend de" `to_node_id` (ex: Jellyfin → NAS signifie Jellyfin dépend de NAS)
- Les FK utilisent `foreignKey()` dans les contraintes de table (pas `.references()` inline) pour éviter les problèmes TS7022

### AC2 : Service `dependency-graph.ts` — moteur de graphe DAG
- Un service pur (sans dépendance aux connecteurs) expose les fonctions suivantes :
  - `getUpstreamChain(nodeId, db)` — retourne récursivement toutes les dépendances en amont (Layer 2 fonctionnelles uniquement)
  - `getDownstreamDependents(nodeId, db)` — retourne tous les noeuds qui dépendent du noeud donné
  - `isSharedDependency(nodeId, db)` — retourne `true` si plus d'un noeud dépend de ce noeud
  - `validateLink(fromId, toId, db)` — détecte les cycles via DFS/BFS depuis `toId`, refuse les self-links et les doublons
- La détection de cycles fonctionne correctement (DFS depuis `toId` vérifie si `fromId` est atteignable)
- Les dépendances cross-arbre sont supportées (un conteneur sur Machine A peut dépendre d'une VM sur Machine B)

### AC3 : Routes API CRUD `/api/dependencies`
- `POST /api/dependencies` — crée un lien de dépendance. Body : `{ fromNodeId, toNodeId }`. Valide absence de cycle, doublon et self-link avant insertion. Retourne `{ data: { dependency } }`
- `GET /api/dependencies?nodeId=X` — retourne les dépendances amont et aval du noeud. Retourne `{ data: { upstream: [...], downstream: [...] } }` avec les infos du noeud lié (nom, type, status)
- `DELETE /api/dependencies/:id` — supprime un lien de dépendance. Retourne `{ data: { success: true } }`
- Toutes les routes sont protégées par le middleware d'authentification
- Les réponses déclarent des schemas pour tous les codes HTTP (200, 400, 404, 500)

### AC4 : Section dépendances dans la page détail noeud
- La page détail affiche une section "Dépendances fonctionnelles" avec deux sous-sections :
  - "Ce noeud dépend de :" — liste des dépendances amont avec icône de type, nom du noeud, bouton suppression
  - "Dépendants de ce noeud :" — liste des dépendances aval avec icône de type, nom du noeud, bouton suppression
- Un bouton "Ajouter une dépendance" ouvre un formulaire avec un Select pour choisir le noeud cible et la direction du lien

### AC5 : Validation et feedback utilisateur
- Si le lien est valide (pas de cycle, pas de doublon, pas de self-link), sauvegarde + toast succès
- Si cycle détecté, message d'erreur explicite : "Ce lien créerait un cycle de dépendances"
- Si doublon, message : "Ce lien de dépendance existe déjà"
- Si self-link, message : "Un noeud ne peut pas dépendre de lui-même"

### AC6 : Suppression d'un lien de dépendance
- Chaque lien affiché a une icône poubelle
- Un clic ouvre une modale de confirmation rapide
- Après confirmation, le lien est supprimé et un toast succès s'affiche

### AC7 : Types partagés et intégration
- Les types `DependencyLink`, `CreateDependencyRequest`, `DependencyChain` sont définis dans `packages/shared`
- Les types sont réexportés depuis `packages/shared/src/index.ts`
- Les hooks TanStack Query (`useDependencies`, `useCreateDependency`, `useDeleteDependency`) utilisent `apiFetch` avec `credentials: 'include'`

## Tasks / Subtasks

- [x] Task 1 : Types partagés (AC: #7)
  - [x] 1.1 Créer `packages/shared/src/models/dependency.ts` avec `DependencyLink`, `CreateDependencyRequest`, `DependencyChain`
  - [x] 1.2 Créer `packages/shared/src/api/dependencies.ts` avec les types de requête/réponse API
  - [x] 1.3 Réexporter depuis `packages/shared/src/index.ts`

- [x] Task 2 : Schema Drizzle et migration (AC: #1)
  - [x] 2.1 Ajouter la table `dependencyLinks` dans `apps/server/src/db/schema.ts` avec `foreignKey()` pour les FK
  - [x] 2.2 Ajouter index unique sur `(from_node_id, to_node_id)` et index simples sur chaque FK
  - [x] 2.3 Générer la migration Drizzle (`npx drizzle-kit generate`)
  - [x] 2.4 Vérifier que le push/migrate fonctionne sans erreur

- [x] Task 3 : Service dependency-graph.ts (AC: #2)
  - [x] 3.1 Créer le répertoire `apps/server/src/services/` et le fichier `dependency-graph.ts`
  - [x] 3.2 Implémenter `validateLink(fromId, toId, db)` — vérif self-link, doublon, cycle via DFS
  - [x] 3.3 Implémenter `getUpstreamChain(nodeId, db)` — parcours récursif des `from_node_id` → `to_node_id`
  - [x] 3.4 Implémenter `getDownstreamDependents(nodeId, db)` — tous les noeuds où `to_node_id = nodeId`
  - [x] 3.5 Implémenter `isSharedDependency(nodeId, db)` — count downstream > 1
  - [x] 3.6 Écrire les tests unitaires `dependency-graph.test.ts` (cycles, chaînes profondes, dépendances partagées, cross-arbre, self-link)

- [x] Task 4 : Routes API dependencies (AC: #3)
  - [x] 4.1 Créer `apps/server/src/routes/dependencies.routes.ts` comme `FastifyPluginAsync`
  - [x] 4.2 Implémenter `POST /api/dependencies` avec validation via `validateLink`, schemas de réponse pour 200/400/404/500
  - [x] 4.3 Implémenter `GET /api/dependencies?nodeId=X` retournant upstream/downstream avec infos noeud (nom, type, status)
  - [x] 4.4 Implémenter `DELETE /api/dependencies/:id` avec vérification d'existence
  - [x] 4.5 Enregistrer le plugin dans `apps/server/src/app.ts`
  - [x] 4.6 Écrire les tests `dependencies.routes.test.ts` (CRUD complet, erreurs, auth)

- [x] Task 5 : Hooks TanStack Query frontend (AC: #7)
  - [x] 5.1 Créer `apps/web/src/api/dependencies.api.ts`
  - [x] 5.2 Implémenter `useDependencies(nodeId)` — query GET avec `queryKey: ['dependencies', nodeId]`
  - [x] 5.3 Implémenter `useCreateDependency()` — mutation POST avec invalidation du cache
  - [x] 5.4 Implémenter `useDeleteDependency()` — mutation DELETE avec invalidation du cache

- [x] Task 6 : Section dépendances dans la page détail noeud (AC: #4, #5, #6)
  - [x] 6.1 Ajouter la section "Dépendances fonctionnelles" dans `node-detail-page.tsx`
  - [x] 6.2 Afficher les listes upstream/downstream avec `NodeTypeIcon`, nom du noeud, bouton suppression (icône poubelle)
  - [x] 6.3 Implémenter le formulaire "Ajouter une dépendance" avec Select pour le noeud cible et la direction
  - [x] 6.4 Implémenter la modale de confirmation de suppression
  - [x] 6.5 Afficher les toasts de succès/erreur avec messages explicites (cycle, doublon, self-link)
  - [x] 6.6 Étendre les tests dans `node-detail-page.test.tsx` (affichage dépendances, ajout, suppression, erreurs)

- [x] Task 7 : Validation et intégration (AC: #1-7)
  - [x] 7.1 Lancer `npm test -w apps/server` — tous les tests passent (205 tests, 0 échec)
  - [x] 7.2 Lancer `npm test -w apps/web` — tous les tests passent (94 tests, 0 échec)
  - [x] 7.3 Lancer `docker compose up --build -d` — build réussi, serveur démarre sans erreur

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage |
|---|---|---|
| TypeScript | strict mode | Partout |
| Fastify | ~5.x | Serveur API backend |
| Drizzle ORM | ~0.45.x | ORM code-first SQLite |
| better-sqlite3 | ~11.x | Driver SQLite |
| React | ~19.2 | Frontend UI |
| Mantine | ~7.17 | Bibliothèque de composants |
| TanStack Query | ~5.x | Gestion état serveur |
| Vitest | latest | Framework de test |
| @tabler/icons-react | ~3.36 | Icônes |

### Contraintes architecturales critiques

1. **Modèle deux couches** : Le graphe de dépendances (Layer 2) est **indépendant** de l'arbre d'hébergement (Layer 1). Un lien peut connecter n'importe quels deux noeuds, peu importe leur position dans l'arbre. `getUpstreamChain()` retourne **uniquement** les dépendances fonctionnelles Layer 2 — la combinaison des deux couches est la responsabilité du moteur de cascade (Story 4.1).

2. **Service pur** : `dependency-graph.ts` est un service de logique pure sans dépendance aux connecteurs. Il reçoit `db` en paramètre — pas d'accès Fastify global.

3. **Routes → Services → DB** : Les routes ne font PAS d'accès DB direct pour la logique métier. Elles appellent le service `dependency-graph` pour la validation et les calculs. L'accès DB simple (insert/delete) peut rester dans la route.

4. **Schemas de réponse obligatoires** : Chaque route Fastify DOIT déclarer des schemas pour tous les codes HTTP retournés (200, 400, 404, 500). Sans cela, le build Docker échoue silencieusement.

5. **`additionalProperties: true`** sur les schemas d'objets JSON avec propriétés dynamiques pour éviter le filtrage silencieux par Fastify.

6. **`foreignKey()` dans les contraintes de table** : NE PAS utiliser `.references()` inline pour les FK vers la table `nodes`. Utiliser `foreignKey()` dans le bloc de contraintes pour éviter l'erreur TypeScript TS7022 (type circulaire). Pattern établi dans `schema.ts` pour le `parentId` de `nodes`.

### Conventions de nommage

| Couche | Convention | Exemples Story 3.1 |
|---|---|---|
| Table DB | `snake_case` pluriel | `dependency_links` |
| Colonnes DB | `snake_case` | `from_node_id`, `to_node_id`, `created_at` |
| JSON API | `camelCase` | `fromNodeId`, `toNodeId` |
| Fichiers | `kebab-case` | `dependency-graph.ts`, `dependencies.routes.ts` |
| Types | `PascalCase` | `DependencyLink`, `CreateDependencyRequest` |
| Codes erreur | `SCREAMING_SNAKE` | `DEPENDENCY_CYCLE_DETECTED` |

### Codes d'erreur à implémenter

| Code | Quand | Message |
|---|---|---|
| `DEPENDENCY_CYCLE_DETECTED` | `validateLink` trouve un cycle | "Ce lien créerait un cycle de dépendances" |
| `DEPENDENCY_DUPLICATE` | Contrainte unique violée | "Ce lien de dépendance existe déjà" |
| `DEPENDENCY_NOT_FOUND` | DELETE avec id invalide | "Lien de dépendance introuvable" |
| `NODE_NOT_FOUND` | fromNodeId ou toNodeId inexistant | "Noeud introuvable" |
| `DEPENDENCY_SELF_LINK` | fromNodeId === toNodeId | "Un noeud ne peut pas dépendre de lui-même" |

### Architecture Compliance

#### Patterns backend établis à reproduire

**Pattern route Fastify** (cf. `nodes.routes.ts`) :
```typescript
const dependenciesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    }
    throw error;
  });

  // POST /api/dependencies
  fastify.post('/', { schema: { body: createDependencySchema, response: { 200: ..., 400: errorResponseSchema, 500: errorResponseSchema } } },
    async (request, reply) => { ... });
};
export default dependenciesRoutes;
```

**Pattern enregistrement plugin** (cf. `app.ts`) :
```typescript
import dependenciesRoutes from './routes/dependencies.routes.js';
// ...
app.register(dependenciesRoutes, { prefix: '/api/dependencies' });
```

**Pattern logging dual** (cf. routes existantes) :
```typescript
fastify.log.info({ dependencyId: id }, 'Dependency link created');
await fastify.db.insert(operationLogs).values({ ... });
```

**Pattern erreur structurée** :
```typescript
reply.status(400).send({ error: { code: 'DEPENDENCY_CYCLE_DETECTED', message: 'Ce lien créerait un cycle de dépendances' } });
```

#### Patterns frontend établis à reproduire

**Pattern hook TanStack Query** (cf. `nodes.api.ts`) :
```typescript
export function useDependencies(nodeId: string) {
  return useQuery({
    queryKey: ['dependencies', nodeId],
    queryFn: () => apiFetch(`/api/dependencies?nodeId=${nodeId}`).then(r => r.json()),
    enabled: !!nodeId,
  });
}
```

**Pattern mutation avec invalidation** :
```typescript
export function useCreateDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDependencyRequest) =>
      apiFetch('/api/dependencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dependencies'] }); },
  });
}
```

**Pattern notifications Mantine** :
```typescript
notifications.show({ title: 'Dépendance ajoutée', message: 'Le lien a été créé avec succès', color: 'green' });
```

**Pattern modale de confirmation** (cf. `node-detail-page.tsx`) :
```typescript
<Modal opened={deleteOpened} onClose={closeDelete} title="Confirmer la suppression">
  <Text>Voulez-vous vraiment supprimer ce lien de dépendance ?</Text>
  <Group justify="flex-end" mt="md">
    <Button variant="default" onClick={closeDelete}>Annuler</Button>
    <Button color="red" onClick={handleDeleteDependency}>Supprimer</Button>
  </Group>
</Modal>
```

### Project Structure Notes

#### Fichiers à créer

```
packages/shared/src/
  models/dependency.ts              ← NOUVEAU : types DependencyLink
  api/dependencies.ts               ← NOUVEAU : types requête/réponse API
  index.ts                          ← MODIFIER : réexporter les nouveaux types

apps/server/src/
  db/schema.ts                      ← MODIFIER : ajouter table dependencyLinks
  services/                         ← NOUVEAU répertoire
    dependency-graph.ts             ← NOUVEAU : service logique DAG
    dependency-graph.test.ts        ← NOUVEAU : tests service
  routes/
    dependencies.routes.ts          ← NOUVEAU : routes CRUD
    dependencies.routes.test.ts     ← NOUVEAU : tests routes
  app.ts                            ← MODIFIER : enregistrer le plugin

apps/web/src/
  api/dependencies.api.ts           ← NOUVEAU : hooks TanStack Query
  features/nodes/
    node-detail-page.tsx            ← MODIFIER : ajouter section dépendances
    node-detail-page.test.tsx       ← MODIFIER : ajouter tests dépendances
```

#### Alignement avec la structure existante
- Les tests sont **co-localisés** (`foo.test.ts` à côté de `foo.ts`) — pas de répertoire `__tests__/`
- Le répertoire `services/` est prévu par l'architecture mais n'existe pas encore — c'est la première utilisation
- Aucun conflit détecté avec la structure existante

### Librairies et frameworks — exigences spécifiques

#### Drizzle ORM — table `dependencyLinks`

- Utiliser `sqliteTable()` depuis `drizzle-orm/sqlite-core`
- Colonnes : `text('id').primaryKey()`, `text('from_node_id').notNull()`, `text('to_node_id').notNull()`, `integer('created_at', { mode: 'timestamp' }).notNull()`
- FK via `foreignKey()` dans le tableau de contraintes (pas `.references()`) — évite TS7022
- Index unique : `uniqueIndex('idx_dependency_links_unique').on(table.fromNodeId, table.toNodeId)`
- Générer l'ID avec `crypto.randomUUID()` (pattern existant dans `nodes.routes.ts`)
- Migration : `npx drizzle-kit generate` puis vérifier le SQL généré

#### Fastify — schemas JSON

- Chaque route déclare `schema.response` pour **tous** les codes HTTP retournés
- Format erreur uniforme : `{ error: { code: string, message: string, details?: object } }`
- Utiliser `Type.Object()` de `@sinclair/typebox` pour les schemas (pattern existant)
- `additionalProperties: true` sur les schemas d'objets qui incluent des données de noeud enrichies

#### Mantine — composants UI pour la section dépendances

- `Select` pour le dropdown de sélection de noeud cible (avec `searchable` pour filtrer)
- `ActionIcon` avec `IconTrash` pour le bouton suppression sur chaque lien
- `Modal` + `useDisclosure` pour la confirmation de suppression
- `Group`, `Stack`, `Text`, `Badge` pour la mise en page des listes
- `Button` avec `loading` state pendant les mutations
- `Skeleton` pour le chargement initial de la section

#### TanStack Query — invalidation de cache

- Après création/suppression d'une dépendance, invalider `['dependencies']` ET `['dependencies', nodeId]`
- Le `queryKey` doit inclure le `nodeId` pour que les dépendances soient rechargées quand on change de noeud

### Exigences de tests

#### Tests backend — `dependency-graph.test.ts`

Cas à couvrir pour le service DAG :
- Création de lien simple entre deux noeuds → succès
- Détection de self-link (`fromId === toId`) → refusé
- Détection de doublon (même paire) → refusé
- Détection de cycle simple (A→B, B→A) → refusé
- Détection de cycle profond (A→B→C→D→A) → refusé
- `getUpstreamChain` avec chaîne profonde → retourne tous les noeuds en amont
- `getUpstreamChain` sur noeud sans dépendance → retourne liste vide
- `getDownstreamDependents` → retourne les noeuds dépendants
- `isSharedDependency` avec 0, 1, 2+ dépendants → retourne false/false/true
- Dépendances cross-arbre (noeuds avec `parentId` différents) → accepté

#### Tests backend — `dependencies.routes.test.ts`

Cas à couvrir pour les routes :
- `POST /api/dependencies` — création réussie, cycle refusé (400), doublon refusé (400), self-link refusé (400), noeud inexistant (404), non authentifié (401)
- `GET /api/dependencies?nodeId=X` — retourne upstream et downstream avec infos noeud, noeud inexistant, pas de dépendances (listes vides)
- `DELETE /api/dependencies/:id` — suppression réussie, id inexistant (404), non authentifié (401)

#### Tests frontend — `node-detail-page.test.tsx`

Cas à ajouter :
- Affichage de la section "Dépendances fonctionnelles" avec listes upstream/downstream
- Bouton "Ajouter une dépendance" ouvre le formulaire
- Soumission réussie → toast succès + liste rafraîchie
- Erreur cycle → toast erreur avec message explicite
- Clic suppression → modale de confirmation → suppression → toast succès
- Section vide quand aucune dépendance (message "Aucune dépendance")

#### Pattern de test établi — mocks

```typescript
// OBLIGATOIRE : vi.hoisted() pour les mocks utilisés dans vi.mock()
const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('../../api/dependencies.api', () => ({
  useDependencies: () => ({ data: mockDependenciesData, isLoading: false }),
  useCreateDependency: () => ({ mutateAsync: mockApiFetch }),
  useDeleteDependency: () => ({ mutateAsync: mockApiFetch }),
}));
```

#### Compteurs de tests attendus

- Tests serveur actuels : 179 → objectif : ~210+ (ajout ~30 tests service + routes)
- Tests web actuels : 88 → objectif : ~95+ (ajout ~7 tests page détail)
- Commandes : `npm test -w apps/server` et `npm test -w apps/web`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 — Story 3.1] — Critères d'acceptation, FRs couverts
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure du code] — Placement fichiers, patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Modèle de données] — Schema `dependency_links`
- [Source: _bmad-output/planning-artifacts/prd.md#FR15-FR20] — Exigences fonctionnelles dépendances
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-10] — Section dépendances page détail
- [Source: _bmad-output/implementation-artifacts/2-1-ajout-machine-physique-et-base-technique.md#Dev Notes] — Pattern `foreignKey()`, TS7022
- [Source: _bmad-output/implementation-artifacts/2-4-page-noeuds-et-vue-tabulaire.md#Dev Notes] — Mantine label `*`, Select collisions
- [Source: _bmad-output/implementation-artifacts/2-5-page-detail-noeud-modification-et-suppression.md#Dev Notes] — Pattern modale, Fastify response schemas

### Intelligence Git — Epic 2 et travail récent

#### Commits récents
```
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
7cd4d93 Rename project from wakehub2 to WakeHub
```

#### Leçons critiques de l'Epic 2 à appliquer

1. **FK self-referencing Drizzle** : `foreignKey()` dans les contraintes de table, pas `.references()` inline → évite TS7022. **Directement applicable** pour les FK de `dependency_links` vers `nodes`.

2. **`vi.hoisted()` obligatoire** : Toute fonction mock utilisée dans une factory `vi.mock()` doit être déclarée via `vi.hoisted()`. Sinon erreur de hoisting.

3. **Mantine Modal rendu dans un portal** : Utiliser `findByText` (async) au lieu de `getByText` pour le contenu de modale dans les tests.

4. **Fastify response schemas requis pour TOUS les codes HTTP** : Si une route retourne 400/404/500 sans schema déclaré, le build Docker échoue. **Toujours** ajouter `response: { 200: ..., 400: errorResponseSchema, 404: errorResponseSchema, 500: errorResponseSchema }`.

5. **`credentials: 'include'`** obligatoire sur tous les appels fetch frontend — utiliser `apiFetch` qui le gère.

6. **Mantine label avec `*`** : Les champs `required` ont un ` *` ajouté au label. Dans les tests, utiliser `getByLabelText(/Label/i)` avec regex.

7. **Collision de texte dans les tests** : Quand le même texte apparaît dans un dropdown et dans un tableau, scoper avec `within()`.

### Information technique récente

- **Drizzle ORM ~0.45.x** : API stable, pas de breaking changes récents impactant les définitions de table SQLite. La syntaxe `sqliteTable()` avec `foreignKey()` dans le tableau de contraintes est le pattern recommandé.
- **Algorithme de cycle DAG** : L'approche DFS standard est suffisante pour la taille du graphe attendu (homelab = dizaines à centaines de noeuds max). Pas besoin d'optimisation avancée (Tarjan, etc.).
- **Mantine Select v7.17** : Le prop `searchable` est disponible et stable. Utiliser `data` avec format `{ value: string, label: string }`.

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- L'utilisateur type est Sophie, administratrice homelab intermédiaire
- Le parcours de configuration suit : machines physiques → capacités Proxmox/Docker → **dépendances fonctionnelles** (cette story) → dashboard cascade
- Cette story est le **pivot central** du projet : le moteur de graphe DAG sera consommé par le moteur de cascade (Epic 4) pour orchestrer les démarrages/arrêts séquentiels
- Taille attendue du graphe : dizaines de noeuds, pas de besoin de performance extrême

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- DB dev supprimée pour corriger conflit migration (table `dependency_links` existait déjà du `drizzle-kit push` interactif)
- Volume Docker supprimé pour même raison
- Imports inutilisés (`and`, `getUpstreamChain`, `getDownstreamDependents`) supprimés dans `dependencies.routes.ts` pour passer le build TS strict
- Types implicites `any` corrigés dans les callbacks `.find()` du test frontend pour passer `tsc -b`

### Completion Notes List

- Story créée par le moteur de contexte ultime BMad Method
- Analyse exhaustive de tous les artefacts (epics, PRD, architecture, UX, stories Epic 2)
- Intelligence git extraite des 5 derniers commits
- 7 leçons critiques de l'Epic 2 intégrées comme garde-fous
- Aucun conflit de structure détecté
- Implémentation complète Story 3.1 — moteur de graphe DAG, routes CRUD, UI dépendances
- 32 nouveaux tests ajoutés (15 service + 11 routes + 6 frontend)
- Suite de régression complète : 299 tests, 0 échec
- Docker build + démarrage réussis
- Service pur `dependency-graph.ts` sans dépendance aux connecteurs, reçoit `db` en paramètre
- Détection de cycles via DFS, support cross-arbre, dépendances partagées
- Routes Fastify avec schemas de réponse pour tous les codes HTTP (200, 400, 404, 500)
- FK via `foreignKey()` dans les contraintes de table (pas `.references()` inline) — conforme au pattern Epic 2
- Frontend : section dépendances avec listes upstream/downstream, formulaire ajout, modale suppression, toasts

### File List

**Nouveaux fichiers :**
- `packages/shared/src/models/dependency.ts` — types DependencyLink, CreateDependencyRequest, DependencyNodeInfo, DependencyChain
- `packages/shared/src/api/dependencies.ts` — types réponse API (CreateDependencyResponse, DependenciesQueryResponse, DeleteDependencyResponse)
- `apps/server/src/services/dependency-graph.ts` — service pur DAG (validateLink, getUpstreamChain, getDownstreamDependents, isSharedDependency)
- `apps/server/src/services/dependency-graph.test.ts` — 15 tests unitaires service
- `apps/server/src/routes/dependencies.routes.ts` — routes CRUD POST/GET/DELETE
- `apps/server/src/routes/dependencies.routes.test.ts` — 11 tests routes
- `apps/server/drizzle/0003_smart_sasquatch.sql` — migration Drizzle table dependency_links
- `apps/web/src/api/dependencies.api.ts` — hooks TanStack Query (useDependencies, useCreateDependency, useDeleteDependency)

**Fichiers modifiés :**
- `packages/shared/src/index.ts` — réexport des types dependency
- `apps/server/src/db/schema.ts` — ajout table dependencyLinks avec FK, index unique, index simples
- `apps/server/src/app.ts` — enregistrement plugin dependenciesRoutes
- `apps/web/src/features/nodes/node-detail-page.tsx` — section dépendances fonctionnelles (upstream/downstream, ajout, suppression)
- `apps/web/src/features/nodes/node-detail-page.test.tsx` — 6 tests dépendances + refactor mockFetch URL-based

## Change Log

- 2026-02-13 : Story 3.1 implémentée — moteur de graphe DAG, routes API CRUD dépendances, section UI dans la page détail noeud, 32 nouveaux tests
