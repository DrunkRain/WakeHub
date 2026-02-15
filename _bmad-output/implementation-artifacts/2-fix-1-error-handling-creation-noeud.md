# Story 2.fix.1: Correction gestion d'erreurs creation de noeud

Status: Done

## Story

As a administrateur,
I want voir un message d'erreur clair quand la creation d'un noeud echoue,
so that je comprends le probleme et peux corriger mes saisies au lieu de voir un message generique.

## Contexte du Bug

**Symptome :** Lors de l'ajout d'une machine Proxmox via le wizard, l'utilisateur entre IP, MAC, credentials SSH, valide et voit :
- Toast : "Erreur — Impossible de creer le noeud"
- Console : `POST /api/nodes 500 (Internal Server Error)`
- La connexion SSH est pourtant correcte

**Cause racine identifiee — 2 bugs combines :**

1. **Backend (`nodes.routes.ts:125-158`)** : La route `POST /api/nodes` n'a **aucun try-catch**. Si `encrypt()` ou l'insertion DB echoue, Fastify retourne un 500 brut sans message exploitable.

2. **Frontend (`add-machine-wizard.tsx:109-114`)** : Le bloc `catch` est generique — il affiche toujours "Impossible de creer le noeud" sans extraire le message d'erreur reel de la reponse serveur.

```typescript
// ACTUEL — Backend (pas de try-catch)
async (request, _reply) => {
  const sshCredentialsEncrypted = sshPassword ? encrypt(sshPassword) : null; // ← peut throw
  const [newNode] = await fastify.db.insert(nodes).values({...}).returning(); // ← peut throw
  // ... pas de catch
}

// ACTUEL — Frontend (catch generique)
} catch {
  notifications.show({
    title: 'Erreur',
    message: 'Impossible de creer le noeud',  // ← toujours ce message
    color: 'red',
  });
}
```

## Acceptance Criteria

1. **Try-catch backend sur POST /api/nodes**
   - Given une erreur survient lors de la creation d'un noeud (encryption, DB, validation)
   - When le serveur intercepte l'erreur
   - Then il retourne une reponse JSON structuree `{ error: { code, message } }` avec un status HTTP 400 ou 500 selon le type d'erreur
   - And le message d'erreur est descriptif (pas un stack trace brut)

2. **Try-catch backend sur les autres routes de mutation**
   - Given les routes `PATCH /api/nodes/:id` et `PUT /api/nodes/:id/capabilities/proxmox` existent
   - When une erreur survient dans ces routes
   - Then elles retournent egalement une reponse JSON structuree avec code et message
   - And les erreurs `PlatformError` sont traitees avec leur code specifique (status 400)
   - And les erreurs inattendues retournent un status 500 avec code `INTERNAL_ERROR`

3. **Frontend affiche le message d'erreur reel**
   - Given le backend retourne `{ error: { code: 'X', message: 'Y' } }`
   - When le wizard intercepte l'erreur
   - Then le toast affiche le message reel du serveur au lieu de "Impossible de creer le noeud"
   - And le message est lisible pour l'utilisateur (pas un code technique brut)

4. **Console.error pour le debugging**
   - Given une erreur se produit cote frontend
   - When le catch est execute
   - Then l'erreur complete est loguee dans `console.error` pour faciliter le debug

5. **Les tests existants continuent de passer**
   - Given les 180 tests existants (130 server + 50 web)
   - When les corrections sont appliquees
   - Then tous les tests passent sans regression
   - And de nouveaux tests couvrent les cas d'erreur corrigees

## Tasks / Subtasks

- [x] Task 1 : Ajouter try-catch sur POST /api/nodes (AC: #1)
  - [x] 1.1 Envelopper le handler `POST /api/nodes` dans un try-catch dans `apps/server/src/routes/nodes.routes.ts`
  - [x] 1.2 Catch erreur generique → retourner `reply.status(500).send({ error: { code: 'NODE_CREATION_FAILED', message: error.message } })`
  - [x] 1.3 Logger l'erreur via `fastify.log.error()`
  - [x] 1.4 Ajouter response schema `500: errorResponseSchema` pour eviter que Fastify filtre la reponse

- [x] Task 2 : Verifier les try-catch sur les autres routes de mutation (AC: #2)
  - [x] 2.1 `PATCH /api/nodes/:id` — ajoute try-catch avec code `NODE_UPDATE_FAILED` + schema 500
  - [x] 2.2 `PUT /api/nodes/:id/capabilities/proxmox` — ajoute try-catch sur le bloc encryption + DB save (code `PROXMOX_SAVE_FAILED`) + schema 500
  - [x] 2.3 `POST /api/nodes/:id/test-connection` — deja protege par try-catch (verifie, aucune modification)
  - [x] 2.4 Toutes les routes de mutation retournent desormais des erreurs JSON structurees

- [x] Task 3 : Corriger le catch frontend dans add-machine-wizard.tsx (AC: #3, #4)
  - [x] 3.1 Modifier le bloc catch pour extraire `err.error?.message` de la reponse serveur (pattern identique a `configure-proxmox-modal.tsx`)
  - [x] 3.2 Fallback sur "Impossible de creer le noeud" si le message n'est pas disponible
  - [x] 3.3 Ajouter `console.error('Node creation failed:', error)` pour le debugging

- [x] Task 4 : Tests (AC: #5)
  - [x] 4.1 Ajoute test backend : `POST /api/nodes` avec parentId FK invalide → verifie reponse JSON structuree `{ error: { code, message } }`
  - [x] 4.2 131 tests backend passent (130 existants + 1 nouveau)
  - [x] 4.3 50 tests frontend passent (aucune regression)
  - [x] 4.4 Total : 181 tests, zero regression

## Dev Notes

### Fichiers a modifier

| Fichier | Modification |
|---|---|
| `apps/server/src/routes/nodes.routes.ts` | Ajouter try-catch sur POST /api/nodes (lignes 125-158), verifier PATCH et autres routes |
| `apps/web/src/features/nodes/add-machine-wizard.tsx` | Corriger le catch generique (lignes 109-115) |

### Pattern de reference — gestion d'erreur correcte

Le `configure-proxmox-modal.tsx` a deja le BON pattern d'extraction d'erreur cote frontend (lignes 63-69) :

```typescript
} catch (error) {
  const err = error as { error?: { message?: string } };
  notifications.show({
    title: 'Erreur de connexion',
    message: err.error?.message ?? 'Impossible de se connecter a Proxmox',
    color: 'red',
  });
}
```

Et la route `PUT /api/nodes/:id/capabilities/proxmox` a deja le BON pattern de try-catch backend (lignes ~370-380) :

```typescript
try {
  client = new ProxmoxClient(clientConfig);
  await client.get('/nodes');
} catch (error) {
  return reply.status(400).send({
    error: {
      code: 'PROXMOX_CONNECTION_FAILED',
      message: `Failed to connect to Proxmox: ${(error as Error).message}`,
    },
  });
}
```

**Reproduire ces patterns existants** — ne pas inventer un nouveau pattern.

### Format de reponse erreur — pattern existant a respecter

```typescript
// Format normalise deja utilise dans le projet
{ error: { code: string, message: string, details?: Record<string, unknown> } }

// Codes d'erreur a utiliser
'NODE_CREATION_FAILED'       // Echec creation noeud (encryption, DB)
'NODE_UPDATE_FAILED'         // Echec mise a jour noeud
'VALIDATION_ERROR'           // Erreur de validation (deja gere par Fastify JSON Schema)
'INTERNAL_ERROR'             // Erreur inattendue generique
```

### Reponse schemas Fastify — rappel critique

**Toute reponse HTTP doit avoir un schema declare dans la route.** Si on retourne un 500 sans schema declare, le build Docker echouera. Les schemas 400 et 500 existent deja dans le fichier (`errorResponseSchema`). Verifier qu'ils sont declares pour la route POST /api/nodes.

### Commandes de test

```bash
npm run test -w apps/server    # Tests backend
npm run test -w apps/web       # Tests frontend
```

### Impact minimal

Ce bugfix est **chirurgical** — 2 fichiers modifies, pas de changement de schema DB, pas de nouvelle dependance, pas de nouvelle route. Le risque de regression est quasi nul.

### Project Structure Notes

- Aucun nouveau fichier a creer
- Aucune migration DB
- Aucune nouvelle dependance

### References

- [Source: nodes.routes.ts:125-158] — Route POST /api/nodes sans try-catch
- [Source: add-machine-wizard.tsx:109-115] — Catch generique frontend
- [Source: configure-proxmox-modal.tsx:63-69] — Pattern correct d'extraction d'erreur (reference)
- [Source: nodes.routes.ts:370-380] — Pattern correct de try-catch backend (reference)
- [Source: 2-1-ajout-machine-physique-et-base-technique.md] — Story originale
- [Source: 2-2-capacite-proxmox-et-decouverte-vms-lxcs.md] — Story Proxmox

### Anti-patterns a eviter

- **NE PAS** retourner des stack traces dans les reponses d'erreur API — message lisible uniquement
- **NE PAS** swallow les erreurs — toujours logger via `fastify.log.error()` cote backend
- **NE PAS** afficher le code d'erreur brut a l'utilisateur — afficher le message humain
- **NE PAS** modifier la logique metier — uniquement ajouter la gestion d'erreur manquante
- **NE PAS** ajouter des response schemas manquants pour le code 500 s'ils existent deja

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Foreign key constraint test: Sending `parentId: 'non-existent-parent-id'` to POST /api/nodes with `PRAGMA foreign_keys = ON` triggers an SQLite FK violation. Before fix: unhandled 500. After fix: structured `{ error: { code: 'NODE_CREATION_FAILED', message: '...' } }`.

### Completion Notes List

- Task 1: Added try-catch to POST /api/nodes handler. Catches all errors, logs via `fastify.log.error()`, returns `{ error: { code: 'NODE_CREATION_FAILED', message } }` with status 500. Added `500: errorResponseSchema` to route schema.
- Task 2: Added try-catch to PATCH /api/nodes/:id (code: `NODE_UPDATE_FAILED`). Wrapped encryption + DB save in PUT /api/nodes/:id/capabilities/proxmox (code: `PROXMOX_SAVE_FAILED`). Verified POST /api/nodes/:id/test-connection already had proper try-catch. Added `500: errorResponseSchema` to all mutation routes.
- Task 3: Replaced generic `catch {}` with `catch (error)` in add-machine-wizard.tsx. Now extracts `err.error?.message` from server response (same pattern as configure-proxmox-modal.tsx). Falls back to generic message if no server message. Added `console.error` for debugging.
- Task 4: Added 1 new test (FK violation on POST /api/nodes). All 181 tests pass (131 server + 50 web). Zero regression.

### Change Log

- 2026-02-13: Implemented Story 2.fix.1 — Error handling correction for node creation. 2 files modified, 1 new test, 181 total tests passing.

### File List

Modified files:
- apps/server/src/routes/nodes.routes.ts — Added try-catch to POST /api/nodes, PATCH /api/nodes/:id, PUT capabilities/proxmox encryption+save. Added 500 response schemas.
- apps/server/src/routes/nodes.routes.test.ts — Added FK violation error handling test.
- apps/web/src/features/nodes/add-machine-wizard.tsx — Fixed generic catch to extract server error message + console.error.
