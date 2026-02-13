# Story 4.5: ServiceDetailPanel & arrêt manuel

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur homelab,
I want voir le détail complet d'un noeud dans un panneau latéral et pouvoir l'arrêter depuis le dashboard et la page détail,
so that je peux comprendre l'état de mes services et les contrôler (démarrage/arrêt) depuis n'importe quel écran.

## Acceptance Criteria

### AC1 : Ouverture du ServiceDetailPanel via clic sur ServiceTile
- Quand je clique sur un ServiceTile (hors bouton d'action et bouton pin), le `ServiceDetailPanel` s'ouvre à droite
- Sur desktop : Mantine `Drawer` de 380px
- Sur mobile : Drawer plein écran (fullscreen)
- Le Drawer utilise `position="right"` et `size={380}`

### AC2 : En-tête du panneau
- L'en-tête affiche : icône du type de noeud (`NodeTypeIcon`), nom du noeud, `StatusBadge` du statut
- Un bouton fermer (`ActionIcon` X) en haut à droite
- Un bouton éditer (`ActionIcon` crayon) qui navigue vers `/nodes/:id` (page détail/édition)

### AC3 : Onglet Dépendances (par défaut)
- L'onglet "Dépendances" est actif par défaut (Mantine `Tabs`)
- La chaîne de dépendances complète (upstream) est affichée en liste verticale
- Chaque maillon affiche : icône type (`NodeTypeIcon`), nom, type (texte), badge de statut individuel (`StatusBadge`)
- Les statuts sont mis à jour en temps réel via l'invalidation TanStack Query existante (SSE `status-change` → invalidation `['nodes']`)

### AC4 : Onglet Logs
- L'onglet "Logs" affiche les derniers événements liés à ce noeud
- Chaque entrée : horodatage, type d'événement, description
- **Note :** L'API logs n'est pas encore implémentée (Epic 6). Cet onglet affiche un `EmptyState` "Logs disponibles bientôt" avec un message informatif. Il sera connecté quand l'Epic 6 sera implémenté.

### AC5 : Zone d'actions fixée en bas du panneau
- Zone d'actions fixée en bas du Drawer (sticky bottom)
- Boutons contextuels selon le statut du noeud :
  - `offline` → "Démarrer" (bleu)
  - `online` → "Ouvrir" (bleu, si serviceUrl) + "Arrêter" (rouge)
  - `error` → "Réessayer" (orange)
  - `starting` / `stopping` → boutons désactivés avec loader
- "Ouvrir" ouvre `serviceUrl` dans un nouvel onglet
- "Démarrer" et "Réessayer" appellent `useStartCascade()` existant
- "Arrêter" ouvre d'abord la modal de confirmation (AC6)

### AC6 : Modal de confirmation d'arrêt
- Quand "Arrêter" est cliqué, une `Modal` Mantine s'affiche
- Le titre : "Arrêter [nom du noeud] ?"
- Le corps liste les enfants hébergés (downstream dependencies) qui seront affectés
- Bouton "Annuler" (gris) + Bouton "Confirmer l'arrêt" (rouge)
- Après confirmation : appel `useStopCascade(nodeId)`, le badge passe à "En arrêt" (orange), boutons désactivés

### AC7 : Comportement du panneau
- Le panneau se ferme avec : bouton X, clic en dehors du Drawer, touche Escape
- Si un autre ServiceTile est cliqué alors que le panneau est ouvert, le panneau met à jour son contenu (le `selectedNodeId` change, pas de fermeture/réouverture)
- Le `CascadeProgress` (Story 4.4) s'affiche dans le panneau quand une cascade est active pour le noeud sélectionné

### AC8 : Démarrage et arrêt depuis la page détail du noeud
- Sur la page détail du noeud (`/nodes/:id`), une zone d'actions cascade est ajoutée
- Boutons contextuels identiques à AC5 (Démarrer / Ouvrir + Arrêter / Réessayer / disabled si en cours)
- La modal de confirmation d'arrêt (AC6) est réutilisée
- Le `CascadeProgress` s'affiche quand une cascade est active pour ce noeud
- Les statuts se mettent à jour en temps réel via SSE

### AC9 : Accessibilité
- Le Drawer utilise `aria-label="Détail du service [nom]"` (dynamique)
- Focus trappé dans le panneau quand ouvert (Mantine Drawer le gère nativement)
- Les onglets sont navigables au clavier (flèches gauche/droite) — Mantine Tabs le gère nativement
- Le bouton fermer est en premier dans l'ordre de tabulation
- Les boutons d'action ont des `aria-label` descriptifs (ex: "Arrêter Mon Serveur")

## Tasks / Subtasks

- [x] Task 1 : Hook `useStopCascade` (AC: #6)
  - [x] 1.1 Ajouter `useStopCascade()` dans `apps/web/src/api/cascades.api.ts` — pattern identique à `useStartCascade()` mais POST vers `/api/cascades/stop`
  - [x] 1.2 Ajouter les tests dans `apps/web/src/api/cascades.api.test.ts` : appel POST correct, gestion erreur

- [x] Task 2 : Composant `ServiceDetailPanel` — structure et en-tête (AC: #1, #2, #7, #9)
  - [x] 2.1 Créer `apps/web/src/features/dashboard/service-detail-panel.tsx`
  - [x] 2.2 Props : `node: NodeResponse | null`, `opened: boolean`, `onClose: () => void`, `onStartCascade: (nodeId: string) => void`, `onStopCascade: (nodeId: string) => void`, `nodeTypeMap: Record<string, string>`
  - [x] 2.3 Utiliser Mantine `Drawer` avec `position="right"`, `size={380}`, `aria-label` dynamique
  - [x] 2.4 Implémenter l'en-tête : `NodeTypeIcon` + nom + `StatusBadge` + ActionIcon fermer (X) + ActionIcon éditer (crayon → navigate `/nodes/:id`)
  - [x] 2.5 Le panneau met à jour son contenu quand `node` change (pas de fermeture/réouverture)

- [x] Task 3 : Onglets Dépendances et Logs (AC: #3, #4)
  - [x] 3.1 Implémenter Mantine `Tabs` avec deux onglets : "Dépendances" (default) et "Logs"
  - [x] 3.2 Onglet Dépendances : appeler `useDependencies(nodeId)` pour récupérer les upstream, afficher en liste verticale avec `NodeTypeIcon` + nom + type + `StatusBadge`
  - [x] 3.3 Onglet Logs : afficher `EmptyState` "Logs disponibles bientôt" (API logs non implémentée, Epic 6)

- [x] Task 4 : Zone d'actions et modal d'arrêt (AC: #5, #6, #7)
  - [x] 4.1 Implémenter la zone d'actions fixée en bas du Drawer (sticky bottom via `style={{ position: 'sticky', bottom: 0 }}`)
  - [x] 4.2 Boutons contextuels selon statut : Démarrer (bleu) / Ouvrir (bleu) + Arrêter (rouge) / Réessayer (orange) / disabled (loading)
  - [x] 4.3 Intégrer `CascadeProgress` quand une cascade est active (via `useCascadeForNode`)
  - [x] 4.4 Créer le composant `StopConfirmModal` (ou inline dans ServiceDetailPanel) : titre, liste downstream deps, boutons Annuler/Confirmer
  - [x] 4.5 Après confirmation, appeler `onStopCascade(nodeId)`

- [x] Task 5 : Intégration dans ServiceTile et HomePage (AC: #1, #7)
  - [x] 5.1 Modifier `ServiceTile` : ajouter `onClick` sur le `Card` (sauf si le clic est sur un bouton ou ActionIcon)
  - [x] 5.2 Ajouter prop `onCardClick: (nodeId: string) => void` au `ServiceTileProps`
  - [x] 5.3 Modifier `HomePage` : état `selectedNodeId`, handler `setSelectedNodeId`, passer `onCardClick` au ServiceTile
  - [x] 5.4 Rendre `ServiceDetailPanel` dans `HomePage` avec le noeud sélectionné
  - [x] 5.5 Ajouter `useStopCascade()` dans `HomePage` et le passer au panneau

- [x] Task 6 : Démarrage/Arrêt depuis la page détail du noeud (AC: #8)
  - [x] 6.1 Modifier `apps/web/src/features/nodes/node-detail-page.tsx` : ajouter section "Contrôle d'alimentation" avec Card
  - [x] 6.2 Importer `useStartCascade`, `useStopCascade`, `useCascadeForNode`
  - [x] 6.3 Boutons contextuels identiques à AC5 (Démarrer / Ouvrir + Arrêter / Réessayer / disabled)
  - [x] 6.4 Réutiliser la modal de confirmation d'arrêt (même pattern que Task 4.4, ou extraire en composant partagé `StopConfirmModal`)
  - [x] 6.5 Afficher `CascadeProgress` quand cascade active

- [x] Task 7 : Tests composants (AC: #1-9)
  - [x] 7.1 Créer `apps/web/src/features/dashboard/service-detail-panel.test.tsx` : rendu drawer, en-tête, onglets, zone actions, modal arrêt, accessibilité (~10 tests)
  - [x] 7.2 Mettre à jour `apps/web/src/features/dashboard/service-tile.test.tsx` : test onCardClick, non-trigger sur boutons (~2 tests)
  - [x] 7.3 Mettre à jour `apps/web/src/features/home/home-page.test.tsx` : test ouverture panneau au clic sur ServiceTile (~2 tests)
  - [x] 7.4 Mettre à jour `apps/web/src/features/nodes/node-detail-page.test.tsx` : tests section contrôle alimentation, boutons start/stop, modal arrêt (~4 tests)

- [x] Task 8 : Validation et intégration (AC: #1-9)
  - [x] 8.1 Lancer `npm test -w apps/web` — tous les tests passent
  - [x] 8.2 Lancer `tsc --noEmit` dans `apps/web` — compilation TypeScript OK
  - [x] 8.3 Tester manuellement : clic ServiceTile → Drawer, onglets, actions, arrêt avec confirmation
  - [x] 8.4 Tester manuellement : démarrage/arrêt depuis la page détail du noeud
  - [x] 8.5 Tester l'accessibilité : aria-label drawer, focus trap, navigation clavier onglets

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage dans cette story |
|---|---|---|
| TypeScript | strict mode | Partout |
| React | 19 | ServiceDetailPanel, StopConfirmModal, modification HomePage et node-detail-page |
| Mantine | v7+ | Drawer, Tabs, Modal, ActionIcon, Group, Stack, Button, Text |
| Zustand | latest | `useCascadeForNode` (existant, réutilisé) |
| TanStack Query | v5 | `useDependencies`, `useStartCascade`, `useStopCascade` (nouveau) |
| Vitest | latest | Tests co-localisés |
| @testing-library/react | latest | Tests composants |

**Aucune nouvelle dépendance à installer.** Tous les packages sont déjà dans le projet.

### Contraintes architecturales critiques

1. **Le backend est COMPLET pour le stop cascade** : `POST /api/cascades/stop` est déjà implémenté dans `cascades.routes.ts` (lignes 198-264). Il crée un enregistrement cascade `type: 'stop'`, lance `executeCascadeStop()` en fire-and-forget, et broadcast les événements SSE. **NE PAS modifier le backend.**

2. **Le hook `useStopCascade()` est le seul ajout API** : Suivre exactement le pattern de `useStartCascade()` dans `cascades.api.ts`. POST vers `/api/cascades/stop` avec `{ nodeId }`.

3. **`apiFetch` obligatoire** : Tous les appels API DOIVENT utiliser `apps/web/src/api/api-fetch.ts`.

4. **Le Drawer Mantine gère automatiquement** :
   - Le focus trap (focus lock dans le panneau)
   - Le close sur Escape
   - Le close sur overlay click
   - L'animation d'ouverture/fermeture
   - Le `position="right"` pour le panneau à droite

5. **SSE et temps réel** : Le hook `useSSE` (Story 4.2/4.4) gère déjà l'invalidation des queries `['nodes']` sur les événements `status-change`, `cascade-complete`, `cascade-error`. Les statuts dans le Drawer se mettront à jour automatiquement via TanStack Query.

6. **`CascadeProgress` (Story 4.4)** est déjà fonctionnel. Le sélecteur `useCascadeForNode(nodeId)` fournit l'état de cascade. Réutiliser le composant `CascadeProgress` dans le Drawer et dans la page détail.

7. **Le ServiceTile est maintenant un composant avec hook** : Depuis la Story 4.4, il utilise `useCascadeForNode(node.id)`. L'ajout d'un `onCardClick` est compatible.

8. **Clic sur le Card vs. clic sur les boutons** : Il faut empêcher la propagation du clic quand l'utilisateur clique sur un bouton (Démarrer, Ouvrir, Pin). Solution : `onClick` sur le `Card` + `e.stopPropagation()` sur les boutons, OU vérifier `event.target` pour exclure les boutons.

9. **Pattern Drawer Mantine** :
   ```tsx
   import { Drawer } from '@mantine/core';

   <Drawer
     opened={opened}
     onClose={onClose}
     position="right"
     size={380}
     title={null} // Custom header
     withCloseButton={false} // Custom close button
     aria-label={`Détail du service ${node?.name}`}
   >
     {/* Content */}
   </Drawer>
   ```

10. **Modal de confirmation d'arrêt** : Utiliser Mantine `Modal` (pattern déjà établi dans `node-detail-page.tsx` pour la suppression). La modal liste les dépendances downstream du noeud (via `useDependencies(nodeId)` qui retourne `upstream` et `downstream`).

11. **Pas de ServiceDetailPanel route** : Le panneau est un Drawer overlay, pas une route. Le state `selectedNodeId` est dans `HomePage` (local state React, pas Zustand — simple useState suffisant).

12. **Page détail noeud** : La page `node-detail-page.tsx` est déjà longue (~700+ lignes). Ajouter une section "Contrôle d'alimentation" sous forme de `Card` avec titre + boutons. Réutiliser le même pattern de boutons contextuels que le Drawer.

### Conventions de nommage

| Couche | Convention | Exemples Story 4.5 |
|---|---|---|
| Fichiers frontend | `kebab-case` | `service-detail-panel.tsx`, `stop-confirm-modal.tsx` |
| Composants React | `PascalCase` | `ServiceDetailPanel`, `StopConfirmModal` |
| Hooks | `use*` | `useStopCascade` |
| Tests | co-localisés `.test.ts(x)` | `service-detail-panel.test.tsx` |

### Anatomie du ServiceDetailPanel

```tsx
// apps/web/src/features/dashboard/service-detail-panel.tsx
// Layout du Drawer :
// ┌─────────────────────────────────┐
// │ [Icon] Mon Serveur [●Actif]    │  ← En-tête custom
// │                        [✏️] [X] │  ← Éditer + Fermer
// ├─────────────────────────────────┤
// │ [Dépendances]  [Logs]          │  ← Onglets Mantine Tabs
// ├─────────────────────────────────┤
// │                                 │
// │  ↗ NAS-Storage  physical  ●Actif│  ← Upstream dep 1
// │  ↗ VM-Media     vm        ●Actif│  ← Upstream dep 2
// │  ↗ Proxmox-01   physical  ●Actif│  ← Upstream dep 3
// │                                 │
// │  [🔄 CascadeProgress]          │  ← Si cascade active
// │                                 │
// ├─────────────────────────────────┤
// │ [  Ouvrir  ] [  Arrêter  ]     │  ← Zone actions sticky
// └─────────────────────────────────┘
```

### Zone d'actions — logique des boutons

```typescript
function getPanelActions(status: string, serviceUrl: string | null) {
  switch (status) {
    case 'offline':
      return [{ label: 'Démarrer', color: 'blue', action: 'start' }];
    case 'online':
      const actions = [];
      if (serviceUrl) actions.push({ label: 'Ouvrir', color: 'blue', action: 'open' });
      actions.push({ label: 'Arrêter', color: 'red', action: 'stop' });
      return actions;
    case 'error':
      return [{ label: 'Réessayer', color: 'orange', action: 'start' }];
    case 'starting':
      return [{ label: 'Démarrage…', color: 'yellow', action: null, loading: true }];
    case 'stopping':
      return [{ label: 'Arrêt…', color: 'orange', action: null, loading: true }];
    default:
      return [];
  }
}
```

### Modal de confirmation d'arrêt — structure

```tsx
// Pattern identique au deleteModal de node-detail-page.tsx
<Modal opened={stopModalOpened} onClose={closeStopModal} title={`Arrêter ${node.name} ?`}>
  <Stack gap="md">
    <Text size="sm">
      Cette action va arrêter {node.name} et ses dépendances en cascade :
    </Text>
    {downstreamDeps.length > 0 && (
      <Stack gap="xs">
        {downstreamDeps.map(dep => (
          <Group key={dep.id} gap="xs">
            <NodeTypeIcon type={dep.type as NodeType} size={16} />
            <Text size="sm">{dep.name}</Text>
            <StatusBadge status={dep.status as NodeStatus} size="xs" />
          </Group>
        ))}
      </Stack>
    )}
    <Group justify="flex-end" mt="md">
      <Button variant="default" onClick={closeStopModal}>Annuler</Button>
      <Button color="red" onClick={handleConfirmStop} loading={stopCascade.isPending}>
        Confirmer l'arrêt
      </Button>
    </Group>
  </Stack>
</Modal>
```

### Enrichissement ServiceTile pour le clic

```tsx
// Solution recommandée : onClick sur le Card + stopPropagation sur les boutons
<Card
  withBorder
  padding="md"
  role="article"
  aria-label={`${node.name} — ${node.status}`}
  onClick={() => onCardClick?.(node.id)}  // AJOUT
  style={{ cursor: onCardClick ? 'pointer' : undefined }}  // AJOUT
>
  {/* ... */}
  <Button onClick={(e) => { e.stopPropagation(); actionButton.onClick(); }}>
    {/* ... */}
  </Button>
  {/* ... */}
  <ActionIcon onClick={(e) => { e.stopPropagation(); onTogglePin(node.id, !node.isPinned); }}>
    {/* ... */}
  </ActionIcon>
</Card>
```

### Page détail noeud — section Contrôle d'alimentation

```tsx
// Ajouter après la section "Dépendances fonctionnelles" dans node-detail-page.tsx
<Card withBorder>
  <Stack gap="md">
    <Title order={3}>Contrôle d'alimentation</Title>

    {cascadeState && (
      <CascadeProgress
        step={cascadeState.step}
        totalSteps={cascadeState.totalSteps}
        currentNodeName={cascadeState.currentNodeName}
        status={cascadeState.status}
        errorNodeName={cascadeState.errorNodeName}
      />
    )}

    <Group>
      {/* Boutons contextuels identiques à getPanelActions() */}
    </Group>
  </Stack>
</Card>
```

### Architecture Compliance

#### Pattern Mantine Drawer

```tsx
import { Drawer } from '@mantine/core';

// Drawer Mantine v7 — options clés :
// - position="right" : panneau à droite
// - size={380} : largeur 380px desktop
// - withCloseButton={false} : on gère notre propre bouton X
// - Mantine gère automatiquement :
//   - Focus trap
//   - Close on Escape
//   - Close on overlay click
//   - Animation slide-in/out
//   - Fullscreen sur mobile si size > viewport
```

#### Pattern Mantine Tabs

```tsx
import { Tabs } from '@mantine/core';

<Tabs defaultValue="dependencies">
  <Tabs.List>
    <Tabs.Tab value="dependencies">Dépendances</Tabs.Tab>
    <Tabs.Tab value="logs">Logs</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="dependencies">
    {/* Dependency chain list */}
  </Tabs.Panel>
  <Tabs.Panel value="logs">
    {/* Logs or EmptyState */}
  </Tabs.Panel>
</Tabs>
```

#### Pattern stopPropagation pour le clic

```typescript
// Le Card reçoit onClick pour ouvrir le Drawer
// Les boutons internes (Démarrer, Pin, etc.) doivent empêcher la propagation
// pour ne pas déclencher l'ouverture du Drawer
const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
  e.stopPropagation();
  callback();
};
```

### Leçons des stories précédentes à appliquer

1. **`vi.hoisted()` obligatoire pour les mocks dans `vi.mock()` factories** : Si le mock est une variable utilisée dans le callback `vi.mock()`, utiliser `vi.hoisted()`.

2. **Imports inutilisés = échec build Docker** : `tsc -b` strict rejette les imports non utilisés.

3. **Mantine `Progress` v7 rend deux `role="progressbar"`** (Story 4.4 debug) : Ne pas ajouter de `role="progressbar"` explicite quand on utilise `<Progress>` — Mantine le gère nativement.

4. **Mantine `Transition` respecte `prefers-reduced-motion` automatiquement** : Pas besoin de logique manuelle.

5. **Zustand `getState()` hors composant** : Pattern valide pour accéder au store dans des callbacks EventSource.

6. **Pattern test Zustand** : Reset store avec `useCascadeStore.setState({ cascades: {} })` dans `beforeEach`.

7. **Pattern test Mantine Drawer** : Le Drawer a besoin de `MantineProvider` dans le wrapper de test. Le contenu du Drawer n'est rendu que quand `opened={true}`.

8. **Toasts via `notifications.show()`** : Déjà configuré avec `<Notifications position="top-right" />` dans `main.tsx`.

9. **`confirmBeforeShutdown` flag** : Le schéma `nodes` contient un champ `confirmBeforeShutdown` (boolean, default true). Ce flag PEUT être utilisé pour décider si la modal de confirmation est affichée avant l'arrêt. À implémenter dans le code de la zone d'actions.

### Intelligence Git

```
699f046 feat: implement stories 2-4 to 3-2 — nodes UI, dependencies & graph visualization
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
```

- Stories 4.1 à 4.4 implémentées dans la session courante (pas encore commitées)
- Le backend cascade-engine + SSE manager sont complets (stop inclus)
- Le dashboard ServiceTiles + CascadeProgress est en place
- 150 tests web passent actuellement

### Fichiers existants clés à connaître

| Fichier | Rôle | Pertinence |
|---|---|---|
| `apps/web/src/api/cascades.api.ts` | Hook start cascade — À MODIFIER | Ajouter `useStopCascade` |
| `apps/web/src/api/cascades.api.test.ts` | Tests cascades API — À MODIFIER | Ajouter tests stop |
| `apps/web/src/features/dashboard/service-tile.tsx` | ServiceTile — À MODIFIER | Ajouter `onCardClick` + stopPropagation |
| `apps/web/src/features/dashboard/service-tile.test.tsx` | Tests ServiceTile — À MODIFIER | Ajouter tests clic carte |
| `apps/web/src/features/home/home-page.tsx` | Dashboard — À MODIFIER | État selectedNodeId, rendu Drawer, useStopCascade |
| `apps/web/src/features/home/home-page.test.tsx` | Tests HomePage — À MODIFIER | Tests ouverture panneau |
| `apps/web/src/features/nodes/node-detail-page.tsx` | Page détail noeud — À MODIFIER | Section contrôle alimentation |
| `apps/web/src/features/nodes/node-detail-page.test.tsx` | Tests détail noeud — À MODIFIER | Tests start/stop |
| `apps/web/src/stores/cascade.store.ts` | Store Zustand cascades | Réutiliser `useCascadeForNode` |
| `apps/web/src/features/dashboard/cascade-progress.tsx` | CascadeProgress | Réutiliser dans Drawer + page détail |
| `apps/web/src/hooks/use-sse.ts` | Hook SSE | Déjà complet — NE PAS modifier |
| `apps/web/src/api/dependencies.api.ts` | API dépendances | `useDependencies(nodeId)` pour l'onglet deps |
| `apps/web/src/components/shared/node-type-icon.tsx` | Icône type noeud | Réutiliser partout |
| `apps/web/src/components/shared/status-badge.tsx` | Badge statut | Réutiliser partout |
| `apps/web/src/components/shared/empty-state.tsx` | État vide | Réutiliser pour l'onglet Logs |
| `apps/server/src/routes/cascades.routes.ts` | Routes cascades — NE PAS MODIFIER | Référence pour l'API stop |

### Exigences de tests

#### Tests `cascades.api.test.ts` — ajouts
- `useStopCascade` : appel POST `/api/cascades/stop` avec `{ nodeId }`
- `useStopCascade` : throw on error response

#### Tests `service-detail-panel.test.tsx` — scénarios à couvrir (~10 tests)
- Drawer rendu quand `opened={true}` et node non null
- Drawer non rendu quand `opened={false}`
- En-tête avec nom, icône type, badge statut
- Onglet Dépendances actif par défaut
- Liste dépendances affichée avec noms et badges
- Onglet Logs avec EmptyState
- Bouton "Démarrer" pour noeud offline
- Boutons "Ouvrir" + "Arrêter" pour noeud online
- Modal confirmation s'affiche au clic sur "Arrêter"
- `aria-label` dynamique sur le Drawer

#### Tests `service-tile.test.tsx` — ajouts (~2 tests)
- Le clic sur la carte appelle `onCardClick`
- Le clic sur un bouton d'action NE déclenche PAS `onCardClick`

#### Tests `home-page.test.tsx` — ajouts (~2 tests)
- Le clic sur un ServiceTile ouvre le ServiceDetailPanel
- Le panneau affiche le bon noeud

#### Tests `node-detail-page.test.tsx` — ajouts (~4 tests)
- Section "Contrôle d'alimentation" visible
- Bouton "Démarrer" pour noeud offline
- Bouton "Arrêter" pour noeud online + modal confirmation
- CascadeProgress affiché quand cascade active

#### Compteurs de tests attendus
- Tests web actuels : 150 → objectif : ~170+ (ajout ~20 tests)
- Commande : `npm test -w apps/web`

### Project Structure Notes

#### Fichiers à créer

```
apps/web/src/
  features/
    dashboard/
      service-detail-panel.tsx       ← NOUVEAU : ServiceDetailPanel (Drawer)
      service-detail-panel.test.tsx  ← NOUVEAU : tests (~10 tests)
```

#### Fichiers à modifier

```
apps/web/src/
  api/cascades.api.ts                           ← MODIFIER : ajouter useStopCascade
  api/cascades.api.test.ts                      ← MODIFIER : ajouter tests stop
  features/dashboard/service-tile.tsx           ← MODIFIER : ajouter onCardClick + stopPropagation
  features/dashboard/service-tile.test.tsx      ← MODIFIER : tests clic carte (~2 tests)
  features/home/home-page.tsx                   ← MODIFIER : selectedNodeId, Drawer, useStopCascade
  features/home/home-page.test.tsx              ← MODIFIER : tests ouverture panneau (~2 tests)
  features/nodes/node-detail-page.tsx           ← MODIFIER : section contrôle alimentation
  features/nodes/node-detail-page.test.tsx      ← MODIFIER : tests start/stop (~4 tests)
```

#### Alignement avec la structure existante

- `service-detail-panel.tsx` dans `features/dashboard/` à côté de `service-tile.tsx` — conforme à l'architecture
- Le `StopConfirmModal` peut être inline dans `service-detail-panel.tsx` ou extrait comme composant partagé si réutilisé dans la page détail
- Pas de nouvelle route nécessaire — le Drawer est un overlay
- Le hook `useStopCascade` suit exactement le pattern `useStartCascade` existant

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Le ServiceDetailPanel est le **point central de consultation et d'action** — l'utilisateur y voit tout et peut agir
- L'ajout du contrôle depuis la page détail complète l'expérience — l'utilisateur peut démarrer/arrêter de n'importe où
- La Story 4.5 est la dernière story de l'Epic 4 qui ajoute des fonctionnalités utilisateur
- Le backend stop cascade est DÉJÀ complet — cette story est 100% frontend

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.5] — 9 critères BDD, user story
- [Source: _bmad-output/planning-artifacts/prd.md#FR18-FR28] — Contrôle d'alimentation, cascade start/stop
- [Source: _bmad-output/planning-artifacts/prd.md#FR20-FR22] — Arrêt manuel + cascade descendante + protection partagées
- [Source: _bmad-output/planning-artifacts/prd.md#FR35-FR39] — Dashboard & visualisation temps réel
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07] — SSE endpoint unique GET /api/events
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-08] — TanStack Query + Zustand
- [Source: _bmad-output/planning-artifacts/architecture.md#features/dashboard/] — service-detail-panel.tsx prévu dans la structure
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#ServiceDetailPanel] — Anatomie, states, variants desktop/mobile, accessibility
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Arret-manuel] — Flow arrêt : confirmation → cascade stop → SSE updates
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-13] — Toasts Notification Mantine ~5s, un seul à la fois
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-17] — Accessibilité WCAG AA
- [Source: _bmad-output/implementation-artifacts/4-3-dashboard-epinglage-servicetiles-et-statsbar.md] — ServiceTile patterns, action buttons
- [Source: _bmad-output/implementation-artifacts/4-4-cascadeprogress-et-feedback-visuel.md] — CascadeProgress, cascade store, useSSE enrichi
- [Source: apps/server/src/routes/cascades.routes.ts#L198-264] — POST /api/cascades/stop (backend complet)
- [Source: apps/web/src/api/cascades.api.ts] — Pattern useStartCascade à reproduire pour useStopCascade
- [Source: apps/web/src/api/dependencies.api.ts] — useDependencies(nodeId) pour l'onglet dépendances

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Mantine Drawer root does not use `role="dialog"` — use `.mantine-Drawer-root` CSS selector instead of `[role="dialog"]`
- Mantine Modal title can break text across elements in JSDOM — use `findByRole('button')` for confirm button instead of `getByText` for title

### Completion Notes List

- Task 1: `useStopCascade()` added to cascades.api.ts — identical pattern to useStartCascade, POST /api/cascades/stop. 4 API tests pass.
- Task 2-4: ServiceDetailPanel created as single component with Drawer, Tabs (Dependencies/Logs), action zone, and StopConfirmModal. 15 component tests pass.
- Task 5: ServiceTile updated with `onCardClick` prop + `stopPropagation` on buttons. HomePage updated with `selectedNodeId` state and ServiceDetailPanel rendering. 3 new ServiceTile tests + 1 new HomePage test pass.
- Task 6: node-detail-page.tsx updated with "Contrôle d'alimentation" section (cascade buttons + CascadeProgress + stop modal). 5 new tests pass.
- Task 7: All component tests written — 26 new tests across 4 test files.
- Task 8: 176/176 tests pass. tsc --noEmit clean.

### File List

**Created:**
- `apps/web/src/features/dashboard/service-detail-panel.tsx` — ServiceDetailPanel (Drawer + Tabs + actions + StopConfirmModal)
- `apps/web/src/features/dashboard/service-detail-panel.test.tsx` — 15 tests

**Modified:**
- `apps/web/src/api/cascades.api.ts` — Added `useStopCascade()` hook
- `apps/web/src/api/cascades.api.test.ts` — Added 2 tests for useStopCascade
- `apps/web/src/features/dashboard/service-tile.tsx` — Added `onCardClick` prop + stopPropagation on buttons
- `apps/web/src/features/dashboard/service-tile.test.tsx` — Added 3 tests for card click + non-propagation
- `apps/web/src/features/home/home-page.tsx` — Added selectedNodeId state, ServiceDetailPanel, useStopCascade
- `apps/web/src/features/home/home-page.test.tsx` — Added useStopCascade mock + 1 panel test
- `apps/web/src/features/nodes/node-detail-page.tsx` — Added power control section with cascade buttons + CascadeProgress + stop modal
- `apps/web/src/features/nodes/node-detail-page.test.tsx` — Added 5 tests for power control section

### Change Log

- 150 → 176 tests (26 new tests)
- Story test coverage: service-detail-panel (15), service-tile (+3), home-page (+1), node-detail-page (+5), cascades.api (+2)
