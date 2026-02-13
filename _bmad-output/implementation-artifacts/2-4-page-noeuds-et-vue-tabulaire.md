# Story 2.4: Page Noeuds & vue tabulaire

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want voir tous mes noeuds dans une liste organisee,
So that j'ai une vue d'ensemble de mon infrastructure.

## Acceptance Criteria

1. **Tableau compact Mantine Table**
   - Given je navigue vers la page Noeuds
   - When des noeuds configures existent en base
   - Then un tableau compact (Mantine Table) affiche tous les noeuds configures
   - And les colonnes visibles sont : icone (type), nom (lien cliquable), type (machine/VM/LXC/conteneur), statut (badge colore), IP, derniere mise a jour

2. **Filtres par statut et type**
   - Given le tableau est affiche
   - When j'utilise les filtres
   - Then je peux filtrer par statut (online, offline, error) et par type (physical, vm, lxc, container)
   - And les filtres sont des Select Mantine dans une barre au-dessus du tableau
   - And je peux reinitialiser les filtres

3. **Etat vide**
   - Given aucun noeud n'est configure
   - When je navigue vers la page Noeuds
   - Then un message d'etat vide s'affiche avec une icone, un texte explicatif et un bouton vers le wizard d'ajout

4. **Responsive tablette (768-991px)**
   - Given je suis sur tablette (768-991px)
   - When la page Noeuds s'affiche
   - Then les colonnes secondaires (derniere mise a jour, IP) sont masquees
   - And le tableau reste lisible avec les colonnes essentielles (icone, nom, type, statut)

5. **Responsive mobile (<768px)**
   - Given je suis sur mobile (<768px)
   - When la page Noeuds s'affiche
   - Then une vue liste simplifiee est affichee (icone + nom + badge statut par ligne)

6. **Skeleton loaders pendant le chargement**
   - Given la page est en cours de chargement
   - When les donnees ne sont pas encore disponibles
   - Then des skeleton loaders en forme de lignes de tableau s'affichent

7. **Clic sur une ligne → navigation**
   - Given le tableau affiche des noeuds
   - When je clique sur le nom d'un noeud (lien)
   - Then je suis redirige vers la page de detail de ce noeud (`/nodes/:id`)

## Tasks / Subtasks

- [x] Task 1 : Composant StatusBadge reutilisable (AC: #1)
  - [x] 1.1 Creer `apps/web/src/components/shared/status-badge.tsx` — Badge Mantine avec couleur semantique selon le statut (online=green, offline=gray, starting=yellow, stopping=orange, error=red)
  - [x] 1.2 Props : `status: NodeStatus`, `size?: string`
  - [x] 1.3 Labels francais : online="Actif", offline="Eteint", starting="Demarrage", stopping="Arret", error="Erreur"
  - [x] 1.4 Ecrire le test unitaire

- [x] Task 2 : Composant NodeTypeIcon reutilisable (AC: #1)
  - [x] 2.1 Creer `apps/web/src/components/shared/node-type-icon.tsx` — Icone Tabler selon le type de noeud (physical=IconServer, vm=IconDeviceDesktop, lxc=IconBox, container=IconBrandDocker)
  - [x] 2.2 Props : `type: NodeType`, `size?: number`
  - [x] 2.3 Ecrire le test unitaire

- [x] Task 3 : Refactoring page Noeuds — vue tabulaire Mantine Table (AC: #1, #3, #7)
  - [x] 3.1 Remplacer la liste `Group/Anchor` dans `nodes-page.tsx` par un composant `Table` Mantine
  - [x] 3.2 Colonnes : NodeTypeIcon, nom (Anchor → Link vers `/nodes/:id`), type label (Machine/VM/LXC/Conteneur), StatusBadge, IP (ou "—"), derniere mise a jour (formatee relative)
  - [x] 3.3 Conserver l'etat vide existant (icone + texte + bouton "+")
  - [x] 3.4 Conserver le bouton "Ajouter" en haut de page + AddMachineWizard
  - [x] 3.5 Clic sur le nom du noeud → navigation vers `/nodes/:id`

- [x] Task 4 : Barre de filtres (AC: #2)
  - [x] 4.1 Ajouter une barre de filtres au-dessus du tableau : Select "Statut" (tous/online/offline/error) + Select "Type" (tous/physical/vm/lxc/container)
  - [x] 4.2 Filtrage cote client sur les donnees deja chargees (pas de nouveau endpoint API)
  - [x] 4.3 Bouton "Reinitialiser" pour vider les filtres
  - [x] 4.4 Afficher le nombre de resultats filtres ("X noeuds")

- [x] Task 5 : Skeleton loaders (AC: #6)
  - [x] 5.1 Remplacer le texte "Chargement..." par des Skeleton Mantine en forme de lignes de tableau (5 lignes skeleton)
  - [x] 5.2 Chaque ligne skeleton a la meme structure que le tableau (colonnes alignees)

- [x] Task 6 : Responsive design (AC: #4, #5)
  - [x] 6.1 Utiliser `useMediaQuery` de Mantine ou les props responsive pour masquer les colonnes secondaires (IP, derniere mise a jour) sous 992px
  - [x] 6.2 Sous 768px, afficher une vue liste simplifiee (Stack de Group : icone + nom + badge statut)
  - [x] 6.3 Les filtres restent accessibles sur toutes les tailles d'ecran

- [x] Task 7 : Tests frontend (AC: tous)
  - [x] 7.1 Tester le rendering du tableau avec des noeuds (colonnes visibles, donnees affichees)
  - [x] 7.2 Tester l'etat vide (message + bouton)
  - [x] 7.3 Tester les filtres (filtrage par statut, par type, reinitialisation)
  - [x] 7.4 Tester le skeleton loading
  - [x] 7.5 Tester que le lien du nom pointe vers `/nodes/:id`
  - [x] 7.6 Verifier que tous les tests existants passent (247 total — 171 server + 76 web)

## Dev Notes

### Stack technique et versions

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe |
| Mantine (core, hooks) | ~7.17 | Table, Badge, Select, Skeleton, Group, Stack |
| TanStack Query | ~5.x | useNodes hook existant |
| @tabler/icons-react | ~3.36 | IconServer, IconDeviceDesktop, IconBox, IconBrandDocker, IconFilter, IconX |
| React Router | ~7.x | Link pour navigation vers `/nodes/:id` |

### Architecture — Decisions critiques pour cette story

**1. Vue tabulaire Mantine Table — PAS DataTable**

Utiliser le composant `Table` natif de Mantine v7 (pas de lib externe comme `mantine-datatable`). Le nombre de noeuds dans un homelab est petit (10-50), donc pas besoin de virtualisation, tri server-side ou pagination complexe. Le filtrage est cote client.

```tsx
import { Table } from '@mantine/core';

<Table highlightOnHover>
  <Table.Thead>
    <Table.Tr>
      <Table.Th></Table.Th>       {/* Icone type */}
      <Table.Th>Nom</Table.Th>
      <Table.Th>Type</Table.Th>
      <Table.Th>Statut</Table.Th>
      <Table.Th>IP</Table.Th>      {/* Masquee < 992px */}
      <Table.Th>Mis a jour</Table.Th> {/* Masquee < 992px */}
    </Table.Tr>
  </Table.Thead>
  <Table.Tbody>
    {filteredNodes.map(node => (
      <Table.Tr key={node.id}>
        <Table.Td><NodeTypeIcon type={node.type} /></Table.Td>
        <Table.Td><Anchor component={Link} to={`/nodes/${node.id}`}>{node.name}</Anchor></Table.Td>
        <Table.Td>{typeLabels[node.type]}</Table.Td>
        <Table.Td><StatusBadge status={node.status} /></Table.Td>
        <Table.Td>{node.ipAddress ?? '—'}</Table.Td>
        <Table.Td>{formatRelativeDate(node.updatedAt)}</Table.Td>
      </Table.Tr>
    ))}
  </Table.Tbody>
</Table>
```

**2. Filtrage cote client — pas de nouvel endpoint API**

Le hook `useNodes()` retourne deja tous les noeuds configures. Le filtrage par statut et type se fait en memoire via `useMemo` :

```typescript
const filteredNodes = useMemo(() => {
  let result = nodes;
  if (statusFilter) result = result.filter(n => n.status === statusFilter);
  if (typeFilter) result = result.filter(n => n.type === typeFilter);
  return result;
}, [nodes, statusFilter, typeFilter]);
```

**Pas de nouvel endpoint API. Pas de modification backend.**

**3. Labels de type en francais**

```typescript
const typeLabels: Record<string, string> = {
  physical: 'Machine',
  vm: 'VM',
  lxc: 'LXC',
  container: 'Conteneur',
};
```

**4. Couleurs de statut — alignement UX spec**

```typescript
const statusColors: Record<string, string> = {
  online: 'green',     // #51CF66
  offline: 'gray',     // #868E96
  starting: 'yellow',  // #FCC419
  stopping: 'orange',  // #FF922B
  error: 'red',        // #FF6B6B
};

const statusLabels: Record<string, string> = {
  online: 'Actif',
  offline: 'Eteint',
  starting: 'Demarrage',
  stopping: 'Arret',
  error: 'Erreur',
};
```

**5. Icones de type — mapping Tabler Icons**

```typescript
import { IconServer, IconDeviceDesktop, IconBox, IconBrandDocker } from '@tabler/icons-react';

const typeIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  physical: IconServer,
  vm: IconDeviceDesktop,
  lxc: IconBox,
  container: IconBrandDocker,
};
```

**6. "Derniere mise a jour" — formatage relatif**

Utiliser un formatteur de date relatif simple (pas de lib externe comme `date-fns`). `Intl.RelativeTimeFormat` ou un helper minimaliste :

```typescript
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR');
}
```

**7. Responsive — useMediaQuery de @mantine/hooks**

```typescript
import { useMediaQuery } from '@mantine/hooks';

const isDesktop = useMediaQuery('(min-width: 992px)');
const isMobile = useMediaQuery('(max-width: 767px)');

// Desktop : toutes les colonnes
// Tablette (768-991) : masquer IP et derniere mise a jour
// Mobile (<768) : vue liste simplifiee (pas de Table du tout)
```

**IMPORTANT :** La vue mobile n'est PAS un tableau — c'est une liste de `Group` avec icone + nom + badge statut. Meme pattern que la liste actuelle mais avec les badges et icones corrects.

**8. Skeleton loaders — Mantine Skeleton**

```tsx
import { Skeleton } from '@mantine/core';

// 5 lignes skeleton
{Array.from({ length: 5 }).map((_, i) => (
  <Table.Tr key={i}>
    <Table.Td><Skeleton height={20} width={20} radius="sm" /></Table.Td>
    <Table.Td><Skeleton height={16} width="60%" /></Table.Td>
    <Table.Td><Skeleton height={16} width="40%" /></Table.Td>
    <Table.Td><Skeleton height={22} width={60} radius="xl" /></Table.Td>
    {isDesktop && <Table.Td><Skeleton height={16} width="50%" /></Table.Td>}
    {isDesktop && <Table.Td><Skeleton height={16} width="40%" /></Table.Td>}
  </Table.Tr>
))}
```

### Dependances a installer

**AUCUNE nouvelle dependance npm.** Tout est deja installe :
- `@mantine/core` — Table, Badge, Select, Skeleton, Group, Stack, Anchor, Center
- `@mantine/hooks` — useMediaQuery
- `@tabler/icons-react` — Icones
- `@tanstack/react-query` — useNodes hook existant
- `react-router` — Link

### Conventions de nommage — rappel obligatoire

| Couche | Convention | Exemples |
|---|---|---|
| Fichiers | `kebab-case` | `status-badge.tsx`, `node-type-icon.tsx`, `nodes-page.tsx` |
| Composants React | `PascalCase` | `StatusBadge`, `NodeTypeIcon`, `NodesPage` |
| Types/Interfaces | `PascalCase` | `NodeType`, `NodeStatus` |
| Constantes | `SCREAMING_SNAKE` (ou objet map) | `statusColors`, `typeLabels` |

### Structure de fichiers — nouveaux fichiers a creer

```
apps/web/src/
├── components/
│   └── shared/
│       ├── status-badge.tsx               ← NOUVEAU — Badge de statut reutilisable
│       ├── status-badge.test.tsx          ← NOUVEAU — Tests badge
│       ├── node-type-icon.tsx             ← NOUVEAU — Icone de type noeud reutilisable
│       └── node-type-icon.test.tsx        ← NOUVEAU — Tests icone
├── features/
│   └── nodes/
│       ├── nodes-page.tsx                 ← MODIFIER — Remplacer liste par Table + filtres + skeleton
│       └── nodes-page.test.tsx            ← MODIFIER — Nouveaux tests pour tableau, filtres, skeleton
```

**Fichiers existants a MODIFIER (pas creer) :**
- `apps/web/src/features/nodes/nodes-page.tsx` — Refactoring complet de la vue (liste → table + filtres + skeleton + responsive)
- `apps/web/src/features/nodes/nodes-page.test.tsx` — Mise a jour tests (si existe deja, sinon creer)

**Fichiers existants a NE PAS modifier :**
- `apps/web/src/router.tsx` — Route `/nodes` existe deja
- `apps/web/src/components/layout/navigation.tsx` — Lien "Noeuds" existe deja
- `apps/web/src/api/nodes.api.ts` — Hook `useNodes()` existe deja et suffit
- `apps/server/src/routes/nodes.routes.ts` — Pas de modification backend necessaire

### Testing — approche et patterns

**Tests frontend (Vitest + Testing Library) :**

Pattern identique aux tests existants :
```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import { theme } from '../../theme/theme';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <MemoryRouter>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}
```

**Cas de test a couvrir :**

**StatusBadge :**
- Rend le bon label pour chaque statut (5 cas)
- Utilise la bonne couleur Mantine pour chaque statut

**NodeTypeIcon :**
- Rend une icone pour chaque type (4 cas)

**NodesPage :**
- Etat vide : affiche message + bouton "Ajouter une machine"
- Etat charge : affiche un tableau avec les colonnes correctes
- Donnees dans le tableau : nom, type label, badge statut, IP
- Lien nom → pointe vers `/nodes/:id`
- Filtres : Select statut + Select type sont presents
- Filtrage : selectionner un statut filtre le tableau
- Filtrage : selectionner un type filtre le tableau
- Reinitialisation : clic sur "Reinitialiser" vide les filtres
- Skeleton : affiche des skeleton loaders quand `isLoading=true`
- Bouton "+" ouvre le wizard

**IMPORTANT :**
- Mocker `useNodes()` via `vi.mock('../../api/nodes.api')` pour controller les donnees
- Mocker `useMediaQuery` si on teste le responsive (ou simplement tester la vue desktop)
- Utiliser `getByRole('table')` pour verifier la presence du tableau
- Utiliser `getByText` pour les labels de type et de statut

### Intelligence des stories precedentes (Epic 2)

**Lecons apprises de Stories 2.1-2.3 + 2.fix.1 :**

1. **Mantine Modal rend dans un portal** — `findByText` (async) au lieu de `getByText` pour les modals. **Non applicable ici** (pas de modal dans la table, le wizard existe deja).

2. **vi.mock factory hoisted avant variables** — `vi.hoisted()` OBLIGATOIRE pour les mock functions dans `vi.mock()` factories. **Appliquer pour mocker useNodes.**

3. **Tests frontend : `getByPlaceholderText` vs `getByLabelText`** — Mantine ajoute ` *` au label des champs required. Utiliser regex `getByLabelText(/Nom/i)` ou `getByPlaceholderText`. **Appliquer pour les Select de filtres.**

4. **`window.history.pushState({}, '', '/')` dans `beforeEach`** des tests router pour reset la location entre les tests.

5. **Pattern page existant** — La page Noeuds actuelle utilise `Container size="lg" py="xl"`. Conserver ce pattern de layout.

6. **Test count actuel : 224 (171 server + 53 web).** Tous doivent passer apres cette story.

**Patterns etablis a reutiliser strictement :**
- Layout page : `Container size="lg" py="xl"` + `Stack gap="md"` + `Group justify="space-between"` pour le header
- Navigation : `Anchor component={Link} to={...}` pour les liens internes
- Hooks API : `useNodes()` retourne `{ data, isLoading }` — pas de pattern custom
- Notifications : `notifications.show({ title, message, color })` (pas utilise ici sauf si erreur)

### Intelligence Git — patterns recents

```
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

La branche de travail est `nouvel-axe`. L'Epic 2 est en cours avec les stories 2.1-2.3 + fix.1 en review.

### Scope et boundaries de cette story

**IN-SCOPE :**
- Transformation de la page Noeuds en vue tabulaire (Table Mantine)
- StatusBadge et NodeTypeIcon comme composants reutilisables (seront reutilises dans Dashboard Story 4.3, ServiceDetailPanel Story 4.5, etc.)
- Filtres par statut et type
- Skeleton loaders
- Responsive (tablette et mobile)

**OUT-OF-SCOPE (stories ulterieures) :**
- Tri des colonnes (pas demande dans les ACs)
- Pagination (homelab = petit nombre de noeuds)
- Recherche textuelle (pas demande)
- Actions dans le tableau (epingler, demarrer, etc.) — ce sera pour les stories du Dashboard (Epic 4)
- Colonne "derniere activite" basee sur une vraie activite (on utilise `updatedAt` comme proxy)

### Project Structure Notes

- `StatusBadge` et `NodeTypeIcon` sont dans `components/shared/` car reutilisables dans plusieurs features (Dashboard, NodeDetail, etc.) — alignement avec architecture.md
- La page Noeuds reste dans `features/nodes/` — pas de nouveau dossier
- Pas de nouveau composant complexe — la table est directement dans `nodes-page.tsx` (pas de composant `NodesTable` separe, sauf si le fichier devient trop long)

### References

- [Source: epics.md#Story-2.4] — User story, acceptance criteria, FRs couverts
- [Source: architecture.md#Frontend-Architecture] — Organisation frontend par feature, composants partages
- [Source: architecture.md#Implementation-Patterns] — Conventions nommage, tests co-localises
- [Source: ux-design-specification.md#UX-09] — Page Noeuds vue tabulaire, colonnes, filtres
- [Source: ux-design-specification.md#UX-15] — Skeleton loaders
- [Source: ux-design-specification.md#UX-16] — Responsive desktop-first, breakpoints
- [Source: ux-design-specification.md#Design-System-Foundation] — Couleurs statut, typographie, espacement
- [Source: ux-design-specification.md#UX-Consistency-Patterns] — Etats vides, chargement
- [Source: 2-1-ajout-machine-physique-et-base-technique.md] — Story 2.1 (page Noeuds placeholder, patterns)
- [Source: 2-2-capacite-proxmox-et-decouverte-vms-lxcs.md] — Story 2.2 (page detail, patterns)
- [Source: 2-3-capacite-docker-et-decouverte-conteneurs.md] — Story 2.3 (patterns)
- [Source: 2-fix-1-error-handling-creation-noeud.md] — Story fix (patterns erreur)

### Anti-patterns a eviter

- **NE PAS** installer `mantine-datatable` ou une lib de table externe — utiliser `Table` natif Mantine
- **NE PAS** creer un endpoint API pour le filtrage — filtrer cote client
- **NE PAS** ajouter de pagination — pas necessaire pour un homelab (10-50 noeuds max)
- **NE PAS** creer un dossier `__tests__/` — tests co-localises
- **NE PAS** modifier le backend — cette story est 100% frontend
- **NE PAS** utiliser `any` — typer avec `NodeType` et `NodeStatus` de `@wakehub/shared`
- **NE PAS** hardcoder des couleurs CSS — utiliser les couleurs Mantine du theme (`green`, `gray`, `yellow`, `orange`, `red`)
- **NE PAS** oublier `vi.hoisted()` pour les mock functions dans `vi.mock()` factories
- **NE PAS** oublier la vue mobile simplifiee (pas un tableau, mais une liste)
- **NE PAS** supprimer le wizard AddMachineWizard et le bouton "+" — ils restent dans la page
- **NE PAS** creer de fichiers composant en PascalCase — utiliser kebab-case (`status-badge.tsx`, PAS `StatusBadge.tsx`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Tests Select collision : `getByText('Machine')` trouvait des doublons table + dropdown → fix avec `within(table)` scoping
- Tests `useMediaQuery` : jsdom retourne false pour toutes les media queries → fix avec mock `window.matchMedia` simulant desktop

### Completion Notes List

- Task 1 : StatusBadge cree avec 5 couleurs semantiques et labels francais. 7 tests unitaires passent.
- Task 2 : NodeTypeIcon cree avec 4 icones Tabler. 5 tests unitaires passent.
- Task 3 : Page Noeuds refactoree — liste Group/Anchor remplacee par Table Mantine avec colonnes icone, nom (lien), type, statut (badge), IP, date relative.
- Task 4 : Barre de filtres ajoutee — Select statut + Select type + bouton Reinitialiser + compteur noeuds filtres. Filtrage cote client via useMemo.
- Task 5 : Skeleton loaders — 5 lignes skeleton dans un Table avec colonnes alignees pendant le chargement.
- Task 6 : Responsive — colonnes IP et date masquees sous 992px (useMediaQuery). Vue liste simplifiee (Group icone+nom+badge) sous 768px.
- Task 7 : 16 tests NodesPage couvrant table, etat vide, filtres, skeleton, navigation, wizard. Total projet : 247 tests (171 server + 76 web), 0 regression.

### File List

**Nouveaux fichiers :**
- `apps/web/src/components/shared/status-badge.tsx`
- `apps/web/src/components/shared/status-badge.test.tsx`
- `apps/web/src/components/shared/node-type-icon.tsx`
- `apps/web/src/components/shared/node-type-icon.test.tsx`

**Fichiers modifies :**
- `apps/web/src/features/nodes/nodes-page.tsx`
- `apps/web/src/features/nodes/nodes-page.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-4-page-noeuds-et-vue-tabulaire.md`

## Change Log

| Date | Changement |
|---|---|
| 2026-02-13 | Implementation complete Story 2.4 — Page Noeuds refactoree en vue tabulaire avec filtres, skeleton loaders, responsive et composants reutilisables StatusBadge/NodeTypeIcon. 23 nouveaux tests ajoutes (247 total). |
