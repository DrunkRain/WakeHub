# Story 7.3 : Frontend — API Hooks + Components

Status: done

## Story

As a developpeur,
I want adapter tout le frontend (API hooks, pages, composants) au modele unifie "services",
so that l'UI utilise une seule API `/api/services` au lieu de `/api/machines` et `/api/resources`.

## Acceptance Criteria (BDD)

1. **Given** le frontend demarre
   **When** il importe des types depuis `@wakehub/shared`
   **Then** il utilise `Service` (pas `Machine` ni `Resource`)
   **And** `tsc --noEmit` passe sans erreur

2. **Given** l'utilisateur consulte le dashboard ou la liste
   **When** les hooks API sont appeles
   **Then** ils appellent `/api/services` (pas `/api/machines` ni `/api/resources`)
   **And** les query keys utilisent `['services']`

3. **Given** l'utilisateur lance un demarrage/arret en cascade
   **When** le hook API envoie la requete
   **Then** le payload utilise `serviceId` (pas `resourceId`)
   **And** l'historique est charge via `serviceId=`

4. **Given** l'utilisateur consulte les dependances
   **When** il cree ou visualise un lien
   **Then** `parentType` et `childType` sont `'service'` uniquement

5. **Given** l'utilisateur navigue via le menu lateral
   **When** il clique sur le lien infrastructure
   **Then** le label affiche "Services" (pas "Machines")
   **And** les routes sont `/services` et `/services/:id`

6. **Given** l'utilisateur utilise le wizard de creation
   **When** il cree un service avec decouverte
   **Then** le wizard appelle `/api/services` et `/api/services/:id/resources`

7. **Given** toutes les modifications sont appliquees
   **When** je lance `tsc --noEmit` dans apps/web
   **Then** zero erreur TypeScript

## Tasks / Subtasks

- [x] Task 1 -- Creer `services.api.ts` et adapter les hooks cascade/dependencies (AC: #2, #3, #4)
  - [x] 1.1 Creer `services.api.ts` fusionnant machines.api.ts + resources.api.ts, tous les hooks pointent vers `/api/services`
  - [x] 1.2 Adapter `cascades.api.ts` : `resourceId` → `serviceId`, query keys, invalidations `['services']`
  - [x] 1.3 Adapter `dependencies.api.ts` : nodeType est deja `'service'` dans les types, verifier les query key invalidations
  - [x] 1.4 Supprimer `machines.api.ts` et `resources.api.ts`

- [x] Task 2 -- Adapter les pages et composants machines → services (AC: #1, #5, #6)
  - [x] 2.1 Renommer/adapter `machines-page.tsx` → `services-page.tsx`, `machines-table.tsx` → `services-table.tsx`, `use-machines-table.ts` → `use-services-table.ts`, `machines-filters.tsx` → `services-filters.tsx`
  - [x] 2.2 Adapter `machine-wizard.tsx` → `service-wizard.tsx` : machineId → parentId, endpoints services
  - [x] 2.3 Fusionner `machine-detail-page.tsx` + `resource-detail-page.tsx` → `service-detail-page.tsx`
  - [x] 2.4 Adapter `dashboard-page.tsx` : fusionner queries machines+resources en une seule query services
  - [x] 2.5 Adapter `service-tile.tsx` : unifier ResourceTile/MachineTile en un seul composant Service
  - [x] 2.6 Adapter `service-detail-panel.tsx` : resourceId → serviceId

- [x] Task 3 -- Router, navigation et nettoyage (AC: #5, #7)
  - [x] 3.1 Adapter `router.tsx` : routes `/machines` → `/services`, supprimer `/resources/:id`
  - [x] 3.2 Adapter `navigation.tsx` : label "Machines" → "Services", lien `/services`
  - [x] 3.3 Adapter `dependency-graph.tsx` / `dependencies-page.tsx` : navigation vers `/services/:id`
  - [x] 3.4 Supprimer les anciens fichiers (machines-page, machines-table, etc.)
  - [x] 3.5 Lancer `tsc --noEmit` sur apps/web — zero erreur

## Dev Notes

### Vue d'ensemble

Cette story adapte **tout le frontend** au modele unifie `services`. C'est la story miroir de 7-2 pour le frontend. Environ 15 fichiers a modifier, 3 a supprimer.

**Pre-requis :** Les stories 7-1 (types shared) et 7-2 (backend routes) sont done. Le type `Service` existe deja dans `@wakehub/shared`. Les endpoints API sont deja en `/api/services`.

### Changements cles

- `Machine` type → `Service` (depuis @wakehub/shared)
- `Resource` type → `Service` (avec `parentId` pour le lien parent)
- `/api/machines` → `/api/services`
- `/api/resources` → supprime (tout dans `/api/services`)
- `/api/machines/:id/discover` → `/api/services/:id/discover`
- `/api/machines/:id/resources` → `/api/services/:id/resources`
- `resourceId` → `serviceId` dans cascades
- `machineId` → `parentId` dans les sous-services
- Query keys : `['machines']` → `['services']`, `['resources']` → supprime
- Routes : `/machines` → `/services`, `/resources/:id` → `/services/:id`

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-11.md#Story 7-3]
- [Source: _bmad-output/implementation-artifacts/7-1-schema-db-migration-et-types-shared.md]
- [Source: _bmad-output/implementation-artifacts/7-2-backend-routes-et-connectors.md]
- [Source: packages/shared/src/index.ts — types Service, CascadeRecord avec serviceId]
- [Source: apps/server/src/routes/services.routes.ts — endpoints /api/services]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Aucun bug majeur rencontre.

### Completion Notes List

- Cree `services.api.ts` unifiant machines.api + resources.api en une seule API `/api/services`
- Reecrit `cascades.api.ts` avec `serviceId` au lieu de `resourceId`
- `dependencies.api.ts` etait deja correct, aucun changement necessaire
- Cree `use-services-table.ts`, `services-table.tsx`, `services-filters.tsx`, `services-page.tsx`, `service-wizard.tsx` remplacant les anciens fichiers machines
- Fusionne `machine-detail-page.tsx` + `resource-detail-page.tsx` en `service-detail-page.tsx`
- Unifie `service-tile.tsx` : un seul composant au lieu de l'union Machine/Resource
- Adapte `service-detail-panel.tsx` : `useServices` au lieu de `useAllResources`, `serviceId` partout
- Adapte `dashboard-page.tsx` : une seule query `useServices()`, cascade support base sur `isChildService(type)`
- Adapte `use-sse.ts` : query keys `['services']`, `serviceId`
- Adapte `router.tsx`, `navigation.tsx`, `dependency-graph.tsx`, `dependencies-page.tsx`
- Supprime 7 anciens fichiers (machine-wizard, machine-detail-page, resource-detail-page, machines-page, machines-table, machines-filters, use-machines-table)
- Mis a jour 6 fichiers de test pour le modele unifie
- `tsc --noEmit` : zero erreur
- 98 tests frontend passent (11 fichiers)

### File List

**Fichiers crees :**
- `apps/web/src/api/services.api.ts`
- `apps/web/src/features/machines/use-services-table.ts`
- `apps/web/src/features/machines/services-table.tsx`
- `apps/web/src/features/machines/services-filters.tsx`
- `apps/web/src/features/machines/services-page.tsx`
- `apps/web/src/features/machines/service-wizard.tsx`
- `apps/web/src/features/machines/service-detail-page.tsx`

**Fichiers modifies :**
- `apps/web/src/api/cascades.api.ts`
- `apps/web/src/features/dashboard/dashboard-page.tsx`
- `apps/web/src/features/dashboard/service-tile.tsx`
- `apps/web/src/features/dashboard/service-detail-panel.tsx`
- `apps/web/src/hooks/use-sse.ts`
- `apps/web/src/router.tsx`
- `apps/web/src/components/layout/navigation.tsx`
- `apps/web/src/features/dependencies/dependency-graph.tsx`
- `apps/web/src/features/dependencies/dependencies-page.tsx`
- `apps/web/src/features/dashboard/service-tile.test.tsx`
- `apps/web/src/features/dashboard/service-detail-panel.test.tsx`
- `apps/web/src/hooks/use-sse.test.ts`
- `apps/web/src/router.test.tsx`
- `apps/web/src/components/layout/navigation.test.tsx`
- `apps/web/src/components/layout/app-shell.test.tsx`

**Fichiers supprimes :**
- `apps/web/src/api/machines.api.ts`
- `apps/web/src/api/resources.api.ts`
- `apps/web/src/features/machines/machine-wizard.tsx`
- `apps/web/src/features/machines/machine-detail-page.tsx`
- `apps/web/src/features/machines/resource-detail-page.tsx`
- `apps/web/src/features/machines/machines-page.tsx`
- `apps/web/src/features/machines/machines-table.tsx`
- `apps/web/src/features/machines/machines-filters.tsx`
- `apps/web/src/features/machines/use-machines-table.ts`
