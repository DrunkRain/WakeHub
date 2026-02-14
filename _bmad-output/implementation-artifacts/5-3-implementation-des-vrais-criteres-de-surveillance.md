# Story 5.3 : Implémentation des vrais critères de surveillance — CORRECTIONS

Status: done

<!-- Créé: 2026-02-14 | Epic 5: Arrêt Automatique sur Inactivité | FRs: FR34 (étendu) -->
<!-- Course Correction: 2026-02-14 — 4 bugs identifiés empêchant l'arrêt auto des containers -->
<!-- Ref: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-14.md -->

## Story

As a administrateur,
I want que WakeHub vérifie réellement l'activité CPU/RAM, les connexions réseau et l'accessibilité HTTP/HTTPS de mes services,
So that l'arrêt automatique se base sur des données concrètes et pas seulement sur un check TCP port 22.

## Acceptance Criteria (BDD)

### AC1 : Vérification CPU/RAM via SSH

**Given** un nœud actif a le critère `cpuRamActivity` activé
**When** le moniteur vérifie l'activité
**Then** il exécute une commande SSH sur le nœud pour lire la charge CPU et l'utilisation RAM
**And** si CPU load (1 min) > 0.5 OU RAM usage > 50% → le nœud est considéré actif

### AC2 : Vérification connexions réseau via SSH

**Given** un nœud actif a le critère `networkConnections` activé
**When** le moniteur vérifie l'activité
**Then** il exécute une commande SSH sur le nœud pour compter les connexions réseau établies (TCP)
**And** si des connexions sont présentes (hors port 22 monitoring) → le nœud est considéré actif

### AC3 : Vérification accessibilité HTTP/HTTPS

**Given** un nœud actif a le critère `httpAccess` activé et un `httpUrl` configuré
**When** le moniteur vérifie l'activité
**Then** il envoie une requête HTTP/HTTPS HEAD vers l'URL du service
**And** si le service répond (2xx ou 3xx) → le nœud est considéré actif

### AC4 : Extension type et UI

**Given** le type `MonitoringCriteria` est étendu
**When** le nouveau champ `httpAccess` et `httpUrl` sont ajoutés
**Then** l'UI affiche une 4ème checkbox "Accès HTTP/HTTPS" avec un champ URL conditionnel
**And** les labels "(bientôt)" sont retirés des critères désormais fonctionnels
**And** les checkboxes `networkConnections` et `cpuRamActivity` deviennent interactives

### AC5 : Safe fallback sans credentials SSH

**Given** un nœud n'a pas de credentials SSH (`sshUser` ou `ipAddress` manquant)
**When** les critères `cpuRamActivity` ou `networkConnections` sont activés
**Then** le check retourne "actif" (safe fallback) et un warning est loggé

### AC6 : Containers Docker avec critères par défaut (NOUVEAU — Course Correction)

**Given** un container Docker a les critères par défaut (`lastAccess: true`, le reste `false`)
**When** le moniteur vérifie l'activité
**Then** le check `lastAccess` utilise les stats API Docker (CPU/RAM via `platformStats`) comme substitut au TCP port 22
**And** si CPU > seuil OU RAM > seuil → le container est considéré actif
**And** si CPU et RAM sous les seuils → le container est considéré inactif (arrêt auto peut se déclencher)

### AC7 : Formule CPU Docker correcte (NOUVEAU — Course Correction)

**Given** le connecteur Docker récupère les stats d'un container
**When** `getStats()` calcule l'utilisation CPU
**Then** la formule utilise `(cpuDelta / systemDelta) * online_cpus`
**And** la valeur retournée est cohérente avec l'échelle Proxmox et SSH (0.0 à ~N cores)

### AC8 : RAM Docker sans page cache (NOUVEAU — Course Correction)

**Given** le connecteur Docker récupère les stats d'un container
**When** `getStats()` calcule l'utilisation RAM
**Then** le page cache (`inactive_file`) est soustrait de `memory_stats.usage`
**And** la valeur reflète la mémoire applicative réelle

### AC9 : Arrêt gracieux Proxmox (NOUVEAU — Course Correction)

**Given** le système arrête une VM ou un LXC Proxmox
**When** `stop()` est appelé sur le connecteur Proxmox
**Then** il utilise l'endpoint `/status/shutdown` (signal ACPI gracieux) au lieu de `/status/stop` (hard kill)

## Tasks / Subtasks

### Tasks déjà complétées (implémentation initiale)

- [x] **Task 1-8** : Implémentation initiale complète — voir section "Completion Notes" en bas

### Tasks de correction (Course Correction 2026-02-14)

- [x] **Task 9 : Correction critique — lastAccess pour containers Docker** (AC: #6)
  - [x] 9.1 Dans `apps/server/src/services/inactivity-monitor.ts`, fonction `checkActivity()`, après le bloc `if (criteria.lastAccess)` existant (lignes 167-172), ajouter un fallback pour les containers :
    ```typescript
    if (criteria.lastAccess) {
      if (nodeType !== 'container') {
        // Physical/VM/LXC: TCP port 22 check
        enabledChecks.push(() => checkLastAccess(node));
      }
      if (nodeType === 'container' && platformStats) {
        // Containers: no SSH — use platform API stats as substitute
        const stats = platformStats;
        enabledChecks.push(async () =>
          stats.cpuUsage > CPU_LOAD_THRESHOLD || stats.ramUsage > RAM_USAGE_THRESHOLD,
        );
      }
    }
    ```
  - [x] 9.2 Ajouter tests dans `inactivity-monitor.test.ts` :
    - Container Docker avec `lastAccess: true` + platformStats CPU élevé → actif (compteur = 0)
    - Container Docker avec `lastAccess: true` + platformStats CPU/RAM bas → inactif (compteur incrémenté)
    - Container Docker avec `lastAccess: true` + platformStats null → safe fallback actif (enabledChecks vide)

- [x] **Task 10 : Correction formule CPU Docker** (AC: #7)
  - [x] 10.1 Dans `apps/server/src/connectors/docker.connector.ts`, fonction `getStats()`, modifier lignes 106-109 :
    ```typescript
    // OLD:
    const cpuUsage = systemDelta > 0 ? cpuDelta / systemDelta : 0;
    // NEW:
    const onlineCpus = data.cpu_stats.online_cpus || 1;
    const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus : 0;
    ```
  - [x] 10.2 Mettre à jour le test `getStats` existant dans `docker.connector.test.ts` : la valeur attendue change car elle est maintenant multipliée par `online_cpus`. Le mock existant utilise `online_cpus: 2` donc `cpuUsage` attendu passe de `0.1` à `0.2` (ou ajuster le mock)
  - [x] 10.3 Ajouter test : `online_cpus` manquant ou 0 → fallback à 1 (pas de division par zéro)

- [x] **Task 11 : Correction RAM Docker (soustraire le cache)** (AC: #8)
  - [x] 11.1 Dans `docker.connector.ts`, enrichir l'interface `DockerStatsResponse` (lignes 33-36) :
    ```typescript
    memory_stats: {
      usage: number;
      limit: number;
      stats?: { inactive_file?: number };
    };
    ```
  - [x] 11.2 Modifier le calcul RAM (ligne 111) :
    ```typescript
    // OLD:
    const ramUsage = data.memory_stats.limit > 0 ? data.memory_stats.usage / data.memory_stats.limit : 0;
    // NEW:
    const cacheUsage = data.memory_stats.stats?.inactive_file ?? 0;
    const ramUsage = data.memory_stats.limit > 0 ? (data.memory_stats.usage - cacheUsage) / data.memory_stats.limit : 0;
    ```
  - [x] 11.3 Mettre à jour le test `getStats` existant dans `docker.connector.test.ts` : ajouter `stats: { inactive_file: X }` dans le mock response et vérifier que la RAM retournée exclut le cache
  - [x] 11.4 Ajouter test : `stats` absent ou `inactive_file` absent → fallback au comportement actuel (pas de crash)

- [x] **Task 12 : Correction Proxmox arrêt gracieux** (AC: #9)
  - [x] 12.1 Dans `apps/server/src/connectors/proxmox.connector.ts`, fonction `stop()`, ligne 60 :
    ```typescript
    // OLD:
    await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/stop`);
    // NEW:
    await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/shutdown`);
    ```
  - [x] 12.2 Renommer le code d'erreur ligne 62 :
    ```typescript
    // OLD: 'PROXMOX_STOP_FAILED'
    // NEW: 'PROXMOX_SHUTDOWN_FAILED'
    ```
  - [x] 12.3 Mettre à jour les 3 tests `stop` dans `proxmox.connector.test.ts` :
    - VM success : vérifier endpoint `/nodes/pve1/qemu/100/status/shutdown`
    - LXC success : vérifier endpoint `/nodes/pve1/lxc/200/status/shutdown`
    - Error case : vérifier code `'PROXMOX_SHUTDOWN_FAILED'` (au lieu de `'PROXMOX_STOP_FAILED'`)

- [x] **Task 13 : Vérification finale**
  - [x] 13.1 Exécuter tous les tests backend : `npm test -w apps/server` — 358 passed, 0 régressions
  - [x] 13.2 Exécuter tous les tests frontend : `npm test -w apps/web` — 193 passed, 0 régressions
  - [x] 13.3 Vérifier TypeScript : `cd apps/server && npx tsc --noEmit` et `cd apps/web && npx tsc --noEmit` — 0 erreurs

## Dev Notes

### CONTEXTE CORRECTION (Course Correction 2026-02-14)

Les Tasks 1-8 sont déjà complétées (implémentation initiale des vrais critères). **Seules les Tasks 9-13 sont à implémenter.** Ce sont des corrections de bugs identifiés lors du review :

1. **Bug critique** : Les containers Docker avec critères par défaut (`lastAccess: true`) n'ont aucun check effectif → jamais considérés inactifs
2. **Bug formule CPU** : Manque `* online_cpus` dans Docker getStats
3. **Bug RAM cache** : `memory_stats.usage` inclut le page cache
4. **Bug Proxmox** : Hard kill au lieu d'arrêt gracieux

### Patterns architecturaux CRITIQUES à respecter

1. **Fonctions exportées, PAS de classes** — `inactivity-monitor.ts` exporte des fonctions, state dans variables de module. Les nouvelles fonctions de check sont internes (non exportées).

2. **Safe fallback PARTOUT** — Tout échec (SSH, parsing, réseau) doit retourner `true` (actif = safe). Un nœud ne doit JAMAIS être arrêté à cause d'une erreur de monitoring.

3. **NodeStats contract** : `cpuUsage: number; // 0.0 to 1.0` et `ramUsage: number; // 0.0 to 1.0` — défini dans `packages/shared/src/models/node-stats.ts`. Docker et Proxmox doivent retourner des valeurs dans cette échelle.

4. **Pas de migration DB** — Les 4 corrections sont purement dans le code applicatif.

5. **Pas de changement d'API REST** — Aucun endpoint ne change.

6. **Pas de changement frontend** — Les 4 corrections sont backend uniquement.

### Détails d'implémentation des CORRECTIONS (Tasks 9-12)

#### Task 9 — Code actuel vs code corrigé (inactivity-monitor.ts:167-172)

**Code ACTUEL** (à remplacer) :
```typescript
  if (criteria.lastAccess) {
    // Containers don't have TCP 22 — skip
    if (nodeType !== 'container') {
      enabledChecks.push(() => checkLastAccess(node));
    }
  }
```

**Code CORRIGÉ** :
```typescript
  if (criteria.lastAccess) {
    if (nodeType !== 'container') {
      // Physical/VM/LXC: TCP port 22 check
      enabledChecks.push(() => checkLastAccess(node));
    }
    if (nodeType === 'container' && platformStats) {
      // Containers: no SSH — use platform API stats as substitute
      const stats = platformStats;
      enabledChecks.push(async () =>
        stats.cpuUsage > CPU_LOAD_THRESHOLD || stats.ramUsage > RAM_USAGE_THRESHOLD,
      );
    }
  }
```

**Logique** : Le `platformStats` est déjà chargé en amont (lignes 150-163) pour les nœuds non-physical avec un parent. Pour les containers Docker, il appelle `DockerConnector.getStats()` qui retourne `{ cpuUsage, ramUsage }` via l'API Docker `/stats?stream=false`.

#### Task 10 — Formule CPU Docker (docker.connector.ts:106-109)

**Code ACTUEL** :
```typescript
      // Docker CPU usage formula: delta container usage / delta system usage * number of CPUs
      const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
      const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
      const cpuUsage = systemDelta > 0 ? cpuDelta / systemDelta : 0;
```

**Code CORRIGÉ** :
```typescript
      // Docker CPU usage formula: (delta container / delta system) * number of host CPUs
      // This gives a 0.0-1.0 range where 1.0 = one full CPU core busy
      const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
      const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
      const onlineCpus = data.cpu_stats.online_cpus || 1;
      const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus : 0;
```

#### Task 11 — Interface + RAM Docker (docker.connector.ts:33-36 et ligne 111)

**Interface ACTUELLE** :
```typescript
  memory_stats: {
    usage: number;
    limit: number;
  };
```

**Interface CORRIGÉE** :
```typescript
  memory_stats: {
    usage: number;
    limit: number;
    stats?: { inactive_file?: number };
  };
```

**Calcul RAM ACTUEL** :
```typescript
      const ramUsage = data.memory_stats.limit > 0 ? data.memory_stats.usage / data.memory_stats.limit : 0;
```

**Calcul RAM CORRIGÉ** :
```typescript
      const cacheUsage = data.memory_stats.stats?.inactive_file ?? 0;
      const ramUsage = data.memory_stats.limit > 0 ? (data.memory_stats.usage - cacheUsage) / data.memory_stats.limit : 0;
```

#### Task 12 — Proxmox shutdown (proxmox.connector.ts:60, 62)

**ACTUEL** : `await client.post(\`/nodes/\${pveNode}/\${vmType}/\${vmid}/status/stop\`);`
**CORRIGÉ** : `await client.post(\`/nodes/\${pveNode}/\${vmType}/\${vmid}/status/shutdown\`);`

**ACTUEL** : `'PROXMOX_STOP_FAILED'`
**CORRIGÉ** : `'PROXMOX_SHUTDOWN_FAILED'`

### Patterns de test pour les corrections

#### Mock connector-factory (inactivity-monitor.test.ts)

Déjà en place dans le fichier de tests :
```typescript
const mockGetStats = vi.hoisted(() => vi.fn());
const mockGetConnector = vi.hoisted(() => vi.fn());

vi.mock('../connectors/connector-factory.js', () => ({
  getConnector: mockGetConnector,
}));

// Dans beforeEach : mockGetConnector.mockReturnValue({}) — pas de getStats
// Pour tester avec platformStats :
mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.8, ramUsage: 0.2 });
mockGetConnector.mockReturnValue({ getStats: mockGetStats });
```

#### Fixtures container Docker (inactivity-monitor.test.ts)

Déjà utilisé dans les tests existants (lignes 1050+) :
```typescript
// Parent avec docker_api capability
const parentNode = await insertNode(db, {
  name: 'docker-host',
  type: 'physical',
  status: 'online',
  configured: true,
  capabilities: { docker_api: { host: '192.168.1.10', port: 2375 } },
});

// Container Docker
const containerNode = await insertNode(db, {
  name: 'jellyfin',
  type: 'container',
  status: 'online',
  configured: true,
  parentId: parentNode.id,
  ipAddress: null,
  sshUser: null,
  platformRef: { platform: 'docker', platformId: 'abc123' },
});
```

#### Mock Docker client (docker.connector.test.ts)

```typescript
const { mockPing, mockGet, mockPost } = vi.hoisted(() => ({
  mockPing: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('./docker-client.js', () => ({
  DockerClient: class {
    ping = mockPing;
    get = mockGet;
    post = mockPost;
  },
}));
```

#### Mock Proxmox client (proxmox.connector.test.ts)

```typescript
const { mockGet, mockPost, mockDestroy } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock('./proxmox-client.js', () => ({
  ProxmoxClient: class {
    get = mockGet;
    post = mockPost;
    destroy = mockDestroy;
  },
}));
```

#### Valeurs de test Docker getStats ACTUELLES (à mettre à jour)

Le test existant dans `docker.connector.test.ts` utilise ces données mock :
```typescript
mockGet.mockResolvedValueOnce({
  cpu_stats: { cpu_usage: { total_usage: 200_000_000 }, system_cpu_usage: 2_000_000_000, online_cpus: 2 },
  precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
  memory_stats: { usage: 536_870_912, limit: 1_073_741_824 },
});
```
Avec la formule ACTUELLE : `cpuUsage = 200M / 2000M = 0.1` → attendu `0.1`
Avec la formule CORRIGÉE : `cpuUsage = (200M / 2000M) * 2 = 0.2` → attendu `0.2`

Il faut aussi ajouter `stats: { inactive_file: X }` dans le mock et ajuster `ramUsage` attendu.

### Fichiers à modifier (CORRECTIONS uniquement — Tasks 9-12)

| Fichier | Correction | Task |
|---------|-----------|------|
| `apps/server/src/services/inactivity-monitor.ts` | Ajouter fallback platformStats pour containers dans `lastAccess` | 9 |
| `apps/server/src/connectors/docker.connector.ts` | Formule CPU `* onlineCpus` + interface stats + RAM sans cache | 10, 11 |
| `apps/server/src/connectors/proxmox.connector.ts` | `/status/stop` → `/status/shutdown` + code erreur | 12 |
| `apps/server/src/services/inactivity-monitor.test.ts` | Nouveaux tests container avec platformStats | 9 |
| `apps/server/src/connectors/docker.connector.test.ts` | Mise à jour assertions getStats (CPU, RAM) | 10, 11 |
| `apps/server/src/connectors/proxmox.connector.test.ts` | Mise à jour assertions stop (endpoint, error code) | 12 |

### Project Structure Notes

- **Aucun nouveau fichier** — uniquement des modifications
- **Aucune migration DB** — corrections dans le code applicatif
- **Aucun changement d'API REST** — pas de modification des routes/schemas
- **Aucun changement frontend** — corrections backend uniquement
- Les 3 fichiers de test à modifier utilisent déjà `vi.hoisted()` + `vi.mock()` — suivre les patterns existants

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-14.md — justification complète des 4 corrections]
- [Source: apps/server/src/services/inactivity-monitor.ts:167-172 — bloc lastAccess à corriger]
- [Source: apps/server/src/services/inactivity-monitor.ts:150-163 — chargement platformStats existant]
- [Source: apps/server/src/services/inactivity-monitor.ts:24-25 — constantes CPU_LOAD_THRESHOLD, RAM_USAGE_THRESHOLD]
- [Source: apps/server/src/connectors/docker.connector.ts:106-113 — formule CPU et RAM à corriger]
- [Source: apps/server/src/connectors/docker.connector.ts:23-37 — interface DockerStatsResponse à enrichir]
- [Source: apps/server/src/connectors/proxmox.connector.ts:56-71 — méthode stop() à corriger]
- [Source: apps/server/src/services/inactivity-monitor.test.ts:1050-1099 — tests containers existants]
- [Source: apps/server/src/connectors/docker.connector.test.ts:193-250 — tests getStats existants]
- [Source: apps/server/src/connectors/proxmox.connector.test.ts:183-214 — tests stop existants]
- [Source: packages/shared/src/models/node-stats.ts — interface NodeStats { cpuUsage: 0-1, ramUsage: 0-1 }]

### Intelligence Git (commits récents)

- `aa247c9` feat: implement Epic 4 (cascade, SSE, dashboard) + code review fixes
- Stories 5.1 et 5.2 non-committées sur la branche `nouvel-axe`
- node-ssh et cascade-engine stables depuis Epic 4
- L'architecture `checkActivity()` avec array de checks extensible a été conçue pour cette story

### Intelligence Stories précédentes

**Story 5.1 learnings :**
- Mock net.Socket nécessite une classe (pas vi.fn pour constructor)
- `vi.hoisted()` obligatoire pour variables mock dans `vi.mock()` factories
- Chemins tests : `join(__dirname, '../../drizzle')` (pas de chemins relatifs)
- `broadcastCascadeEvent` extrait dans `sse/broadcast-helpers.ts` lors du code review

**Story 5.2 learnings :**
- Mantine Switch : `role="switch"` (pas `role="checkbox"`)
- Mantine NumberInput : valeur DOM est string (`toHaveValue('30')`)
- `useEffect` sync sur `ruleId` (pas sur tout l'objet `rule`) pour éviter les boucles infinies
- `ApiError` depuis `@wakehub/shared` pour le typage erreur dans les hooks

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Test fix: `insertNode` helper utilisait `??` pour ipAddress/sshUser, ce qui empêchait de passer `null`. Corrigé avec `!== undefined` check pour supporter explicitement `null`.
- Test fix: Le body PUT n'inclut pas `httpUrl` quand la valeur vient du serveur (qui ne l'envoie pas). Utilisé `expect.objectContaining` pour le matcher.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- **Task 1**: Étendu `MonitoringCriteria` avec `httpAccess: boolean` et `httpUrl?: string` dans shared, schema DB, et schemas Fastify (request + response).
- **Task 2**: Implémenté `checkNetworkConnections()` — SSH `ss -tun state established`, filtrage port 22, safe fallback sans credentials ou sur erreur SSH.
- **Task 3**: Implémenté `checkCpuRamActivity()` — SSH `cat /proc/loadavg && free -m`, seuils CPU > 0.5 ou RAM > 50%, safe fallback.
- **Task 4**: Implémenté `checkHttpAccess()` — HTTP HEAD fetch avec timeout, 2xx/3xx = actif, erreur = inactif (inverse du safe fallback SSH).
- **Task 5**: Re-ajouté `decryptFn` à `checkActivity()`, connecté les 4 critères dans enabledChecks.
- **Task 6**: Activé les checkboxes network/CPU, ajouté checkbox HTTP + TextInput URL conditionnel, retiré labels "(bientôt)".
- **Task 7**: 17 nouveaux tests backend — mock node-ssh avec vi.hoisted, tests SSH (network, CPU/RAM), tests HTTP (fetch spy), tests intégration multi-critères. 43 tests total.
- **Task 8**: 3 nouveaux tests frontend — httpAccess checkbox, httpUrl TextInput conditionnel, critères enabled. 12 tests total.
- **Task 9**: Ajouté fallback `platformStats` pour containers Docker dans le bloc `lastAccess` de `checkActivity()`. 3 nouveaux tests couvrent CPU élevé (actif), CPU/RAM bas (inactif), et platformStats null (safe fallback).
- **Task 10**: Corrigé formule CPU Docker — multiplication par `onlineCpus` avec fallback à 1 si absent/0. Test existant mis à jour + 1 nouveau test.
- **Task 11**: Corrigé calcul RAM Docker — soustraction de `inactive_file` (page cache). Interface `DockerStatsResponse` enrichie avec `stats?`. 2 nouveaux tests (cache soustrait + stats absent).
- **Task 12**: Proxmox `stop()` utilise `/status/shutdown` (ACPI gracieux) au lieu de `/status/stop` (hard kill). Code erreur renommé `PROXMOX_SHUTDOWN_FAILED`. 3 tests mis à jour.
- **Task 13**: Vérification complète — 358 backend + 193 frontend = 551 tests, 0 régressions, TypeScript 0 erreurs.

### File List

- `packages/shared/src/models/inactivity-rule.ts` — Ajout `httpAccess`, `httpUrl` à `MonitoringCriteria`
- `apps/server/src/db/schema.ts` — Ajout `httpAccess: false` au JSON par défaut
- `apps/server/src/routes/inactivity-rules.routes.ts` — Extension schemas Fastify (request + response)
- `apps/server/src/services/inactivity-monitor.ts` — Implémentation checkNetworkConnections, checkCpuRamActivity, checkHttpAccess, re-ajout decryptFn + fallback platformStats pour containers (Task 9)
- `apps/server/src/services/inactivity-monitor.test.ts` — 17 + 3 nouveaux tests (SSH, HTTP, intégration, container lastAccess)
- `apps/server/src/connectors/docker.connector.ts` — Formule CPU `* onlineCpus` (Task 10) + interface stats + RAM sans cache (Task 11)
- `apps/server/src/connectors/docker.connector.test.ts` — Assertion CPU mise à jour + 3 nouveaux tests (online_cpus fallback, RAM cache, stats absent)
- `apps/server/src/connectors/proxmox.connector.ts` — `/status/stop` → `/status/shutdown` + code erreur renommé (Task 12)
- `apps/server/src/connectors/proxmox.connector.test.ts` — 3 tests stop mis à jour (endpoint shutdown, code erreur)
- `apps/web/src/features/nodes/inactivity-rules-section.tsx` — Checkboxes actives, httpAccess + TextInput URL
- `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` — 3 nouveaux tests, fixtures mises à jour

### Change Log

- 2026-02-14: Implémentation complète Story 5.3 — vrais critères de surveillance (CPU/RAM SSH, connexions réseau SSH, HTTP/HTTPS check, extension UI). 522 tests total (334 backend + 188 frontend), 0 régressions.
- 2026-02-14: Course Correction — 4 bugs corrigés : (1) lastAccess Docker containers utilise platformStats, (2) formule CPU Docker `* onlineCpus`, (3) RAM Docker soustrait page cache, (4) Proxmox shutdown gracieux. 551 tests total (358 backend + 193 frontend), 0 régressions.
- 2026-02-14: Code Review fixes — (H1) safe fallback NaN parsing dans checkCpuRamActivity, (M1) commentaire NodeStats corrigé, (M2) documentation incohérence seuil CPU, (L1) clamp RAM Docker à 0. 554 tests (358+196), 0 régressions.
