# Story 5.2 : Protection des dépendances & configuration UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Créé: 2026-02-14 | Epic 5: Arrêt Automatique sur Inactivité | FRs: FR38-FR39, FR36-FR37 -->

## Story

As a administrateur,
I want que l'arrêt automatique respecte les dépendances et pouvoir configurer les règles d'inactivité,
So that mes services partagés ne sont jamais éteints par erreur.

## Acceptance Criteria (BDD)

### AC1 : Protection des dépendances partagées lors d'un arrêt automatique

**Given** un arrêt automatique est déclenché par le moniteur d'inactivité
**When** la cascade d'arrêt rencontre une dépendance partagée avec un dépendant actif
**Then** la dépendance est sautée (reste active)
**And** la raison est enregistrée dans les logs

### AC2 : Annulation d'arrêt si dépendant actif sur le nœud

**Given** un arrêt automatique est sur le point de se déclencher
**When** un dépendant actif est détecté sur le nœud lui-même
**Then** l'arrêt automatique est complètement annulé
**And** la raison est enregistrée dans les logs

### AC3 : Section configuration des règles d'inactivité (UI)

**Given** je suis sur la page de détail d'un nœud
**When** la section "Règles d'inactivité" est affichée
**Then** je peux configurer : activer/désactiver (toggle), délai en minutes (défaut 30), critères de surveillance (checkboxes)

### AC4 : Sauvegarde des règles d'inactivité

**Given** je modifie les règles d'inactivité
**When** je clique sur "Enregistrer"
**Then** les règles sont sauvegardées en base
**And** le moniteur prend en compte les nouvelles règles au prochain cycle
**And** un toast de succès s'affiche

### AC5 : Désactivation de la surveillance

**Given** je désactive la surveillance pour un nœud
**When** le toggle est désactivé
**Then** le moniteur ignore ce nœud et il reste actif indéfiniment

## Tasks / Subtasks

- [x] **Task 1 : Vérification des dépendants actifs dans le moniteur** (AC: #2)
  - [x] 1.1 Importer `getDownstreamDependents` depuis `dependency-graph.ts` dans `inactivity-monitor.ts`
  - [x] 1.2 Dans `checkAllInactivityRules`, avant d'appeler `triggerAutoShutdown`, vérifier si le nœud a des dépendants actifs (status !== 'offline')
  - [x] 1.3 Si dépendants actifs trouvés → skip l'arrêt auto, logger la raison (level 'info', source 'inactivity-monitor'), remettre le compteur à 0
  - [x] 1.4 Ajouter les tests unitaires (3+ tests) : dépendant actif bloque l'arrêt, dépendant offline ne bloque pas, log est enregistré

- [x] **Task 2 : Test d'intégration protection deps partagées** (AC: #1)
  - [x] 2.1 Vérifier que `executeCascadeStop` (déjà implémenté) protège les deps partagées — écrire un test d'intégration dans `inactivity-monitor.test.ts` qui simule un scénario complet : nœud A dépend de B, nœud C dépend aussi de B, arrêt auto de A → B doit rester actif
  - [x] 2.2 Vérifier que le log de protection est enregistré avec la bonne raison

- [x] **Task 3 : API hooks frontend pour les règles d'inactivité** (AC: #3, #4, #5)
  - [x] 3.1 Créer `apps/web/src/api/inactivity-rules.api.ts`
  - [x] 3.2 Implémenter `useInactivityRules(nodeId)` — GET /api/inactivity-rules?nodeId=X
  - [x] 3.3 Implémenter `useCreateInactivityRule()` — POST /api/inactivity-rules (status 201)
  - [x] 3.4 Implémenter `useUpdateInactivityRule()` — PUT /api/inactivity-rules/:id

- [x] **Task 4 : Section "Règles d'inactivité" dans la page détail nœud** (AC: #3, #4, #5)
  - [x] 4.1 Créer `apps/web/src/features/nodes/inactivity-rules-section.tsx`
  - [x] 4.2 Afficher un état "Aucune règle" avec bouton "Configurer" si aucune règle n'existe → POST pour créer avec valeurs par défaut
  - [x] 4.3 Afficher la section de configuration quand une règle existe : Switch (toggle isEnabled), NumberInput (timeoutMinutes, min 1), Checkboxes (critères monitoring)
  - [x] 4.4 Bouton "Enregistrer" → PUT pour mettre à jour la règle existante
  - [x] 4.5 Toast de succès/erreur via Mantine Notifications
  - [x] 4.6 Intégrer la section dans `node-detail-page.tsx` (après "Dépendances fonctionnelles", avant "Contrôle d'alimentation")

- [x] **Task 5 : Tests frontend** (AC: #3, #4, #5)
  - [x] 5.1 Créer `apps/web/src/features/nodes/inactivity-rules-section.test.tsx`
  - [x] 5.2 Tester : affichage état vide, affichage règle existante, toggle enable/disable, modification timeout, sauvegarde
  - [x] 5.3 Tester : état loading, gestion erreur

## Dev Notes

### Patterns architecturaux CRITIQUES à respecter

1. **Fonctions exportées, PAS de classes** — Le `inactivity-monitor.ts` exporte des fonctions async pures. Le state est dans des variables de module.

2. **Protection deps partagées DÉJÀ IMPLÉMENTÉE dans cascade-engine** — La fonction `cleanupUpstream` dans `cascade-engine.ts:558-582` vérifie les dépendants actifs (fonctionnels + structurels) et skip les deps partagées. Le moniteur d'inactivité utilise `executeCascadeStop` qui appelle `cleanupUpstream`. **AC1 est donc déjà couvert par le code existant** — il faut juste le vérifier avec un test d'intégration.

3. **AC2 est la vraie nouveauté backend** — Avant de déclencher la cascade, le moniteur doit vérifier si le nœud CIBLE lui-même a des dépendants actifs. Si oui, annuler complètement l'arrêt auto. Utiliser `getDownstreamDependents(nodeId, db)` de `dependency-graph.ts` qui retourne les nœuds qui dépendent de ce nœud.

4. **Format API unifié** — `{ data: { ... } }` en succès, `{ error: { code, message, details? } }` en erreur. POST retourne **201** (corrigé dans code review story 5.1).

5. **Frontend API hooks pattern** — Suivre le pattern de `apps/web/src/api/nodes.api.ts` et `apps/web/src/api/dependencies.api.ts` :
   - `useQuery` avec `queryKey` unique et `enabled` conditionnel
   - `useMutation` avec `onSuccess` → `queryClient.invalidateQueries`
   - `apiFetch` comme client HTTP (wrapper fetch avec credentials)
   - Types importés depuis `@wakehub/shared`

6. **Composants Mantine v7** — Utiliser :
   - `Switch` pour le toggle enable/disable
   - `NumberInput` pour le timeout en minutes (min: 1)
   - `Checkbox` pour les critères de monitoring
   - `Card` avec `withBorder` pour la section (pattern de `node-detail-page.tsx`)
   - `notifications.show()` pour les toasts succès/erreur

7. **Tests frontend** — Pattern de `node-detail-page.test.tsx` :
   - Render avec `QueryClientProvider` + `MantineProvider` + `MemoryRouter`
   - Mock `fetch` avec routing par URL
   - `userEvent` pour les interactions
   - `vi.waitFor()` pour les assertions async
   - `vi.hoisted()` pour les variables mock dans `vi.mock()` factory functions

### Détails d'implémentation

#### Backend : Vérification dépendants actifs (Task 1)

```typescript
// Dans checkAllInactivityRules, AVANT triggerAutoShutdown :
import { getDownstreamDependents } from './dependency-graph.js';

// Vérifier si le nœud a des dépendants actifs
const dependents = await getDownstreamDependents(node.id, db);
const activeDependents = dependents.filter(d => d.status !== 'offline');

if (activeDependents.length > 0) {
  // Annuler l'arrêt auto — dépendant actif détecté
  const names = activeDependents.map(d => d.name).join(', ');
  await logOperation(db, 'info', 'inactivity-monitor',
    `Arrêt automatique annulé pour ${node.name} — dépendants actifs: ${names}`,
    'Dépendant actif détecté',
    { nodeId: node.id, ruleId: rule.id, activeDependents: names },
  );
  inactivityCounters.set(rule.nodeId, 0); // Reset counter
  continue; // Skip to next rule
}
```

**Attention :** `getDownstreamDependents` accepte `(nodeId: string, db: DB)` et retourne `ChainNode[]` avec `{ nodeId, name, status }`.

#### Frontend : Section Règles d'inactivité (Task 4)

La section doit s'intégrer dans `node-detail-page.tsx` comme une `Card` additionnelle. Deux états :

**État 1 — Aucune règle :**
```
[Card "Règles d'inactivité"]
  Aucune règle configurée.
  [Bouton "Configurer la surveillance"]  → POST crée une règle avec defaults
```

**État 2 — Règle existante :**
```
[Card "Règles d'inactivité"]
  [Switch] Surveillance active
  ─────────────────────────────
  Délai d'inactivité : [NumberInput] minutes
  Critères de surveillance :
    [✓] Dernier accès (TCP check)
    [ ] Connexions réseau (bientôt)
    [ ] Activité CPU/RAM (bientôt)
  ─────────────────────────────
  [Bouton "Enregistrer"]
```

Les critères `networkConnections` et `cpuRamActivity` sont des stubs côté backend (retournent toujours "actif"). Côté UI, ils sont affichables mais désactivés avec un label "(bientôt)" pour indiquer qu'ils ne sont pas encore implémentés.

#### Types partagés existants

```typescript
// packages/shared/src/models/inactivity-rule.ts
export interface MonitoringCriteria {
  lastAccess: boolean;
  networkConnections: boolean;
  cpuRamActivity: boolean;
}

export interface InactivityRule {
  id: string;
  nodeId: string;
  timeoutMinutes: number;
  monitoringCriteria: MonitoringCriteria;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// packages/shared/src/api/inactivity-rules.ts
export interface CreateInactivityRuleRequest {
  nodeId: string;
  timeoutMinutes?: number;
  monitoringCriteria?: MonitoringCriteria;
  isEnabled?: boolean;
}

export interface UpdateInactivityRuleRequest {
  timeoutMinutes?: number;
  monitoringCriteria?: MonitoringCriteria;
  isEnabled?: boolean;
}
```

#### Routes API existantes

| Route | Méthode | Description | Status |
|-------|---------|-------------|--------|
| `/api/inactivity-rules?nodeId=X` | GET | Retourne les règles pour un nœud | 200 |
| `/api/inactivity-rules` | POST | Crée une règle | 201 |
| `/api/inactivity-rules/:id` | PUT | Met à jour une règle | 200 |

**Pas de DELETE** — la suppression n'est pas dans le scope. Désactiver la règle (isEnabled=false) suffit.

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `apps/web/src/api/inactivity-rules.api.ts` | Hooks TanStack Query pour les règles d'inactivité |
| `apps/web/src/features/nodes/inactivity-rules-section.tsx` | Section UI pour la page détail nœud |
| `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` | Tests de la section UI |

### Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/services/inactivity-monitor.ts` | Ajout vérification dépendants actifs avant arrêt auto |
| `apps/server/src/services/inactivity-monitor.test.ts` | Tests dépendants actifs + test intégration deps partagées |
| `apps/web/src/features/nodes/node-detail-page.tsx` | Import et intégration de `InactivityRulesSection` |

### Patterns de test (de Story 5.1 code review)

- **`vi.hoisted()`** obligatoire pour les variables mock utilisées dans `vi.mock()` factory functions
- **Zustand store reset** : `useCascadeStore.setState({ cascades: {} })` en `beforeEach` si applicable
- Tests co-localisés : `foo.ts` à côté de `foo.test.ts`
- Framework : Vitest
- Server tests : base SQLite en mémoire avec migrations, cleanup en `beforeEach`
- Mock SSE manager : `{ broadcast: vi.fn() }`
- Mock cascade-engine : `vi.hoisted(() => vi.fn().mockResolvedValue(undefined))`
- **Mock net module** : classe MockSocket (pas vi.fn pour constructor compatibility)
- **Chemins de test** : utiliser `join(__dirname, '../../drizzle')` (jamais de chemins relatifs)

### Project Structure Notes

- La section "Règles d'inactivité" rejoint les sections existantes de `node-detail-page.tsx` : Paramètres, Capacités, Enfants hébergés, Dépendances fonctionnelles, Contrôle d'alimentation
- Les API hooks suivent le pattern `apps/web/src/api/nodes.api.ts` : `apiFetch`, `useQuery`, `useMutation`
- Le package `@wakehub/shared` exporte déjà tous les types nécessaires (`InactivityRule`, `MonitoringCriteria`, etc.)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns]
- [Source: apps/server/src/services/inactivity-monitor.ts — moniteur d'inactivité, triggerAutoShutdown, checkAllInactivityRules]
- [Source: apps/server/src/services/cascade-engine.ts — cleanupUpstream, shared dependency protection lines 558-582]
- [Source: apps/server/src/services/dependency-graph.ts — getDownstreamDependents, isSharedDependency]
- [Source: apps/server/src/routes/inactivity-rules.routes.ts — routes API GET/PUT/POST existantes]
- [Source: apps/web/src/features/nodes/node-detail-page.tsx — structure page détail, sections Card]
- [Source: apps/web/src/api/nodes.api.ts — pattern hooks TanStack Query]
- [Source: apps/web/src/api/dependencies.api.ts — pattern mutations avec invalidation]
- [Source: packages/shared/src/models/inactivity-rule.ts — types InactivityRule, MonitoringCriteria]
- [Source: packages/shared/src/api/inactivity-rules.ts — types API request/response]
- [Source: _bmad-output/implementation-artifacts/5-1-moteur-de-surveillance-dinactivite.md — learnings, patterns, code review fixes]

### Intelligence Git (commits récents)

Les commits récents montrent un pattern stable :
- `aa247c9` feat: implement Epic 4 + code review fixes
- Story 5.1 non-commitée : moniteur d'inactivité complet avec 311 server tests passants
- Cascade-engine et SSE manager stables depuis Epic 4
- Le code review de story 5.1 a extrait `broadcastCascadeEvent` dans `sse/broadcast-helpers.ts`, corrigé le N+1, ajouté la protection cascade concurrente

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Mantine Switch uses `role="switch"`, not `role="checkbox"` — fixed test selector
- Mantine NumberInput stores DOM value as string — fixed `toHaveValue('30')` assertions

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- Task 1: Added active dependent check in `checkAllInactivityRules` before triggering auto-shutdown (AC #2). Uses `getDownstreamDependents` to verify no active downstream nodes exist. 5 new tests added.
- Task 2: Integration tests verify shared dependency protection scenario (A→B←C). Cascade-engine's `cleanupUpstream` already handles protection; tests confirm monitor triggers cascade correctly. 2 new tests.
- Task 3: Created `inactivity-rules.api.ts` with `useInactivityRules`, `useCreateInactivityRule`, `useUpdateInactivityRule` hooks following existing TanStack Query patterns.
- Task 4: Created `InactivityRulesSection` component with two states (empty → create, existing → edit). Integrated into `node-detail-page.tsx` between dependencies and power control sections.
- Task 5: Created 9 frontend tests covering empty state, existing rule display, toggle, timeout modification, save (PUT), create (POST), loading state, error handling, and disabled criteria.

### Change Log

- 2026-02-14: Story 5.2 implemented — active dependent protection in inactivity monitor + inactivity rules UI section in node detail page
- 2026-02-14: Code review fixes (8 issues: 2H, 3M, 3L) — H1: error notification test assertion, H2: save test body verification, M1: error state UI, M2: loading test strengthened, M3: ApiError from shared, L1: NumberInput fallback fix, L2: test type safety, L3: useEffect sync on ruleId

### File List

- apps/server/src/services/inactivity-monitor.ts (modified — added getDownstreamDependents import and active dependent check)
- apps/server/src/services/inactivity-monitor.test.ts (modified — added 7 new tests for active dependent protection and shared dependency integration)
- apps/web/src/api/inactivity-rules.api.ts (new — TanStack Query hooks for inactivity rules API)
- apps/web/src/features/nodes/inactivity-rules-section.tsx (new — UI component for inactivity rules configuration)
- apps/web/src/features/nodes/inactivity-rules-section.test.tsx (new — 9 tests for the section component)
- apps/web/src/features/nodes/node-detail-page.tsx (modified — imported and integrated InactivityRulesSection)
