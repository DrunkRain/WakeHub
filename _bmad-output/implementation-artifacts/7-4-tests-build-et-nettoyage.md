# Story 7.4 : Tests + Build + Nettoyage

Status: review

## Story

As a developpeur,
I want verifier que le build, les tests et le codebase sont propres apres le refactoring du modele unifie,
so that l'application est deployable, tous les tests passent et aucun artefact obsolete ne subsiste.

## Acceptance Criteria (BDD)

1. **Given** le build TypeScript est verifie
   **When** je lance `tsc --noEmit` sur le frontend et le backend
   **Then** aucune erreur TypeScript

2. **Given** les tests sont a jour
   **When** je lance tous les tests
   **Then** tous les tests backend passent (252+)
   **And** tous les tests frontend passent (98+)

3. **Given** le build Docker fonctionne
   **When** je lance `docker compose build`
   **Then** le build reussit sans erreur

4. **Given** les fichiers obsoletes sont supprimes
   **When** je verifie le codebase
   **Then** `resources.routes.ts`, `resources.routes.test.ts`, `resources.api.ts` n'existent plus
   **And** les artefacts de build stale (`dist/`) ne contiennent plus de fichiers obsoletes
   **And** le dossier `features/machines/` est renomme en `features/services/`

## Tasks / Subtasks

- [x] Task 1 -- Verifier tsc et tests (AC: #1, #2)
  - [x] 1.1 Lancer `tsc --noEmit` sur `@wakehub/server` et `@wakehub/web` — zero erreur
  - [x] 1.2 Lancer tous les tests backend (`vitest run` dans apps/server) — tous passent
  - [x] 1.3 Lancer tous les tests frontend (`vitest run` dans apps/web) — tous passent

- [x] Task 2 -- Renommer `features/machines/` → `features/services/` (AC: #4)
  - [x] 2.1 Renommer le dossier `apps/web/src/features/machines` en `apps/web/src/features/services`
  - [x] 2.2 Mettre a jour tous les imports qui referencent `features/machines/` vers `features/services/`
  - [x] 2.3 Verifier que `tsc --noEmit` et les tests passent apres le renommage

- [x] Task 3 -- Nettoyer les artefacts de build (AC: #4)
  - [x] 3.1 Supprimer `apps/server/dist/` (contient d'anciens fichiers machines/resources compiles)
  - [x] 3.2 Verifier que `apps/server/dist` est dans `.gitignore`

- [x] Task 4 -- Verifier le build Docker (AC: #3)
  - [x] 4.1 Lancer `docker compose build` et verifier que le build reussit sans erreur

- [x] Task 5 -- Verification finale (AC: #1, #2, #3, #4)
  - [x] 5.1 Confirmer que `resources.routes.ts`, `resources.routes.test.ts`, `resources.api.ts`, `machines.routes.ts`, `machines.routes.test.ts`, `machines.api.ts` n'existent plus
  - [x] 5.2 Grep final pour s'assurer qu'aucune reference a l'ancien modele ne subsiste dans le code source (.ts/.tsx)
  - [x] 5.3 Lancer `tsc --noEmit` sur server + web — zero erreur
  - [x] 5.4 Lancer tous les tests (server + web) — tous passent

## Dev Notes

### Vue d'ensemble

Derniere story de l'Epic 7 — verification et nettoyage final apres le refactoring du modele unifie. Les stories 7-1 (schema/types), 7-2 (backend), et 7-3 (frontend) sont terminees. Le gros du travail est fait, cette story confirme la coherence globale.

**Pre-requis :** Stories 7-1, 7-2, 7-3 terminees. 350 tests passent deja. `tsc --noEmit` passe sur les deux workspaces.

### Etat actuel du codebase (analyse effectuee)

1. **tsc --noEmit** : Passe deja sur `@wakehub/server` et `@wakehub/web` — zero erreur
2. **Tests** : 252 tests backend + 98 tests frontend = 350 tests, tous verts
3. **Fichiers obsoletes** : Deja supprimes dans les stories precedentes :
   - `machines.routes.ts`, `machines.routes.test.ts` — supprimes en 7-2
   - `resources.routes.ts`, `resources.routes.test.ts` — supprimes en 7-2
   - `machines.api.ts`, `resources.api.ts` — supprimes en 7-3
   - `machines-page.tsx`, `machines-table.tsx`, `machines-filters.tsx`, `use-machines-table.ts` — supprimes en 7-3
   - `machine-wizard.tsx`, `machine-detail-page.tsx`, `resource-detail-page.tsx` — supprimes en 7-3
4. **Artefacts de build** : `apps/server/dist/` contient d'anciens fichiers compiles (machines.routes.js, resources.routes.js) → a supprimer
5. **Dossier `features/machines/`** : Contient maintenant des fichiers services-* (services-page.tsx, services-table.tsx, etc.) → renommer en `features/services/`
6. **Lint** : 49 issues pre-existantes, non liees au refactoring, hors scope de cette story
7. **References old model** : Aucune reference `Machine`/`Resource` comme types dans le code source. Grep confirme.

### Renommage features/machines/ → features/services/

Le dossier `apps/web/src/features/machines/` contient ces fichiers apres le refactoring :
- `service-detail-page.tsx`
- `services-page.tsx`
- `services-table.tsx`
- `services-filters.tsx`
- `service-wizard.tsx`
- `use-services-table.ts`

Fichiers qui importent depuis ce dossier (a mettre a jour) :
- `apps/web/src/router.tsx` — imports de `ServicesPage`, `ServiceDetailPage`
- `apps/web/src/features/dashboard/dashboard-page.tsx` — import de `ServiceWizard`

### Build Docker

Le `docker/Dockerfile` est un build multi-stage :
1. Stage `build` : npm install + npm run build (web Vite + server tsc)
2. Stage `production` : Node.js Alpine, copie les artefacts

Le build doit fonctionner car les sources sont propres. La seule contrainte est que Docker soit disponible sur la machine.

### Patterns du projet

- **Workspace commands** : `npx -w @wakehub/server vitest run`, `npx -w @wakehub/web vitest run`
- **tsc** : `npx -w @wakehub/server tsc --noEmit`, `npx -w @wakehub/web tsc --noEmit`
- **Tests** : Vitest, co-localises (`foo.test.ts`), `app.inject()` pour les routes
- **Build** : `npm run build` a la racine construit tout

### References

- [Source: _bmad-output/implementation-artifacts/7-1-schema-db-migration-et-types-shared.md]
- [Source: _bmad-output/implementation-artifacts/7-2-backend-routes-et-connectors.md]
- [Source: _bmad-output/implementation-artifacts/7-3-frontend-api-hooks-et-components.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4]
- [Source: _bmad-output/planning-artifacts/architecture.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Aucun bug rencontre. Un import manque dans `dashboard-page.tsx` (`../machines/service-wizard`) a ete corrige lors du renommage.

### Completion Notes List

- Task 1 : `tsc --noEmit` passe sur server + web (zero erreur). 252 tests backend + 98 tests frontend = 350 tests, tous verts.
- Task 2 : Dossier `features/machines/` renomme en `features/services/`. Imports mis a jour dans `router.tsx` et `dashboard-page.tsx`. tsc + tests OK apres renommage.
- Task 3 : `apps/server/dist/` supprime. `dist` est bien dans `.gitignore`.
- Task 4 : `docker compose build` reussi — server tsc + web Vite build OK, image Docker construite.
- Task 5 : Verification finale — 6 fichiers obsoletes confirmes absents, grep confirme aucune reference a l'ancien modele Machine/Resource dans le code source, tsc + 350 tests tous verts.

### File List

**Fichiers modifies :**
- `apps/web/src/router.tsx` — imports `features/machines/` → `features/services/`
- `apps/web/src/features/dashboard/dashboard-page.tsx` — import `../machines/service-wizard` → `../services/service-wizard`

**Dossier renomme :**
- `apps/web/src/features/machines/` → `apps/web/src/features/services/`

**Dossier supprime :**
- `apps/server/dist/` (artefacts de build stale, dans .gitignore)

