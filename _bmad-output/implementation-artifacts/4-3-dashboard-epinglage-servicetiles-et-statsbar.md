# Story 4.3: Dashboard — Épinglage, ServiceTiles & StatsBar

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur homelab,
I want voir mon dashboard avec les noeuds que j'ai épinglés et leur statut en temps réel,
so that je peux démarrer un service en un clic et voir l'état de mon homelab.

## Acceptance Criteria

### AC1 : StatsBar — bandeau de statistiques
- Le haut du dashboard affiche une barre de 4 tuiles statistiques :
  - **Noeuds actifs** : nombre de noeuds avec `status === 'online'` / total configurés
  - **Cascades du jour** : nombre de cascades lancées aujourd'hui (startedAt >= début du jour)
  - **Temps moyen cascade** : durée moyenne des cascades complétées du jour (en secondes)
  - **Heures d'inactivité** : placeholder "—" (implémenté en Epic 5)
- Les statistiques sont alimentées par un nouvel endpoint `GET /api/stats/dashboard`
- La StatsBar est responsive : 4 colonnes desktop, 2×2 grille tablette/mobile

### AC2 : Grille responsive de ServiceTiles
- En dessous de la StatsBar, une grille affiche les noeuds où `isPinned === true`
- Responsive via Mantine `SimpleGrid` : 3 colonnes desktop (≥992px), 2 tablette (768-991px), 1 mobile (<768px)
- Les noeuds sont triés par nom (alphabétique)

### AC3 : Contenu du ServiceTile
- Chaque carte affiche : icône type (via `NodeTypeIcon`), nom, badge de statut coloré (via `StatusBadge`), type/plateforme, résumé dépendances (ex: "3 dépendances"), bouton contextuel unique

### AC4 : Bouton contextuel selon l'état du noeud
- **offline** → bouton "Démarrer" (bleu tech, `blue.4`) — lance `POST /api/cascades/start` immédiatement (pas de confirmation)
- **online** → bouton "Ouvrir" — ouvre `serviceUrl` dans un nouvel onglet (`window.open`). Si pas de `serviceUrl`, bouton absent
- **error** → bouton "Réessayer" (orange, `orange.4`) — relance `POST /api/cascades/start`
- **starting/stopping** → bouton désactivé avec loader

### AC5 : Épinglage / désépinglage
- Le `UpdateNodePayload` frontend est étendu pour inclure `isPinned?: boolean`
- Le backend `PATCH /api/nodes/:id` accepte et persiste `isPinned`
- Un bouton d'épinglage (icône punaise) est présent sur chaque ServiceTile (toggle)
- Cliquer toggle `isPinned` via `useUpdateNode` → le dashboard se rafraîchit automatiquement (invalidation query `['nodes']`)

### AC6 : État vide du dashboard
- Si aucun noeud n'est épinglé, afficher un message d'état vide via le composant `EmptyState` existant
- Le message invite l'utilisateur à épingler des noeuds depuis la page Noeuds (avec lien)

### AC7 : Accessibilité
- Chaque ServiceTile utilise `role="article"` avec `aria-label` incluant le nom du noeud et son statut
- La navigation au clavier (Tab) parcourt les cartes
- Les boutons d'action sont focusables avec `aria-label` descriptif

### AC8 : Hook frontend cascades API
- Un fichier `apps/web/src/api/cascades.api.ts` expose `useStartCascade()` — mutation `POST /api/cascades/start` avec invalidation `['nodes']`
- Ce hook est utilisé par les ServiceTiles pour le bouton "Démarrer" / "Réessayer"

### AC9 : Endpoint statistiques dashboard
- `GET /api/stats/dashboard` (authentifié) retourne `{ data: { nodesOnline: number, nodesTotal: number, cascadesToday: number, avgCascadeDurationMs: number | null } }`
- Requête SQL sur les tables `nodes` (count status=online) et `cascades` (count today, avg duration)

## Tasks / Subtasks

- [x] Task 1 : Endpoint backend `GET /api/stats/dashboard` (AC: #1, #9)
  - [x] 1.1 Créer `apps/server/src/routes/stats.routes.ts` comme `FastifyPluginAsync`
  - [x] 1.2 Implémenter la route `GET /dashboard` avec requêtes sur `nodes` (count online, count total configurés) et `cascades` (count today, avg duration completed today)
  - [x] 1.3 Déclarer les schemas response (200, 500)
  - [x] 1.4 Enregistrer le plugin dans `app.ts` avec prefix `/api/stats`
  - [x] 1.5 Écrire les tests `apps/server/src/routes/stats.routes.test.ts` : retour stats correctes, authentification requise

- [x] Task 2 : Support `isPinned` dans le PATCH backend (AC: #5)
  - [x] 2.1 Modifier `apps/server/src/routes/nodes.routes.ts` — ajouter `isPinned` dans le body du PATCH et dans l'objet `updates`
  - [x] 2.2 Ajouter un test vérifiant que PATCH avec `isPinned: true` fonctionne

- [x] Task 3 : Hook frontend cascades API (AC: #8)
  - [x] 3.1 Créer `apps/web/src/api/cascades.api.ts` avec `useStartCascade()` — mutation `POST /api/cascades/start` body `{ nodeId }`, invalide `['nodes']` on success
  - [x] 3.2 Écrire les tests `apps/web/src/api/cascades.api.test.ts` : mutation appelle l'endpoint correct

- [x] Task 4 : Compléter `UpdateNodePayload` frontend (AC: #5)
  - [x] 4.1 Ajouter `isPinned?: boolean` à `UpdateNodePayload` dans `apps/web/src/api/nodes.api.ts`

- [x] Task 5 : Composant ServiceTile (AC: #3, #4, #7)
  - [x] 5.1 Créer `apps/web/src/features/dashboard/service-tile.tsx` — carte Mantine (`Card`) avec icône, nom, StatusBadge, type/plateforme, résumé dépendances, bouton contextuel, bouton punaise toggle
  - [x] 5.2 Implémenter la logique du bouton contextuel : offline→"Démarrer", online→"Ouvrir", error→"Réessayer", starting/stopping→disabled+loader
  - [x] 5.3 Accessibilité : `role="article"`, `aria-label`, boutons focusables
  - [x] 5.4 Écrire les tests `apps/web/src/features/dashboard/service-tile.test.tsx` : rendu chaque état, clic démarrer/ouvrir/réessayer, toggle épinglage

- [x] Task 6 : Composant StatsBar (AC: #1)
  - [x] 6.1 Créer `apps/web/src/features/dashboard/stats-bar.tsx` — 4 tuiles (Paper Mantine) avec label + valeur
  - [x] 6.2 Hook `useStats()` dans `apps/web/src/api/stats.api.ts` — `GET /api/stats/dashboard`
  - [x] 6.3 Responsive : `SimpleGrid cols={4}` avec breakpoints pour 2 colonnes mobile
  - [x] 6.4 Écrire les tests `apps/web/src/features/dashboard/stats-bar.test.tsx`

- [x] Task 7 : Page Dashboard (AC: #2, #6)
  - [x] 7.1 Remplacer le contenu de `apps/web/src/features/home/home-page.tsx` par le dashboard : StatsBar + grille ServiceTiles
  - [x] 7.2 Filtrer les noeuds épinglés (`isPinned === true`), trier par nom
  - [x] 7.3 État vide avec `EmptyState` et lien vers `/nodes`
  - [x] 7.4 Skeleton loaders pendant le chargement
  - [x] 7.5 Écrire les tests `apps/web/src/features/home/home-page.test.tsx` : rendu dashboard, état vide, état loading

- [x] Task 8 : Validation et intégration (AC: #1-9)
  - [x] 8.1 Lancer `npm test -w apps/server` — tous les tests passent (278 tests)
  - [x] 8.2 Lancer `npm test -w apps/web` — tous les tests passent (132 tests)
  - [x] 8.3 Lancer `tsc --noEmit` — compilation TypeScript OK (server + web)
  - [x] 8.4 Lancer `docker compose up --build -d` — build réussi, serveur démarre

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage dans cette story |
|---|---|---|
| TypeScript | strict mode | Partout |
| React | 19 | Composants Dashboard, ServiceTile, StatsBar |
| Mantine | v7+ | Card, Paper, SimpleGrid, Badge, Button, Group, Stack, Tooltip |
| TanStack Query | v5 | useNodes, useStats, useStartCascade, useUpdateNode |
| Fastify | ~5.x | Route stats backend |
| Drizzle ORM | ~0.45.x | Requêtes stats (count, avg) |
| Vitest | latest | Tests co-localisés |
| @testing-library/react | latest | Tests composants |

**Aucune nouvelle dépendance à installer.**

### Contraintes architecturales critiques

1. **Dashboard remplace HomePage** : Le dashboard n'est PAS une nouvelle page — il remplace le contenu de `apps/web/src/features/home/home-page.tsx`. La route `/` reste inchangée dans `router.tsx`.

2. **Temps réel automatique via useSSE** : Le hook `useSSE()` est déjà monté dans l'AppShell (Story 4.2). Les événements SSE `status-change` invalident automatiquement `['nodes']`. Le dashboard se met à jour en temps réel sans rien ajouter.

3. **Pas de store Zustand** : Les données dashboard viennent de TanStack Query (`useNodes`, `useStats`). Pas besoin de store client Zustand pour cette story.

4. **`apiFetch` obligatoire** : Tous les appels API frontend DOIVENT utiliser `apps/web/src/api/api-fetch.ts` qui gère `credentials: 'include'` pour les cookies de session.

5. **Scope limité — PAS de CascadeProgress** : L'animation de progression sur les cartes (barre 3px, fade 200ms) est la Story 4.4. Cette story affiche uniquement le statut via `StatusBadge` et le bouton contextuel.

6. **Scope limité — PAS de ServiceDetailPanel** : Le clic sur une carte (hors bouton d'action) n'ouvre PAS de panneau latéral. C'est la Story 4.5.

7. **Scope limité — PAS d'arrêt** : Le bouton "Arrêter" n'est PAS sur les ServiceTiles. Il sera uniquement dans le ServiceDetailPanel (Story 4.5).

8. **`isPinned` existe en DB et shared, pas dans le PATCH backend ni le frontend** :
   - DB schema : `is_pinned INTEGER NOT NULL DEFAULT false` ✓
   - Shared types : `UpdateNodeRequest.isPinned?: boolean` ✓
   - Backend PATCH route : **MANQUE** — `isPinned` n'est pas dans l'objet `updates`
   - Frontend `UpdateNodePayload` : **MANQUE** — `isPinned` absent du type

9. **Endpoint stats = nouvelle route** : `GET /api/stats/dashboard` n'existe pas. Créer `stats.routes.ts` dans un nouveau fichier.

10. **`cascades.api.ts` n'existe pas encore côté frontend** : Créer le fichier avec `useStartCascade()` qui appelle `POST /api/cascades/start`.

### Conventions de nommage

| Couche | Convention | Exemples Story 4.3 |
|---|---|---|
| Fichiers frontend | `kebab-case` | `service-tile.tsx`, `stats-bar.tsx`, `cascades.api.ts`, `stats.api.ts` |
| Composants React | `PascalCase` | `ServiceTile`, `StatsBar`, `DashboardPage` |
| Hooks | `use*` | `useStartCascade`, `useStats` |
| Fichiers backend | `kebab-case` | `stats.routes.ts` |
| Routes API | `kebab-case` | `/api/stats/dashboard`, `/api/cascades/start` |
| Tests | co-localisés `.test.ts(x)` | `service-tile.test.tsx`, `stats.routes.test.ts` |

### Composant ServiceTile — anatomie

```tsx
// apps/web/src/features/dashboard/service-tile.tsx
import { Card, Group, Stack, Text, Badge, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconPin, IconPinnedOff } from '@tabler/icons-react';
import { StatusBadge } from '../../components/shared/status-badge';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';

interface ServiceTileProps {
  node: {
    id: string;
    name: string;
    type: string;
    status: string;
    serviceUrl: string | null;
    isPinned: boolean;
  };
  dependencyCount: number;
  onStartCascade: (nodeId: string) => void;
  onTogglePin: (nodeId: string, isPinned: boolean) => void;
}

// Layout :
// ┌─────────────────────────────┐
// │ [Icon] Nom       [📌] Pin  │
// │ [StatusBadge] · type        │
// │ 3 dépendances               │
// │ [  Démarrer  ]              │
// └─────────────────────────────┘
```

### Bouton contextuel — logique

| Status | Label | Couleur | Action | Désactivé |
|---|---|---|---|---|
| `offline` | "Démarrer" | `blue.4` (#339AF0) | `POST /api/cascades/start` | Non |
| `online` | "Ouvrir" | `blue.4` | `window.open(serviceUrl, '_blank')` | Si pas de `serviceUrl` |
| `error` | "Réessayer" | `orange.4` (#FF922B) | `POST /api/cascades/start` | Non |
| `starting` | "Démarrage…" | `yellow.4` | — | Oui (loading) |
| `stopping` | "Arrêt…" | `orange.4` | — | Oui (loading) |

### StatsBar — structure

```tsx
// apps/web/src/features/dashboard/stats-bar.tsx
// 4 tuiles dans un SimpleGrid
<SimpleGrid cols={{ base: 2, sm: 2, md: 4 }}>
  <Paper p="md" withBorder>
    <Text size="sm" c="dimmed">Noeuds actifs</Text>
    <Text size="xl" fw={700}>{nodesOnline}/{nodesTotal}</Text>
  </Paper>
  {/* ... 3 autres tuiles identiques */}
</SimpleGrid>
```

### Endpoint stats backend

```typescript
// apps/server/src/routes/stats.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { nodes, cascades } from '../db/schema.js';
import { eq, sql, and, gte } from 'drizzle-orm';

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                nodesOnline: { type: 'integer' },
                nodesTotal: { type: 'integer' },
                cascadesToday: { type: 'integer' },
                avgCascadeDurationMs: { type: ['number', 'null'] },
              },
            },
          },
        },
        500: { /* error schema */ },
      },
    },
  }, async (request, reply) => {
    // Count online + total configured nodes
    // Count cascades where startedAt >= start of today
    // Avg duration = avg(completedAt - startedAt) for completed cascades today
  });
};
```

### Architecture Compliance

#### Pattern hook API frontend (cf. `nodes.api.ts`)

```typescript
// apps/web/src/api/cascades.api.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';

interface StartCascadeResponse {
  data: {
    cascade: { id: string; nodeId: string; type: string; status: string };
  };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: unknown };
}

export function useStartCascade() {
  const queryClient = useQueryClient();
  return useMutation<StartCascadeResponse, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch('/api/cascades/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as StartCascadeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}
```

#### Ajout isPinned au PATCH backend

```typescript
// Dans nodes.routes.ts — PATCH handler, ajouter :
if (body.isPinned !== undefined) updates.isPinned = body.isPinned;
// Et ajouter isPinned: { type: 'boolean' } dans le body schema du PATCH
```

#### Ajout isPinned au UpdateNodePayload frontend

```typescript
// Dans nodes.api.ts — UpdateNodePayload
export interface UpdateNodePayload {
  name?: string;
  serviceUrl?: string;
  configured?: boolean;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  isPinned?: boolean;  // ← AJOUTER
}
```

### Patterns frontend établis à reproduire

**Pattern page avec données** (cf. `nodes-page.tsx`) :
```typescript
export function HomePage() {
  const { data, isLoading } = useNodes();
  const nodes = data?.data?.nodes ?? [];
  const pinnedNodes = nodes.filter(n => n.isPinned).sort((a, b) => a.name.localeCompare(b.name));

  if (isLoading) return <SkeletonLoader count={6} height={120} />;

  return (
    <Container>
      <StatsBar />
      {pinnedNodes.length === 0 ? (
        <EmptyState
          icon={<IconPin size={48} />}
          title="Aucun noeud épinglé"
          description="Épinglez des noeuds depuis la page Noeuds pour les voir ici."
          action={{ label: 'Voir les noeuds', to: '/nodes' }}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {pinnedNodes.map(node => (
            <ServiceTile key={node.id} node={node} ... />
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
```

**Pattern test composant** (cf. `nodes-page.test.tsx`) :
```typescript
// Mock the API hooks
vi.mock('../../api/nodes.api', () => ({
  useNodes: vi.fn(),
}));

// Render with MantineProvider + MemoryRouter + QueryClientProvider
```

**Pattern composant shared réutilisable** :
- `StatusBadge` : prend `status: string` → retourne `<Badge color={...}>{label}</Badge>`
- `NodeTypeIcon` : prend `type: string` → retourne l'icône Tabler correspondante
- `EmptyState` : prend `icon, title, description, action?` → section centrée
- `SkeletonLoader` : prend `count, height` → grille de squelettes

### Comptage des dépendances par noeud

Pour afficher "X dépendances" sur chaque ServiceTile, il faut compter les liens de dépendance (Layer 2). Options :

**Option recommandée** : Utiliser les données déjà disponibles. Le frontend a déjà `useNodes()` qui retourne tous les noeuds. Les dépendances sont accessibles via `GET /api/dependencies`. Créer un hook simple `useDependencies()` ou réutiliser les données du graphe si disponibles.

**Alternative simple** : Ajouter un champ `dependencyCount` dans la réponse `GET /api/nodes` côté backend. Plus efficient mais nécessite une modification backend supplémentaire.

**Pour cette story, utiliser l'option la plus simple** : un appel `GET /api/dependencies` dans le dashboard et compter les liens par nodeId côté frontend. Le hook `useDependencies()` est probablement déjà disponible.

### Project Structure Notes

#### Fichiers à créer

```
apps/server/src/
  routes/
    stats.routes.ts              ← NOUVEAU : GET /api/stats/dashboard
    stats.routes.test.ts         ← NOUVEAU : tests stats (~4 tests)

apps/web/src/
  api/
    cascades.api.ts              ← NOUVEAU : useStartCascade()
    cascades.api.test.ts         ← NOUVEAU : tests hook cascade (~2 tests)
    stats.api.ts                 ← NOUVEAU : useStats()
  features/
    dashboard/
      service-tile.tsx           ← NOUVEAU : composant ServiceTile
      service-tile.test.tsx      ← NOUVEAU : tests ServiceTile (~6 tests)
      stats-bar.tsx              ← NOUVEAU : composant StatsBar
      stats-bar.test.tsx         ← NOUVEAU : tests StatsBar (~3 tests)
```

#### Fichiers à modifier

```
apps/server/src/
  routes/nodes.routes.ts         ← MODIFIER : ajouter isPinned au PATCH
  app.ts                         ← MODIFIER : enregistrer statsRoutes

apps/web/src/
  api/nodes.api.ts               ← MODIFIER : ajouter isPinned à UpdateNodePayload
  features/home/home-page.tsx    ← MODIFIER : remplacer placeholder par Dashboard
```

#### Alignement avec la structure existante

- Le répertoire `features/dashboard/` est nouveau — suit le pattern `features/<nom>` (cf. `features/nodes/`, `features/graph/`)
- Les fichiers API frontend sont dans `api/` à côté de `nodes.api.ts` — cohérent
- Les tests sont co-localisés (`.test.ts(x)` à côté du fichier source) — pattern établi
- La route backend stats est dans `routes/` à côté de `nodes.routes.ts` — cohérent

### Exigences de tests

#### Tests stats.routes.ts (backend) — scénarios à couvrir

- `GET /api/stats/dashboard` — retourne les compteurs corrects (insérer des noeuds et cascades en DB de test)
- `GET /api/stats/dashboard` — non authentifié → 401
- `GET /api/stats/dashboard` — base vide → `{ nodesOnline: 0, nodesTotal: 0, cascadesToday: 0, avgCascadeDurationMs: null }`

#### Tests service-tile.test.tsx — scénarios à couvrir

- Rendu avec noeud offline → affiche bouton "Démarrer"
- Rendu avec noeud online + serviceUrl → affiche bouton "Ouvrir"
- Rendu avec noeud online sans serviceUrl → pas de bouton "Ouvrir"
- Rendu avec noeud error → affiche bouton "Réessayer"
- Rendu avec noeud starting → bouton désactivé
- Clic "Démarrer" → appelle onStartCascade
- Clic toggle pin → appelle onTogglePin
- `role="article"` et `aria-label` présents

#### Tests stats-bar.test.tsx — scénarios à couvrir

- Rendu avec données → affiche les 4 tuiles
- Rendu en chargement → skeleton
- Rendu sans cascades → "0" et "—"

#### Tests home-page.test.tsx — scénarios à couvrir

- Rendu avec noeuds épinglés → affiche ServiceTiles
- Rendu sans noeuds épinglés → affiche EmptyState
- Rendu en chargement → affiche SkeletonLoader

#### Pattern de test — mock API hooks

```typescript
import { vi } from 'vitest';

vi.mock('../../api/nodes.api', () => ({
  useNodes: vi.fn(),
  useUpdateNode: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

vi.mock('../../api/cascades.api', () => ({
  useStartCascade: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
```

#### Compteurs de tests attendus

- Tests serveur actuels : ~274 → objectif : ~280+ (ajout ~6 tests stats + isPinned)
- Tests web actuels : ~112 → objectif : ~130+ (ajout ~18 tests dashboard)
- Commandes : `npm test -w apps/server`, `npm test -w apps/web`

### Leçons des stories précédentes à appliquer

1. **Fastify response schemas requis pour TOUS les codes HTTP** : La route stats DOIT déclarer les schemas pour 200 ET 500. Sans cela → échec build Docker.

2. **`vi.hoisted()` obligatoire pour les mocks dans `vi.mock()` factories** : Si le mock est une variable utilisée dans le callback `vi.mock()`, utiliser `vi.hoisted()`.

3. **Imports inutilisés = échec build Docker** : `tsc -b` strict rejette les imports non utilisés. Vérifier avec `tsc --noEmit` avant de considérer la story terminée.

4. **`credentials: 'include'` via `apiFetch`** : Ne JAMAIS utiliser `fetch()` directement — toujours `apiFetch()` qui ajoute les credentials pour la session cookie.

5. **SSE route tests utilisent un vrai serveur HTTP** (Story 4.2) : Les tests de routes classiques utilisent `app.inject()` normalement — ce problème ne concerne que les routes SSE hijackées.

6. **Mock EventSource global dans `test-setup.ts`** (Story 4.2) : Déjà en place, pas besoin de le rajouter.

7. **Pattern `sanitizeNode()`** : Le backend ne retourne JAMAIS `sshCredentialsEncrypted` dans les API. Les NodeResponse frontend n'ont pas ce champ — c'est correct.

8. **`refetchOnWindowFocus: false`** déjà configuré dans `main.tsx` — les invalidations TanStack Query depuis SSE ne causeront pas de duplications.

### Intelligence Git

```
699f046 feat: implement stories 2-4 to 3-2 — nodes UI, dependencies & graph visualization
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

- Stories 4.1 et 4.2 sont implémentées dans cette session (pas encore commitées) : cascade engine + SSE
- Le frontend a déjà : noeuds (page + hooks), graphe de dépendances, StatusBadge, NodeTypeIcon, EmptyState, SkeletonLoader
- Le backend a déjà : CRUD noeuds, dépendances, cascades (start/stop), SSE manager

### Information technique récente

- **Mantine v7 SimpleGrid** : Utiliser `cols={{ base: 1, sm: 2, md: 3 }}` pour le responsive (pas l'ancienne API `breakpoints`). Le responsive est mobile-first.
- **Mantine v7 Card** : `Card` avec `withBorder` et `padding="md"` pour le style dark. `Card.Section` pour les zones pleine largeur.
- **Mantine v7 Paper** : Pour les tuiles stats, `Paper` avec `p="md"` et `withBorder`.
- **TanStack Query v5 mutations** : `useMutation` avec `mutationFn`, `onSuccess`, `onError`. Le type de variable est le 3ème générique. `isPending` (pas `isLoading`) pour l'état de mutation en cours.
- **window.open sécurisé** : `window.open(url, '_blank', 'noopener,noreferrer')` pour ouvrir les URLs de service.

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Le dashboard est la **page d'accueil principale** — c'est ce que l'utilisateur voit en premier
- Le temps réel est déjà fonctionnel (SSE Story 4.2) — les changements de statut apparaîtront automatiquement
- Les cascades de démarrage sont opérationnelles (Story 4.1) — le bouton "Démarrer" fonctionnera immédiatement
- L'épinglage est le mécanisme de personnalisation du dashboard — tout noeud est épinglable
- Stories suivantes (4.4, 4.5) ajouteront : barre de progression cascade, panneau latéral détail, bouton arrêt

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.3] — 9 critères d'acceptation BDD, user story
- [Source: _bmad-output/planning-artifacts/prd.md#FR40-FR46] — Dashboard, épinglage, temps réel, statut, ouverture service
- [Source: _bmad-output/planning-artifacts/prd.md#NFR1] — Dashboard charge en moins de 15 secondes
- [Source: _bmad-output/planning-artifacts/prd.md#NFR3] — Mises à jour temps réel < 3 secondes
- [Source: _bmad-output/planning-artifacts/prd.md#NFR13-NFR16] — Accessibilité WCAG AA
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-03] — Vite + React 19 + Mantine v7+ + React Router
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-08] — TanStack Query + Zustand
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-19] — Organisation frontend par feature
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-05] — Dashboard grille ServiceTiles + StatsBar
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-06] — ServiceTile anatomie et états
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-16] — Responsive breakpoints (3/2/1 colonnes)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-17] — Accessibilité WCAG AA
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-18] — Bouton contextuel unique par carte
- [Source: _bmad-output/implementation-artifacts/4-1-moteur-de-cascade-et-orchestration-deux-couches.md] — Cascade engine, routes cascades, patterns
- [Source: _bmad-output/implementation-artifacts/4-2-endpoint-sse-et-communication-temps-reel.md] — SSE manager, useSSE hook, EventSource mock

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Timestamp format mismatch: Drizzle ORM `mode: 'timestamp'` stores seconds, raw SQL inserts used milliseconds — fixed by using `Math.floor(getTime() / 1000)` in tests and `* 1000` in avg duration SQL
- `DependencyGraphLink.source` doesn't exist — corrected to `fromNodeId` per shared types
- Router test referenced old "Bienvenue sur WakeHub" text — updated to "Dashboard"
- TypeScript strict: `possibly undefined` on destructured Drizzle results — fixed with optional chaining

### Completion Notes List

- ✅ Task 1: Created `stats.routes.ts` with `GET /api/stats/dashboard` — counts configured nodes (online/total), cascades today, avg duration of completed cascades (in ms). Registered in `app.ts` with prefix `/api/stats`. 4 tests.
- ✅ Task 2: Added `isPinned` to PATCH `/api/nodes/:id` — body schema, type generic, and updates object. All 42 existing node tests still pass.
- ✅ Task 3: Created `cascades.api.ts` with `useStartCascade()` mutation hook — POST `/api/cascades/start`, invalidates `['nodes']`. 2 tests.
- ✅ Task 4: Added `isPinned?: boolean` to `UpdateNodePayload` in `nodes.api.ts`.
- ✅ Task 5: Created `ServiceTile` component — Card with NodeTypeIcon, name, StatusBadge, type, dependency count, contextual button (Démarrer/Ouvrir/Réessayer/disabled), pin toggle. Full accessibility (role=article, aria-labels). 11 tests.
- ✅ Task 6: Created `StatsBar` component — 4-tile SimpleGrid (responsive 2/4 cols) with nodesOnline, cascadesToday, avgDuration, inactivity placeholder. Created `stats.api.ts` with `useStats()`. 3 tests.
- ✅ Task 7: Replaced `home-page.tsx` placeholder with full Dashboard — StatsBar + pinned ServiceTiles grid (3/2/1 cols responsive) + EmptyState when no pins + SkeletonLoader. Updated router test. 4 tests.
- ✅ Task 8: All 278 server tests pass, all 132 web tests pass, TypeScript clean, Docker build succeeds.

### File List

**New files:**
- `apps/server/src/routes/stats.routes.ts` — GET /api/stats/dashboard endpoint
- `apps/server/src/routes/stats.routes.test.ts` — Stats route tests (4 tests)
- `apps/web/src/api/cascades.api.ts` — useStartCascade() hook
- `apps/web/src/api/cascades.api.test.ts` — Cascades API tests (2 tests)
- `apps/web/src/api/stats.api.ts` — useStats() hook
- `apps/web/src/features/dashboard/service-tile.tsx` — ServiceTile component
- `apps/web/src/features/dashboard/service-tile.test.tsx` — ServiceTile tests (11 tests)
- `apps/web/src/features/dashboard/stats-bar.tsx` — StatsBar component
- `apps/web/src/features/dashboard/stats-bar.test.tsx` — StatsBar tests (3 tests)
- `apps/web/src/features/home/home-page.test.tsx` — Dashboard page tests (4 tests)

**Modified files:**
- `apps/server/src/app.ts` — Added statsRoutes import and registration
- `apps/server/src/routes/nodes.routes.ts` — Added isPinned to PATCH body schema/type/updates
- `apps/web/src/api/nodes.api.ts` — Added isPinned to UpdateNodePayload
- `apps/web/src/features/home/home-page.tsx` — Replaced placeholder with Dashboard
- `apps/web/src/router.test.tsx` — Updated expected text from "Bienvenue" to "Dashboard"

## Change Log

- **2026-02-13** — Story 4.3 implemented: Dashboard with StatsBar (4 stat tiles), ServiceTiles grid (pinned nodes), contextual action buttons, pin toggle, empty state, responsive layout. Backend stats endpoint + isPinned PATCH support added. 24 new tests (total: 410 passing).
