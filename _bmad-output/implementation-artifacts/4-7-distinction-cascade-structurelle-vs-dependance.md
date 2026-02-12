# Story 4.7 : Distinction Cascade Structurelle vs Dependance

Status: review

## Story

As a administrateur,
I want que le moteur de cascade distingue les relations structurelles (Proxmox→VM) des dependances logiques (Jellyfin→NAS),
so that l'arret d'un parent marque ses enfants structurels comme offline, et les dependances logiques inutilisees soient nettoyees conditionnellement.

## Acceptance Criteria (BDD)

1. **Given** un service parent structurel (Proxmox) avec des enfants (VMs)
   **When** j'arrete le parent
   **Then** toutes les VMs enfants sont marquees `offline` en DB
   **And** un evenement SSE `status-change` est emis pour chaque enfant
   **And** les VMs n'ont pas besoin d'etre arretees via connecteur (arret force implicite)

2. **Given** un service (Jellyfin) qui depend du NAS via un lien non-structurel
   **When** j'arrete Jellyfin et que le NAS n'a aucun autre dependant actif
   **Then** le NAS est arrete automatiquement apres Jellyfin
   **And** le statut du NAS passe a `offline` en DB + SSE

3. **Given** un service (Jellyfin) qui depend du NAS via un lien non-structurel
   **When** j'arrete Jellyfin et que le NAS a un autre dependant actif (Plex)
   **Then** le NAS reste allume
   **And** un log indique "Arret de NAS annule — dependant actif : Plex"

4. **Given** un service enfant structurel (VM)
   **When** j'allume la VM
   **Then** le parent structurel (Proxmox) est allume d'abord
   **And** puis la VM est allumee

5. **Given** un service parent structurel (Proxmox)
   **When** j'allume le Proxmox
   **Then** seulement le Proxmox s'allume
   **And** ses VMs enfants ne sont PAS demarrees

6. **Given** une dependance logique (NAS)
   **When** j'allume le NAS directement
   **Then** seulement le NAS (et ses propres dependances) s'allument
   **And** les services qui dependent du NAS (Jellyfin, Plex) ne sont PAS demarres

7. **Given** un service avec des enfants structurels ET des dependances logiques
   **When** j'arrete ce service
   **Then** Phase 1 : les enfants structurels sont arretes/marques offline en premier (leaf-first)
   **Then** Phase 2 : le service cible est arrete
   **Then** Phase 3 : les dependances logiques upstream sans autre dependant actif sont arretees

8. **Given** toutes les modifications sont appliquees
   **When** je lance `tsc --noEmit` et les tests
   **Then** zero erreur, tous les tests passent

## Tasks / Subtasks

- [x] Task 1 — Nouvelles fonctions dans dependency-graph.ts (AC: #1, #2, #3)
  - [x] 1.1 Ajouter `getUpstreamDependencies(db, nodeId)` — upstream avec `isStructural=false` uniquement
  - [x] 1.2 Ajouter `getStructuralAncestors(db, nodeId)` — upstream avec `isStructural=true` uniquement
  - [x] 1.3 Ajouter `getDownstreamLogicalDependents(db, nodeId)` — downstream avec `isStructural=false` uniquement
  - [x] 1.4 Ajouter `getStructuralDescendants(db, nodeId)` — downstream avec `isStructural=true` uniquement
  - [x] 1.5 Tests unitaires pour chaque nouvelle fonction dans `dependency-graph.test.ts`
  - [x] 1.6 Verifier que `tsc --noEmit` passe

- [x] Task 2 — Redesign executeCascadeStop() en 3 phases (AC: #1, #2, #3, #7)
  - [x] 2.1 Phase 1 : recuperer `getStructuralDescendants()` du service cible, arreter chaque enfant (leaf-first) via connecteur si disponible, marquer `offline` en DB, broadcaster SSE `status-change`
  - [x] 2.2 Phase 2 : arreter le service cible lui-meme (connecteur + poll + DB + SSE)
  - [x] 2.3 Phase 3 : pour chaque dep upstream non-structurelle (`getUpstreamDependencies()`), verifier les dependants actifs (`getDownstreamLogicalDependents()`). Si aucun actif → arreter la dep. Recursivement verifier les deps de la dep.
  - [x] 2.4 Conserver le catch block avec `status: 'error'` en DB + SSE (bugfix 7-5 T5)
  - [x] 2.5 Mettre a jour les tests dans `cascade-engine.test.ts` pour couvrir les 3 phases
  - [x] 2.6 Verifier que `tsc --noEmit` passe

- [x] Task 3 — Verification executeCascadeStart() (AC: #4, #5, #6)
  - [x] 3.1 Verifier que `executeCascadeStart()` utilise `getUpstreamChain()` qui inclut TOUS les liens upstream (structurels + logiques) — c'est le comportement souhaite pour le start
  - [x] 3.2 Verifier que `propagateToStructuralChildren(start)` ne demarre PAS les enfants (juste poll status) — deja le cas
  - [x] 3.3 Ajouter un test explicite : allumer parent → enfants structurels ne demarrent PAS
  - [x] 3.4 Ajouter un test explicite : allumer NAS → Jellyfin ne demarre PAS
  - [x] 3.5 Verifier que `tsc --noEmit` passe

- [x] Task 4 — Verification finale (AC: #8)
  - [x] 4.1 `tsc --noEmit` sur server + web — zero erreur
  - [x] 4.2 Tous les tests (server + web) passent
  - [ ] 4.3 Verification manuelle : arreter un Proxmox → VMs passent offline

## Dev Notes

### Vue d'ensemble

Story issue du Sprint Change Proposal (sprint-change-proposal-2026-02-12-cascade-structurelle-vs-dependance.md). Redesign du moteur de cascade pour distinguer les relations structurelles des dependances logiques.

**Pre-requis :** Stories 4-1 a 4-6, 7-1 a 7-5 terminees ou en review. Le flag `isStructural` existe deja dans la table `dependency_links`. Le champ `parentId` existe dans la table `services`.

### Architecture actuelle

Le graphe de dependances (`dependency-graph.ts`) expose :
- `getUpstreamChain(db, nodeType, nodeId)` — BFS upstream via `dependencyLinks` (TOUS les liens)
- `getDownstreamDependents(db, nodeType, nodeId)` — BFS downstream via `dependencyLinks` (TOUS les liens)
- `isSharedDependency(db, nodeType, nodeId)` — plus de 1 enfant

Le cascade engine (`cascade-engine.ts`) utilise :
- `executeCascadeStart()` — upstream chain → start root-first → `propagateToStructuralChildren(start)` (poll)
- `executeCascadeStop()` — downstream chain → stop leaf-first → `propagateToStructuralChildren(stop)` (mark offline)
- `stopStructuralChildren()` — arret physique des enfants via `parentId` (connecteurs)

### Probleme

`getUpstreamChain()` et `getDownstreamDependents()` ne filtrent PAS par `isStructural`. Le cascade engine ne peut donc pas appliquer des regles differentes pour :
- Relations structurelles : arret force (implicite), demarrage du parent requis
- Dependances logiques : nettoyage conditionnel a l'arret, demarrage des deps au start

### Schema DB existant (pas de migration)

```sql
-- dependency_links : a deja le flag isStructural
is_structural INTEGER NOT NULL DEFAULT 0

-- services : a deja parentId
parent_id TEXT REFERENCES services(id)
```

### Nouveau flux executeCascadeStop()

```
executeCascadeStop(serviceX)
├── Phase 1: Arret structurel force
│   ├── getStructuralDescendants(serviceX) → [child1, child2, ...]
│   ├── Pour chaque enfant (leaf-first) :
│   │   ├── connector.stop() si disponible
│   │   ├── DB: status = offline
│   │   └── SSE: status-change
│   └── (tous les enfants structurels sont offline)
├── Phase 2: Arret du service cible
│   ├── connector.stop()
│   ├── pollUntilStatus(offline)
│   ├── DB: status = offline
│   └── SSE: status-change
└── Phase 3: Nettoyage conditionnel upstream
    ├── getUpstreamDependencies(serviceX) → [depA, depB, ...]
    ├── Pour chaque dependance :
    │   ├── getDownstreamLogicalDependents(depA) → actifs hors cascade?
    │   ├── Si aucun actif → arreter depA (recursif)
    │   └── Si dependants actifs → skip (logger raison)
    └── (dependances inutilisees nettoyees)
```

### Patterns du projet

- **Workspace commands** : `npx -w @wakehub/server vitest run`, `npx -w @wakehub/web vitest run`
- **tsc** : `npx -w @wakehub/server tsc --noEmit`, `npx -w @wakehub/web tsc --noEmit`
- **Tests** : Vitest, co-localises, `app.inject()` pour les routes
- **Backend** : Fastify, Drizzle ORM, `{ data: {...} }` / `{ error: { code, message } }`
- **DB** : `isStructural` (boolean, integer 0/1) dans `dependency_links`
- **SSE** : `sse?.broadcast('status-change', { serviceId, status, timestamp })`

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-12-cascade-structurelle-vs-dependance.md]
- [Source: apps/server/src/services/cascade-engine.ts]
- [Source: apps/server/src/services/dependency-graph.ts]
- [Source: apps/server/src/db/schema.ts — dependencyLinks.isStructural]
