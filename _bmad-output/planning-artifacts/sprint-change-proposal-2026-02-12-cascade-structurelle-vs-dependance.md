# Sprint Change Proposal — Distinction Cascade Structurelle vs Dependance

**Date :** 2026-02-12
**Declencheur :** Story 7-5 (Epic 7) + tests manuels post-implementation des cascades (Epic 4)
**Scope :** Moderate — Redesign du moteur de cascade

---

## 1. Resume du Probleme

Le moteur de cascade (`cascade-engine.ts`) traite toutes les relations de la meme maniere, sans distinguer les **relations structurelles** (parentId — Proxmox→VM, Docker→Container) des **dependances logiques** (dependencyLinks non-structurelles — Jellyfin→NAS).

### Symptomes observes

| Action | Comportement attendu | Comportement actuel |
|--------|---------------------|---------------------|
| Eteindre Proxmox | VMs affichees offline (force) | VMs restent "online" visuellement |
| Allumer VM | Proxmox s'allume d'abord | Depend du graphe (parfois correct, parfois non) |
| Eteindre Jellyfin (depend du NAS) | NAS s'eteint si aucun autre dependant actif | NAS reste allume (upstream retire en 7-5 T5) |
| Allumer parent seul | Seulement le parent demarre | Cascade potentiellement trop large |

### Cause racine

`dependency-graph.ts` ne filtre pas par `isStructural` — les fonctions `getUpstreamChain()` et `getDownstreamDependents()` traversent tous les liens de `dependency_links` sans distinction. Le cascade engine ne peut donc pas appliquer des regles differentes selon le type de relation.

### Regles metier clarifiees

**Relations structurelles** (parentId — ex: Proxmox→VM) :
- Parent OFF → enfant **forcement OFF** (implicite, pas besoin de connecteur)
- Allumer enfant → parent doit d'abord etre allume
- Allumer parent → **seulement** le parent s'allume (enfants restent eteints)
- Eteindre enfant → seulement l'enfant (+ ses sous-enfants structurels) s'eteint

**Dependances logiques** (ex: Jellyfin→NAS) :
- Allumer service → ses dependances s'allument d'abord
- Eteindre service → si une dependance n'a plus aucun dependant actif, elle s'eteint aussi
- Allumer une dependance → juste elle (+ ses propres dependances) s'allume, pas ses dependants

---

## 2. Analyse d'Impact

### Impact Epic

| Epic | Statut | Impact | Detail |
|------|--------|--------|--------|
| Epic 4 (in-progress) | **Direct** | Ajout story 4-7 : redesign cascade engine |
| Epic 7 (in-progress) | Indirect | `dependency-graph.ts` modifie pour filtrer par `isStructural` |
| Epic 3 (done) | Aucun | Les liens en DB ont deja le flag `isStructural` |
| Epic 5 (backlog) | Indirect | Beneficiera de la logique de nettoyage conditionnel des dependances |
| Epic 6 (backlog) | Aucun | Pas de modification necessaire |

### Impact Artefacts

| Artefact | Modification |
|----------|-------------|
| PRD | Preciser FR19 (cascade start), FR21 (cascade stop), FR22 (dependances partagees) pour distinguer structurel vs dependance |
| Architecture | Mettre a jour la description du Cascade Engine (phases de stop) |
| Epics | Ajouter Story 4.7 dans l'Epic 4 |
| UI/UX | Aucune — le dashboard reflete automatiquement les statuts DB via SSE |
| Tests | `cascade-engine.test.ts` : revision complete, `dependency-graph.test.ts` : nouvelles fonctions |

### Impact Code

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/services/dependency-graph.ts` | Nouvelles fonctions filtrees par `isStructural` |
| `apps/server/src/services/cascade-engine.ts` | Redesign `executeCascadeStop()` en 3 phases |
| `apps/server/src/services/cascade-engine.test.ts` | Tests mis a jour pour les nouvelles regles |
| `apps/server/src/services/dependency-graph.test.ts` | Tests pour les nouvelles fonctions |

---

## 3. Approche Recommandee : Ajustement Direct

**Effort :** Medium (2 fichiers backend principaux + tests)
**Risque :** Low (le flag `isStructural` existe deja en DB, pas de migration necessaire)

### A. Redesign `dependency-graph.ts`

Nouvelles fonctions a ajouter :

```typescript
// Upstream NON-structural (dependances logiques) uniquement
getUpstreamDependencies(db, nodeId): ChainNode[]

// Upstream STRUCTURAL (parents physiques) uniquement
getStructuralAncestors(db, nodeId): ChainNode[]

// Downstream NON-structural (dependants logiques) uniquement
getDownstreamLogicalDependents(db, nodeId): ChainNode[]

// Enfants structurels recursifs (via parentId ou isStructural)
getStructuralDescendants(db, nodeId): ChainNode[]
```

Les fonctions existantes (`getUpstreamChain`, `getDownstreamDependents`) restent en place pour compatibilite.

### B. Redesign `executeCascadeStart()`

Comportement actuel (upstream chain → start root-first) est **globalement correct**, mais il faut s'assurer que :
1. Les parents structurels sont bien demarres avant les enfants
2. Les dependances logiques sont demarrees avant le service cible
3. `propagateToStructuralChildren(start)` ne demarre PAS les enfants structurels (juste poll status) — **deja le cas**

Verification a faire, pas de redesign majeur attendu.

### C. Redesign `executeCascadeStop()` — 3 phases

**Phase 1 — Arret structurel force :**
- Recuperer tous les enfants structurels (recursif) du service cible
- Pour chacun : arreter via connecteur si disponible, puis marquer `offline` en DB
- Broadcaster `status-change` pour chaque enfant

**Phase 2 — Arret du service cible :**
- Arreter le service cible via son connecteur
- Poll jusqu'a confirmation
- Marquer le statut en DB + broadcaster

**Phase 3 — Nettoyage conditionnel des dependances upstream :**
- Pour chaque dependance upstream (non-structurelle uniquement) du service cible :
  - Verifier si elle a d'autres dependants actifs (via `getDownstreamLogicalDependents()`)
  - Si **aucun dependant actif** → arreter la dependance (connecteur + DB)
  - Puis recursivement verifier les dependances upstream de celle-ci
  - Si **dependant actif** → laisser en place, logger la raison

### D. Diagramme du nouveau flux STOP

```
executeCascadeStop(serviceX)
│
├── Phase 1: Arret structurel force
│   ├── getStructuralDescendants(serviceX) → [child1, child2, ...]
│   ├── Pour chaque enfant (leaf-first) :
│   │   ├── connector.stop() si disponible
│   │   ├── DB: status = offline
│   │   └── SSE: status-change
│   └── (tous les enfants structurels sont offline)
│
├── Phase 2: Arret du service cible
│   ├── connector.stop()
│   ├── pollUntilStatus(offline)
│   ├── DB: status = offline
│   └── SSE: status-change
│
└── Phase 3: Nettoyage conditionnel upstream
    ├── getUpstreamDependencies(serviceX) → [depA, depB, ...]
    ├── Pour chaque dependance (feuille d'abord) :
    │   ├── getDownstreamLogicalDependents(depA) → actifs?
    │   ├── Si aucun actif hors cascade → arreter depA
    │   │   ├── connector.stop()
    │   │   ├── DB: status = offline
    │   │   └── SSE: status-change
    │   │   └── Recursivement : verifier les deps upstream de depA
    │   └── Si dependants actifs → skip (logger raison)
    └── (dependances inutilisees nettoyees)
```

---

## 4. Implementation Handoff

### Story proposee : 4-7 — Distinction cascade structurelle vs dependance

**Fichiers a modifier :**
1. `apps/server/src/services/dependency-graph.ts` — Nouvelles fonctions filtrees par `isStructural`
2. `apps/server/src/services/dependency-graph.test.ts` — Tests pour les nouvelles fonctions
3. `apps/server/src/services/cascade-engine.ts` — Redesign `executeCascadeStop()` en 3 phases
4. `apps/server/src/services/cascade-engine.test.ts` — Tests mis a jour pour les nouvelles regles

**Scope :** Moderate — Redesign localise (2 fichiers principaux + tests)
**Handoff :** Dev team (agent dev-story)
**Criteres de succes :**
- Eteindre un parent structurel (Proxmox) → ses VMs passent offline immediatement
- Eteindre un service (Jellyfin) → sa dependance (NAS) s'eteint si aucun autre dependant actif
- Allumer un service → ses dependances (structurelles + logiques) s'allument d'abord
- Allumer un parent → seulement le parent s'allume
- `tsc --noEmit` + tous les tests passent
- Zero regression

---

## 5. Impact MVP

**Aucun impact negatif sur le MVP.** Ce changement corrige un comportement incoherent qui degradait l'experience utilisateur. Le MVP est renforce par une gestion correcte des deux types de relations — la cascade "magique en un clic" fonctionne enfin comme attendu.

### Mise a jour PRD recommandee

**FR19** (actuel) : *"Le systeme demarre automatiquement toute la chaine de dependances (cascade ascendante)"*
**FR19** (propose) : *"Le systeme demarre automatiquement la chaine de dependances (structurelles et logiques) dans l'ordre correct : parents structurels d'abord, puis dependances logiques, puis service cible"*

**FR21** (actuel) : *"Le systeme arrete un service et ses dependances en cascade (cascade descendante)"*
**FR21** (propose) : *"Le systeme arrete un service, force l'arret de ses enfants structurels (VMs, conteneurs), puis nettoie conditionnellement ses dependances logiques upstream si elles ne sont plus utilisees par aucun autre service actif"*

**FR22** (actuel) : *"Le systeme verifie qu'aucun service actif n'utilise une dependance partagee avant de l'eteindre"*
**FR22** (inchange) : Deja correctement specifie, s'applique a la Phase 3 du nouveau stop.
