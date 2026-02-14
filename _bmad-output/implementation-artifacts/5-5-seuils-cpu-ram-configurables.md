# Story 5.5: Seuils CPU/RAM configurables par regle d'inactivite

Status: done

## Story

As a administrateur,
I want configurer les seuils CPU et RAM de detection d'inactivite par regle,
so that je peux adapter la sensibilite du monitoring a chaque type de noeud.

## Acceptance Criteria

1. **Given** l'interface `MonitoringCriteria` existe dans `packages/shared`
   **When** cette story est implementee
   **Then** deux champs optionnels sont ajoutes : `cpuThreshold?: number` (defaut 0.5) et `ramThreshold?: number` (defaut 0.5)

2. **Given** les constantes `CPU_LOAD_THRESHOLD` et `RAM_USAGE_THRESHOLD` sont hardcodees dans `inactivity-monitor.ts`
   **When** cette story est implementee
   **Then** le moteur de monitoring lit les seuils depuis la regle d'inactivite du noeud
   **And** les constantes hardcodees sont supprimees
   **And** si les seuils ne sont pas definis dans la regle, les valeurs par defaut (0.5) sont utilisees

3. **Given** la section "Regles d'inactivite" existe dans la page detail noeud
   **When** le critere `cpuRamActivity` est active
   **Then** deux champs numeriques apparaissent : "Seuil CPU (%)" et "Seuil RAM (%)"
   **And** les valeurs sont validees entre 1 et 100 (UI) / 0.01 et 1.0 (backend)
   **And** les valeurs par defaut sont pre-remplies (50%)

4. **Given** une regle existante n'a pas de seuils definis (donnees pre-migration)
   **When** le moniteur verifie l'activite
   **Then** les valeurs par defaut (0.5) sont utilisees sans erreur

5. **Given** les tests existants referent aux seuils
   **When** cette story est implementee
   **Then** les tests sont adaptes pour utiliser les seuils depuis la regle au lieu des constantes

## Tasks / Subtasks

- [x] Task 1 — Etendre le type shared `MonitoringCriteria` (AC: #1)
  - [x] 1.1 Ajouter `cpuThreshold?: number` et `ramThreshold?: number` a `MonitoringCriteria`
- [x] Task 2 — Mettre a jour le backend API (AC: #2, #4)
  - [x] 2.1 Mettre a jour `monitoringCriteriaSchema` dans les routes (validation JSON Schema)
  - [x] 2.2 Mettre a jour `ruleSchema` (reponse) pour inclure les seuils
  - [x] 2.3 Pas de migration DB necessaire (JSON column absorbe les nouveaux champs)
- [x] Task 3 — Refactorer le moteur de monitoring (AC: #2, #4)
  - [x] 3.1 Passer les seuils de la regle a `checkActivity()` et aux fonctions de check
  - [x] 3.2 Renommer `CPU_LOAD_THRESHOLD` → `DEFAULT_CPU_THRESHOLD`, `RAM_USAGE_THRESHOLD` → `DEFAULT_RAM_THRESHOLD`
  - [x] 3.3 Utiliser `criteria.cpuThreshold ?? DEFAULT_CPU_THRESHOLD` et `criteria.ramThreshold ?? DEFAULT_RAM_THRESHOLD`
  - [x] 3.4 Appliquer aux 3 endroits (checkCpuRamActivity SSH, platformStats direct, container lastAccess fallback)
- [x] Task 4 — Mettre a jour l'UI (AC: #3)
  - [x] 4.1 Etat local pour cpuThreshold/ramThreshold via criteria state (deja dans MonitoringCriteria)
  - [x] 4.2 Deux `NumberInput` Mantine conditionnels (visibles si cpuRamActivity active)
  - [x] 4.3 Conversion UI (1-100 %) ↔ backend (0.01-1.0) dans render/onChange
  - [x] 4.4 Seuils inclus automatiquement dans le body PUT/POST via criteria state
- [x] Task 5 — Tests (AC: #5)
  - [x] 5.1 Tests backend existants passent sans modification (utilisent valeur 0.5 qui est le default)
  - [x] 5.2 +6 tests backend pour seuils custom (CPU 0.3, RAM 0.7, strict 0.9, defaults, VM Proxmox, Docker container)
  - [x] 5.3 Tests frontend existants passent sans modification
  - [x] 5.4 +5 tests frontend (affichage conditionnel, valeurs custom, toggle checkbox, PUT body avec seuils)

## Dev Notes

### Decision architecturale : Seuils dans MonitoringCriteria (pas colonnes separees)

Les seuils sont stockes dans le JSON `monitoringCriteria` de la table `inactivity_rules`, **pas** comme colonnes separees. Raisons :
- Le JSON est deja le pattern etabli pour les criteres
- Pas besoin de migration DB — le JSON absorbe les nouveaux champs
- Les regles existantes sans seuils retournent `undefined` → fallback 0.5
- Coherent avec l'extensibilite future (Story 7.1 ajoutera `networkTraffic` + `networkTrafficThreshold` au meme endroit)

### Stockage interne vs affichage UI

- **Backend/shared** : ratio 0.01-1.0 (ex: 0.5 = 50%)
- **UI** : pourcentage 1-100 (ex: 50 = 50%)
- Conversion dans le composant React, pas dans l'API

### Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `packages/shared/src/models/inactivity-rule.ts` | Ajouter `cpuThreshold?: number`, `ramThreshold?: number` a `MonitoringCriteria` |
| `apps/server/src/routes/inactivity-rules.routes.ts` | Etendre `monitoringCriteriaSchema` (L39-47) et `ruleSchema` (L25-32) avec les champs numeriques optionnels |
| `apps/server/src/services/inactivity-monitor.ts` | Supprimer constantes L24-25, passer criteria aux fonctions de check, utiliser `?? 0.5` |
| `apps/web/src/features/nodes/inactivity-rules-section.tsx` | Ajouter etat + NumberInput conditionnels + conversion % |
| `apps/server/src/services/inactivity-monitor.test.ts` | Adapter les ~10 tests qui referent aux seuils hardcodes |
| `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` | Adapter mockRule + ajouter tests seuils |

### Endroits precis ou les seuils hardcodes sont utilises

Dans `inactivity-monitor.ts`, 3 endroits comparent `CPU_LOAD_THRESHOLD` / `RAM_USAGE_THRESHOLD` :

1. **L173-176** — Container `lastAccess` fallback (platformStats):
   ```typescript
   enabledChecks.push(async () =>
     stats.cpuUsage > CPU_LOAD_THRESHOLD || stats.ramUsage > RAM_USAGE_THRESHOLD,
   );
   ```

2. **L191** — `cpuRamActivity` avec platformStats (VM/LXC/container):
   ```typescript
   enabledChecks.push(async () => stats.cpuUsage > CPU_LOAD_THRESHOLD || stats.ramUsage > RAM_USAGE_THRESHOLD);
   ```

3. **L307** — `checkCpuRamActivity` via SSH (physical):
   ```typescript
   return cpuLoad > CPU_LOAD_THRESHOLD || ramUsage > RAM_USAGE_THRESHOLD;
   ```

→ Les 3 doivent recevoir les seuils de la regle.

### Signature de checkActivity a adapter

Actuellement :
```typescript
async function checkActivity(
  node: NodeRow,
  criteria: MonitoringCriteria,
  decryptFn: ...,
  parentMap: ...,
): Promise<boolean>
```

Les seuils sont deja dans `criteria` (meme interface), donc la signature ne change pas. Il suffit de lire `criteria.cpuThreshold ?? 0.5` a l'interieur.

Pour `checkCpuRamActivity`, ajouter les seuils en parametres :
```typescript
async function checkCpuRamActivity(
  node: NodeRow,
  decryptFn: ...,
  cpuThreshold: number,
  ramThreshold: number,
): Promise<boolean>
```

### Patterns frontend a suivre (d'apres Story 5.2)

- TanStack Query hooks dans `inactivity-rules.api.ts` (`useInactivityRule`, `useUpdateInactivityRule`, `useCreateInactivityRule`)
- Composant `InactivityRulesSection` avec props `nodeId` et `nodeType`
- Mantine `NumberInput` (deja importe pour `timeoutMinutes`)
- `useEffect` pour sync formulaire ← donnees serveur
- `handleSave()` construit le body PUT/POST

### Tests backend — patterns critiques (d'apres Story 5.1/5.3)

- `vi.hoisted()` obligatoire pour les mock variables dans `vi.mock()`
- Mock `NodeSSH` avec classe qui expose `connect`, `execCommand`, `dispose`
- `insertRule()` helper pour creer des regles de test — ajouter cpuThreshold/ramThreshold en parametres
- Les tests de platformStats mockent `getConnector()` → verifier que les seuils custom sont respectes

### Tests frontend — patterns critiques (d'apres Story 5.2)

- Wrapper render : `QueryClientProvider` + `MantineProvider` + `MemoryRouter`
- `userEvent` pour interactions, `vi.waitFor()` pour assertions async
- Mock `fetch` global pour intercepter les appels API
- Verifier le body du PUT/POST dans le spy fetch

### Validation JSON Schema backend

Schema actuel `monitoringCriteriaSchema` (L39-47) :
```json
{
  "type": "object",
  "properties": {
    "lastAccess": { "type": "boolean" },
    "networkConnections": { "type": "boolean" },
    "cpuRamActivity": { "type": "boolean" }
  }
}
```

Ajouter :
```json
{
  "cpuThreshold": { "type": "number", "minimum": 0.01, "maximum": 1.0 },
  "ramThreshold": { "type": "number", "minimum": 0.01, "maximum": 1.0 }
}
```

### Project Structure Notes

- Monorepo npm workspaces : `apps/web`, `apps/server`, `packages/shared`
- Types shared se propagent automatiquement entre workspaces
- Pas de migration Drizzle necessaire (JSON column)
- Tests : `npm test -w apps/web` (vitest jsdom), `npm test -w apps/server` (vitest)
- TypeScript check : `cd apps/web && npx tsc --noEmit` + `cd apps/server && npx tsc --noEmit`

### References

- [Source: packages/shared/src/models/inactivity-rule.ts] — MonitoringCriteria interface
- [Source: apps/server/src/services/inactivity-monitor.ts#L24-25] — Constantes hardcodees a supprimer
- [Source: apps/server/src/services/inactivity-monitor.ts#L173-176,L191,L307] — 3 endroits de comparaison
- [Source: apps/server/src/routes/inactivity-rules.routes.ts#L39-47] — Schema validation
- [Source: apps/web/src/features/nodes/inactivity-rules-section.tsx#L72-76] — Form state
- [Source: _bmad-output/implementation-artifacts/5-3-implementation-des-vrais-criteres-de-surveillance.md] — Corrections Docker CPU/RAM
- [Source: _bmad-output/planning-artifacts/session-backup-2026-02-14-monitoring-avance.md] — Decisions de la session Party Mode

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- AC #1: `MonitoringCriteria` extended with `cpuThreshold?: number` and `ramThreshold?: number`
- AC #2: Hardcoded constants renamed to `DEFAULT_CPU_THRESHOLD`/`DEFAULT_RAM_THRESHOLD`, monitoring engine reads thresholds from rule criteria with `?? 0.5` fallback at 3 comparison sites
- AC #3: Two conditional `NumberInput` components (1-100%) appear when `cpuRamActivity` checkbox is enabled, conversion to 0-1 ratio on save
- AC #4: Rules without thresholds use defaults (0.5) seamlessly — no migration needed
- AC #5: +6 backend tests, +5 frontend tests, 0 regressions (554 total: 196 web + 358 server)

### Change Log

- 2026-02-14: Story 5.5 implemented — configurable CPU/RAM thresholds per inactivity rule
- 2026-02-14: Code Review fix — (L2) initialiser seuils à 0.5 quand l'utilisateur active cpuRamActivity pour la première fois. 554 tests (358+196), 0 régressions.

### File List

- `packages/shared/src/models/inactivity-rule.ts` — added cpuThreshold/ramThreshold to MonitoringCriteria
- `apps/server/src/routes/inactivity-rules.routes.ts` — extended ruleSchema + monitoringCriteriaSchema + Body types
- `apps/server/src/services/inactivity-monitor.ts` — refactored to use configurable thresholds from rule criteria
- `apps/server/src/services/inactivity-monitor.test.ts` — +6 threshold tests
- `apps/web/src/features/nodes/inactivity-rules-section.tsx` — added conditional NumberInput for CPU/RAM thresholds
- `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` — +5 threshold tests
