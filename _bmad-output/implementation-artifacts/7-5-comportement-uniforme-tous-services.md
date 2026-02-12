# Story 7.5 : Comportement Uniforme pour Tous les Services

Status: review

## Story

As a administrateur,
I want que tous les services (physical, proxmox, docker, vm, container) aient le meme comportement dans l'UI,
so that je puisse editer, demarrer/arreter et consulter n'importe quel service sans distinction.

## Acceptance Criteria (BDD)

1. **Given** un service de n'importe quel type (physical, proxmox, docker, vm, container)
   **When** j'ouvre sa page de detail
   **Then** je vois les champs editables communs (nom, IP, MAC, SSH user, SSH password, URL service)
   **And** je peux modifier et sauvegarder ces champs
   **And** les champs specifiques (API URL, API credentials) s'affichent pour proxmox/docker uniquement

2. **Given** un service de n'importe quel type est epingle au dashboard
   **When** il est eteint/offline
   **Then** je vois le bouton "Demarrer" et je peux lancer une cascade

3. **Given** un serveur Proxmox ou Docker host avec MAC + IP + SSH configures
   **When** une cascade de demarrage le cible
   **Then** il est demarre via WoL+SSH (meme logique que physical)

4. **Given** un service de n'importe quel type sur le dashboard
   **When** je clique dessus
   **Then** le panneau de detail s'ouvre avec les dependances et l'activite

5. **Given** un service de n'importe quel type
   **When** j'ouvre sa page de detail
   **Then** je peux le supprimer (avec avertissement si des enfants existent)

6. **Given** toutes les modifications sont appliquees
   **When** je lance `tsc --noEmit` et les tests
   **Then** zero erreur, tous les tests passent

7. **Given** un service avec des enfants downstream
   **When** je lance une cascade d'arret sur ce service
   **Then** seuls les enfants downstream et le service cible sont arretes
   **And** les services parents upstream ne sont PAS arretes

8. **Given** une cascade d'arret en cours
   **When** le connecteur echoue (timeout, erreur SSH, etc.)
   **Then** le service en echec passe en statut `error` dans la DB
   **And** les services deja arretes gardent leur statut `offline`/`stopped`
   **And** le frontend reflete correctement les statuts reels

## Tasks / Subtasks

- [x] Task 1 -- Dashboard uniforme (AC: #2, #4)
  - [x] 1.1 Supprimer le filtre `isChildService()` dans `dashboard-page.tsx`
  - [x] 1.2 Passer `onStart`, `activeCascade`, `onTileClick` a TOUS les ServiceTiles
  - [x] 1.3 Verifier que `tsc --noEmit` passe

- [x] Task 2 -- Page detail editable pour tous les types (AC: #1, #5)
  - [x] 2.1 Supprimer les gardes `isParentService` / `isChildService` du formulaire d'edition
  - [x] 2.2 Afficher les champs communs (nom, IP, MAC, SSH, URL service) pour TOUS les types
  - [x] 2.3 Garder les champs API (apiUrl, apiCredentials) uniquement pour proxmox/docker
  - [x] 2.4 Afficher la zone de suppression pour TOUS les types (avec avertissement enfants)
  - [x] 2.5 Adapter le handler de soumission (`handleSave`) pour envoyer les champs de tous les types
  - [x] 2.6 Verifier que `tsc --noEmit` passe

- [x] Task 3 -- Connector factory pour proxmox/docker hosts (AC: #3)
  - [x] 3.1 Dans `connector-factory.ts`, creer un WolSshConnector pour les services `proxmox`/`docker` qui ont macAddress + ipAddress + sshCredentials
  - [x] 3.2 Mettre a jour les tests dans `connector-factory.test.ts`
  - [x] 3.3 Verifier que les tests backend passent

- [x] Task 5 -- Bugfix cascade stop (AC: #7, #8)
  - [x] 5.1 Dans `cascade-engine.ts` `executeCascadeStop()` : retirer `...upstream` de la chaine de stop — la cascade d'arret ne doit PAS remonter vers les parents, seulement arreter les enfants downstream + la cible
  - [x] 5.2 Dans `cascade-engine.ts` `executeCascadeStop()` catch block (lignes 313-327) : mettre a jour le statut du service en `error` dans la DB avant le `return`, afin que le service ne reste pas en statut "actif" apres un echec d'arret
  - [x] 5.3 Mettre a jour les tests dans `cascade-engine.test.ts` pour couvrir les deux corrections
  - [x] 5.4 Verifier que tous les tests passent

- [x] Task 4 -- Verification finale (AC: #6)
  - [x] 4.1 `tsc --noEmit` sur server + web — zero erreur
  - [x] 4.2 Tous les tests (server + web) passent
  - [x] 4.3 Verification manuelle : un service VM affiche les champs editables sur la page detail

## Dev Notes

### Vue d'ensemble

Story issue du Sprint Change Proposal (sprint-change-proposal-2026-02-11-uniform-services.md). Supprime les distinctions residuelles parent/enfant dans le frontend et le connector factory apres l'unification du modele de donnees (Epic 7).

**Pre-requis :** Stories 7-1 a 7-4 terminees. 350 tests passent. Modele unifie `services` en place.

### Changements cles

#### 1. Dashboard (`dashboard-page.tsx`)

Le filtre `isChildService()` (lignes ~98-176) restreint `onStart`, `activeCascade` et `onTileClick` aux seuls VMs/containers. Supprimer ce filtre pour passer ces props a TOUS les tiles.

Code actuel :
```tsx
const isChildService = (type: string) => type === 'vm' || type === 'container';
activeCascade={isChildService(service.type) ? cascadeByService.get(service.id) : undefined}
onStart={isChildService(service.type) ? (id) => startCascade.mutate(id) : undefined}
onTileClick={isChildService(service.type) ? setSelectedServiceId : undefined}
```

#### 2. Page detail (`service-detail-page.tsx`)

Le formulaire d'edition (lignes ~689-807) et la zone de suppression (lignes ~809-866) sont entoures de `{isParentService && ...}`. Supprimer ces gardes.

Champs communs a afficher pour TOUS les types :
- `name` (TextInput)
- `ipAddress` (TextInput)
- `macAddress` (TextInput)
- `sshUser` (TextInput)
- `sshPassword` (PasswordInput)
- `serviceUrl` (TextInput)

Champs specifiques (conditionnels) :
- `apiUrl` : uniquement si type === 'proxmox' || type === 'docker'
- `apiCredentials` (proxmoxAuthMode, tokenId, etc.) : uniquement si type === 'proxmox'
- Docker API password/token : uniquement si type === 'docker'

Le handler `handleSave` doit envoyer les champs communs pour TOUS les types, pas uniquement pour les parents.

#### 3. Connector factory (`connector-factory.ts`)

Actuellement, les services `proxmox` et `docker` retournent `null` (pas de connector). Un serveur Proxmox ou Docker host EST une machine physique — si l'utilisateur fournit macAddress + ipAddress + sshCredentials, il peut etre demarre via WoL et arrete via SSH.

Code actuel (lignes ~104-105) :
```typescript
// proxmox/docker → return null
return null;
```

Nouveau comportement :
```typescript
if ((service.type === 'proxmox' || service.type === 'docker') &&
    service.macAddress && service.ipAddress && service.sshCredentialsEncrypted) {
  return new WolSshConnector({
    macAddress: service.macAddress,
    ipAddress: service.ipAddress,
    sshUser: service.sshUser,
    sshPassword: decrypt(service.sshCredentialsEncrypted),
  });
}
return null; // pas de credentials → pas de controle direct
```

### Patterns du projet

- **Workspace commands** : `npx -w @wakehub/server vitest run`, `npx -w @wakehub/web vitest run`
- **tsc** : `npx -w @wakehub/server tsc --noEmit`, `npx -w @wakehub/web tsc --noEmit`
- **Tests** : Vitest, co-localises, `app.inject()` pour les routes
- **Backend** : Fastify, Drizzle ORM, `{ data: {...} }` / `{ error: { code, message } }`

#### 4. Bugfix cascade stop (`cascade-engine.ts`) — AC #7, #8

**Bug A — Cascade remonte vers les parents (AC #7)**

`executeCascadeStop()` lignes 209-218 construit la chaine :
```typescript
const chain = [
  ...downstream.reverse(),  // enfants
  { ... serviceId ... },     // cible
  ...upstream,               // ← SUPPRIMER : les parents ne doivent pas etre arretes
];
```

Correction : retirer `upstream` et la variable `upstream` entierement. La chaine de stop ne doit contenir que les downstream + la cible.

**Bug B — Statut non mis a jour en cas d'erreur (AC #8)**

`executeCascadeStop()` catch block (lignes 313-327) : quand `connector.stop()` ou `pollUntilStatus()` echoue, le service garde son ancien statut "actif" en DB.

Correction : ajouter un update DB dans le catch pour mettre le service en statut `error` :
```typescript
} catch (err) {
  // Marquer le service en erreur dans la DB
  db.update(services)
    .set({ status: 'error' as ServiceStatus, updatedAt: new Date() })
    .where(eq(services.id, node.nodeId))
    .run();
  sse?.broadcast('status-change', {
    serviceId: node.nodeId,
    status: 'error', timestamp: new Date().toISOString(),
  });
  // ... reste du catch existant ...
}
```

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-11-uniform-services.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5]
- [Source: apps/web/src/features/dashboard/dashboard-page.tsx]
- [Source: apps/web/src/features/services/service-detail-page.tsx]
- [Source: apps/server/src/services/connector-factory.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Suppression de `isChildService()` et des conditions de type dans le dashboard — tous les services epingles ont maintenant les memes props (onStart, activeCascade, onTileClick)
- Formulaire d'edition : champs communs (nom, IP, MAC, SSH, URL) affiches pour TOUS les types de service, champs API restes conditionnels pour proxmox/docker
- Zone de suppression accessible pour tous les types avec avertissement contextuel si des enfants existent
- Connector factory : les hosts proxmox/docker avec MAC+IP+SSH obtiennent un WolSshConnector pour demarrage/arret via WoL+SSH
- 254 tests backend + 98 tests frontend = 352 tests OK, tsc zero erreur sur les 2 workspaces
- Bugfix cascade stop (Task 5) : suppression de `...upstream` de la chaine d'arret — la cascade ne remonte plus vers les services parents (AC #7)
- Bugfix statut erreur (Task 5) : ajout d'un update DB `status: 'error'` + broadcast SSE `status-change` dans le catch block de `executeCascadeStop()` quand un connecteur echoue (AC #8)
- 3 nouveaux tests + 4 tests existants mis a jour dans `cascade-engine.test.ts` pour couvrir les deux corrections
- 261 tests backend + 104 tests frontend = 365 tests OK, tsc zero erreur sur les 2 workspaces

### File List

- `apps/web/src/features/dashboard/dashboard-page.tsx` — Suppression isChildService, props uniformes
- `apps/web/src/features/services/service-detail-page.tsx` — Formulaire editable + zone suppression pour tous types
- `apps/server/src/services/connector-factory.ts` — WolSshConnector pour proxmox/docker hosts avec MAC+IP+SSH
- `apps/server/src/services/connector-factory.test.ts` — 2 nouveaux tests pour proxmox/docker WoL
- `apps/server/src/services/cascade-engine.ts` — Suppression upstream du stop chain, ajout statut error dans catch
- `apps/server/src/services/cascade-engine.test.ts` — 3 nouveaux tests + 4 mis a jour pour bugfix cascade stop

