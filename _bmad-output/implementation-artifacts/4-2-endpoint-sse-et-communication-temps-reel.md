# Story 4.2 : Endpoint SSE & communication temps reel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want voir les mises a jour de statut en temps reel sans recharger la page,
So that je sais toujours l'etat actuel de mes services.

## Acceptance Criteria (BDD)

1. **Given** le service `sse-manager.ts` est implemente
   **When** il est utilise
   **Then** il gere les connexions SSE des clients (ajout, suppression a la deconnexion)
   **And** il expose une methode `broadcast(event, data)` pour envoyer un evenement a tous les clients connectes
   **And** il gere la reconnexion automatique (Last-Event-ID)

2. **Given** la route `GET /api/events` est implementee
   **When** un client authentifie se connecte
   **Then** une connexion SSE est etablie (Content-Type: text/event-stream)
   **And** la connexion est protegee par le middleware auth (cookie de session ou Bearer token via query param)
   **And** un heartbeat est envoye toutes les 30 secondes pour maintenir la connexion

3. **Given** le moteur de cascade (Story 4.1) execute une cascade
   **When** une etape de la cascade progresse
   **Then** un evenement SSE `cascade-progress` est emis avec : cascadeId, serviceId, step, totalSteps, currentDependency (id, name, status)

4. **Given** une cascade se termine
   **When** elle reussit
   **Then** un evenement SSE `cascade-complete` est emis avec : cascadeId, serviceId, success=true
   **When** elle echoue
   **Then** un evenement SSE `cascade-error` est emis avec : cascadeId, serviceId, failedStep, error (code, message)

5. **Given** le statut d'une resource change (demarrage, arret, erreur)
   **When** le changement est detecte
   **Then** un evenement SSE `status-change` est emis avec : resourceId, resourceType, status, timestamp

6. **Given** le hook React `useSSE()` est implemente
   **When** l'application frontend se charge (utilisateur connecte)
   **Then** une connexion SSE est etablie au montage de l'app
   **And** les evenements SSE declenchent `queryClient.invalidateQueries()` sur les cles de cache TanStack Query concernees
   **And** la reconnexion est automatique en cas de coupure (natif EventSource API)

7. **Given** l'utilisateur n'est pas connecte
   **When** il tente d'acceder a `GET /api/events`
   **Then** le serveur retourne 401

## Tasks / Subtasks

- [x] Task 1 — Types SSE partages (AC: #3, #4, #5)
  - [x] 1.1 Ajouter les types d'evenements SSE dans `packages/shared/src/index.ts`
  - [x] 1.2 Verifier que le build compile

- [x] Task 2 — Service SSE Manager backend (AC: #1)
  - [x] 2.1 Creer `apps/server/src/sse/sse-manager.ts`
  - [x] 2.2 Implementer la gestion des connexions (Map de clients avec reply objects)
  - [x] 2.3 Implementer `broadcast(event, data)` qui envoie a tous les clients
  - [x] 2.4 Implementer `send(clientId, event, data)` pour cibler un client
  - [x] 2.5 Gerer la suppression automatique du client quand la connexion se ferme
  - [x] 2.6 Implementer le heartbeat (30s) via setInterval par client
  - [x] 2.7 Implementer le support Last-Event-ID (compteur incremental d'evenements)
  - [x] 2.8 Tests dans `sse-manager.test.ts`

- [x] Task 3 — Route SSE `GET /api/events` (AC: #2, #7)
  - [x] 3.1 Creer `apps/server/src/routes/events.routes.ts`
  - [x] 3.2 Implementer le handler SSE avec Content-Type text/event-stream
  - [x] 3.3 Gerer l'auth via cookie OU query param `?token=...` (pour compatibilite EventSource)
  - [x] 3.4 Enregistrer la route dans `app.ts`
  - [x] 3.5 Tests dans `events.routes.test.ts`

- [x] Task 4 — Integration SSE dans cascade-engine (AC: #3, #4, #5)
  - [x] 4.1 Modifier `cascade-engine.ts` pour accepter un parametre `sseManager` optionnel
  - [x] 4.2 Emettre `cascade-progress` a chaque progression d'etape
  - [x] 4.3 Emettre `cascade-complete` a la fin d'une cascade reussie
  - [x] 4.4 Emettre `cascade-error` en cas d'echec
  - [x] 4.5 Emettre `status-change` quand un noeud change de statut (start/stop)
  - [x] 4.6 Mettre a jour `cascades.routes.ts` pour passer le sseManager au cascade-engine
  - [x] 4.7 Mettre a jour les tests existants du cascade-engine (aucun test ne doit casser)

- [x] Task 5 — Hook React `useSSE()` frontend (AC: #6)
  - [x] 5.1 Creer `apps/web/src/hooks/use-sse.ts`
  - [x] 5.2 Etablir la connexion EventSource avec token en query param + fallback cookie
  - [x] 5.3 Parser les evenements SSE et invalider les queries TanStack concernees
  - [x] 5.4 Gerer la reconnexion automatique (natif EventSource + retry logic)
  - [x] 5.5 Gerer le cleanup a la deconnexion/unmount
  - [x] 5.6 Integrer le hook dans `auth-guard.tsx` (AuthenticatedShell, au top-level, quand authentifie)

- [x] Task 6 — Build et verification finale
  - [x] 6.1 Verifier que tous les tests backend passent (246 tests)
  - [x] 6.2 Verifier que le build frontend compile (tsc)
  - [x] 6.3 Verifier qu'aucun test existant n'est casse

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story construit la **couche de communication temps reel** de WakeHub via SSE (Server-Sent Events). C'est le pont entre le moteur de cascade backend (story 4.1) et le dashboard frontend (stories 4.3-4.5).

**Architecture SSE (ARCH-07) :**
- Flux unidirectionnel serveur → client
- Endpoint unique : `GET /api/events`
- Reconnexion automatique cote client (natif EventSource API)
- Types d'evenements : `status-change`, `cascade-progress`, `cascade-complete`, `cascade-error`
- Le frontend ne poll jamais — toutes les mises a jour viennent du serveur via SSE

**FRs couverts :** FR27 (progression cascade temps reel), FR35 (etat temps reel), FR36 (statut service), FR37 (mise a jour sans rechargement)

### Exigences techniques detaillees

**Task 1 — Types SSE partages :**

Ajouter dans `packages/shared/src/index.ts` :

```typescript
// === SSE Event Types ===

export type SSEEventType = 'status-change' | 'cascade-progress' | 'cascade-complete' | 'cascade-error';

export interface StatusChangeEvent {
  resourceId: string;
  resourceType: 'machine' | 'resource';
  status: string;
  timestamp: string; // ISO 8601
}

export interface CascadeProgressEvent {
  cascadeId: string;
  resourceId: string;
  step: number;
  totalSteps: number;
  currentDependency: {
    id: string;
    name: string;
    status: string;
  };
}

export interface CascadeCompleteEvent {
  cascadeId: string;
  resourceId: string;
  success: true;
}

export interface CascadeErrorEvent {
  cascadeId: string;
  resourceId: string;
  failedStep: number;
  error: {
    code: string;
    message: string;
  };
}

export type SSEEventData =
  | { event: 'status-change'; data: StatusChangeEvent }
  | { event: 'cascade-progress'; data: CascadeProgressEvent }
  | { event: 'cascade-complete'; data: CascadeCompleteEvent }
  | { event: 'cascade-error'; data: CascadeErrorEvent };
```

**Task 2 — SSE Manager :**

Le SSE Manager est un **singleton** qui maintient un Map de connexions actives et permet de broadcaster des evenements a tous les clients.

```typescript
// apps/server/src/sse/sse-manager.ts

import type { FastifyReply } from 'fastify';

interface SSEClient {
  id: string;
  reply: FastifyReply;
  heartbeatInterval: NodeJS.Timeout;
}

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private eventCounter: number = 0;

  addClient(id: string, reply: FastifyReply): void { ... }
  removeClient(id: string): void { ... }
  broadcast(event: string, data: unknown): void { ... }
  send(clientId: string, event: string, data: unknown): void { ... }
  getClientCount(): number { ... }
  close(): void { ... } // cleanup all intervals+clients
}
```

**Implementation details :**

L'envoi d'un evenement SSE se fait via `reply.raw.write()` :

```typescript
private sendEvent(reply: FastifyReply, event: string, data: unknown, id?: number): void {
  const eventId = id ?? ++this.eventCounter;
  const payload = [
    `id: ${eventId}`,
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    '', ''  // double newline = fin de l'evenement
  ].join('\n');
  reply.raw.write(payload);
}
```

**Heartbeat** : Envoyer un commentaire SSE (`:heartbeat\n\n`) toutes les 30 secondes pour maintenir la connexion ouverte (eviter les timeouts proxy/reverse-proxy).

**Last-Event-ID** : Le compteur `eventCounter` est incremental. Si un client se reconnecte avec `Last-Event-ID`, on peut logger l'info mais on ne replay pas les evenements (approche simple, suffisante pour le MVP).

**Nettoyage** : Quand le client se deconnecte (reply.raw 'close' event), supprimer le client du Map et clearInterval le heartbeat.

**Task 3 — Route SSE :**

```typescript
// apps/server/src/routes/events.routes.ts

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        }
      },
      // Pas de response schema pour SSE (stream)
    }
  }, async (request, reply) => {
    // 1. Auth : verifier cookie session_token OU query param token
    //    Reutiliser extractSessionToken() du auth middleware
    //    Si query.token present, l'utiliser comme Bearer token
    //    Sinon, utiliser le cookie session_token

    // 2. Configurer les headers SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Pour nginx
    });

    // 3. Enregistrer le client dans le SSE Manager
    const clientId = crypto.randomUUID();
    fastify.sseManager.addClient(clientId, reply);

    // 4. Gerer la deconnexion
    request.raw.on('close', () => {
      fastify.sseManager.removeClient(clientId);
    });

    // 5. Ne PAS fermer la reponse (reply.raw reste ouvert)
    // Fastify: retourner reply pour eviter la serialisation automatique
    return reply;
  });
};
```

**Auth SSE specifique :**

L'API `EventSource` du navigateur ne supporte PAS les headers custom (pas de `Authorization: Bearer xxx`). Deux solutions :
1. Cookie `session_token` : fonctionne nativement
2. Query param `?token=xxx` : pour les environnements ou les cookies ne marchent pas (code-server)

Le handler doit verifier les deux : d'abord le cookie, puis le query param. Reutiliser `extractSessionToken()` de `auth.middleware.ts`.

**Important :** La route SSE doit etre **exclue du middleware auth global** (car elle gere l'auth elle-meme via query param). Ajouter `/api/events` a la liste des routes publiques dans `app.ts`, et verifier l'auth manuellement dans le handler.

**Enregistrement du SSE Manager dans Fastify :**

```typescript
// Dans app.ts :
import { SSEManager } from './sse/sse-manager.js';

const sseManager = new SSEManager();
app.decorate('sseManager', sseManager);

// Cleanup a la fermeture du serveur
app.addHook('onClose', () => {
  sseManager.close();
});

// Declare le type pour TypeScript :
declare module 'fastify' {
  interface FastifyInstance {
    sseManager: SSEManager;
  }
}
```

**Task 4 — Integration cascade-engine :**

Le cascade engine doit **emettre des evenements SSE** a chaque changement d'etat. Le pattern recommande est de passer le `sseManager` en parametre optionnel :

```typescript
// Signature modifiee :
export async function executeCascadeStart(
  db: BetterSQLite3Database<any>,
  cascadeId: string,
  resourceId: string,
  options?: {
    stepTimeoutMs?: number;
    sseManager?: SSEManager;  // NOUVEAU
  }
): Promise<void>
```

**Points d'emission SSE dans executeCascadeStart :**

1. **Debut d'etape** : avant de demarrer un noeud → `cascade-progress` avec `currentDependency.status = 'starting'`
2. **Etape OK** : apres polling reussi → `cascade-progress` avec `currentDependency.status = 'online'` + `status-change` pour la resource
3. **Cascade complete** : toutes les etapes finies → `cascade-complete`
4. **Etape echouee** : timeout ou erreur → `cascade-error`
5. **Skip noeud** : noeud deja actif ou machine proxmox/docker → pas d'evenement (etape invisible pour le frontend)

**Memes points pour executeCascadeStop** (avec `status-change` a chaque arret).

**Modifier cascades.routes.ts :**

Dans les handlers `POST /api/cascades/start` et `POST /api/cascades/stop`, passer `fastify.sseManager` dans les options du cascade engine :

```typescript
executeCascadeStart(fastify.db, cascadeId, body.resourceId, {
  sseManager: fastify.sseManager,
}).catch(/* ... */);
```

**Task 5 — Hook useSSE :**

```typescript
// apps/web/src/hooks/use-sse.ts

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '../api/auth-token';
import type { SSEEventType, StatusChangeEvent, CascadeProgressEvent, CascadeCompleteEvent, CascadeErrorEvent } from '@wakehub/shared';

export function useSSE() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    const url = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : '/api/events'; // cookies seuls

    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener('status-change', (e) => {
      const data: StatusChangeEvent = JSON.parse(e.data);
      // Invalider les queries de machines et resources
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource', data.resourceId] });
    });

    es.addEventListener('cascade-progress', (e) => {
      const data: CascadeProgressEvent = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: ['cascades', data.cascadeId] });
    });

    es.addEventListener('cascade-complete', (e) => {
      const data: CascadeCompleteEvent = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: ['cascades', data.cascadeId] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    });

    es.addEventListener('cascade-error', (e) => {
      const data: CascadeErrorEvent = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: ['cascades', data.cascadeId] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    });

    es.onerror = () => {
      // EventSource se reconnecte automatiquement
      // On peut logger pour debug si necessaire
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: le hook ne se relance pas — la reconnexion est geree par EventSource
}
```

**Integration dans App.tsx :**

Le hook `useSSE()` doit etre appele **une seule fois**, au plus haut niveau de l'app, **quand l'utilisateur est authentifie**. Le meilleur endroit est dans le composant `AuthGuard` ou dans un composant wrapper au niveau de la route protegee.

```typescript
// Dans un composant wrapper (ex: dans router.tsx au niveau des routes protegees)
function AuthenticatedApp() {
  useSSE();
  return <Outlet />;
}
```

### Conformite architecture obligatoire

**SSE endpoint (ARCH-07) :**
- Endpoint unique `GET /api/events`
- Types d'evenements : `status-change`, `cascade-progress`, `cascade-complete`, `cascade-error`
- Heartbeat pour maintenir la connexion

**State management (ARCH-08) :**
- SSE invalide le cache TanStack Query — pas de polling frontend
- `queryClient.invalidateQueries()` ciblee par query key

**Auth (ARCH-06 + fallback Bearer) :**
- Cookie session_token pour la plupart des navigateurs
- Query param `?token=` pour code-server et environnements ou les cookies ne marchent pas
- L'EventSource API ne supporte pas les headers custom

**Format evenements SSE (architecture.md) :**
```
event: status-change
data: {"resourceId":"abc123","resourceType":"resource","status":"online","timestamp":"2026-02-11T14:30:00Z"}

event: cascade-progress
data: {"cascadeId":"xyz789","resourceId":"abc123","step":2,"totalSteps":4,"currentDependency":{"id":"def456","name":"VM-Media","status":"starting"}}

event: cascade-complete
data: {"cascadeId":"xyz789","resourceId":"abc123","success":true}

event: cascade-error
data: {"cascadeId":"xyz789","resourceId":"abc123","failedStep":2,"error":{"code":"VM_START_FAILED","message":"..."}}
```

**Nommage (ARCH-17) :**
- Fichiers : `sse-manager.ts`, `events.routes.ts`, `use-sse.ts` (kebab-case)
- Classe : `SSEManager` (PascalCase)
- Dossier : `sse/` (kebab-case)

**Organisation (ARCH-18) :**
- SSE backend : `apps/server/src/sse/sse-manager.ts`
- Route SSE : `apps/server/src/routes/events.routes.ts`
- Hook frontend : `apps/web/src/hooks/use-sse.ts`
- Tests co-localises

### Librairies et frameworks requis

**Aucune nouvelle dependance.** Tout est deja installe :

| Package | Usage dans cette story |
|---------|----------------------|
| `fastify` (v5) | Route SSE, streaming reply via `reply.raw` |
| `@tanstack/react-query` (v5) | `queryClient.invalidateQueries()` |
| `vitest` | Tests unitaires |

L'API `EventSource` est native dans tous les navigateurs modernes — aucun polyfill necessaire.

### Structure de fichiers

**Fichiers a CREER :**

| Fichier | Description |
|---------|-------------|
| `apps/server/src/sse/sse-manager.ts` | Gestion des connexions SSE + broadcast |
| `apps/server/src/sse/sse-manager.test.ts` | Tests SSE Manager |
| `apps/server/src/routes/events.routes.ts` | Route `GET /api/events` |
| `apps/server/src/routes/events.routes.test.ts` | Tests route SSE |
| `apps/web/src/hooks/use-sse.ts` | Hook React pour connexion SSE |

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `packages/shared/src/index.ts` | Ajouter types SSE (SSEEventType, StatusChangeEvent, etc.) |
| `apps/server/src/app.ts` | Instancier SSEManager, decorer Fastify, enregistrer events route, exclure `/api/events` du middleware auth |
| `apps/server/src/services/cascade-engine.ts` | Ajouter param `sseManager?` optionnel, emettre evenements SSE |
| `apps/server/src/routes/cascades.routes.ts` | Passer `fastify.sseManager` au cascade-engine |
| `apps/web/src/router.tsx` | Ajouter `useSSE()` au niveau des routes protegees |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/services/dependency-graph.ts` — service existant, pas de modification
- `apps/server/src/services/connector-factory.ts` — pas de modification
- `apps/server/src/connectors/*.ts` — connecteurs existants, ne pas modifier
- `apps/server/src/middleware/auth.middleware.ts` — reutiliser `extractSessionToken()` mais ne pas modifier le middleware
- Les stories precedentes (Epics 1-3) — ne rien casser

### Exigences de tests

**Framework :** Vitest (backend + frontend)
**Commande backend :** `npm run test -w @wakehub/server`
**Commande frontend :** `npm run test -w @wakehub/web`

**Tests a creer :**

**`sse-manager.test.ts` :**
- `addClient` : ajoute un client, `getClientCount()` retourne 1
- `removeClient` : supprime un client, `getClientCount()` retourne 0
- `broadcast` : envoie un evenement a tous les clients connectes (verifier `reply.raw.write` appele)
- `send` : envoie un evenement a un client specifique
- `broadcast` avec 0 clients : ne plante pas
- Heartbeat : verifier que le heartbeat est emis (timer mock)
- `close` : nettoie tous les clients et intervals
- Format SSE correct : `id: X\nevent: Y\ndata: Z\n\n`

**`events.routes.test.ts` :**
- `GET /api/events` sans auth → 401
- `GET /api/events` avec cookie valide → 200 + Content-Type text/event-stream
- `GET /api/events?token=valid_token` → 200 + Content-Type text/event-stream
- `GET /api/events?token=invalid_token` → 401

**Note sur les tests SSE :** Tester les routes SSE avec `app.inject()` est delicat car la reponse est un stream. Utiliser `app.inject()` en mode payload pour verifier les headers et le status code initial. Pour les tests du SSE Manager, mocker `reply.raw.write()`.

**Tests existants a verifier :**
- `cascade-engine.test.ts` : les tests existants doivent passer sans modification (le `sseManager` est optionnel)
- `cascades.routes.test.ts` : les tests existants doivent passer

**Rappel mock pattern :** Utiliser `vi.fn()` pour mocker les fonctions `reply.raw.write`. Creer un mock de `FastifyReply` avec un `raw` qui a `write`, `end`, `on`.

### Intelligence de la story precedente (4-1)

**Patterns etablis a reutiliser :**
1. **Service functions (pas classes)** sauf pour SSEManager qui beneficie d'etre une classe (etat interne = Map de clients)
2. **`BetterSQLite3Database<any>`** pour le type `db`
3. **Fastify decorate pattern** : `app.decorate('db', db)` → meme pattern pour `app.decorate('sseManager', sseManager)`
4. **Fastify plugin async** : `const routes: FastifyPluginAsync = async (fastify) => {}`
5. **Fire-and-forget** : cascade lancee en background, retour immediat au client HTTP. Le SSE suit le meme pattern — les evenements sont emis depuis le cascade-engine pendant l'execution.
6. **Auth middleware** : reutilise `extractSessionToken()` mais verification manuelle dans le handler SSE (car exclus du middleware global)

**Signatures existantes cascade-engine :**

```typescript
export async function executeCascadeStart(
  db: BetterSQLite3Database<any>,
  cascadeId: string,
  resourceId: string,
  options?: { stepTimeoutMs?: number }
): Promise<void>

export async function executeCascadeStop(
  db: BetterSQLite3Database<any>,
  cascadeId: string,
  resourceId: string,
  options?: { stepTimeoutMs?: number }
): Promise<void>
```

→ Ajouter `sseManager?: SSEManager` dans le type `options` (backward compatible, optionnel).

**Fonctions existantes dans auth.middleware.ts :**

```typescript
export function extractSessionToken(request: FastifyRequest): string | null
// Verifie cookie 'session_token' puis header 'Authorization: Bearer xxx'
// Retourne le token ou null
```

→ Pour la route SSE, reutiliser cette fonction puis ajouter un fallback sur `request.query.token`.

**Code-server constraint :**
L'app tourne derriere code-server qui strip les headers `Set-Cookie`. C'est pourquoi le Bearer token via query param est **indispensable** pour que le SSE fonctionne dans cet environnement.

### Anti-patterns a eviter

- NE PAS creer de composants UI (ServiceTile, CascadeProgress, StatsBar) — c'est les stories 4.3-4.5
- NE PAS creer de Zustand store pour le SSE — TanStack Query cache invalidation suffit
- NE PAS utiliser de library SSE externe (`eventsource`, `@fastify/sse`) — implementer avec `reply.raw` natif
- NE PAS poll depuis le frontend — tout passe par SSE
- NE PAS replay les evenements manques (pas de buffer) — approche simple MVP, le cache TanStack Query se resynchronise au refetch
- NE PAS modifier le middleware auth global — gerer l'auth SSE dans le handler de la route
- NE PAS casser les tests existants du cascade-engine (le param sseManager est optionnel)
- NE PAS utiliser `reply.send()` dans le handler SSE — utiliser `reply.raw.writeHead()` et `reply.raw.write()`, retourner `reply` pour eviter la serialisation Fastify

### Project Structure Notes

- `apps/server/src/sse/` : nouveau dossier pour le SSE Manager (conforme ARCH-18)
- `apps/server/src/routes/events.routes.ts` : conforme au pattern existant des routes
- `apps/web/src/hooks/use-sse.ts` : conforme a l'architecture frontend (ARCH-19)
- Le hook SSE est global (un seul EventSource pour toute l'app) — pas un hook par composant

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.2]
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07 SSE, ARCH-08 TanStack+SSE]
- **PRD** : [Source: _bmad-output/planning-artifacts/prd.md#FR27, FR35-37]
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-07 CascadeProgress, UX-08 ServiceDetailPanel]
- **Story 4-1** : [Source: _bmad-output/implementation-artifacts/4-1-moteur-de-cascade-et-orchestration.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A

### Completion Notes List

- Types SSE (SSEEventType, StatusChangeEvent, CascadeProgressEvent, CascadeCompleteEvent, CascadeErrorEvent, SSEEventData) ajoutes dans shared/index.ts
- SSEManager : classe singleton avec Map de clients, broadcast, send, heartbeat 30s, close avec reply.raw.end()
- Route GET /api/events : auth via cookie OU query param ?token=, reply.hijack() pour SSE, headers text/event-stream
- Route exclue du middleware auth global dans app.ts (gere l'auth manuellement)
- cascade-engine.ts : accepte sseManager optionnel, emet cascade-progress/complete/error/status-change
- cascades.routes.ts : passe fastify.sseManager au cascade-engine
- useSSE() hook : EventSource avec withCredentials:true, fonctionne avec token OU cookies, cache invalidation TanStack Query
- useSSE() integre dans auth-guard.tsx via AuthenticatedShell (appele une fois quand authentifie)

### Code Review Fixes (2026-02-11)

- **F2** : useSSE() corrige — supprime le early return quand pas de token, ajoute withCredentials:true
- **F6** : SSEManager.close() appelle maintenant reply.raw.end() sur tous les clients
- **F4** : 4 tests SSE ajoutes dans cascade-engine.test.ts (emission cascade-progress, cascade-complete, cascade-error, status-change)
- **F5** : 7 tests ajoutes pour useSSE() hook (use-sse.test.ts)
- **router.test.tsx** : ajout mock useSSE pour eviter erreur EventSource en jsdom

### File List

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/shared/src/index.ts` | Modified | Ajoute types SSE (SSEEventType, StatusChangeEvent, etc.) |
| `apps/server/src/sse/sse-manager.ts` | Created | SSEManager class — gestion connexions, broadcast, heartbeat |
| `apps/server/src/sse/sse-manager.test.ts` | Created | 14 tests unitaires SSEManager |
| `apps/server/src/routes/events.routes.ts` | Created | Route GET /api/events (SSE stream) |
| `apps/server/src/routes/events.routes.test.ts` | Created | 5 tests route SSE (auth, headers) |
| `apps/server/src/app.ts` | Modified | SSEManager instance, decorate, onClose hook, exclude /api/events from auth |
| `apps/server/src/services/cascade-engine.ts` | Modified | sseManager optionnel, emission evenements SSE |
| `apps/server/src/services/cascade-engine.test.ts` | Modified | +4 tests emission SSE |
| `apps/server/src/routes/cascades.routes.ts` | Modified | Passe fastify.sseManager au cascade-engine |
| `apps/web/src/hooks/use-sse.ts` | Created | Hook React useSSE() avec EventSource + cache invalidation |
| `apps/web/src/hooks/use-sse.test.ts` | Created | 7 tests hook useSSE |
| `apps/web/src/features/auth/auth-guard.tsx` | Modified | AuthenticatedShell wrapper avec useSSE() |
| `apps/web/src/router.test.tsx` | Modified | Mock useSSE pour compatibilite jsdom |
