# Story 3.2: Visualisation du graphe de dépendances

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur homelab,
I want visualiser le graphe complet de mes dépendances fonctionnelles sous forme de diagramme interactif,
so that je comprends les relations entre tous mes noeuds d'un coup d'oeil et peux naviguer directement vers le détail de chaque noeud.

## Acceptance Criteria

### AC1 : Endpoint API — graphe complet des dépendances
- Une nouvelle route `GET /api/dependencies/graph` retourne tous les noeuds configurés et tous les liens de dépendance en une seule requête
- Format de réponse : `{ data: { nodes: [...], links: [...] } }` où chaque noeud inclut `id`, `name`, `type`, `status` et chaque lien inclut `id`, `fromNodeId`, `toNodeId`
- La route est protégée par le middleware d'authentification
- Un schema de réponse JSON est déclaré pour les codes 200 et 500

### AC2 : Page graphe avec React Flow
- Un composant graphe visuel (React Flow `@xyflow/react`) affiche tous les noeuds et leurs liens fonctionnels sur une page dédiée `/graph`
- Les noeuds sont positionnés automatiquement via un layout DAG (dagre, direction top-to-bottom)
- Les liens sont représentés par des flèches directionnelles (dépendant → dépendance)
- La page est accessible via un lien "Graphe" dans la navigation principale

### AC3 : Noeuds custom Mantine
- Chaque noeud du graphe affiche : icône de type (via `NodeTypeIcon`), nom, et badge de statut coloré (via `StatusBadge`)
- Les noeuds partagés (plus d'un dépendant) sont visuellement distincts (bordure spéciale ou halo)
- Le style des noeuds respecte le thème dark Mantine (fond `dark.6`, bordure `dark.4`, texte `gray.1`)

### AC4 : Interactions graphe
- Le graphe est interactif : zoom (molette), pan (clic-glisser sur le canevas)
- Un clic sur un noeud navigue vers sa page de détail (`/nodes/:id`)
- Les contrôles zoom (Controls) et la minimap (MiniMap) sont affichés
- Sur mobile, le zoom pincé et le scroll tactile fonctionnent

### AC5 : État vide
- Quand aucune dépendance fonctionnelle n'est définie, un message invite l'utilisateur à définir des dépendances depuis la page détail d'un noeud
- Le message est centré dans la zone du graphe avec un bouton vers `/nodes`

### AC6 : Intégration thème et responsive
- Les couleurs de statut sémantiques sont utilisées pour les badges des noeuds (vert actif, gris éteint, jaune démarrage, rouge erreur, orange arrêt)
- Le graphe s'adapte à la taille de l'écran (conteneur 100% largeur, hauteur dynamique)
- Sur mobile (<768px), le graphe occupe la pleine hauteur disponible sous le header

## Tasks / Subtasks

- [x] Task 1 : Installer les dépendances (AC: #2)
  - [x] 1.1 Installer `@xyflow/react` et `@dagrejs/dagre` dans `apps/web`
  - [x] 1.2 Installer `@types/dagre` (types TS pour dagre) — non nécessaire, `@dagrejs/dagre` v2 inclut ses propres types
  - [x] 1.3 Vérifier que `npm run build -w apps/web` et `tsc --noEmit` passent

- [x] Task 2 : Endpoint API graphe complet (AC: #1)
  - [x] 2.1 Ajouter la route `GET /graph` dans `dependencies.routes.ts` — retourne tous les noeuds configurés + tous les liens
  - [x] 2.2 Déclarer les schemas de réponse JSON pour 200 et 500
  - [x] 2.3 Écrire les tests dans `dependencies.routes.test.ts` : graphe vide, graphe avec noeuds et liens, non authentifié

- [x] Task 3 : Types partagés (AC: #1)
  - [x] 3.1 Ajouter le type `DependencyGraphResponse` dans `packages/shared/src/api/dependencies.ts`
  - [x] 3.2 Réexporter depuis `packages/shared/src/index.ts`

- [x] Task 4 : Hook TanStack Query (AC: #2)
  - [x] 4.1 Ajouter `useDependencyGraph()` dans `apps/web/src/api/dependencies.api.ts` — query GET `/api/dependencies/graph` avec `queryKey: ['dependencies', 'graph']`

- [x] Task 5 : Composant noeud custom (AC: #3)
  - [x] 5.1 Créer `apps/web/src/features/graph/infra-node.tsx` — composant React Flow custom utilisant `Paper`, `Group`, `Text`, `Badge` de Mantine + `NodeTypeIcon`
  - [x] 5.2 Afficher : Handle target en haut, Handle source en bas, icône type, nom, badge statut
  - [x] 5.3 Appliquer une bordure spéciale pour les noeuds partagés (prop `isShared` dans data)
  - [x] 5.4 Écrire les tests `infra-node.test.tsx`

- [x] Task 6 : Page graphe de dépendances (AC: #2, #4, #5, #6)
  - [x] 6.1 Créer `apps/web/src/features/graph/dependency-graph-page.tsx`
  - [x] 6.2 Utiliser `useDependencyGraph()` pour charger les données
  - [x] 6.3 Transformer les données API en noeuds/edges React Flow
  - [x] 6.4 Appliquer le layout dagre (direction TB, espacement 60/100)
  - [x] 6.5 Marquer les noeuds partagés (dépendants > 1) avec `isShared: true` dans data
  - [x] 6.6 Implémenter `onNodeClick` → `navigate('/nodes/' + nodeId)`
  - [x] 6.7 Afficher `<Controls />`, `<MiniMap />`, `<Background />`
  - [x] 6.8 Implémenter l'état vide (aucune dépendance)
  - [x] 6.9 Ajouter les CSS overrides pour matcher le thème Mantine dark
  - [x] 6.10 Écrire les tests `dependency-graph-page.test.tsx`

- [x] Task 7 : Routage et navigation (AC: #2)
  - [x] 7.1 Ajouter la route `/graph` dans `router.tsx` (protégée, dans AppShell)
  - [x] 7.2 Ajouter le lien "Graphe" dans `navigation.tsx` avec icône `IconTopologyRing3`
  - [x] 7.3 Mettre à jour les tests de navigation si existants — tests existants non impactés

- [x] Task 8 : Validation et intégration (AC: #1-6)
  - [x] 8.1 Lancer `npm test -w apps/server` — 208 tests passent
  - [x] 8.2 Lancer `npm test -w apps/web` — 106 tests passent
  - [x] 8.3 `tsc --noEmit` passe sans erreur

## Dev Notes

### Stack technique et nouvelles dépendances

| Package | Version | Usage |
|---|---|---|
| `@xyflow/react` | `^12.10.0` | Composant graphe interactif (zoom, pan, custom nodes) |
| `@dagrejs/dagre` | `^2.0.4` | Layout automatique DAG (positionnement des noeuds) |

**Important** : Le package s'appelle `@xyflow/react` (PAS `reactflow` qui est figé à v11). Entièrement compatible avec React 19.2 + Mantine 7 + Vite.

### Contraintes architecturales critiques

1. **Endpoint `/api/dependencies/graph` dans le fichier existant** : Ajouter la route dans `apps/server/src/routes/dependencies.routes.ts` (PAS un nouveau fichier de route). C'est un GET supplémentaire dans le même plugin Fastify.

2. **Feature directory `graph/`** : Créer `apps/web/src/features/graph/` pour la page et le composant noeud custom. Pattern : un feature directory par page (comme `nodes/`, `auth/`).

3. **CSS React Flow** : Importer `@xyflow/react/dist/style.css` dans le composant page (PAS dans `main.tsx` ni `App.tsx`). Seule la page graphe en a besoin.

4. **colorMode="dark"** : React Flow v12 supporte nativement le dark mode via ce prop. Les variables CSS `--xy-*` peuvent être overridées pour matcher la palette Mantine.

5. **Tests React Flow** : React Flow nécessite un conteneur avec dimensions (width/height > 0) pour le rendu. Dans les tests Vitest/JSDOM, mocker `ResizeObserver` et fournir un conteneur dimensionné, OU mocker `@xyflow/react` entièrement pour ne tester que la logique (données, état vide, navigation).

6. **Le graphe affiche UNIQUEMENT la Layer 2** (dépendances fonctionnelles). Les relations parent-enfant (Layer 1 / arbre d'hébergement) ne sont PAS représentées. Seuls les liens de la table `dependency_links` sont affichés.

7. **Noeuds isolés** : Les noeuds qui n'ont AUCUNE dépendance (ni upstream ni downstream) ne sont PAS affichés dans le graphe. Seuls les noeuds impliqués dans au moins un lien apparaissent.

### Conventions de nommage

| Couche | Convention | Exemples Story 3.2 |
|---|---|---|
| Fichiers | `kebab-case` | `dependency-graph-page.tsx`, `infra-node.tsx` |
| Composants React | `PascalCase` | `DependencyGraphPage`, `InfraNode` |
| Types | `PascalCase` | `DependencyGraphResponse` |
| Routes API | `kebab-case` | `/api/dependencies/graph` |
| Query keys | array de strings | `['dependencies', 'graph']` |

### Codes d'erreur

| Code | Quand | Message |
|---|---|---|
| `DEPENDENCY_GRAPH_FAILED` | Erreur lors de la récupération du graphe | Message de l'erreur interne |

### Architecture Compliance

#### Pattern endpoint — ajout dans plugin existant

Ajouter dans `dependencies.routes.ts` (déjà registré dans `app.ts` avec prefix `/api/dependencies`) :

```typescript
// GET /api/dependencies/graph — Full dependency graph
fastify.get('/graph', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              nodes: { type: 'array', items: { type: 'object', properties: {
                id: { type: 'string' }, name: { type: 'string' },
                type: { type: 'string' }, status: { type: 'string' },
              }}},
              links: { type: 'array', items: { type: 'object', properties: {
                id: { type: 'string' }, fromNodeId: { type: 'string' },
                toNodeId: { type: 'string' },
              }}},
            },
          },
        },
      },
      500: errorResponseSchema,
    },
  },
}, async (request, reply) => {
  // Fetch all configured nodes + all dependency links
});
```

#### Pattern composant React Flow custom node

```tsx
// infra-node.tsx
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Paper, Group, Text } from '@mantine/core';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import { StatusBadge } from '../../components/shared/status-badge';

type InfraNodeData = {
  label: string;
  nodeType: string;
  status: string;
  isShared: boolean;
};

export function InfraNode({ data }: NodeProps<Node<InfraNodeData>>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Paper p="xs" radius="sm" withBorder style={{
        background: 'var(--mantine-color-dark-6)',
        borderColor: data.isShared ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-dark-4)',
        borderWidth: data.isShared ? 2 : 1,
        minWidth: 160,
      }}>
        <Group gap="xs">
          <NodeTypeIcon type={data.nodeType} size={16} />
          <Text size="sm" fw={500}>{data.label}</Text>
        </Group>
        <StatusBadge status={data.status} size="xs" mt={4} />
      </Paper>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
```

#### Pattern layout dagre

```typescript
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}
```

#### Pattern transformation données API → React Flow

```typescript
// Dans dependency-graph-page.tsx
function transformToReactFlow(graphData: DependencyGraphResponse) {
  const nodeSet = new Set<string>();
  graphData.links.forEach((l) => { nodeSet.add(l.fromNodeId); nodeSet.add(l.toNodeId); });

  // Count downstream dependents for shared detection
  const downstreamCount = new Map<string, number>();
  graphData.links.forEach((l) => {
    downstreamCount.set(l.toNodeId, (downstreamCount.get(l.toNodeId) ?? 0) + 1);
  });

  const nodes: Node[] = graphData.nodes
    .filter((n) => nodeSet.has(n.id))
    .map((n) => ({
      id: n.id,
      type: 'infra',
      position: { x: 0, y: 0 }, // dagre will set position
      data: {
        label: n.name,
        nodeType: n.type,
        status: n.status,
        isShared: (downstreamCount.get(n.id) ?? 0) > 1,
      },
    }));

  const edges: Edge[] = graphData.links.map((l) => ({
    id: l.id,
    source: l.fromNodeId,
    target: l.toNodeId,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return getLayoutedElements(nodes, edges);
}
```

#### Pattern CSS overrides pour dark theme Mantine

```css
/* react-flow-overrides.css */
.react-flow.dark {
  --xy-background-color: var(--mantine-color-dark-7);
  --xy-minimap-background-color: var(--mantine-color-dark-8);
  --xy-controls-button-background-color: var(--mantine-color-dark-5);
  --xy-controls-button-color: var(--mantine-color-gray-1);
  --xy-edge-stroke: var(--mantine-color-dark-3);
}
```

#### Pattern test frontend — mock React Flow

React Flow ne rend pas dans JSDOM (pas de dimensions). Mocker le module :

```typescript
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, onNodeClick }: any) => (
    <div data-testid="react-flow" data-nodes={nodes.length} data-edges={edges.length}>
      {children}
      {nodes.map((n: any) => (
        <div key={n.id} data-testid={`node-${n.id}`} onClick={() => onNodeClick?.({}, n)}>
          {n.data.label}
        </div>
      ))}
    </div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  ConnectionLineType: { SmoothStep: 'smoothstep' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  Handle: () => null,
  useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
}));
```

### Project Structure Notes

#### Fichiers à créer

```
apps/web/src/
  features/graph/
    dependency-graph-page.tsx           ← NOUVEAU : page graphe
    dependency-graph-page.test.tsx      ← NOUVEAU : tests page
    infra-node.tsx                      ← NOUVEAU : composant noeud custom
    infra-node.test.tsx                 ← NOUVEAU : tests composant noeud
    react-flow-overrides.css            ← NOUVEAU : CSS dark theme overrides
```

#### Fichiers à modifier

```
packages/shared/src/
  api/dependencies.ts                   ← MODIFIER : ajouter DependencyGraphResponse
  index.ts                              ← MODIFIER : réexporter le nouveau type

apps/server/src/routes/
  dependencies.routes.ts                ← MODIFIER : ajouter GET /graph
  dependencies.routes.test.ts           ← MODIFIER : ajouter tests endpoint graphe

apps/web/src/
  api/dependencies.api.ts               ← MODIFIER : ajouter useDependencyGraph()
  router.tsx                             ← MODIFIER : ajouter route /graph
  components/layout/navigation.tsx       ← MODIFIER : ajouter lien "Graphe"
```

#### Alignement avec la structure existante
- Les tests sont co-localisés (`foo.test.tsx` à côté de `foo.tsx`)
- Le feature directory `graph/` suit le pattern existant (`nodes/`, `auth/`)
- Aucun conflit de structure détecté

### Librairies et frameworks — exigences spécifiques

#### @xyflow/react v12
- Importer depuis `@xyflow/react` (PAS `reactflow`)
- Import du CSS : `import '@xyflow/react/dist/style.css';`
- Props obligatoires : `nodes`, `edges`, `onNodesChange`, `onEdgesChange`
- `colorMode="dark"` pour le thème sombre
- `fitView` + `fitViewOptions={{ padding: 0.2 }}` pour centrer le graphe
- Custom nodes via `nodeTypes` prop : `{ infra: InfraNode }`
- `connectionLineType={ConnectionLineType.SmoothStep}` pour les lignes douces

#### @dagrejs/dagre v2
- Import : `import dagre from '@dagrejs/dagre';`
- API : `new dagre.graphlib.Graph()`, `g.setGraph()`, `g.setNode()`, `g.setEdge()`, `dagre.layout(g)`
- Direction : `rankdir: 'TB'` (top-to-bottom) pour un DAG classique

#### Composants Mantine existants réutilisés
- `NodeTypeIcon` (`components/shared/node-type-icon.tsx`) — icône par type de noeud
- `StatusBadge` (`components/shared/status-badge.tsx`) — badge de statut coloré
- `Paper`, `Group`, `Text`, `Badge`, `Stack`, `Title`, `Button` — mise en page
- `Skeleton` — état de chargement

### Exigences de tests

#### Tests backend — `dependencies.routes.test.ts` (ajouts)

Cas à ajouter :
- `GET /api/dependencies/graph` — retourne graphe vide (aucun lien, noeuds optionnels)
- `GET /api/dependencies/graph` — retourne graphe avec noeuds et liens
- `GET /api/dependencies/graph` — non authentifié → 401

#### Tests frontend — `dependency-graph-page.test.tsx`

Cas à couvrir :
- Affichage du graphe avec noeuds et liens (vérifier React Flow rendu avec bons counts)
- État vide (aucune dépendance) → message d'invitation + bouton vers /nodes
- Clic sur un noeud → navigation vers `/nodes/:id`
- État de chargement (skeleton)
- Noeuds partagés marqués avec `isShared: true`

#### Tests composant — `infra-node.test.tsx`

Cas à couvrir :
- Rendu avec props standard (label, type, status)
- Badge de statut correct
- Icône de type correcte
- Bordure spéciale quand `isShared: true`

#### Pattern de test établi — mocks fetch URL-based

Le pattern de mock fetch utilisé dans `node-detail-page.test.tsx` est basé sur l'URL :

```typescript
const mockFetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/dependencies/graph')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { nodes: [...], links: [...] } }),
    });
  }
  // ... other URLs
});
vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
```

#### Compteurs de tests attendus

- Tests serveur actuels : ~205 → objectif : ~208+ (ajout ~3 tests endpoint graphe)
- Tests web actuels : ~94 → objectif : ~104+ (ajout ~6 tests page + ~4 tests composant)
- Commandes : `npm test -w apps/server` et `npm test -w apps/web`

### Leçons de la Story 3.1 à appliquer

1. **Schemas de réponse pour TOUS les codes HTTP** : Toujours déclarer `response: { 200: ..., 500: errorResponseSchema }` sur les routes Fastify.

2. **`vi.hoisted()` pour les mocks** : Toute fonction mock utilisée dans `vi.mock()` doit être déclarée via `vi.hoisted()`.

3. **Test fetch URL-based** : Utiliser `mockImplementation` avec dispatch sur l'URL au lieu de `mockResolvedValueOnce` séquentiel — plus robuste quand plusieurs queries TanStack tournent en parallèle.

4. **Imports inutilisés = échec build Docker** : Le `tsc -b` strict dans le Dockerfile rejette les imports non utilisés. Toujours vérifier avec `tsc --noEmit` avant de commit.

5. **`additionalProperties: true`** sur les schemas JSON Fastify quand l'objet contient des champs dynamiques.

6. **Mantine composants dans tests** : Wrapper avec `MantineProvider` + `QueryClientProvider` + `MemoryRouter`.

### Intelligence Git

```
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

Story 3.1 a ajouté les fichiers service DAG, routes CRUD dépendances, hooks frontend, section UI. Story 3.2 étend ce travail avec une visualisation graphe.

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Le graphe de dépendances est la **couche 2 fonctionnelle** — elle est indépendante de l'arbre d'hébergement (couche 1)
- FR18 (epics.md) : "L'administrateur peut visualiser le graphe de dépendances fonctionnelles de son infrastructure"
- Le graphe sera ultérieurement consulté depuis le `ServiceDetailPanel` (Epic 4, Story 4.5) — pour l'instant c'est une page dédiée
- La taille attendue du graphe est modeste (dizaines de noeuds) — pas besoin d'optimisation de rendu avancée

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 — Story 3.2] — Critères d'acceptation
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — React Flow mentionné, feature directories
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System] — Thème dark, couleurs de statut, responsive
- [Source: _bmad-output/planning-artifacts/prd.md#FR18] — Exigence fonctionnelle visualisation graphe
- [Source: _bmad-output/implementation-artifacts/3-1-definition-des-dependances-et-moteur-de-graphe.md] — Story précédente, service DAG, routes, patterns
- [Source: reactflow.dev] — Documentation @xyflow/react v12, custom nodes, dagre layout, dark mode

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Mock dagre `vi.fn().mockReturnValue()` incompatible avec `new` dans Vitest — résolu en utilisant une vraie fonction `MockGraph()` au lieu de `vi.fn()`

### Completion Notes List

- **Task 1** : `@xyflow/react` et `@dagrejs/dagre` installés dans `apps/web`. `@types/dagre` non nécessaire (types inclus dans `@dagrejs/dagre` v2).
- **Task 2** : Route `GET /api/dependencies/graph` ajoutée dans le plugin Fastify existant. Retourne tous les noeuds + tous les liens. Schemas JSON 200/500 déclarés. 3 tests backend ajoutés.
- **Task 3** : Types `DependencyGraphResponse`, `DependencyGraphNode`, `DependencyGraphLink` ajoutés dans `packages/shared` et réexportés.
- **Task 4** : Hook `useDependencyGraph()` ajouté avec query key `['dependencies', 'graph']`.
- **Task 5** : Composant `InfraNode` créé avec Handle target/source, NodeTypeIcon, StatusBadge, bordure spéciale pour noeuds partagés. 5 tests unitaires.
- **Task 6** : Page `DependencyGraphPage` créée avec layout dagre TB, transformation données API → React Flow, détection noeuds partagés, état vide, CSS dark theme overrides. 7 tests.
- **Task 7** : Route `/graph` ajoutée dans router.tsx (protégée dans AppShell). Lien "Graphe" avec IconTopologyRing3 dans navigation.
- **Task 8** : 208 tests serveur + 106 tests web passent. TypeScript OK.

### File List

#### Fichiers créés
- `apps/web/src/features/graph/dependency-graph-page.tsx`
- `apps/web/src/features/graph/dependency-graph-page.test.tsx`
- `apps/web/src/features/graph/infra-node.tsx`
- `apps/web/src/features/graph/infra-node.test.tsx`
- `apps/web/src/features/graph/react-flow-overrides.css`

#### Fichiers modifiés
- `apps/server/src/routes/dependencies.routes.ts` — ajout route GET /graph
- `apps/server/src/routes/dependencies.routes.test.ts` — ajout 3 tests endpoint graphe
- `packages/shared/src/api/dependencies.ts` — ajout types DependencyGraphResponse
- `packages/shared/src/index.ts` — réexport nouveaux types
- `apps/web/src/api/dependencies.api.ts` — ajout hook useDependencyGraph()
- `apps/web/src/router.tsx` — ajout route /graph
- `apps/web/src/components/layout/navigation.tsx` — ajout lien "Graphe"
- `apps/web/package.json` — ajout dépendances @xyflow/react, @dagrejs/dagre

## Change Log

| Date | Description |
|---|---|
| 2026-02-13 | Story 3.2 implémentée : endpoint API graphe, page React Flow interactive avec layout dagre, composant noeud custom Mantine, état vide, CSS dark theme, routage et navigation |
