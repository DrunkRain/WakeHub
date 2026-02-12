# Sprint Change Proposal — Modele Unifie Services

**Date :** 2026-02-11
**Declencheur :** Retour utilisateur lors de la story 4-5 (ServiceDetailPanel)
**Scope :** Majeur — refactoring architectural

---

## Section 1 : Resume du probleme

### Constat

L'architecture actuelle separe les entites gerees en deux tables distinctes :
- **`machines`** : entites de premiere classe (physique, Proxmox, Docker) — pleinement editables, possedent credentials
- **`resources`** : entites de seconde classe (VMs, conteneurs) — decouvertes automatiquement, liees par FK `machine_id`, non modifiables independamment

### Probleme

Les VMs et conteneurs decouverts depuis Proxmox/Docker sont stockes comme `resources` et ne peuvent pas etre modifies (nom, service_url, etc.) comme des entites autonomes. L'utilisateur souhaite que **toutes les entites gerees soient au meme niveau** — editables, avec dependances configurables.

### Decision

1. **Renommer** `machine` → `service` partout (DB, API, types, UI)
2. **Supprimer** la table `resources` — tout devient `service`
3. **Types de service** : `physical | proxmox | docker | vm | container`
4. **Lien structurel** : ajout de `isStructural` a `dependency_links` — les liens auto-crees (parent Proxmox → VM enfant) sont proteges contre la suppression
5. **Parent direct** : ajout de `parent_id` (FK nullable → services) dans la table services pour acces rapide aux enfants

---

## Section 2 : Analyse d'impact

### Impact par Epic

| Epic | Statut | Impact |
|------|--------|--------|
| Epic 1 (Auth) | done | Aucun |
| Epic 2 (Infrastructure) | done | **CRITIQUE** — schema, routes, connecteurs, wizard, pages |
| Epic 3 (Dependances) | done | **MODERE** — nodeType simplifie, ajout is_structural |
| Epic 4 (Dashboard) | in-progress | **FORT** — cascades, SSE, tiles, panel referent resources |
| Epic 5 (Inactivite) | backlog | Indirect — types a adapter |
| Epic 6 (Logs) | backlog | Indirect — types a adapter |

### Impact sur le schema DB

**Table `services`** (remplace `machines` + `resources`) :

```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('physical','proxmox','docker','vm','container')),
  ip_address TEXT,                          -- nullable pour vm/container
  mac_address TEXT,                         -- nullable
  ssh_user TEXT,                            -- nullable
  ssh_credentials_encrypted TEXT,           -- nullable
  api_url TEXT,                             -- nullable
  api_credentials_encrypted TEXT,           -- nullable
  service_url TEXT,                         -- nullable
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK(status IN ('online','offline','running','stopped','paused','unknown','error')),
  platform_ref TEXT,                        -- JSON, nullable (ex: {"node":"pve","vmid":100})
  inactivity_timeout INTEGER,              -- nullable
  parent_id TEXT REFERENCES services(id),   -- FK nullable vers service parent
  pinned_to_dashboard INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Table `resources`** : SUPPRIMEE

**Table `dependency_links`** : ajout colonne `is_structural`

```sql
ALTER TABLE dependency_links ADD COLUMN is_structural INTEGER NOT NULL DEFAULT 0;
```

Les valeurs `parent_type` et `child_type` passent de `'machine'|'resource'` a `'service'` uniquement.

### Impact sur les fichiers (estimation)

| Couche | Fichiers impactes | Fichiers supprimes |
|--------|-------------------|--------------------|
| Shared types | 1 (`index.ts`) | 0 |
| DB schema + migration | 2 | 0 |
| Backend routes | 6 | 1 (`resources.routes.ts`) |
| Backend connectors | 3 | 0 |
| Backend services | 2 | 0 |
| Backend tests | ~8 | 1 (`resources.routes.test.ts`) |
| Frontend API hooks | 3 | 1 (`resources.api.ts`) |
| Frontend components | ~10 | 0 |
| Frontend tests | ~5 | 0 |
| **Total** | **~40** | **3** |

### Impact sur les artefacts de planification

| Artefact | Action |
|----------|--------|
| PRD | Vocabulaire machine → service |
| Architecture | Schema DB, API routes, connecteurs — sections a reecrire |
| Epics | Ajout Epic 7, annotation des stories 2.x/4.x |
| UX | "Page Machines" → "Page Services", wizard adapte |
| sprint-status.yaml | Ajout epic-7 + 4 stories |

---

## Section 3 : Approche recommandee

### Strategie : Nouvelles stories dans un Epic dedie

**Epic 7 : Refactoring — Modele Unifie Services**

Insere entre la story 4-5 (done) et la story 4-6 (backlog). L'Epic 4 est mis en pause pendant le refactoring.

### Justification

- Le modele actuel fonctionne — pas de regression a craindre si on procede methodiquement
- Les tests existants (251 backend, 98 frontend) servent de filet de securite
- Les stories sont dimensionnees pour etre executables en sequence
- Apres le refactoring, les stories restantes (4-6, Epic 5, 6) seront simplifiees car le modele est unifie

### Estimation effort et risques

| Critere | Evaluation |
|---------|------------|
| Effort | ELEVE — equivalent a re-implementer Epic 2 + adapter Epic 3-4 |
| Risque technique | MOYEN — migrations DB bien testees, Drizzle gere les rename |
| Risque regression | FAIBLE — couverture de tests existante sert de filet |
| Impact timeline | +4-6 stories de refactoring avant de reprendre le backlog |

---

## Section 4 : Propositions de modifications detaillees

### Epic 7 — Stories

#### Story 7-1 : Schema DB + Migration + Types Shared

**Objectif :** Migrer le schema de donnees et les types partages vers le modele unifie.

**Taches :**
- Nouvelle migration Drizzle :
  - Renommer table `machines` → `services`
  - Ajouter colonnes : `platform_ref` (TEXT JSON nullable), `inactivity_timeout` (INTEGER nullable), `parent_id` (TEXT FK nullable → services)
  - Migrer les donnees de `resources` vers `services` (avec type vm/container, platform_ref, parent_id)
  - Creer les `dependency_links` structurels (is_structural=true) pour chaque ancienne relation machine→resource
  - Ajouter `is_structural` (INTEGER boolean, default 0) a `dependency_links`
  - Migrer les valeurs `parent_type`/`child_type` : 'machine'|'resource' → 'service'
  - Supprimer la table `resources`
- Mettre a jour `apps/server/src/db/schema.ts` : schema Drizzle
- Mettre a jour `packages/shared/src/index.ts` :
  - `Machine` → `Service`
  - `MachineType` → `ServiceType` (ajouter 'vm', 'container')
  - `MachineStatus` + `ResourceStatus` → `ServiceStatus` (union)
  - Supprimer `Resource`, `ResourceType`, `ResourceStatus`, `DiscoveredResource`, `PlatformRef`
  - `DependencyNodeType` → `'service'` seulement
  - Ajouter `isStructural` a `DependencyLink`
  - Adapter les types SSE
- Tests : schema, migration, types

#### Story 7-2 : Backend Routes + Connectors

**Objectif :** Adapter toutes les routes et connecteurs au modele unifie.

**Taches :**
- Renommer `machines.routes.ts` → `services.routes.ts`
- Fusionner les endpoints de `resources.routes.ts` dans `services.routes.ts` (CRUD unifie)
- Supprimer `resources.routes.ts` + `resources.routes.test.ts`
- Adapter `cascades.routes.ts` : `resource_id` → conceptuellement service_id (ou renommer la colonne)
- Adapter `dependencies.routes.ts` : simplifier nodeType, proteger les liens structurels
- Adapter `stats.routes.ts` et `events.routes.ts`
- Adapter les connecteurs (`wol-ssh`, `proxmox`, `docker`) pour travailler avec `Service`
- Adapter le cascade engine (`cascade-engine.ts`)
- Adapter `app.ts` (registration des routes)
- Reecrire tous les tests backend impactes

#### Story 7-3 : Frontend — API Hooks + Components

**Objectif :** Adapter l'ensemble du frontend au modele unifie.

**Taches :**
- Fusionner `machines.api.ts` + `resources.api.ts` → `services.api.ts`
- Supprimer `resources.api.ts`
- Adapter `cascades.api.ts`, `dependencies.api.ts`
- Adapter `service-tile.tsx` : suppression du discriminant resource/machine, tout est Service
- Adapter `service-detail-panel.tsx`
- Adapter `dashboard-page.tsx` : plus de pinnedMachines vs pinnedResources
- Adapter `machine-wizard.tsx` → `service-wizard.tsx` : discovery cree des services + dependency_links
- Adapter `machines-page.tsx` → `services-page.tsx`
- Adapter `machines-table.tsx` → `services-table.tsx`
- Adapter `machine-detail-page.tsx` → `service-detail-page.tsx`
- Adapter `navigation.tsx` : "Machines" → "Services"
- Adapter `router.tsx` : routes renommees
- Reecrire tous les tests frontend impactes

#### Story 7-4 : Tests + Build + Nettoyage

**Objectif :** Verification finale et nettoyage.

**Taches :**
- `tsc --noEmit` frontend + backend → clean
- Tous les tests backend passent
- Tous les tests frontend passent
- `docker compose build` → succes
- Supprimer les fichiers obsoletes (resources.routes.ts, resources.api.ts, etc.)
- Adapter la story 4-6 au nouveau modele (dans le backlog)

---

## Section 5 : Plan de handoff

### Classification du scope : MAJEUR

### Responsabilites

| Role | Action |
|------|--------|
| **Dev (agent)** | Implementation des stories 7-1 a 7-4 via /bmad-bmm-dev-story |
| **SM (agent)** | Creation des stories detaillees via /bmad-bmm-create-story |
| **QA (agent)** | Code review de chaque story via /bmad-bmm-code-review |

### Criteres de succes

1. La table `resources` n'existe plus
2. Toutes les entites (physique, Proxmox, Docker, VM, conteneur) sont dans la table `services`
3. Les VMs/conteneurs decouverts sont crees comme `services` avec `parent_id` + `dependency_link` structurel
4. Les liens structurels ne peuvent pas etre supprimes via l'API
5. Tous les tests passent
6. Le build Docker reussit
7. L'UI utilise "Services" au lieu de "Machines" partout

### Sequence d'execution

```
1. Mettre Epic 4 en pause (4-6 reste en backlog)
2. Creer les stories 7-1 a 7-4 via /bmad-bmm-create-story
3. Implementer chaque story via /bmad-bmm-dev-story
4. Code review chaque story via /bmad-bmm-code-review
5. Marquer Epic 7 comme done
6. Reprendre Epic 4 (adapter 4-6 au nouveau modele)
7. Continuer Epics 5-6 normalement
```
