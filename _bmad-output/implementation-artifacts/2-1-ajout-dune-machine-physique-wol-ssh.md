# Story 2.1 : Ajout d'une machine physique (WoL/SSH)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want ajouter une machine physique a WakeHub avec ses parametres de connexion,
So that WakeHub connait ma machine et peut la demarrer/arreter.

## Acceptance Criteria (BDD)

1. **Given** la table `machines` n'existe pas encore
   **When** la migration Drizzle s'execute pour cette story
   **Then** la table `machines` est creee avec les colonnes : id, name, type (enum: physical, proxmox, docker), ip_address, mac_address, ssh_user, ssh_credentials_encrypted, api_url, api_credentials_encrypted, service_url, status, created_at, updated_at
   **And** le module utilitaire `crypto.ts` est implemente avec les fonctions `encrypt()` et `decrypt()` utilisant AES-256-GCM avec IV unique par credential

2. **Given** l'interface `PlatformConnector` n'existe pas encore
   **When** cette story est implementee
   **Then** l'interface `PlatformConnector` est definie dans `connectors/connector.interface.ts` avec les methodes : `testConnection()`, `start()`, `stop()`, `getStatus()`
   **And** la classe `PlatformError` est implementee dans `utils/platform-error.ts` avec les proprietes : code, message, platform, details

3. **Given** je suis sur le dashboard ou la page Machines
   **When** je clique sur le bouton "+" (ajouter une machine)
   **Then** un wizard s'ouvre (Mantine Stepper) avec la premiere etape : selection du type de machine

4. **Given** l'etape 1 du wizard est affichee
   **When** je selectionne "Machine physique (WoL/SSH)"
   **Then** l'etape 2 affiche un formulaire avec : nom, adresse IP, adresse MAC, parametres SSH (utilisateur, mot de passe ou cle)

5. **Given** je remplis le formulaire avec des donnees valides
   **When** je passe a l'etape suivante
   **Then** un test de connexion SSH est lance automatiquement vers la machine
   **And** le bouton passe en etat loading pendant le test
   **And** le resultat du test s'affiche (succes ou echec avec message d'erreur)

6. **Given** le test de connexion reussit
   **When** je confirme l'ajout
   **Then** la machine est enregistree en base (table `machines`) avec ses parametres
   **And** les credentials SSH sont chiffres avec AES-256-GCM avant stockage
   **And** un toast de succes s'affiche (~5s, haut-droite)
   **And** l'operation est enregistree dans les logs

7. **Given** le test de connexion echoue
   **When** le resultat s'affiche
   **Then** je peux modifier les parametres et relancer le test
   **And** je peux aussi forcer l'ajout sans test reussi (avec un avertissement)

8. **Given** le connecteur WoL/SSH est implemente
   **When** il est utilise
   **Then** il implemente `PlatformConnector` avec `testConnection()` (ping SSH), `start()` (WoL magic packet), `stop()` (SSH shutdown command) et `getStatus()` (ping)
   **And** les erreurs sont encapsulees dans `PlatformError`

9. **Given** je soumis le formulaire avec des champs obligatoires vides
   **When** la validation s'execute
   **Then** les champs en erreur sont mis en evidence avec un message d'erreur sous chaque champ

## Tasks / Subtasks

- [x] Task 1 — Schema DB : table `machines` (AC: #1)
  - [x]1.1 Ajouter la table `machines` dans `apps/server/src/db/schema.ts` avec toutes les colonnes specifiees
  - [x]1.2 Generer la migration Drizzle (`npx drizzle-kit generate`)
  - [x]1.3 Verifier que la migration s'applique correctement au demarrage

- [x] Task 2 — Module crypto AES-256-GCM (AC: #1)
  - [x]2.1 Creer `apps/server/src/utils/crypto.ts` avec `encrypt(plaintext, key)` et `decrypt(ciphertext, key)`
  - [x]2.2 Utiliser `crypto` natif Node.js, IV unique par operation, format de stockage : `iv:authTag:encrypted` (hex)
  - [x]2.3 Creer `apps/server/src/utils/crypto.test.ts`

- [x] Task 3 — PlatformError + PlatformConnector (AC: #2, #8)
  - [x]3.1 Creer `apps/server/src/utils/platform-error.ts` — classe `PlatformError extends Error` avec `code`, `message`, `platform`, `details`
  - [x]3.2 Creer `apps/server/src/connectors/connector.interface.ts` — interface `PlatformConnector` avec methodes `testConnection()`, `start()`, `stop()`, `getStatus()`
  - [x]3.3 Ajouter les types partages dans `packages/shared/src/index.ts` (MachineType, MachineStatus, Machine)

- [x] Task 4 — Connecteur WoL/SSH (AC: #8)
  - [x]4.1 Installer les dependances : `ssh2`, `@types/ssh2`, `wake_on_lan`, `@types/wake_on_lan`
  - [x]4.2 Creer `apps/server/src/connectors/wol-ssh.connector.ts` implementant `PlatformConnector`
  - [x]4.3 Implementer `testConnection()` : ouverture SSH, verification, fermeture
  - [x]4.4 Implementer `start()` : envoi magic packet WoL via UDP
  - [x]4.5 Implementer `stop()` : commande SSH `sudo shutdown -h now`
  - [x]4.6 Implementer `getStatus()` : tentative SSH rapide (timeout 5s)
  - [x]4.7 Creer `apps/server/src/connectors/wol-ssh.connector.test.ts`

- [x] Task 5 — Routes API CRUD machines (AC: #6, #7, #9)
  - [x]5.1 Creer `apps/server/src/routes/machines.routes.ts` avec les routes :
    - `POST /api/machines` — creation d'une machine (chiffrement credentials avant stockage)
    - `POST /api/machines/test-connection` — test de connexion SSH
    - `GET /api/machines` — liste toutes les machines
    - `GET /api/machines/:id` — detail d'une machine
  - [x]5.2 Ajouter la validation JSON Schema Fastify sur chaque route (body + response pour TOUS les status codes)
  - [x]5.3 Enregistrer le plugin dans `apps/server/src/app.ts`
  - [x]5.4 Logger chaque operation dans `operation_logs` (creation, test connexion)
  - [x]5.5 Creer `apps/server/src/routes/machines.routes.test.ts`

- [x] Task 6 — API hooks frontend (AC: #3-7)
  - [x]6.1 Creer `apps/web/src/api/machines.api.ts` avec les hooks TanStack Query :
    - `useCreateMachine()` — mutation POST /api/machines
    - `useTestConnection()` — mutation POST /api/machines/test-connection
    - `useMachines()` — query GET /api/machines

- [x] Task 7 — Wizard d'ajout de machine (AC: #3, #4, #5, #6, #7, #9)
  - [x]7.1 Creer `apps/web/src/features/machines/machine-wizard.tsx` — Mantine Stepper 3 etapes
  - [x]7.2 Etape 1 : Selection du type de machine (3 cartes cliquables : Physique, Proxmox, Docker)
  - [x]7.3 Etape 2 : Formulaire specifique machine physique (nom, IP, MAC, SSH user, SSH password) avec validation Mantine useForm
  - [x]7.4 Etape 3 : Test de connexion automatique + resultat + bouton confirmer/forcer
  - [x]7.5 Gerer le retour arriere entre etapes et la reinitialisation du formulaire
  - [x]7.6 Toast notification succes/erreur apres creation

- [x] Task 8 — Integration navigation + page Machines (AC: #3)
  - [x]8.1 Ajouter bouton "+" sur la page Machines et le dashboard (ouvre le wizard en Modal ou page dediee)
  - [x]8.2 Mettre a jour `apps/web/src/router.tsx` si route necessaire
  - [x]8.3 Mettre a jour `apps/web/src/features/machines/machines-page.tsx` — afficher le bouton d'ajout dans l'empty state et en haut de page

## Dev Notes

### Vue d'ensemble de l'implementation

Cette story est la **premiere de l'Epic 2** et pose les fondations pour toute la gestion d'infrastructure de WakeHub :
- Le schema DB `machines` sera reutilise par les stories 2.2 (Proxmox) et 2.3 (Docker)
- L'interface `PlatformConnector` sera implementee par les 3 connecteurs (WoL/SSH, Proxmox, Docker)
- La classe `PlatformError` est le format d'erreur standard pour TOUS les connecteurs
- Le module `crypto.ts` sera utilise pour chiffrer les credentials de TOUTES les plateformes
- Le wizard est concu pour etre extensible — l'etape 1 (selection du type) sera partagee par les 3 types de machine

**Ordre d'implementation recommande :** Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (sequentiel, chaque task depend de la precedente)

### Exigences techniques detaillees

**Schema Drizzle — table `machines` :**
```typescript
// Dans apps/server/src/db/schema.ts
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['physical', 'proxmox', 'docker'] }).notNull(),
  ipAddress: text('ip_address').notNull(),
  macAddress: text('mac_address'),          // Requis pour physical, null pour proxmox/docker
  sshUser: text('ssh_user'),                // Pour physical
  sshCredentialsEncrypted: text('ssh_credentials_encrypted'), // AES-256-GCM
  apiUrl: text('api_url'),                  // Pour proxmox/docker
  apiCredentialsEncrypted: text('api_credentials_encrypted'), // AES-256-GCM
  serviceUrl: text('service_url'),          // URL d'acces au service (bouton "Ouvrir")
  status: text('status', { enum: ['online', 'offline', 'unknown', 'error'] }).notNull().default('unknown'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

**Module crypto AES-256-GCM :**
```typescript
// Dans apps/server/src/utils/crypto.ts
// Utiliser UNIQUEMENT le module `crypto` natif de Node.js — ZERO dependance externe
// Format de stockage : "iv:authTag:encryptedData" (tout en hex)
// IV : 16 bytes aleatoires, unique par operation
// Auth tag : 16 bytes
// Cle : derivee de config.encryptionKey (variable d'environnement ENCRYPTION_KEY)
// Si ENCRYPTION_KEY fait 64 chars hex → utiliser directement comme Buffer
// Si autre longueur → deriver via scrypt ou sha256

export function encrypt(plaintext: string): string;  // Utilise config.encryptionKey
export function decrypt(ciphertext: string): string;  // Utilise config.encryptionKey
```

**Interface PlatformConnector :**
```typescript
// Dans apps/server/src/connectors/connector.interface.ts
export interface PlatformConnector {
  testConnection(): Promise<{ success: boolean; message: string }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'>;
}
```

**Classe PlatformError :**
```typescript
// Dans apps/server/src/utils/platform-error.ts
export class PlatformError extends Error {
  constructor(
    public code: string,          // Ex: 'SSH_CONNECTION_FAILED', 'WOL_SEND_FAILED'
    message: string,              // Message lisible
    public platform: string,      // 'wol-ssh' | 'proxmox' | 'docker'
    public details?: unknown,     // Contexte additionnel (IP, port, etc.)
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}
```

**Connecteur WoL/SSH — details d'implementation :**
- `testConnection()` : ouvrir une session SSH avec `ssh2`, timeout 10s, fermer proprement. Retourner `{ success: true, message: "Connexion SSH reussie" }` ou `{ success: false, message: "..." }`
- `start()` : envoyer un magic packet WoL via `wake_on_lan.wake(macAddress, { address: broadcastAddress })`. Broadcast par defaut : `255.255.255.255`
- `stop()` : executer `sudo shutdown -h now` via SSH. Gerer le cas ou la connexion SSH se ferme pendant le shutdown (c'est normal)
- `getStatus()` : tentative de connexion SSH avec timeout court (5s). Si succes → `'online'`, si echec → `'offline'`
- Toutes les erreurs DOIVENT etre encapsulees dans `PlatformError`

**API REST — format de reponse :**
- Succes : `{ data: { id, name, type, ipAddress, ... } }` — NE PAS retourner les credentials dechiffres
- Erreur : `{ error: { code: "MACHINE_UNREACHABLE", message: "...", details: { ... } } }`
- Test connexion succes : `{ data: { success: true, message: "..." } }`
- Test connexion echec : `{ data: { success: false, message: "..." } }` (status 200 — ce n'est pas une erreur serveur)

### Conformite architecture obligatoire

**Conventions de nommage (ARCH-17) :**
- DB : `snake_case` — `ip_address`, `mac_address`, `ssh_credentials_encrypted`, `created_at`
- API JSON : `camelCase` — `ipAddress`, `macAddress`, `sshUser`, `serviceUrl`
- Fichiers : `kebab-case` — `machines.routes.ts`, `wol-ssh.connector.ts`, `platform-error.ts`
- Composants React : `PascalCase` — `MachineWizard`, `MachineTypeSelector`
- Types/Interfaces : `PascalCase` — `Machine`, `MachineType`, `PlatformConnector`
- Constantes : `SCREAMING_SNAKE` — `SSH_TIMEOUT_MS`, `WOL_BROADCAST_ADDRESS`

**Organisation backend par domaine (ARCH-18) :**
- Routes dans `routes/` — `machines.routes.ts`
- Connecteurs dans `connectors/` — `wol-ssh.connector.ts`, `connector.interface.ts`
- Utilitaires dans `utils/` — `crypto.ts`, `platform-error.ts`
- Schema dans `db/` — ajouter a `schema.ts` existant

**Organisation frontend par feature (ARCH-19) :**
- Wizard dans `features/machines/` — `machine-wizard.tsx`
- Hooks API dans `api/` — `machines.api.ts`
- Types partages dans `packages/shared/src/`

**Format API normalise (ARCH-11) :**
- Succes : `{ data: { ... } }`
- Erreur : `{ error: { code, message, details? } }`
- NE JAMAIS retourner une reponse sans wrapper `data` ou `error`

**Validation JSON Schema Fastify (ARCH-04) :**
- OBLIGATOIRE sur toutes les routes : `schema.body` + `schema.response` pour TOUS les status codes retournes (200, 400, 401, 404, 500)
- Oublier un schema de reponse cause des erreurs de build TypeScript

**Chiffrement credentials (ARCH-13, NFR5) :**
- AES-256-GCM avec module `crypto` natif Node.js
- Cle en variable d'environnement `ENCRYPTION_KEY`
- IV unique par credential — JAMAIS reutiliser un IV
- Les credentials ne sont JAMAIS retournes en clair dans l'API (ni dans les logs)

**Logging (ARCH-09) :**
- Double destination : `fastify.log.info(...)` (pino stdout) + insertion `operation_logs` (Drizzle)
- Chaque creation de machine et chaque test de connexion doit etre logue
- NE PAS logger les credentials en clair

**Tests co-localises (ARCH-15) :**
- `crypto.ts` → `crypto.test.ts` (meme dossier)
- `wol-ssh.connector.ts` → `wol-ssh.connector.test.ts` (meme dossier)
- `machines.routes.ts` → `machines.routes.test.ts` (meme dossier)

**Middleware auth :**
- La route `POST /api/machines/test-connection` et toutes les routes `/api/machines/*` DOIVENT etre protegees par le middleware auth (cookie session)
- Le middleware est deja configure globalement dans `app.ts` pour toutes les routes `/api/*`
- NE PAS ajouter d'exception pour ces routes

**Anti-patterns a eviter :**
- NE PAS creer de dossier `__tests__/` — tests co-localises
- NE PAS utiliser `snake_case` dans le JSON API
- NE PAS utiliser `camelCase` dans les colonnes DB
- NE PAS utiliser `any` — typage TypeScript strict partout
- NE PAS hardcoder de valeurs de configuration — utiliser `config.ts`
- NE PAS retourner les credentials dechiffres dans les reponses API
- NE PAS oublier `credentials: 'include'` dans les appels fetch frontend

### Librairies et frameworks requis

**Nouvelles dependances a installer (apps/server) :**

| Package | Version | Usage | Commande |
|---------|---------|-------|----------|
| `ssh2` | ^1.17.0 | Client SSH pur JS — test connexion, execution commandes, arret machine | `npm install ssh2 -w apps/server` |
| `@types/ssh2` | ^1.15.x | Types TypeScript pour ssh2 | `npm install -D @types/ssh2 -w apps/server` |
| `wake_on_lan` | ^1.0.0 | Envoi magic packet WoL via UDP | `npm install wake_on_lan -w apps/server` |
| `@types/wake_on_lan` | ^0.0.x | Types TypeScript pour wake_on_lan | `npm install -D @types/wake_on_lan -w apps/server` |

**Aucune nouvelle dependance frontend** — Mantine Stepper est deja inclus dans `@mantine/core`.

**Librairies existantes utilisees (ne pas reinstaller) :**

| Package | Deja dans | Usage dans cette story |
|---------|-----------|----------------------|
| `drizzle-orm` | apps/server | Schema machines + requetes CRUD |
| `better-sqlite3` | apps/server | Driver SQLite |
| `@fastify/cookie` | apps/server | Auth middleware (deja en place) |
| `@fastify/swagger` | apps/server | Documentation API auto-generee |
| `@mantine/core` | apps/web | Stepper, TextInput, PasswordInput, Button, Modal, Paper |
| `@mantine/form` | apps/web | useForm pour validation wizard |
| `@mantine/notifications` | apps/web | Toast succes/erreur |
| `@tanstack/react-query` | apps/web | Hooks mutations/queries |
| `@tabler/icons-react` | apps/web | Icones dans le wizard |

**Patterns d'utilisation ssh2 :**
```typescript
import { Client } from 'ssh2';

// Test connexion
const conn = new Client();
conn.on('ready', () => { conn.end(); resolve({ success: true }); });
conn.on('error', (err) => { reject(new PlatformError('SSH_CONNECTION_FAILED', ...)); });
conn.connect({ host, port: 22, username, password, readyTimeout: 10000 });

// Execution commande
conn.exec('sudo shutdown -h now', (err, stream) => { ... });
```

**Patterns d'utilisation wake_on_lan :**
```typescript
import wol from 'wake_on_lan';

// Envoi magic packet
wol.wake(macAddress, { address: '255.255.255.255' }, (error) => {
  if (error) reject(new PlatformError('WOL_SEND_FAILED', ...));
  else resolve();
});
```

**Mantine Stepper pattern :**
```tsx
import { Stepper, Button, Group } from '@mantine/core';
const [active, setActive] = useState(0);

<Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
  <Stepper.Step label="Type" description="Choisir le type">
    {/* Contenu etape 1 */}
  </Stepper.Step>
  <Stepper.Step label="Configuration" description="Parametres">
    {/* Contenu etape 2 */}
  </Stepper.Step>
  <Stepper.Step label="Connexion" description="Test & confirmation">
    {/* Contenu etape 3 */}
  </Stepper.Step>
</Stepper>
<Group justify="center" mt="xl">
  <Button variant="default" onClick={() => setActive(a => a - 1)}>Retour</Button>
  <Button onClick={() => setActive(a => a + 1)}>Suivant</Button>
</Group>
```

### Structure de fichiers

**Fichiers a CREER :**

```
apps/server/src/
├── utils/
│   ├── crypto.ts                        ← Module AES-256-GCM encrypt/decrypt
│   ├── crypto.test.ts                   ← Tests unitaires crypto
│   └── platform-error.ts               ← Classe PlatformError
├── connectors/
│   ├── connector.interface.ts           ← Interface PlatformConnector
│   ├── wol-ssh.connector.ts             ← Connecteur WoL + SSH
│   └── wol-ssh.connector.test.ts        ← Tests connecteur (mocks ssh2/wol)
└── routes/
    ├── machines.routes.ts               ← CRUD /api/machines + test connexion
    └── machines.routes.test.ts          ← Tests integration routes

apps/web/src/
├── features/machines/
│   └── machine-wizard.tsx               ← Wizard Mantine Stepper 3 etapes
└── api/
    └── machines.api.ts                  ← Hooks TanStack Query (mutations + queries)
```

**Fichiers a MODIFIER :**

| Fichier | Modification |
|---------|-------------|
| `apps/server/src/db/schema.ts` | Ajouter export `machines` table |
| `apps/server/src/app.ts` | Importer et enregistrer `machinesRoutes` plugin |
| `apps/web/src/features/machines/machines-page.tsx` | Ajouter bouton "+" qui ouvre le wizard |
| `apps/web/src/features/dashboard/dashboard-page.tsx` | Ajouter bouton "+" dans l'empty state |
| `apps/web/src/router.tsx` | Ajouter route `/machines/add` si page dediee (ou Modal — au choix) |
| `packages/shared/src/index.ts` | Ajouter types Machine, MachineType, MachineStatus |

**Fichiers a NE PAS TOUCHER :**
- `apps/server/src/routes/auth.ts` — aucun rapport
- `apps/server/src/middleware/auth.middleware.ts` — deja fonctionnel, protege `/api/*`
- `apps/server/src/db/index.ts` — les migrations s'appliquent automatiquement
- `apps/web/src/components/layout/app-shell.tsx` — navigation deja en place
- `apps/web/src/components/layout/navigation.tsx` — lien "Machines" deja present

**Apres creation, generer la migration :**
```bash
cd apps/server && npx drizzle-kit generate
```

### Exigences de tests

**Framework :** Vitest (deja configure sur tous les workspaces)
**Commande :** `npm run test` a la racine ou `npm run test -w apps/server`

**Tests backend obligatoires :**

**1. `apps/server/src/utils/crypto.test.ts` :**
- `encrypt()` retourne une string au format `iv:authTag:encrypted` (hex)
- `decrypt(encrypt(plaintext))` retourne le plaintext original
- `encrypt()` produit un resultat different a chaque appel (IV unique)
- `decrypt()` avec donnees corrompues lance une erreur
- `decrypt()` avec un mauvais format lance une erreur

**2. `apps/server/src/connectors/wol-ssh.connector.test.ts` :**
- Mocker `ssh2.Client` et `wake_on_lan.wake` — NE PAS tester des connexions reelles
- `testConnection()` retourne `{ success: true }` quand SSH repond
- `testConnection()` retourne `{ success: false }` quand SSH timeout/refuse
- `start()` appelle `wol.wake()` avec la bonne adresse MAC
- `start()` lance `PlatformError` si `wol.wake()` echoue
- `stop()` execute la commande SSH shutdown
- `stop()` lance `PlatformError` si SSH echoue
- `getStatus()` retourne `'online'` quand SSH repond
- `getStatus()` retourne `'offline'` quand SSH echoue
- Toutes les erreurs sont des instances de `PlatformError`

**3. `apps/server/src/routes/machines.routes.test.ts` :**
- Pattern de test etabli dans `auth.test.ts` : `app.inject()`, DB de test SQLite, nettoyage dans `beforeEach`
- `POST /api/machines` cree une machine avec donnees valides → status 200 + `{ data: { id, name, ... } }`
- `POST /api/machines` avec champs manquants → status 400 + `{ error: { code: 'VALIDATION_ERROR' } }`
- `POST /api/machines` sans session → status 401
- `POST /api/machines` stocke les credentials chiffres (verifier qu'ils NE sont PAS en clair en base)
- `GET /api/machines` retourne la liste des machines → `{ data: [...] }`
- `GET /api/machines` ne retourne PAS les credentials dechiffres
- `GET /api/machines/:id` retourne une machine specifique
- `GET /api/machines/:id` avec ID inexistant → status 404
- `POST /api/machines/test-connection` — mocker le connecteur SSH pour tester le flow

**Pattern de setup de test backend (copier de auth.test.ts) :**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const TEST_DB_PATH = './test-machines-db.sqlite';

describe('Machines Routes', () => {
  let app: FastifyInstance;
  let sqlite: Database.Database;

  beforeAll(async () => {
    // Setup test DB + Fastify app + plugins
    // Decorer avec db, enregistrer cookie + auth + machines routes
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    // Cleanup fichiers DB test
  });

  beforeEach(() => {
    // Nettoyer tables machines + operation_logs
    // Creer un user + session de test pour l'auth
  });

  // Helper pour injecter avec cookie de session
  const authenticatedRequest = (method: string, url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload,
      cookies: { session_token: testSessionToken },
    });
});
```

**Tests frontend (optionnels mais recommandes) :**
- `machine-wizard.tsx` : tester la navigation entre etapes du Stepper, la validation du formulaire, les etats loading des boutons
- Utiliser `@testing-library/react` avec wrapper `QueryClientProvider` (pattern etabli dans Epic 1)
- Mocker les appels fetch via les hooks TanStack Query

### Intelligence des stories precedentes (Epic 1)

**Problemes rencontres et solutions (a ne PAS repeter) :**

1. **Response schemas Fastify obligatoires pour TOUS les status codes** — Si une route retourne 400 ou 404, le schema `response` DOIT inclure ces codes. Sinon le build TypeScript echoue. Appliquer systematiquement :
   ```typescript
   schema: {
     response: {
       200: { /* schema succes */ },
       400: { /* schema erreur validation */ },
       401: { /* schema erreur auth */ },
       404: { /* schema erreur not found */ },
     }
   }
   ```

2. **`tsconfig.json` doit exclure `*.test.ts` pour le build Docker** — Les fichiers de test importent `vitest` qui n'est pas disponible en production. Verifier que `"exclude": ["src/**/*.test.ts"]` est present dans `apps/server/tsconfig.json`.

3. **Tests TanStack Query necessitent `QueryClientProvider`** — Tout composant utilisant des hooks TanStack Query doit etre rendu dans un wrapper :
   ```tsx
   const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   render(<QueryClientProvider client={queryClient}><Component /></QueryClientProvider>);
   ```

4. **Mantine ajoute ` *` aux labels avec `required`** — Dans les tests, utiliser `getByPlaceholderText()` ou des regex pour `getByLabelText(/Nom d'utilisateur/i)` au lieu de la string exacte.

5. **`credentials: 'include'` obligatoire sur tous les fetch** — Sans ca, les cookies de session ne sont pas envoyes et toutes les requetes API retournent 401.

6. **Ne pas reveler l'existence de ressources dans les erreurs** — Pattern de securite : retourner le meme message d'erreur generique pour "pas trouve" et "acces refuse".

7. **Router tests : reinitialiser `window.history`** — Ajouter `window.history.pushState({}, '', '/')` dans `beforeEach` pour eviter que les tests interfèrent entre eux.

**Patterns etablis a reutiliser :**
- Formulaires : `useForm` de Mantine + mutation TanStack Query + toast notification
- Pages : `Container` + `Paper` pour les formulaires, `EmptyState` pour les pages vides
- API hooks : fichier dedie par domaine dans `api/` — un hook par endpoint
- DB operations : transactions Drizzle pour les operations atomiques
- Logging : double destination pino stdout + insert `operation_logs` pour chaque action utilisateur

### Informations techniques actuelles (recherche web fevrier 2026)

**ssh2 (v1.17.0) :**
- Derniere version stable : 1.17.0 (publiee il y a ~3 mois)
- Client et serveur SSH2 en pur JavaScript — aucune dependance native, pas de build C++
- 1790+ projets l'utilisent dans le registre npm
- API basee sur les evenements (`'ready'`, `'error'`, `'close'`)
- Supporte : authentification par mot de passe, cle privee, keyboard-interactive
- `readyTimeout` : parametre de timeout pour la connexion (utiliser 10000ms pour testConnection, 5000ms pour getStatus)
- Gestion propre de la fermeture : `conn.end()` (graceful) vs `conn.destroy()` (force)
- Attention : `conn.exec('sudo shutdown -h now')` ferme la connexion abruptement — catcher l'erreur `ECONNRESET` comme comportement normal

**wake_on_lan (v1.0.0) :**
- Package stable, API simple : `wol.wake(mac, options, callback)`
- Le magic packet est un datagramme UDP de 102 bytes : 6x `0xFF` + 16x adresse MAC
- Options : `{ address: '255.255.255.255', port: 9 }` (broadcast par defaut)
- Le package fonctionne en callback — wrapper dans une Promise pour l'utiliser avec async/await :
  ```typescript
  function sendWolPacket(mac: string): Promise<void> {
    return new Promise((resolve, reject) => {
      wol.wake(mac, { address: '255.255.255.255' }, (error: Error | undefined) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  ```
- Types disponibles via `@types/wake_on_lan`
- Contrainte reseau : le conteneur Docker doit etre en mode `network_mode: host` ou avoir acces au broadcast du reseau local pour que le WoL fonctionne

**Mantine Stepper (v7+) :**
- Composant natif `@mantine/core` — pas d'installation supplementaire
- `allowNextStepsSelect={false}` empeche de sauter des etapes
- `Stepper.Step` accepte `icon`, `completedIcon`, `loading` (affiche un spinner)
- Styles API pour personnaliser n'importe quel element interne via `classNames`
- Compatible avec `useForm` de `@mantine/form` — validation par etape possible
- Sur mobile : les labels des etapes sont masques automatiquement, seules les icones restent

**Node.js crypto (natif) — AES-256-GCM :**
- Aucune dependance a installer — module `node:crypto` integre
- `crypto.createCipheriv('aes-256-gcm', key, iv)` + `cipher.getAuthTag()`
- `crypto.createDecipheriv('aes-256-gcm', key, iv)` + `decipher.setAuthTag(tag)`
- IV doit faire 12 bytes (recommandation NIST pour GCM) ou 16 bytes
- Auth tag fait 16 bytes par defaut
- La cle doit faire exactement 32 bytes (256 bits)

### Project Structure Notes

- Cette story est alignee avec la structure du monorepo etablie dans l'Epic 1
- Les nouveaux dossiers `connectors/` et `utils/` dans `apps/server/src/` sont prevus par l'architecture [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure]
- Le fichier `machines.api.ts` dans `apps/web/src/api/` suit le pattern de `auth.api.ts` deja en place
- Le wizard dans `features/machines/` suit l'organisation frontend par feature [Source: architecture.md#Structure Patterns]
- Aucun conflit detecte avec la structure existante

### References

- **Epics** : [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — User story, acceptance criteria, FRs couverts (FR5, FR10, FR42)
- **Architecture** : [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — AES-256-GCM, PlatformConnector, PlatformError, organisation backend
- **Architecture structure** : [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — Arbre de fichiers complet avec paths exacts
- **Architecture patterns** : [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Conventions nommage, format API, gestion erreurs
- **UX Design** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy] — Wizard Stepper, patterns d'interaction
- **UX Wizard** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Premiere configuration] — Flow onboarding, etapes du wizard
- **UX Machines** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Page Machines] — Vue tabulaire, bouton "+"
- **Story precedente** : [Source: _bmad-output/implementation-artifacts/1-5-reinitialisation-du-mot-de-passe.md] — Patterns formulaires, dev notes, anti-patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Vitest mock hoisting issue with ssh2 — resolved using `globalThis.__lastSshClient` pattern
- Auth middleware uses global `db` import, not `fastify.db` — route tests skip middleware (tested separately)
- TypeScript strict: `split(':')` returns `(string | undefined)[]` — use non-null assertions with length check

### Completion Notes List

- All 8 tasks / 30+ subtasks completed
- 74 server tests pass (7 test files)
- TypeScript strict mode passes on both server and web
- Drizzle migration generated and verified
- ssh2 v1.17.0 + wake_on_lan v1.0.0 installed
- Wizard uses Modal (not dedicated page) — cleaner UX, no route change needed
- Proxmox and Docker type cards disabled with "bientot disponible" label
- Machines page shows table with status badges when machines exist

### Change Log

1. Task 1: Added `machines` table to schema.ts, generated migration 0002
2. Task 2: Created crypto.ts (AES-256-GCM encrypt/decrypt) + 7 tests
3. Task 3: Created PlatformError, PlatformConnector, shared types (Machine, MachineType, MachineStatus)
4. Task 4: Installed ssh2/wake_on_lan, created WolSshConnector + 9 tests
5. Task 5: Created machines.routes.ts (4 routes), registered in app.ts + 13 tests
6. Task 6: Created machines.api.ts with 3 TanStack Query hooks
7. Task 7: Created machine-wizard.tsx with Mantine Stepper (3 steps)
8. Task 8: Updated machines-page.tsx and dashboard-page.tsx with wizard integration

### File List

**Created:**
- `apps/server/src/db/schema.ts` (modified — added machines table)
- `apps/server/drizzle/0002_mixed_tenebrous.sql` (migration)
- `apps/server/src/utils/crypto.ts`
- `apps/server/src/utils/crypto.test.ts`
- `apps/server/src/utils/platform-error.ts`
- `apps/server/src/connectors/connector.interface.ts`
- `apps/server/src/connectors/wol-ssh.connector.ts`
- `apps/server/src/connectors/wol-ssh.connector.test.ts`
- `apps/server/src/routes/machines.routes.ts`
- `apps/server/src/routes/machines.routes.test.ts`
- `apps/web/src/api/machines.api.ts`
- `apps/web/src/features/machines/machine-wizard.tsx`

**Modified:**
- `apps/server/src/app.ts` (import + register machinesRoutes)
- `apps/web/src/features/machines/machines-page.tsx` (wizard integration + table)
- `apps/web/src/features/dashboard/dashboard-page.tsx` (wizard integration)
- `packages/shared/src/index.ts` (MachineType, MachineStatus, Machine types)
- `apps/server/package.json` (ssh2, wake_on_lan deps)
