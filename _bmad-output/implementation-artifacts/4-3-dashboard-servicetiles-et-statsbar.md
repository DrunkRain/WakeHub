# Story 4.3 : Dashboard — ServiceTiles & StatsBar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want voir le dashboard avec tous mes services et leur statut en temps reel,
so that je peux demarrer un service en un clic et voir l'etat de mon homelab.

## Acceptance Criteria (BDD)

1. **Given** je navigue vers la page Dashboard
   **When** des services (resources avec service_url) sont configures
   **Then** un bandeau StatsBar affiche 4 tuiles en haut : services actifs (compte), cascades du jour (compte), temps moyen de cascade, economie d'energie estimee (heures d'inactivite)
   **And** chaque tuile utilise un composant Mantine Paper avec icone, valeur et label

2. **Given** le StatsBar est affiche
   **When** les donnees changent (via SSE)
   **Then** les chiffres se mettent a jour en temps reel sans rechargement

3. **Given** le dashboard est affiche sur desktop (>=992px)
   **When** des services sont configures
   **Then** une grille de ServiceTiles s'affiche en 3 colonnes sous le StatsBar
   **And** le gap entre les cartes est de 24px (lg)

4. **Given** le dashboard est affiche sur tablette (768-991px)
   **When** des services sont configures
   **Then** la grille passe a 2 colonnes

5. **Given** le dashboard est affiche sur mobile (<768px)
   **When** des services sont configures
   **Then** la grille passe a 1 colonne
   **And** le StatsBar s'affiche en grille 2x2

6. **Given** un ServiceTile est affiche
   **When** je le consulte
   **Then** il affiche : icone du service, nom (H3), badge de statut colore (Actif vert, Eteint gris, En demarrage jaune, Erreur rouge, En arret orange), type de plateforme (texte secondaire), resume de la chaine de dependances (une ligne)

7. **Given** un service est eteint
   **When** son ServiceTile est affiche
   **Then** le bouton contextuel affiche "Demarrer" (bleu tech)

8. **Given** je clique sur le bouton "Demarrer" d'un ServiceTile
   **When** le clic est enregistre
   **Then** la cascade de demarrage est lancee immediatement (pas de confirmation)
   **And** le bouton passe en etat loading (desactive)
   **And** le badge passe a "En demarrage" (jaune)

9. **Given** un service est actif
   **When** son ServiceTile est affiche
   **Then** le bouton contextuel affiche "Ouvrir" (bleu tech)
   **And** le clic sur "Ouvrir" ouvre l'URL du service dans un nouvel onglet

10. **Given** un service est en erreur (cascade echouee)
    **When** son ServiceTile est affiche
    **Then** le bouton contextuel affiche "Reessayer" (orange)
    **And** un message court d'erreur est affiche sur la carte ("Echec : [nom dependance]")

11. **Given** je survole un ServiceTile avec la souris
    **When** le hover est detecte
    **Then** la carte s'eleve legerement (shadow + translate Y -2px)

12. **Given** aucun service n'est configure
    **When** le dashboard est affiche
    **Then** un message d'etat vide s'affiche ("Ajoutez votre premiere machine") avec un bouton vers le wizard d'ajout

13. **Given** les ServiceTiles sont affiches
    **When** je navigue au clavier
    **Then** `role="article"` avec `aria-label="Service [nom] — [statut]"` est present sur chaque carte
    **And** le bouton d'action a un `aria-label` explicite ("Demarrer Jellyfin", "Ouvrir Nextcloud")

## Tasks / Subtasks

- [x] Task 1 — API cascade frontend (AC: #8, #10)
  - [x] 1.1 Creer `apps/web/src/api/cascades.api.ts` avec `useStartCascade()` et `useStopCascade()` (mutations TanStack Query)
  - [x] 1.2 Ajouter `useCascade(id)` pour polling du statut d'une cascade
  - [x] 1.3 Ajouter un endpoint backend `GET /api/stats` qui retourne : services actifs, cascades du jour, temps moyen cascade, heures d'inactivite

- [x] Task 2 — Composant StatsBar (AC: #1, #2, #5)
  - [x] 2.1 Creer `apps/web/src/features/dashboard/stats-bar.tsx`
  - [x] 2.2 4 tuiles Mantine Paper : icone (Tabler), valeur, label
  - [x] 2.3 Layout responsive : 4 colonnes desktop, 2x2 mobile (<768px) via SimpleGrid
  - [x] 2.4 Alimenter via `useQuery` sur `GET /api/stats` (auto-invalide par SSE)

- [x] Task 3 — Composant ServiceTile (AC: #6, #7, #9, #10, #11, #13)
  - [x] 3.1 Creer `apps/web/src/features/dashboard/service-tile.tsx`
  - [x] 3.2 Mantine Card avec : nom, badge statut colore, plateforme, resume dependances (1 ligne)
  - [x] 3.3 Bouton contextuel : "Demarrer" (stopped), "Ouvrir" (running + serviceUrl), "Reessayer" (error)
  - [x] 3.4 Hover effect (shadow + translateY -2px) via CSS transition
  - [x] 3.5 Accessibilite : role="article", aria-label sur la carte et le bouton

- [x] Task 4 — Page Dashboard complete (AC: #3, #4, #5, #8, #12)
  - [x] 4.1 Refactorer `apps/web/src/features/dashboard/dashboard-page.tsx`
  - [x] 4.2 Integrer StatsBar en haut
  - [x] 4.3 Grille ServiceTiles via SimpleGrid (cols: 3 desktop / 2 tablette / 1 mobile)
  - [x] 4.4 Filtrer les resources : afficher seulement celles avec `serviceUrl` (les "services")
  - [x] 4.5 EmptyState existant quand aucun service n'est configure
  - [x] 4.6 Bouton "Demarrer" → `POST /api/cascades/start` avec `resourceId`, gerer le loading state

- [x] Task 5 — Tests
  - [x] 5.1 Tests unitaires pour StatsBar (rendu, responsive)
  - [x] 5.2 Tests unitaires pour ServiceTile (rendu, bouton contextuel, accessibilite)
  - [x] 5.3 Verifier que tous les tests existants passent toujours

- [x] Task 6 — Build et verification finale
  - [x] 6.1 `tsc --noEmit` frontend
  - [x] 6.2 Tous les tests backend passent
  - [x] 6.3 Tous les tests frontend passent

## Dev Notes

### Vue d'ensemble

Cette story construit la **page principale du dashboard** — l'ecran que l'utilisateur voit en premier apres connexion. C'est le coeur de l'experience WakeHub : voir tous ses services, leur statut, et demarrer en un clic.

**Architecture :**
- Les "services" sont des `Resource` (type vm/container) qui ont un `serviceUrl` non-null
- Le StatsBar affiche des metriques aggregees calculees cote serveur
- Les ServiceTiles sont alimentes par `useAllResources()` + filtrage frontend
- Le SSE (story 4-2) invalide automatiquement les caches TanStack Query → les tuiles se mettent a jour en temps reel
- Le bouton "Demarrer" appelle `POST /api/cascades/start` (story 4-1), le cascade-engine fait le reste

### Couleurs de statut (UX-02)

| Statut | Couleur | Badge text | Mantine color |
|--------|---------|------------|---------------|
| running | Vert #51CF66 | Actif | green |
| stopped | Gris #868E96 | Eteint | gray |
| starting (cascade in_progress type=start) | Jaune #FCC419 | En demarrage | yellow |
| error (cascade failed) | Rouge #FF6B6B | Erreur | red |
| stopping (cascade in_progress type=stop) | Orange #FF922B | En arret | orange |

Note : `starting` et `stopping` ne sont pas des statuts DB — ils sont derives du fait qu'une cascade est en cours pour cette resource. Le composant doit croiser `resource.status` avec les cascades actives.

### Endpoint GET /api/stats (nouveau)

Cet endpoint retourne les metriques du StatsBar. Implementation serveur :

```typescript
// GET /api/stats → { data: { activeServices, cascadesToday, avgCascadeTime, inactivityHours } }
// - activeServices: COUNT resources WHERE status = 'running' AND service_url IS NOT NULL
// - cascadesToday: COUNT cascades WHERE started_at >= debut du jour
// - avgCascadeTime: AVG(completed_at - started_at) en secondes pour cascades completed aujourd'hui
// - inactivityHours: SUM des heures ou les services sont restes eteints (simplifie: nombre de services * heures depuis dernier arret)
```

Pour la v1, `inactivityHours` peut etre simplifie a 0 ou calcule basiquement — cette metrique sera enrichie dans l'Epic 5.

### Fichiers existants a modifier/utiliser

| Fichier | Action |
|---------|--------|
| `apps/web/src/features/dashboard/dashboard-page.tsx` | Refactorer — remplacer le placeholder |
| `apps/web/src/api/resources.api.ts` | Utiliser `useAllResources()` existant |
| `apps/web/src/api/machines.api.ts` | Utiliser `useMachines()` pour le fallback EmptyState |
| `apps/web/src/components/shared/empty-state.tsx` | Reutiliser tel quel |
| `apps/web/src/hooks/use-sse.ts` | Deja integre dans AuthGuard — pas de changement |
| `apps/web/src/theme/theme.ts` | Utiliser les couleurs existantes |
| `packages/shared/src/index.ts` | Types `Resource`, `Machine`, `CascadeRecord` existants |

### Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `apps/web/src/features/dashboard/stats-bar.tsx` | Composant StatsBar (4 tuiles) |
| `apps/web/src/features/dashboard/service-tile.tsx` | Composant ServiceTile (carte service) |
| `apps/web/src/api/cascades.api.ts` | Hooks TanStack Query pour les cascades |
| `apps/server/src/routes/stats.routes.ts` | Route GET /api/stats |
| `apps/server/src/routes/stats.routes.test.ts` | Tests route stats |

### Patterns du projet a respecter

- **API response** : `{ data: {...} }` succes, `{ error: { code, message } }` erreur
- **TanStack Query** : hooks avec `queryKey` descriptifs, mutations avec `onSuccess` invalidation
- **Mantine v7** : composants Paper, Card, Badge, Button, SimpleGrid, Group, Stack, Text
- **Tests frontend** : Vitest + @testing-library/react, fichiers co-localises
- **Tests backend** : Vitest, `app.inject()`, DB test SQLite separee
- **Fastify schemas** : Response schemas requis pour TOUS les status codes retournes

### Story precedente (4-2) — Intelligence

- SSE fonctionne : `useSSE()` est integre dans `AuthGuard` via `AuthenticatedShell`
- Les caches `['machines']`, `['resources']`, `['cascade']` sont auto-invalides par SSE
- Le hook utilise `getAuthToken()` pour le query param du EventSource
- `reply.hijack()` + `reply.raw.write(':ok\n\n')` necessaire pour flush SSE dans Fastify

### Decision CascadeProgress

La story 4-4 (CascadeProgress) est **separee** de cette story. Dans la 4-3, le ServiceTile affiche simplement le badge "En demarrage" (jaune) quand une cascade est en cours. La barre de progression fine (3px) et l'animation sont dans la 4-4.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07, ARCH-08]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-05, UX-06]
- [Source: apps/web/src/theme/theme.ts — couleurs semantiques]
- [Source: apps/web/src/features/dashboard/dashboard-page.tsx — placeholder actuel]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- All 237 backend tests pass
- All 43 frontend tests pass (12 new: 9 ServiceTile + 3 StatsBar)
- tsc --noEmit clean (frontend + backend)

### Completion Notes List
- Task 1: Created cascades.api.ts (useStartCascade, useStopCascade, useCascade, useActiveCascades, useStats), stats.routes.ts (GET /api/stats), added GET /api/cascades/active endpoint
- Task 2: Created stats-bar.tsx with 4 Paper tiles, responsive SimpleGrid (2 cols mobile, 4 cols desktop)
- Task 3: Created service-tile.tsx with Card, status badge colors, contextual buttons (Start/Open/Retry), hover effect, aria-label accessibility
- Task 4: Refactored dashboard-page.tsx with StatsBar, ServiceTile grid (1/2/3 cols), empty states, cascade start action
- Task 5: 5 backend tests (stats route), 3 StatsBar tests, 9 ServiceTile tests
- Task 6: Build verification clean
- SSE cache invalidation extended to include ['stats'] query key
- inactivityHours hardcoded to 0 for v1 (Epic 5 scope)

### File List
- `apps/web/src/api/cascades.api.ts` (created)
- `apps/web/src/features/dashboard/stats-bar.tsx` (created)
- `apps/web/src/features/dashboard/stats-bar.test.tsx` (created)
- `apps/web/src/features/dashboard/service-tile.tsx` (created)
- `apps/web/src/features/dashboard/service-tile.test.tsx` (created)
- `apps/web/src/features/dashboard/dashboard-page.tsx` (modified)
- `apps/web/src/hooks/use-sse.ts` (modified — added stats invalidation)
- `apps/server/src/routes/stats.routes.ts` (created)
- `apps/server/src/routes/stats.routes.test.ts` (created)
- `apps/server/src/routes/cascades.routes.ts` (modified — added GET /api/cascades/active)
- `apps/server/src/app.ts` (modified — registered statsRoutes)
- `apps/web/src/features/dashboard/service-tile.module.css` (created — code review)
- `apps/web/src/api/dependencies.api.ts` (used — code review)

### Code Review Fixes
- G2: Replaced inline JS hover (onMouseEnter/onMouseLeave) with CSS module `:hover` pseudo-class
- G3: Added `useDependencyGraph()` in dashboard-page.tsx to compute and pass `dependencySummary` to resource ServiceTiles
- G1: Marked all tasks [x], updated status to done
