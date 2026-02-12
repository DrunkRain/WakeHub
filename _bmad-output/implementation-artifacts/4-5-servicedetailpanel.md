# Story 4.5 : ServiceDetailPanel

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want voir le detail complet d'un service avec ses dependances et historique recent,
so that je peux comprendre son etat et agir depuis un seul endroit.

## Acceptance Criteria (BDD)

1. **Given** je clique sur un ServiceTile (hors bouton d'action)
   **When** le clic est enregistre
   **Then** le ServiceDetailPanel s'ouvre (Mantine Drawer) a droite
   **And** sur desktop (>=992px) : le Drawer fait 380px et la grille passe a 2 colonnes
   **And** sur mobile (<768px) : le Drawer s'ouvre en plein ecran

2. **Given** le ServiceDetailPanel est ouvert
   **When** je consulte l'en-tete
   **Then** il affiche : nom du service, badge de statut, bouton fermer (ActionIcon X)

3. **Given** le ServiceDetailPanel est ouvert
   **When** l'onglet "Dependances" est actif (par defaut)
   **Then** la chaine de dependances complete est affichee en liste verticale
   **And** chaque maillon affiche : nom, type de plateforme et badge de statut individuel
   **And** les statuts se mettent a jour en temps reel (via invalidation SSE)

4. **Given** le ServiceDetailPanel est ouvert
   **When** je clique sur l'onglet "Activite"
   **Then** un tableau des dernieres cascades liees a ce service s'affiche
   **And** les colonnes sont : horodatage, type (demarrage/arret), resultat (reussi/echoue/en cours)
   **And** les cascades sont filtrees automatiquement pour ce service

5. **Given** le ServiceDetailPanel est ouvert
   **When** je consulte la zone Actions (fixee en bas du panneau)
   **Then** les boutons disponibles dependent de l'etat du service :
   - Eteint → "Demarrer"
   - Actif → "Ouvrir" (si serviceUrl) + "Arreter" (desactive — story 4-6)
   - Erreur → "Reessayer"
   - En demarrage / En arret → boutons desactives (loading)

6. **Given** le ServiceDetailPanel est ouvert
   **When** je clique sur le bouton X, ou en dehors du Drawer, ou sur la touche Escape
   **Then** le panneau se ferme
   **And** la grille revient a 3 colonnes sur desktop

7. **Given** un seul Drawer peut etre ouvert a la fois
   **When** je clique sur un autre ServiceTile alors qu'un panneau est deja ouvert
   **Then** le panneau se met a jour avec les informations du nouveau service (pas de fermeture/reouverture)

8. **Given** le ServiceDetailPanel est ouvert
   **When** l'accessibilite est verifiee
   **Then** le Drawer a `aria-label="Detail du service [nom]"`
   **And** les onglets Tabs sont navigables au clavier (fleches gauche/droite)
   **And** le focus est trappe dans le panneau (focus lock — natif Mantine Drawer)
   **And** le bouton fermer est premier dans l'ordre de tabulation

## Tasks / Subtasks

- [x] Task 1 — Endpoint historique cascades backend (AC: #4)
  - [x] 1.1 Ajouter `GET /api/cascades/history?resourceId=X` dans `cascades.routes.ts` — retourne les cascades filtrees par `resourceId`, tri `startedAt` DESC, limite 20
  - [x] 1.2 Schema de reponse Fastify pour le nouveau endpoint (200, 400, 401)
  - [x] 1.3 Tests backend pour le nouvel endpoint (filtrage, tri, limite, cas vide)

- [x] Task 2 — Hook frontend historique cascades (AC: #4)
  - [x] 2.1 Ajouter `useCascadeHistory(resourceId)` dans `cascades.api.ts` — `queryKey: ['cascade', 'history', resourceId]`, `enabled: !!resourceId`
  - [x] 2.2 Type `CascadeHistoryItem` — reutilise `CascadesListResponse` existant (pas de reformattage necessaire)

- [x] Task 3 — Composant ServiceDetailPanel (AC: #1, #2, #3, #4, #5, #6, #8)
  - [x] 3.1 Creer `apps/web/src/features/dashboard/service-detail-panel.tsx`
  - [x] 3.2 Mantine `Drawer` — `position="right"`, `size` responsive (380 desktop, 100% mobile)
  - [x] 3.3 En-tete : nom du service + badge statut + ActionIcon fermer (X), `aria-label="Detail du service [nom]"`
  - [x] 3.4 Mantine `Tabs` avec 2 onglets : "Dependances" (defaut) + "Activite"
  - [x] 3.5 Onglet Dependances : `useDependencyChain('resource', resourceId)` → liste verticale chaque maillon (nom, type, badge statut)
  - [x] 3.6 Onglet Activite : `useCascadeHistory(resourceId)` → `Table` Mantine (horodatage, type, resultat)
  - [x] 3.7 Zone Actions fixee en bas : boutons contextuels selon `deriveVisualStatus()` (Demarrer / Ouvrir / Reessayer / loading)
  - [x] 3.8 Bouton "Arreter" present mais `disabled` avec tooltip "Story 4-6" (pas encore implemente)
  - [x] 3.9 Creer `service-detail-panel.module.css` si styles specifiques necessaires

- [x] Task 4 — Integration dans DashboardPage et ServiceTile (AC: #1, #6, #7)
  - [x] 4.1 Ajouter `selectedResourceId` state (useState) dans `dashboard-page.tsx`
  - [x] 4.2 Ajouter `onTileClick` prop a `ServiceTileProps` (ResourceTileProps seulement)
  - [x] 4.3 Dans `ServiceTile` : ajouter `onClick` sur le `<Card>` qui appelle `onTileClick` — exclure les clics sur les boutons d'action (stopPropagation)
  - [x] 4.4 Dans `DashboardPage` : rendre `<ServiceDetailPanel>` avec les props necessaires
  - [x] 4.5 Adapter la grille `SimpleGrid` : `cols={{ base: 1, sm: 2, md: selectedResourceId ? 2 : 3 }}`
  - [x] 4.6 Switch de service sans fermeture/reouverture : mettre a jour `selectedResourceId` directement

- [x] Task 5 — Tests (AC: #1-#8)
  - [x] 5.1 Tests unitaires ServiceDetailPanel : rendu drawer, en-tete, onglets, actions par etat
  - [x] 5.2 Tests onglet Dependances : affichage de la chaine, badges statut
  - [x] 5.3 Tests onglet Activite : affichage tableau cascade, colonnes
  - [x] 5.4 Tests integration : clic tile ouvre drawer, switch de service, fermeture (onTileClick + stopPropagation)
  - [x] 5.5 Tests accessibilite : aria-label drawer, onglets navigables
  - [x] 5.6 Verifier que tous les tests existants passent toujours

- [x] Task 6 — Build et verification finale
  - [x] 6.1 `tsc --noEmit` frontend + backend
  - [x] 6.2 Tous les tests backend passent (251)
  - [x] 6.3 Tous les tests frontend passent (98)

## Dev Notes

### Vue d'ensemble

Cette story ajoute le **panneau de detail lateral** qui s'ouvre au clic sur un ServiceTile. C'est la transition entre "voir l'etat d'un service" (dashboard) et "comprendre et agir sur un service" (detail). Le panneau utilise un Drawer Mantine avec deux onglets (Dependances + Activite) et une zone d'actions fixee en bas.

**Points critiques :**
- Le panneau est un Drawer (overlay), PAS une nouvelle page — pas de changement de route
- Les donnees se mettent a jour en temps reel via SSE (invalidation cache TanStack Query)
- Le bouton "Arreter" est present mais desactive (story 4-6 l'activera)
- Zustand n'est PAS installe — utiliser `useState` dans DashboardPage pour l'etat du drawer

### Etat actuel du code (Intelligence stories 4-3 et 4-4)

**DashboardPage (`apps/web/src/features/dashboard/dashboard-page.tsx`) :**
- Grille `SimpleGrid` avec `cols={{ base: 1, sm: 2, md: 3 }}`
- `useActiveCascades()` avec polling 3000ms → `cascadeByResource` Map
- `useDependencyGraph()` pour calculer `dependencySummary` par resource
- Passe `activeCascade`, `dependencySummary`, `onStart` a chaque `ServiceTile`
- Etats modaux existants : `wizardOpened`, `pinModalOpened` (pattern a suivre pour le drawer)

**ServiceTile (`apps/web/src/features/dashboard/service-tile.tsx`) :**
- Discriminated union : `ResourceTileProps | MachineTileProps`
- `deriveVisualStatus(resource, activeCascade)` retourne `VisualStatus`
- `resourceStatusConfig` mappe VisualStatus → { label, color }
- **IMPORTANT** : Pas de `onClick` sur le Card actuellement — il faut l'ajouter
- Les boutons d'action (Demarrer, Ouvrir, Reessayer) sont deja dans le composant — il faut `stopPropagation` pour ne pas declencher l'ouverture du drawer
- `CascadeProgress` est integre dans `ResourceTile` (story 4-4)
- `useCascadeProgress(resourceId)` lit les donnees SSE depuis le cache

**Hooks et API disponibles :**
- `useDependencyChain(nodeType, nodeId)` dans `dependencies.api.ts` — retourne `{ upstream: DependencyChainNode[], downstream: DependencyChainNode[] }` — **exactement ce qu'il faut pour l'onglet Dependances**
- `useStartCascade()` dans `cascades.api.ts` — mutation POST /api/cascades/start
- `useStopCascade()` dans `cascades.api.ts` — mutation POST /api/cascades/stop (pour story 4-6)
- `useAllResources()` dans `resources.api.ts` — pour lookup des infos resource

**Types partages (`packages/shared/src/index.ts`) :**
```typescript
interface DependencyChainNode {
  nodeType: DependencyNodeType; // 'machine' | 'resource'
  nodeId: string;
  name: string;
  status: string;
}

interface CascadeRecord {
  id: string;
  resourceId: string;
  type: 'start' | 'stop';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  failedStep: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
```

**Schema backend `cascades` :**
```
id, resource_id, type (start|stop), status (pending|in_progress|completed|failed),
current_step, total_steps, failed_step, error_code, error_message,
started_at (timestamp), completed_at (timestamp)
```

**SSE (`apps/web/src/hooks/use-sse.ts`) :**
- Invalide `['cascade']` sur cascade-progress/complete/error — le `useCascadeHistory` sera automatiquement rafraichi
- Invalide `['resources']` sur cascade-complete — les statuts des resources se mettent a jour
- Les toasts sont deja geres (story 4-4)

### Strategie d'implementation : onglet Activite (Logs)

**Situation :** Pas de backend de logging (Epic 6). La table `cascades` contient deja l'historique des operations de cascade par resource.

**Decision :** Utiliser l'historique des cascades comme source de donnees pour l'onglet "Activite". Quand Epic 6 ajoutera le logging complet, cet onglet sera enrichi.

**Endpoint a creer :**
```
GET /api/cascades/history?resourceId=<uuid>
Response: { data: CascadeRecord[] }  // tri startedAt DESC, limite 20
```

**Affichage tableau :**
| Horodatage | Type | Resultat |
|---|---|---|
| 11/02 14:30 | Demarrage | Reussi |
| 11/02 10:15 | Demarrage | Echoue — SSH_FAILED |
| 10/02 22:00 | Arret | Reussi |

### Composant ServiceDetailPanel — Specification

```typescript
interface ServiceDetailPanelProps {
  resourceId: string | null;  // null = ferme
  onClose: () => void;
  onStart: (resourceId: string) => void;
}
```

**Structure JSX :**
```
<Drawer opened={!!resourceId} onClose={onClose} position="right" size={...}>
  <Stack h="100%" justify="space-between">
    {/* En-tete */}
    <Group justify="space-between">
      <div>
        <Title order={4}>{resource.name}</Title>
        <Badge color={statusColor}>{statusLabel}</Badge>
      </div>
      <ActionIcon onClick={onClose} aria-label="Fermer">
        <IconX />
      </ActionIcon>
    </Group>

    {/* Onglets */}
    <Tabs defaultValue="dependencies" flex={1} style={{ overflow: 'auto' }}>
      <Tabs.List>
        <Tabs.Tab value="dependencies">Dependances</Tabs.Tab>
        <Tabs.Tab value="activity">Activite</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="dependencies">
        {/* useDependencyChain → liste verticale */}
      </Tabs.Panel>
      <Tabs.Panel value="activity">
        {/* useCascadeHistory → Table */}
      </Tabs.Panel>
    </Tabs>

    {/* Zone Actions fixee en bas */}
    <Group>
      {/* Boutons contextuels selon deriveVisualStatus */}
    </Group>
  </Stack>
</Drawer>
```

**Responsive :**
- Desktop (>=992px) : `size={380}`
- Mobile (<768px) : `size="100%"`
- Utiliser `useMediaQuery` de `@mantine/hooks` ou props responsives du Drawer
- **ATTENTION** : Mantine v7 `Drawer.size` n'accepte PAS les objets responsifs `{ base, md }`. Utiliser `useMediaQuery('(max-width: 768px)')` pour basculer entre 380 et '100%'.

**Onglet Dependances :**
- Hook : `useDependencyChain('resource', resourceId)` — retourne `{ data: { upstream, downstream } }`
- Afficher `upstream` en liste verticale (ce sont les dependances dont le service depend)
- Chaque item : `<Group>` avec `<Text>{name}</Text>` + `<Badge>{status}</Badge>` + `<Text size="xs">{nodeType}</Text>`
- Les statuts se mettent a jour via SSE → invalidation `['dependencies']` (deja present dans useSSE pour `status-change`)
- Si `upstream` est vide : message "Aucune dependance"

**Zone Actions :**
- Reutiliser `deriveVisualStatus()` depuis `service-tile.tsx` — l'exporter pour reutilisation
- **IMPORTANT** : Exporter `deriveVisualStatus` et `resourceStatusConfig` depuis `service-tile.tsx` pour les reutiliser dans `ServiceDetailPanel`
- Bouton "Arreter" : present quand `visualStatus === 'running'`, mais `disabled` avec tooltip (story 4-6)

### Interaction clic sur ServiceTile

**Probleme :** Le Card entier doit etre cliquable pour ouvrir le drawer, MAIS les boutons d'action (Demarrer, Ouvrir, Reessayer) ne doivent PAS declencher l'ouverture.

**Solution :**
1. Ajouter `onClick` sur `<Card>` dans ResourceTile : `onClick={() => onTileClick?.(resource.id)}`
2. Sur chaque `<Button>` d'action, ajouter `onClick={(e) => { e.stopPropagation(); onStart(resource.id); }}`
3. Sur le lien "Ouvrir" (`<a>`), le `stopPropagation` est aussi necessaire
4. Ajouter `cursor: pointer` au `.tile` CSS quand `onTileClick` est fourni
5. **MachineTile** : PAS de clic pour ouvrir le drawer (seules les resources ont un detail panel)

### Fichiers existants a modifier

| Fichier | Action |
|---------|--------|
| `apps/server/src/routes/cascades.routes.ts` | Ajouter GET /api/cascades/history?resourceId=X |
| `apps/server/src/routes/cascades.routes.test.ts` | Ajouter tests pour le nouvel endpoint |
| `apps/web/src/api/cascades.api.ts` | Ajouter `useCascadeHistory(resourceId)` |
| `apps/web/src/features/dashboard/service-tile.tsx` | Ajouter `onTileClick` prop + stopPropagation, exporter `deriveVisualStatus` et `resourceStatusConfig` |
| `apps/web/src/features/dashboard/service-tile.module.css` | Ajouter `cursor: pointer` sur `.tile` |
| `apps/web/src/features/dashboard/dashboard-page.tsx` | Ajouter state `selectedResourceId`, passer props, rendre `ServiceDetailPanel`, adapter grille |
| `apps/web/src/features/dashboard/service-tile.test.tsx` | Ajouter tests onTileClick + stopPropagation |

### Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `apps/web/src/features/dashboard/service-detail-panel.tsx` | Composant ServiceDetailPanel (Drawer + Tabs + Actions) |
| `apps/web/src/features/dashboard/service-detail-panel.test.tsx` | Tests unitaires ServiceDetailPanel |
| `apps/web/src/features/dashboard/service-detail-panel.module.css` | Styles (zone actions fixee, etc.) |

### Patterns du projet a respecter

- **API response** : `{ data: {...} }` succes, `{ error: { code, message } }` erreur
- **TanStack Query** : hooks dans `apps/web/src/api/`, queryKey descriptifs
- **Mantine v7** : Drawer, Tabs, Table, Badge, Button, ActionIcon — utiliser les props du theme
- **CSS modules** : fichiers `.module.css` co-localises
- **Tests frontend** : Vitest + @testing-library/react, fichiers co-localises, pattern `renderWithProviders`
- **Tests backend** : `app.inject()`, co-localises, base SQLite de test
- **Accessibilite** : WCAG AA, `aria-label` dynamique, focus lock natif Drawer
- **Fastify schemas** : Response schemas requis pour TOUS les status codes retournes (200, 400, 401)

### Code review 4-4 — Intelligence

- `sourceRef` supprime (code mort) — remplace par `timersRef` pour cleanup setTimeout
- `createElement()` utilise pour les icones toast dans fichier `.ts` (pas `.tsx`)
- Tests d'integration CascadeProgress ajoutes dans `service-tile.test.tsx` (3 tests avec pre-population cache)
- `renderWithProviders` accepte maintenant un `queryClient` optionnel — utile pour les tests avec cache pre-rempli
- Total : 77 tests frontend, 246 tests backend

### Mantine Drawer — Points d'attention

- `Drawer` a `position="right"` et `withCloseButton={false}` (on fait notre propre bouton X dans l'en-tete)
- `Drawer` fournit nativement le focus lock, le backdrop click to close, et la fermeture par Escape
- Le `size` doit etre gere manuellement avec `useMediaQuery` car les props responsives ne sont pas supportees pour size
- Le `Drawer` a son propre `Title` via la prop `title` — mais on preferera `withCloseButton={false}` et un en-tete custom pour plus de controle

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-08 ServiceDetailPanel]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend State Management]
- [Source: _bmad-output/planning-artifacts/architecture.md#SSE Integration Pattern]
- [Source: apps/web/src/features/dashboard/service-tile.tsx — composant actuel]
- [Source: apps/web/src/features/dashboard/dashboard-page.tsx — page dashboard actuelle]
- [Source: apps/web/src/api/dependencies.api.ts — useDependencyChain]
- [Source: apps/web/src/api/cascades.api.ts — hooks cascade]
- [Source: apps/server/src/routes/cascades.routes.ts — routes cascade backend]
- [Source: apps/server/src/db/schema.ts — table cascades]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A — no issues encountered

### Completion Notes List

- Backend: `GET /api/cascades/history?resourceId=X` with Drizzle `desc()` + `limit(20)`, 5 new tests
- Frontend hook: `useCascadeHistory(resourceId)` reuses existing `CascadesListResponse` type
- Component: ServiceDetailPanel with Drawer (right, 380px/100%), Tabs (Dependances + Activite), ActionsZone
- Exported `deriveVisualStatus`, `resourceStatusConfig`, `VisualStatus` from service-tile.tsx for reuse
- ServiceTile: added `onTileClick` prop with `stopPropagation` on all action buttons/links
- DashboardPage: `selectedResourceId` state, responsive grid `md: selectedResourceId ? 2 : 3`
- Responsive Drawer via `useMediaQuery('(max-width: 768px)')` — Mantine Drawer size doesn't accept responsive objects
- "Arreter" button present but disabled with Tooltip "Story 4-6"
- Tests: 17 new ServiceDetailPanel tests, 4 new ServiceTile onTileClick tests, 5 new backend cascade history tests

### File List

- `apps/server/src/routes/cascades.routes.ts` — added GET /api/cascades/history endpoint
- `apps/server/src/routes/cascades.routes.test.ts` — added 5 history endpoint tests
- `apps/web/src/api/cascades.api.ts` — added useCascadeHistory hook
- `apps/web/src/features/dashboard/service-tile.tsx` — exported deriveVisualStatus/resourceStatusConfig/VisualStatus, added onTileClick + stopPropagation
- `apps/web/src/features/dashboard/service-tile.test.tsx` — added 4 onTileClick/stopPropagation tests
- `apps/web/src/features/dashboard/service-detail-panel.tsx` — NEW: ServiceDetailPanel component
- `apps/web/src/features/dashboard/service-detail-panel.module.css` — NEW: panel styles
- `apps/web/src/features/dashboard/service-detail-panel.test.tsx` — NEW: 17 tests
- `apps/web/src/features/dashboard/dashboard-page.tsx` — added selectedResourceId state, ServiceDetailPanel, responsive grid
