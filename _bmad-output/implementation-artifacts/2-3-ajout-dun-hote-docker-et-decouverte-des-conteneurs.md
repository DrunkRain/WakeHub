# Story 2.3 : Ajout d'un hote Docker & decouverte des conteneurs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want connecter un hote Docker a WakeHub et selectionner les conteneurs a gerer,
So that WakeHub peut controler mes conteneurs Docker.

## Acceptance Criteria (BDD)

1. **Given** le wizard d'ajout est ouvert
   **When** je selectionne "Hote Docker"
   **Then** l'etape 2 affiche un formulaire avec : nom, URL de l'API Docker (ex: `http://192.168.1.10:2375` ou `https://192.168.1.10:2376`)

2. **Given** je remplis le formulaire Docker avec des donnees valides
   **When** je passe a l'etape suivante
   **Then** un test de connexion a l'API Docker est lance
   **And** le bouton passe en etat loading pendant le test
   **And** le resultat s'affiche (succes ou echec)

3. **Given** la connexion a l'API Docker reussit
   **When** l'etape de decouverte s'affiche
   **Then** WakeHub liste tous les conteneurs disponibles sur l'hote avec leur nom, image et statut actuel
   **And** l'utilisateur peut selectionner les conteneurs qu'il souhaite ajouter a WakeHub

4. **Given** j'ai selectionne un ou plusieurs conteneurs
   **When** je confirme l'ajout
   **Then** l'hote Docker est enregistre en base (table `machines`, type=docker) avec son URL
   **And** les conteneurs selectionnes sont enregistres en base (table `resources`, type=container) avec leur reference Docker (containerId, nom)
   **And** un toast de succes s'affiche
   **And** l'operation est enregistree dans les logs

5. **Given** le connecteur Docker est implemente
   **When** il est utilise
   **Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Docker
   **And** les erreurs API Docker sont encapsulees dans `PlatformError`

6. **Given** l'hote Docker est injoignable
   **When** le test de connexion s'execute
   **Then** un message d'erreur clair s'affiche avec le type d'erreur (timeout, connexion refusee, etc.)

## Tasks / Subtasks

- [x] Task 1 — Adapter `DiscoveredResource.platformRef` pour Docker (AC: #4, #5)
  - [x] 1.1 Modifier le type `platformRef` dans `connector.interface.ts` pour accepter un format generique (`Record<string, unknown>` ou union type)
  - [x] 1.2 Adapter `DiscoveredResource` pour que Docker puisse retourner `{ containerId: string; image: string }`
  - [x] 1.3 Mettre a jour les schemas JSON Fastify dans `resources.routes.ts` pour accepter le format Docker (platformRef plus generique)
  - [x] 1.4 Mettre a jour le body schema de `POST /api/machines/:id/resources` pour accepter `{ containerId, image }` en plus de `{ node, vmid }`

- [x] Task 2 — Connecteur Docker (AC: #5, #6)
  - [x] 2.1 Creer `apps/server/src/connectors/docker.connector.ts` implementant `PlatformConnector`
  - [x] 2.2 Implementer `fetchDocker()` helper interne (HTTP GET/POST vers l'API Docker Engine)
  - [x] 2.3 Implementer `testConnection()` : `GET /_ping` + `GET /version` pour verifier la connectivite et la version API
  - [x] 2.4 Implementer `listResources()` : `GET /containers/json?all=true` → lister tous les conteneurs
  - [x] 2.5 Implementer `start(resourceRef)` : `POST /containers/{id}/start` (204 = ok, 304 = deja demarre)
  - [x] 2.6 Implementer `stop(resourceRef)` : `POST /containers/{id}/stop` (204 = ok, 304 = deja arrete)
  - [x] 2.7 Implementer `getStatus(resourceRef)` : `GET /containers/{id}/json` → mapper l'etat Docker vers WakeHub
  - [x] 2.8 Creer `apps/server/src/connectors/docker.connector.test.ts`

- [x] Task 3 — Mise a jour route test-connection pour Docker (AC: #2)
  - [x] 3.1 Ajouter `'docker'` dans l'enum `type` du schema body de `POST /api/machines/test-connection`
  - [x] 3.2 Ajouter la branche Docker dans le handler : instancier `DockerConnector` avec l'`apiUrl`
  - [x] 3.3 Mettre a jour les tests existants de `machines.routes.test.ts`

- [x] Task 4 — Routes decouverte Docker (AC: #3, #4)
  - [x] 4.1 Ajouter `POST /api/docker/discover` — decouverte stateless (wizard, avant creation machine)
  - [x] 4.2 Modifier `POST /api/machines/:id/discover` pour supporter `type=docker` en plus de `type=proxmox`
  - [x] 4.3 Ajouter la validation JSON Schema Fastify pour les nouvelles routes/variantes
  - [x] 4.4 Logger chaque operation dans `operation_logs`
  - [x] 4.5 Ajouter les tests dans `resources.routes.test.ts`

- [x] Task 5 — Types partages (AC: #4, #5)
  - [x] 5.1 Ajouter les types `DockerPlatformRef`, `DockerContainerInfo` dans `packages/shared/src/index.ts`

- [x] Task 6 — API hooks frontend (AC: #1-4)
  - [x] 6.1 Ajouter `useDiscoverDockerContainers()` dans `apps/web/src/api/resources.api.ts` — mutation POST /api/docker/discover
  - [x] 6.2 Le hook `useTestConnection()` existant fonctionne deja (accepte `type: 'docker'`), verifier qu'il passe l'`apiUrl`

- [x] Task 7 — Wizard Docker frontend (AC: #1, #2, #3, #4)
  - [x] 7.1 Activer le type Docker dans `machine-wizard.tsx` (`disabled: false`)
  - [x] 7.2 Ajouter les champs formulaire Docker en etape 2 (nom, apiUrl)
  - [x] 7.3 Adapter l'etape 3 (test connexion) pour utiliser le test connexion Docker
  - [x] 7.4 Ajouter l'etape 4 : Decouverte et selection des conteneurs (checkbox list avec nom, image, statut)
  - [x] 7.5 Implementer `handleCreateDocker()` : creation machine + sauvegarde resources selectionnees
  - [x] 7.6 Toast notification succes/erreur apres creation

- [x] Task 8 — Affichage des conteneurs dans la page Machines (AC: #4)
  - [x] 8.1 Modifier `machines-page.tsx` pour afficher les resources sous chaque machine Docker
  - [x] 8.2 Modifier `machine-detail-page.tsx` pour afficher la section conteneurs Docker (comme pour Proxmox VMs)

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **troisieme de l'Epic 2** et introduit le deuxieme connecteur API externe (Docker Engine). Elle suit exactement le pattern de la story 2.2 (Proxmox). Les fondations sont deja en place :
- La table `resources` existe deja (story 2.2) avec `type: 'container'` dans l'enum
- La table `machines` a deja `type: 'docker'` dans l'enum
- Les routes de resources existent deja — il faut les etendre pour Docker
- Le wizard frontend a le type Docker declare mais `disabled: true`
- Le pattern decouverte (test connexion → liste → selection → sauvegarde) est etabli

**Le seul changement structurel** est l'adaptation de `DiscoveredResource.platformRef` pour supporter le format Docker en plus du format Proxmox.

**Ordre d'implementation recommande :** Tasks 1 → 5 → 2 → 3 → 4 → 6 → 7 → 8

### Exigences techniques detaillees

**Adaptation `DiscoveredResource.platformRef` (Task 1) :**

Le type actuel est specifique Proxmox : `{ node: string; vmid: number }`. Docker a besoin de `{ containerId: string; image: string }`. Le champ `platform_ref` en DB est deja un `text` avec `mode: 'json'`, donc le stockage est flexible.

```typescript
// Dans apps/server/src/connectors/connector.interface.ts
// AVANT :
export interface DiscoveredResource {
  platformRef: { node: string; vmid: number };
  // ...
}

// APRES :
export interface DiscoveredResource {
  platformRef: Record<string, unknown>;  // Generique : { node, vmid } OU { containerId, image }
  // ...
}
```

Les schemas JSON Fastify dans `resources.routes.ts` doivent aussi etre mis a jour pour accepter les deux formats (`platformRef` en `type: 'object'` sans `required` specifique, ou avec `additionalProperties: true`).

**Configuration Docker Connector :**
```typescript
// Dans apps/server/src/connectors/docker.connector.ts
export interface DockerConfig {
  apiUrl: string;       // Ex: "http://192.168.1.10:2375" ou "https://192.168.1.10:2376"
  resourceRef?: { containerId: string };  // Pour start/stop/getStatus d'un conteneur specifique
}
```

**Connexion a l'API Docker Engine :**

L'API Docker est une API REST standard sur HTTP. Deux modes :
- **Port 2375** — TCP sans TLS (configuration commune en homelab)
- **Port 2376** — TCP avec TLS mutuel (certificats client + serveur)

Pour le MVP, supporter uniquement le mode **HTTP sans TLS** (port 2375). Le TLS mutuel est complexe (3 fichiers PEM a stocker) et rarement configure en homelab. Si besoin ulterieur, il pourra etre ajoute dans une story dediee.

**Methode `fetchDocker()` interne :**
```typescript
private async fetchDocker(
  path: string,
  options: { method?: string } = {},
): Promise<unknown> {
  const url = `${this.config.apiUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
    });
  } catch (err) {
    throw new PlatformError(
      'DOCKER_NETWORK_ERROR',
      `Impossible de contacter l'hote Docker : ${(err as Error).message}`,
      'docker',
      { url },
    );
  }

  // Docker retourne 204 pour start/stop reussi, 304 pour deja dans l'etat
  if (response.status === 204 || response.status === 304) {
    return null;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new PlatformError(
      `DOCKER_HTTP_${response.status}`,
      `Erreur Docker ${response.status} : ${body.message ?? response.statusText}`,
      'docker',
      { status: response.status, url, body },
    );
  }

  return response.json();
}
```

**Endpoints Docker Engine utilises :**

| Endpoint | Methode | Usage | Reponse |
|----------|---------|-------|---------|
| `/_ping` | GET | Test connectivite rapide | `"OK"` (text/plain) |
| `/version` | GET | Version API et compatibilite | JSON `{ Version, ApiVersion }` |
| `/containers/json?all=true` | GET | Lister tous les conteneurs | JSON array |
| `/containers/{id}/json` | GET | Inspecter un conteneur | JSON object avec `State.Status` |
| `/containers/{id}/start` | POST | Demarrer un conteneur | 204 (ok), 304 (deja demarre), 404 |
| `/containers/{id}/stop` | POST | Arreter un conteneur | 204 (ok), 304 (deja arrete), 404 |

**Reponse Docker `GET /containers/json` :**
```json
[
  {
    "Id": "ae63e8b89a26f01f6b4b2c9a7817c31a...",
    "Names": ["/jellyfin"],
    "Image": "jellyfin/jellyfin:latest",
    "State": "running",
    "Status": "Up 5 minutes",
    "Ports": [{"IP": "0.0.0.0", "PrivatePort": 8096, "PublicPort": 8096, "Type": "tcp"}]
  }
]
```

**Mapping `listResources()` Docker → `DiscoveredResource` :**
```typescript
async listResources(): Promise<DiscoveredResource[]> {
  const containers = await this.fetchDocker('/containers/json?all=true') as DockerContainer[];
  return containers.map((c) => ({
    name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
    type: 'container' as const,
    platformRef: { containerId: c.Id, image: c.Image },
    status: mapDockerStatus(c.State),
  }));
}
```

**Mapping statut Docker → WakeHub :**

| Docker State | WakeHub status |
|-------------|---------------|
| `running` | `running` |
| `exited` | `stopped` |
| `created` | `stopped` |
| `paused` | `paused` |
| `restarting` | `running` |
| `removing` | `stopped` |
| `dead` | `error` |
| autre | `unknown` |

**Methode `testConnection()` :**
```typescript
async testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Etape 1: Ping rapide
    const pingUrl = `${this.config.apiUrl}/_ping`;
    const pingResp = await fetch(pingUrl);
    if (!pingResp.ok) {
      return { success: false, message: `Docker API non disponible (${pingResp.status})` };
    }

    // Etape 2: Recuperer la version pour info
    const version = await this.fetchDocker('/version') as { Version: string; ApiVersion: string };
    return {
      success: true,
      message: `Connexion Docker reussie (v${version.Version}, API v${version.ApiVersion})`,
    };
  } catch (err) {
    if (err instanceof PlatformError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: `Erreur inattendue : ${(err as Error).message}` };
  }
}
```

**Methodes `start()` et `stop()` — gerer les codes 204 et 304 :**
```typescript
async start(): Promise<void> {
  const ref = this.config.resourceRef;
  if (!ref) throw new PlatformError('DOCKER_NO_REF', 'resourceRef requis pour start', 'docker');
  await this.fetchDocker(`/containers/${ref.containerId}/start`, { method: 'POST' });
  // 204 = demarre, 304 = deja running — les deux sont OK
}

async stop(): Promise<void> {
  const ref = this.config.resourceRef;
  if (!ref) throw new PlatformError('DOCKER_NO_REF', 'resourceRef requis pour stop', 'docker');
  await this.fetchDocker(`/containers/${ref.containerId}/stop`, { method: 'POST' });
}
```

**Methode `getStatus()` :**
```typescript
async getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'> {
  const ref = this.config.resourceRef;
  if (!ref) return 'unknown';
  try {
    const data = await this.fetchDocker(`/containers/${ref.containerId}/json`) as {
      State: { Status: string };
    };
    const s = mapDockerStatus(data.State.Status);
    if (s === 'running') return 'online';
    if (s === 'stopped' || s === 'paused') return 'offline';
    return 'unknown';
  } catch {
    return 'error';
  }
}
```

### Conformite architecture obligatoire

**Conventions de nommage (ARCH-17) :**
- DB : deja en place (`machine_id`, `platform_ref`, etc.)
- API JSON : `camelCase` — `containerId`, `apiUrl`
- Fichiers : `kebab-case` — `docker.connector.ts`
- Types/Interfaces : `PascalCase` — `DockerConnector`, `DockerConfig`, `DockerPlatformRef`
- Constantes : `SCREAMING_SNAKE` — `DOCKER_API_TIMEOUT_MS`

**Organisation backend par domaine (ARCH-18) :**
- Connecteur dans `connectors/` — `docker.connector.ts`
- Routes dans `routes/` — modifier `resources.routes.ts` et `machines.routes.ts` existants
- Schema dans `db/` — aucune modification (table `resources` existe deja)

**Format API normalise (ARCH-11) :**
- Succes : `{ data: { ... } }`
- Erreur : `{ error: { code, message, details? } }`

**Validation JSON Schema Fastify (ARCH-04) :**
- OBLIGATOIRE sur toutes les routes : `schema.body` + `schema.response` pour TOUS les status codes retournes (200, 400, 401, 404)

**Chiffrement credentials (ARCH-13, NFR5) :**
- Docker en mode HTTP sans TLS (port 2375) n'a **pas de credentials a chiffrer** — l'`apiUrl` est stockee en clair dans `machines.api_url`
- NE PAS stocker de credentials factices dans `api_credentials_encrypted` pour Docker simple

**Logging (ARCH-09) :**
- Double destination : pino stdout + insert `operation_logs`
- Logger : creation machine Docker, test connexion, decouverte conteneurs, enregistrement resources
- NE PAS logger les credentials en clair

**Tests co-localises (ARCH-15) :**
- `docker.connector.ts` → `docker.connector.test.ts`

### Librairies et frameworks requis

**Aucune nouvelle dependance** — l'API Docker Engine est appelee via `fetch` natif Node.js. Pas besoin de `undici` car Docker utilise HTTP standard (pas de certificats auto-signes a contourner en mode 2375).

**Librairies existantes utilisees (ne pas reinstaller) :**

| Package | Deja dans | Usage dans cette story |
|---------|-----------|----------------------|
| `drizzle-orm` | apps/server | Requetes CRUD resources |
| `better-sqlite3` | apps/server | Driver SQLite |
| `@mantine/core` | apps/web | Stepper, TextInput, Checkbox, Card |
| `@mantine/form` | apps/web | useForm pour validation wizard |
| `@mantine/notifications` | apps/web | Toast succes/erreur |
| `@tanstack/react-query` | apps/web | Hooks mutations/queries |

### Structure de fichiers

**Fichiers a CREER :**

```
apps/server/src/
└── connectors/
    ├── docker.connector.ts              ← Connecteur API Docker Engine
    └── docker.connector.test.ts         ← Tests connecteur (mocks fetch)
```

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/connectors/connector.interface.ts` | `platformRef` → `Record<string, unknown>` (generique au lieu de Proxmox-specifique) |
| `apps/server/src/routes/machines.routes.ts` | Ajouter `'docker'` dans l'enum type du test-connection + branche DockerConnector |
| `apps/server/src/routes/resources.routes.ts` | Ajouter `POST /api/docker/discover` + supporter type=docker dans discover par machine + adapter schemas platformRef |
| `apps/web/src/features/machines/machine-wizard.tsx` | Activer Docker + formulaire + etape decouverte conteneurs + handleCreateDocker() |
| `apps/web/src/features/machines/machine-detail-page.tsx` | Afficher section conteneurs Docker (meme pattern que Proxmox VMs) |
| `apps/web/src/api/resources.api.ts` | Ajouter `useDiscoverDockerContainers()` hook |
| `packages/shared/src/index.ts` | Ajouter types `DockerPlatformRef` |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/connectors/wol-ssh.connector.ts` — aucun changement
- `apps/server/src/connectors/proxmox.connector.ts` — aucun changement (le type `platformRef` generique est backward-compatible)
- `apps/server/src/db/schema.ts` — aucune migration necessaire (table `resources` existe, Docker dans l'enum `machines.type`)
- `apps/server/src/middleware/auth.middleware.ts` — deja fonctionnel
- `apps/server/src/utils/crypto.ts` — deja fonctionnel
- `apps/server/src/utils/platform-error.ts` — deja fonctionnel

### Exigences de tests

**Framework :** Vitest (deja configure)
**Commande :** `npm run test` a la racine ou `npm run test -w @wakehub/server`

**Tests backend obligatoires :**

**1. `apps/server/src/connectors/docker.connector.test.ts` :**
- Mocker `fetch` globalement avec `vi.stubGlobal('fetch', mockFetch)` — NE PAS appeler l'API Docker reelle
- `testConnection()` retourne `{ success: true }` quand `/_ping` retourne "OK" et `/version` retourne un JSON valide
- `testConnection()` retourne `{ success: false }` quand l'hote est injoignable (timeout/network error)
- `testConnection()` retourne `{ success: false }` quand `/_ping` retourne un code non-200
- `listResources()` retourne la liste des conteneurs avec nom (sans `/` prefix), image, statut
- `listResources()` mappe correctement tous les etats Docker (running→running, exited→stopped, paused→paused, dead→error)
- `start()` appelle POST /containers/{id}/start
- `start()` ne leve pas d'erreur sur 304 (deja demarre)
- `start()` lance `PlatformError` si 404 (conteneur introuvable)
- `stop()` appelle POST /containers/{id}/stop
- `stop()` ne leve pas d'erreur sur 304 (deja arrete)
- `getStatus()` retourne 'online' pour un conteneur running
- `getStatus()` retourne 'offline' pour un conteneur exited
- `getStatus()` retourne 'error' quand le fetch echoue
- Toutes les erreurs sont des instances de `PlatformError` avec `platform: 'docker'`

**2. Tests dans `resources.routes.test.ts` (ajouter) :**
- `POST /api/docker/discover` avec apiUrl valide → retourne liste des conteneurs → status 200
- `POST /api/docker/discover` sans apiUrl → status 400
- `POST /api/machines/:id/discover` avec machine type=docker → retourne liste des conteneurs → status 200
- `POST /api/machines/:id/resources` avec resources type=container et platformRef Docker → status 200

**3. Tests dans `machines.routes.test.ts` (ajouter) :**
- `POST /api/machines/test-connection` avec type=docker et apiUrl → retourne resultat test
- `POST /api/machines/test-connection` avec type=docker sans apiUrl → status 400

**Pattern de mock pour fetch Docker :**
```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Docker /_ping
mockFetch.mockResolvedValueOnce({
  ok: true,
  text: async () => 'OK',
});

// Mock Docker /version
mockFetch.mockResolvedValueOnce({
  ok: true,
  status: 200,
  json: async () => ({
    Version: '27.5.1',
    ApiVersion: '1.47',
  }),
});

// Mock Docker /containers/json
mockFetch.mockResolvedValueOnce({
  ok: true,
  status: 200,
  json: async () => ([
    {
      Id: 'abc123def456',
      Names: ['/jellyfin'],
      Image: 'jellyfin/jellyfin:latest',
      State: 'running',
      Status: 'Up 5 minutes',
      Ports: [{ IP: '0.0.0.0', PrivatePort: 8096, PublicPort: 8096, Type: 'tcp' }],
    },
    {
      Id: 'xyz789ghi012',
      Names: ['/nextcloud'],
      Image: 'nextcloud:latest',
      State: 'exited',
      Status: 'Exited (0) 3 hours ago',
      Ports: [],
    },
  ]),
});
```

### Intelligence de la story precedente (2.2)

**Patterns etablis par la story 2.2 (Proxmox) a reutiliser :**

1. **Pattern connecteur** : constructeur avec config, methodes PlatformConnector, `fetchX()` interne pour les appels API, toutes erreurs → `PlatformError` avec platform specifique
2. **Pattern decouverte** : route stateless (wizard) + route par machine (re-decouverte) — reproduire le meme pattern pour Docker
3. **Pattern wizard frontend** : Stepper Mantine 4 etapes (type → formulaire → test → selection), `handleCreateX()` qui cree la machine + sauvegarde les resources en une operation
4. **Response schemas** : OBLIGATOIRE pour TOUS les status codes retournes (200, 400, 401, 404)
5. **Tests connecteur** : `vi.stubGlobal('fetch', mockFetch)` — simple et efficace pour les APIs HTTP
6. **Tests routes** : `app.inject()` pattern avec DB de test SQLite

**Differences avec Proxmox a noter :**
- Docker n'a **pas d'authentification** en mode HTTP standard (port 2375) — pas de credentials a chiffrer
- Docker retourne **204** pour start/stop reussi (pas de body JSON) vs Proxmox qui retourne 200 avec body
- Docker retourne **304** pour "deja dans l'etat" — a traiter comme succes
- Docker utilise `Names[0]` (avec `/` prefix a retirer) pour le nom du conteneur
- Le `platformRef` Docker est `{ containerId, image }` vs Proxmox `{ node, vmid }`
- Pas besoin de `undici.Agent` (pas de certificats auto-signes en HTTP standard)

### Informations techniques actuelles (recherche web fevrier 2026)

**API Docker Engine :**
- Version API actuelle : v1.53 (Docker Engine 29.x)
- Version minimum recommandee : v1.47 (Docker Engine 27.x) — aucun breaking change sur les endpoints conteneurs depuis
- L'API est REST standard sur HTTP, pas besoin de SDK specifique
- `/_ping` est le check de sante le plus leger (retourne `"OK"` en text/plain)
- `/version` donne `ApiVersion` et `MinAPIVersion` pour verifier la compatibilite
- Les conteneurs ont 7 etats possibles : `created`, `running`, `paused`, `restarting`, `removing`, `exited`, `dead`
- `GET /containers/json?all=true` retourne TOUS les conteneurs (par defaut, seuls les running)
- Les codes 304 sur start/stop signifient "deja dans l'etat demande" — ce n'est PAS une erreur

**Securite Docker API :**
- Port 2375 sans TLS donne un acces root equivalent — l'utilisateur en est responsable
- Pour un homelab en reseau local, c'est la configuration standard
- Le TLS mutuel (port 2376) necessite 3 fichiers PEM cote client — hors scope MVP

**Pas de package npm Docker officiel moderne** — l'API REST est suffisamment simple pour `fetch` natif.

### Anti-patterns a eviter

- NE PAS utiliser le package npm `dockerode` — utiliser `fetch` natif pour garder le controle et minimiser les dependances (meme approche que pour Proxmox)
- NE PAS stocker des credentials fictifs pour Docker en mode HTTP — l'`apiUrl` suffit
- NE PAS hardcoder `NODE_TLS_REJECT_UNAUTHORIZED=0` — si TLS est ajoute plus tard, utiliser `undici.Agent` par requete
- NE PAS creer de dossier `__tests__/` — tests co-localises
- NE PAS utiliser `any` — typage TypeScript strict partout
- NE PAS modifier le schema DB `resources` — il est deja generique (`platform_ref` est JSON text)
- NE PAS modifier `proxmox.connector.ts` — la generalisation de `platformRef` dans l'interface n'affecte pas l'implementation Proxmox

### Project Structure Notes

- Le champ `platform_ref` en DB est `text` avec `mode: 'json'`, donc il accepte n'importe quelle structure JSON
- Pour Docker, `platformRef` stocke `{ containerId: "abc123", image: "jellyfin/jellyfin:latest" }`
- L'`apiUrl` Docker est stockee dans `machines.api_url` (meme champ que Proxmox)
- Pas de `api_credentials_encrypted` pour Docker simple (HTTP sans auth)
- La suppression d'une machine Docker supprime automatiquement ses conteneurs resources (ON DELETE CASCADE)
- Le wizard passe de 3 etapes (physical) a 4 etapes (Docker et Proxmox) : type → formulaire → test → selection conteneurs

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — User story, acceptance criteria, FRs couverts (FR7, FR9, FR10)
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — PlatformConnector, PlatformError, format API
- **Architecture structure** : [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — docker.connector.ts dans connectors/
- **Architecture patterns** : [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Conventions nommage, format API, gestion erreurs
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy] — Wizard Stepper, patterns d'interaction
- **Story precedente (2.2)** : [Source: _bmad-output/implementation-artifacts/2-2-ajout-dun-serveur-proxmox-et-decouverte-des-vms.md] — Patterns connecteur, routes resources, wizard frontend, tests
- **Code existant** : connector.interface.ts, proxmox.connector.ts, resources.routes.ts, machines.routes.ts, machine-wizard.tsx

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
