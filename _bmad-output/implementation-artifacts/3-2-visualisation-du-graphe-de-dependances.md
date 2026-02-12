# Story 3.2 : Visualisation du graphe de dependances

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want visualiser le graphe complet de mes dependances,
So that je comprends les relations entre toutes mes ressources d'un coup d'oeil.

## Acceptance Criteria (BDD)

1. **Given** des dependances sont definies entre mes machines et resources
   **When** j'ouvre la page "Dependances" (accessible depuis la navigation)
   **Then** je vois un graphe interactif affichant tous les noeuds (machines et resources) et leurs liens directionnels (fleches parent → enfant)
   **And** chaque noeud affiche : icone de type, nom, et badge de statut colore

2. **Given** certaines dependances sont marquees comme partagees
   **When** le graphe est affiche
   **Then** les noeuds partages sont visuellement distincts (bordure speciale ou indicateur)
   **And** les liens multiples depuis un noeud partage sont clairement visibles

3. **Given** je suis sur le graphe de dependances en desktop
   **When** j'interagis avec le graphe
   **Then** je peux zoomer (molette) et deplacer (drag) le graphe
   **And** un clic sur un noeud me redirige vers sa page de detail (machine ou resource)
   **And** des controles de zoom (+/-/reset) sont visibles

4. **Given** aucune dependance n'est definie
   **When** j'ouvre la page Dependances
   **Then** un message d'etat vide s'affiche avec une invitation a creer des dependances

5. **Given** le graphe est affiche avec des noeuds
   **When** les noeuds ont differents statuts
   **Then** les couleurs de statut Mantine sont appliquees (vert=online/running, gris=offline/unknown, rouge=stopped/error, orange=error)

6. **Given** le graphe contient des noeuds
   **When** la page se charge
   **Then** les noeuds sont disposes automatiquement en layout hierarchique (parents en haut, enfants en bas)
   **And** les noeuds ne se chevauchent pas

## Tasks / Subtasks

- [x] Task 1 — Installation de la librairie de graphe (AC: #1, #3)
  - [x] 1.1 Installer `@xyflow/react` (React Flow v12) dans `apps/web`
  - [x] 1.2 Installer `@dagrejs/dagre` pour le layout hierarchique automatique
  - [x] 1.3 Verifier la compatibilite avec React 19 et le build

- [x] Task 2 — Endpoint API graphe complet (AC: #1)
  - [x] 2.1 Ajouter `GET /api/dependencies/graph` dans `dependencies.routes.ts` retournant `{ data: { nodes: [], edges: [] } }`
  - [x] 2.2 Le endpoint collecte toutes les machines, toutes les resources, et tous les dependency_links
  - [x] 2.3 Chaque noeud inclut : id, name, nodeType (machine/resource), machineType (physical/proxmox/docker), resourceType (vm/container), status, isShared (calcule)
  - [x] 2.4 Chaque edge inclut : id, source (parentType:parentId), target (childType:childId), isShared
  - [x] 2.5 Ajouter les schemas JSON Fastify pour tous les status codes (200, 401)
  - [x] 2.6 Ajouter les tests dans `dependencies.routes.test.ts`

- [x] Task 3 — Hook frontend graphe (AC: #1)
  - [x] 3.1 Ajouter `useDependencyGraph()` dans `dependencies.api.ts` — GET /api/dependencies/graph
  - [x] 3.2 Definir les types `GraphNode` et `GraphEdge` dans `@wakehub/shared`

- [x] Task 4 — Composant DependencyGraph (AC: #1, #2, #3, #5, #6)
  - [x] 4.1 Creer `apps/web/src/features/dependencies/dependency-graph.tsx`
  - [x] 4.2 Custom node React Flow avec icone type, nom, badge statut (couleurs Mantine)
  - [x] 4.3 Indicateur visuel pour les noeuds partages (bordure epaisse ou badge)
  - [x] 4.4 Fleches directionnelles pour les edges (parent → enfant)
  - [x] 4.5 Layout hierarchique automatique via dagre (parents en haut, enfants en bas)
  - [x] 4.6 Controles de zoom (+, -, fit view)
  - [x] 4.7 Clic sur un noeud → navigation vers `/machines/:id` ou `/resources/:id`

- [x] Task 5 — Page Dependances (AC: #1, #4)
  - [x] 5.1 Creer `apps/web/src/features/dependencies/dependencies-page.tsx`
  - [x] 5.2 Integrer le composant DependencyGraph
  - [x] 5.3 Etat vide : message + bouton vers la page machines
  - [x] 5.4 Ajouter la route `/dependencies` dans `router.tsx`
  - [x] 5.5 Ajouter le lien "Dependances" dans la navigation (AppShell sidebar)

- [x] Task 6 — Build et verification finale
  - [x] 6.1 Verifier que le build frontend passe
  - [x] 6.2 Verifier que tous les tests backend passent (regression)

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **deuxieme de l'Epic 3** et ajoute la visualisation graphique des dependances definies en Story 3.1. C'est une story principalement **frontend** avec un endpoint API supplementaire pour fournir les donnees du graphe dans un format adapte.

**La librairie choisie est `@xyflow/react` (React Flow v12)** pour les raisons suivantes :
- Standard React pour les graphes de noeuds interactifs
- Zoom/pan natif, noeuds personnalisables avec des composants React
- Bonne performance pour les homelabs typiques (20-100+ noeuds)
- Theming flexible (integration Mantine facile)

**Pour le layout automatique : `@dagrejs/dagre`** (layout hierarchique DAG) :
- Dispose les noeuds parent en haut, enfants en bas
- Evite les chevauchements automatiquement
- Leger et simple a integrer avec React Flow

**Ordre d'implementation recommande :** Tasks 1 → 2 → 3 → 4 → 5 → 6

### Exigences techniques detaillees

**Endpoint GET /api/dependencies/graph (Task 2) :**

```typescript
// Response format
{
  data: {
    nodes: Array<{
      id: string;           // "machine:<uuid>" ou "resource:<uuid>"
      name: string;
      nodeType: 'machine' | 'resource';
      subType: string;      // 'physical' | 'proxmox' | 'docker' | 'vm' | 'container'
      status: string;       // 'online' | 'offline' | 'running' | 'stopped' | etc.
      isShared: boolean;    // true si >1 enfant dans dependency_links
    }>;
    edges: Array<{
      id: string;           // ID du dependency_link
      source: string;       // "machine:<parentId>" ou "resource:<parentId>"
      target: string;       // "machine:<childId>" ou "resource:<childId>"
      isShared: boolean;
    }>;
  }
}
```

**Important :** Les `id` des noeuds sont prefixes avec le type (`machine:` ou `resource:`) pour eviter les collisions UUID entre tables. Les `source`/`target` des edges utilisent le meme format.

**Composant custom node React Flow (Task 4) :**

```tsx
// Structure du noeud personnalise
function DependencyNode({ data }: NodeProps<DependencyNodeData>) {
  return (
    <Paper withBorder p="xs" radius="sm" style={...}>
      <Group gap="xs">
        <TypeIcon size={16} />   {/* Icone selon nodeType + subType */}
        <Text size="sm" fw={500}>{data.name}</Text>
        <Badge size="xs" color={STATUS_COLORS[data.status]}>
          {data.status}
        </Badge>
      </Group>
    </Paper>
  );
}
```

**Layout dagre (Task 4.5) :**

```typescript
import dagre from '@dagrejs/dagre';

function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 200, height: 50 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 100, y: pos.y - 25 } };
  });

  return { nodes: layoutedNodes, edges };
}
```

**Couleurs de statut (coherence avec le projet) :**

| Statut | Couleur Mantine | Usage |
|--------|----------------|-------|
| online / running | green | Machine en ligne / VM en cours |
| offline / stopped | red | Machine hors ligne / VM arretee |
| unknown | gray | Statut inconnu |
| error | orange | Erreur |
| paused | yellow | VM en pause |

**Navigation AppShell (Task 5.5) :**

Il faut ajouter un lien dans la sidebar. Verifier le fichier `app-shell.tsx` pour le pattern de navigation existant.

### Conformite architecture obligatoire

**Conventions de nommage (ARCH-17) :**
- Fichiers : `kebab-case` — `dependency-graph.tsx`, `dependencies-page.tsx`
- Composants : `PascalCase` — `DependencyGraph`, `DependenciesPage`
- Types : `PascalCase` — `GraphNode`, `GraphEdge`

**Organisation frontend (ARCH-18) :**
- Nouveau feature folder : `apps/web/src/features/dependencies/`
- Hooks API dans : `apps/web/src/api/dependencies.api.ts` (existant, a enrichir)
- Types partages dans : `packages/shared/src/index.ts`

**Format API normalise (ARCH-11) :**
- Succes : `{ data: { nodes: [...], edges: [...] } }`
- Erreur : `{ error: { code, message } }`

**Validation JSON Schema Fastify (ARCH-04) :**
- Schema response pour le endpoint graph : status 200, 401

**Tests co-localises (ARCH-15) :**
- Tests backend dans `dependencies.routes.test.ts` (ajout de tests pour le nouveau endpoint)

### Librairies et frameworks requis

**Nouvelles dependances a installer :**

| Package | Workspace | Usage |
|---------|-----------|-------|
| `@xyflow/react` | apps/web | Composant graphe interactif (React Flow v12) |
| `@dagrejs/dagre` | apps/web | Layout hierarchique automatique |

**Dependances existantes reutilisees :**

| Package | Usage dans cette story |
|---------|----------------------|
| `@mantine/core` | Paper, Badge, Text, Group pour les noeuds |
| `@tabler/icons-react` | Icones de type (machine, serveur, docker) |
| `@tanstack/react-query` | Hook useDependencyGraph |
| `react-router` | Navigation clic noeud |

### Structure de fichiers

**Fichiers a CREER :**

```
apps/web/src/features/dependencies/
├── dependency-graph.tsx         ← Composant graphe React Flow
└── dependencies-page.tsx        ← Page /dependencies
```

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/routes/dependencies.routes.ts` | Ajouter GET /api/dependencies/graph |
| `apps/server/src/routes/dependencies.routes.test.ts` | Tests du nouveau endpoint |
| `apps/web/src/api/dependencies.api.ts` | Ajouter hook useDependencyGraph |
| `packages/shared/src/index.ts` | Ajouter types GraphNode, GraphEdge |
| `apps/web/src/router.tsx` | Ajouter route /dependencies |
| `apps/web/src/components/layout/app-shell.tsx` | Ajouter lien navigation Dependances |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/services/dependency-graph.ts` — deja complet
- `apps/server/src/db/schema.ts` — aucun changement
- `apps/web/src/features/machines/machine-detail-page.tsx` — la section liste reste, le graphe est sur sa propre page

### Exigences de tests

**Framework :** Vitest (backend)
**Commande :** `npm run test -w @wakehub/server`

**Tests backend :**

**`dependencies.routes.test.ts` (ajouts) :**
- `GET /api/dependencies/graph` retourne les noeuds et edges → 200
- `GET /api/dependencies/graph` retourne un graphe vide quand aucune dependance → 200
- `GET /api/dependencies/graph` marque correctement isShared sur les noeuds
- Les noeuds incluent les machines ET les resources

**Tests frontend :**
- Verification que le build compile (tsc + vite build)
- Pas de tests unitaires React Flow requis (complexite de setup disproportionnee)

### Intelligence des stories precedentes (Story 3.1)

**Patterns etablis a reutiliser :**
1. **Pattern routes Fastify** : plugin async, schemas response, error handler
2. **Pattern frontend hooks** : `useQuery` pour GET, invalidation des queries liees
3. **Pattern shared types** : exporter depuis `packages/shared/src/index.ts`
4. **Constantes STATUS_COLORS** : reutiliser depuis `use-machines-table.ts`
5. **MACHINE_TYPE_ICON** : reutiliser pour les icones de noeuds

**Bug TS corrige en 3.1 :**
- Le type `BetterSQLite3Database` doit etre `BetterSQLite3Database<any>` pour etre compatible avec `fastify.db` (qui a le schema type)

### Anti-patterns a eviter

- NE PAS utiliser D3.js — trop complexe pour ce cas d'usage, React Flow est suffisant
- NE PAS creer de layout custom — dagre fait le travail correctement
- NE PAS stocker les positions de noeuds en DB — elles sont calculees a chaque rendu
- NE PAS ajouter d'edition de liens dans le graphe dans cette story (c'est la story 3.3)
- NE PAS dupliquer les constantes de couleurs — reutiliser STATUS_COLORS existant

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.2]
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- **PRD** : [Source: _bmad-output/planning-artifacts/prd.md#FR16] — Visualisation graphe
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dependency Configuration]
- **Story precedente** : [Source: _bmad-output/implementation-artifacts/3-1-*.md] — Service, routes, hooks existants

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fix TS build: `DependencyNodeData` needed index signature `[key: string]: unknown` for React Flow `Node` compatibility
- Fix TS build: `n.id.split(':')[1]` returns `string | undefined` — fallback with `?? n.id`

### Completion Notes List

- 181 backend tests passing (12 test files)
- Frontend build OK (tsc + vite build)
- React Flow v12 + dagre layout integrated
- Custom node with type icon, name, status badge, shared indicator
- Empty state with redirect button to machines page
- Navigation link "Dépendances" added

### File List

**Created:**
- `apps/web/src/features/dependencies/dependency-graph.tsx` — React Flow graph component
- `apps/web/src/features/dependencies/dependencies-page.tsx` — Page /dependencies

**Modified:**
- `apps/server/src/routes/dependencies.routes.ts` — Added GET /api/dependencies/graph endpoint
- `apps/server/src/routes/dependencies.routes.test.ts` — Added 3 graph tests
- `apps/web/src/api/dependencies.api.ts` — Added useDependencyGraph hook
- `packages/shared/src/index.ts` — Added GraphNode, GraphEdge types
- `apps/web/src/router.tsx` — Added /dependencies route
- `apps/web/src/components/layout/navigation.tsx` — Added Dépendances nav link
