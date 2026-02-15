# Sprint Change Proposal — Suppression du critère httpAccess

**Date :** 2026-02-14
**Déclencheur :** Story 5.3 — Implémentation des vrais critères de surveillance
**Scope :** Minor — Implémentation directe par l'agent développeur

## Section 1 : Résumé du problème

Le critère de monitoring `httpAccess` (Accès HTTP/HTTPS) implémenté dans Story 5.3 est un **health check** déguisé en détecteur d'activité. Il envoie un HTTP HEAD vers l'URL du service — si le service répond (2xx/3xx), le nœud est considéré actif. Conséquence : tant que le service web tourne, le check retourne toujours "actif", même sans aucun utilisateur.

Le critère `networkConnections` (connexions TCP via SSH `ss -tun`) détecte déjà l'activité HTTP réelle (connexions TCP établies sur les ports 80/443 par de vrais utilisateurs).

**Décision : supprimer complètement `httpAccess` et `httpUrl` du modèle, de la DB, de l'UI et des checks.**

## Section 2 : Impact Analysis

### Epic Impact

- **Epic 5** (Arrêt Automatique sur Inactivité) — seul epic impacté, changement simplifiant
- **Epics 1-4, 6** — aucun impact

### Artifact Impacts

| Artefact | Impact |
|---|---|
| PRD (FR29) | Retirer "accessibilité HTTP/HTTPS du service" de la liste des critères |
| Epics (FR34, Story 5.3) | Retirer AC3, simplifier AC4 (retirer httpAccess checkbox + httpUrl) |
| UX | 1 checkbox en moins dans la section règles d'inactivité |
| Architecture | Aucun impact |

## Section 3 : Approche recommandée — Direct Adjustment

- **Effort :** Low — suppression de code et de champs, pas d'ajout
- **Risque :** Low — on retire une fonctionnalité non fonctionnelle
- **Timeline :** Aucun impact — c'est une simplification

## Section 4 : Changements détaillés par fichier

### 4.1 Shared types

**Fichier : `packages/shared/src/models/inactivity-rule.ts`**

```
OLD:
export interface MonitoringCriteria {
  lastAccess: boolean;
  networkConnections: boolean;
  cpuRamActivity: boolean;
  httpAccess: boolean;
  httpUrl?: string;
}

NEW:
export interface MonitoringCriteria {
  lastAccess: boolean;
  networkConnections: boolean;
  cpuRamActivity: boolean;
}
```

Rationale : Le critère n'a plus de raison d'exister.

### 4.2 DB Schema

**Fichier : `apps/server/src/db/schema.ts:177`**

```
OLD:
  .$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false, httpAccess: false }))

NEW:
  .$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false }))
```

**+ Migration SQL** : Nouvelle migration pour nettoyer les données existantes (retirer `httpAccess` et `httpUrl` du JSON `monitoring_criteria`).

### 4.3 Routes API

**Fichier : `apps/server/src/routes/inactivity-rules.routes.ts`**

- Retirer `httpAccess` et `httpUrl` des schemas JSON Fastify (request + response)
- Retirer des types inline dans les generics PUT et POST

### 4.4 Inactivity Monitor

**Fichier : `apps/server/src/services/inactivity-monitor.ts`**

- Supprimer le bloc `if (criteria.httpAccess)` (lignes 197-199)
- Supprimer la fonction `checkHttpAccess()` complète (lignes 318-333)

### 4.5 Tests Backend

**Fichier : `apps/server/src/services/inactivity-monitor.test.ts`**

- Supprimer le describe `checkAllInactivityRules — httpAccess check` (~lignes 848-980) — 6 tests
- Supprimer le test `VM: httpAccess should work the same as physical` (~ligne 1356)
- Retirer `httpAccess: false` de toutes les fixtures `monitoringCriteria` (~25 occurrences)

### 4.6 Frontend UI

**Fichier : `apps/web/src/features/nodes/inactivity-rules-section.tsx`**

- Retirer `httpAccess` du type `CriteriaKey`
- Retirer les entrées `httpAccess` des 3 configs de `getCriteriaConfig()`
- Retirer le `renderCriteriaCheckbox('httpAccess', ...)` et le `TextInput` conditionnel pour `httpUrl`
- Retirer `httpAccess: false, httpUrl: ''` de l'état initial du formulaire

### 4.7 Tests Frontend

**Fichier : `apps/web/src/features/nodes/inactivity-rules-section.test.tsx`**

- Supprimer le test `should display httpAccess checkbox and toggle it`
- Supprimer le test `should show httpUrl TextInput when httpAccess is checked`
- Retirer `httpAccess: false` des fixtures mockRule
- Mettre à jour les assertions qui vérifient que `httpAccess` est enabled

### 4.8 Documents planning

**Fichier : `_bmad-output/planning-artifacts/prd.md`**

- FR29 : Retirer "accessibilité HTTP/HTTPS du service" de la liste des critères

**Fichier : `_bmad-output/planning-artifacts/epics.md`**

- FR34 : Retirer "accessibilité HTTP/HTTPS du service"
- Story 5.3 : Retirer AC3 (vérification HTTP/HTTPS), simplifier AC4 (retirer httpAccess checkbox + httpUrl)

## Section 5 : Handoff

**Scope :** Minor — Implémentation directe par l'agent développeur

**Livrables :**
1. Modifications code selon les changements détaillés ci-dessus (Sections 4.1 à 4.5)
2. Migration DB pour nettoyer les données existantes
3. Tests mis à jour (suppression des tests httpAccess, nettoyage fixtures)
4. Documents planning mis à jour (PRD, Epics — Sections 4.6 à 4.8)
5. Vérification complète : tous les tests passent, TypeScript 0 erreurs

**Approuvé par :** Drunkrain — 2026-02-14
