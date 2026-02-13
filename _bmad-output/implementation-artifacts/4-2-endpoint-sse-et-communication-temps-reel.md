# Story 4.2: Endpoint SSE & communication temps réel

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur homelab,
I want voir les mises à jour de statut en temps réel sans recharger la page,
so that je sais toujours l'état actuel de mes services et la progression de mes cascades.

## Acceptance Criteria

### AC1 : Service `sse-manager.ts`
- Un service `SSEManager` gère les connexions SSE des clients (ajout d'un client, suppression à la déconnexion)
- Le manager expose `broadcast(event, data)` pour envoyer un événement à tous les clients connectés
- Le manager supporte la reconnexion automatique via `Last-Event-ID` : il maintient un buffer circulaire des N derniers événements et les rejoue au client qui se reconnecte
- Le manager est un singleton partagé via l'instance Fastify (`fastify.decorate('sseManager', ...)`)

### AC2 : Route `GET /api/events`
- Une route `GET /api/events` établit une connexion SSE (Content-Type: `text/event-stream`)
- La connexion est protégée par le middleware d'authentification (cookie session)
- Un heartbeat (commentaire SSE `:`) est envoyé toutes les 30 secondes pour maintenir la connexion
- Le header `X-Accel-Buffering: no` est défini pour éviter le buffering des reverse proxies
- La route utilise `reply.hijack()` puis `reply.raw` pour prendre le contrôle de la réponse HTTP (pattern Fastify 5.x SSE)
- Le champ `retry: 5000` est envoyé au client pour configurer le délai de reconnexion

### AC3 : Intégration avec le cascade engine — événements cascade
- Le moteur de cascade (Story 4.1) est branché sur le SSE manager via le callback `onProgress`
- Quand une cascade progresse, un événement SSE `cascade-progress` est émis avec : `cascadeId`, `nodeId`, `stepIndex`, `totalSteps`, `currentNodeId`, `currentNodeName`
- Quand une cascade se termine avec succès → événement `cascade-complete` avec `cascadeId`, `nodeId`, `success: true`
- Quand une cascade échoue → événement `cascade-error` avec `cascadeId`, `nodeId`, `failedStep`, `error: { code, message }`

### AC4 : Événement `status-change` pour les changements de statut de noeud
- Chaque changement de statut d'un noeud via le cascade engine émet un événement SSE `status-change` avec : `nodeId`, `status`, `timestamp`
- Les événements `node-status-change` du `CascadeProgressEvent` sont transformés en événements SSE `status-change`

### AC5 : Types partagés dans @wakehub/shared
- Les types `SSEEvent`, `SSECascadeProgressEvent`, `SSECascadeCompleteEvent`, `SSECascadeErrorEvent`, `SSEStatusChangeEvent` sont définis dans le package shared
- Les types sont réexportés depuis `packages/shared/src/index.ts`

### AC6 : Hook React `useSSE()`
- Un hook `useSSE()` établit une connexion `EventSource` vers `GET /api/events` au montage du composant
- Les événements SSE `status-change` déclenchent `queryClient.invalidateQueries({ queryKey: ['nodes'] })` pour rafraîchir les données des noeuds
- Les événements `cascade-progress`, `cascade-complete`, `cascade-error` déclenchent `queryClient.invalidateQueries({ queryKey: ['cascades'] })`
- La reconnexion est automatique (native EventSource + `retry` field du serveur)
- Le hook se déconnecte proprement au démontage du composant
- Le hook est monté une seule fois au niveau de l'`AppShell` (pas par page)

### AC7 : Tests backend SSE
- Tests unitaires pour `SSEManager` : ajout/suppression de clients, broadcast, reconnexion Last-Event-ID, heartbeat
- Tests de route pour `GET /api/events` : connexion, authentification requise, format SSE
- Tests d'intégration : le callback onProgress du cascade engine émet des événements SSE via le manager

### AC8 : Tests frontend hook useSSE
- Tests unitaires pour `useSSE` : connexion, réception d'événements, invalidation des queries, déconnexion au démontage
- Mock d'EventSource pour les tests

## Tasks / Subtasks

- [x] Task 1 : Types partagés SSE (AC: #5)
  - [x] 1.1 Créer `packages/shared/src/models/sse-event.ts` avec les types `SSEEventType`, `SSEStatusChangeEvent`, `SSECascadeProgressEvent`, `SSECascadeCompleteEvent`, `SSECascadeErrorEvent`, `SSEEvent` (union)
  - [x] 1.2 Réexporter depuis `packages/shared/src/index.ts`

- [x] Task 2 : Service SSE Manager backend (AC: #1)
  - [x] 2.1 Créer `apps/server/src/sse/sse-manager.ts` — classe `SSEManager` avec : `addClient(id, response)`, `removeClient(id)`, `broadcast(event, data)`, buffer circulaire des derniers événements, `replayEvents(lastEventId, response)`
  - [x] 2.2 Écrire les tests unitaires `apps/server/src/sse/sse-manager.test.ts` : ajout/suppression clients, broadcast format SSE, buffer circulaire, replay Last-Event-ID, nettoyage à la déconnexion

- [x] Task 3 : Route SSE `GET /api/events` (AC: #2)
  - [x] 3.1 Créer `apps/server/src/routes/events.routes.ts` avec la route `GET /api/events` — `reply.hijack()`, headers SSE, heartbeat 30s, `retry: 5000`, gestion `Last-Event-ID`, cleanup à la déconnexion
  - [x] 3.2 Décorer l'instance Fastify avec `sseManager` dans `app.ts` — `app.decorate('sseManager', sseManager)`
  - [x] 3.3 Enregistrer le plugin dans `apps/server/src/app.ts` avec prefix `/api`
  - [x] 3.4 Mettre à jour la déclaration de type Fastify pour inclure `sseManager` sur `FastifyInstance`
  - [x] 3.5 Écrire les tests `apps/server/src/routes/events.routes.test.ts` : connexion SSE, format headers, authentification requise

- [x] Task 4 : Intégration cascade engine → SSE (AC: #3, #4)
  - [x] 4.1 Modifier `apps/server/src/routes/cascades.routes.ts` — brancher le callback `onProgress` sur le SSE manager pour chaque cascade lancée
  - [x] 4.2 Transformer les `CascadeProgressEvent` en événements SSE : `cascade-started` → `cascade-progress`, `step-progress` → `cascade-progress`, `node-status-change` → `status-change`, `cascade-complete` → `cascade-complete` ou `cascade-error`
  - [x] 4.3 Écrire un test d'intégration vérifiant que le lancement d'une cascade émet les événements SSE attendus

- [x] Task 5 : Hook React `useSSE()` (AC: #6)
  - [x] 5.1 Créer `apps/web/src/hooks/use-sse.ts` — hook qui ouvre `EventSource('/api/events')`, écoute les types d'événements, invalide les queries TanStack concernées, cleanup au démontage
  - [x] 5.2 Monter `useSSE()` dans `apps/web/src/components/layout/app-shell.tsx` pour une connexion unique à l'échelle de l'app
  - [x] 5.3 Écrire les tests `apps/web/src/hooks/use-sse.test.ts` : connexion, réception événements, invalidation queries, démontage

- [x] Task 6 : Validation et intégration (AC: #1-8)
  - [x] 6.1 Lancer `npm test -w apps/server` — tous les tests passent (274 tests)
  - [x] 6.2 Lancer `npm test -w apps/web` — tous les tests passent (112 tests)
  - [x] 6.3 Lancer `tsc --noEmit` — compilation TypeScript OK (server + web + shared)
  - [x] 6.4 Lancer `docker compose up --build -d` — build réussi, serveur démarre sans erreur
  - [x] 6.5 Vérifier les compteurs de tests : 274 tests serveur (+27), 112 tests web (+6)

## Dev Notes

### Stack technique et versions

| Technologie | Version | Usage dans cette story |
|---|---|---|
| TypeScript | strict mode | Partout |
| Fastify | ~5.x | Route SSE backend (GET /api/events) |
| EventSource API | natif navigateur | Client SSE (pas de lib externe) |
| TanStack Query | v5 | Invalidation cache depuis événements SSE |
| React | 19 | Hook useSSE |
| Vitest | latest | Framework de test |

**Aucune nouvelle dépendance à installer.** Cette story utilise l'API native `EventSource` côté client et le pattern `reply.hijack()` + `reply.raw` de Fastify côté serveur. Pas de plugin SSE externe nécessaire.

### Contraintes architecturales critiques

1. **SSE via `reply.hijack()` + `reply.raw`** : En Fastify 5.x, l'implémentation SSE DOIT utiliser `reply.hijack()` avant tout accès à `reply.raw`. Sans cela, Fastify tente d'envoyer sa propre réponse après le handler, causant "Cannot set headers after they are sent". Ce pattern bypasse le cycle de réponse Fastify (serialization, onSend hooks).

2. **CORS headers manuels** : Comme `reply.hijack()` bypasse `@fastify/cors`, les headers CORS doivent être définis manuellement dans `reply.raw.writeHead()`. En développement, le frontend est sur un port différent → CORS nécessaire.
   ```typescript
   reply.hijack();
   reply.raw.writeHead(200, {
     'Content-Type': 'text/event-stream',
     'Cache-Control': 'no-cache',
     'Connection': 'keep-alive',
     'X-Accel-Buffering': 'no',
     'Access-Control-Allow-Origin': request.headers.origin || '*',
     'Access-Control-Allow-Credentials': 'true',
   });
   ```

3. **Auth middleware fonctionne AVANT hijack** : Le middleware d'authentification (preHandler hook) s'exécute AVANT le handler, donc AVANT `reply.hijack()`. L'authentification par cookie fonctionne normalement pour SSE car le navigateur envoie automatiquement les cookies avec les requêtes `EventSource`.

4. **Singleton SSE Manager décoré sur Fastify** : Le SSE manager est instancié une seule fois et décoré sur l'instance Fastify via `app.decorate('sseManager', sseManager)`. Les routes cascades y accèdent via `fastify.sseManager`. Cela évite les imports circulaires et suit le pattern d'injection de dépendances Fastify.
   ```typescript
   // app.ts
   import { SSEManager } from './sse/sse-manager.js';
   const sseManager = new SSEManager();
   app.decorate('sseManager', sseManager);

   // Dans cascades.routes.ts
   const onProgress = (event) => {
     fastify.sseManager.broadcastCascadeEvent(event);
   };
   ```

5. **Buffer circulaire pour Last-Event-ID** : Le SSE manager maintient un buffer des ~100 derniers événements avec IDs incrémentiels. Quand un client se reconnecte avec `Last-Event-ID`, les événements manqués sont rejoués. Taille limitée car WakeHub est mono-utilisateur (homelab).

6. **Heartbeat 30s** : Un commentaire SSE (`: heartbeat\n\n`) est envoyé toutes les 30 secondes pour chaque client. Cela empêche les reverse proxies (Nginx, Traefik) de couper les connexions idle. Le `setInterval` est nettoyé quand le client se déconnecte.

7. **EventSource natif, pas de lib externe** : Le hook `useSSE` utilise l'API native `EventSource` du navigateur. La reconnexion est automatique (built-in dans EventSource). Le champ `retry: 5000` envoyé par le serveur configure le délai de reconnexion à 5 secondes.

8. **Invalidation TanStack Query, pas de setQueryData** : Les événements SSE déclenchent `queryClient.invalidateQueries()` (refetch en arrière-plan) plutôt que `setQueryData()` (mise à jour directe). C'est plus simple et évite les problèmes de synchronisation entre le cache SSE et les données API. Le refetch est quasi-instantané sur un réseau local.

9. **Un seul EventSource pour toute l'app** : Le hook `useSSE()` est monté dans l'`AppShell` (wrapper de toutes les pages authentifiées). Il ne doit PAS être monté dans chaque page/composant. Cela respecte la limite de 6 connexions HTTP/1.1 par domaine.

10. **Format SSE strict** : Chaque événement SSE suit le format :
    ```
    id: 42
    event: status-change
    data: {"nodeId":"abc","status":"online","timestamp":"2026-02-13T12:00:00Z"}

    ```
    (double newline à la fin, `id:` pour Last-Event-ID, `event:` pour le type)

### Conventions de nommage

| Couche | Convention | Exemples Story 4.2 |
|---|---|---|
| Fichiers backend | `kebab-case` | `sse-manager.ts`, `events.routes.ts` |
| Fichiers frontend | `kebab-case` | `use-sse.ts` |
| Types | `PascalCase` | `SSEManager`, `SSEEvent`, `SSEStatusChangeEvent` |
| Événements SSE | `kebab-case` | `status-change`, `cascade-progress`, `cascade-complete`, `cascade-error` |
| Constantes | `SCREAMING_SNAKE` | `SSE_HEARTBEAT_INTERVAL_MS`, `SSE_RETRY_MS`, `SSE_EVENT_BUFFER_SIZE` |

### Mapping des événements cascade → SSE

| CascadeProgressEvent.type | Événement SSE | Données SSE |
|---|---|---|
| `cascade-started` | `cascade-progress` | `{ cascadeId, nodeId, step: 0, totalSteps, status: 'started' }` |
| `step-progress` | `cascade-progress` | `{ cascadeId, nodeId, step: stepIndex, totalSteps, currentNodeId, currentNodeName }` |
| `node-status-change` | `status-change` | `{ nodeId, status, timestamp }` |
| `cascade-complete` (success) | `cascade-complete` | `{ cascadeId, nodeId, success: true }` |
| `cascade-complete` (failure) | `cascade-error` | `{ cascadeId, nodeId, failedStep, error: { code, message } }` |

### Architecture Compliance

#### SSE Manager — Classe

```typescript
// apps/server/src/sse/sse-manager.ts
import type { ServerResponse } from 'node:http';

interface SSEClient {
  id: string;
  response: ServerResponse;
  heartbeatTimer: NodeJS.Timeout;
}

interface BufferedEvent {
  id: number;
  event: string;
  data: string;
}

export class SSEManager {
  private clients = new Map<string, SSEClient>();
  private eventBuffer: BufferedEvent[] = [];
  private nextEventId = 1;
  private readonly bufferSize: number;
  private readonly heartbeatIntervalMs: number;

  constructor(bufferSize = 100, heartbeatIntervalMs = 30_000) { ... }

  addClient(id: string, response: ServerResponse): void { ... }
  removeClient(id: string): void { ... }
  broadcast(event: string, data: unknown): void { ... }
  replayEvents(lastEventId: number, response: ServerResponse): void { ... }
  getClientCount(): number { ... }
}
```

#### Route SSE — Pattern Fastify

```typescript
// apps/server/src/routes/events.routes.ts
import type { FastifyPluginAsync } from 'fastify';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/events — SSE endpoint
  fastify.get('/events', async (request, reply) => {
    const clientId = crypto.randomUUID();

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      // CORS headers (car hijack bypasse @fastify/cors)
      'Access-Control-Allow-Origin': request.headers.origin || 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Retry delay for client reconnection
    raw.write('retry: 5000\n\n');

    // Replay missed events if reconnecting
    const lastEventId = request.headers['last-event-id'];
    if (lastEventId) {
      fastify.sseManager.replayEvents(parseInt(lastEventId, 10), raw);
    }

    // Register client
    fastify.sseManager.addClient(clientId, raw);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      fastify.sseManager.removeClient(clientId);
      fastify.log.info({ clientId }, 'SSE client disconnected');
    });
  });
};
export default eventsRoutes;
```

#### Branchement cascade → SSE (modification cascades.routes.ts)

```typescript
// Dans POST /start et POST /stop (cascades.routes.ts)
const onProgress = (event: CascadeProgressEvent) => {
  switch (event.type) {
    case 'cascade-started':
      fastify.sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: 0,
        totalSteps: event.totalSteps,
        status: 'started',
      });
      break;
    case 'step-progress':
      fastify.sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: event.stepIndex,
        totalSteps: event.totalSteps,
        currentNodeId: event.currentNodeId,
        currentNodeName: event.currentNodeName,
      });
      break;
    case 'node-status-change':
      fastify.sseManager.broadcast('status-change', {
        nodeId: event.nodeId,
        status: event.status,
        timestamp: new Date().toISOString(),
      });
      break;
    case 'cascade-complete':
      if (event.success) {
        fastify.sseManager.broadcast('cascade-complete', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          success: true,
        });
      } else {
        fastify.sseManager.broadcast('cascade-error', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          failedStep: event.error ? undefined : undefined,
          error: event.error,
        });
      }
      break;
  }
};

executeCascadeStart(nodeId, fastify.db, {
  cascadeId: cascade!.id,
  onProgress,
  decryptFn: decrypt,
}).catch(err => {
  fastify.log.error({ err, cascadeId: cascade!.id }, 'Cascade failed');
});
```

#### Hook React useSSE

```typescript
// apps/web/src/hooks/use-sse.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const SSE_URL = '/api/events';

const EVENT_QUERY_MAP: Record<string, string[]> = {
  'status-change': ['nodes'],
  'cascade-progress': ['cascades'],
  'cascade-complete': ['cascades', 'nodes'],
  'cascade-error': ['cascades', 'nodes'],
};

export function useSSE() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;

    for (const [eventType, queryKeys] of Object.entries(EVENT_QUERY_MAP)) {
      es.addEventListener(eventType, () => {
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      });
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [queryClient]);
}
```

#### Montage dans AppShell

```typescript
// apps/web/src/components/layout/app-shell.tsx
import { useSSE } from '../../hooks/use-sse';

export function AppShell() {
  useSSE(); // Connexion SSE unique pour toute l'app

  return ( /* ... layout existant ... */ );
}
```

### Patterns backend établis à reproduire

**Pattern Fastify type augmentation** (cf. `auth.ts`) :
```typescript
// À ajouter dans routes/auth.ts ou un fichier de types dédié
declare module 'fastify' {
  interface FastifyInstance {
    db: BetterSQLite3Database<typeof import('../db/schema.js')>;
    sseManager: import('../sse/sse-manager.js').SSEManager;
  }
}
```

**Pattern enregistrement plugin** (cf. `app.ts`) :
```typescript
import eventsRoutes from './routes/events.routes.js';
// ...
app.register(eventsRoutes, { prefix: '/api' });
```

**Pattern erreur structurée** :
```typescript
reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } });
```

### Librairies et frameworks — exigences spécifiques

#### Fastify 5.x — SSE via reply.hijack()

- **`reply.hijack()`** DOIT être appelé AVANT tout accès à `reply.raw`
- Cela bypasse : sérialisation des réponses, hooks `onSend`, `@fastify/cors` headers
- Les hooks `preHandler` (auth) s'exécutent AVANT le handler → l'auth fonctionne
- Les hooks `onResponse` s'exécutent toujours (utile pour cleanup)
- **NE PAS** définir de `Content-Length` — la réponse SSE est un flux sans fin
- **NE PAS** utiliser `reply.send()` après `reply.hijack()` — cela crash

#### EventSource API (navigateur natif)

- Reconnexion automatique intégrée (le navigateur re-ouvre la connexion en cas de coupure)
- Le champ `retry:` du serveur configure le délai de reconnexion en millisecondes
- Le header `Last-Event-ID` est automatiquement envoyé lors de la reconnexion
- Les cookies sont envoyés automatiquement pour les requêtes same-origin
- Pour le cross-origin (dev), utiliser `withCredentials: true`
- **Limite** : 6 connexions HTTP/1.1 simultanées par domaine → un seul EventSource par app

#### TanStack Query v5 — Invalidation depuis SSE

- `queryClient.invalidateQueries({ queryKey: ['nodes'] })` marque le cache comme stale et déclenche un refetch en arrière-plan
- Le composant se re-rend automatiquement quand les nouvelles données arrivent
- **CRITIQUE** : `refetchOnWindowFocus: false` est déjà configuré dans `main.tsx` — sans cela, chaque retour à l'onglet causerait des duplications

### Project Structure Notes

#### Fichiers à créer

```
packages/shared/src/
  models/sse-event.ts               ← NOUVEAU : types événements SSE
  index.ts                           ← MODIFIER : réexporter les types SSE

apps/server/src/
  sse/
    sse-manager.ts                   ← NOUVEAU : gestionnaire de connexions SSE
    sse-manager.test.ts              ← NOUVEAU : tests SSE manager (~10 tests)
  routes/
    events.routes.ts                 ← NOUVEAU : route GET /api/events
    events.routes.test.ts            ← NOUVEAU : tests route SSE (~5 tests)
    cascades.routes.ts               ← MODIFIER : brancher onProgress → sseManager
  routes/auth.ts                     ← MODIFIER : ajouter sseManager au declare module
  app.ts                             ← MODIFIER : instancier SSEManager + register events route

apps/web/src/
  hooks/
    use-sse.ts                       ← NOUVEAU : hook React SSE
    use-sse.test.ts                  ← NOUVEAU : tests hook (~5 tests)
  components/layout/
    app-shell.tsx                    ← MODIFIER : monter useSSE()
```

#### Alignement avec la structure existante

- Le répertoire `sse/` est nouveau — suit l'architecture planifiée dans `architecture.md`
- Les tests sont co-localisés (`.test.ts` à côté du fichier source)
- Le pattern de route Fastify est identique à `cascades.routes.ts` et `dependencies.routes.ts`
- Le hook suit la convention `use-*.ts` dans le répertoire `hooks/` (actuellement vide)

### Exigences de tests

#### Tests sse-manager.ts — scénarios à couvrir

**Gestion des clients :**
- Ajout d'un client → incrémente le compteur
- Suppression d'un client → décrémente le compteur
- Client déjà supprimé → pas d'erreur (idempotent)
- `getClientCount()` retourne le nombre correct

**Broadcast :**
- `broadcast()` avec un client → le client reçoit l'événement au format SSE
- `broadcast()` avec plusieurs clients → tous reçoivent l'événement
- `broadcast()` sans client → pas d'erreur
- Le format SSE est correct : `id: N\nevent: type\ndata: JSON\n\n`

**Buffer et reconnexion :**
- Les événements sont stockés dans le buffer
- `replayEvents(lastEventId)` renvoie les événements manqués
- Le buffer ne dépasse pas la taille maximale (circulaire)
- `replayEvents` avec un ID ancien (plus dans le buffer) → pas d'erreur, pas de replay

#### Tests events.routes.ts — scénarios à couvrir

- `GET /api/events` — retourne Content-Type `text/event-stream`
- `GET /api/events` — non authentifié → 401
- `GET /api/events` — format des headers SSE (Cache-Control, Connection)

#### Tests use-sse.ts — scénarios à couvrir

- Le hook ouvre une connexion EventSource au montage
- Le hook ferme la connexion au démontage
- Un événement `status-change` déclenche l'invalidation de `['nodes']`
- Un événement `cascade-complete` déclenche l'invalidation de `['cascades', 'nodes']`

#### Pattern de test — mock SSE (backend)

```typescript
// Mock de ServerResponse pour tester le SSE manager
import { PassThrough } from 'node:stream';

function createMockResponse(): ServerResponse & { getOutput: () => string } {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => { output += chunk.toString(); });

  return Object.assign(stream, {
    writeHead: vi.fn(),
    getOutput: () => output,
  }) as any;
}
```

#### Pattern de test — mock EventSource (frontend)

```typescript
// Mock EventSource pour les tests du hook useSSE
class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  listeners = new Map<string, Function[]>();

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: Function) {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  close() { /* cleanup */ }

  // Helper pour les tests
  emit(event: string, data: unknown) {
    for (const handler of this.listeners.get(event) || []) {
      handler({ data: JSON.stringify(data) });
    }
  }
}

vi.stubGlobal('EventSource', MockEventSource);
```

#### Compteurs de tests attendus

- Tests serveur actuels : ~247 → objectif : ~262+ (ajout ~15 tests SSE manager + routes)
- Tests web actuels : ~106 → objectif : ~112+ (ajout ~6 tests hook useSSE)
- Commandes : `npm test -w apps/server`, `npm test -w apps/web`

### Leçons des stories précédentes à appliquer

1. **Fastify response schemas requis pour TOUS les codes HTTP** : La route SSE utilise `reply.hijack()` et bypass la sérialisation Fastify, donc **PAS de schema response** à déclarer pour cette route. C'est l'exception au pattern habituel.

2. **`vi.hoisted()` obligatoire** : Toute fonction mock utilisée dans une factory `vi.mock()` doit être déclarée via `vi.hoisted()`. Obligatoire pour le mock d'EventSource frontend et les mocks de SSEManager backend.

3. **Imports inutilisés = échec build Docker** : `tsc -b` strict dans le Dockerfile rejette les imports non utilisés. Toujours vérifier avec `tsc --noEmit`.

4. **Pattern `reply.hijack()` et hooks** : Les preHandler hooks (auth) fonctionnent. Les onSend hooks ne fonctionnent PAS. Les onResponse hooks fonctionnent toujours.

5. **Credentials : `withCredentials: true`** sur `EventSource` côté frontend pour le mode dev (cross-origin). En production (même origin), les cookies sont envoyés automatiquement.

6. **`refetchOnWindowFocus: false`** est déjà configuré dans le `QueryClient` de `main.tsx`. Si ce n'était pas le cas, les SSE + window focus causeraient des duplications de requêtes.

7. **`onProgress` callback de Story 4.1** : Le callback est déjà défini (`CascadeProgressEvent` type), déjà appelé dans le cascade engine. Il suffit de le brancher dans les routes cascades au lieu de ne rien en faire.

### Intelligence Git

```
699f046 feat: implement stories 2-4 to 3-2 — nodes UI, dependencies & graph visualization
74bf6c5 feat: implement Proxmox & Docker connectors, error handling fix, and node detail page
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

- Story 4.1 ajoutée dans cette session (pas encore commitée) : cascade-engine, cascades.routes, types partagés cascade
- Le callback `onProgress` dans cascade-engine.ts est le point d'intégration clé pour cette story
- Le `CascadeProgressEvent` type est exporté depuis cascade-engine.ts
- Les routes cascades (`POST /start`, `POST /stop`) sont le lieu de branchement SSE

### Information technique récente

- **Fastify 5.x SSE** : `reply.hijack()` + `reply.raw` est le pattern recommandé. Pas de plugin officiel stable pour Fastify 5. `fastify-sse-v2` (v4.2.2) existe mais le pattern raw est plus léger et sans dépendance supplémentaire.
- **EventSource API** : Natif dans tous les navigateurs modernes. Reconnexion automatique intégrée. Limite de 6 connexions HTTP/1.1 par domaine — un seul EventSource par app.
- **TanStack Query v5** : `invalidateQueries` déclenche un refetch en arrière-plan. Le composant se re-rend automatiquement. Pattern recommandé pour SSE → cache invalidation.
- **Heartbeat** : Commentaire SSE (`: heartbeat\n\n`) toutes les 30s. Empêche Nginx (timeout par défaut 60s) et les navigateurs de couper la connexion.
- **`X-Accel-Buffering: no`** : Header qui dit à Nginx de ne pas bufferiser la réponse. Critique pour SSE derrière un reverse proxy.
- **HTTP/2** : Ne pas envoyer `Connection: keep-alive` si HTTP/2 (multiplexage natif). Pas critique pour WakeHub (deployment Docker local, typiquement HTTP/1.1).

### Contexte projet

- **WakeHub** est un outil de gestion d'infrastructure homelab (single-user, auto-hébergé)
- Cette story est le **canal temps réel** qui connecte le backend (cascade engine, status changes) au frontend (dashboard, tiles, progress)
- Le SSE manager sera consommé par :
  - Story 4.3 (Dashboard) pour les mises à jour live des ServiceTiles et StatsBar
  - Story 4.4 (CascadeProgress) pour l'animation de progression sur les cartes
  - Story 4.5 (ServiceDetailPanel) pour le statut des dépendances en temps réel
  - Story 5.1 (Inactivité) ajoutera l'événement `auto-shutdown`
- Single-user = 1-2 connexions SSE simultanées max (pas de problème de scalabilité)
- Réseau local = latence très faible → `invalidateQueries` (refetch) est quasi-instantané

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.2] — Critères d'acceptation, user story
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-07] — SSE endpoint specification, event types
- [Source: _bmad-output/planning-artifacts/architecture.md#ARCH-08] — Frontend state management (TanStack Query + Zustand)
- [Source: _bmad-output/planning-artifacts/prd.md#FR27,FR35,FR37] — Real-time updates, cascade progress
- [Source: _bmad-output/planning-artifacts/prd.md#NFR — Performance] — Mises à jour temps réel < 3s
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#CascadeProgress] — Double feedback (barre + animation)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StatsBar] — Mise à jour temps réel des stats
- [Source: _bmad-output/implementation-artifacts/4-1-moteur-de-cascade-et-orchestration-deux-couches.md] — CascadeProgressEvent, onProgress callback, patterns établis
- [Source: Fastify Reply docs — reply.hijack()] — Pattern SSE Fastify 5.x
- [Source: MDN EventSource API] — Reconnexion automatique, withCredentials, Last-Event-ID

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Implementation Plan

1. Types partagés SSE dans @wakehub/shared — SSEEventType, SSEStatusChangeEvent, SSECascadeProgressEvent, SSECascadeCompleteEvent, SSECascadeErrorEvent, SSEEvent
2. SSEManager backend — classe avec gestion clients, broadcast, buffer circulaire 100 événements, replay Last-Event-ID, heartbeat 30s
3. Route GET /api/events — reply.hijack() + reply.raw, CORS headers manuels, retry: 5000, reconnexion
4. Intégration cascade → SSE — broadcastCascadeEvent() transforme CascadeProgressEvent en événements SSE, branché via onProgress dans cascades.routes.ts
5. Hook React useSSE() — EventSource natif avec withCredentials, invalidation TanStack Query, monté dans AppShell
6. Mock EventSource global dans test-setup.ts pour éviter les regressions dans les tests existants

### Completion Notes List

- Story créée par le moteur de contexte BMad Method
- Implémentation complète du canal SSE temps réel : backend (SSEManager + route) → frontend (useSSE hook)
- Pattern `reply.hijack()` + `reply.raw` implémenté avec CORS headers manuels (bypass @fastify/cors)
- Mapping CascadeProgressEvent → SSE events via `broadcastCascadeEvent()` helper dans cascades.routes.ts
- Intégration TanStack Query via invalidateQueries (pas setQueryData) — simple et fiable sur réseau local
- Tests route SSE utilisent un vrai serveur HTTP (pas inject()) car reply.hijack() est incompatible avec inject()
- EventSource mock global ajouté dans test-setup.ts pour éviter les regressions AppShell/router
- Fix TS2345 : `request.headers['last-event-id']` peut être `string | string[]` — géré avec Array.isArray
- Aucune nouvelle dépendance ajoutée — API natives navigateur + Fastify
- 274 tests serveur (+27), 112 tests web (+6), tsc OK, Docker OK

### File List

**Nouveaux fichiers :**
- `packages/shared/src/models/sse-event.ts` — Types SSE events
- `apps/server/src/sse/sse-manager.ts` — SSEManager class
- `apps/server/src/sse/sse-manager.test.ts` — 16 tests SSE Manager
- `apps/server/src/routes/events.routes.ts` — Route GET /api/events SSE
- `apps/server/src/routes/events.routes.test.ts` — 5 tests route SSE
- `apps/web/src/hooks/use-sse.ts` — Hook React useSSE
- `apps/web/src/hooks/use-sse.test.ts` — 6 tests hook useSSE

**Fichiers modifiés :**
- `packages/shared/src/index.ts` — Ajout réexports types SSE
- `apps/server/src/app.ts` — Import SSEManager + eventsRoutes, decorate + register
- `apps/server/src/routes/auth.ts` — Ajout sseManager dans declare module Fastify
- `apps/server/src/routes/cascades.routes.ts` — broadcastCascadeEvent helper, onProgress dans fire-and-forget
- `apps/server/src/routes/cascades.routes.test.ts` — SSEManager décoration + 6 tests intégration SSE
- `apps/web/src/components/layout/app-shell.tsx` — Import et montage useSSE()
- `apps/web/src/test-setup.ts` — Ajout mock EventSource global

### Change Log

- 2026-02-13: Story 4.2 implémentée — Endpoint SSE et communication temps réel complet (backend + frontend)
