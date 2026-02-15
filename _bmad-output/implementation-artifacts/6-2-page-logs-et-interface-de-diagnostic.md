# Story 6.2: Page Logs & interface de diagnostic

Status: done

## Story

As a utilisateur,
I want consulter l'historique des logs depuis l'interface,
so that je peux diagnostiquer les problemes et verifier le bon fonctionnement de mon homelab.

## Acceptance Criteria

1. **Given** je navigue vers la page Logs
   **When** des logs sont enregistres
   **Then** un tableau chronologique (Mantine Table) affiche les logs du plus recent au plus ancien
   **And** colonnes : horodatage (JetBrains Mono), noeud (nom + icone), type evenement (badge colore), description, raison

2. **Given** le tableau est affiche
   **When** j'utilise les filtres
   **Then** je peux filtrer par noeud, stack dependances, type evenement, periode, et recherche libre

3. **Given** un log d'erreur est affiche
   **When** je le consulte
   **Then** le code d'erreur et le message de la plateforme sont visibles
   **And** le log est visuellement mis en evidence (fond rouge subtil)

4. **Given** aucun log n'existe
   **When** je navigue vers la page Logs
   **Then** un message d'etat vide s'affiche

5. **Given** je suis sur tablette ou mobile
   **When** la page Logs s'affiche
   **Then** les colonnes secondaires sont masquees et un clic ouvre le detail complet

6. **Given** les logs sont accessibles depuis le ServiceDetailPanel (Story 4.5)
   **When** l'onglet Logs est affiche
   **Then** les logs sont filtres pour le noeud concerne avec un lien "Voir tous les logs"

7. **Given** la navigation est mise a jour
   **When** je consulte le menu
   **Then** un lien "Logs" est present dans la navigation principale

## Tasks / Subtasks

- [x] Task 1 — Creer le hook TanStack Query `useLogsQuery` (AC: #1, #2)
  - [x] 1.1 Creer `apps/web/src/api/logs.api.ts` avec interface `LogsFilter` et hook `useLogsQuery(filters)`
  - [x] 1.2 Construire les query params dynamiquement a partir des filtres actifs
  - [x] 1.3 Typer la reponse avec `OperationLog` de `@wakehub/shared`

- [x] Task 2 — Creer la page Logs responsive (AC: #1, #3, #4, #5)
  - [x] 2.1 Creer `apps/web/src/features/logs/logs-page.tsx`
  - [x] 2.2 Header avec titre "Logs" (Title order={1})
  - [x] 2.3 Barre de filtres : recherche libre (TextInput), filtre niveau (Select: info/warn/error), filtre type evenement (Select), filtre noeud (Select dynamique depuis les noms uniques)
  - [x] 2.4 Tableau desktop (Mantine Table) : horodatage (JetBrains Mono ff), noeud (nom), type evenement (Badge), message, raison
  - [x] 2.5 Mise en evidence des erreurs : fond rouge subtil (`var(--mantine-color-red-light)`) sur les lignes level=error
  - [x] 2.6 Detail erreur : afficher error_code et error_details sur les lignes d'erreur (row expandable ou tooltip)
  - [x] 2.7 Vue mobile (<768px) : Stack simplifiee (horodatage + badge niveau + message), clic ouvre detail complet
  - [x] 2.8 Etat vide : icone + message "Aucun evenement enregistre" + explication
  - [x] 2.9 Skeleton loaders pendant le chargement (lignes skeleton dans le tableau)
  - [x] 2.10 Pagination : boutons Precedent/Suivant + indicateur "Page X de Y" + compteur total

- [x] Task 3 — Integrer dans le router et la navigation (AC: #7)
  - [x] 3.1 Ajouter `<Route path="/logs" element={<LogsPage />} />` dans `apps/web/src/router.tsx`
  - [x] 3.2 Ajouter NavItem "Logs" avec icone `IconHistory` dans `apps/web/src/components/layout/navigation.tsx`

- [x] Task 4 — Integrer les logs dans le ServiceDetailPanel (AC: #6)
  - [x] 4.1 Remplacer le placeholder "Logs disponibles bientot" dans l'onglet Logs du ServiceDetailPanel
  - [x] 4.2 Afficher les 5 derniers logs filtres par nodeId (reutiliser `useLogsQuery({ nodeId, limit: 5 })`)
  - [x] 4.3 Ajouter un bouton/lien "Voir tous les logs" qui navigue vers `/logs?nodeId={nodeId}`

- [x] Task 5 — Tests frontend (AC: #1-#7)
  - [x] 5.1 Test `logs-page.test.tsx` : rendu titre et tableau, skeleton loaders, etat vide
  - [x] 5.2 Test filtres : filtre par niveau, par type, par recherche libre, reset filtres
  - [x] 5.3 Test pagination : boutons precedent/suivant, indicateur de page
  - [x] 5.4 Test mise en evidence erreurs : fond rouge sur les lignes error
  - [x] 5.5 Test responsive : colonnes masquees sur mobile
  - [x] 5.6 Test integration ServiceDetailPanel : logs filtres par noeud, lien "Voir tous les logs"
  - [x] 5.7 Verifier zero regression sur les 196 tests web existants

## Dev Notes

### Backend API deja implementee (Story 6.1)

La route `GET /api/logs` est **completement implementee** et testee (23 tests). Ne PAS la modifier.

**Endpoint :** `GET /api/logs`

**Query params (tous optionnels) :**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 50 | Max items par page (1-200) |
| `offset` | integer | 0 | Items a sauter |
| `nodeId` | string | — | Filtrer par noeud |
| `eventType` | string | — | Filtrer par type (start, stop, auto-shutdown, error, decision, connection-test, register, login, logout, password-reset) |
| `level` | string | — | Filtrer par niveau (info, warn, error) |
| `cascadeId` | string | — | Filtrer par cascade |
| `dateFrom` | string (ISO) | — | Date minimum |
| `dateTo` | string (ISO) | — | Date maximum |
| `search` | string | — | Recherche libre dans message + reason |

**Reponse :** `{ data: { logs: OperationLog[], total: number } }`
**Tri :** Chronologique descendant (plus recent en premier).

### Types shared deja disponibles

Les types sont exportes depuis `@wakehub/shared` :
```typescript
import type { OperationLog, OperationLogLevel, OperationLogEventType } from '@wakehub/shared';
```

```typescript
export type OperationLogLevel = 'info' | 'warn' | 'error';

export type OperationLogEventType =
  | 'start' | 'stop' | 'auto-shutdown' | 'error'
  | 'decision' | 'connection-test'
  | 'register' | 'login' | 'logout' | 'password-reset';

export interface OperationLog {
  id: string;
  timestamp: string;  // ISO 8601
  level: OperationLogLevel;
  source: string;
  message: string;
  reason: string | null;
  details: Record<string, unknown> | null;
  nodeId: string | null;
  nodeName: string | null;
  eventType: OperationLogEventType | null;
  errorCode: string | null;
  errorDetails: Record<string, unknown> | null;
  cascadeId: string | null;
}
```

### Pattern TanStack Query a suivre

Suivre exactement le pattern de `apps/web/src/api/nodes.api.ts` :
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';
import type { OperationLog } from '@wakehub/shared';

const API_BASE = '/api/logs';

export interface LogsFilter {
  limit?: number;
  offset?: number;
  nodeId?: string;
  eventType?: string;
  level?: string;
  cascadeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface LogsResponse {
  data: { logs: OperationLog[]; total: number };
}

export function useLogsQuery(filters: LogsFilter = {}) {
  return useQuery<LogsResponse>({
    queryKey: ['logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });
      const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
      const response = await apiFetch(url);
      const json = await response.json();
      if (!response.ok) throw json;
      return json as LogsResponse;
    },
  });
}
```

### Pattern page a suivre (NodesPage)

La page Logs doit suivre exactement la structure de `apps/web/src/features/nodes/nodes-page.tsx` :
1. `Container size="lg" py="xl"` comme wrapper
2. `Stack gap="md"` pour le layout vertical
3. `Group justify="space-between"` pour le header
4. Barre de filtres avec `Group gap="sm"` + `Select` + `TextInput` + bouton Reset
5. Responsive avec `useMediaQuery('(min-width: 992px)')` et `useMediaQuery('(max-width: 767px)')`
6. Skeleton loaders pendant `isLoading` (lignes skeleton dans le tableau)
7. Etat vide avec `Center py="xl"` + icone + message

### Colonnes du tableau Logs

**Desktop (>=992px) — 6 colonnes :**
| Colonne | Contenu | Style |
|---------|---------|-------|
| Horodatage | Date formatee locale (JetBrains Mono) | `ff: 'JetBrains Mono', size: 'sm'` |
| Noeud | `nodeName` ou "—" | `size: 'sm'` |
| Type | `eventType` comme Badge colore | Badge avec couleur semantique |
| Niveau | Badge info/warn/error | `blue`/`yellow`/`red` |
| Message | `message` (tronque si long) | `size: 'sm'` |
| Raison | `reason` ou "—" | `size: 'sm', c: 'dimmed'` |

**Tablette (768-991px) — masquer "Raison"**
**Mobile (<768px) — Stack simplifiee : horodatage + badge niveau + message**

### Couleurs des badges

| Type evenement | Couleur Badge |
|---------------|---------------|
| start | green |
| stop | gray |
| auto-shutdown | orange |
| error | red |
| decision | blue |
| connection-test | cyan |
| register, login, logout, password-reset | violet |

| Niveau | Couleur Badge |
|--------|---------------|
| info | blue |
| warn | yellow |
| error | red |

### ServiceDetailPanel — onglet Logs

Remplacer le placeholder actuel (lignes 139-144 de `service-detail-panel.tsx`) :
```tsx
// AVANT (placeholder)
<Tabs.Panel value="logs" pt="md">
  <Stack align="center" gap="md" py="xl">
    <IconClock size={36} stroke={1.5} color="var(--mantine-color-dark-3)" />
    <Text size="sm" c="dimmed" ta="center">Logs disponibles bientôt</Text>
  </Stack>
</Tabs.Panel>

// APRES (integration)
<Tabs.Panel value="logs" pt="md">
  {/* 5 derniers logs du noeud */}
  {/* Lien "Voir tous les logs" → /logs?nodeId={node.id} */}
</Tabs.Panel>
```

Utiliser `useLogsQuery({ nodeId: node.id, limit: 5 })` pour charger les logs recents.
Utiliser `useNavigate()` (deja importe dans le composant) ou `<Anchor component={Link}>` pour le lien.

### Navigation — ajout du lien Logs

Dans `apps/web/src/components/layout/navigation.tsx`, ajouter apres le NavItem "Graphe" :
```tsx
import { IconHistory } from '@tabler/icons-react';
// ...
<NavItem to="/logs" icon={IconHistory} label="Logs" />
```

### Router — ajout de la route

Dans `apps/web/src/router.tsx`, ajouter dans les routes protegees :
```tsx
import { LogsPage } from './features/logs/logs-page';
// ...
<Route path="/logs" element={<LogsPage />} />
```

### Patterns de test frontend a suivre

1. **Wrapper de rendu :** `renderWithProviders(ui)` avec `QueryClientProvider` + `MantineProvider` + `BrowserRouter`
2. **Mock fetch :** `vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ data: { logs: [...], total: N } })))`
3. **Mock matchMedia :** Configurer dans `beforeEach` pour simuler desktop/mobile
4. **Attendre les donnees :** `await screen.findByText(...)` ou `waitFor()`
5. **UserEvent :** `const user = userEvent.setup()` puis `await user.click(...)`, `await user.type(...)`
6. **Theme import :** `import { theme } from '../../theme/theme'` pour le MantineProvider
7. **Mantine Drawer :** Utiliser `.mantine-Drawer-root` (PAS `role="dialog"`)
8. **vi.hoisted() :** Obligatoire pour les variables mock utilisees dans `vi.mock()` factory

### Formatage des timestamps

Les timestamps arrivent en ISO 8601 (`"2026-02-15T14:30:00.000Z"`).
Afficher en format local francais : `new Date(timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })` → "15/02/2026 15:30:00"

Police JetBrains Mono pour les timestamps (coherence UX-03).

### Accessibilite

- `aria-label` sur les filtres : "Filtrer par niveau", "Filtrer par type d'evenement", "Rechercher dans les logs"
- `role="table"` natif de Mantine Table — pas de role supplementaire necessaire
- Focus visible sur tous les elements interactifs (natif Mantine)
- Navigation clavier : Tab entre les filtres, puis dans le tableau

### Mise en garde — NE PAS faire

- **NE PAS modifier la route backend** `GET /api/logs` — elle est complete et testee
- **NE PAS ajouter de store Zustand** — les logs sont du server state (TanStack Query suffit)
- **NE PAS creer de composant LogTable ou LogFilters separes** — une seule page suffit pour cette complexite
- **NE PAS ajouter d'index sur la table operation_logs** — les performances seront evaluees avec les volumes reels
- **NE PAS implementer le filtre "stack dependances"** en front — la route API ne le supporte pas. Le filtrer par `nodeId` suffit. Le filtre "stack dependances" mentionne dans l'AC est traduit par le filtre `cascadeId` existant

### Project Structure Notes

- Fichiers a creer dans `apps/web/src/features/logs/` (nouveau dossier)
- Hook API dans `apps/web/src/api/logs.api.ts` (convention existante)
- Tests co-localises a cote des fichiers source

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2] — Definition de la story
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — TanStack Query + pattern SSE invalidation
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — Organisation frontend par feature
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Diagnostic et logs] — UX-11 page Logs
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy] — Composants Mantine a utiliser
- [Source: _bmad-output/implementation-artifacts/6-1-enrichissement-du-logging-et-persistance-complete.md] — Story precedente, backend API, types shared
- [Source: apps/server/src/routes/logs.routes.ts] — Route GET /api/logs (complete)
- [Source: apps/web/src/features/nodes/nodes-page.tsx] — Pattern de page a suivre
- [Source: apps/web/src/api/nodes.api.ts] — Pattern TanStack Query a suivre
- [Source: apps/web/src/features/dashboard/service-detail-panel.tsx#L139-144] — Placeholder logs a remplacer
- [Source: apps/web/src/components/layout/navigation.tsx] — Navigation a modifier
- [Source: apps/web/src/router.tsx] — Router a modifier

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Test search libre : `mockResolvedValue` necessaire au lieu de `mockResolvedValueOnce` car chaque keystroke declenche un refetch TanStack Query
- Mantine Select v7 cree des elements DOM dupliques avec le meme aria-label, utiliser `getByPlaceholderText` ou `getAllByLabelText` dans les tests

### Completion Notes List

- Task 1 : Hook `useLogsQuery` cree dans `logs.api.ts` suivant exactement le pattern de `nodes.api.ts`. Interface `LogsFilter` + `LogsResponse` exportees. Construction dynamique des query params.
- Task 2 : Page Logs complete avec tableau desktop 6 colonnes (Horodatage JetBrains Mono, Noeud, Type badge, Niveau badge, Message, Raison), vue tablette (masque Raison), vue mobile (Stack avec Collapse pour detail), etat vide, skeleton loaders, pagination Precedent/Suivant, mise en evidence erreurs (fond rouge), detail erreur expandable (errorCode + errorDetails).
- Task 3 : Route `/logs` ajoutee dans router.tsx, NavItem "Logs" avec IconHistory ajoute dans navigation.tsx.
- Task 4 : Placeholder "Logs disponibles bientot" remplace dans ServiceDetailPanel. Affiche les 5 derniers logs du noeud avec `useLogsQuery({ nodeId, limit: 5 })` et lien "Voir tous les logs" vers `/logs?nodeId={nodeId}`.
- Task 5 : 20 nouveaux tests (216 total, 0 regression). Couvre : titre et tableau, colonnes desktop, badges, noeud, dash pour null, etat vide, skeleton, filtres (niveau, type, recherche, reset), pagination (controles, desactive premier, navigation page), erreurs (fond rouge, expand details), vue mobile, compteur total. Test ServiceDetailPanel mis a jour pour le nouvel onglet logs.

### File List

- apps/web/src/api/logs.api.ts (new, modified review)
- apps/web/src/features/logs/logs-page.tsx (new, modified review)
- apps/web/src/features/logs/logs-page.test.tsx (new, modified review)
- apps/web/src/router.tsx (modified)
- apps/web/src/components/layout/navigation.tsx (modified)
- apps/web/src/features/dashboard/service-detail-panel.tsx (modified, modified review)
- apps/web/src/features/dashboard/service-detail-panel.test.tsx (modified, modified review)
- .gitignore (modified review)
- apps/web/.gitignore (modified review)

### Change Log

- 2026-02-15 : Implementation complete de la Story 6.2 — Page Logs avec tableau chronologique, filtres (niveau, type, noeud, recherche libre), pagination, vue responsive (desktop/tablette/mobile), mise en evidence des erreurs, integration dans ServiceDetailPanel, et navigation. 20 nouveaux tests, 216 total, zero regression.
- 2026-02-15 : Code review — 10 issues corrigees (2 critiques, 3 high, 4 medium, 1 low). Fixes : .gitignore bloquait features/logs/ (C1), ajout filtres periode dateFrom/dateTo (C2), ajout icone noeud via useNodes() (H1), tests manquants "Voir tous les logs" et nodeId URL param (H2/H3), filtre noeud depuis useNodes() au lieu de la page courante (M1), gestion erreur isError (M2), enabled flag useLogsQuery (M3), File List mise a jour (M4), test etat filtre vide (L1). 220 tests, zero regression.
