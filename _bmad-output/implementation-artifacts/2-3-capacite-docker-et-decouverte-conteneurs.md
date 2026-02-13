# Story 2.3: Capacite Docker & decouverte conteneurs

Status: review

## Story

As a administrateur,
I want connecter Docker sur une machine, VM ou LXC et decouvrir les conteneurs,
So that WakeHub peut controler mes conteneurs Docker.

## Acceptance Criteria

1. **Bouton "Configurer Docker" sur page detail noeud**
   - Given un noeud de type physical, vm ou lxc existe en base
   - When je suis sur sa page de detail, section "Capacites"
   - Then je vois un bouton "Configurer Docker" si la capacite `docker_api` n'est pas encore configuree

2. **Formulaire configuration Docker**
   - Given je clique sur "Configurer Docker"
   - When le formulaire s'affiche (Modal Mantine)
   - Then il demande : hote Docker (IP ou hostname) et port (defaut 2375)
   - And les champs sont valides (hote non vide, port valide)

3. **Test connexion Docker & sauvegarde**
   - Given je remplis le formulaire et confirme
   - When le test de connexion Docker reussit (appel `GET /_ping` ou `GET /info` de l'API Docker)
   - Then la capacite `docker_api` est ajoutee au champ `capabilities` du noeud
   - And la decouverte automatique des conteneurs est lancee immediatement apres
   - And un toast de succes s'affiche

4. **Decouverte automatique conteneurs Docker**
   - Given la decouverte Docker est lancee
   - When l'API Docker repond (endpoint `GET /containers/json?all=true`)
   - Then tous les conteneurs sont listes avec nom, image, statut et ports
   - And chaque conteneur decouvert est enregistre en base (type=container, parent_id=noeud hote, discovered=true, configured=false)
   - And le champ `platformRef` contient `{ platform: 'docker', platformId: '{containerId}' }`
   - And la page detail du noeud affiche "X services a configurer"

5. **Configuration d'un conteneur decouvert**
   - Given je clique sur un conteneur "decouvert non configure" dans la liste
   - When le formulaire de configuration s'affiche
   - Then il est pre-rempli avec les donnees Docker (nom, image, ports, statut)
   - And je peux completer les infos manquantes (URL service, nom personnalise)
   - And je confirme → le noeud passe a `configured=true`

6. **Connecteur Docker — PlatformConnector**
   - Given le connecteur Docker est implemente
   - When il est utilise
   - Then il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()`
   - And il expose une methode supplementaire `listResources()` pour la decouverte
   - And les erreurs API sont encapsulees dans `PlatformError` avec platform='docker'

7. **Gestion des erreurs Docker**
   - Given l'hote Docker est injoignable
   - When le test de connexion s'execute
   - Then un message d'erreur clair s'affiche (timeout, connexion refusee, etc.)

## Tasks / Subtasks

- [x] Task 1 : Mise a jour types shared — DockerCapability & DockerDiscoveredResource (AC: #4, #6)
  - [x] 1.1 Etendre `DockerCapability` dans `packages/shared/src/models/node.ts` — ajouter `tlsEnabled?: boolean`
  - [x] 1.2 Ajouter `ConfigureDockerRequest` dans `packages/shared/src/api/nodes.ts`
  - [x] 1.3 Ajouter `DockerDiscoveredResource` dans `packages/shared/src/api/nodes.ts` (containerId, name, image, state, status, ports)
  - [x] 1.4 Re-exporter depuis `packages/shared/src/index.ts`

- [x] Task 2 : Client HTTP Docker (AC: #3, #6, #7)
  - [x] 2.1 Creer `apps/server/src/connectors/docker-client.ts` — client HTTP bas niveau pour l'API Docker
  - [x] 2.2 Utiliser `undici` (`request` sans `Agent` custom — HTTP plain, pas HTTPS par defaut)
  - [x] 2.3 Prefixer toutes les requetes avec `/v1.45` (API version)
  - [x] 2.4 Methodes `get<T>(path)`, `post(path)` avec timeout configurable
  - [x] 2.5 Methode `ping()` : GET `/_ping` → retourne `true` si reponse "OK" (texte brut, PAS du JSON)
  - [x] 2.6 Ecrire les tests unitaires (mock undici)

- [x] Task 3 : Connecteur Docker — PlatformConnector (AC: #6, #7)
  - [x] 3.1 Creer `apps/server/src/connectors/docker.connector.ts` implementant `PlatformConnector`
  - [x] 3.2 `testConnection()` : creer un DockerClient a partir des capabilities du parent, appeler `ping()`
  - [x] 3.3 `start(node)` : POST `/containers/{containerId}/start` — gerer le 304 (deja demarre) sans erreur
  - [x] 3.4 `stop(node)` : POST `/containers/{containerId}/stop` — gerer le 304 (deja arrete) sans erreur
  - [x] 3.5 `getStatus(node)` : GET `/containers/{containerId}/json` → mapper `State.Running` → NodeStatus
  - [x] 3.6 `listResources()` : GET `/containers/json?all=true` → mapper vers DockerDiscoveredResource[]
  - [x] 3.7 Toutes les erreurs encapsulees dans `PlatformError` avec platform='docker'
  - [x] 3.8 Ecrire les tests unitaires (mock DockerClient)

- [x] Task 4 : Mise a jour connector factory (AC: #6)
  - [x] 4.1 Ajouter le cas 'container' dans `getConnector()` retournant `DockerConnector`
  - [x] 4.2 Le connecteur Docker a besoin du noeud parent (pour les capabilities Docker API) — meme pattern que Proxmox
  - [x] 4.3 Mettre a jour les tests existants + ajouter le nouveau cas

- [x] Task 5 : Route API backend — PUT /api/nodes/:id/capabilities/docker (AC: #3, #4)
  - [x] 5.1 Ajouter `PUT /api/nodes/:id/capabilities/docker` dans `nodes.routes.ts` : validation JSON Schema, sauvegarde capabilities, lancement decouverte, retour node + discovered
  - [x] 5.2 Logique de decouverte : creer un DockerConnector temporaire, appeler `listResources`, inserer les noeuds decouverts en base (type=container, parentId, discovered=true, configured=false, platformRef)
  - [x] 5.3 Ajouter les response schemas (200 et 500) pour eviter que Fastify filtre la reponse
  - [x] 5.4 Ecrire les tests (configuration Docker, decouverte, erreurs)

- [x] Task 6 : Hooks API frontend (AC: #1, #2, #3)
  - [x] 6.1 Ajouter `useConfigureDocker()` (mutation PUT) dans `nodes.api.ts`
  - [x] 6.2 Types : `ConfigureDockerPayload` (host, port) et `ConfigureDockerResponse` (node + discovered)

- [x] Task 7 : Mise a jour page detail noeud + ConfigureDockerModal (AC: #1, #2, #3, #5)
  - [x] 7.1 Ajouter bouton "Configurer Docker" dans la section Capacites de `node-detail-page.tsx` (visible si pas de `docker_api` et type est physical/vm/lxc)
  - [x] 7.2 Afficher "Docker connecte — {host}:{port}" si deja configure
  - [x] 7.3 Creer `apps/web/src/features/nodes/configure-docker-modal.tsx` — Modal Mantine avec formulaire (hote, port, bouton "Tester & Sauvegarder")
  - [x] 7.4 En cas de succes : fermer le modal, rafraichir la page detail, toast avec nombre de conteneurs decouverts
  - [x] 7.5 Reutiliser `ConfigureDiscoveredModal` existant pour la configuration des conteneurs decouverts (AC #5)

- [x] Task 8 : Tests (AC: tous)
  - [x] 8.1 Tests DockerClient (mock undici) : ping, get, post, erreurs, timeout
  - [x] 8.2 Tests DockerConnector (mock client) : testConnection, start, stop, getStatus, listResources, erreurs PlatformError
  - [x] 8.3 Tests routes backend : PUT capabilities/docker (succes, decouverte, erreurs), validation
  - [x] 8.4 Tests connector factory : cas 'container'
  - [x] 8.5 Tests frontend : bouton Docker dans page detail, formulaire Docker (rendering, validation, soumission, erreur)
  - [x] 8.6 Verifier que tous les tests existants passent (171 server + 53 web = 224)

## Dev Notes

### Stack technique et versions

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe |
| Mantine (core, form, hooks, notifications) | ~7.17 | Modal pour formulaires |
| TanStack Query | ~5.x | Hooks API (useQuery, useMutation) |
| Fastify | ~5.x | Backend API |
| Drizzle ORM | ~0.45.x | Code-first, better-sqlite3 |
| @tabler/icons-react | ~3.36 | IconBrandDocker ou IconContainer |
| **undici** | **Node.js built-in** | HTTP client pour Docker API — `request` directement (PAS besoin d'Agent custom) |

### Architecture — Decisions critiques pour cette story

**1. Client HTTP Docker — undici (HTTP plain, PAS HTTPS)**

Utiliser `undici` (built-in Node.js 22+) directement, meme pattern que ProxmoxClient mais PLUS SIMPLE :
- Docker API ecoute en HTTP par defaut (port 2375) — PAS besoin d'Agent SSL scope
- Pas d'authentification complexe (pas de tokens, pas de tickets, pas de CSRF)
- Le Docker API est simple : requete JSON, reponse JSON (sauf `_ping` qui retourne "OK" en texte)

```typescript
// apps/server/src/connectors/docker-client.ts
import { request } from 'undici';

const DOCKER_TIMEOUT_MS = 15_000;
const DOCKER_API_VERSION = 'v1.45';

export interface DockerClientConfig {
  host: string;
  port: number;
  tlsEnabled?: boolean;
}

export class DockerClient {
  private readonly baseUrl: string;

  constructor(config: DockerClientConfig) {
    const protocol = config.tlsEnabled ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.host}:${config.port}/${DOCKER_API_VERSION}`;
  }

  async ping(): Promise<boolean> {
    const { statusCode } = await request(`${this.baseUrl}/_ping`, {
      method: 'GET',
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    return statusCode === 200;
  }

  async get<T>(path: string): Promise<T> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'GET',
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    const json = await body.json() as T;
    if (statusCode !== 200) throw new Error(`Docker GET ${path} failed (${statusCode})`);
    return json;  // Docker API retourne directement le JSON, PAS {data: ...} comme Proxmox
  }

  async post(path: string): Promise<void> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'POST',
      headersTimeout: DOCKER_TIMEOUT_MS,
      bodyTimeout: DOCKER_TIMEOUT_MS,
    });
    await body.text(); // consume body
    // 204 = success, 304 = already started/stopped (both are OK)
    if (statusCode !== 204 && statusCode !== 304) {
      throw new Error(`Docker POST ${path} failed (${statusCode})`);
    }
  }
}
```

**DIFFERENCES CRITIQUES avec ProxmoxClient :**

| Aspect | ProxmoxClient | DockerClient |
|---|---|---|
| Protocole | HTTPS (self-signed) | HTTP plain (defaut 2375) |
| Auth | Token API ou Ticket | Aucune (API non protegee) |
| Agent undici | Requis (SSL scope) | Non requis |
| Reponse JSON | `{ data: T }` → unwrap | `T` directement |
| Ping | `GET /nodes` | `GET /_ping` → "OK" texte |
| Start/Stop | POST → `{ data: "UPID:..." }` | POST → 204 No Content |
| API Version | `/api2/json` | `/v1.45` |
| Destroy | `agent.close()` | Pas de cleanup |

**2. Docker API — endpoints cles**

| Endpoint | Methode | Status | Usage |
|---|---|---|---|
| `/_ping` | GET | 200 + "OK" (text) | Test de connexion |
| `/info` | GET | 200 + JSON | Infos systeme (alternative a /_ping) |
| `/containers/json?all=true` | GET | 200 + JSON[] | Lister TOUS les conteneurs (running + stopped) |
| `/containers/{id}/json` | GET | 200 + JSON | Detail d'un conteneur (State, Config, etc.) |
| `/containers/{id}/start` | POST | 204 ou 304 | Demarrer un conteneur (304 = deja running) |
| `/containers/{id}/stop` | POST | 204 ou 304 | Arreter un conteneur (304 = deja stopped) |

**Reponse Docker GET /containers/json :**

```json
[
  {
    "Id": "abc123def456...",
    "Names": ["/my-nginx"],
    "Image": "nginx:latest",
    "ImageID": "sha256:...",
    "Command": "nginx -g 'daemon off;'",
    "Created": 1707000000,
    "Ports": [
      { "IP": "0.0.0.0", "PrivatePort": 80, "PublicPort": 8080, "Type": "tcp" }
    ],
    "State": "running",
    "Status": "Up 2 hours"
  }
]
```

**IMPORTANT :** `Names` est un array et chaque nom commence par `/`. Retirer le `/` lors du mapping.

**Reponse Docker GET /containers/{id}/json (detail) :**

```json
{
  "Id": "abc123...",
  "Name": "/my-nginx",
  "State": {
    "Status": "running",
    "Running": true,
    "Paused": false,
    "Restarting": false,
    "Dead": false,
    "ExitCode": 0
  },
  "Config": {
    "Image": "nginx:latest"
  }
}
```

**Mapping statut Docker → NodeStatus :**
- `State.Running === true` → `"online"`
- `State.Running === false` → `"offline"`
- Erreur de requete → `"error"`

**3. Mapping conteneurs decouverts → modele WakeHub**

```typescript
// Pour chaque conteneur de GET /containers/json?all=true :
{
  type: 'container',
  name: container.Names[0].replace(/^\//, ''),   // retirer le / prefix
  parentId: hostNodeId,
  discovered: true,
  configured: false,
  status: container.State === 'running' ? 'online' : 'offline',
  platformRef: {
    platform: 'docker',
    platformId: container.Id,
  },
}
```

**4. Stockage des capabilities Docker — PAS de chiffrement**

Contrairement a Proxmox qui stocke des credentials chiffres (tokenSecret, password), Docker en acces direct n'a PAS de credentials sensibles a chiffrer. Le capabilities JSON est simplement :

```typescript
const capabilities = {
  ...existingCapabilities,
  docker_api: {
    host: '192.168.1.100',
    port: 2375,
    tlsEnabled: false,
  }
};
```

**IMPORTANT :** Si dans le futur on supporte TLS client certs, il faudra ajouter le chiffrement. Pour le MVP, pas de credentials = pas de chiffrement.

**5. Schema DB — PAS de migration necessaire**

La table `nodes` et le champ `capabilities` JSON existent deja (Story 2.1). Le champ `platformRef` JSON existe deja. Aucune migration Drizzle n'est necessaire. Les donnees Docker sont stockees dans :
- `capabilities.docker_api` — config de la capacite sur le noeud hote
- `platformRef` — reference Docker (`platform: 'docker'`, `platformId: containerId`) sur les conteneurs decouverts
- `discovered` / `configured` — flags booleens pour le workflow decouverte → configuration

**6. Connecteur Docker — testConnection avec capabilities du PARENT**

Meme pattern que Proxmox : le connecteur Docker pour un conteneur doit recuperer les capabilities Docker API depuis le noeud PARENT (la machine, VM ou LXC hote). Le pattern :

```typescript
// Dans la route test-connection ou start/stop:
const [parentNode] = await db.select().from(nodes).where(eq(nodes.id, node.parentId));
const dockerCap = parentNode.capabilities?.docker_api;
const client = new DockerClient({ host: dockerCap.host, port: dockerCap.port });
```

**7. NodeDetailPage — Docker applicable sur physical, vm ET lxc**

Contrairement a Proxmox (applicable uniquement aux physical), Docker peut etre configure sur TOUT type de noeud qui heberge des conteneurs :
- `physical` — serveur bare-metal avec Docker installe
- `vm` — VM Proxmox avec Docker installe
- `lxc` — LXC Proxmox avec Docker installe

Le bouton "Configurer Docker" doit etre visible si `!node.capabilities?.docker_api` ET `node.type !== 'container'`.

### Dependances a installer

**AUCUNE nouvelle dependance npm.** `undici` est built-in Node.js 22+.

### Conventions de nommage — rappel obligatoire

| Couche | Convention | Exemples |
|---|---|---|
| DB colonnes | `snake_case` | `capabilities`, `platform_ref`, `parent_id` |
| API JSON | `camelCase` | `containerId`, `tlsEnabled` |
| Fichiers | `kebab-case` | `docker-client.ts`, `docker.connector.ts`, `configure-docker-modal.tsx` |
| Composants React | `PascalCase` | `ConfigureDockerModal` |
| Types/Interfaces | `PascalCase` | `DockerCapability`, `DockerDiscoveredResource` |
| Constantes | `SCREAMING_SNAKE` | `DOCKER_TIMEOUT_MS`, `DOCKER_API_VERSION` |
| Codes erreur | `SCREAMING_SNAKE` | `DOCKER_AUTH_FAILED`, `DOCKER_UNREACHABLE` |

### Structure de fichiers — nouveaux fichiers a creer

```
apps/server/src/
├── connectors/
│   ├── docker-client.ts             ← NOUVEAU — Client HTTP Docker (simple, pas d'auth)
│   ├── docker-client.test.ts        ← NOUVEAU — Tests client (mock undici)
│   ├── docker.connector.ts          ← NOUVEAU — Connecteur PlatformConnector Docker
│   ├── docker.connector.test.ts     ← NOUVEAU — Tests connecteur (mock client)
│   ├── connector-factory.ts         ← MODIFIER — Ajouter cas 'container'
│   └── connector-factory.test.ts    ← MODIFIER — Ajouter test container
├── routes/
│   ├── nodes.routes.ts              ← MODIFIER — Ajouter PUT capabilities/docker
│   └── nodes.routes.test.ts         ← MODIFIER — Ajouter tests endpoint Docker

apps/web/src/
├── api/
│   └── nodes.api.ts                 ← MODIFIER — Ajouter useConfigureDocker hook
├── features/
│   └── nodes/
│       ├── configure-docker-modal.tsx     ← NOUVEAU — Modal formulaire Docker
│       ├── configure-docker-modal.test.tsx ← NOUVEAU — Tests modal
│       └── node-detail-page.tsx           ← MODIFIER — Ajouter bouton Docker + affichage
│       └── node-detail-page.test.tsx      ← MODIFIER — Ajouter tests Docker

packages/shared/src/
├── models/
│   └── node.ts                      ← MODIFIER — Etendre DockerCapability
├── api/
│   └── nodes.ts                     ← MODIFIER — Ajouter ConfigureDockerRequest, DockerDiscoveredResource
└── index.ts                         ← MODIFIER — Re-exporter nouveaux types
```

**Fichiers existants a MODIFIER (pas creer) :**
- `apps/server/src/connectors/connector-factory.ts` — Ajouter cas 'container'
- `apps/server/src/connectors/connector-factory.test.ts` — Test 'container'
- `apps/server/src/routes/nodes.routes.ts` — Ajouter PUT capabilities/docker
- `apps/server/src/routes/nodes.routes.test.ts` — Tests nouveaux endpoints
- `apps/web/src/api/nodes.api.ts` — Ajouter hook useConfigureDocker
- `apps/web/src/features/nodes/node-detail-page.tsx` — Bouton Docker
- `apps/web/src/features/nodes/node-detail-page.test.tsx` — Tests Docker
- `packages/shared/src/models/node.ts` — Etendre DockerCapability
- `packages/shared/src/api/nodes.ts` — Ajouter types API Docker
- `packages/shared/src/index.ts` — Re-exporter

### Testing — approche et patterns

**Tests backend — DockerClient (mock undici) :**

```typescript
// apps/server/src/connectors/docker-client.test.ts
import { vi, describe, it, expect } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('undici', () => ({
  request: mockRequest,
}));

import { DockerClient } from './docker-client.js';

describe('DockerClient', () => {
  it('should ping successfully', async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: { text: async () => 'OK' },
    });

    const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
    const result = await client.ping();
    expect(result).toBe(true);

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/v1.45/_ping'),
      expect.any(Object),
    );
  });

  it('should list containers', async () => {
    const containers = [
      { Id: 'abc123', Names: ['/nginx'], Image: 'nginx:latest', State: 'running', Status: 'Up 2h', Ports: [] },
    ];
    mockRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: { json: async () => containers },
    });

    const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
    const result = await client.get('/containers/json?all=true');
    expect(result).toEqual(containers);
  });
});
```

**Tests backend — DockerConnector (mock client) :**

```typescript
// apps/server/src/connectors/docker.connector.test.ts
// Mock DockerClient au lieu de undici directement
vi.mock('./docker-client.js', () => ({
  DockerClient: class {
    ping = vi.fn();
    get = vi.fn();
    post = vi.fn();
  },
}));
```

**Tests backend — Routes (pattern Fastify inject) :**

Suivre le pattern exact de `nodes.routes.test.ts` existant : Fastify app + inject + DB in-memory.

**Tests frontend — pattern identique Stories 2.1/2.2 :**

```typescript
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <MemoryRouter initialEntries={['/nodes/node-1']}>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}
```

**Cas de test a couvrir :**
- DockerClient : ping OK/fail, get containers, post start/stop (204/304), erreurs HTTP, timeout, ECONNREFUSED
- DockerConnector : testConnection, start container, stop container, getStatus, listResources, erreurs PlatformError
- Routes : PUT capabilities/docker (succes, decouverte lancee, erreurs connexion, validation)
- Frontend : bouton Docker dans page detail, formulaire Docker (rendering, validation, soumission succes/erreur)

### Intelligence Stories 2.1/2.2 — lecons apprises

**Bugs critiques rencontres et resolutions :**

1. **vi.mock factory hoisted avant variables** — `vi.hoisted()` est OBLIGATOIRE pour les mock functions utilisees dans `vi.mock()` factories. **Appliquer dans TOUS les tests Docker.**

2. **Mantine Modal rend dans un portal** — Utiliser `findByPlaceholderText` (async) au lieu de `getByPlaceholderText`. **Appliquer dans les tests du ConfigureDockerModal.**

3. **Fastify response schema filtre les proprietes dynamiques** — Ajouter `additionalProperties: true` sur les schemas `details`. **Appliquer sur les schemas de reponse Docker.**

4. **Tests : executer via workspace** — `npm run test -w apps/server` et `npm run test -w apps/web`, PAS `npx vitest run` depuis la racine.

5. **MemoryRouter + useParams** — NodeDetailPage utilise `useParams()` qui necessite d'etre dans un `<Route path="/nodes/:id">` element.

6. **Docker POST start/stop retourne 204 (No Content)** — NE PAS tenter de parser le body comme JSON. Utiliser `body.text()` pour consommer le body. Le status 304 (already started/stopped) est aussi un succes.

### Docker API — codes d'erreur pour PlatformError

| Code | Quand | Message type |
|---|---|---|
| `DOCKER_UNREACHABLE` | Connexion impossible (timeout, DNS, refus) | "API Docker injoignable a {host}:{port}" |
| `DOCKER_CONNECTION_FAILED` | Test de connexion echoue (ping != OK) | "Impossible de se connecter a Docker" |
| `DOCKER_START_FAILED` | Echec demarrage conteneur | "Impossible de demarrer le conteneur {name}" |
| `DOCKER_STOP_FAILED` | Echec arret conteneur | "Impossible d'arreter le conteneur {name}" |
| `DOCKER_DISCOVERY_FAILED` | Echec decouverte | "Impossible de lister les conteneurs Docker" |
| `DOCKER_API_ERROR` | Erreur API generique | "Erreur API Docker ({operation}): {message}" |
| `DOCKER_CONTAINER_NOT_FOUND` | Container inexistant (404) | "Conteneur {id} introuvable" |

### Route PUT /api/nodes/:id/capabilities/docker — schema Fastify

```typescript
// Schema de la requete
const configureDockerSchema = {
  body: {
    type: 'object',
    required: ['host', 'port'],
    properties: {
      host: { type: 'string', minLength: 1 },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
      tlsEnabled: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            node: nodeResponseSchema,
            discovered: { type: 'array', items: nodeResponseSchema },
          },
        },
      },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};
```

**IMPORTANT :** Reproduire le meme pattern que `PUT /api/nodes/:id/capabilities/proxmox` pour la structure du handler :
1. Recuperer le noeud
2. Tester la connexion Docker
3. Sauvegarder la capability dans le noeud
4. Lancer la decouverte
5. Retourner le noeud mis a jour + conteneurs decouverts

### ConfigureDockerModal — structure simplifiee

Le modal Docker est BEAUCOUP plus simple que le modal Proxmox (pas d'auth type, pas de credentials multiples) :

```typescript
// Champs du formulaire :
// - host: string (requis) — IP ou hostname du daemon Docker
// - port: number (defaut 2375)
// - tlsEnabled: boolean (defaut false) — pour futur, non utilise MVP
```

### Project Structure Notes

- `docker-client.ts` est un fichier SEPARE du connecteur — separation des responsabilites (HTTP transport vs logique metier PlatformConnector)
- Le `DockerConnector` cree un `DockerClient` a chaque appel (pas de connection pooling)
- Le `configure-docker-modal.tsx` est simple (2 champs + bouton) car pas d'auth complexe
- Reutiliser `ConfigureDiscoveredModal` existant pour les conteneurs decouverts (meme pattern que VMs/LXCs Proxmox)
- Le bouton Docker et le bouton Proxmox peuvent coexister dans la section Capacites

### References

- [Source: epics.md#Story-2.3] — User story, acceptance criteria
- [Source: architecture.md#Connectors] — Interface PlatformConnector, structure fichiers connecteurs
- [Source: 2-2-capacite-proxmox-et-decouverte-vms-lxcs.md] — Story Proxmox (reference complete pour patterns)
- [Source: proxmox-client.ts] — Client HTTP reference (adapter pour Docker)
- [Source: proxmox.connector.ts] — Connecteur reference (adapter pour Docker)
- [Source: configure-proxmox-modal.tsx] — Modal reference (simplifier pour Docker)
- [Source: node-detail-page.tsx] — Page a modifier (ajouter bouton Docker)
- [Source: connector-factory.ts] — Factory a modifier (ajouter cas 'container')
- [Source: Docker Engine API v1.45] — Endpoints, reponses, status codes

### Anti-patterns a eviter

- **NE PAS** utiliser `Agent` undici pour Docker HTTP (pas de SSL par defaut) — contrairement a Proxmox
- **NE PAS** creer de migration Drizzle — le schema `nodes` et `capabilities` JSON existent deja
- **NE PAS** parser le body des POST start/stop comme JSON — c'est du 204 No Content
- **NE PAS** oublier de retirer le `/` prefix des noms de conteneurs Docker
- **NE PAS** traiter le status 304 comme une erreur — c'est "already started" ou "already stopped"
- **NE PAS** oublier `vi.hoisted()` pour les mock functions dans `vi.mock()` factories
- **NE PAS** utiliser `getByPlaceholderText` pour tester les Modals — utiliser `findByPlaceholderText` (async)
- **NE PAS** oublier de declarer les response schemas (200, 400, 500) dans la route Fastify
- **NE PAS** chiffrer les capabilities Docker (pas de credentials sensibles en mode HTTP direct)
- **NE PAS** oublier `additionalProperties: true` sur les schemas d'objets dynamiques
- **NE PAS** appeler l'API Docker directement depuis les routes — passer par DockerConnector
- **NE PAS** creer une page detail noeud complete — modifier celle qui existe deja (Story 2.2)

## File List

### New Files
- `apps/server/src/connectors/docker-client.ts` — Client HTTP Docker (undici, HTTP plain)
- `apps/server/src/connectors/docker-client.test.ts` — Tests DockerClient (16 tests)
- `apps/server/src/connectors/docker.connector.ts` — Connecteur PlatformConnector Docker
- `apps/server/src/connectors/docker.connector.test.ts` — Tests DockerConnector (15 tests)
- `apps/web/src/features/nodes/configure-docker-modal.tsx` — Modal formulaire Docker (Mantine)

### Modified Files
- `packages/shared/src/models/node.ts` — Ajout `tlsEnabled?` a DockerCapability
- `packages/shared/src/api/nodes.ts` — Ajout ConfigureDockerRequest, DockerDiscoveredResource
- `packages/shared/src/index.ts` — Re-export des nouveaux types
- `apps/server/src/connectors/connector-factory.ts` — Ajout cas 'container' → DockerConnector
- `apps/server/src/connectors/connector-factory.test.ts` — Tests pour le cas 'container' (8 tests)
- `apps/server/src/routes/nodes.routes.ts` — Ajout PUT /api/nodes/:id/capabilities/docker
- `apps/server/src/routes/nodes.routes.test.ts` — Tests endpoint Docker (34 tests total)
- `apps/web/src/api/nodes.api.ts` — Ajout useConfigureDocker hook + types
- `apps/web/src/features/nodes/node-detail-page.tsx` — Bouton Docker, affichage "Docker connecte", modal
- `apps/web/src/features/nodes/node-detail-page.test.tsx` — Tests Docker dans page detail (8 tests)

## Dev Agent Record

### Implementation Notes
- DockerClient utilise `undici.request` directement (HTTP plain, pas HTTPS par defaut) — pas d'Agent custom contrairement a ProxmoxClient
- Le DockerConnector suit le meme pattern que ProxmoxConnector (parentNode pour les capabilities) mais sans decryptFn (pas de credentials Docker)
- La route PUT capabilities/docker accepte physical, vm et lxc (contrairement a Proxmox qui n'accepte que physical)
- Le mapping Docker Names[0] retire le prefix `/` systematiquement
- Le status 304 (already started/stopped) est traite comme succes dans DockerClient.post()
- Tous les tests suivent le pattern vi.hoisted() pour les mocks dans les factories vi.mock()

### Completion Notes
Implementation complete de la Story 2.3. Tous les 7 AC sont couverts :
- AC#1 : Bouton "Configurer Docker" visible dans section Capacites (physical, vm, lxc uniquement)
- AC#2 : Modal formulaire Docker avec champs hote + port (defaut 2375)
- AC#3 : Test connexion via ping, sauvegarde capabilities, decouverte auto, toast succes
- AC#4 : Decouverte conteneurs Docker via GET /containers/json?all=true, stockage en base
- AC#5 : Reutilisation de ConfigureDiscoveredModal existant pour les conteneurs decouverts
- AC#6 : DockerConnector implementant PlatformConnector avec testConnection, start, stop, getStatus, listResources
- AC#7 : Erreurs Docker encapsulees dans PlatformError avec codes specifiques

Tests : 224 total (171 server + 53 web), 0 regressions.

## Change Log

| Date | Change |
|---|---|
| 2026-02-13 | Implementation complete Story 2.3 — Docker connector, client HTTP, route API, modal frontend, tests |
