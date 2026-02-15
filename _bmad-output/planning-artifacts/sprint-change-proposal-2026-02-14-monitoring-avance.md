# Sprint Change Proposal — Monitoring Avance

**Date :** 2026-02-14
**Declencheur :** Session Party Mode — veille concurrentielle (Lazytainer, Sablier, Pulse)
**Scope :** Modere — ajout de stories + nouvel epic
**Statut :** Approuve

---

## Section 1 : Resume du probleme

La veille concurrentielle du 2026-02-14 a identifie 3 lacunes dans le monitoring d'inactivite :

1. **Seuils CPU/RAM hardcodes** (`CPU_LOAD_THRESHOLD = 0.5`, `RAM_USAGE_THRESHOLD = 0.5` dans `inactivity-monitor.ts`) — pas adaptables par type de noeud ni par service
2. **Conteneurs Docker sans visibilite reseau** — fiabilite "Faible", seul CPU/RAM via Docker API
3. **VMs/LXCs avec `networkConnections` systematiquement skippe** — safe fallback permanent

## Section 2 : Analyse d'impact

### Impact sur les Epics

| Epic | Impact |
|------|--------|
| Epic 5 (en cours) | Ajout Story 5.5 (seuils configurables). Stories 5.1-5.4 non affectees. |
| Epic 6 (backlog) | Aucun impact |
| Epic 7 (nouveau) | Creation avec 2 stories (monitoring reseau Docker + Proxmox) |

### Impact sur les artefacts

| Artefact | Modifications |
|----------|---------------|
| PRD | +3 FRs (FR48-FR50) dans la section Surveillance d'Inactivite |
| Epics | +3 FRs (FR54-FR56), +1 story (5.5), +1 epic (7) avec 2 stories |
| Sprint Status | +3 entrees (5.5, 7.1, 7.2) |
| Architecture | Aucun changement fondamental |
| UI/UX | Impact minimal (sliders seuils + checkbox critere reseau) |

## Section 3 : Approche recommandee

**Option 1 — Ajustement direct** (selectionnee)

- P0 (seuils configurables) → Story 5.5 dans Epic 5 existant. Modification chirurgicale.
- P1/P2 (monitoring reseau) → Nouvel Epic 7 post-MVP. Necessite reflexion archi pour le cache stateful.
- Effort : Low (P0) + Medium (P1/P2)
- Risque : Low
- Timeline : Aucun impact sur le MVP

**Justification :** Le plan existant absorbe ces changements sans reorganisation. P0 renforce le MVP, P1/P2 sont clairement post-MVP.

## Section 4 : Changements appliques

### 4.1 PRD — Nouvelles exigences fonctionnelles

Ajout dans "Surveillance d'Inactivite & Arret Automatique" :
- **FR48** : L'administrateur peut configurer les seuils CPU et RAM de detection d'inactivite par regle (defaut 50%)
- **FR49** : Le systeme detecte l'inactivite reseau des conteneurs Docker via le delta de trafic (rx_bytes/tx_bytes)
- **FR50** : Le systeme detecte l'inactivite reseau des VMs et LXCs via les metriques Proxmox rrddata (netin/netout)

### 4.2 Epics — Requirements Inventory

Ajout dans "Surveillance d'Inactivite & Arret Automatique" :
- **FR54** : Seuils CPU/RAM configurables par regle d'inactivite
- **FR55** : Monitoring reseau Docker (delta rx_bytes/tx_bytes)
- **FR56** : Monitoring reseau Proxmox (netin/netout via rrddata)

FR Coverage Map mis a jour : 56/56 FRs mappes.

### 4.3 Story 5.5 — Seuils CPU/RAM configurables

Ajoutee a l'Epic 5 avec acceptance criteria complets couvrant :
- Extension de `MonitoringCriteria` (cpuThreshold, ramThreshold)
- Suppression des constantes hardcodees
- UI sliders/inputs dans la section regles d'inactivite
- Retrocompatibilite (valeurs par defaut si non definis)
- Adaptation des tests existants

### 4.4 Epic 7 — Monitoring Reseau Avance

Nouvel epic avec 2 stories :
- **Story 7.1** : Monitoring reseau Docker (delta trafic rx_bytes/tx_bytes via Docker stats API)
- **Story 7.2** : Monitoring reseau Proxmox (rrddata netin/netout)

Pattern commun : cache de compteurs reseau par noeud, comparaison delta entre ticks, safe fallback au premier tick.

### 4.5 Sprint Status

Nouvelles entrees ajoutees :
- `5-5-seuils-cpu-ram-configurables: backlog`
- `epic-7: backlog`
- `7-1-monitoring-reseau-docker-delta-trafic: backlog`
- `7-2-monitoring-reseau-proxmox-rrddata: backlog`

## Section 5 : Handoff

| Action | Responsable | Quand |
|--------|-------------|-------|
| Implementer Story 5.5 | Dev | Prochaine session (cloturer Epic 5) |
| Implementer Epic 7 | Dev | Apres Epic 6 (post-MVP) |

**Criteres de succes :**
- Story 5.5 : les seuils sont configurables par regle, les constantes hardcodees sont supprimees, les tests passent
- Epic 7 : la fiabilite du monitoring passe de "Faible/Correct" a "Solide" pour tous les types de noeuds
