# Story 2.5: Page detail noeud, modification & suppression

Status: Done

## Story

As a administrateur,
I want consulter et modifier les parametres d'un noeud et le supprimer si necessaire,
So that je peux maintenir ma configuration a jour.

## Acceptance Criteria

1. **En-tete de la page detail**
   - Given je navigue vers `/nodes/:id`
   - When le noeud existe
   - Then l'en-tete affiche : icone (NodeTypeIcon), nom, type (badge), statut (StatusBadge), IP
   - And un lien "Retour aux noeuds" est visible

2. **Section Parametres editables**
   - Given la page detail est affichee
   - When je consulte la section Parametres
   - Then les champs suivants sont editables : nom, IP, MAC, URL service, utilisateur SSH, mot de passe SSH (masque)
   - And les champs sont pre-remplis avec les valeurs actuelles du noeud
   - And le mot de passe SSH est affiche comme `********` s'il existe (jamais la valeur reelle)

3. **Sauvegarde des modifications**
   - Given je modifie un ou plusieurs parametres
   - When je clique sur "Enregistrer"
   - Then les modifications sont sauvegardees via `PATCH /api/nodes/:id`
   - And les credentials modifies sont re-chiffres AES-256-GCM cote serveur
   - And un toast de succes s'affiche ("Noeud mis a jour")
   - And le bouton passe en etat loading pendant la requete

4. **Test de connexion**
   - Given la page detail affiche les actions
   - When je clique sur "Tester la connexion"
   - Then le connecteur correspondant execute `testConnection()` via `POST /api/nodes/:id/test-connection`
   - And le bouton passe en etat loading pendant le test
   - And un toast de succes ou d'erreur s'affiche selon le resultat

5. **Bouton Supprimer et modal de confirmation**
   - Given je veux supprimer le noeud
   - When je clique sur "Supprimer"
   - Then une modal de confirmation s'affiche ("Supprimer definitivement [nom] ?")

6. **Avertissement enfants lors de la suppression**
   - Given le noeud a des enfants heberges (children query)
   - When la modal de confirmation s'affiche
   - Then un avertissement supplementaire liste le nombre d'enfants qui seront egalement supprimes
   - And le texte indique clairement que la suppression est irreversible

7. **Execution de la suppression**
   - Given je confirme la suppression dans la modal
   - When la suppression est effectuee via `DELETE /api/nodes/:id`
   - Then le noeud et ses enfants heberges sont supprimes de la base (cascade FK)
   - And je suis redirige vers `/nodes`
   - And un toast de succes s'affiche ("Noeud supprime")

8. **URL d'acces au service**
   - Given la page detail affiche le champ "URL d'acces"
   - When je definis l'URL du service et enregistre
   - Then cette URL est sauvegardee pour le futur bouton "Ouvrir" du dashboard (FR49)

## Tasks / Subtasks

- [x] Task 1 — Route DELETE /api/nodes/:id (AC: #5, #6, #7)
  - [x] 1.1 Ajouter la route `DELETE /api/nodes/:id` dans `nodes.routes.ts`
  - [x] 1.2 Verifier que le noeud existe (404 sinon)
  - [x] 1.3 Supprimer le noeud (la cascade FK `onDelete: 'cascade'` supprime les enfants automatiquement)
  - [x] 1.4 Logger l'operation dans `operationLogs`
  - [x] 1.5 Retourner `{ data: { success: true } }`
  - [x] 1.6 Ecrire les tests (succes, 404, cascade verification)

- [x] Task 2 — Etendre PATCH /api/nodes/:id pour macAddress, sshUser, sshPassword (AC: #2, #3)
  - [x] 2.1 Ajouter `macAddress`, `sshUser`, `sshPassword` au schema body et au type Body de la route PATCH
  - [x] 2.2 Si `sshPassword` est fourni, chiffrer avec `encrypt()` et stocker dans `sshCredentialsEncrypted`
  - [x] 2.3 Si `sshPassword` est vide string `""`, mettre `sshCredentialsEncrypted` a `null` (suppression du mot de passe)
  - [x] 2.4 Mettre a jour `UpdateNodePayload` dans `nodes.api.ts` et `packages/shared/src/api/nodes.ts` si applicable
  - [x] 2.5 Ecrire les tests (update macAddress, sshUser, sshPassword encryption, password removal)

- [x] Task 3 — Hook useDeleteNode (AC: #7)
  - [x] 3.1 Ajouter `useDeleteNode` dans `nodes.api.ts` — mutation `DELETE /api/nodes/:id`
  - [x] 3.2 `onSuccess` : invalider queries `['nodes']` + rediriger vers `/nodes`

- [x] Task 4 — Section Parametres editables dans node-detail-page (AC: #2, #3, #8)
  - [x] 4.1 Ajouter un formulaire avec TextInput pour : nom, ipAddress, macAddress, serviceUrl, sshUser
  - [x] 4.2 Ajouter PasswordInput pour sshPassword (afficher `********` si credentials existent, sinon vide)
  - [x] 4.3 Bouton "Enregistrer" avec `useUpdateNode` — loading state pendant mutation
  - [x] 4.4 Toast notification succes/erreur via `notifications.show()`
  - [x] 4.5 Ne pas envoyer sshPassword dans le PATCH si l'utilisateur n'a pas modifie le champ

- [x] Task 5 — Bouton Tester la connexion (AC: #4)
  - [x] 5.1 Ajouter bouton "Tester la connexion" avec `useTestConnection` (hook existant)
  - [x] 5.2 Loading state pendant le test
  - [x] 5.3 Toast succes/erreur selon resultat

- [x] Task 6 — Bouton Supprimer et modal de confirmation (AC: #5, #6, #7)
  - [x] 6.1 Ajouter bouton "Supprimer" (couleur rouge, variante outline)
  - [x] 6.2 Modal de confirmation avec nom du noeud ("Supprimer definitivement X ?")
  - [x] 6.3 Si enfants existent (children query deja chargee), afficher avertissement avec compteur
  - [x] 6.4 Bouton "Confirmer" dans la modal — appel `useDeleteNode` + redirection `/nodes`
  - [x] 6.5 Toast succes apres suppression

- [x] Task 7 — Tests frontend (AC: tous)
  - [x] 7.1 Test : affichage en-tete (nom, type badge, status badge, IP)
  - [x] 7.2 Test : formulaire parametres pre-rempli
  - [x] 7.3 Test : clic Enregistrer → appel PATCH
  - [x] 7.4 Test : clic Tester la connexion → appel POST test-connection
  - [x] 7.5 Test : clic Supprimer → modal de confirmation visible
  - [x] 7.6 Test : modal avec avertissement enfants quand enfants existent
  - [x] 7.7 Test : confirmer suppression → appel DELETE + redirection
  - [x] 7.8 Test : etat loading (skeleton loader au chargement initial)

## Dev Notes

### Stack & Patterns

- **Backend** : Fastify + Drizzle ORM + better-sqlite3. Routes dans `apps/server/src/routes/nodes.routes.ts`
- **Frontend** : React 19 + Mantine v7 + TanStack Query. Page dans `apps/web/src/features/nodes/node-detail-page.tsx`
- **API hooks** : `apps/web/src/api/nodes.api.ts` — pattern `useMutation` + `queryClient.invalidateQueries`
- **Format API** : `{ data: {...} }` succes, `{ error: { code, message, details? } }` erreur
- **Encryption** : `encrypt()`/`decrypt()` depuis `apps/server/src/utils/crypto.js` — AES-256-GCM
- **Tests** : Vitest, co-localises (`.test.ts` a cote du fichier source)
- **Communication** : Toasts via `@mantine/notifications` — `notifications.show({ title, message, color })`

### Composants reutilisables existants (NE PAS recreer)

- `StatusBadge` : `apps/web/src/components/shared/status-badge.tsx` — badge colore par statut (online→vert, offline→gris, etc.)
- `NodeTypeIcon` : `apps/web/src/components/shared/node-type-icon.tsx` — icone par type (physical→IconServer, vm→IconDeviceDesktop, lxc→IconBox, container→IconBrandDocker)
- `sanitizeNode()` : Fonction dans `nodes.routes.ts` qui strip les champs chiffres (`sshCredentialsEncrypted`, `tokenSecretEncrypted`, `passwordEncrypted`) des reponses API

### Backend — Route DELETE

```typescript
// Pattern a suivre (identique aux autres routes) :
fastify.delete<{ Params: { id: string } }>(
  '/api/nodes/:id',
  { schema: { params: ..., response: { 200: ..., 404: errorResponseSchema } } },
  async (request, reply) => {
    const [node] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));
    if (!node) return reply.status(404).send({ error: { code: 'NODE_NOT_FOUND', ... } });
    await fastify.db.delete(nodes).where(eq(nodes.id, id));
    // La FK parentId avec onDelete:'cascade' supprime les enfants automatiquement
    await fastify.db.insert(operationLogs).values({ level: 'info', source: 'nodes', message: `Node deleted: ${node.name}`, details: { nodeId: id } });
    return { data: { success: true } };
  }
);
```

### Backend — Extension PATCH

Le PATCH actuel (`nodes.routes.ts:685-751`) supporte `name`, `serviceUrl`, `configured`, `ipAddress`. Ajouter :
- `macAddress?: string` — direct update
- `sshUser?: string` — direct update
- `sshPassword?: string` — si fourni et non-vide, `encrypt(sshPassword)` → `sshCredentialsEncrypted`. Si vide `""`, mettre `sshCredentialsEncrypted` a `null`

### Frontend — Hook useDeleteNode

```typescript
export function useDeleteNode() {
  const queryClient = useQueryClient();
  return useMutation<{ data: { success: boolean } }, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}
```

### Frontend — Formulaire parametres

- Utiliser `useState` pour chaque champ editable, initialise depuis `node.*`
- Pour le mot de passe SSH : initialiser a `''`, afficher placeholder `********` si `node.sshUser` existe (indice qu'un password a ete defini), ne l'envoyer dans PATCH que si modifie
- Utiliser `<TextInput>` pour nom, IP, MAC, URL, SSH user
- Utiliser `<PasswordInput>` pour SSH password
- Bouton "Enregistrer" : construire le payload PATCH avec uniquement les champs modifies
- Wrapper le formulaire dans un `<Card withBorder>`

### Frontend — Modal suppression

- Utiliser `<Modal>` de Mantine avec `opened` state
- Titre : "Supprimer definitivement {nom} ?"
- Si `children.length > 0` : afficher `<Alert color="orange">` avec "Attention : {n} noeud(s) enfant(s) seront egalement supprimes."
- Bouton "Annuler" + Bouton "Supprimer" (color="red") avec loading state

### DB — Cascade suppression

La table `nodes` a un FK self-referentiel `parentId → nodes.id` avec `onDelete: 'cascade'` (`schema.ts:97-100`). En SQLite, cela supprime automatiquement tous les enfants recursifs quand un parent est supprime. **Aucune logique manuelle de cascade necessaire.**

### Donnees existantes dans node-detail-page.tsx

La page actuelle charge deja :
- `useNode(id)` → `data.data.node` : toutes les proprietes du noeud
- `useDiscoveredNodes(id)` → `childrenData.data.nodes` : enfants (configures + decouverts)
- Sections existantes : Capacites (Proxmox/Docker config), Services a configurer, Noeuds configures
- Modals existantes : ConfigureProxmoxModal, ConfigureDockerModal, ConfigureDiscoveredModal

**La page doit etre etendue, pas reconstruite.** Ajouter les sections Parametres, les boutons d'action et la modal de suppression a la page existante.

### Tests — Patterns etablis

- `renderWithProviders()` : wrapper QueryClient + MantineProvider + BrowserRouter (voir `nodes-page.test.tsx`)
- Mock fetch : `vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...})))`
- Mock navigation : `vi.mock('react-router', ...)` pour intercepter `useNavigate` et `useParams`
- `window.matchMedia` mock pour simuler desktop viewport en jsdom
- Scope queries au table avec `within(table)` pour eviter les collisions de texte avec les Select dropdowns

### Anti-patterns a eviter

- **NE PAS** envoyer le mot de passe SSH en clair dans la reponse GET — `sanitizeNode()` strip deja `sshCredentialsEncrypted`
- **NE PAS** recreer StatusBadge ou NodeTypeIcon — ils existent dans `components/shared/`
- **NE PAS** ajouter un endpoint GET pour savoir si un noeud a des enfants — utiliser la query `useDiscoveredNodes(id)` deja chargee
- **NE PAS** implementer la cascade de suppression manuellement — le FK `onDelete: 'cascade'` gere tout
- **NE PAS** utiliser `useMediaQuery` sans mock dans les tests — jsdom ne supporte pas les media queries CSS

### Project Structure Notes

- Backend routes : `apps/server/src/routes/nodes.routes.ts` (ajouter DELETE dans ce fichier)
- Backend tests : `apps/server/src/routes/nodes.routes.test.ts` (ajouter tests DELETE + PATCH etendu)
- Frontend page : `apps/web/src/features/nodes/node-detail-page.tsx` (etendre ce fichier)
- Frontend tests : `apps/web/src/features/nodes/node-detail-page.test.tsx` (etendre ce fichier)
- Frontend API hooks : `apps/web/src/api/nodes.api.ts` (ajouter useDeleteNode, etendre UpdateNodePayload)
- Composants partages : `apps/web/src/components/shared/` (StatusBadge, NodeTypeIcon — reutiliser)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — Acceptance criteria BDD
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] — FRs couverts : FR13 (suppression), FR14 (modification), FR12 (test connexion), FR49 (URL service)
- [Source: _bmad-output/planning-artifacts/architecture.md] — ARCH-11 (PlatformError), ARCH-13 (AES-256-GCM), ARCH-15 (Vitest), ARCH-17 (conventions nommage)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-10] — Page detail noeud (en-tete, parametres editables, enfants, actions)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-13] — Toasts Mantine (~5s, position haut-droite)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-14] — Modal confirmation suppression ("Supprimer definitivement X ?")
- [Source: apps/server/src/db/schema.ts:96-101] — FK cascade onDelete
- [Source: apps/server/src/routes/nodes.routes.ts:684-751] — PATCH existant a etendre
- [Source: apps/web/src/api/nodes.api.ts:211-256] — hooks existants (useUpdateNode, useDiscoveredNodes)
- [Source: apps/web/src/features/nodes/node-detail-page.tsx] — page actuelle a etendre
- [Source: _bmad-output/implementation-artifacts/2-4-page-noeuds-et-vue-tabulaire.md] — Story precedente (StatusBadge, NodeTypeIcon, patterns tests)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Tests `getByText('Supprimer')` ne declenchait pas la modal Mantine → fix avec `getByRole('button', { name: /Supprimer/ })` + `findByText` asynchrone pour le contenu de la modal
- Tests `vi.spyOn(globalThis, 'fetch')` appele deux fois creait deux spies independants → fix en retournant le spy depuis `mockFetch()` et en chainant `.mockResolvedValueOnce()` dessus
- Mock `useNavigate` via `vi.mock('react-router')` pour intercepter les redirections dans les tests

### Completion Notes List

- Task 1 : Route DELETE /api/nodes/:id ajoutee — verification existence (404), suppression avec cascade FK automatique, logging. 4 tests backend (succes, 404, cascade, log).
- Task 2 : PATCH /api/nodes/:id etendu pour macAddress, sshUser, sshPassword — chiffrement AES-256-GCM pour sshPassword, suppression password avec string vide. 4 tests backend.
- Task 3 : Hook useDeleteNode ajoute dans nodes.api.ts — mutation DELETE avec invalidation cache. UpdateNodePayload etendu avec macAddress, sshUser, sshPassword.
- Task 4 : Section Parametres editables ajoutee — formulaire TextInput (nom, IP, MAC, URL, SSH user) + PasswordInput (placeholder ********). Bouton Enregistrer avec loading state. Toast succes/erreur. Seuls les champs modifies sont envoyes dans le PATCH.
- Task 5 : Bouton Tester la connexion ajoute dans section Actions — utilise useTestConnection existant, loading state, toast succes/erreur.
- Task 6 : Bouton Supprimer + Modal de confirmation — titre "Supprimer definitivement X ?", alerte orange avec compteur enfants si children existent, boutons Annuler/Supprimer. Appel DELETE + redirection /nodes + toast succes.
- Task 7 : 20 tests frontend (12 nouveaux, 8 adaptes) — en-tete avec StatusBadge/NodeTypeIcon, formulaire pre-rempli, PATCH au save, test-connection au clic, modal suppression, avertissement enfants, DELETE + redirect, loading state. Total : 267 tests (179 server + 88 web), 0 regression.

### File List

**Fichiers modifies :**
- `apps/server/src/routes/nodes.routes.ts` — route DELETE + PATCH etendu (macAddress, sshUser, sshPassword)
- `apps/server/src/routes/nodes.routes.test.ts` — 8 nouveaux tests (DELETE + PATCH etendu)
- `apps/web/src/features/nodes/node-detail-page.tsx` — section Parametres, boutons Actions, modal suppression, StatusBadge/NodeTypeIcon
- `apps/web/src/features/nodes/node-detail-page.test.tsx` — 20 tests (12 nouveaux + 8 adaptes)
- `apps/web/src/api/nodes.api.ts` — useDeleteNode, UpdateNodePayload etendu
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-5-page-detail-noeud-modification-et-suppression.md`

## Change Log

| Date | Changement |
|---|---|
| 2026-02-13 | Implementation complete Story 2.5 — Page detail noeud avec parametres editables, sauvegarde PATCH etendue (macAddress, sshUser, sshPassword chiffre), test connexion, suppression avec modal de confirmation et cascade FK, route DELETE backend. 20 tests frontend + 8 tests backend ajoutes (267 total). |
