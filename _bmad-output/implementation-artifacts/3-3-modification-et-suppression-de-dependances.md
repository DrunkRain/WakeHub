# Story 3.3 : Modification et suppression de dependances

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want modifier ou supprimer des liens de dependance existants,
So that je peux ajuster la configuration de mon infrastructure quand elle evolue.

## Acceptance Criteria (BDD)

1. **Given** je suis sur la page de detail d'une machine ou ressource, section Dependances
   **When** je vois les liens existants
   **Then** chaque lien affiche un bouton supprimer (icone poubelle) ET un toggle "Partagee"
   **And** le toggle reflette l'etat actuel du champ `isShared`

2. **Given** je clique sur le toggle "Partagee" d'un lien existant
   **When** la requete PATCH reussit
   **Then** `isShared` est mis a jour en base
   **And** un toast de succes s'affiche
   **And** le graphe et les listes sont rafraichis

3. **Given** je clique sur supprimer un lien
   **When** la modale de confirmation s'affiche
   **Then** elle montre "Supprimer le lien entre [parent] et [enfant] ?"
   **And** si la suppression isolerait le noeud enfant (plus aucun parent), un avertissement supplementaire s'affiche

4. **Given** je confirme la suppression
   **When** la requete DELETE reussit
   **Then** le lien est retire, les listes et le graphe sont rafraichis, un toast s'affiche

5. **Given** je suis sur le graphe de dependances (page /dependencies)
   **When** je fais un clic droit (ou long-press mobile) sur un edge (fleche)
   **Then** un menu contextuel apparait avec l'option "Supprimer ce lien"
   **And** cliquer dessus ouvre la meme modale de confirmation

6. **Given** une machine est supprimee via la page detail machine
   **When** cette machine a des liens de dependance
   **Then** tous les `dependency_links` impliquant cette machine sont supprimes automatiquement
   **And** l'operation est loguee

## Tasks / Subtasks

- [x] Task 1 — Toggle isShared sur les liens existants (AC: #1, #2)
  - [x] 1.1 Dans `machine-detail-page.tsx`, remplacer le texte "Partagee" par un `ActionIcon` toggle (IconShare/IconShareOff)
  - [x] 1.2 Importer et appeler `useUpdateDependency()` au clic
  - [x] 1.3 Afficher un toast succes/erreur
  - [x] 1.4 Appliquer les memes changements dans `resource-detail-page.tsx`

- [x] Task 2 — Ameliorer la modale de suppression (AC: #3)
  - [x] 2.1 Afficher les noms parent/enfant dans la modale : "Supprimer le lien entre [parent] et [enfant] ?"
  - [x] 2.2 Passer le lien complet (pas juste l'id) dans l'etat `deleteDepId` → `deleteDepLink`
  - [x] 2.3 Ajouter un avertissement d'isolation : si le noeud enfant n'a qu'un seul parent (ce lien), afficher une alerte
  - [x] 2.4 Appliquer dans `machine-detail-page.tsx` et `resource-detail-page.tsx`

- [x] Task 3 — Nettoyage cascade des dependency_links a la suppression machine (AC: #6)
  - [x] 3.1 Dans `machines.routes.ts`, avant de supprimer la machine, supprimer tous les `dependency_links` ou `parentType='machine' AND parentId=id` OU `childType='machine' AND childId=id`
  - [x] 3.2 Loguer le nombre de liens supprimes
  - [x] 3.3 Ajouter un test dans `machines.routes.test.ts`

- [x] Task 4 — Menu contextuel sur les edges du graphe (AC: #5)
  - [x] 4.1 Dans `dependency-graph.tsx`, ajouter un handler `onEdgeContextMenu` qui affiche un menu positionne
  - [x] 4.2 Le menu propose "Supprimer ce lien"
  - [x] 4.3 Cliquer ouvre une modale de confirmation (meme pattern que les pages detail)
  - [x] 4.4 Importer `useDeleteDependency` dans `dependencies-page.tsx` et passer le callback au composant

- [x] Task 5 — Build et verification finale
  - [x] 5.1 Verifier que le build frontend passe
  - [x] 5.2 Verifier que tous les tests backend passent (regression)

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **troisieme et derniere de l'Epic 3**. Elle ameliore l'experience de gestion des dependances en ajoutant :
1. La modification du flag `isShared` directement depuis les pages detail (le hook `useUpdateDependency()` existe deja mais n'est pas utilise dans l'UI)
2. Une modale de suppression enrichie avec noms et avertissement d'isolation
3. Le nettoyage des liens orphelins lors de la suppression d'une machine
4. Un menu contextuel sur les edges du graphe visuel

**Important :** L'essentiel du backend est deja implemente (PATCH et DELETE fonctionnent). Cette story est principalement **frontend** avec un ajout mineur en backend (cascade cleanup).

### Exigences techniques detaillees

**Task 1 — Toggle isShared :**

Le hook `useUpdateDependency()` est deja defini dans `dependencies.api.ts` (ligne 93-111) mais jamais importe ni appele dans les pages detail. Il suffit de :
1. Ajouter `useUpdateDependency` aux imports
2. Remplacer le texte statique `{link.isShared && ' — Partagée'}` par un `ActionIcon` cliquable
3. Pattern recommande :

```tsx
import { IconShare, IconShareOff } from '@tabler/icons-react';

const updateDep = useUpdateDependency();

// Dans le rendu de chaque lien :
<Tooltip label={link.isShared ? 'Retirer le partage' : 'Marquer comme partagée'}>
  <ActionIcon
    variant="subtle"
    color={link.isShared ? 'yellow' : 'gray'}
    size="sm"
    loading={updateDep.isPending}
    onClick={() => updateDep.mutate(
      { id: link.id, isShared: !link.isShared },
      {
        onSuccess: () => notifications.show({ title: 'Mis à jour', message: 'Dépendance mise à jour', color: 'green' }),
        onError: (err) => notifications.show({ title: 'Erreur', message: err.error?.message || 'Erreur', color: 'red' }),
      }
    )}
  >
    {link.isShared ? <IconShare size={14} /> : <IconShareOff size={14} />}
  </ActionIcon>
</Tooltip>
```

**Task 2 — Modale enrichie :**

Actuellement `deleteDepId` stocke juste un `string` (l'ID). Il faut stocker le lien complet `DependencyLink | null` pour acceder aux noms :

```tsx
// Avant :
const [deleteDepId, setDeleteDepId] = useState<string | null>(null);
// Apres :
const [deleteDepLink, setDeleteDepLink] = useState<DependencyLink | null>(null);

// Dans la modale :
<Text>
  Supprimer le lien entre <strong>{resolveName(deleteDepLink.parentType, deleteDepLink.parentId)}</strong>
  {' '}et <strong>{resolveName(deleteDepLink.childType, deleteDepLink.childId)}</strong> ?
</Text>
```

**Avertissement d'isolation :** Verifier cote frontend si le noeud enfant n'a qu'un seul parent dans `parentLinks` :

```tsx
const wouldIsolate = depsData?.data.filter(
  (l) => l.childType === deleteDepLink.childType && l.childId === deleteDepLink.childId
).length === 1;

{wouldIsolate && (
  <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
    Attention : {resolveName(deleteDepLink.childType, deleteDepLink.childId)} n'aura plus de dependance parente.
  </Alert>
)}
```

**Note :** La detection d'isolation se fait cote frontend car les donnees sont deja chargees via `useNodeDependencies`. Pas besoin d'endpoint supplementaire.

**Task 3 — Cascade cleanup machine :**

Dans `machines.routes.ts`, le DELETE actuel (ligne 527-561) supprime la machine mais pas ses dependency_links. Les dependency_links utilisent des IDs polymorphiques (pas de FK), donc pas de CASCADE automatique. Ajouter avant le delete :

```typescript
import { dependencyLinks } from '../db/schema.js';
import { or } from 'drizzle-orm';

// Avant la suppression de la machine :
const deletedLinks = await fastify.db.delete(dependencyLinks)
  .where(or(
    and(eq(dependencyLinks.parentType, 'machine'), eq(dependencyLinks.parentId, id)),
    and(eq(dependencyLinks.childType, 'machine'), eq(dependencyLinks.childId, id)),
  ))
  .returning();

if (deletedLinks.length > 0) {
  await fastify.db.insert(operationLogs).values({
    timestamp: new Date(),
    level: 'info',
    source: 'dependencies',
    message: `${deletedLinks.length} dependency link(s) cascade-deleted with machine ${existing.name}`,
    reason: 'dependency-cascade-delete',
    details: { machineId: id, deletedCount: deletedLinks.length },
  });
}
```

**Task 4 — Menu contextuel edges :**

React Flow ne supporte pas nativement le clic droit sur les edges. Approche recommandee :

```tsx
// State dans DependencyGraph ou DependenciesPage :
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

// Handler dans ReactFlow :
onEdgeContextMenu={(event, edge) => {
  event.preventDefault();
  setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
}}

// Rendu du menu contextuel (Paper positionne en fixed) :
{contextMenu && (
  <Paper
    shadow="md"
    withBorder
    p="xs"
    style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
  >
    <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={14} />}
      onClick={() => { onDeleteEdge(contextMenu.edgeId); setContextMenu(null); }}
    >
      Supprimer ce lien
    </Button>
  </Paper>
)}
```

Fermer le menu au clic exterieur via `onPaneClick` et `onClick` sur le conteneur.

### Conformite architecture obligatoire

**Format API (ARCH-11) :**
- Pas de nouvel endpoint necessaire — PATCH et DELETE existent deja
- Reponses normalisees `{ data }` / `{ error: { code, message } }`

**Schemas Fastify (ARCH-04) :**
- Les schemas pour DELETE et PATCH couvrent deja 200, 401, 404

**Tests co-localises (ARCH-15) :**
- Ajouter test cascade dans `machines.routes.test.ts`
- Les tests existants pour PATCH/DELETE dans `dependencies.routes.test.ts` couvrent deja les cas

### Librairies et frameworks requis

**Aucune nouvelle dependance.** Tout est deja installe :

| Package | Usage dans cette story |
|---------|----------------------|
| `@mantine/core` | ActionIcon, Tooltip, Alert, Modal, Paper |
| `@tabler/icons-react` | IconShare, IconShareOff, IconTrash, IconAlertTriangle |
| `@xyflow/react` | onEdgeContextMenu handler |

### Structure de fichiers

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/web/src/features/machines/machine-detail-page.tsx` | Toggle isShared, modale enrichie |
| `apps/web/src/features/machines/resource-detail-page.tsx` | Toggle isShared, modale enrichie |
| `apps/web/src/features/dependencies/dependency-graph.tsx` | onEdgeContextMenu + menu contextuel |
| `apps/web/src/features/dependencies/dependencies-page.tsx` | Callback deletion, modale confirmation |
| `apps/server/src/routes/machines.routes.ts` | Cascade cleanup dependency_links |
| `apps/server/src/routes/machines.routes.test.ts` | Test cascade |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/routes/dependencies.routes.ts` — CRUD complet, aucun changement
- `apps/server/src/services/dependency-graph.ts` — service deja complet
- `apps/web/src/api/dependencies.api.ts` — hooks deja definis
- `packages/shared/src/index.ts` — types suffisants

### Exigences de tests

**Framework :** Vitest (backend)
**Commande :** `npm run test -w @wakehub/server`

**Tests backend a ajouter :**

**`machines.routes.test.ts` (ajout) :**
- Supprimer une machine qui a des dependency_links → les liens sont supprimes en cascade
- Verifier que l'operation est loguee dans operation_logs

**Tests existants suffisants :**
- `dependencies.routes.test.ts` : DELETE et PATCH deja testes (18 tests)

**Tests frontend :**
- Verification build (tsc + vite build)
- Pas de tests unitaires React requis

### Intelligence des stories precedentes (Stories 3.1 & 3.2)

**Patterns etablis a reutiliser :**
1. **Modal pattern** : `useState` pour l'etat, `onSuccess`/`onError` callbacks dans `mutate()`
2. **Notifications** : `notifications.show({ title, message, color })`
3. **resolveName()** : fonction locale qui cherche dans `allMachines` et `allResources`
4. **Query invalidation** : tous les hooks de mutation invalident `['dependencies']`

**Bug TS corrige en 3.1 :**
- `BetterSQLite3Database<any>` pour compatibilite avec `fastify.db`

**Bug TS corrige en 3.2 :**
- `DependencyNodeData` necessite `[key: string]: unknown` pour React Flow
- `split(':')[1]` retourne `string | undefined` → fallback necessaire

### Anti-patterns a eviter

- NE PAS creer de nouvel endpoint pour la detection d'isolation — les donnees sont deja chargees cote frontend
- NE PAS ajouter de SSE dans cette story — c'est l'Epic 4
- NE PAS modifier le schema DB — `dependency_links` est deja complet
- NE PAS dupliquer le code du toggle entre machine-detail et resource-detail — le pattern est identique mais chaque page a son propre contexte

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.3]
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- **PRD** : [Source: _bmad-output/planning-artifacts/prd.md#FR16-FR18] — Gestion dependances
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dependency Configuration]
- **Stories precedentes** : [Source: _bmad-output/implementation-artifacts/3-1-*.md, 3-2-*.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- 182 backend tests passing (12 test files, +1 cascade delete test)
- Frontend build OK (tsc + vite build)
- Toggle isShared via ActionIcon (IconShare/IconShareOff) on both detail pages
- Enhanced delete modal with parent/child names and isolation warning (Alert orange)
- Cascade cleanup of dependency_links when machine deleted (with logging)
- Right-click context menu on graph edges with delete option
- Delete confirmation modal in dependencies page for graph edge deletion

### File List

**Modified:**
- `apps/web/src/features/machines/machine-detail-page.tsx` — Toggle isShared, enhanced delete modal
- `apps/web/src/features/machines/resource-detail-page.tsx` — Toggle isShared, enhanced delete modal
- `apps/web/src/features/dependencies/dependency-graph.tsx` — onEdgeContextMenu + context menu UI
- `apps/web/src/features/dependencies/dependencies-page.tsx` — Delete edge callback + confirmation modal
- `apps/server/src/routes/machines.routes.ts` — Cascade delete dependency_links before machine deletion
- `apps/server/src/routes/machines.routes.test.ts` — Test for cascade deletion
