# Story 2.1: Ajout d'une machine physique & base technique

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want ajouter une machine physique a WakeHub avec ses parametres de connexion,
So that WakeHub connait ma machine et peut la demarrer/arreter.

## Acceptance Criteria

1. **Migration Drizzle — table `nodes`**
   - Given la table `nodes` n'existe pas encore
   - When la migration Drizzle s'execute pour cette story
   - Then la table `nodes` est creee avec les colonnes : id (text PK UUID), name (text NOT NULL), type (text enum: physical, vm, lxc, container), status (text enum: online, offline, starting, stopping, error), ip_address (text), mac_address (text nullable), ssh_user (text nullable), ssh_credentials_encrypted (text nullable), parent_id (text FK nullable → nodes.id), capabilities (text JSON: {proxmox_api?: {...}, docker_api?: {...}}), platform_ref (text JSON nullable), service_url (text nullable), is_pinned (integer boolean defaut 0), confirm_before_shutdown (integer boolean defaut 1 pour physical), discovered (integer boolean defaut 0), configured (integer boolean defaut 1), created_at (integer timestamp), updated_at (integer timestamp)
   - And un index est cree sur parent_id pour les requetes d'arbre

2. **Module utilitaire crypto.ts — deja implemente**
   - Given le module `crypto.ts` existe deja dans `apps/server/src/utils/`
   - When il est utilise pour chiffrer les credentials SSH
   - Then `encrypt()` et `decrypt()` fonctionnent avec AES-256-GCM et IV unique
   - And le format de sortie est `"iv:authTag:encrypted"` (hex-encoded)

3. **Interface PlatformConnector**
   - Given l'interface `PlatformConnector` n'existe pas encore
   - When cette story est implementee
   - Then l'interface est definie dans `connectors/connector.interface.ts` avec les methodes : `testConnection(): Promise<boolean>`, `start(node: Node): Promise<void>`, `stop(node: Node): Promise<void>`, `getStatus(node: Node): Promise<NodeStatus>`
   - And la classe `PlatformError` est implementee dans `utils/platform-error.ts` avec : code (string), message (string), platform (string), details (Record<string, unknown> optionnel)

4. **Types shared dans @wakehub/shared**
   - Given les types d'infrastructure n'existent pas encore dans le package shared
   - When cette story est implementee
   - Then le package `@wakehub/shared` exporte les types : `Node`, `NodeType` ('physical' | 'vm' | 'lxc' | 'container'), `NodeStatus` ('online' | 'offline' | 'starting' | 'stopping' | 'error'), `NodeCapabilities` ({proxmox_api?: ProxmoxCapability, docker_api?: DockerCapability}), `PlatformRef` (reference Proxmox/Docker), `CreateNodeRequest`, `UpdateNodeRequest`

5. **Wizard d'ajout — formulaire machine physique**
   - Given je suis sur la page d'accueil ou la page Noeuds
   - When je clique sur le bouton "+" (ajouter une machine)
   - Then un wizard s'ouvre (Mantine Stepper) avec la premiere etape : formulaire machine physique (nom, adresse IP, adresse MAC, utilisateur SSH, mot de passe ou cle SSH)

6. **Test de connexion SSH**
   - Given je remplis le formulaire avec des donnees valides
   - When je passe a l'etape suivante
   - Then un test de connexion SSH est lance automatiquement
   - And le bouton passe en etat loading pendant le test
   - And le resultat s'affiche (succes avec icone verte ou echec avec message d'erreur)

7. **Enregistrement de la machine**
   - Given le test de connexion reussit (ou l'utilisateur force l'ajout)
   - When je confirme l'ajout
   - Then la machine est enregistree en base (table `nodes`, type='physical') avec credentials SSH chiffres AES-256-GCM
   - And un toast de succes s'affiche
   - And l'operation est enregistree dans `operation_logs`

8. **Forcer l'ajout sans test reussi**
   - Given le test de connexion echoue
   - When le resultat s'affiche
   - Then je peux modifier les parametres et relancer le test
   - And je peux forcer l'ajout sans test reussi (avec avertissement visuel)

9. **Connecteur WoL/SSH**
   - Given le connecteur WoL/SSH est implemente
   - When il est utilise
   - Then il implemente `PlatformConnector` avec `testConnection()` (ping SSH), `start()` (WoL magic packet UDP), `stop()` (SSH shutdown command) et `getStatus()` (ping TCP port 22)

10. **Routes API**
    - Given les routes API sont implementees
    - When `POST /api/nodes` est appele avec un body valide
    - Then le noeud est cree en base et retourne dans `{ data: { node } }`
    - When `GET /api/nodes` est appele
    - Then la liste des noeuds est retournee dans `{ data: { nodes: [...] } }`
    - When `POST /api/nodes/:id/test-connection` est appele
    - Then le test de connexion est execute et le resultat retourne
    - And tous les endpoints utilisent le format normalise `{ data }` / `{ error: { code, message, details } }` avec validation JSON Schema

## Tasks / Subtasks

- [x] Task 1 : Migration Drizzle — table `nodes` (AC: #1)
  - [x] 1.1 Definir le schema `nodes` dans `apps/server/src/db/schema.ts` avec tous les champs (id UUID, name, type enum, status enum, ip_address, mac_address, ssh_user, ssh_credentials_encrypted, parent_id FK self-referencing, capabilities JSON, platform_ref JSON, service_url, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at)
  - [x] 1.2 Generer la migration Drizzle (`npx drizzle-kit generate`)
  - [x] 1.3 Verifier que la migration s'applique au demarrage du serveur (auto-migrate existant)
  - [x] 1.4 Ajouter un index sur `parent_id` pour les requetes d'arbre

- [x] Task 2 : Types shared dans @wakehub/shared (AC: #4)
  - [x] 2.1 Creer `packages/shared/src/models/node.ts` avec les types : `NodeType`, `NodeStatus`, `NodeCapabilities`, `ProxmoxCapability`, `DockerCapability`, `PlatformRef`, `Node` (type complet du modele)
  - [x] 2.2 Creer `packages/shared/src/api/nodes.ts` avec les types : `CreateNodeRequest`, `UpdateNodeRequest`, `TestConnectionResponse`, `NodeListResponse`
  - [x] 2.3 Exporter tous les nouveaux types depuis `packages/shared/src/index.ts`

- [x] Task 3 : Interface PlatformConnector & PlatformError (AC: #3)
  - [x] 3.1 Creer `apps/server/src/connectors/connector.interface.ts` avec l'interface `PlatformConnector` : `testConnection(node)`, `start(node)`, `stop(node)`, `getStatus(node)`
  - [x] 3.2 Creer `apps/server/src/utils/platform-error.ts` avec la classe `PlatformError extends Error` : code, message, platform, details
  - [x] 3.3 Ecrire les tests unitaires pour `PlatformError`

- [x] Task 4 : Connecteur WoL/SSH (AC: #9)
  - [x] 4.1 Installer les dependances : `wake_on_lan` (+ `@types/wake_on_lan`) et `node-ssh` pour SSH
  - [x] 4.2 Creer `apps/server/src/connectors/wol-ssh.connector.ts` implementant `PlatformConnector`
  - [x] 4.3 Implementer `testConnection()` : tenter connexion SSH (port 22) avec timeout 10s
  - [x] 4.4 Implementer `start()` : envoyer magic packet WoL via UDP broadcast a l'adresse MAC
  - [x] 4.5 Implementer `stop()` : connexion SSH + execution `sudo shutdown -h now`
  - [x] 4.6 Implementer `getStatus()` : tenter connexion TCP port 22 avec timeout 5s (online si reussi, offline sinon)
  - [x] 4.7 Toutes les erreurs encapsulees dans `PlatformError` avec platform='wol-ssh'
  - [x] 4.8 Dechiffrer les credentials SSH via `crypto.ts` avant utilisation
  - [x] 4.9 Ecrire les tests unitaires (mock SSH et WoL)

- [x] Task 5 : Connector Factory (AC: #9)
  - [x] 5.1 Creer `apps/server/src/connectors/connector-factory.ts` : fonction `getConnector(nodeType, parentCapabilities)` retournant le bon connecteur
  - [x] 5.2 Pour cette story, seul le connecteur `wol-ssh` est retourne pour `type='physical'`
  - [x] 5.3 Ecrire les tests unitaires

- [x] Task 6 : Routes API backend — CRUD nodes (AC: #10)
  - [x] 6.1 Creer `apps/server/src/routes/nodes.routes.ts` comme plugin Fastify
  - [x] 6.2 Implementer `POST /api/nodes` : validation JSON Schema, chiffrement credentials SSH, insertion en base, log dans operation_logs, retour `{ data: { node } }`
  - [x] 6.3 Implementer `GET /api/nodes` : retourne tous les noeuds configures, format `{ data: { nodes: [...] } }`
  - [x] 6.4 Implementer `POST /api/nodes/:id/test-connection` : charge le noeud, dechiffre credentials, appelle `testConnection()` du connecteur, retourne resultat
  - [x] 6.5 Enregistrer le plugin dans `app.ts` (route protegee par auth middleware)
  - [x] 6.6 Ecrire les tests (creation noeud, liste noeuds, test connexion, validation, erreurs)

- [x] Task 7 : Hooks API frontend (AC: #5, #6, #7, #10)
  - [x] 7.1 Creer `apps/web/src/api/nodes.api.ts` avec les hooks TanStack Query : `useNodes()` (query GET), `useCreateNode()` (mutation POST), `useTestConnection()` (mutation POST)
  - [x] 7.2 Definir les types de requetes/reponses frontend correspondants
  - [x] 7.3 Utiliser `apiFetch` avec `credentials: 'include'` (pattern etabli dans auth.api.ts)

- [x] Task 8 : Page Noeuds — placeholder + navigation (AC: #5)
  - [x] 8.1 Creer `apps/web/src/features/nodes/nodes-page.tsx` — page placeholder avec bouton "+" et message d'etat vide si aucun noeud
  - [x] 8.2 Ajouter la route `/nodes` dans `router.tsx` (route protegee dans AuthGuard)
  - [x] 8.3 Ajouter le lien "Noeuds" dans `navigation.tsx` avec icone Tabler `IconServer`

- [x] Task 9 : Wizard d'ajout machine physique (AC: #5, #6, #7, #8)
  - [x] 9.1 Creer `apps/web/src/features/nodes/add-machine-wizard.tsx` avec Mantine Stepper (3 etapes)
  - [x] 9.2 Etape 1 : Formulaire machine physique (nom, IP, MAC, utilisateur SSH, mot de passe SSH) — validation Mantine Form
  - [x] 9.3 Etape 2 : Test de connexion automatique — appelle `useTestConnection`, affiche resultat (succes/echec), option "Forcer l'ajout" si echec
  - [x] 9.4 Etape 3 : Confirmation + resume — appelle `useCreateNode`, toast succes, redirection vers page Noeuds
  - [x] 9.5 Bouton "+" sur la page Noeuds ouvre le wizard (Mantine Modal ou page dediee)

- [x] Task 10 : Tests frontend (AC: tous)
  - [x] 10.1 Tester le rendering de la page Noeuds (etat vide, bouton "+")
  - [x] 10.2 Tester le wizard (rendering des 3 etapes, validation formulaire, transitions)
  - [x] 10.3 Tester le flux complet : formulaire → test connexion → confirmation → creation
  - [x] 10.4 Verifier que les tests existants passent toujours

## Dev Notes

### Stack technique et versions

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe |
| Mantine (core, form, hooks, notifications) | ~7.17 | Stepper pour wizard, Form pour validation |
| React Router | ~7.x | Deja installe |
| Fastify | ~5.x | Backend API, plugins par domaine |
| Drizzle ORM | ~0.45.x | Code-first TypeScript ORM, better-sqlite3 |
| better-sqlite3 | ~11.x | SQLite synchrone |
| argon2 | ~0.31.x | Deja installe (pas utilise dans cette story) |
| TanStack Query | ~5.x | useQuery + useMutation pour les appels API |
| @tabler/icons-react | ~3.36 | Icones (IconServer, IconPlus, IconCheck, IconX) |
| **wake_on_lan** | **latest** | **A INSTALLER** — envoi magic packet WoL UDP. Types: `@types/wake_on_lan` |
| **node-ssh** | **latest** | **A INSTALLER** — wrapper Promise sur ssh2, connexion SSH + exec commandes |

### Architecture — Decisions critiques pour cette story

**1. Schema Drizzle — table `nodes` (modele unifie)**

La table `nodes` est le coeur du modele de donnees de WakeHub. Elle represente TOUS les types d'entites de l'arbre d'hebergement (machine physique, VM, LXC, conteneur Docker) dans une seule table avec un champ `type` discriminant. L'arbre est modelise par `parent_id` (self-referencing FK).

```typescript
// apps/server/src/db/schema.ts — AJOUTER apres les tables existantes
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['physical', 'vm', 'lxc', 'container'] }).notNull(),
  status: text('status', { enum: ['online', 'offline', 'starting', 'stopping', 'error'] }).notNull().default('offline'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  sshUser: text('ssh_user'),
  sshCredentialsEncrypted: text('ssh_credentials_encrypted'),
  parentId: text('parent_id').references(() => nodes.id, { onDelete: 'cascade' }),
  capabilities: text('capabilities', { mode: 'json' }).$type<NodeCapabilities>().default({}),
  platformRef: text('platform_ref', { mode: 'json' }).$type<PlatformRef | null>(),
  serviceUrl: text('service_url'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  confirmBeforeShutdown: integer('confirm_before_shutdown', { mode: 'boolean' }).notNull().default(true),
  discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
  configured: integer('configured', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('idx_nodes_parent_id').on(table.parentId),
  index('idx_nodes_type').on(table.type),
  index('idx_nodes_status').on(table.status),
]);
```

**Note : `capabilities` est un champ JSON** stocke comme texte. Pour cette story, seule la structure est definie — le contenu sera rempli par les stories 2.2 (Proxmox) et 2.3 (Docker).

**2. Interface PlatformConnector — contrat pour tous les connecteurs**

```typescript
// apps/server/src/connectors/connector.interface.ts
import type { Node, NodeStatus } from '@wakehub/shared';

export interface PlatformConnector {
  testConnection(node: Node): Promise<boolean>;
  start(node: Node): Promise<void>;
  stop(node: Node): Promise<void>;
  getStatus(node: Node): Promise<NodeStatus>;
}
```

Chaque connecteur (WoL/SSH, Proxmox, Docker) implementera cette interface. Le `ConnectorFactory` selectionne le bon connecteur selon le type du noeud.

**3. PlatformError — classe d'erreur normalisee**

```typescript
// apps/server/src/utils/platform-error.ts
export class PlatformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly platform: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}
```

Codes d'erreur pour le connecteur WoL/SSH :
- `SSH_CONNECTION_FAILED` — connexion SSH impossible (timeout, refused, auth failed)
- `SSH_COMMAND_FAILED` — commande SSH echouee (shutdown)
- `WOL_SEND_FAILED` — envoi magic packet echoue
- `NODE_UNREACHABLE` — ping echoue (getStatus)

**4. Connecteur WoL/SSH — implementation**

```typescript
// apps/server/src/connectors/wol-ssh.connector.ts
import { NodeSSH } from 'node-ssh';
import wol from 'wake_on_lan';

// testConnection: tenter connexion SSH port 22 avec timeout 10s
// start: wol.wake(macAddress, { address: broadcastAddress })
// stop: ssh.execCommand('sudo shutdown -h now')
// getStatus: tenter connexion TCP port 22 avec timeout 5s
```

**IMPORTANT : Dechiffrer les credentials AVANT de les passer au connecteur.**
Le route handler dechiffre via `decrypt(node.sshCredentialsEncrypted)` et passe le mot de passe en clair au connecteur. Le connecteur ne connait PAS le module crypto.

**5. Format API — respecter strictement le pattern existant**

```typescript
// Succes
{ data: { node: { id, name, type, status, ... } } }
{ data: { nodes: [{ id, name, ... }, ...] } }

// Erreur
{ error: { code: 'VALIDATION_ERROR', message: '...', details: {...} } }
{ error: { code: 'NODE_NOT_FOUND', message: '...' } }
{ error: { code: 'SSH_CONNECTION_FAILED', message: '...', details: { platform: 'wol-ssh', ip: '...' } } }
```

**6. Chiffrement des credentials — utiliser crypto.ts existant**

```typescript
import { encrypt, decrypt } from '../utils/crypto.js';

// A la creation du noeud :
const sshCredentialsEncrypted = encrypt(sshPassword);

// Au test de connexion :
const sshPassword = decrypt(node.sshCredentialsEncrypted);
```

**NE PAS stocker le mot de passe SSH en clair. TOUJOURS chiffrer avant insertion en base.**

### Dependances a installer

**Backend (`apps/server`) :**
```bash
npm install wake_on_lan node-ssh -w apps/server
npm install -D @types/wake_on_lan -w apps/server
```

- `wake_on_lan` — Envoi de magic packets WoL via UDP broadcast. API callback-based, wrapper Promise a creer. [npm: wake_on_lan](https://www.npmjs.com/package/wake_on_lan)
- `node-ssh` — Wrapper Promise autour de ssh2. API clean : `ssh.connect({host, username, password})`, `ssh.execCommand('...')`, `ssh.dispose()`. [npm: node-ssh](https://www.npmjs.com/package/node-ssh)
- `@types/wake_on_lan` — Types TypeScript pour wake_on_lan

**Frontend : aucune nouvelle dependance.** Tout est deja installe (Mantine Stepper, TanStack Query, Tabler Icons).

### Conventions de nommage — rappel obligatoire

| Couche | Convention | Exemples |
|---|---|---|
| DB colonnes | `snake_case` | `ip_address`, `mac_address`, `parent_id`, `ssh_credentials_encrypted` |
| DB tables | `snake_case` pluriel | `nodes` |
| API JSON | `camelCase` | `ipAddress`, `macAddress`, `parentId`, `sshUser` |
| Fichiers | `kebab-case` | `nodes.routes.ts`, `wol-ssh.connector.ts`, `add-machine-wizard.tsx` |
| Composants React | `PascalCase` | `AddMachineWizard`, `NodesPage` |
| Types/Interfaces | `PascalCase` | `Node`, `NodeType`, `PlatformConnector` |
| Constantes | `SCREAMING_SNAKE` | `SSH_TIMEOUT_MS`, `WOL_BROADCAST_ADDRESS` |
| Codes erreur | `SCREAMING_SNAKE` | `SSH_CONNECTION_FAILED`, `NODE_NOT_FOUND` |

**Transformation DB ↔ API :** Drizzle mappe automatiquement `snake_case` (DB) vers `camelCase` (JS) grace a la declaration du schema (`ipAddress: text('ip_address')`). Le JSON retourne par l'API est donc naturellement en camelCase. **Ne PAS ajouter de couche de transformation manuelle.**

### Structure de fichiers — nouveaux fichiers a creer

```
apps/server/src/
├── connectors/                          ← NOUVEAU dossier
│   ├── connector.interface.ts           ← Interface PlatformConnector
│   ├── connector-factory.ts             ← Factory retournant le bon connecteur
│   ├── connector-factory.test.ts        ← Tests factory
│   ├── wol-ssh.connector.ts             ← Connecteur WoL + SSH
│   └── wol-ssh.connector.test.ts        ← Tests connecteur (mocks)
├── routes/
│   ├── nodes.routes.ts                  ← NOUVEAU — CRUD /api/nodes + test-connection
│   └── nodes.routes.test.ts             ← NOUVEAU — Tests routes
├── utils/
│   ├── platform-error.ts               ← NOUVEAU — Classe PlatformError
│   └── platform-error.test.ts          ← NOUVEAU — Tests PlatformError
├── db/
│   └── schema.ts                        ← MODIFIER — Ajouter table nodes

apps/web/src/
├── api/
│   └── nodes.api.ts                     ← NOUVEAU — Hooks TanStack Query
├── features/
│   └── nodes/                           ← NOUVEAU dossier
│       ├── nodes-page.tsx               ← Page liste des noeuds
│       ├── nodes-page.test.tsx          ← Tests page
│       ├── add-machine-wizard.tsx       ← Wizard Stepper 3 etapes
│       └── add-machine-wizard.test.tsx  ← Tests wizard
├── components/
│   └── layout/
│       └── navigation.tsx               ← MODIFIER — Ajouter lien "Noeuds"
├── router.tsx                           ← MODIFIER — Ajouter route /nodes

packages/shared/src/
├── models/
│   └── node.ts                          ← NOUVEAU — Types Node, NodeType, NodeStatus, etc.
├── api/
│   └── nodes.ts                         ← NOUVEAU — Types API (CreateNodeRequest, etc.)
└── index.ts                             ← MODIFIER — Re-exporter les nouveaux types
```

**Fichiers existants a MODIFIER (pas creer) :**
- `apps/server/src/db/schema.ts` — Ajouter la table `nodes`
- `apps/server/src/app.ts` — Enregistrer le plugin `nodes.routes.ts`
- `apps/web/src/components/layout/navigation.tsx` — Ajouter lien "Noeuds"
- `apps/web/src/router.tsx` — Ajouter route `/nodes`
- `packages/shared/src/index.ts` — Re-exporter les nouveaux types

### Testing — approche et patterns

**Tests backend (Vitest + better-sqlite3 in-memory) :**

Pattern identique a `auth.test.ts` :
```typescript
// apps/server/src/routes/nodes.routes.test.ts
describe('POST /api/nodes', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(':memory:');  // OU fichier temporaire
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    // Creer un user + session pour auth
    await app.register(nodesRoutes);
    await app.ready();
  });

  it('should create a physical node', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/nodes',
      headers: { cookie: `session_token=${validToken}` },
      payload: {
        name: 'Mon Serveur',
        type: 'physical',
        ipAddress: '192.168.1.10',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        sshUser: 'root',
        sshPassword: 'secret123',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.node.name).toBe('Mon Serveur');
    expect(body.data.node.sshCredentialsEncrypted).toBeUndefined(); // NE PAS exposer
  });
});
```

**Tests connecteur (mocks obligatoires) :**
```typescript
// apps/server/src/connectors/wol-ssh.connector.test.ts
// Mocker node-ssh et wake_on_lan pour eviter les appels reseau reels
vi.mock('node-ssh', () => ({ NodeSSH: vi.fn() }));
vi.mock('wake_on_lan', () => ({ wake: vi.fn() }));
```

**Tests frontend (Vitest + Testing Library) :**

Pattern identique aux tests auth :
```typescript
// Wrapper providers (QueryClient, Mantine, Router)
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <MemoryRouter>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}
```

**Cas de test a couvrir :**
- Rendering page Noeuds etat vide (message + bouton "+")
- Rendering wizard etape 1 (formulaire visible)
- Validation formulaire (champs requis, format IP, format MAC)
- Transition etape 1 → etape 2 (test connexion)
- Affichage resultat test (succes/echec)
- Option "Forcer l'ajout" visible apres echec
- Transition etape 2 → etape 3 (confirmation)
- Flux complet : creation → toast succes
- Backend : creation noeud (POST), liste noeuds (GET), test connexion, validation JSON Schema, noeud non trouve, credentials chiffrees en base

**IMPORTANT : NE PAS oublier :**
- Wrapper les tests frontend dans `QueryClientProvider`
- Mocker `fetch` pour les appels API dans les tests frontend
- Mocker les modules SSH/WoL dans les tests backend du connecteur
- Tester que les credentials SSH ne sont JAMAIS retournees en clair dans les reponses API
- Inclure les response schemas pour TOUS les codes de retour Fastify (200, 400, 404) sinon erreur au build

### Intelligence des stories precedentes (Epic 1)

**Lecons apprises de Story 1.5 (derniere story completee) :**

1. **Response schemas Fastify obligatoires pour TOUS les codes HTTP** — Si on retourne un 400 ou 404 sans avoir declare le schema dans `response: { 400: {...}, 404: {...} }`, le build TypeScript Docker echouera. Toujours declarer les schemas de reponse pour chaque code de retour utilise.

2. **`tsconfig.json` doit exclure les fichiers test** — Le `tsconfig.json` du serveur exclut deja `src/**/*.test.ts` pour le build Docker. Verifier que c'est toujours le cas apres ajout de nouveaux tests.

3. **Pattern page auth reutilisable** — `Container size={420} + Title + Paper withBorder` pour les pages centrees. Pour la page Noeuds, utiliser un layout pleine largeur a la place (pas de Container size=420).

4. **Tests frontend : `getByPlaceholderText` plutot que `getByLabelText`** — Mantine ajoute ` *` au label des champs `required`, ce qui casse `getByLabelText('Nom')`. Utiliser `getByPlaceholderText` ou un regex `getByLabelText(/Nom/i)`.

5. **`credentials: 'include'` obligatoire** sur tous les `fetch()` frontend pour envoyer le cookie de session. Le pattern est deja dans `apiFetch` (`api-fetch.ts`) — utiliser `apiFetch` et non `fetch` directement.

6. **`window.history.pushState({}, '', '/')` dans `beforeEach`** des tests router pour reset la location entre les tests.

7. **Hooks API : pattern useMutation avec `apiFetch`** — Voir `auth.api.ts` pour le pattern exact. NE PAS reimplenter un pattern custom.

**Patterns etablis a reutiliser strictement :**
- Routes Fastify : `FastifyPluginAsync` avec `setErrorHandler` pour validation
- DB operations : `fastify.db.select/insert/update/delete` avec Drizzle
- Logging : double (pino `fastify.log.info()` + insertion `operationLogs`)
- Frontend forms : `useForm` Mantine avec `validate:` + `onSubmit`
- Notifications : `notifications.show({ title, message, color })`
- Navigation : ajout dans `navigation.tsx` + route dans `router.tsx`

**Nombre total de tests actuels : 71 (45 server + 26 web)**
Tous doivent continuer a passer apres cette story.

### Intelligence Git — patterns recents

**Derniers commits :**
```
f8051b6 docs: define new epic roadmap (Epics 2-6) and update sprint tracking
b736b54 refactor: strip to Epic 1 only — remove all infrastructure code (Epics 2-7)
7cd4d93 Rename project from wakehub2 to WakeHub
bb3c9bc Initial commit: WakeHub2 full-stack infrastructure management platform
```

**Contexte important :**
- Le commit `b736b54` a SUPPRIME tout le code des Epics 2-7 d'une version precedente. Cette story repart de zero pour l'Epic 2 avec la nouvelle architecture (modele deux couches).
- L'Epic 1 est completement implementee et fonctionnelle (auth, theme, layout, navigation).
- La branche de travail est `nouvel-axe`.

**Fichiers existants du codebase (pour eviter les conflits) :**
- `apps/server/src/db/schema.ts` — contient `users`, `sessions`, `operationLogs`. Ajouter `nodes` dans CE fichier.
- `apps/server/src/app.ts` — enregistre `authRoutes`. Ajouter `nodesRoutes` de la meme maniere.
- `apps/server/src/utils/crypto.ts` — EXISTE DEJA. Ne pas recreer. Importer depuis `../utils/crypto.js`.
- `apps/web/src/components/layout/navigation.tsx` — contient le lien "Accueil". Ajouter "Noeuds".
- `apps/web/src/router.tsx` — contient les routes auth. Ajouter `/nodes`.

### Information technique recente (recherche web)

**wake_on_lan (npm) :**
- Package le plus utilise pour WoL en Node.js
- API callback : `wol.wake(macAddress, options, callback)` — wrapper Promise necessaire
- Options : `{ address: '255.255.255.255', port: 9 }` (broadcast par defaut)
- Types disponibles via `@types/wake_on_lan`

**node-ssh (npm) :**
- Wrapper Promise leger autour de `ssh2` (le standard SSH pour Node.js)
- API : `const ssh = new NodeSSH()` → `await ssh.connect({ host, username, password })` → `await ssh.execCommand('commande')` → `ssh.dispose()`
- Support natif TypeScript (types inclus, pas de @types necessaire)
- Gestion du timeout via `readyTimeout` dans les options de connexion

**Implementation WoL recommandee :**
```typescript
import wol from 'wake_on_lan';

function sendWol(macAddress: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wol.wake(macAddress, (error: Error | undefined) => {
      if (error) reject(new PlatformError('WOL_SEND_FAILED', error.message, 'wol-ssh'));
      else resolve();
    });
  });
}
```

**Implementation SSH recommandee :**
```typescript
import { NodeSSH } from 'node-ssh';

async function testSshConnection(host: string, username: string, password: string): Promise<boolean> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host, username, password, readyTimeout: 10000 });
    ssh.dispose();
    return true;
  } catch (error) {
    throw new PlatformError('SSH_CONNECTION_FAILED', (error as Error).message, 'wol-ssh', { host });
  }
}
```

### Project Structure Notes

- Alignement complet avec la structure unifiee definie dans `architecture.md` : les connecteurs vont dans `connectors/`, les routes dans `routes/`, les types shared dans `packages/shared/`
- Premiere introduction du dossier `connectors/` — definir le pattern proprement car les stories 2.2 (Proxmox) et 2.3 (Docker) suivront le meme modele
- Premiere introduction du dossier `features/nodes/` cote frontend — ce dossier grandira avec les stories 2.4 (page tabulaire) et 2.5 (page detail)
- Le `ConnectorFactory` est minimaliste pour cette story (un seul connecteur) mais DOIT etre cree maintenant pour etablir le pattern

### References

- [Source: epics.md#Story-2.1] — User story, acceptance criteria, FRs couverts (FR5, FR10, FR12 partiel)
- [Source: architecture.md#Starter-Template-Evaluation] — Monorepo npm workspaces, structure projet
- [Source: architecture.md#Authentication-&-Security] — AES-256-GCM pour credentials, format PlatformError
- [Source: architecture.md#API-&-Communication-Patterns] — REST + JSON Schema, format data/error
- [Source: architecture.md#Implementation-Patterns] — Conventions nommage, tests co-localises, format API
- [Source: architecture.md#Project-Structure-&-Boundaries] — Arbre de fichiers, frontieres composants
- [Source: ux-design-specification.md#Premiere-configuration-/-Onboarding] — Wizard d'ajout machine, Mantine Stepper
- [Source: ux-design-specification.md#Design-System-Foundation] — Theme dark, couleurs statut, espacement
- [Source: ux-design-specification.md#UX-Consistency-Patterns] — Toasts, modales, etats vides, loading
- [Source: prd.md#Gestion-de-l'Infrastructure] — FR5-FR12 infrastructure management
- [Source: 1-5-reinitialisation-du-mot-de-passe.md#Dev-Agent-Record] — Lecons apprises, patterns, debug tips

### Anti-patterns a eviter

- **NE PAS** creer un dossier `__tests__/` — tests co-localises (`foo.test.ts` a cote de `foo.ts`)
- **NE PAS** retourner `sshCredentialsEncrypted` dans les reponses API — filtrer ce champ dans le serializer
- **NE PAS** utiliser `any` — typer correctement avec les types de `@wakehub/shared`
- **NE PAS** hardcoder des timeouts — utiliser des constantes (`SSH_TIMEOUT_MS = 10000`)
- **NE PAS** appeler directement SSH/WoL dans les routes — passer par le connecteur via la factory
- **NE PAS** oublier `credentials: 'include'` dans les appels fetch frontend (utiliser `apiFetch`)
- **NE PAS** oublier de dechiffrer les credentials AVANT de les passer au connecteur
- **NE PAS** creer de fichier composant en PascalCase (`AddMachineWizard.tsx`) — utiliser kebab-case (`add-machine-wizard.tsx`)
- **NE PAS** oublier les response schemas Fastify pour les codes 400/404 (sinon build Docker echoue)
- **NE PAS** faire de requetes reseau reelles dans les tests — mocker SSH et WoL

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Self-referencing FK `parentId` dans Drizzle cause une erreur TypeScript TS7022 (circular type). Resolution : utiliser `foreignKey()` dans le 3eme argument de `sqliteTable` au lieu de `.references()` inline.
- vi.mock factory hoisted avant les variables — utiliser `vi.hoisted()` pour les mock functions partagees entre mock factory et tests.
- NodeSSH mock doit etre une classe (`class { ... }`) et non `vi.fn().mockImplementation(() => {...})` car arrow functions ne supportent pas `new`.
- Fastify response schema avec `details: { type: 'object' }` sans `additionalProperties: true` filtre les proprietes dynamiques — ajouter `additionalProperties: true`.
- Mantine Modal rend le contenu dans un portal, donc `findByPlaceholderText` (async) est necessaire au lieu de `getByPlaceholderText`.

### Completion Notes List

- Task 1 : Table `nodes` creee avec 18 colonnes, 3 indexes (parent_id, type, status), FK self-referencing avec cascade delete. Migration 0002_parched_harrier.sql generee.
- Task 2 : Types Node, NodeType, NodeStatus, NodeCapabilities, PlatformRef, CreateNodeRequest, UpdateNodeRequest, TestConnectionResponse, NodeListResponse, NodeResponse exportes depuis @wakehub/shared.
- Task 3 : Interface PlatformConnector (4 methodes) + classe PlatformError (code, message, platform, details). 5 tests unitaires.
- Task 4 : Connecteur WolSshConnector (testConnection SSH, start WoL, stop SSH shutdown, getStatus TCP ping). 11 tests unitaires avec mocks.
- Task 5 : ConnectorFactory avec getConnector(nodeType) retournant WolSshConnector pour 'physical'. 5 tests unitaires.
- Task 6 : Routes POST /api/nodes, GET /api/nodes, POST /api/nodes/:id/test-connection. Chiffrement AES-256-GCM des credentials, logging operation_logs, sanitization (pas de credentials en reponse). 11 tests d'integration.
- Task 7 : Hooks useNodes (GET), useCreateNode (POST), useTestConnection (POST) avec apiFetch et invalidation cache.
- Task 8 : Page NodesPage avec etat vide, liste noeuds, bouton "+". Route /nodes dans AuthGuard. Lien "Noeuds" avec IconServer dans navigation.
- Task 9 : AddMachineWizard avec Mantine Stepper 3 etapes (formulaire, test connexion, confirmation). Validation IP/MAC regex, auto-test SSH, option forcer l'ajout.
- Task 10 : 5 tests page Noeuds + 8 tests wizard = 13 tests frontend. Total suite : 84 server + 39 web = 123 tests (tous passent).

### Change Log

- 2026-02-12 : Implementation complete de Story 2.1 — Ajout machine physique & base technique

### File List

**Nouveaux fichiers :**
- apps/server/src/db/schema.ts (MODIFIE — ajout table nodes)
- apps/server/src/connectors/connector.interface.ts
- apps/server/src/connectors/connector-factory.ts
- apps/server/src/connectors/connector-factory.test.ts
- apps/server/src/connectors/wol-ssh.connector.ts
- apps/server/src/connectors/wol-ssh.connector.test.ts
- apps/server/src/utils/platform-error.ts
- apps/server/src/utils/platform-error.test.ts
- apps/server/src/routes/nodes.routes.ts
- apps/server/src/routes/nodes.routes.test.ts
- apps/server/src/app.ts (MODIFIE — import + register nodesRoutes)
- apps/server/drizzle/0002_parched_harrier.sql
- apps/web/src/api/nodes.api.ts
- apps/web/src/features/nodes/nodes-page.tsx
- apps/web/src/features/nodes/nodes-page.test.tsx
- apps/web/src/features/nodes/add-machine-wizard.tsx
- apps/web/src/features/nodes/add-machine-wizard.test.tsx
- apps/web/src/router.tsx (MODIFIE — ajout route /nodes)
- apps/web/src/components/layout/navigation.tsx (MODIFIE — ajout lien Noeuds)
- packages/shared/src/models/node.ts
- packages/shared/src/api/nodes.ts
- packages/shared/src/index.ts (MODIFIE — re-exports)
