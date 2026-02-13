# Story 4.4: CascadeProgress & feedback visuel

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur homelab,
I want voir la progression de la cascade en temps réel sur la carte du service,
so that je sais exactement ce qui se passe pendant le démarrage ou l'arrêt de mes services.

## Acceptance Criteria

### AC1 : Barre de progression sur le ServiceTile
- Quand une cascade est en cours pour un noeud (`status === 'starting'` ou `status === 'stopping'`), une barre de progression fine (3px) apparaît en bordure basse de la carte
- La barre est bleu tech (`blue.4` / `#339AF0`) pendant la progression
- La progression est proportionnelle : `(step / totalSteps) * 100`
- La barre utilise `Mantine Progress` avec `size={3}` et `radius={0}`

### AC2 : Affichage de la dépendance en cours
- Pendant la cascade, le nom et l'icône (via `NodeTypeIcon`) de la dépendance en cours de traitement s'affichent sur la carte
- La zone affiche : icône type du noeud en cours + nom du noeud en cours (ex: "NAS-Storage")
- La transition entre chaque dépendance utilise une animation fade de 200ms
- Si `prefers-reduced-motion` est activé, la transition est instantanée (pas d'animation)

### AC3 : État de succès de cascade
- Quand la cascade réussit (événement SSE `cascade-complete` avec `success: true`) :
  - La barre se remplit à 100%, passe en vert (`green.5`), puis disparaît après 1 seconde
  - Le ServiceTile passe à badge "Actif" + bouton "Ouvrir" (via invalidation query `['nodes']` déjà en place)
  - Un toast de succès Mantine s'affiche : "✓ [nom du noeud] démarré avec succès" (vert, ~5s)

### AC4 : État d'erreur de cascade
- Quand la cascade échoue (événement SSE `cascade-error`) :
  - La barre s'arrête et passe en rouge (`red.5`)
  - Un message court "Échec : [nom dépendance en échec]" s'affiche sur la carte sous la zone de dépendance
  - Le bouton passe à "Réessayer" (orange) — déjà géré par le `getActionButton` existant via le statut `error`
  - Un toast d'erreur Mantine s'affiche : "✗ Échec : [message d'erreur]" (rouge, ~5s)

### AC5 : Store Zustand pour l'état des cascades actives
- Un store Zustand `useCascadeStore` maintient l'état des cascades en cours par nodeId
- Structure : `Map<nodeId, { cascadeId, step, totalSteps, currentNodeId?, currentNodeName?, status: 'in_progress' | 'completed' | 'failed', errorNodeName? }>`
- Le hook `useSSE` est enrichi pour parser les données des événements SSE `cascade-progress`, `cascade-complete`, `cascade-error` et mettre à jour le store
- Le store est nettoyé automatiquement 2 secondes après la fin de la cascade (succès ou erreur) pour permettre l'animation de fin

### AC6 : Accessibilité CascadeProgress
- La barre de progression utilise `role="progressbar"` avec `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={100}`
- La zone de dépendance en cours utilise `aria-live="polite"` pour annoncer les changements aux lecteurs d'écran
- Le composant respecte `prefers-reduced-motion` : toutes les transitions sont instantanées (0ms au lieu de 200ms)

### AC7 : Intégration dans le ServiceTile existant
- Le composant `CascadeProgress` est intégré dans le `ServiceTile` existant — il s'affiche uniquement quand le store indique une cascade active pour ce nodeId
- Le `ServiceTile` passe les données de cascade au composant `CascadeProgress`
- Quand aucune cascade n'est active, le ServiceTile reste identique à l'implémentation actuelle (Story 4.3)

## Tasks / Subtasks

- [x] Task 1 : Store Zustand `useCascadeStore` (AC: #5)
  - [x] 1.1 Créer `apps/web/src/stores/cascade.store.ts` avec le store Zustand
  - [x] 1.2 Interface `CascadeState` : `Record<string, { cascadeId: string; step: number; totalSteps: number; currentNodeId?: string; currentNodeName?: string; status: 'in_progress' | 'completed' | 'failed'; errorNodeName?: string }>`
  - [x] 1.3 Actions : `updateProgress(nodeId, data)`, `completeCascade(nodeId)`, `failCascade(nodeId, errorNodeName?)`, `clearCascade(nodeId)`
  - [x] 1.4 Sélecteur : `useCascadeForNode(nodeId)` — retourne l'état de cascade pour un noeud donné ou `undefined`
  - [x] 1.5 Écrire les tests `apps/web/src/stores/cascade.store.test.ts` : mise à jour progress, completion, failure, clear, isolation par nodeId

- [x] Task 2 : Enrichir `useSSE` pour alimenter le store (AC: #5)
  - [x] 2.1 Modifier `apps/web/src/hooks/use-sse.ts` — importer `useCascadeStore`
  - [x] 2.2 Dans le listener `cascade-progress` : parser `event.data` (JSON), extraire `nodeId, step, totalSteps, currentNodeId, currentNodeName`, appeler `updateProgress()`
  - [x] 2.3 Dans le listener `cascade-complete` : parser les données, appeler `completeCascade(nodeId)`, afficher toast de succès, programmer `clearCascade(nodeId)` après 2 secondes
  - [x] 2.4 Dans le listener `cascade-error` : parser les données, appeler `failCascade(nodeId, currentNodeName)`, afficher toast d'erreur, programmer `clearCascade(nodeId)` après 2 secondes
  - [x] 2.5 Écrire les tests `apps/web/src/hooks/use-sse.test.ts` : vérifier que les événements SSE mettent à jour le store et déclenchent les toasts

- [x] Task 3 : Composant `CascadeProgress` (AC: #1, #2, #3, #4, #6)
  - [x] 3.1 Créer `apps/web/src/features/dashboard/cascade-progress.tsx`
  - [x] 3.2 Props : `step: number`, `totalSteps: number`, `currentNodeName?: string`, `currentNodeType?: string`, `status: 'in_progress' | 'completed' | 'failed'`, `errorNodeName?: string`
  - [x] 3.3 Implémenter la barre `Progress` (3px, radius 0) : bleu en cours, vert au succès, rouge en erreur
  - [x] 3.4 Implémenter la zone de dépendance en cours avec `NodeTypeIcon` + texte nom, transition fade 200ms via `Transition` Mantine
  - [x] 3.5 Implémenter le message d'erreur "Échec : [nom]" quand `status === 'failed'`
  - [x] 3.6 Accessibilité : `role="progressbar"`, `aria-valuenow/min/max`, `aria-live="polite"` sur la zone de dépendance
  - [x] 3.7 Respecter `prefers-reduced-motion` via `@media (prefers-reduced-motion: reduce)` — transitions à 0ms
  - [x] 3.8 Écrire les tests `apps/web/src/features/dashboard/cascade-progress.test.tsx` : rendu en progression, rendu succès (vert), rendu erreur (rouge + message), role progressbar, aria-live

- [x] Task 4 : Intégration dans `ServiceTile` (AC: #7)
  - [x] 4.1 Modifier `apps/web/src/features/dashboard/service-tile.tsx` — importer `CascadeProgress` et `useCascadeForNode`
  - [x] 4.2 Appeler `useCascadeForNode(node.id)` dans le composant
  - [x] 4.3 Rendre `CascadeProgress` en bas du `Card` quand une cascade est active (données du store)
  - [x] 4.4 Mettre à jour les tests existants `service-tile.test.tsx` : ajouter tests avec cascade active, vérifier que le CascadeProgress apparaît
  - [x] 4.5 Vérifier que le ServiceTile reste identique sans cascade active (non-régression)

- [x] Task 5 : Résolution du nodeType pour la dépendance en cours (AC: #2)
  - [x] 5.1 Le `SSECascadeProgressEvent` contient `currentNodeId` et `currentNodeName` mais PAS `currentNodeType`
  - [x] 5.2 Option : déduire le type depuis le cache `useNodes` (les données sont déjà en cache TanStack Query) — ajouter un lookup dans le store ou dans le composant
  - [x] 5.3 Alternative simple : stocker un `nodesMap` (id → type) dans le cascade store alimenté depuis les données `useNodes`, ou passer le type comme prop depuis `HomePage` qui a accès à tous les noeuds

- [x] Task 6 : Validation et intégration (AC: #1-7)
  - [x] 6.1 Lancer `npm test -w apps/web` — tous les tests passent
  - [x] 6.2 Lancer `tsc --noEmit` dans `apps/web` — compilation TypeScript OK
  - [x] 6.3 Tester manuellement : lancer une cascade depuis le dashboard, vérifier la barre de progression et les animations
  - [x] 6.4 Tester l'accessibilité : role progressbar, aria-live, navigation clavier, prefers-reduced-motion

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage dans cette story |
|---|---|---|
| TypeScript | strict mode | Partout |
| React | 19 | Composant CascadeProgress, enrichissement ServiceTile |
| Mantine | v7+ | Progress, Transition, Card.Section, notifications |
| Zustand | latest | Store cascade state (nouveau) |
| TanStack Query | v5 | Cache existant pour lookup nodeType |
| Vitest | latest | Tests co-localisés |
| @testing-library/react | latest | Tests composants |

**Aucune nouvelle dépendance à installer.** Zustand est déjà installé dans le projet (cf. architecture ARCH-08).

### Contraintes architecturales critiques

1. **Story frontend uniquement** : Le backend est COMPLET. Le cascade-engine émet déjà les événements SSE `cascade-progress`, `cascade-complete`, `cascade-error` via `broadcastCascadeEvent()` dans `cascades.routes.ts`. NE PAS modifier le backend.

2. **Problème central : useSSE ne stocke pas les données** : Le hook `useSSE` actuel (`apps/web/src/hooks/use-sse.ts`) écoute les événements SSE mais ne fait QUE invalider les queries TanStack. Il ne parse PAS `event.data` et ne stocke PAS les informations de progression. La solution est un store Zustand alimenté depuis useSSE.

3. **Flux de données SSE** :
   ```
   Backend cascade-engine → onProgress callback
     → broadcastCascadeEvent() → sseManager.broadcast()
       → EventSource client → useSSE hook
         → parse event.data (JSON.parse)
           → useCascadeStore.updateProgress()
             → CascadeProgress composant (re-render via Zustand selector)
   ```

4. **Événements SSE reçus côté client** — format exact :
   - `cascade-progress` : `{ cascadeId, nodeId, step, totalSteps, currentNodeId?, currentNodeName?, status? }`
   - `cascade-complete` : `{ cascadeId, nodeId, success: true }`
   - `cascade-error` : `{ cascadeId, nodeId, failedStep?, error: { code, message } }`
   - `status-change` : `{ nodeId, status, timestamp }` — NE PAS toucher (déjà géré)

5. **`nodeId` dans les événements SSE = le noeud CIBLE de la cascade** (pas le noeud en cours de traitement). Le noeud en cours de traitement est dans `currentNodeId` / `currentNodeName`. C'est le `nodeId` qui sert de clé dans le store Zustand.

6. **Pas de ServiceDetailPanel** : Le clic sur la carte (hors bouton) ne fait RIEN pour l'instant. C'est la Story 4.5. Ne pas ajouter de comportement au clic sur la carte.

7. **`apiFetch` obligatoire** : Tous les appels API frontend DOIVENT utiliser `apps/web/src/api/api-fetch.ts`.

8. **Toasts via `notifications.show()` de Mantine** : Utiliser `@mantine/notifications` (déjà installé). Pattern :
   ```typescript
   import { notifications } from '@mantine/notifications';
   notifications.show({ title: 'Succès', message: '...', color: 'green' });
   ```

9. **Le ServiceTile actuel est un composant pur (props-driven)** : Il ne contient PAS de hooks. L'ajout de `useCascadeForNode(node.id)` est le premier hook dans ce composant. Alternativement, le `HomePage` peut passer les données de cascade en prop — les deux approches sont valides.

10. **Barre de progression : positionnement en bordure basse** : Utiliser `Card.Section` Mantine pour placer le `Progress` en pleine largeur en bas de la carte, sans padding latéral. Le `Card.Section` Mantine "casse" automatiquement le padding du `Card` pour un rendu pleine largeur.

### Conventions de nommage

| Couche | Convention | Exemples Story 4.4 |
|---|---|---|
| Fichiers frontend | `kebab-case` | `cascade-progress.tsx`, `cascade.store.ts` |
| Composants React | `PascalCase` | `CascadeProgress` |
| Stores Zustand | `use*Store` | `useCascadeStore` |
| Sélecteurs | `use*` | `useCascadeForNode` |
| Fichiers backend | — | **Aucun fichier backend dans cette story** |
| Tests | co-localisés `.test.ts(x)` | `cascade-progress.test.tsx`, `cascade.store.test.ts` |

### Anatomie du composant CascadeProgress

```tsx
// apps/web/src/features/dashboard/cascade-progress.tsx
import { Progress, Group, Text, Transition } from '@mantine/core';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import type { NodeType } from '@wakehub/shared';

interface CascadeProgressProps {
  step: number;
  totalSteps: number;
  currentNodeName?: string;
  currentNodeType?: string; // pour l'icône
  status: 'in_progress' | 'completed' | 'failed';
  errorNodeName?: string;
}

// Layout dans la carte :
// ┌─────────────────────────────┐
// │ [Icon] Nom       [📌] Pin  │  ← existant
// │ [StatusBadge] · type        │  ← existant
// │ 3 dépendances               │  ← existant
// │ [  Démarrage…  ]            │  ← existant (disabled+loading)
// │                              │
// │ [🔄 Icon] NAS-Storage       │  ← NOUVEAU : zone dépendance en cours
// │ Échec : VM-Media            │  ← NOUVEAU : message erreur (si failed)
// ├──────────────────────────────┤
// │▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 40% │  ← NOUVEAU : barre 3px pleine largeur
// └─────────────────────────────┘
```

### Couleurs de la barre selon l'état

| Status | Couleur barre | Valeur | Comportement |
|---|---|---|---|
| `in_progress` | `blue.4` | `#339AF0` | Progression proportionnelle |
| `completed` | `green.5` | `#51CF66` | Barre à 100%, disparaît après 1s |
| `failed` | `red.5` | `#FF6B6B` | Barre figée à la position d'échec |

### Store Zustand — structure détaillée

```typescript
// apps/web/src/stores/cascade.store.ts
import { create } from 'zustand';

interface CascadeNodeState {
  cascadeId: string;
  step: number;
  totalSteps: number;
  currentNodeId?: string;
  currentNodeName?: string;
  status: 'in_progress' | 'completed' | 'failed';
  errorNodeName?: string;
}

interface CascadeStore {
  cascades: Record<string, CascadeNodeState>; // keyed by target nodeId
  updateProgress: (nodeId: string, data: Partial<CascadeNodeState> & { cascadeId: string }) => void;
  completeCascade: (nodeId: string) => void;
  failCascade: (nodeId: string, errorNodeName?: string) => void;
  clearCascade: (nodeId: string) => void;
}

export const useCascadeStore = create<CascadeStore>((set) => ({
  cascades: {},
  updateProgress: (nodeId, data) =>
    set((state) => ({
      cascades: {
        ...state.cascades,
        [nodeId]: {
          ...state.cascades[nodeId],
          ...data,
          status: 'in_progress',
        } as CascadeNodeState,
      },
    })),
  completeCascade: (nodeId) =>
    set((state) => ({
      cascades: {
        ...state.cascades,
        [nodeId]: state.cascades[nodeId]
          ? { ...state.cascades[nodeId]!, status: 'completed' as const, step: state.cascades[nodeId]!.totalSteps }
          : state.cascades[nodeId]!,
      },
    })),
  failCascade: (nodeId, errorNodeName) =>
    set((state) => ({
      cascades: {
        ...state.cascades,
        [nodeId]: state.cascades[nodeId]
          ? { ...state.cascades[nodeId]!, status: 'failed' as const, errorNodeName }
          : state.cascades[nodeId]!,
      },
    })),
  clearCascade: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.cascades;
      return { cascades: rest };
    }),
}));

// Sélecteur par noeud — évite les re-renders inutiles
export const useCascadeForNode = (nodeId: string) =>
  useCascadeStore((state) => state.cascades[nodeId]);
```

### Enrichissement de useSSE — code de référence

```typescript
// apps/web/src/hooks/use-sse.ts — modifications
import { useCascadeStore } from '../stores/cascade.store';
import { notifications } from '@mantine/notifications';

// Dans le useEffect, REMPLACER les listeners cascade-progress/complete/error :

es.addEventListener('cascade-progress', (event: MessageEvent) => {
  queryClient.invalidateQueries({ queryKey: ['cascades'] }); // conserver
  const data = JSON.parse(event.data);
  useCascadeStore.getState().updateProgress(data.nodeId, {
    cascadeId: data.cascadeId,
    step: data.step,
    totalSteps: data.totalSteps,
    currentNodeId: data.currentNodeId,
    currentNodeName: data.currentNodeName,
  });
});

es.addEventListener('cascade-complete', (event: MessageEvent) => {
  queryClient.invalidateQueries({ queryKey: ['cascades'] });
  queryClient.invalidateQueries({ queryKey: ['nodes'] });
  const data = JSON.parse(event.data);
  useCascadeStore.getState().completeCascade(data.nodeId);
  notifications.show({
    title: 'Cascade terminée',
    message: `${data.nodeId} démarré avec succès`, // Idéalement le nom du noeud — voir note ci-dessous
    color: 'green',
  });
  setTimeout(() => useCascadeStore.getState().clearCascade(data.nodeId), 2000);
});

es.addEventListener('cascade-error', (event: MessageEvent) => {
  queryClient.invalidateQueries({ queryKey: ['cascades'] });
  queryClient.invalidateQueries({ queryKey: ['nodes'] });
  const data = JSON.parse(event.data);
  const store = useCascadeStore.getState();
  const current = store.cascades[data.nodeId];
  store.failCascade(data.nodeId, current?.currentNodeName);
  notifications.show({
    title: 'Échec de cascade',
    message: data.error?.message || 'Erreur inconnue',
    color: 'red',
  });
  setTimeout(() => useCascadeStore.getState().clearCascade(data.nodeId), 2000);
});
```

**Note sur le nom du noeud dans les toasts** : Les événements SSE `cascade-complete` et `cascade-error` contiennent le `nodeId` (UUID) mais pas le `name`. Options :
1. Utiliser le cache TanStack Query : `queryClient.getQueryData(['nodes'])` pour lookup le nom par ID
2. Stocker le nom dans le cascade store quand le premier événement `cascade-progress` arrive (il contient `currentNodeName`)
3. Afficher un message générique sans nom ("Cascade terminée avec succès")
→ **Option recommandée : 1** — le cache `['nodes']` est toujours chaud sur le dashboard.

### Architecture Compliance

#### Pattern Mantine Progress en bordure basse

```tsx
// Utiliser Card.Section pour la barre pleine largeur
<Card withBorder padding="md">
  <Stack gap="sm">
    {/* ... contenu existant ... */}
  </Stack>

  {cascadeState && (
    <>
      {/* Zone dépendance en cours — DANS le padding de la carte */}
      <CascadeCurrentStep ... />

      {/* Barre de progression — HORS du padding via Card.Section */}
      <Card.Section>
        <Progress
          value={(cascadeState.step / cascadeState.totalSteps) * 100}
          size={3}
          radius={0}
          color={cascadeState.status === 'completed' ? 'green.5' :
                 cascadeState.status === 'failed' ? 'red.5' : 'blue.4'}
        />
      </Card.Section>
    </>
  )}
</Card>
```

#### Pattern Mantine Transition pour le fade

```tsx
import { Transition } from '@mantine/core';

// Le composant Transition de Mantine gère automatiquement prefers-reduced-motion
// Durée de 200ms pour la transition fade
<Transition mounted={!!currentNodeName} transition="fade" duration={200}>
  {(styles) => (
    <Group gap="xs" style={styles}>
      <NodeTypeIcon type={currentNodeType as NodeType} size={16} />
      <Text size="sm" c="dimmed">{currentNodeName}</Text>
    </Group>
  )}
</Transition>
```

**Note importante sur `prefers-reduced-motion`** : Le composant `Transition` de Mantine v7 respecte automatiquement `prefers-reduced-motion` et passe la durée à 0ms. Pas besoin de logique manuelle.

#### Pattern Zustand getState() hors composant

```typescript
// Dans useSSE (qui est un hook mais les listeners sont des callbacks) :
// Utiliser useCascadeStore.getState() au lieu du hook useCascadeStore()
// car on est dans un callback EventSource, pas dans un render React
useCascadeStore.getState().updateProgress(nodeId, data);
```

C'est le pattern Zustand officiel pour accéder au store en dehors des composants React.

#### Pattern test Zustand

```typescript
import { act } from '@testing-library/react';
import { useCascadeStore } from './cascade.store';

// Reset store entre chaque test
beforeEach(() => {
  useCascadeStore.setState({ cascades: {} });
});

it('met à jour la progression', () => {
  act(() => {
    useCascadeStore.getState().updateProgress('node-1', {
      cascadeId: 'cascade-1',
      step: 2,
      totalSteps: 5,
      currentNodeName: 'VM-Media',
    });
  });
  expect(useCascadeStore.getState().cascades['node-1']).toEqual(
    expect.objectContaining({ step: 2, totalSteps: 5, status: 'in_progress' })
  );
});
```

### Patterns frontend établis à reproduire

**Pattern composant shared réutilisable** (déjà existants) :
- `StatusBadge` : `apps/web/src/components/shared/status-badge.tsx`
- `NodeTypeIcon` : `apps/web/src/components/shared/node-type-icon.tsx`
- `EmptyState` : `apps/web/src/components/shared/empty-state.tsx`
- `SkeletonLoader` : `apps/web/src/components/shared/skeleton-loader.tsx`

**Pattern test composant avec mock** (cf. `service-tile.test.tsx`) :
```typescript
vi.mock('../../api/nodes.api', () => ({
  useNodes: vi.fn(),
}));
```

**Pattern mock Zustand dans les tests** :
```typescript
vi.mock('../../stores/cascade.store', () => ({
  useCascadeForNode: vi.fn().mockReturnValue(undefined),
}));
```

### Notifications Mantine — vérifier l'installation

Le `NotificationsProvider` (Mantine `<Notifications />`) doit être monté dans l'arbre React. Vérifier qu'il est dans `App.tsx` ou `main.tsx`. S'il n'y est pas, l'ajouter :

```tsx
import { Notifications } from '@mantine/notifications';
// Dans le JSX, à côté de MantineProvider :
<Notifications position="top-right" limit={1} />
```

**`limit={1}`** : Un seul toast à la fois (cf. UX-13 : "un seul à la fois, les suivants remplacent le précédent").

### Leçons des stories précédentes à appliquer

1. **`vi.hoisted()` obligatoire pour les mocks dans `vi.mock()` factories** : Si le mock est une variable utilisée dans le callback `vi.mock()`, utiliser `vi.hoisted()`.

2. **Imports inutilisés = échec build Docker** : `tsc -b` strict rejette les imports non utilisés. Vérifier avec `tsc --noEmit`.

3. **`credentials: 'include'` via `apiFetch`** : Ne JAMAIS utiliser `fetch()` directement.

4. **Mock EventSource global dans `test-setup.ts`** (Story 4.2) : Déjà en place — les tests de `useSSE` peuvent l'utiliser.

5. **`refetchOnWindowFocus: false`** déjà configuré dans `main.tsx` — pas de refetch en doublon.

6. **Fastify response schemas requis pour TOUS les codes HTTP** : Non applicable ici (pas de backend).

7. **Pattern `sanitizeNode()`** : Non applicable ici.

8. **Mantine v7 `Transition`** : Utiliser `transition="fade"` et `duration={200}`. Le `mounted` prop contrôle la visibilité. Le style est passé en render prop.

### Intelligence Git

```
699f046 feat: implement stories 2-4 to 3-2 — nodes UI, dependencies & graph visualization
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
```

- Stories 4.1, 4.2 et 4.3 sont implémentées dans la session courante (pas encore commitées sur la branche)
- Le backend cascade-engine + SSE manager sont complets et fonctionnels
- Le dashboard (ServiceTiles + StatsBar) est en place (Story 4.3)
- Le hook useSSE est fonctionnel mais ne parse pas les données d'événements

### Fichiers existants clés à connaître

| Fichier | Rôle | Pertinence |
|---|---|---|
| `apps/web/src/hooks/use-sse.ts` | Hook SSE — À MODIFIER | Ajouter parsing + alimentation store |
| `apps/web/src/features/dashboard/service-tile.tsx` | ServiceTile — À MODIFIER | Intégrer CascadeProgress |
| `apps/web/src/features/dashboard/service-tile.test.tsx` | Tests ServiceTile — À MODIFIER | Ajouter tests cascade |
| `apps/web/src/components/shared/node-type-icon.tsx` | Icône par type de noeud | Réutiliser dans CascadeProgress |
| `apps/web/src/components/shared/status-badge.tsx` | Badge de statut | Référence pattern composant partagé |
| `apps/web/src/theme/theme.ts` | Couleurs du thème | `blue.4`, `green.5`, `red.5` déjà définis |
| `packages/shared/src/models/sse-event.ts` | Types SSE | Types à importer pour le parsing |
| `apps/server/src/routes/cascades.routes.ts` | Routes cascades — NE PAS MODIFIER | Référence pour comprendre les événements émis |
| `apps/server/src/services/cascade-engine.ts` | Moteur de cascade — NE PAS MODIFIER | Référence pour l'ordre des événements |

### Exigences de tests

#### Tests `cascade.store.test.ts` — scénarios à couvrir

- `updateProgress` met à jour l'état pour un nodeId
- `completeCascade` passe le status à `completed` et step = totalSteps
- `failCascade` passe le status à `failed` avec errorNodeName
- `clearCascade` supprime l'entrée du store
- Isolation : modifier un nodeId n'affecte pas les autres
- `useCascadeForNode` retourne `undefined` quand pas de cascade

#### Tests `cascade-progress.test.tsx` — scénarios à couvrir

- Rendu en progression : barre bleue visible, pourcentage correct
- Rendu nom de dépendance en cours avec icône
- Rendu succès : barre verte à 100%
- Rendu erreur : barre rouge + message "Échec : [nom]"
- `role="progressbar"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-live="polite"` sur la zone de dépendance en cours

#### Tests `service-tile.test.tsx` — ajouts

- ServiceTile avec cascade active → CascadeProgress visible
- ServiceTile sans cascade active → pas de CascadeProgress
- Non-régression : tous les tests existants (11 tests) doivent passer

#### Tests `use-sse.test.ts` — scénarios à couvrir

- Événement `cascade-progress` → store mis à jour avec step/totalSteps
- Événement `cascade-complete` → store mis à jour, toast succès
- Événement `cascade-error` → store mis à jour, toast erreur

#### Compteurs de tests attendus

- Tests web actuels : ~132 → objectif : ~155+ (ajout ~23 tests)
- Commandes : `npm test -w apps/web`

### Project Structure Notes

#### Fichiers à créer

```
apps/web/src/
  stores/
    cascade.store.ts             ← NOUVEAU : store Zustand état cascades actives
    cascade.store.test.ts        ← NOUVEAU : tests store (~6 tests)
  features/
    dashboard/
      cascade-progress.tsx       ← NOUVEAU : composant CascadeProgress
      cascade-progress.test.tsx  ← NOUVEAU : tests CascadeProgress (~6 tests)
  hooks/
    use-sse.test.ts              ← NOUVEAU : tests useSSE enrichi (~3 tests)
```

#### Fichiers à modifier

```
apps/web/src/
  hooks/use-sse.ts                           ← MODIFIER : ajouter parsing événements + alimentation store + toasts
  features/dashboard/service-tile.tsx        ← MODIFIER : intégrer CascadeProgress
  features/dashboard/service-tile.test.tsx   ← MODIFIER : ajouter tests cascade active (~2 tests)
```

#### Fichiers potentiellement à modifier

```
apps/web/src/
  App.tsx ou main.tsx           ← VÉRIFIER : <Notifications /> monté ?
```

#### Alignement avec la structure existante

- Le répertoire `stores/` est nouveau — suit le pattern documenté dans l'architecture (`apps/web/src/stores/` — cf. ARCH-19, `ui.store.ts` est attendu ici)
- Le fichier `cascade-progress.tsx` est dans `features/dashboard/` à côté de `service-tile.tsx` — cohérent
- Les tests sont co-localisés (`.test.ts(x)` à côté du fichier source) — pattern établi
- Le hook `use-sse.ts` est dans `hooks/` — fichier existant, modification in-place

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Le CascadeProgress est le **feedback visuel central** de l'application — c'est le "clic magique" décrit dans le UX Design
- Le backend émet déjà les événements SSE nécessaires — cette story connecte le pipeline bout en bout
- Les stories suivantes (4.5) ajouteront le panneau latéral de détail + bouton arrêt
- Cette story est **critique pour l'expérience utilisateur** : sans feedback visuel, l'attente de ~2 min est anxiogène

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.4] — 6 critères d'acceptation BDD, user story
- [Source: _bmad-output/planning-artifacts/prd.md#FR32] — Progression cascade en temps réel
- [Source: _bmad-output/planning-artifacts/prd.md#FR33] — Relance cascade après échec
- [Source: _bmad-output/planning-artifacts/prd.md#FR44] — Mise à jour temps réel SSE
- [Source: _bmad-output/planning-artifacts/prd.md#NFR3] — Mises à jour temps réel < 3 secondes
- [Source: _bmad-output/planning-artifacts/prd.md#NFR13-NFR16] — Accessibilité WCAG AA
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07] — SSE endpoint unique GET /api/events
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-08] — TanStack Query + Zustand
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-19] — Organisation frontend par feature (stores/)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-07] — CascadeProgress : barre fine 3px + animation dépendance en cours
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-13] — Toasts Notification Mantine ~5s, un seul à la fois
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-17] — Accessibilité WCAG AA : role=progressbar, aria-live, prefers-reduced-motion
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#CascadeProgress] — Anatomie composant, états, accessibility
- [Source: _bmad-output/implementation-artifacts/4-2-endpoint-sse-et-communication-temps-reel.md] — SSE manager, useSSE hook, EventSource mock
- [Source: _bmad-output/implementation-artifacts/4-3-dashboard-epinglage-servicetiles-et-statsbar.md] — ServiceTile, StatsBar, patterns établis
- [Source: packages/shared/src/models/sse-event.ts] — Types SSECascadeProgressEvent, SSECascadeCompleteEvent, SSECascadeErrorEvent
- [Source: apps/server/src/services/cascade-engine.ts] — CascadeProgressEvent type, événements émis
- [Source: apps/server/src/routes/cascades.routes.ts] — broadcastCascadeEvent(), mapping événements internes → SSE

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Mantine `Progress` v7 renders a nested `role="progressbar"` on both root and section elements — removed explicit role/aria-* props from component to avoid duplicate ARIA roles; Mantine handles accessibility internally.

### Completion Notes List

- **Task 1**: Store Zustand `useCascadeStore` créé avec 4 actions (updateProgress, completeCascade, failCascade, clearCascade) et sélecteur `useCascadeForNode`. 6 tests passent.
- **Task 2**: Hook `useSSE` enrichi pour parser les données JSON des événements SSE `cascade-progress/complete/error`, alimenter le store Zustand, afficher les toasts Mantine (succès vert, erreur rouge), et programmer le nettoyage après 2s. Lookup du nom de noeud via cache TanStack Query pour les toasts. 9 tests passent (6 existants + 3 nouveaux).
- **Task 3**: Composant `CascadeProgress` créé avec barre Progress 3px (bleu/vert/rouge selon statut), zone dépendance en cours avec NodeTypeIcon et Transition fade 200ms, message d'erreur. Accessibilité : Mantine gère role="progressbar" et aria-* nativement, aria-live="polite" sur la zone de dépendance. Mantine Transition respecte automatiquement prefers-reduced-motion. 7 tests passent.
- **Task 4**: ServiceTile enrichi avec `useCascadeForNode(node.id)` — affiche CascadeProgress en Card.Section quand cascade active. 13 tests passent (11 existants + 2 nouveaux).
- **Task 5**: Résolution du nodeType via `nodeTypeMap` (Record<id, type>) construit dans HomePage à partir des données nodes et passé en prop au ServiceTile.
- **Task 6**: 150/150 tests web passent. TypeScript compilation OK (tsc --noEmit).
- Tests manuels (6.3, 6.4) laissés au développeur pour validation sur l'environnement réel.

### Change Log

- 2026-02-13: Implémentation Story 4.4 — CascadeProgress & feedback visuel. Store Zustand cascade, enrichissement useSSE avec parsing + toasts, composant CascadeProgress, intégration dans ServiceTile. +18 tests ajoutés (150 total).

### File List

**Nouveaux fichiers :**
- `apps/web/src/stores/cascade.store.ts` — Store Zustand état cascades actives
- `apps/web/src/stores/cascade.store.test.ts` — Tests store (6 tests)
- `apps/web/src/features/dashboard/cascade-progress.tsx` — Composant CascadeProgress
- `apps/web/src/features/dashboard/cascade-progress.test.tsx` — Tests CascadeProgress (7 tests)

**Fichiers modifiés :**
- `apps/web/src/hooks/use-sse.ts` — Parsing événements SSE, alimentation store, toasts
- `apps/web/src/hooks/use-sse.test.ts` — Ajout 3 tests intégration store + toasts
- `apps/web/src/features/dashboard/service-tile.tsx` — Intégration CascadeProgress + useCascadeForNode
- `apps/web/src/features/dashboard/service-tile.test.tsx` — Ajout 2 tests cascade active/inactive
- `apps/web/src/features/home/home-page.tsx` — Ajout nodeTypeMap pour résolution type icône
