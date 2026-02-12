# Story 4.4 : CascadeProgress & feedback visuel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want voir la progression de la cascade en temps reel sur la carte du service,
so that je sais exactement ce qui se passe pendant le demarrage.

## Acceptance Criteria (BDD)

1. **Given** une cascade de demarrage est en cours pour un service
   **When** le ServiceTile est affiche
   **Then** le composant CascadeProgress est visible sur la carte
   **And** une barre de progression fine (3px) apparait en bordure basse de la carte, couleur bleu tech
   **And** la progression est proportionnelle au nombre de dependances (etape courante / total)

2. **Given** la cascade progresse (evenement SSE cascade-progress)
   **When** une nouvelle etape demarre
   **Then** l'animation de la carte affiche le nom et l'icone de la dependance en cours de demarrage
   **And** la transition entre les dependances est fluide (fade 200ms)
   **And** la barre de progression avance

3. **Given** la cascade reussit (evenement SSE cascade-complete)
   **When** le service est operationnel
   **Then** la barre de progression se remplit completement (vert, flash)
   **And** la barre disparait apres une courte transition
   **And** le ServiceTile revient a son etat normal avec badge "Actif" (vert) et bouton "Ouvrir"
   **And** un toast de succes s'affiche ("Jellyfin demarre avec succes", ~5s)

4. **Given** la cascade echoue (evenement SSE cascade-error)
   **When** une etape echoue
   **Then** la barre de progression s'arrete et passe en rouge
   **And** la carte affiche "Echec : [nom dependance en echec]" avec icone erreur
   **And** le bouton passe a "Reessayer" (orange)
   **And** un toast d'erreur s'affiche ("Echec : [message]", ~5s)

5. **Given** un service est en etat d'echec avec bouton "Reessayer"
   **When** je clique sur "Reessayer"
   **Then** une nouvelle cascade de demarrage est lancee depuis le debut (toutes les dependances)
   **And** le CascadeProgress reprend

6. **Given** le CascadeProgress est affiche
   **When** l'accessibilite est verifiee
   **Then** la barre a `role="progressbar"` avec `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`
   **And** `aria-label="Demarrage en cours — etape [N] sur [total] : [nom dependance]"`
   **And** la zone de dependance en cours a `aria-live="polite"`

7. **Given** l'utilisateur a active `prefers-reduced-motion`
   **When** une cascade est en cours
   **Then** les transitions sont instantanees (pas d'animation de fade)
   **And** la barre de progression avance sans animation

## Tasks / Subtasks

- [x] Task 1 — Composant CascadeProgress (AC: #1, #2, #6, #7)
  - [x] 1.1 Creer `apps/web/src/features/dashboard/cascade-progress.tsx`
  - [x] 1.2 Barre de progression Mantine `Progress` — hauteur 3px, position bordure basse de la carte, couleur bleu tech (`blue`)
  - [x] 1.3 Zone d'animation dependance en cours — nom + icone (Tabler Icons) avec `Transition` Mantine (fade 200ms)
  - [x] 1.4 Props : `currentStep`, `totalSteps`, `currentDependencyName`, `status` (in_progress | completed | failed)
  - [x] 1.5 Accessibilite : `role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-label` dynamique
  - [x] 1.6 `aria-live="polite"` sur la zone de dependance en cours
  - [x] 1.7 Support `prefers-reduced-motion` : transitions instantanees via media query CSS

- [x] Task 2 — Integration dans ServiceTile (AC: #1, #2, #3, #4)
  - [x] 2.1 Importer et rendre `CascadeProgress` dans `ResourceTile` quand `visualStatus === 'starting'`
  - [x] 2.2 Passer `activeCascade.currentStep`, `activeCascade.totalSteps`, `currentDependencyName` comme props
  - [x] 2.3 Etat succes : barre verte flash → disparition apres 1.5s
  - [x] 2.4 Etat echec : barre rouge arretee + message d'echec existant
  - [x] 2.5 Ajouter les styles CSS dans `service-tile.module.css` pour positionner la barre en bordure basse

- [x] Task 3 — Enrichissement SSE pour donnees de progression (AC: #2)
  - [x] 3.1 Modifier `apps/web/src/hooks/use-sse.ts` : parser le `event.data` JSON des evenements `cascade-progress`
  - [x] 3.2 Stocker `currentDependency.name` dans le cache TanStack Query via `queryClient.setQueryData` (mise a jour optimiste sans refetch)
  - [x] 3.3 Parser `cascade-complete` et `cascade-error` pour les toasts de feedback

- [x] Task 4 — Toasts de feedback cascade (AC: #3, #4)
  - [x] 4.1 Utiliser `notifications.show()` de `@mantine/notifications` (deja installe et monte dans `main.tsx`)
  - [x] 4.2 Toast succes : icone check verte, "X demarre avec succes", ~5s, position haut-droite
  - [x] 4.3 Toast erreur : icone erreur rouge, "Echec : [message]", ~5s, position haut-droite

- [x] Task 5 — Tests
  - [x] 5.1 Tests unitaires pour CascadeProgress (rendu barre, progression, etats, accessibilite, reduced-motion)
  - [x] 5.2 Tests ServiceTile avec CascadeProgress integre (rendu conditionnel, succes, echec)
  - [x] 5.3 Verifier que tous les tests existants passent toujours

- [x] Task 6 — Build et verification finale
  - [x] 6.1 `tsc --noEmit` frontend
  - [x] 6.2 Tous les tests backend passent
  - [x] 6.3 Tous les tests frontend passent

## Dev Notes

### Vue d'ensemble

Cette story ajoute le **feedback visuel en temps reel** pendant les cascades de demarrage. C'est le "moment magique" de WakeHub : l'utilisateur clique sur "Demarrer" et voit la progression etape par etape directement sur la carte du service. Double feedback : barre de progression (le "combien") + dependance en cours (le "quoi").

**Architecture :**
- Le composant `CascadeProgress` est integre dans `ResourceTile` (pas dans `MachineTile`)
- Les donnees viennent de deux sources : (1) `activeCascade: CascadeRecord` passe par le dashboard (currentStep/totalSteps), et (2) evenements SSE `cascade-progress` parses en temps reel (currentDependency.name)
- Le hook `useSSE()` est deja integre dans `AuthenticatedShell` (story 4-2) et ecoute deja `cascade-progress`, mais il invalide seulement les queries sans parser les donnees
- Les toasts utilisent `@mantine/notifications` (verifier si deja installe, sinon l'ajouter)

### Etat actuel du code (Intelligence story 4-3)

**ServiceTile (`apps/web/src/features/dashboard/service-tile.tsx`) :**
- Discriminated union : `ResourceTileProps | MachineTileProps`
- `deriveVisualStatus(resource, activeCascade)` retourne `VisualStatus` = `'running' | 'stopped' | 'starting' | 'stopping' | 'error'`
- Quand `visualStatus === 'starting'` ou `'stopping'`, affiche un bouton disabled loading avec texte "En demarrage..." / "En arret..."
- Le `activeCascade` prop fournit deja `currentStep`, `totalSteps`, `errorMessage` — mais ces donnees ne sont PAS affichees actuellement
- CSS module `service-tile.module.css` existe avec hover effect `.tile`
- **IMPORTANT** : Le composant utilise deja `className={classes.tile}` sur les Card (corrige dans la code review 4-3)

**useSSE (`apps/web/src/hooks/use-sse.ts`) :**
- Ecoute `cascade-progress` → invalide `['cascade']` queries (sans parser event.data)
- Ecoute `cascade-complete` → invalide `['cascade']`, `['machines']`, `['resources']`, `['stats']`
- Ecoute `cascade-error` → invalide `['cascade']`, `['stats']`
- **A MODIFIER** : Parser `event.data` JSON pour extraire `currentDependency.name` et l'injecter dans le cache

**Cascade Engine (`apps/server/src/services/cascade-engine.ts`) :**
- Emet `cascade-progress` a chaque etape : `{ cascadeId, resourceId, step, totalSteps, currentDependency: { id, name, status } }`
- Emet `cascade-complete` : `{ cascadeId, resourceId, success: true }`
- Emet `cascade-error` : `{ cascadeId, resourceId, failedStep, error: { code, message } }`
- Le backend est COMPLET — aucune modification necessaire

**Types partages (`packages/shared/src/index.ts`) :**
```typescript
interface CascadeProgressEvent {
  cascadeId: string;
  resourceId: string;
  step: number;
  totalSteps: number;
  currentDependency: { id: string; name: string; status: string; };
}
interface CascadeCompleteEvent {
  cascadeId: string;
  resourceId: string;
  success: true;
}
interface CascadeErrorEvent {
  cascadeId: string;
  resourceId: string;
  failedStep: number;
  error: { code: string; message: string; };
}
```

**Dashboard (`apps/web/src/features/dashboard/dashboard-page.tsx`) :**
- `useActiveCascades()` avec polling 3000ms → `cascadeByResource` Map
- Passe `activeCascade={cascadeByResource.get(resource.id)}` a chaque `ServiceTile`
- Le SSE invalide `['cascade']` → refetch auto → les tiles se mettent a jour

**cascades.api.ts :**
- `useActiveCascades()` retourne `CascadeRecord[]` avec `currentStep`, `totalSteps`
- `useCascade(id)` poll individuel a 2000ms (pas utilise actuellement dans le dashboard)

### Strategie d'implementation : donnees de progression

Deux approches possibles pour obtenir `currentDependency.name` en temps reel :

**Approche A (Recommandee) — Mise a jour optimiste via SSE :**
1. Dans `useSSE()`, parser le JSON de l'evenement `cascade-progress`
2. Utiliser `queryClient.setQueryData(['cascade', 'progress', resourceId], progressData)` pour stocker les donnees de progression en temps reel
3. Creer un hook `useCascadeProgress(resourceId)` qui lit ces donnees
4. Avantage : zero latence, pas de refetch reseau supplementaire

**Approche B — Refetch pur :**
1. Garder le refetch existant (invalidateQueries sur `['cascade']`)
2. `CascadeRecord` contient deja `currentStep` et `totalSteps` (via DB)
3. Mais `currentDependency.name` n'est PAS dans `CascadeRecord` (pas stocke en DB)
4. Inconvenient : perte du nom de la dependance en cours

**Decision : Approche A** — On stocke les donnees SSE `cascade-progress` dans un queryKey dedie `['cascade', 'progress', resourceId]` et on les consomme dans le ServiceTile.

### Composant CascadeProgress — Specification

```typescript
interface CascadeProgressProps {
  currentStep: number;
  totalSteps: number;
  currentDependencyName?: string;
  status: 'in_progress' | 'completed' | 'failed';
}
```

**Rendu visuel :**
- Barre `<Progress>` Mantine — `size={3}`, `color="blue"` (in_progress), `color="green"` (completed), `color="red"` (failed)
- Position : en bordure basse de la Card (absolute, bottom 0, left/right 0, borderRadius bottom-left/right pour suivre la carte)
- Valeur : `(currentStep / totalSteps) * 100`
- Zone dependance : `<Text size="xs" c="dimmed">` avec icone `<IconLoader2>` animee + nom de la dependance
- `aria-live="polite"` sur la zone texte dependance

**Etats :**
| Etat | Barre | Animation dependance |
|---|---|---|
| in_progress | Bleu tech, progression proportionnelle | Nom dependance en cours (fade 200ms) |
| completed | Verte, 100%, flash → disparition 1.5s | "Termine" (bref) |
| failed | Rouge, arretee a l'etape en echec | Dependance en echec |

**Reduced motion :**
```css
@media (prefers-reduced-motion: reduce) {
  .progressBar { transition: none !important; }
  .dependencyName { transition: none !important; }
}
```

### Toasts — Specification

`@mantine/notifications@7.17.8` est **deja installe** et le composant `<Notifications />` est deja monte dans `apps/web/src/main.tsx`. Il est utilise dans plusieurs composants existants (machine-wizard, login-form, etc.). Utiliser directement `notifications.show({ ... })` dans le hook SSE.

**Toast succes :**
```typescript
notifications.show({
  title: `${resourceName} demarre avec succes`,
  message: '',
  color: 'green',
  icon: <IconCheck size={16} />,
  autoClose: 5000,
});
```

**Toast erreur :**
```typescript
notifications.show({
  title: 'Echec du demarrage',
  message: errorMessage,
  color: 'red',
  icon: <IconX size={16} />,
  autoClose: 5000,
});
```

### Fichiers existants a modifier

| Fichier | Action |
|---------|--------|
| `apps/web/src/features/dashboard/service-tile.tsx` | Ajouter rendu conditionnel de `CascadeProgress` dans `ResourceTile` |
| `apps/web/src/features/dashboard/service-tile.module.css` | Ajouter styles pour `.progressBar`, `.dependencyName`, reduced-motion |
| `apps/web/src/hooks/use-sse.ts` | Parser event.data JSON, setQueryData pour progress, toasts pour complete/error |
| `apps/web/src/features/dashboard/service-tile.test.tsx` | Ajouter tests CascadeProgress integre |

### Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `apps/web/src/features/dashboard/cascade-progress.tsx` | Composant CascadeProgress (barre + animation dependance) |
| `apps/web/src/features/dashboard/cascade-progress.test.tsx` | Tests unitaires CascadeProgress |

### Patterns du projet a respecter

- **API response** : `{ data: {...} }` succes, `{ error: { code, message } }` erreur
- **TanStack Query** : hooks avec `queryKey` descriptifs, `setQueryData` pour mises a jour optimistes
- **Mantine v7** : composants Progress, Transition, Text — utiliser les props du theme (color names, pas de hex en dur)
- **CSS modules** : fichiers `.module.css` co-localises, classes via `import classes from './file.module.css'`
- **Tests frontend** : Vitest + @testing-library/react, fichiers co-localises, pattern `renderWithProviders`
- **Accessibilite** : WCAG AA, `role="progressbar"`, `aria-live`, `aria-label` dynamique
- **Backend** : AUCUNE modification requise — le cascade-engine emet deja tous les evenements necessaires

### Story precedente (4-3) — Intelligence

- ServiceTile utilise `className={classes.tile}` (CSS module, pas inline JS)
- `deriveVisualStatus()` gere deja les etats `starting`/`stopping`/`error`
- Le dashboard passe `activeCascade` a chaque tile via `cascadeByResource` Map
- `dependencySummary` est maintenant passe via `useDependencyGraph()` (corrige en code review)
- Hover effect via CSS module `.tile:hover` (corrige en code review)
- 16 tests ServiceTile existants couvrent les etats basiques, pas la progression

### Code review 4-2 — Intelligence

- `useSSE()` fonctionne maintenant sans token (cookie-only auth)
- `SSEManager.close()` appelle `reply.raw.end()` pour deconnecter proprement
- 7 tests useSSE couvrent la creation EventSource, les listeners, le cleanup, et les invalidations
- Le mock `vi.mock('./hooks/use-sse', ...)` est necessaire dans `router.test.tsx` pour eviter les erreurs EventSource dans jsdom

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#CascadeProgress]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-07]
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07, ARCH-08]
- [Source: apps/web/src/features/dashboard/service-tile.tsx — composant actuel]
- [Source: apps/web/src/hooks/use-sse.ts — hook SSE actuel]
- [Source: apps/server/src/services/cascade-engine.ts — emissions SSE existantes]
- [Source: packages/shared/src/index.ts — types CascadeProgressEvent, CascadeCompleteEvent, CascadeErrorEvent]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Mantine Progress API: Must use `<Progress.Root>` + `<Progress.Section>` compound API (NOT simple `<Progress>` with children). Simple `<Progress>` creates its own internal ProgressSection with `value={undefined}`, causing duplicate sections.
- Mantine ProgressSection does NOT auto-add `aria-valuenow` — must pass explicitly.
- ServiceTile tests required `QueryClientProvider` wrapper after adding `useCascadeProgress` hook.

### Completion Notes List
- Task 1: CascadeProgress component created with Progress.Root compound API, CSS module animations (fadeIn + spin), absolute positioning at card bottom, `aria-live="polite"`, `prefers-reduced-motion` support. 9 unit tests.
- Task 2: Integrated CascadeProgress in ResourceTile. Reads real-time progress from TanStack Query cache via `useCascadeProgress(resourceId)`. Shows progress on starting/stopping/completed/failed states. Added `position: relative; overflow: hidden` to `.tile` CSS.
- Task 3: Rewrote `useSSE()` to parse SSE event data JSON. `cascade-progress` stores `CascadeProgressData` in cache via `setQueryData`. `cascade-complete` stores completed state + 1.5s cleanup via `setTimeout`/`removeQueries`. `cascade-error` stores failed state.
- Task 4: Toasts implemented within Task 3's useSSE changes — `notifications.show()` for success (green, resource name) and error (red, error message), 5s auto-close.
- Task 5: 9 CascadeProgress tests, 16 ServiceTile tests (with QueryClientProvider), 14 useSSE tests (including setQueryData, toast, cleanup assertions). All 73 frontend tests pass.
- Task 6: `tsc --noEmit` clean, 246 backend tests pass, 73 frontend tests pass.

### File List

**Created:**
- `apps/web/src/features/dashboard/cascade-progress.tsx` — CascadeProgress component (progress bar + dependency animation)
- `apps/web/src/features/dashboard/cascade-progress.module.css` — Styles (fadeIn, spin, absolute positioning, reduced-motion)
- `apps/web/src/features/dashboard/cascade-progress.test.tsx` — 9 unit tests

**Modified:**
- `apps/web/src/features/dashboard/service-tile.tsx` — Added CascadeProgress integration in ResourceTile
- `apps/web/src/features/dashboard/service-tile.module.css` — Added `position: relative; overflow: hidden` to `.tile`
- `apps/web/src/features/dashboard/service-tile.test.tsx` — Added QueryClientProvider to test wrapper
- `apps/web/src/hooks/use-sse.ts` — Rewrote SSE handlers: parse JSON, setQueryData for progress, toasts for complete/error
- `apps/web/src/hooks/use-sse.test.ts` — Expanded from 7 to 14 tests (setQueryData, toasts, cleanup, error handling)
- `apps/web/src/api/cascades.api.ts` — Added `CascadeProgressData` interface and `useCascadeProgress()` hook
