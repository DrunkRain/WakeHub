# Story 2.2 : Ajout d'un serveur Proxmox & decouverte des VMs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want connecter mon serveur Proxmox a WakeHub et selectionner les VMs a gerer,
So that WakeHub peut controler mes VMs Proxmox.

## Acceptance Criteria (BDD)

1. **Given** la table `resources` n'existe pas encore
   **When** la migration Drizzle s'execute pour cette story
   **Then** la table `resources` est creee avec les colonnes : id, machine_id (FK → machines), name, type (enum: vm, container), platform_ref (JSON: node, vmid pour Proxmox / container_id pour Docker), status, service_url, inactivity_timeout, created_at, updated_at

2. **Given** le wizard d'ajout est ouvert
   **When** je selectionne "Serveur Proxmox"
   **Then** l'etape 2 affiche un formulaire avec : nom, URL de l'API Proxmox, identifiants (utilisateur + mot de passe ou token API)

3. **Given** je remplis le formulaire Proxmox avec des donnees valides
   **When** je passe a l'etape suivante
   **Then** un test de connexion a l'API Proxmox est lance
   **And** le bouton passe en etat loading pendant le test
   **And** le resultat s'affiche (succes ou echec avec message d'erreur de la plateforme)

4. **Given** la connexion a l'API Proxmox reussit
   **When** l'etape de decouverte s'affiche
   **Then** WakeHub liste toutes les VMs disponibles sur le serveur avec leur nom, ID et statut actuel
   **And** l'utilisateur peut selectionner les VMs qu'il souhaite ajouter a WakeHub

5. **Given** j'ai selectionne une ou plusieurs VMs
   **When** je confirme l'ajout
   **Then** le serveur Proxmox est enregistre en base (table `machines`, type=proxmox) avec ses identifiants chiffres (AES-256-GCM)
   **And** les VMs selectionnees sont enregistrees en base (table `resources`, type=vm) avec leur reference Proxmox (node, vmid)
   **And** un toast de succes s'affiche
   **And** l'operation est enregistree dans les logs

6. **Given** le connecteur Proxmox est implemente
   **When** il est utilise
   **Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Proxmox
   **And** les erreurs API Proxmox sont encapsulees dans `PlatformError`

7. **Given** l'URL API Proxmox est invalide ou les identifiants sont faux
   **When** le test de connexion s'execute
   **Then** un message d'erreur clair s'affiche avec le code et la description de l'erreur Proxmox

## Tasks / Subtasks

- [x]Task 1 — Schema DB : table `resources` (AC: #1)
  - [x]1.1 Ajouter la table `resources` dans `apps/server/src/db/schema.ts`
  - [x]1.2 Generer la migration Drizzle (`npx drizzle-kit generate`)
  - [x]1.3 Verifier que la migration s'applique correctement au demarrage

- [x]Task 2 — Connecteur Proxmox (AC: #6, #7)
  - [x]2.1 Ajouter `listResources()` optionnel dans `PlatformConnector` interface
  - [x]2.2 Creer `apps/server/src/connectors/proxmox.connector.ts` implementant `PlatformConnector`
  - [x]2.3 Implementer `testConnection()` : authentification API Proxmox + verification
  - [x]2.4 Implementer `listResources()` : lister les VMs sur tous les nodes
  - [x]2.5 Implementer `start(resourceRef)` : demarrer une VM via l'API Proxmox
  - [x]2.6 Implementer `stop(resourceRef)` : arreter une VM via l'API Proxmox
  - [x]2.7 Implementer `getStatus(resourceRef)` : obtenir le statut d'une VM
  - [x]2.8 Creer `apps/server/src/connectors/proxmox.connector.test.ts`

- [x]Task 3 — Routes API resources + test connexion Proxmox (AC: #3, #5)
  - [x]3.1 Creer `apps/server/src/routes/resources.routes.ts` avec les routes :
    - `POST /api/machines/:id/test-connection` — test de connexion Proxmox API
    - `POST /api/machines/:id/discover` — decouvrir les VMs d'un serveur Proxmox
    - `POST /api/machines/:id/resources` — enregistrer les VMs selectionnees
    - `GET /api/machines/:id/resources` — lister les resources d'une machine
    - `GET /api/resources` — lister toutes les resources
    - `GET /api/resources/:id` — detail d'une resource
  - [x]3.2 Ajouter la validation JSON Schema Fastify sur chaque route (body + response pour TOUS les status codes)
  - [x]3.3 Enregistrer le plugin dans `apps/server/src/app.ts`
  - [x]3.4 Logger chaque operation dans `operation_logs`
  - [x]3.5 Creer `apps/server/src/routes/resources.routes.test.ts`

- [x]Task 4 — Mise a jour route test-connection existante (AC: #3)
  - [x]4.1 Modifier `POST /api/machines/test-connection` pour supporter le type `proxmox` en plus de `physical`
  - [x]4.2 Dispatcher vers le bon connecteur selon le type de machine
  - [x]4.3 Mettre a jour les tests existants

- [x]Task 5 — Types partages (AC: #1, #6)
  - [x]5.1 Ajouter les types Resource, ResourceType, ResourceStatus, ProxmoxPlatformRef dans `packages/shared/src/index.ts`

- [x]Task 6 — API hooks frontend (AC: #2-5)
  - [x]6.1 Creer `apps/web/src/api/resources.api.ts` avec les hooks TanStack Query :
    - `useTestProxmoxConnection()` — mutation POST /api/machines/:id/test-connection
    - `useDiscoverResources(machineId)` — mutation POST /api/machines/:id/discover
    - `useSaveResources(machineId)` — mutation POST /api/machines/:id/resources
    - `useMachineResources(machineId)` — query GET /api/machines/:id/resources

- [x]Task 7 — Wizard Proxmox (AC: #2, #3, #4, #5)
  - [x]7.1 Activer le type Proxmox dans `machine-wizard.tsx` (`disabled: false`)
  - [x]7.2 Ajouter les champs formulaire Proxmox en etape 2 (nom, apiUrl, username, password/tokenId+tokenSecret)
  - [x]7.3 Ajouter l'etape 4 : Decouverte et selection des VMs (checkbox list avec nom, vmid, statut)
  - [x]7.4 Adapter l'etape 3 (test connexion) pour utiliser le test connexion Proxmox
  - [x]7.5 Gerer la sauvegarde : creation machine + resources selectionnees en une seule operation
  - [x]7.6 Toast notification succes/erreur apres creation

- [x]Task 8 — Affichage des resources dans la page Machines (AC: #5)
  - [x]8.1 Modifier `machines-page.tsx` pour afficher les resources sous chaque machine Proxmox
  - [x]8.2 Modifier `machine-detail-page.tsx` pour afficher la section VMs decouvertes

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **deuxieme de l'Epic 2** et introduit le premier connecteur API externe (Proxmox). Elle pose les fondations pour :
- La table `resources` qui sera reutilisee par la story 2.3 (Docker) pour stocker les conteneurs
- Le connecteur Proxmox qui servira de modele pour le connecteur Docker
- La methode `listResources()` ajoutee a l'interface `PlatformConnector` (utilisee aussi par Docker)
- Le pattern de decouverte de resources (test connexion → liste → selection → sauvegarde)

**Ordre d'implementation recommande :** Tasks 1 → 5 → 2 → 3 → 4 → 6 → 7 → 8

### Exigences techniques detaillees

**Schema Drizzle — table `resources` :**
```typescript
// Dans apps/server/src/db/schema.ts
export const resources = sqliteTable('resources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  machineId: text('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['vm', 'container'] }).notNull(),
  platformRef: text('platform_ref').notNull(),  // JSON string: { node, vmid } pour Proxmox, { containerId } pour Docker
  status: text('status', { enum: ['running', 'stopped', 'paused', 'unknown', 'error'] }).notNull().default('unknown'),
  serviceUrl: text('service_url'),
  inactivityTimeout: integer('inactivity_timeout'),  // minutes, null = utiliser defaut global
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

**Extension PlatformConnector :**
```typescript
// Dans apps/server/src/connectors/connector.interface.ts
export interface DiscoveredResource {
  name: string;
  platformRef: string;  // JSON: { node, vmid } ou { containerId }
  status: string;
  type: 'vm' | 'container';
}

export interface PlatformConnector {
  testConnection(): Promise<{ success: boolean; message: string }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'>;
  listResources?(): Promise<DiscoveredResource[]>;  // Optionnel — pas pour WoL/SSH
}
```

**Connecteur Proxmox — config et authentification :**
```typescript
// Dans apps/server/src/connectors/proxmox.connector.ts
interface ProxmoxConfig {
  apiUrl: string;       // Ex: "https://192.168.1.50:8006"
  username: string;     // Ex: "root@pam" ou "apiuser@pve"
  password?: string;    // Authentification par ticket (username+password)
  tokenId?: string;     // Authentification par API token (alternative)
  tokenSecret?: string; // Secret du token API
}
```

**Authentification Proxmox — deux modes :**

1. **Ticket (username + password) :**
   ```typescript
   // POST /api2/json/access/ticket
   // Body: { username: "root@pam", password: "xxx" }
   // Reponse: { data: { ticket: "PVE:root@pam:...", CSRFPreventionToken: "..." } }
   // Utilisation: Cookie PVEAuthCookie=ticket + Header CSRFPreventionToken pour les requetes POST/PUT/DELETE
   ```

2. **API Token (recommande pour les integrations) :**
   ```typescript
   // Header: Authorization: PVEAPIToken=user@realm!tokenid=UUID-secret
   // Pas besoin de CSRFPreventionToken
   // Plus simple, pas d'expiration de ticket
   ```

**Gestion TLS (certificats auto-signes Proxmox) :**
```typescript
import { Agent } from 'undici';

// Creer un agent qui accepte les certificats auto-signes
const tlsAgent = new Agent({
  connect: { rejectUnauthorized: false }
});

// Utiliser dans chaque fetch
const response = await fetch(url, {
  dispatcher: tlsAgent,
  headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` }
});
```

**Endpoints Proxmox utilises :**

| Endpoint | Methode | Usage |
|----------|---------|-------|
| `/api2/json/access/ticket` | POST | Obtenir un ticket d'authentification |
| `/api2/json/nodes` | GET | Lister les nodes du cluster |
| `/api2/json/nodes/{node}/qemu` | GET | Lister les VMs QEMU d'un node |
| `/api2/json/nodes/{node}/qemu/{vmid}/status/current` | GET | Statut d'une VM |
| `/api2/json/nodes/{node}/qemu/{vmid}/status/start` | POST | Demarrer une VM |
| `/api2/json/nodes/{node}/qemu/{vmid}/status/stop` | POST | Arreter une VM |

**Reponse API Proxmox — format :**
```json
// GET /api2/json/nodes/{node}/qemu
{
  "data": [
    {
      "vmid": 100,
      "name": "VM-Media",
      "status": "running",
      "maxmem": 8589934592,
      "maxdisk": 34359738368,
      "cpus": 4,
      "cpu": 0.0234,
      "mem": 2147483648,
      "uptime": 86400,
      "netin": 123456,
      "netout": 654321
    }
  ]
}
```

**Mapping statut Proxmox → WakeHub :**
| Proxmox status | WakeHub status |
|----------------|----------------|
| `running` | `running` |
| `stopped` | `stopped` |
| `paused` | `paused` |
| autre | `unknown` |

### Conformite architecture obligatoire

**Conventions de nommage (ARCH-17) :**
- DB : `snake_case` — `machine_id`, `platform_ref`, `service_url`, `inactivity_timeout`, `created_at`
- API JSON : `camelCase` — `machineId`, `platformRef`, `serviceUrl`, `inactivityTimeout`
- Fichiers : `kebab-case` — `proxmox.connector.ts`, `resources.routes.ts`
- Types/Interfaces : `PascalCase` — `ProxmoxConnector`, `DiscoveredResource`, `ProxmoxPlatformRef`
- Constantes : `SCREAMING_SNAKE` — `PROXMOX_API_TIMEOUT_MS`, `PROXMOX_DEFAULT_PORT`

**Organisation backend par domaine (ARCH-18) :**
- Connecteur dans `connectors/` — `proxmox.connector.ts`
- Routes dans `routes/` — `resources.routes.ts`
- Schema dans `db/` — ajouter a `schema.ts` existant

**Format API normalise (ARCH-11) :**
- Succes : `{ data: { ... } }`
- Erreur : `{ error: { code, message, details? } }`
- NE JAMAIS retourner une reponse sans wrapper `data` ou `error`

**Validation JSON Schema Fastify (ARCH-04) :**
- OBLIGATOIRE sur toutes les routes : `schema.body` + `schema.response` pour TOUS les status codes retournes (200, 400, 401, 404)

**Chiffrement credentials (ARCH-13, NFR5) :**
- Les identifiants Proxmox (password ou tokenSecret) DOIVENT etre chiffres avec AES-256-GCM avant stockage
- Stockes dans `machines.api_credentials_encrypted`
- Format : stocker un JSON chiffre contenant `{ username, password }` ou `{ username, tokenId, tokenSecret }`
- NE JAMAIS retourner les credentials dechiffres dans l'API

**Logging (ARCH-09) :**
- Double destination : pino stdout + insert `operation_logs`
- Logger : creation machine Proxmox, test connexion, decouverte VMs, enregistrement resources
- NE PAS logger les credentials en clair

**Tests co-localises (ARCH-15) :**
- `proxmox.connector.ts` → `proxmox.connector.test.ts`
- `resources.routes.ts` → `resources.routes.test.ts`

**Anti-patterns a eviter :**
- NE PAS utiliser le package npm `proxmox-api` — utiliser `fetch` natif Node.js + `undici.Agent` pour garder le controle et minimiser les dependances
- NE PAS hardcoder `NODE_TLS_REJECT_UNAUTHORIZED=0` — utiliser `undici.Agent({ connect: { rejectUnauthorized: false } })` par requete
- NE PAS creer de dossier `__tests__/` — tests co-localises
- NE PAS utiliser `any` — typage TypeScript strict partout
- NE PAS retourner les credentials dechiffres dans les reponses API

### Librairies et frameworks requis

**Nouvelle dependance a installer (apps/server) :**

| Package | Version | Usage | Commande |
|---------|---------|-------|----------|
| `undici` | ^7.x | Agent TLS pour fetch avec certificats auto-signes Proxmox | `npm install undici -w @wakehub/server` |

**Note :** `undici` est deja le moteur sous-jacent de `fetch` dans Node.js 18+. L'import explicite est necessaire uniquement pour acceder a la classe `Agent` qui permet de configurer `rejectUnauthorized: false` par requete.

**Aucune autre nouvelle dependance** — l'API Proxmox est appelee via `fetch` natif.

**Librairies existantes utilisees (ne pas reinstaller) :**

| Package | Deja dans | Usage dans cette story |
|---------|-----------|----------------------|
| `drizzle-orm` | apps/server | Schema resources + requetes CRUD |
| `better-sqlite3` | apps/server | Driver SQLite |
| `@fastify/cookie` | apps/server | Auth middleware (deja en place) |
| `@mantine/core` | apps/web | Stepper, TextInput, Checkbox, Card |
| `@mantine/form` | apps/web | useForm pour validation wizard |
| `@mantine/notifications` | apps/web | Toast succes/erreur |
| `@tanstack/react-query` | apps/web | Hooks mutations/queries |

### Structure de fichiers

**Fichiers a CREER :**

```
apps/server/src/
├── connectors/
│   ├── proxmox.connector.ts           ← Connecteur API Proxmox
│   └── proxmox.connector.test.ts      ← Tests connecteur (mocks fetch)
└── routes/
    ├── resources.routes.ts            ← Routes CRUD resources + decouverte
    └── resources.routes.test.ts       ← Tests integration routes

apps/web/src/
└── api/
    └── resources.api.ts               ← Hooks TanStack Query resources
```

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/db/schema.ts` | Ajouter export `resources` table |
| `apps/server/src/connectors/connector.interface.ts` | Ajouter `listResources?()` optionnel + type `DiscoveredResource` |
| `apps/server/src/app.ts` | Importer et enregistrer `resourcesRoutes` plugin |
| `apps/server/src/routes/machines.routes.ts` | Modifier test-connection pour supporter type `proxmox` |
| `apps/web/src/features/machines/machine-wizard.tsx` | Activer Proxmox + formulaire + etape decouverte VMs |
| `apps/web/src/features/machines/machines-page.tsx` | Afficher les resources sous chaque machine Proxmox |
| `packages/shared/src/index.ts` | Ajouter types Resource, ResourceType, ResourceStatus, ProxmoxPlatformRef |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/connectors/wol-ssh.connector.ts` — aucun changement necessaire (listResources est optionnel)
- `apps/server/src/routes/auth.ts` — aucun rapport
- `apps/server/src/middleware/auth.middleware.ts` — deja fonctionnel
- `apps/server/src/utils/crypto.ts` — deja fonctionnel, reutiliser tel quel
- `apps/server/src/utils/platform-error.ts` — deja fonctionnel, reutiliser tel quel

**Apres creation, generer la migration :**
```bash
cd apps/server && npx drizzle-kit generate
```

### Exigences de tests

**Framework :** Vitest (deja configure)
**Commande :** `npm run test` a la racine ou `npm run test -w @wakehub/server`

**Tests backend obligatoires :**

**1. `apps/server/src/connectors/proxmox.connector.test.ts` :**
- Mocker `fetch` globalement (vi.stubGlobal ou vi.mock) — NE PAS appeler l'API Proxmox reelle
- `testConnection()` retourne `{ success: true }` quand l'API repond avec un ticket valide
- `testConnection()` retourne `{ success: false }` quand l'API retourne 401 (mauvais identifiants)
- `testConnection()` retourne `{ success: false }` quand l'API est injoignable (timeout/network error)
- `listResources()` retourne la liste des VMs avec nom, vmid, statut
- `listResources()` gere le cas multi-nodes (agrege les VMs de tous les nodes)
- `start()` appelle POST /api2/json/nodes/{node}/qemu/{vmid}/status/start
- `start()` lance `PlatformError` si l'API echoue
- `stop()` appelle POST /api2/json/nodes/{node}/qemu/{vmid}/status/stop
- `getStatus()` retourne le bon statut WakeHub selon la reponse Proxmox
- Toutes les erreurs sont des instances de `PlatformError` avec `platform: 'proxmox'`
- Tester les deux modes d'authentification (ticket et token API)

**2. `apps/server/src/routes/resources.routes.test.ts` :**
- Pattern de test identique a `machines.routes.test.ts` : `app.inject()`, DB de test SQLite, nettoyage dans `beforeEach`
- `POST /api/machines/:id/discover` avec machine type=proxmox → retourne liste des VMs → status 200
- `POST /api/machines/:id/discover` avec machine type=physical → status 400 ("Decouverte non disponible pour ce type")
- `POST /api/machines/:id/discover` avec machine inexistante → status 404
- `POST /api/machines/:id/resources` cree les resources selectionnees → status 200
- `POST /api/machines/:id/resources` avec resources vides → status 400
- `GET /api/machines/:id/resources` retourne les resources → `{ data: [...] }`
- `GET /api/resources` retourne toutes les resources
- `GET /api/resources/:id` retourne une resource specifique
- `GET /api/resources/:id` avec ID inexistant → status 404
- Toutes les routes sans session → status 401
- Les credentials Proxmox ne sont JAMAIS retournes en clair

**Pattern de mock pour fetch (dans les tests du connecteur) :**
```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock reponse Proxmox ticket
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({
    data: { ticket: 'PVE:root@pam:...', CSRFPreventionToken: '...' }
  })
});

// Mock reponse Proxmox VMs
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({
    data: [
      { vmid: 100, name: 'VM-Media', status: 'running', maxmem: 8589934592, cpus: 4 },
      { vmid: 101, name: 'VM-Storage', status: 'stopped', maxmem: 4294967296, cpus: 2 }
    ]
  })
});
```

### Intelligence de la story precedente (2.1)

**Problemes rencontres et solutions (a ne PAS repeter) :**

1. **Response schemas Fastify obligatoires pour TOUS les status codes** — Si une route retourne 400 ou 404, le schema `response` DOIT inclure ces codes. Appliquer systematiquement.

2. **`tsconfig.json` doit exclure `*.test.ts` pour le build Docker** — Verifier que `"exclude": ["src/**/*.test.ts"]` est present.

3. **Vitest mock hoisting avec ssh2** — Resolu avec le pattern `globalThis.__lastSshClient`. Pour le connecteur Proxmox, utiliser `vi.stubGlobal('fetch', mockFetch)` qui est plus simple car fetch est global.

4. **Auth middleware utilise le `db` global** — Les tests de routes doivent soit enregistrer le middleware, soit le contourner. Le pattern etabli : tester les routes sans middleware (teste separement).

5. **Mantine ajoute ` *` aux labels `required`** — Utiliser regex dans les tests : `getByLabelText(/URL de l'API/i)`.

6. **`credentials: 'include'` obligatoire sur tous les fetch frontend** — `apiFetch()` gere deja ca.

**Patterns etablis a reutiliser :**
- Formulaires : `useForm` de Mantine + mutation TanStack Query + toast notification
- API hooks : fichier dedie par domaine dans `api/` — un hook par endpoint
- Connecteur : constructeur avec config, toutes erreurs → `PlatformError`
- Logging : double destination pino + operation_logs
- Wizard : Stepper Mantine avec etapes conditionnelles selon le type

### Informations techniques actuelles (recherche web fevrier 2026)

**API Proxmox VE :**
- API REST JSON accessible sur le port 8006 par defaut (HTTPS)
- Toujours HTTPS avec certificat auto-signe par defaut
- Deux modes d'authentification : ticket (session temporaire) et API token (permanent)
- Les API tokens ne necessitent pas de CSRFPreventionToken pour les requetes POST/PUT/DELETE
- L'API retourne toujours `{ data: ... }` comme format de reponse

**Gestion TLS self-signed dans Node.js :**
- `undici.Agent({ connect: { rejectUnauthorized: false } })` passe en option `dispatcher` de `fetch`
- NE PAS utiliser `NODE_TLS_REJECT_UNAUTHORIZED=0` (affecte tout le processus, risque de securite)
- `undici` est deja le moteur HTTP sous-jacent de Node.js 18+ — l'import donne acces a `Agent`

**Package npm `proxmox-api` (v1.1.1) :**
- Existe, maintenu, TypeScript, 100% API coverage
- 389 downloads/semaine — communaute tres petite
- **Decision : NE PAS utiliser** — fetch natif + undici.Agent est plus simple, zero dependance supplementaire, meilleur controle sur le TLS et l'authentification

### Project Structure Notes

- La table `resources` avec FK `machine_id` et `ON DELETE CASCADE` garantit que la suppression d'une machine supprime ses resources
- Le champ `platform_ref` est un JSON string pour flexibilite (Proxmox: `{ node, vmid }`, Docker: `{ containerId }`)
- Le connecteur Proxmox suit exactement le pattern du WolSshConnector : constructeur avec config, methodes PlatformConnector
- Le wizard est etendu de 3 a 4 etapes pour Proxmox (type → formulaire → test → decouverte VMs)

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — User story, acceptance criteria, FRs couverts (FR6, FR8, FR10)
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — AES-256-GCM, PlatformConnector, PlatformError
- **Architecture structure** : [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — proxmox.connector.ts dans connectors/
- **Architecture patterns** : [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Conventions nommage, format API, gestion erreurs
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy] — Wizard Stepper, patterns d'interaction
- **UX Wizard** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Premiere configuration] — Flow decouverte VMs apres connexion API
- **Story precedente** : [Source: _bmad-output/implementation-artifacts/2-1-ajout-dune-machine-physique-wol-ssh.md] — Patterns connecteur, dev notes, anti-patterns, debug log

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
