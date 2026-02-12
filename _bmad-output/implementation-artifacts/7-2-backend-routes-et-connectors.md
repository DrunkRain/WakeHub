# Story 7.2 : Backend Routes + Connectors

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developpeur,
I want adapter toutes les routes backend et les services/connecteurs au modele unifie "services",
so that l'API REST utilise une seule table `services` au lieu des anciennes `machines` et `resources`.

## Acceptance Criteria (BDD)

1. **Given** le serveur demarre avec le nouveau schema
   **When** j'appelle `GET /api/services`
   **Then** je recois la liste de tous les services (physical, proxmox, docker, vm, container)
   **And** les endpoints `/api/machines` et `/api/resources` n'existent plus

2. **Given** un service de type `proxmox` ou `docker` existe
   **When** j'appelle `POST /api/services/:id/discover`
   **Then** les ressources decouvertes sont retournees
   **And** `POST /api/services/:id/resources` sauvegarde les ressources selectionnees comme services avec `parentId` et `isStructural=true`

3. **Given** le schema `cascades` a ete renomme (`service_id`)
   **When** j'appelle `POST /api/cascades/start` ou `GET /api/cascades/history`
   **Then** les payloads utilisent `serviceId` (pas `resourceId`)
   **And** le `nodeExists()` verifie dans la table `services`

4. **Given** les dependency_links utilisent `'service'` comme nodeType
   **When** j'appelle `POST /api/dependencies` ou `GET /api/dependencies/graph`
   **Then** `parentType` et `childType` n'acceptent que `'service'`
   **And** les liens structurels (`isStructural=true`) ne peuvent pas etre supprimes via `DELETE /api/dependencies/:id`

5. **Given** je demande les stats
   **When** j'appelle `GET /api/stats`
   **Then** `activeServices` compte les services (pas les resources) avec status='running' et service_url non null

6. **Given** le cascade engine execute une cascade
   **When** il resout les noeuds et emet des events SSE
   **Then** il utilise la table `services` pour resoudre les noeuds
   **And** les events SSE utilisent `serviceId` (pas `resourceId`)

7. **Given** le connector-factory recoit un serviceId
   **When** il cree un connecteur
   **Then** il interroge la table `services` (pas machines/resources)
   **And** il determine le connecteur via `service.type` + parent `service.type`

8. **Given** toutes les modifications sont appliquees
   **When** je lance `npx vitest run` dans apps/server
   **Then** tous les tests passent (anciens et nouveaux)

## Tasks / Subtasks

- [x] Task 1 -- Mettre a jour le service layer (AC: #6, #7)
  - [x] 1.1 Adapter `dependency-graph.ts` : imports services, simplifier `resolveNode()` et `nodeExists()` (une seule table), nodeType='service'
  - [x] 1.2 Adapter `cascade-engine.ts` : imports services, `resolveNodeType()` une seule table, SSE payloads `serviceId`, cascades.serviceId
  - [x] 1.3 Adapter `connector-factory.ts` : fusionner `createConnectorForMachine()`+`createConnectorForResource()` en `createConnectorForService()`, discriminer par `service.type` + `parent.type`
  - [x] 1.4 Ecrire/adapter les tests service layer (`dependency-graph.test.ts`, `cascade-engine.test.ts`, `connector-factory.test.ts`)

- [x] Task 2 -- Renommer et fusionner les routes machines+resources (AC: #1, #2)
  - [x] 2.1 Renommer `machines.routes.ts` -> `services.routes.ts`, adapter tous les imports/queries pour utiliser la table `services`
  - [x] 2.2 Integrer les endpoints de decouverte de `resources.routes.ts` dans `services.routes.ts` : `POST /api/services/:id/discover`, `POST /api/services/:id/resources`
  - [x] 2.3 Sauvegarder les ressources decouvertes comme services avec `parentId` + dependency_link `isStructural=true`
  - [x] 2.4 Supprimer `resources.routes.ts`
  - [x] 2.5 Ecrire/adapter les tests routes (`services.routes.test.ts` fusionne des tests machines+resources)

- [x] Task 3 -- Adapter les routes cascades, dependencies, stats (AC: #3, #4, #5)
  - [x] 3.1 Adapter `cascades.routes.ts` : `cascades.serviceId`, `formatCascade()` retourne `serviceId`, `nodeExists()` utilise services, schemas de requete/reponse
  - [x] 3.2 Adapter `dependencies.routes.ts` : enums `'service'` uniquement, graph construit depuis une seule table, protection suppression liens structurels
  - [x] 3.3 Adapter `stats.routes.ts` : query services au lieu de resources
  - [x] 3.4 Ecrire/adapter les tests routes (`cascades.routes.test.ts`, `dependencies.routes.test.ts`, `stats.routes.test.ts`)

- [x] Task 4 -- App.ts, cleanup et verification finale (AC: #8)
  - [x] 4.1 Adapter `app.ts` : remplacer import machinesRoutes/resourcesRoutes par servicesRoutes
  - [x] 4.2 Supprimer `machines.routes.ts`, `machines.routes.test.ts`, `resources.routes.ts`, `resources.routes.test.ts`
  - [x] 4.3 Lancer `npx vitest run` -- tous les 252 tests passent (17 fichiers)
  - [x] 4.4 Verifier `tsc --noEmit` sur apps/server -- passe clean

## Dev Notes

### Vue d'ensemble

Cette story adapte **tout le backend** (routes, services, tests) au modele unifie `services`. C'est la story la plus volumineuse de l'Epic 7 -- environ 15 fichiers modifies et 252 tests.

**Attention :** Les routes frontend (story 7-3) ne sont PAS concernees ici. Cependant, les paths API changent (`/api/machines` -> `/api/services`, suppression `/api/resources`), ce qui cassera le frontend -- attendu.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-11.md#Story 7-2]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7]
- [Source: _bmad-output/implementation-artifacts/7-1-schema-db-migration-et-types-shared.md]
- [Source: apps/server/src/db/schema.ts -- nouveau schema services]
- [Source: packages/shared/src/index.ts -- nouveaux types Service/ServiceType/etc.]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed 2 TS unused variable errors (`nodeType` in connector-factory.ts and dependency-graph.ts) by prefixing with `_`

### Completion Notes List

- Service layer (Task 1): 4 files adapted (dependency-graph, cascade-engine, connector-factory, sse-manager), 47 tests green
- Routes (Tasks 2-3): Created unified services.routes.ts (708 lines, 50 tests), adapted cascades/dependencies/stats routes + tests
- Cleanup (Task 4): Deleted 4 old files (machines.routes.ts/test, resources.routes.ts/test), updated app.ts imports
- Final: 252 tests passing, tsc --noEmit clean, 17/17 test files green

### Code Review Fixes

- F1: Added `isStructural` to graph edges in `dependencies.routes.ts`
- F2: Exported `nodeExists()` from `dependency-graph.ts`, removed duplicate in `cascades.routes.ts`
- F3: POST `/api/services` now re-reads from DB via `formatService()` instead of manual response
- F4: DELETE handler uses consistent sync `.run()` calls
- F5: Fixed raw SQL timestamps in tests (seconds, not milliseconds) for Drizzle `mode:'timestamp'` consistency
- F6: Added null-check for `updated` in PUT handler, removing non-null assertion

### File List

**New files:**
- `apps/server/src/routes/services.routes.ts` -- unified CRUD + discover + test-connection routes
- `apps/server/src/routes/services.routes.test.ts` -- 50 tests (merged from machines + resources)

**Adapted files:**
- `apps/server/src/app.ts` -- import servicesRoutes instead of machinesRoutes/resourcesRoutes
- `apps/server/src/services/dependency-graph.ts` -- single services table, nodeType='service'
- `apps/server/src/services/dependency-graph.test.ts` -- 13 tests adapted
- `apps/server/src/services/cascade-engine.ts` -- serviceId, services table, SSE payloads
- `apps/server/src/services/cascade-engine.test.ts` -- 13 tests adapted
- `apps/server/src/services/connector-factory.ts` -- unified createConnectorForService()
- `apps/server/src/services/connector-factory.test.ts` -- 7 tests adapted
- `apps/server/src/sse/sse-manager.test.ts` -- 1 payload change (resourceId->serviceId)
- `apps/server/src/routes/cascades.routes.ts` -- serviceId, nodeExists uses services
- `apps/server/src/routes/cascades.routes.test.ts` -- 15 tests adapted
- `apps/server/src/routes/dependencies.routes.ts` -- enum 'service' only, isStructural protection, single services table
- `apps/server/src/routes/dependencies.routes.test.ts` -- 19 tests adapted (incl. structural link 403 test)
- `apps/server/src/routes/stats.routes.ts` -- query services instead of resources
- `apps/server/src/routes/stats.routes.test.ts` -- 5 tests adapted

**Deleted files:**
- `apps/server/src/routes/machines.routes.ts`
- `apps/server/src/routes/machines.routes.test.ts`
- `apps/server/src/routes/resources.routes.ts`
- `apps/server/src/routes/resources.routes.test.ts`
