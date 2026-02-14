# Story 5.4 : Suppression du critère httpAccess

Status: done

<!-- Créé: 2026-02-14 | Epic 5: Arrêt Automatique sur Inactivité | Course Correction -->
<!-- Ref: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-14-httpaccess.md -->

## Story

As a administrateur,
I want que le critère "Accès HTTP/HTTPS" soit retiré des options de surveillance d'inactivité,
So that les critères de monitoring reflètent uniquement des mesures réelles d'activité (le critère `networkConnections` couvre déjà la détection d'activité HTTP via les connexions TCP).

## Acceptance Criteria (BDD)

### AC1 : Suppression du type MonitoringCriteria

**Given** le type `MonitoringCriteria` dans `packages/shared`
**When** le champ `httpAccess` et `httpUrl` sont retirés
**Then** l'interface ne contient plus que `lastAccess`, `networkConnections` et `cpuRamActivity`
**And** TypeScript compile sans erreur dans les 3 workspaces

### AC2 : Suppression du check backend

**Given** le service `inactivity-monitor.ts` contient `checkHttpAccess()`
**When** la fonction et son appel dans `checkActivity()` sont supprimés
**Then** le moniteur ne vérifie plus l'accessibilité HTTP/HTTPS
**And** les autres critères (`lastAccess`, `networkConnections`, `cpuRamActivity`) continuent de fonctionner

### AC3 : Nettoyage des schemas API

**Given** les routes `inactivity-rules.routes.ts` référencent `httpAccess` et `httpUrl`
**When** ces champs sont retirés des schemas Fastify (request + response) et des types inline
**Then** l'API ne renvoie plus `httpAccess`/`httpUrl` et n'accepte plus ces champs en entrée

### AC4 : Nettoyage du default DB

**Given** le schema DB `schema.ts` a un default JSON incluant `httpAccess: false`
**When** le default est mis à jour
**Then** les nouvelles règles sont créées sans `httpAccess` dans le JSON

### AC5 : Suppression de l'UI

**Given** la section règles d'inactivité affiche une checkbox "Accès HTTP/HTTPS" et un TextInput URL conditionnel
**When** ces éléments sont retirés
**Then** seules 3 checkboxes restent : "Dernier accès", "Connexions réseau", "Activité CPU/RAM"
**And** le champ URL du service n'apparaît plus

### AC6 : Tests mis à jour

**Given** des tests backend et frontend vérifient `httpAccess`
**When** ces tests sont supprimés ou nettoyés
**Then** tous les tests passent (0 régressions)
**And** TypeScript compile sans erreur

## Tasks / Subtasks

- [x] **Task 1 : Supprimer httpAccess/httpUrl du type shared** (AC: #1)
  - [x] 1.1 Dans `packages/shared/src/models/inactivity-rule.ts`, supprimer les lignes 5-6 (`httpAccess: boolean` et `httpUrl?: string`) de l'interface `MonitoringCriteria`

- [x] **Task 2 : Mettre à jour le default DB** (AC: #4)
  - [x] 2.1 Dans `apps/server/src/db/schema.ts:177`, retirer `httpAccess: false` du default JSON :
    ```typescript
    // OLD:
    .$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false, httpAccess: false })),
    // NEW:
    .$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false })),
    ```

- [x] **Task 3 : Nettoyer les routes API** (AC: #3)
  - [x] 3.1 Dans `apps/server/src/routes/inactivity-rules.routes.ts`, retirer `httpAccess` et `httpUrl` de `ruleSchema` (lignes 31-32)
  - [x] 3.2 Retirer `httpAccess` et `httpUrl` de `monitoringCriteriaSchema` (lignes 47-48)
  - [x] 3.3 Retirer `httpAccess: boolean; httpUrl?: string` du type inline du PUT (ligne 118)
  - [x] 3.4 Retirer `httpAccess: boolean; httpUrl?: string` du type inline du POST (ligne 196)

- [x] **Task 4 : Supprimer le check httpAccess du moniteur** (AC: #2)
  - [x] 4.1 Dans `apps/server/src/services/inactivity-monitor.ts`, supprimer le bloc (lignes 197-199) :
    ```typescript
    if (criteria.httpAccess) {
      enabledChecks.push(() => checkHttpAccess(criteria));
    }
    ```
  - [x] 4.2 Supprimer la fonction `checkHttpAccess()` complète (lignes 318-333)

- [x] **Task 5 : Nettoyer les tests backend** (AC: #6)
  - [x] 5.1 Dans `apps/server/src/services/inactivity-monitor.test.ts`, supprimer le describe bloc `checkAllInactivityRules — httpAccess check` (lignes ~848-918) — 4 tests
  - [x] 5.2 Supprimer le test multi-critères `should check both httpAccess and cpuRamActivity when both enabled` (lignes ~935-963)
  - [x] 5.3 Réécrire le test `should consider node inactive only when ALL enabled criteria return inactive` avec `lastAccess + cpuRamActivity` (Option A adaptée — TCP mock séparé du SSH mock)
  - [x] 5.4 Supprimer le test `VM: httpAccess should work the same as physical` (lignes ~1356-1380)
  - [x] 5.5 Retirer `httpAccess: false` de TOUTES les fixtures `monitoringCriteria` dans le fichier (~25 occurrences). Utiliser search-and-replace : `httpAccess: false` → (supprimer la propriété et la virgule précédente)

- [x] **Task 6 : Nettoyer le composant UI** (AC: #5)
  - [x] 6.1 Dans `apps/web/src/features/nodes/inactivity-rules-section.tsx:32`, retirer `| 'httpAccess'` du type `CriteriaKey`
  - [x] 6.2 Retirer les 3 entrées `httpAccess: { label: 'Accès HTTP/HTTPS', disabled: false }` dans `getCriteriaConfig()` (lignes 42, 49, 56)
  - [x] 6.3 Retirer `httpAccess: false, httpUrl: ''` de l'état initial (lignes 80-81)
  - [x] 6.4 Retirer le `renderCriteriaCheckbox('httpAccess', ...)` (ligne 239)
  - [x] 6.5 Retirer le bloc conditionnel `{criteria.httpAccess && (<TextInput .../>)}` (lignes 240-247)
  - [x] 6.6 Si `TextInput` n'est plus utilisé ailleurs dans le fichier, retirer l'import

- [x] **Task 7 : Nettoyer les tests frontend** (AC: #6)
  - [x] 7.1 Dans `apps/web/src/features/nodes/inactivity-rules-section.test.tsx`, retirer `httpAccess: false` du `mockRule` (ligne 33)
  - [x] 7.2 Retirer `httpAccess: false` de l'assertion PUT body (ligne 178)
  - [x] 7.3 Supprimer le test `should display httpAccess checkbox and toggle it` (lignes 257-275)
  - [x] 7.4 Supprimer le test `should show httpUrl TextInput when httpAccess is checked` (lignes 277-301)
  - [x] 7.5 Retirer les assertions `expect(screen.getByLabelText(/accès http\/https/i))` des tests de type de nœud (lignes ~315, ~353, ~386)
  - [x] 7.6 Mettre à jour le test `all criteria checked` — retirer `httpAccess: true` de la fixture (ligne ~396)

- [x] **Task 8 : Vérification finale** (AC: #1, #6)
  - [x] 8.1 Exécuter tous les tests backend : `npm test -w apps/server`
  - [x] 8.2 Exécuter tous les tests frontend : `npm test -w apps/web`
  - [x] 8.3 Vérifier TypeScript : `cd apps/server && npx tsc --noEmit` et `cd apps/web && npx tsc --noEmit`

## Dev Notes

### CONTEXTE — Pourquoi cette suppression

Le critère `httpAccess` envoie un HTTP HEAD vers l'URL du service. Si le service répond (2xx/3xx), le nœud est considéré "actif". **Problème** : c'est un health check, pas un détecteur d'activité. Tant que le service web tourne (même sans aucun utilisateur), le check retourne toujours "actif", rendant l'arrêt automatique impossible.

Le critère `networkConnections` (SSH `ss -tun state established`, exclusion port 22) détecte déjà l'activité HTTP réelle via les connexions TCP établies.

**Ref :** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-14-httpaccess.md`

### Patterns architecturaux CRITIQUES à respecter

1. **Fonctions exportées, PAS de classes** — `inactivity-monitor.ts` exporte des fonctions, state dans variables de module.
2. **MonitoringCriteria** est un type shared utilisé par backend + frontend — la modification dans `packages/shared` se propage automatiquement via les workspaces npm.
3. **Pas de migration DB nécessaire** — `monitoring_criteria` est un champ JSON texte. Les données existantes avec `httpAccess` seront simplement ignorées (TypeScript ne les verra plus, SQLite les garde).
4. **Pas de changement d'API REST endpoints** — Les routes restent les mêmes, seul le contenu du JSON `monitoringCriteria` change.

### Détails d'implémentation

#### Task 5.3 — Attention : test multi-critères

Le test `should consider node inactive only when ALL enabled criteria return inactive` (lignes ~965-976) est le **seul test** qui vérifie le comportement "inactif seulement si TOUS les critères disent inactif". Il utilise `httpAccess + cpuRamActivity`.

**Option A (recommandée)** : Réécrire ce test avec `networkConnections + cpuRamActivity` au lieu de `httpAccess + cpuRamActivity` — même logique, pas de perte de couverture.

**Option B** : Supprimer et considérer que le test multi-critères `should check both httpAccess and cpuRamActivity` (lignes ~935-963) couvre déjà ce comportement — mais on perd le test.

#### Task 5.5 — Pattern de nettoyage des fixtures

Toutes les fixtures de test utilisent ce pattern :
```typescript
monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true, httpAccess: false }
```

Après nettoyage :
```typescript
monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true }
```

Attention : certaines fixtures ont `httpAccess: true` avec `httpUrl` — celles-ci sont dans les tests à supprimer (Tasks 5.1-5.4), donc elles disparaissent avec les tests.

#### Task 6.6 — Vérifier l'import TextInput

Le `TextInput` de Mantine était utilisé uniquement pour le champ `httpUrl`. Vérifier s'il est utilisé ailleurs dans le fichier avant de retirer l'import.

### Fichiers à modifier

| Fichier | Modification | Task |
|---------|-------------|------|
| `packages/shared/src/models/inactivity-rule.ts` | Retirer `httpAccess`, `httpUrl` de l'interface | 1 |
| `apps/server/src/db/schema.ts` | Retirer `httpAccess: false` du default | 2 |
| `apps/server/src/routes/inactivity-rules.routes.ts` | Retirer des schemas + types inline | 3 |
| `apps/server/src/services/inactivity-monitor.ts` | Supprimer bloc `if` + fonction `checkHttpAccess` | 4 |
| `apps/server/src/services/inactivity-monitor.test.ts` | Supprimer tests httpAccess + nettoyer fixtures | 5 |
| `apps/web/src/features/nodes/inactivity-rules-section.tsx` | Retirer checkbox, TextInput, type, config | 6 |
| `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` | Supprimer tests httpAccess + nettoyer fixtures | 7 |

### Fichiers NON modifiés (confirmation)

- `apps/server/src/connectors/*` — Aucune référence à httpAccess
- `apps/web/src/api/inactivity-rules.api.ts` — Pas de référence directe (utilise le type shared)
- `packages/shared/src/api/inactivity-rules.ts` — Pas de référence directe
- Aucune migration Drizzle nécessaire — le JSON existant est simplement ignoré

### Project Structure Notes

- Monorepo npm workspaces : modifier `packages/shared` affecte automatiquement `apps/web` et `apps/server`
- Tests co-localisés : `foo.test.ts` à côté de `foo.ts`
- Ordre de modification recommandé : shared → server (schema, routes, service) → web (composant) → tests → vérification

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-14-httpaccess.md — justification complète]
- [Source: packages/shared/src/models/inactivity-rule.ts:5-6 — propriétés à supprimer]
- [Source: apps/server/src/db/schema.ts:177 — default JSON à nettoyer]
- [Source: apps/server/src/routes/inactivity-rules.routes.ts:31-32,47-48,118,196 — schemas et types]
- [Source: apps/server/src/services/inactivity-monitor.ts:197-199 — bloc if httpAccess]
- [Source: apps/server/src/services/inactivity-monitor.ts:318-333 — fonction checkHttpAccess]
- [Source: apps/web/src/features/nodes/inactivity-rules-section.tsx:32,42,49,56,80-81,239-247 — UI]
- [Source: apps/server/src/services/inactivity-monitor.test.ts:848-918,935-976,1356-1380 — tests backend]
- [Source: apps/web/src/features/nodes/inactivity-rules-section.test.tsx:257-301,315,353,386 — tests frontend]

### Intelligence Git (commits récents)

- `aa247c9` feat: implement Epic 4 (cascade, SSE, dashboard) + code review fixes
- Stories 5.1-5.3 non-committées sur la branche `nouvel-axe`
- L'architecture `checkActivity()` avec array de checks extensible a été conçue pour être facilement modifiable

### Intelligence Story 5.3 (précédente)

- Mock `vi.hoisted()` obligatoire pour variables mock dans `vi.mock()` factories
- `insertNode` helper avec `!== undefined` check pour supporter explicitement `null`
- `fetchSpy = vi.spyOn(globalThis, 'fetch')` pour mocker les appels HTTP — à supprimer avec les tests httpAccess
- 551 tests total (358 backend + 193 frontend) avant cette story

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- Task 1: Supprimé `httpAccess: boolean` et `httpUrl?: string` de l'interface `MonitoringCriteria` dans packages/shared
- Task 2: Retiré `httpAccess: false` du default JSON dans le schema DB
- Task 3: Nettoyé `httpAccess`/`httpUrl` des schemas Fastify (`ruleSchema`, `monitoringCriteriaSchema`) et des types inline PUT/POST
- Task 4: Supprimé le bloc `if (criteria.httpAccess)` et la fonction `checkHttpAccess()` entière du moniteur d'inactivité
- Task 5: Supprimé 6 tests httpAccess backend (4 tests httpAccess, 1 multi-critères httpAccess+cpuRam, 1 VM httpAccess). Réécrit le test multi-critères "ALL criteria inactive" avec `lastAccess + cpuRamActivity` (TCP mock séparé du SSH mock). Nettoyé ~25 occurrences `httpAccess: false` des fixtures via replace_all.
- Task 6: Retiré `httpAccess` du type `CriteriaKey`, des 3 configs de `getCriteriaConfig()`, de l'état initial, du rendu checkbox, du TextInput conditionnel. Supprimé l'import `TextInput` inutilisé.
- Task 7: Nettoyé le mockRule, l'assertion PUT body, supprimé 2 tests httpAccess (checkbox + TextInput), retiré les assertions `accès http/https` des tests de type. Corrigé 2 tests container pré-existants (mauvais label `(tcp)` → `(cpu/ram docker)` et assertion disabled incorrecte).
- Task 8: 352 tests backend + 191 tests frontend = 543 tests PASS. TypeScript compile sans erreur dans les 2 workspaces.

### File List

- `packages/shared/src/models/inactivity-rule.ts` — Retiré `httpAccess`, `httpUrl` de MonitoringCriteria
- `apps/server/src/db/schema.ts` — Retiré `httpAccess: false` du default JSON inactivityRules
- `apps/server/src/routes/inactivity-rules.routes.ts` — Retiré `httpAccess`/`httpUrl` des schemas et types inline
- `apps/server/src/services/inactivity-monitor.ts` — Supprimé bloc `if (criteria.httpAccess)` et fonction `checkHttpAccess()`
- `apps/server/src/services/inactivity-monitor.test.ts` — Supprimé tests httpAccess, nettoyé fixtures, réécrit test multi-critères
- `apps/web/src/features/nodes/inactivity-rules-section.tsx` — Retiré checkbox httpAccess, TextInput URL, type, config, import
- `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` — Supprimé tests httpAccess, nettoyé fixtures, corrigé tests container

### Change Log

- 2026-02-14: Suppression complète du critère `httpAccess` — type shared, schema DB, routes API, moniteur backend, UI frontend, tests backend et frontend nettoyés. 543 tests PASS, TypeScript clean.
- 2026-02-14: Code Review fix — (M3) forcer critères disabled à false dans le state UI lors du sync formulaire. 554 tests (358+196), 0 régressions.
