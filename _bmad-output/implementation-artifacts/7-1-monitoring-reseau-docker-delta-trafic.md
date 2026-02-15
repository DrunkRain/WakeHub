# Story 7.1: Monitoring reseau Docker (delta trafic)

Status: done

## Story

As a administrateur,
I want que WakeHub detecte l'inactivite reseau de mes conteneurs Docker via le delta de trafic,
so that les conteneurs idle mais avec un process en fond sont correctement detectes comme inactifs.

## Acceptance Criteria

1. **Given** un nouveau critere `networkTraffic` est ajoute a `MonitoringCriteria`
   **When** cette story est implementee
   **Then** `MonitoringCriteria` contient `networkTraffic: boolean`
   **And** un seuil optionnel `networkTrafficThreshold?: number` (bytes, defaut 1024) est disponible dans la regle

2. **Given** le Docker connector a acces aux stats API
   **When** `getStats()` est appele sur un conteneur
   **Then** il retourne egalement `rxBytes` et `txBytes` depuis le champ `networks` des Docker stats (somme de toutes les interfaces)

3. **Given** le moniteur d'inactivite execute un tick
   **When** le critere `networkTraffic` est actif pour un conteneur Docker
   **Then** il compare les bytes actuels (rx + tx) avec les bytes du tick precedent stockes dans un cache en memoire (`Map<nodeId, { rxBytes, txBytes }>`)
   **And** si le delta > seuil → le noeud est considere actif
   **And** si le delta <= seuil → le check retourne inactif

4. **Given** c'est le premier tick pour un noeud (pas de precedent en cache)
   **When** le critere est evalue
   **Then** le check retourne actif (safe fallback)
   **And** les bytes actuels sont stockes pour le prochain tick

5. **Given** un noeud n'est plus online ou n'a plus de regle active
   **When** le cycle de nettoyage des compteurs s'execute
   **Then** l'entree du cache reseau est supprimee

6. **Given** l'UI de la section "Regles d'inactivite" est affichee
   **When** le noeud est de type `container`
   **Then** une checkbox "Trafic reseau" est disponible dans les criteres
   **And** un champ de seuil (bytes) est disponible quand le critere est active

## Tasks / Subtasks

- [x] Task 1 — Etendre le type `MonitoringCriteria` et `NodeStats` dans `packages/shared` (AC: #1, #2)
  - [x] 1.1 Ajouter `networkTraffic: boolean` a l'interface `MonitoringCriteria` dans `packages/shared/src/models/inactivity-rule.ts`
  - [x] 1.2 Ajouter `networkTrafficThreshold?: number` a l'interface `MonitoringCriteria`
  - [x] 1.3 Ajouter `rxBytes?: number` et `txBytes?: number` (optionnels) a l'interface `NodeStats` dans `packages/shared/src/models/node-stats.ts`
  - [x] 1.4 Mettre a jour le default JSON de `monitoringCriteria` dans `apps/server/src/db/schema.ts` pour inclure `networkTraffic: false`

- [x] Task 2 — Etendre le Docker connector pour retourner les bytes reseau (AC: #2)
  - [x] 2.1 Ajouter le champ `networks` a l'interface `DockerStatsResponse` dans `docker.connector.ts` : `networks?: Record<string, { rx_bytes: number; tx_bytes: number }>`
  - [x] 2.2 Dans `getStats()`, extraire `rxBytes` et `txBytes` en sommant toutes les interfaces du champ `networks` et les ajouter a l'objet `NodeStats` retourne
  - [x] 2.3 Gerer le cas `networks` absent ou vide (retourner `rxBytes: 0, txBytes: 0`)

- [x] Task 3 — Implementer le cache de compteurs reseau et le check `networkTraffic` dans le moniteur d'inactivite (AC: #3, #4, #5)
  - [x] 3.1 Ajouter un `Map<string, { rxBytes: number; txBytes: number }>` au niveau module dans `inactivity-monitor.ts` (`networkTrafficCache`)
  - [x] 3.2 Ajouter la constante `DEFAULT_NETWORK_TRAFFIC_THRESHOLD = 1024` (1 Ko)
  - [x] 3.3 Implementer la fonction `checkNetworkTraffic(nodeId, platformStats, threshold)` qui :
    - Recupere les bytes precedents du cache
    - Si pas de precedent → stocke les bytes actuels, retourne `true` (safe fallback)
    - Calcule le delta : `(currentRx + currentTx) - (previousRx + previousTx)`
    - Met a jour le cache avec les bytes courants
    - Retourne `delta > threshold`
  - [x] 3.4 Integrer `checkNetworkTraffic` dans `checkActivity()` — branche sur `criteria.networkTraffic` pour les conteneurs uniquement
  - [x] 3.5 Etendre le nettoyage du cache existant (L91-97) pour aussi nettoyer `networkTrafficCache` quand un nodeId n'est plus dans les noeuds actifs
  - [x] 3.6 Nettoyer `networkTrafficCache` dans `stopInactivityMonitor()`

- [x] Task 4 — Mettre a jour les schemas de validation backend (AC: #1)
  - [x] 4.1 Ajouter `networkTraffic: { type: 'boolean' }` dans `monitoringCriteriaSchema` de `inactivity-rules.routes.ts`
  - [x] 4.2 Ajouter `networkTrafficThreshold: { type: 'number', minimum: 0 }` dans `monitoringCriteriaSchema`
  - [x] 4.3 Ajouter `networkTraffic: { type: 'boolean' }` et `networkTrafficThreshold: { type: 'number' }` dans `ruleSchema`

- [x] Task 5 — Mettre a jour l'UI des regles d'inactivite (AC: #6)
  - [x] 5.1 Ajouter `networkTraffic` a `CriteriaKey` et `getCriteriaConfig()` dans `inactivity-rules-section.tsx`
  - [x] 5.2 Pour `container` : activer le critere avec label "Trafic reseau (Docker API)"
  - [x] 5.3 Pour `physical`, `vm`, `lxc` : desactiver le critere avec raison "Disponible uniquement pour les conteneurs Docker (Story 7.2 pour VM/LXC)"
  - [x] 5.4 Ajouter un champ `NumberInput` "Seuil trafic reseau (bytes)" qui apparait quand `networkTraffic` est active (defaut 1024)
  - [x] 5.5 Mettre a jour l'initialisation du state `criteria` pour inclure `networkTraffic: false`

- [x] Task 6 — Tests backend (AC: #1-#5)
  - [x] 6.1 Test Docker connector `getStats()` : verifier que `rxBytes` et `txBytes` sont retournes
  - [x] 6.2 Test Docker connector `getStats()` : verifier le comportement quand `networks` est absent (retourne 0)
  - [x] 6.3 Test Docker connector `getStats()` : verifier la somme sur plusieurs interfaces reseau
  - [x] 6.4 Test inactivity monitor `checkNetworkTraffic` : premier tick → safe fallback (actif)
  - [x] 6.5 Test inactivity monitor `checkNetworkTraffic` : delta > seuil → actif
  - [x] 6.6 Test inactivity monitor `checkNetworkTraffic` : delta <= seuil → inactif
  - [x] 6.7 Test inactivity monitor : nettoyage du cache quand noeud n'est plus actif
  - [x] 6.8 Test inactivity monitor : `stopInactivityMonitor()` nettoie le cache reseau
  - [x] 6.9 Test validation schema : `networkTraffic` et `networkTrafficThreshold` acceptes dans les routes
  - [x] 6.10 Verifier zero regression sur tous les tests existants

- [x] Task 7 — Tests frontend (AC: #6)
  - [x] 7.1 Test `inactivity-rules-section.test.tsx` : checkbox "Trafic reseau" visible pour conteneurs
  - [x] 7.2 Test : checkbox "Trafic reseau" desactivee pour machines physiques
  - [x] 7.3 Test : champ seuil visible quand `networkTraffic` est coche
  - [x] 7.4 Verifier zero regression sur les tests web existants

## Dev Notes

### Changement de paradigme : monitoring stateful

L'Epic 7 introduit un **monitoring stateful** : contrairement aux checks existants (TCP, SSH, CPU/RAM) qui sont stateless (un seul appel suffit), le monitoring reseau necessite de **comparer deux mesures successives** pour calculer un delta. Cela implique :

1. Un **cache en memoire** (`Map<nodeId, { rxBytes, txBytes }>`) persistant entre les ticks du moniteur
2. Un **safe fallback au premier tick** — pas de precedent = pas de delta = considere actif
3. Un **nettoyage du cache** quand le noeud n'est plus surveille

### API Docker stats — champ `networks`

L'endpoint `GET /containers/{id}/stats?stream=false` retourne un objet `networks` indexe par nom d'interface :

```json
{
  "networks": {
    "eth0": {
      "rx_bytes": 5338,
      "rx_dropped": 0,
      "rx_errors": 0,
      "rx_packets": 36,
      "tx_bytes": 648,
      "tx_dropped": 0,
      "tx_errors": 0,
      "tx_packets": 8
    }
  }
}
```

Les valeurs `rx_bytes` et `tx_bytes` sont des **compteurs cumulatifs** (uint64). Il faut donc calculer le delta entre deux ticks pour detecter l'activite.

**IMPORTANT :** Sommer **toutes les interfaces** (pas seulement `eth0`) car certains conteneurs ont des reseaux multiples (bridge, overlay, etc.).

### Extension de `NodeStats` — champs optionnels

Les champs `rxBytes` et `txBytes` sont **optionnels** dans `NodeStats` pour ne pas casser les implementations existantes (WoL/SSH et Proxmox qui ne retournent pas encore de stats reseau) :

```typescript
export interface NodeStats {
  cpuUsage: number;  // 0.0 to N.0
  ramUsage: number;  // 0.0 to 1.0
  rxBytes?: number;  // cumulative received bytes
  txBytes?: number;  // cumulative transmitted bytes
}
```

### Extension de `MonitoringCriteria`

```typescript
export interface MonitoringCriteria {
  lastAccess: boolean;
  networkConnections: boolean;
  cpuRamActivity: boolean;
  cpuThreshold?: number;
  ramThreshold?: number;
  networkTraffic: boolean;           // NEW — Story 7.1
  networkTrafficThreshold?: number;  // NEW — bytes, default 1024
}
```

### Extension de `DockerStatsResponse`

Ajouter le champ `networks` a l'interface existante dans `docker.connector.ts` (L23-38) :

```typescript
interface DockerStatsResponse {
  cpu_stats: { /* existant */ };
  precpu_stats: { /* existant */ };
  memory_stats: { /* existant */ };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;  // NEW
}
```

### Implementation du check `networkTraffic` dans `inactivity-monitor.ts`

**Nouveau cache module-level** (a ajouter a cote de `inactivityCounters` L21) :

```typescript
const networkTrafficCache = new Map<string, { rxBytes: number; txBytes: number }>();
```

**Nouvelle fonction** (a ajouter apres `checkCpuRamActivity` L328) :

```typescript
function checkNetworkTraffic(
  nodeId: string,
  currentRxBytes: number,
  currentTxBytes: number,
  threshold: number,
): boolean {
  const previous = networkTrafficCache.get(nodeId);

  // Store current values for next tick
  networkTrafficCache.set(nodeId, { rxBytes: currentRxBytes, txBytes: currentTxBytes });

  if (!previous) {
    // First tick — no delta possible → safe fallback (active)
    return true;
  }

  const delta = (currentRxBytes + currentTxBytes) - (previous.rxBytes + previous.txBytes);
  return delta > threshold;
}
```

**Integration dans `checkActivity()`** (a ajouter apres le bloc `criteria.cpuRamActivity` L200-209) :

```typescript
if (criteria.networkTraffic) {
  if (nodeType === 'container' && platformStats?.rxBytes !== undefined && platformStats?.txBytes !== undefined) {
    const threshold = criteria.networkTrafficThreshold ?? DEFAULT_NETWORK_TRAFFIC_THRESHOLD;
    enabledChecks.push(async () =>
      checkNetworkTraffic(node.id, platformStats.rxBytes!, platformStats.txBytes!, threshold),
    );
  }
  // Non-container types: skip (Story 7.2 ajoutera le support VM/LXC)
}
```

### Nettoyage du cache

1. **Dans le nettoyage existant** (L91-97) — ajouter `networkTrafficCache.delete(nodeId)` :

```typescript
for (const [nodeId] of inactivityCounters) {
  if (!activeNodeIds.has(nodeId)) {
    inactivityCounters.delete(nodeId);
    networkTrafficCache.delete(nodeId);  // NEW
  }
}
```

2. **Dans `stopInactivityMonitor()`** (L55-61) — ajouter `networkTrafficCache.clear()` :

```typescript
export function stopInactivityMonitor(): void {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  inactivityCounters.clear();
  networkTrafficCache.clear();  // NEW
}
```

### Modification du schema de validation backend

Dans `inactivity-rules.routes.ts`, mettre a jour 3 schemas :

**`monitoringCriteriaSchema`** (L41-51) — ajouter 2 champs :
```typescript
networkTraffic: { type: 'boolean' as const },
networkTrafficThreshold: { type: 'number' as const, minimum: 0 },
```

**`ruleSchema`** (L19-39) — ajouter dans `monitoringCriteria.properties` :
```typescript
networkTraffic: { type: 'boolean' as const },
networkTrafficThreshold: { type: 'number' as const },
```

### Modification du default schema Drizzle

Dans `apps/server/src/db/schema.ts`, mettre a jour le `$defaultFn` de `monitoringCriteria` :

```typescript
.$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false, networkTraffic: false }))
```

**Note :** Pas de migration SQL necessaire — la colonne `monitoring_criteria` est un champ JSON. Les regles existantes sans le champ `networkTraffic` fonctionneront car le moniteur verifie `criteria.networkTraffic` qui sera `undefined` (falsy).

### Modification de l'UI des regles d'inactivite

Dans `inactivity-rules-section.tsx` :

1. **Etendre `CriteriaKey`** (L31) :
```typescript
type CriteriaKey = 'lastAccess' | 'networkConnections' | 'cpuRamActivity' | 'networkTraffic';
```

2. **Etendre `getCriteriaConfig()`** (L33-55) — ajouter a chaque `case` :

```typescript
// container:
networkTraffic: { label: 'Trafic réseau (Docker API)', disabled: false },

// vm, lxc:
networkTraffic: { label: 'Trafic réseau', disabled: true, disabledReason: 'Disponible pour les VMs/LXCs dans une prochaine version' },

// physical (default):
networkTraffic: { label: 'Trafic réseau', disabled: true, disabledReason: 'Non applicable aux machines physiques' },
```

3. **Ajouter le rendu du checkbox** apres le bloc `cpuRamActivity` (L238-242) :
```tsx
{renderCriteriaCheckbox('networkTraffic', criteria.networkTraffic ?? false, (v) => setCriteria({
  ...criteria,
  networkTraffic: v,
  ...(v && criteria.networkTrafficThreshold === undefined ? { networkTrafficThreshold: 1024 } : {}),
}))}
```

4. **Ajouter le champ seuil** conditionnel apres les seuils CPU/RAM (L244-265) :
```tsx
{criteria.networkTraffic && (
  <NumberInput
    label="Seuil trafic réseau (bytes)"
    description="Delta minimum de bytes (rx+tx) entre deux ticks pour considérer le noeud actif"
    value={criteria.networkTrafficThreshold ?? 1024}
    onChange={(val) => {
      if (typeof val === 'number') setCriteria({ ...criteria, networkTrafficThreshold: val });
    }}
    min={0}
  />
)}
```

5. **Mettre a jour l'initialisation du state** (L72-76) :
```typescript
const [criteria, setCriteria] = useState<MonitoringCriteria>({
  lastAccess: true,
  networkConnections: false,
  cpuRamActivity: false,
  networkTraffic: false,
});
```

6. **Mettre a jour le nettoyage** des criteres desactives (L87-89) — ajouter `networkTraffic` a la boucle :
```typescript
for (const key of ['lastAccess', 'networkConnections', 'cpuRamActivity', 'networkTraffic'] as const) {
```

### Seuil par defaut : 1024 bytes (1 Ko)

Le seuil de 1 Ko permet de filtrer le "bruit" reseau minimal (keepalive, DNS, etc.) tout en detectant la moindre activite reelle. L'utilisateur peut ajuster a la hausse pour les conteneurs particulierement bavards.

### Choix de somme sur toutes les interfaces

Certains conteneurs Docker ont plusieurs interfaces reseau (bridge par defaut + overlay + host). Sommer toutes les interfaces garantit qu'aucune activite n'est manquee.

### Pattern de safe fallback

Comme tous les checks existants, le check `networkTraffic` suit le pattern de safe fallback :
- Pas de `platformStats` → skip (pas d'ajout au `enabledChecks`)
- `rxBytes`/`txBytes` undefined dans les stats → skip
- Premier tick sans precedent → retourne `true` (actif)
- Erreur Docker API → `getStats()` retourne `null` → `platformStats` est null → skip

### Ordre d'execution des checks

Le check `networkTraffic` est ajoute **apres** les checks existants dans `enabledChecks`. La logique "ANY true = actif" s'applique : si le CPU est actif, le noeud est considere actif meme si le reseau est inactif.

### Project Structure Notes

- Alignement complet avec l'organisation existante (aucun nouveau fichier, modifications de fichiers existants uniquement)
- Les tests suivent le pattern co-localise existant

### Structure de fichiers a modifier

| Fichier | Action |
|---------|--------|
| `packages/shared/src/models/inactivity-rule.ts` | **MODIFIER** — Ajouter `networkTraffic`, `networkTrafficThreshold` |
| `packages/shared/src/models/node-stats.ts` | **MODIFIER** — Ajouter `rxBytes?`, `txBytes?` |
| `apps/server/src/connectors/docker.connector.ts` | **MODIFIER** — Etendre `DockerStatsResponse`, modifier `getStats()` |
| `apps/server/src/services/inactivity-monitor.ts` | **MODIFIER** — Cache reseau, `checkNetworkTraffic()`, integration dans `checkActivity()`, nettoyage |
| `apps/server/src/routes/inactivity-rules.routes.ts` | **MODIFIER** — Schemas validation |
| `apps/server/src/db/schema.ts` | **MODIFIER** — Default `monitoringCriteria` JSON |
| `apps/server/src/connectors/docker.connector.test.ts` | **MODIFIER** — Tests getStats avec rxBytes/txBytes |
| `apps/server/src/services/inactivity-monitor.test.ts` | **MODIFIER** — Tests cache reseau et checkNetworkTraffic |
| `apps/server/src/routes/inactivity-rules.routes.test.ts` | **MODIFIER** — Tests validation schema |
| `apps/web/src/features/nodes/inactivity-rules-section.tsx` | **MODIFIER** — Checkbox + seuil networkTraffic |
| `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` | **MODIFIER** — Tests UI networkTraffic |

### Intelligence de la story precedente (6.2)

- **Compteur de tests** : 220 web tests, 387+ server tests avant cette story
- **Pattern de test frontend** : `renderWithProviders(ui)`, mock `fetch` global, `vi.hoisted()` pour mocks, `vi.mock()` factory
- **Pattern de test backend** : mock `NodeSSH`, mock fonctions DB via `vi.mock()`, helpers d'insertion
- **`logOperation` utilitaire** : utiliser `apps/server/src/utils/log-operation.ts` pour tout log enrichi
- **Inactivity monitor exports de test** : `_getInactivityCounters()`, `_getMonitorInterval()` — ajouter `_getNetworkTrafficCache()` pour les tests

### Intelligence git

Les 5 derniers commits montrent un pattern de features groupees par epic :
- `e096b94` feat: implement Epic 6
- `9f38774` feat: implement Epic 5
- `aa247c9` feat: implement Epic 4

Code sur la branche `nouvel-axe`. Pas de PR en cours.

### Mise en garde — NE PAS faire

- **NE PAS implementer le monitoring reseau Proxmox** (netin/netout via rrddata) — C'est la Story 7.2
- **NE PAS ajouter `networkTraffic` aux checks pour les types `vm`, `lxc` ou `physical`** — Story 7.2 uniquement
- **NE PAS modifier `ProxmoxConnector.getStats()`** — Story 7.2
- **NE PAS creer de migration SQL** — le champ `monitoring_criteria` est JSON, aucune migration necessaire
- **NE PAS modifier les routes de cascade ou le SSE** — aucun impact sur ces composants
- **NE PAS toucher a la page Logs ou au ServiceDetailPanel** — aucun impact

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] — Definition de la story et ACs
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — Vue d'ensemble epic, paradigme stateful
- [Source: _bmad-output/planning-artifacts/architecture.md#Connectors] — Interface PlatformConnector, pattern connecteurs
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — Tests co-localises, nommage
- [Source: apps/server/src/services/inactivity-monitor.ts] — Moniteur d'inactivite complet (416 lignes)
- [Source: apps/server/src/connectors/docker.connector.ts] — Docker connector avec getStats() (176 lignes)
- [Source: apps/server/src/connectors/docker-client.ts] — Docker HTTP client (59 lignes)
- [Source: apps/server/src/connectors/connector.interface.ts] — PlatformConnector interface avec getStats? optionnel
- [Source: packages/shared/src/models/inactivity-rule.ts] — MonitoringCriteria et InactivityRule types
- [Source: packages/shared/src/models/node-stats.ts] — NodeStats type (cpuUsage, ramUsage)
- [Source: apps/server/src/routes/inactivity-rules.routes.ts] — Schemas validation JSON et routes CRUD
- [Source: apps/server/src/db/schema.ts] — Schema Drizzle inactivityRules avec default JSON
- [Source: apps/web/src/features/nodes/inactivity-rules-section.tsx] — UI regles d'inactivite (279 lignes)
- [Source: apps/web/src/api/inactivity-rules.api.ts] — Hooks TanStack Query pour les regles
- [Source: _bmad-output/implementation-artifacts/6-2-page-logs-et-interface-de-diagnostic.md] — Story precedente, compteurs tests
- [Source: Docker API docs — networks field in stats response](https://docs.docker.com/engine/containers/runmetrics/)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Aucun probleme rencontre. Implementation directe selon les specs de la story.

### Completion Notes List

- **Task 1** : Types `MonitoringCriteria` et `NodeStats` etendus avec `networkTraffic`, `networkTrafficThreshold`, `rxBytes`, `txBytes`. Default schema Drizzle mis a jour.
- **Task 2** : Docker connector `getStats()` retourne maintenant `rxBytes` et `txBytes` en sommant toutes les interfaces reseau. Gestion gracieuse du cas `networks` absent.
- **Task 3** : Cache `networkTrafficCache` (Map module-level) implemente. Fonction `checkNetworkTraffic()` calcule le delta entre ticks, safe fallback au premier tick. Integration dans `checkActivity()` pour conteneurs uniquement. Nettoyage du cache dans les cycles de cleanup et `stopInactivityMonitor()`. Export test `_getNetworkTrafficCache()` ajoute.
- **Task 4** : Schemas de validation Fastify (`ruleSchema`, `monitoringCriteriaSchema`) etendus avec les nouveaux champs. Types Body des routes PUT/POST mis a jour.
- **Task 5** : UI etendue — `CriteriaKey` inclut `networkTraffic`, `getCriteriaConfig()` retourne les configs par type de noeud (active pour container, desactive pour physical/vm/lxc). Checkbox et NumberInput seuil conditionnel ajoutes. Initialisation du state et boucle de nettoyage mis a jour.
- **Task 6** : 11 nouveaux tests backend — 3 tests Docker connector (rxBytes/txBytes, networks absent, somme multi-interfaces), 7 tests inactivity monitor (safe fallback, delta > seuil, delta <= seuil, seuil custom, skip non-container, cleanup cache, stop cleanup), 1 test route validation schema.
- **Task 7** : 4 nouveaux tests frontend — checkbox visible/active pour container, desactivee pour physical, seuil visible quand coche, seuil apparait apres activation.
- **Resultats** : 397 tests serveur passent (1 echec pre-existant crypto.test.ts), 224 tests web passent. TypeScript compile sans erreur.

### Change Log

- 2026-02-15 : Implementation Story 7.1 — Monitoring reseau Docker (delta trafic). Ajout du critere `networkTraffic` avec cache stateful, seuil configurable, integration UI, et 15 nouveaux tests.
- 2026-02-15 : Code Review — 3 fixes appliques : (H1) guard contre delta negatif au reset Docker dans `checkNetworkTraffic()`, (L1) test ajoute pour le scenario de counter reset, (M1) revert de logs-page.tsx (hors perimetre). Total : 16 nouveaux tests (12 backend, 4 frontend).

### File List

- `packages/shared/src/models/inactivity-rule.ts` — MODIFIED : ajout `networkTraffic`, `networkTrafficThreshold` a `MonitoringCriteria`
- `packages/shared/src/models/node-stats.ts` — MODIFIED : ajout `rxBytes?`, `txBytes?` a `NodeStats`
- `apps/server/src/db/schema.ts` — MODIFIED : default `monitoringCriteria` inclut `networkTraffic: false`
- `apps/server/src/connectors/docker.connector.ts` — MODIFIED : `DockerStatsResponse.networks`, extraction rxBytes/txBytes dans `getStats()`
- `apps/server/src/services/inactivity-monitor.ts` — MODIFIED : `networkTrafficCache`, `checkNetworkTraffic()` (avec guard delta negatif), integration dans `checkActivity()`, nettoyage cache, export test
- `apps/server/src/routes/inactivity-rules.routes.ts` — MODIFIED : schemas validation + types Body etendus
- `apps/server/src/connectors/docker.connector.test.ts` — MODIFIED : 3 nouveaux tests + mise a jour assertions existantes
- `apps/server/src/services/inactivity-monitor.test.ts` — MODIFIED : 8 nouveaux tests networkTraffic (incl. counter reset safe fallback)
- `apps/server/src/routes/inactivity-rules.routes.test.ts` — MODIFIED : 1 nouveau test validation schema
- `apps/web/src/features/nodes/inactivity-rules-section.tsx` — MODIFIED : checkbox networkTraffic, seuil, config par type
- `apps/web/src/features/nodes/inactivity-rules-section.test.tsx` — MODIFIED : 4 nouveaux tests UI
