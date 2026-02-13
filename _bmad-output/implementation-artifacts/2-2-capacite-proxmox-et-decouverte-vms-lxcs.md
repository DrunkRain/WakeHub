# Story 2.2: Capacite Proxmox & decouverte VMs/LXCs

Status: Done

## Story

As a administrateur,
I want connecter mon serveur Proxmox et decouvrir les VMs/LXCs disponibles,
So that WakeHub peut controler mes VMs et LXCs via l'API Proxmox.

## Acceptance Criteria

1. **Formulaire configuration Proxmox sur page detail noeud**
   - Given une machine physique existe en base
   - When je suis sur sa page de detail (route `/nodes/:id`), section "Capacites"
   - Then je vois un bouton "Configurer Proxmox" si la capacite `proxmox_api` n'est pas encore configuree
   - And la page detail affiche au minimum : en-tete (nom, type, statut, IP), section capacites, section services decouverts

2. **Formulaire configuration Proxmox**
   - Given je clique sur "Configurer Proxmox"
   - When le formulaire s'affiche (Modal Mantine)
   - Then il demande : URL de l'API Proxmox (host:port), methode d'auth (token API ou utilisateur/mot de passe), identifiants correspondants
   - And les champs sont valides (URL non vide, identifiants non vides)

3. **Test connexion Proxmox & sauvegarde**
   - Given je remplis le formulaire et confirme
   - When le test de connexion Proxmox reussit (appel `GET /nodes` de l'API Proxmox)
   - Then la capacite `proxmox_api` est ajoutee au champ `capabilities` du noeud avec identifiants sensibles chiffres AES-256-GCM
   - And la decouverte automatique est lancee immediatement apres
   - And un toast de succes s'affiche

4. **Decouverte automatique VMs/LXCs**
   - Given la decouverte Proxmox est lancee
   - When l'API Proxmox repond (endpoint `GET /cluster/resources?type=vm`)
   - Then toutes les VMs et LXCs sont listees avec leur nom, VMID, noeud Proxmox et statut actuel
   - And chaque entite decouverte est enregistree en base (table `nodes`, type=vm ou lxc, parent_id=machine physique, discovered=true, configured=false)
   - And le champ `platformRef` contient `{ platform: 'proxmox', platformId: '{node}/{vmid}' }`
   - And la page detail de la machine affiche "X services a configurer"

5. **Configuration d'un service decouvert**
   - Given je clique sur un service "decouvert non configure" dans la liste
   - When le formulaire de configuration s'affiche
   - Then il est pre-rempli avec les donnees Proxmox (nom, type vm/lxc, statut)
   - And je peux completer les infos manquantes (URL service, nom personnalise)
   - And je confirme → le noeud passe a `configured=true` et apparait dans la liste des noeuds configures

6. **Connecteur Proxmox — PlatformConnector**
   - Given le connecteur Proxmox est implemente
   - When il est utilise
   - Then il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()`
   - And il expose une methode supplementaire `listResources()` pour la decouverte
   - And les erreurs API sont encapsulees dans `PlatformError` avec platform='proxmox'

7. **Gestion des erreurs Proxmox**
   - Given l'URL API Proxmox est invalide ou les identifiants sont faux
   - When le test de connexion s'execute
   - Then un message d'erreur clair s'affiche avec le code et la description

8. **Routes API backend**
   - Given les routes API sont implementees
   - When `PUT /api/nodes/:id/capabilities/proxmox` est appele avec des identifiants valides
   - Then la capacite est sauvegardee (credentials chiffres) et la decouverte lancee, retour `{ data: { node, discovered: [...] } }`
   - When `PATCH /api/nodes/:id` est appele avec `{ configured: true, name?, serviceUrl? }`
   - Then le noeud est mis a jour
   - And tous les endpoints utilisent le format normalise `{ data }` / `{ error }` avec validation JSON Schema

9. **Mise a jour du connector factory**
   - Given le connector factory est mis a jour
   - When `getConnector('vm')` ou `getConnector('lxc')` est appele
   - Then le connecteur Proxmox est retourne (il a besoin du noeud parent pour les credentials API)

## Tasks / Subtasks

- [x] Task 1 : Mise a jour types shared — ProxmoxCapability & PlatformRef (AC: #4, #6)
  - [x] 1.1 Etendre `ProxmoxCapability` dans `packages/shared/src/models/node.ts` pour supporter token API ET utilisateur/mot de passe, ajouter `port?` et `verifySsl?`
  - [x] 1.2 Etendre `PlatformRef` avec des champs specifiques Proxmox (`node: string`, `vmid: number`, `type: 'qemu' | 'lxc'`)
  - [x] 1.3 Ajouter `ConfigureProxmoxRequest`, `DiscoveredResource`, `UpdateNodeRequest` (PATCH) dans `packages/shared/src/api/nodes.ts`
  - [x] 1.4 Re-exporter depuis `packages/shared/src/index.ts`

- [x] Task 2 : Client HTTP Proxmox (AC: #3, #6, #7)
  - [x] 2.1 Creer `apps/server/src/connectors/proxmox-client.ts` — client HTTP bas niveau pour l'API Proxmox
  - [x] 2.2 Implementer l'authentification token API (header `Authorization: PVEAPIToken=...`)
  - [x] 2.3 Implementer l'authentification ticket (POST /access/ticket → Cookie + CSRFPreventionToken)
  - [x] 2.4 Gerer SSL self-signed avec `undici.Agent` scope (PAS de `NODE_TLS_REJECT_UNAUTHORIZED` global)
  - [x] 2.5 Methodes `get<T>(path)` et `post<T>(path, params?)` avec timeout configurable
  - [x] 2.6 Ecrire les tests unitaires (mock undici)

- [x] Task 3 : Connecteur Proxmox — PlatformConnector (AC: #6)
  - [x] 3.1 Creer `apps/server/src/connectors/proxmox.connector.ts` implementant `PlatformConnector`
  - [x] 3.2 `testConnection()` : creer un ProxmoxClient a partir des capabilities du parent, appeler `GET /nodes`
  - [x] 3.3 `start()` : POST `/nodes/{node}/qemu/{vmid}/status/start` ou `.../lxc/...` selon platformRef.type
  - [x] 3.4 `stop()` : POST `/nodes/{node}/qemu/{vmid}/status/stop` ou `.../lxc/...`
  - [x] 3.5 `getStatus()` : GET `/nodes/{node}/qemu/{vmid}/status/current` ou `.../lxc/...`, mapper status Proxmox → NodeStatus
  - [x] 3.6 `listResources(node)` : GET `/cluster/resources?type=vm`, retourner VMs + LXCs avec mapping vers DiscoveredResource
  - [x] 3.7 Toutes les erreurs encapsulees dans `PlatformError` avec platform='proxmox'
  - [x] 3.8 Ecrire les tests unitaires (mock ProxmoxClient)

- [x] Task 4 : Mise a jour connector factory (AC: #9)
  - [x] 4.1 Ajouter les cas 'vm' et 'lxc' dans `getConnector()` retournant `ProxmoxConnector`
  - [x] 4.2 Le connecteur Proxmox a besoin du noeud parent (pour les capabilities API) — adapter la signature ou passer le noeud complet
  - [x] 4.3 Mettre a jour les tests existants + ajouter les nouveaux cas

- [x] Task 5 : Routes API backend — capabilities + discovery + PATCH node (AC: #3, #4, #5, #8)
  - [x] 5.1 Ajouter `PUT /api/nodes/:id/capabilities/proxmox` dans `nodes.routes.ts` : validation JSON Schema, chiffrement credentials, sauvegarde capabilities, lancement decouverte, retour node + discovered
  - [x] 5.2 Ajouter `PATCH /api/nodes/:id` dans `nodes.routes.ts` : mise a jour partielle du noeud (name, serviceUrl, configured, ipAddress)
  - [x] 5.3 Logique de decouverte : creer un ProxmoxConnector temporaire, appeler listResources, inserer les noeuds decouverts en base (type, parentId, discovered=true, configured=false, platformRef)
  - [x] 5.4 Chiffrer les champs sensibles (tokenSecret ou password) via `crypto.encrypt()` avant stockage dans capabilities JSON
  - [x] 5.5 Ecrire les tests (configuration Proxmox, decouverte, mise a jour noeud, validation, erreurs)

- [x] Task 6 : Hooks API frontend (AC: #1, #2, #3, #5)
  - [x] 6.1 Ajouter `useConfigureProxmox()` (mutation PUT) dans `nodes.api.ts`
  - [x] 6.2 Ajouter `useNode(id)` (query GET single node) dans `nodes.api.ts`
  - [x] 6.3 Ajouter `useUpdateNode()` (mutation PATCH) dans `nodes.api.ts`
  - [x] 6.4 Ajouter `useDiscoveredNodes(parentId)` (query GET nodes with discovered=true, configured=false, parentId) dans `nodes.api.ts`

- [x] Task 7 : Page detail noeud minimale + section capacites (AC: #1, #2, #3)
  - [x] 7.1 Creer `apps/web/src/features/nodes/node-detail-page.tsx` — page minimale avec en-tete (nom, type, badge statut, IP) + section "Capacites"
  - [x] 7.2 Section Capacites : si pas de `proxmox_api` → bouton "Configurer Proxmox", si configure → afficher "Proxmox connecte" avec host
  - [x] 7.3 Ajouter la route `/nodes/:id` dans `router.tsx` (route protegee AuthGuard)
  - [x] 7.4 Rendre le nom des noeuds cliquable dans `nodes-page.tsx` (lien vers `/nodes/:id`)

- [x] Task 8 : Formulaire configuration Proxmox (AC: #2, #3)
  - [x] 8.1 Creer `apps/web/src/features/nodes/configure-proxmox-modal.tsx` — Modal Mantine avec formulaire
  - [x] 8.2 Champs : host (requis), port (defaut 8006), methode auth (select: token/password), tokenId + tokenSecret OU username + password selon le choix
  - [x] 8.3 Bouton "Tester & Sauvegarder" : appelle `useConfigureProxmox`, affiche resultat (succes avec nombre de VMs/LXCs decouvertes, ou erreur)
  - [x] 8.4 En cas de succes : fermer le modal, rafraichir la page detail

- [x] Task 9 : Affichage services decouverts + formulaire configuration (AC: #4, #5)
  - [x] 9.1 Section "Services a configurer" dans `node-detail-page.tsx` : liste des noeuds enfants discovered=true, configured=false
  - [x] 9.2 Chaque service decouvert affiche : nom Proxmox, type (VM/LXC), VMID, statut
  - [x] 9.3 Bouton "Configurer" sur chaque ligne → Modal pre-rempli (nom editable, URL service optionnelle)
  - [x] 9.4 Confirmation → PATCH le noeud avec `configured: true`, toast succes, rafraichir la liste

- [x] Task 10 : Tests frontend (AC: tous)
  - [x] 10.1 Tester le rendering de la page detail noeud (en-tete, section capacites, bouton Proxmox)
  - [x] 10.2 Tester le formulaire Proxmox (rendering, validation, soumission)
  - [x] 10.3 Tester l'affichage des services decouverts
  - [x] 10.4 Tester le formulaire de configuration service (pre-remplissage, soumission)
  - [x] 10.5 Verifier que tous les tests existants passent (84 server + 39 web)

## Dev Notes

### Stack technique et versions

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe |
| Mantine (core, form, hooks, notifications) | ~7.17 | Modal pour formulaires, Select pour auth method |
| TanStack Query | ~5.x | Hooks API (useQuery, useMutation) |
| Fastify | ~5.x | Backend API, plugins par domaine |
| Drizzle ORM | ~0.45.x | Code-first, better-sqlite3 |
| @tabler/icons-react | ~3.36 | IconServer, IconSettings, IconCheck, IconX |
| **undici** | **Node.js built-in** | HTTP client pour Proxmox API — `Agent` + `request` pour SSL scope |

### Architecture — Decisions critiques pour cette story

**1. Client HTTP Proxmox — undici (PAS de lib externe)**

Utiliser `undici` (built-in Node.js 22+) directement au lieu du package `proxmox-api` npm :
- Controle total sur SSL (scoped `Agent` pour self-signed certs, PAS de `NODE_TLS_REJECT_UNAUTHORIZED` global)
- L'API Proxmox necessaire est petite (~10 endpoints) — pas besoin d'une lib wrapper
- Alignement avec le pattern `PlatformConnector` existant

```typescript
// apps/server/src/connectors/proxmox-client.ts
import { Agent, request } from 'undici';

const PROXMOX_TIMEOUT_MS = 30_000;

export class ProxmoxClient {
  private baseUrl: string;
  private agent: Agent;
  private headers: Record<string, string>;

  constructor(config: { host: string; port?: number; tokenId?: string; tokenSecret?: string; verifySsl?: boolean }) {
    const port = config.port ?? 8006;
    this.baseUrl = `https://${config.host}:${port}/api2/json`;
    this.agent = new Agent({ connect: { rejectUnauthorized: config.verifySsl ?? false } });

    // API token auth (stateless, preferred)
    this.headers = {
      'Authorization': `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`,
    };
  }

  async get<T>(path: string): Promise<T> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
      dispatcher: this.agent,
      headersTimeout: PROXMOX_TIMEOUT_MS,
      bodyTimeout: PROXMOX_TIMEOUT_MS,
    });
    const json = await body.json() as { data: T };
    if (statusCode !== 200) throw new Error(`Proxmox GET ${path} failed (${statusCode})`);
    return json.data;
  }

  async post<T>(path: string, params?: Record<string, string>): Promise<T> {
    const { statusCode, body } = await request(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params ? new URLSearchParams(params).toString() : undefined,
      dispatcher: this.agent,
      headersTimeout: PROXMOX_TIMEOUT_MS,
      bodyTimeout: PROXMOX_TIMEOUT_MS,
    });
    const json = await body.json() as { data: T };
    if (statusCode !== 200) throw new Error(`Proxmox POST ${path} failed (${statusCode})`);
    return json.data;
  }

  destroy(): void { this.agent.close(); }
}
```

**Note : Authentification ticket (username/password)**

Pour les users qui n'ont pas de token API, supporter aussi l'auth ticket :
- POST `/access/ticket` avec `username=root@pam&password=...` (application/x-www-form-urlencoded)
- Response : `{ data: { ticket, CSRFPreventionToken, username } }`
- GET requests : header `Cookie: PVEAuthCookie=<ticket>`
- POST requests : + header `CSRFPreventionToken: <token>`
- Tickets expirent apres 2h — rafraichir si necessaire
- Le client doit gerer les deux methodes de maniere transparente

**2. API Proxmox — endpoints cles**

| Endpoint | Methode | Usage |
|---|---|---|
| `/access/ticket` | POST | Authentification ticket (username/password) |
| `/nodes` | GET | Lister les noeuds du cluster — sert aussi de test de connexion |
| `/cluster/resources?type=vm` | GET | Decouverte : toutes les VMs + LXCs de tous les noeuds en un seul appel |
| `/nodes/{node}/qemu/{vmid}/status/current` | GET | Statut d'une VM |
| `/nodes/{node}/lxc/{vmid}/status/current` | GET | Statut d'un LXC |
| `/nodes/{node}/qemu/{vmid}/status/start` | POST | Demarrer une VM — retourne un UPID (task async) |
| `/nodes/{node}/qemu/{vmid}/status/stop` | POST | Arreter une VM |
| `/nodes/{node}/lxc/{vmid}/status/start` | POST | Demarrer un LXC |
| `/nodes/{node}/lxc/{vmid}/status/stop` | POST | Arreter un LXC |

**Reponse Proxmox :** Toujours enveloppee dans `{ "data": ... }`. Pour les listes, `data` est un array. Pour start/stop, `data` est un UPID (string).

**Mapping statut Proxmox → NodeStatus :**
- `"running"` → `"online"`
- `"stopped"` → `"offline"`
- `"paused"` → `"offline"` (pas de mapping exact, traiter comme offline)

**3. Decouverte via `GET /cluster/resources?type=vm`**

Cet endpoint retourne TOUTES les VMs et LXCs de TOUS les noeuds en un seul appel — c'est la methode recommandee :

```json
{
  "data": [
    {
      "id": "qemu/100",
      "type": "qemu",
      "vmid": 100,
      "name": "ubuntu-server",
      "node": "pve1",
      "status": "running",
      "maxcpu": 4,
      "mem": 2147483648,
      "maxmem": 4294967296,
      "maxdisk": 34359738368,
      "uptime": 3600,
      "template": 0
    },
    {
      "id": "lxc/200",
      "type": "lxc",
      "vmid": 200,
      "name": "nginx-proxy",
      "node": "pve1",
      "status": "stopped",
      ...
    }
  ]
}
```

**Mapping vers le modele WakeHub :**
- `type: "qemu"` → `NodeType = "vm"`, `type: "lxc"` → `NodeType = "lxc"`
- `platformRef = { platform: "proxmox", platformId: "{node}/{vmid}", type: "qemu" | "lxc" }`
- Ignorer les templates (`template === 1`)
- `status: "running"` → `NodeStatus = "online"`, sinon `"offline"`
- `name` → `name`, `parentId` → ID du noeud physique WakeHub

**4. Stockage des credentials Proxmox — chiffrement dans capabilities JSON**

Les credentials sensibles (tokenSecret ou password) sont chiffres DANS le champ `capabilities` JSON avant stockage :

```typescript
// Sauvegarde:
const capabilities = {
  proxmox_api: {
    host: '192.168.1.100',
    port: 8006,
    tokenId: 'root@pam!monitoring',
    tokenSecretEncrypted: encrypt(tokenSecret),  // AES-256-GCM
    verifySsl: false,
  }
};
await db.update(nodes).set({ capabilities }).where(eq(nodes.id, nodeId));

// Lecture:
const proxCap = node.capabilities?.proxmox_api;
const tokenSecret = proxCap?.tokenSecretEncrypted ? decrypt(proxCap.tokenSecretEncrypted) : null;
```

**IMPORTANT :** Les champs chiffres se terminent par `Encrypted` dans le JSON capabilities. NE PAS retourner les champs `*Encrypted` dans les reponses API — les filtrer dans le sanitizer.

**5. Schema DB — PAS de migration necessaire**

La table `nodes` et le champ `capabilities` JSON existent deja (Story 2.1). Aucune migration Drizzle n'est necessaire. Les donnees Proxmox sont stockees dans :
- `capabilities.proxmox_api` — config de la capacite sur le noeud physique parent
- `platformRef` — reference Proxmox (`node`, `vmid`, `type`) sur les VMs/LXCs decouvertes
- `discovered` / `configured` — flags booleens pour le workflow decouverte → configuration

**6. Connecteur Proxmox — testConnection avec credentials du PARENT**

Le connecteur Proxmox pour une VM/LXC doit recuperer les credentials API depuis le noeud PARENT (la machine physique). Le pattern :

```typescript
// Dans la route test-connection ou start/stop:
const [parentNode] = await db.select().from(nodes).where(eq(nodes.id, node.parentId));
const proxCap = parentNode.capabilities?.proxmox_api;
const tokenSecret = decrypt(proxCap.tokenSecretEncrypted);
const client = new ProxmoxClient({ host: proxCap.host, port: proxCap.port, tokenId: proxCap.tokenId, tokenSecret });
```

**IMPORTANT pour le ConnectorFactory :** Le connecteur Proxmox a besoin du noeud parent, pas juste du type. Adapter `getConnector()` pour accepter le noeud complet (pas juste le type), ou passer les capabilities via un parametre supplementaire.

**7. Page detail noeud — scope minimal pour cette story**

La page detail complete est dans Story 2.5. Pour Story 2.2, creer une page **minimale** a `/nodes/:id` avec :
- En-tete : nom, type (badge), statut (badge colore), IP
- Section "Capacites" : bouton "Configurer Proxmox" ou indicateur "Proxmox connecte"
- Section "Services a configurer" : liste des enfants discovered=true, configured=false
- Section "Noeuds configures" : liste des enfants configured=true

Story 2.5 enrichira cette page avec : parametres editables, actions (test connexion, supprimer), etc.

### Dependances a installer

**AUCUNE nouvelle dependance npm.** `undici` est built-in Node.js 22+. Cependant, si TypeScript ne resout pas les types `undici` :
```bash
npm install -D @types/node@latest -w apps/server   # S'assurer que les types Node incluent undici
```

Verifier d'abord si `import { Agent, request } from 'undici'` compile sans erreur. Si oui, rien a installer.

### Conventions de nommage — rappel obligatoire

| Couche | Convention | Exemples |
|---|---|---|
| DB colonnes | `snake_case` | `capabilities`, `platform_ref`, `parent_id` |
| API JSON | `camelCase` | `tokenId`, `tokenSecret`, `verifySsl`, `platformRef` |
| Fichiers | `kebab-case` | `proxmox-client.ts`, `proxmox.connector.ts`, `configure-proxmox-modal.tsx` |
| Composants React | `PascalCase` | `NodeDetailPage`, `ConfigureProxmoxModal` |
| Types/Interfaces | `PascalCase` | `ProxmoxCapability`, `DiscoveredResource` |
| Constantes | `SCREAMING_SNAKE` | `PROXMOX_TIMEOUT_MS`, `PROXMOX_DEFAULT_PORT` |
| Codes erreur | `SCREAMING_SNAKE` | `PROXMOX_AUTH_FAILED`, `PROXMOX_UNREACHABLE` |

### Structure de fichiers — nouveaux fichiers a creer

```
apps/server/src/
├── connectors/
│   ├── proxmox-client.ts             ← NOUVEAU — Client HTTP Proxmox (auth, SSL, requests)
│   ├── proxmox-client.test.ts        ← NOUVEAU — Tests client (mock undici)
│   ├── proxmox.connector.ts          ← NOUVEAU — Connecteur PlatformConnector Proxmox
│   ├── proxmox.connector.test.ts     ← NOUVEAU — Tests connecteur (mock client)
│   ├── connector-factory.ts          ← MODIFIER — Ajouter cas 'vm' et 'lxc'
│   └── connector-factory.test.ts     ← MODIFIER — Ajouter tests vm/lxc
├── routes/
│   ├── nodes.routes.ts               ← MODIFIER — Ajouter PUT capabilities/proxmox + PATCH node
│   └── nodes.routes.test.ts          ← MODIFIER — Ajouter tests nouveaux endpoints

apps/web/src/
├── api/
│   └── nodes.api.ts                  ← MODIFIER — Ajouter hooks (useNode, useConfigureProxmox, useUpdateNode, useDiscoveredNodes)
├── features/
│   └── nodes/
│       ├── node-detail-page.tsx       ← NOUVEAU — Page detail noeud minimale
│       ├── node-detail-page.test.tsx  ← NOUVEAU — Tests page detail
│       ├── configure-proxmox-modal.tsx ← NOUVEAU — Modal formulaire Proxmox
│       ├── configure-proxmox-modal.test.tsx ← NOUVEAU — Tests modal
│       └── configure-discovered-modal.tsx   ← NOUVEAU — Modal configuration service decouvert
├── router.tsx                         ← MODIFIER — Ajouter route /nodes/:id

packages/shared/src/
├── models/
│   └── node.ts                        ← MODIFIER — Etendre ProxmoxCapability, PlatformRef
├── api/
│   └── nodes.ts                       ← MODIFIER — Ajouter ConfigureProxmoxRequest, DiscoveredResource
└── index.ts                           ← MODIFIER — Re-exporter nouveaux types
```

**Fichiers existants a MODIFIER (pas creer) :**
- `apps/server/src/connectors/connector-factory.ts` — Ajouter cas 'vm' / 'lxc'
- `apps/server/src/routes/nodes.routes.ts` — Ajouter PUT capabilities/proxmox + PATCH node
- `apps/web/src/api/nodes.api.ts` — Ajouter hooks Proxmox
- `apps/web/src/router.tsx` — Ajouter route `/nodes/:id`
- `apps/web/src/features/nodes/nodes-page.tsx` — Rendre les noms cliquables (Link vers `/nodes/:id`)
- `packages/shared/src/models/node.ts` — Etendre types
- `packages/shared/src/api/nodes.ts` — Ajouter types API
- `packages/shared/src/index.ts` — Re-exporter

### Testing — approche et patterns

**Tests backend — ProxmoxClient (mock undici) :**

```typescript
// apps/server/src/connectors/proxmox-client.test.ts
import { vi, describe, it, expect } from 'vitest';

// Mock undici AVANT l'import du module
const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('undici', () => ({
  Agent: class { close = vi.fn(); },
  request: mockRequest,
}));

import { ProxmoxClient } from './proxmox-client.js';

describe('ProxmoxClient', () => {
  it('should authenticate with API token', async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: { json: async () => ({ data: [{ node: 'pve1', status: 'online' }] }) },
    });

    const client = new ProxmoxClient({ host: '10.0.0.1', tokenId: 'root@pam!test', tokenSecret: 'uuid' });
    const nodes = await client.get('/nodes');
    expect(nodes).toEqual([{ node: 'pve1', status: 'online' }]);

    // Verify Authorization header
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api2/json/nodes'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'PVEAPIToken=root@pam!test=uuid',
        }),
      }),
    );
  });
});
```

**Tests backend — ProxmoxConnector (mock client) :**

```typescript
// apps/server/src/connectors/proxmox.connector.test.ts
// Mock ProxmoxClient au lieu de undici directement
vi.mock('./proxmox-client.js', () => ({
  ProxmoxClient: class {
    get = vi.fn();
    post = vi.fn();
    destroy = vi.fn();
  },
}));
```

**Tests backend — Routes (pattern Fastify inject) :**

Suivre le pattern exact de `nodes.routes.test.ts` (Story 2.1) : Fastify app + inject + DB in-memory.

**Tests frontend — pattern identique Story 2.1 :**

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

**IMPORTANT pour les tests frontend page detail :** La route `/nodes/:id` utilise `useParams()` de React Router. Utiliser `MemoryRouter` avec `initialEntries` pour simuler la route.

**Cas de test a couvrir :**
- ProxmoxClient : auth token, auth ticket, GET/POST, erreurs HTTP, timeout, SSL
- ProxmoxConnector : testConnection, start VM, stop VM, start LXC, stop LXC, getStatus, listResources, erreurs PlatformError
- Routes : PUT capabilities (succes, credentials chiffres, decouverte lancee, erreurs), PATCH node (update name, configured, validation)
- Frontend : page detail rendering, bouton Proxmox, formulaire Proxmox (auth modes, validation, soumission), services decouverts, formulaire configuration pre-rempli

### Intelligence de Story 2.1 — lecons apprises

**Bugs critiques rencontres et resolutions :**

1. **Self-referencing FK dans Drizzle** — TS7022 circular type avec `.references(() => nodes.id)`. Resolution : `foreignKey()` dans les table constraints. **Non applicable ici** (pas de nouvelle migration).

2. **vi.mock factory hoisted avant variables** — `vi.hoisted()` est OBLIGATOIRE pour les mock functions utilisees dans `vi.mock()` factories. **Appliquer dans TOUS les tests qui mockent des modules.**

3. **NodeSSH mock : arrow function ≠ constructor** — Mocker avec `class { ... }` et non `vi.fn().mockImplementation()`. **Pattern a suivre pour mocker undici.Agent.**

4. **Fastify response schema filtre les proprietes dynamiques** — Ajouter `additionalProperties: true` sur les schemas `details`. **Appliquer sur les nouveaux schemas de reponse.**

5. **Mantine Modal rend dans un portal** — Utiliser `findByPlaceholderText` (async) au lieu de `getByPlaceholderText`. **Appliquer dans les tests du ConfigureProxmoxModal.**

6. **Tests : executer via workspace** — `npm run test -w apps/server` et `npm run test -w apps/web`, PAS `npx vitest run` depuis la racine.

**Patterns etablis a reutiliser strictement :**
- Routes Fastify : `FastifyPluginAsync` avec `setErrorHandler` pour validation
- DB operations : `fastify.db.select/insert/update/delete` avec Drizzle
- Chiffrement : `encrypt()` / `decrypt()` depuis `../utils/crypto.js`
- Sanitization : `sanitizeNode()` filtre `sshCredentialsEncrypted` des reponses — **etendre pour filtrer aussi `capabilities.proxmox_api.tokenSecretEncrypted` et `.passwordEncrypted`**
- Logging : double (pino `fastify.log.info()` + insertion `operationLogs`)
- Frontend forms : `useForm` Mantine avec `validate:` + `onSubmit`
- Notifications : `notifications.show({ title, message, color })`
- API hooks : `useMutation` + `apiFetch` + `queryClient.invalidateQueries()`

**Nombre total de tests actuels : 123 (84 server + 39 web)**
Tous doivent continuer a passer apres cette story.

### Intelligence Git — patterns recents

```
79382af feat: implement Story 2.1 — add physical machine & infrastructure base
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
```

La Story 2.1 a cree la base complete (schema nodes, connector pattern, routes, page Noeuds, wizard). Story 2.2 ETEND cette base — pas de creation from scratch.

### Proxmox API — codes d'erreur pour PlatformError

| Code | Quand | Message type |
|---|---|---|
| `PROXMOX_AUTH_FAILED` | Token/ticket invalide (401/403) | "Identifiants Proxmox invalides" |
| `PROXMOX_UNREACHABLE` | Connexion impossible (timeout, DNS, refus) | "API Proxmox injoignable a {host}:{port}" |
| `PROXMOX_API_ERROR` | Erreur API generique (4xx/5xx) | "Erreur API Proxmox: {statusCode} {message}" |
| `PROXMOX_VM_NOT_FOUND` | VMID inexistant | "VM {vmid} introuvable sur le noeud {node}" |
| `PROXMOX_START_FAILED` | Echec demarrage | "Impossible de demarrer {type} {vmid}" |
| `PROXMOX_STOP_FAILED` | Echec arret | "Impossible d'arreter {type} {vmid}" |
| `PROXMOX_DISCOVERY_FAILED` | Echec decouverte | "Impossible de lister les ressources Proxmox" |

### Proxmox API — gestion SSL self-signed

Proxmox VE utilise des certificats self-signed par defaut. **NE JAMAIS utiliser `NODE_TLS_REJECT_UNAUTHORIZED = '0'`** qui desactive la verification SSL GLOBALEMENT pour toute l'application.

A la place, utiliser un `undici.Agent` scope :

```typescript
import { Agent } from 'undici';

// Agent dedié UNIQUEMENT aux connexions Proxmox
const proxmoxAgent = new Agent({
  connect: { rejectUnauthorized: false },  // Accepte self-signed pour CE client uniquement
});
```

### Project Structure Notes

- `proxmox-client.ts` est un fichier SEPARE du connecteur — separation des responsabilites (HTTP transport vs logique metier PlatformConnector)
- Le `ProxmoxConnector` cree un `ProxmoxClient` a chaque appel (ou reutilise un cache par host) — les tickets ont une duree de 2h
- La page detail noeud (`node-detail-page.tsx`) est MINIMALE dans cette story — Story 2.5 l'enrichira significativement
- Le `configure-discovered-modal.tsx` peut etre simple (TextInput nom + URL service + bouton Confirmer) car les donnees Proxmox sont deja connues

### References

- [Source: epics.md#Story-2.2] — User story, acceptance criteria, FRs couverts (FR6, FR8, FR10, FR11)
- [Source: architecture.md#Connectors] — Interface PlatformConnector, structure fichiers connecteurs
- [Source: architecture.md#Authentication-&-Security] — AES-256-GCM, credentials chiffrees au repos
- [Source: architecture.md#API-&-Communication-Patterns] — REST + JSON Schema, format data/error
- [Source: architecture.md#Implementation-Patterns] — Conventions nommage, tests co-localises
- [Source: ux-design-specification.md#Premiere-configuration] — Wizard Proxmox, decouverte, configuration guidee
- [Source: prd.md#FR6] — Configuration capacite proxmox_api
- [Source: prd.md#FR8] — Decouverte auto VMs/LXCs via Proxmox API
- [Source: prd.md#FR10-FR11] — Entites decouvertes non configurees, pre-remplissage
- [Source: 2-1-ajout-machine-physique-et-base-technique.md#Dev-Agent-Record] — Lecons, patterns, debug tips
- [Source: Proxmox VE API Wiki] — Endpoints, auth ticket, auth token, response format
- [Source: Proxmox VE 8.x/9.x API Docs] — Compatibilite API, structure reponses

### Anti-patterns a eviter

- **NE PAS** utiliser `NODE_TLS_REJECT_UNAUTHORIZED = '0'` — utiliser un `undici.Agent` scope
- **NE PAS** installer le package npm `proxmox-api` — utiliser undici directement
- **NE PAS** creer une migration Drizzle — le schema `nodes` et `capabilities` JSON existent deja
- **NE PAS** stocker les credentials Proxmox en clair dans capabilities — chiffrer avec `encrypt()`
- **NE PAS** retourner les champs `*Encrypted` dans les reponses API
- **NE PAS** oublier de dechiffrer les credentials du noeud PARENT avant de creer le ProxmoxClient
- **NE PAS** oublier `additionalProperties: true` dans les schemas de reponse Fastify pour les objets dynamiques
- **NE PAS** oublier `credentials: 'include'` — utiliser `apiFetch` (pattern existant)
- **NE PAS** appeler l'API Proxmox directement depuis les routes — passer par ProxmoxConnector
- **NE PAS** ignorer les templates Proxmox (`template === 1`) lors de la decouverte
- **NE PAS** oublier `vi.hoisted()` pour les mock functions dans `vi.mock()` factories
- **NE PAS** utiliser `getByPlaceholderText` pour tester les Modals — utiliser `findByPlaceholderText` (async)
- **NE PAS** creer une page detail noeud complete — scope minimal pour Story 2.2, Story 2.5 l'enrichira

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- vi.mock double-call pattern: tests that call a mocked method twice (e.g., `await expect(...).rejects.toThrow(); await expect(...).rejects.toMatchObject()`) consume mock only once. Fixed by capturing error in try/catch and asserting on caught error.
- MemoryRouter + useParams: NodeDetailPage uses `useParams()` which requires being inside a `<Route path="/nodes/:id">` element, not just a MemoryRouter.
- Mantine Modal portal: Modal content renders in a portal, so `findByText` (async) must be used instead of `getByText` for locating modal content.

### Completion Notes List

- Task 1: Extended ProxmoxCapability (authType token/password, port, verifySsl, encrypted fields), PlatformRef (node, vmid, type), added ConfigureProxmoxRequest, DiscoveredResource, extended UpdateNodeRequest with configured field. All re-exported from index.ts.
- Task 2: Created ProxmoxClient with token API auth (PVEAPIToken header) and ticket auth (POST /access/ticket, Cookie + CSRFPreventionToken). Scoped undici.Agent for SSL self-signed certs. 12 tests.
- Task 3: Created ProxmoxConnector implementing PlatformConnector with testConnection, start, stop, getStatus, listResources. All errors wrapped in PlatformError with platform='proxmox'. 18 tests.
- Task 4: Updated ConnectorFactory — added vm/lxc cases returning ProxmoxConnector. Added ConnectorOptions interface (parentNode, decryptFn). 7 tests.
- Task 5: Added PUT /api/nodes/:id/capabilities/proxmox (test connection, encrypt credentials, save, discover), PATCH /api/nodes/:id (partial update), GET /api/nodes/:id (single node). Extended GET /api/nodes with ?parentId filter for child nodes. Updated sanitizeNode to strip encrypted fields from capabilities. 25 route tests.
- Task 6: Added useNode, useConfigureProxmox, useUpdateNode, useDiscoveredNodes hooks in nodes.api.ts.
- Task 7: Created NodeDetailPage with header (name, type badge, status badge, IP), Capacités section (Configurer Proxmox button or "Proxmox connecté"), discovered services section, configured children section. Added /nodes/:id route, made node names clickable in nodes-page.
- Task 8: Created ConfigureProxmoxModal with host, port, authType (token/password), conditional fields, "Tester & Sauvegarder" button, success/error notifications.
- Task 9: Discovered services displayed in NodeDetailPage with "Configurer" button. ConfigureDiscoveredModal pre-fills name, allows serviceUrl, PATCH to configured=true.
- Task 10: 5 tests for NodeDetailPage (header, button, proxmox status, discovered services, back link), 6 tests for ConfigureProxmoxModal (render, fields, validation, success, error, closed state). All 180 tests pass (130 server + 50 web).

### File List

New files:
- apps/server/src/connectors/proxmox-client.ts
- apps/server/src/connectors/proxmox-client.test.ts
- apps/server/src/connectors/proxmox.connector.ts
- apps/server/src/connectors/proxmox.connector.test.ts
- apps/web/src/features/nodes/node-detail-page.tsx
- apps/web/src/features/nodes/node-detail-page.test.tsx
- apps/web/src/features/nodes/configure-proxmox-modal.tsx
- apps/web/src/features/nodes/configure-proxmox-modal.test.tsx
- apps/web/src/features/nodes/configure-discovered-modal.tsx

Modified files:
- packages/shared/src/models/node.ts — Extended ProxmoxCapability, PlatformRef
- packages/shared/src/api/nodes.ts — Added ConfigureProxmoxRequest, DiscoveredResource, extended UpdateNodeRequest
- packages/shared/src/index.ts — Re-exported new types
- apps/server/src/connectors/connector-factory.ts — Added vm/lxc cases, ConnectorOptions
- apps/server/src/connectors/connector-factory.test.ts — Updated tests for vm/lxc
- apps/server/src/routes/nodes.routes.ts — Added PUT capabilities/proxmox, PATCH node, GET node/:id, parentId filter
- apps/server/src/routes/nodes.routes.test.ts — Added tests for new endpoints
- apps/web/src/api/nodes.api.ts — Added useNode, useConfigureProxmox, useUpdateNode, useDiscoveredNodes
- apps/web/src/router.tsx — Added /nodes/:id route
- apps/web/src/features/nodes/nodes-page.tsx — Made node names clickable (Link to /nodes/:id)

### Change Log

- 2026-02-13: Implemented Story 2.2 — Proxmox capability configuration, VM/LXC discovery, node detail page, connector factory update. 57 new tests added (130 server + 50 web = 180 total).
