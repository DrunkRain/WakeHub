# Sprint Change Proposal — 2026-02-14 (v2)

**Projet** : WakeHub
**Auteur** : Drunkrain (avec Bob, Scrum Master)
**Date** : 2026-02-14
**Scope** : Correction Story 5.3 — Epic 5 (Arret Automatique sur Inactivite)
**Remplace** : Sprint Change Proposal v1 (creation Story 5.3 — deja implementee)

---

## Section 1 : Resume du probleme

### Enonce

L'automatisation de l'arret des containers Docker ne fonctionne pas. Le moniteur d'inactivite ne declenche jamais l'arret automatique pour les containers, meme apres le delai configure.

### Contexte de decouverte

Decouvert lors de la phase `review` de la Story 5.3 (Implementation des vrais criteres de surveillance). L'investigation a revele 4 problemes techniques dans le code backend.

### Evidence

1. **Criteres par defaut inefficaces pour les containers** : Le seul critere actif par defaut (`lastAccess: true` = check TCP port 22) est explicitement ignore pour les containers (`inactivity-monitor.ts:169`). Resultat : `enabledChecks = []` → safe fallback → container toujours considere "actif".

2. **Formule CPU Docker incorrecte** : `docker.connector.ts:109` — `cpuDelta / systemDelta` sans multiplication par `online_cpus`. Sur un host 4 cores, un container utilisant 1 core retourne 0.25 au lieu de 1.0.

3. **RAM Docker gonflee par le page cache** : `docker.connector.ts:111` — `memory_stats.usage` inclut le page cache kernel. Un container idle avec du cache fichier apparait comme utilisant beaucoup de RAM.

4. **Proxmox hard stop au lieu d'arret gracieux** : `proxmox.connector.ts:60` — `/status/stop` (kill immediat) au lieu de `/status/shutdown` (signal ACPI gracieux). Risque de corruption de donnees.

---

## Section 2 : Analyse d'impact

### Impact Epic

| Epic | Impact | Detail |
|------|--------|--------|
| Epic 5 (Arret Auto) | **Direct** | Story 5.3 doit etre corrigee avant passage en `done` |
| Epic 6 (Logs) | Aucun | L'infrastructure de logging fonctionne correctement |
| Epics 1-4 | Aucun | Deja `done`, non concernes |

### Impact Story

| Story | Impact | Detail |
|-------|--------|--------|
| 5.3 (Vrais criteres) | **Correction requise** | 4 bugs a corriger dans 3 fichiers |
| 5.1 (Moteur) | Aucun | Le moteur fonctionne correctement |
| 5.2 (Protection deps + UI) | Aucun | La protection et l'UI fonctionnent |

### Conflits d'artefacts

| Artefact | Modification requise ? | Detail |
|----------|----------------------|--------|
| PRD | Non | Les exigences sont correctes — c'est l'implementation qui doit rattraper |
| Architecture | Non | `PlatformConnector.getStats()` existe deja, pas de changement d'interface |
| UX Design | Non | Corrections purement backend |
| Schema DB | Non | Pas de migration necessaire |
| Tests | Oui | Tests existants a adapter pour couvrir les corrections |

### Impact technique

- **3 fichiers modifies** : `inactivity-monitor.ts`, `docker.connector.ts`, `proxmox.connector.ts`
- **~30 lignes de code** modifiees
- **0 nouvelle dependance**
- **0 migration DB**
- **0 changement d'API REST**

---

## Section 3 : Approche recommandee

### Chemin choisi : Ajustement direct de la Story 5.3

**Justification** :
- La Story 5.3 est encore en `review` — moment ideal pour corriger
- Le titre "Implementation des vrais criteres de surveillance" couvre exactement le scope des corrections
- Effort minimal (~30 lignes), risque minimal (pas de changement d'architecture)
- Aucun rollback necessaire — le code existant est globalement correct

**Alternatives rejetees** :
- **Rollback** (Stories 5.1-5.3) : Inutile — le code est bon dans l'ensemble, 522 tests passent
- **Revue MVP** : Non necessaire — le MVP n'est pas remis en question

**Effort** : Low
**Risque** : Low
**Impact timeline** : Aucun

---

## Section 4 : Propositions de changements detaillees

### Correction 1 : Criteres par defaut pour containers (CRITIQUE)

**Fichier** : `apps/server/src/services/inactivity-monitor.ts`
**Section** : `checkActivity()`, lignes 167-172

**AVANT** :
```typescript
if (criteria.lastAccess) {
  // Containers don't have TCP 22 — skip
  if (nodeType !== 'container') {
    enabledChecks.push(() => checkLastAccess(node));
  }
}
```

**APRES** :
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

**Rationale** : Rend le critere `lastAccess` intelligent par type de noeud. Les containers utilisent les stats API Docker (deja implementees dans `DockerConnector.getStats()`) au lieu du check TCP 22 inapplicable. Les utilisateurs existants avec criteres par defaut verront leurs containers surveilles sans reconfiguration.

---

### Correction 2 : Formule CPU Docker (MOYEN)

**Fichier** : `apps/server/src/connectors/docker.connector.ts`
**Section** : `getStats()`, lignes 106-109

**AVANT** :
```typescript
// Docker CPU usage formula: delta container usage / delta system usage * number of CPUs
const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
const cpuUsage = systemDelta > 0 ? cpuDelta / systemDelta : 0;
```

**APRES** :
```typescript
// Docker CPU usage formula: (delta container / delta system) * number of host CPUs
// This gives a 0.0-1.0 range where 1.0 = one full CPU core busy
const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
const onlineCpus = data.cpu_stats.online_cpus || 1;
const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus : 0;
```

**Rationale** : Aligne la formule Docker avec la documentation officielle et avec l'echelle Proxmox/SSH. Le `|| 1` protege contre un `online_cpus` indefini.

---

### Correction 3 : RAM Docker sans page cache (MINEUR)

**Fichier** : `apps/server/src/connectors/docker.connector.ts`

**Interface TypeScript** (lignes 33-36) :

**AVANT** :
```typescript
memory_stats: {
  usage: number;
  limit: number;
};
```

**APRES** :
```typescript
memory_stats: {
  usage: number;
  limit: number;
  stats?: { inactive_file?: number };
};
```

**Calcul RAM** (ligne 111) :

**AVANT** :
```typescript
const ramUsage = data.memory_stats.limit > 0 ? data.memory_stats.usage / data.memory_stats.limit : 0;
```

**APRES** :
```typescript
const cacheUsage = data.memory_stats.stats?.inactive_file ?? 0;
const ramUsage = data.memory_stats.limit > 0 ? (data.memory_stats.usage - cacheUsage) / data.memory_stats.limit : 0;
```

**Rationale** : `inactive_file` est la methode recommandee par Docker pour soustraire le cache. Fallback sur le comportement actuel si le champ est absent.

---

### Correction 4 : Proxmox arret gracieux (MINEUR)

**Fichier** : `apps/server/src/connectors/proxmox.connector.ts`
**Section** : `stop()`, ligne 60

**AVANT** :
```typescript
await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/stop`);
```

**APRES** :
```typescript
await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/shutdown`);
```

**Code d'erreur** (ligne 62) :

**AVANT** :
```typescript
'PROXMOX_STOP_FAILED',
```

**APRES** :
```typescript
'PROXMOX_SHUTDOWN_FAILED',
```

**Rationale** : `/status/shutdown` envoie un signal ACPI ou utilise le QEMU Guest Agent pour un arret propre. Previent la corruption de donnees des services stateful.

---

## Section 5 : Handoff d'implementation

### Classification du changement

**Mineur** — Implementation directe par l'equipe de developpement.

### Responsabilites

| Role | Responsabilite |
|------|---------------|
| Developpeur (agent dev) | Appliquer les 4 corrections, adapter les tests unitaires |
| Scrum Master | Mettre a jour le sprint-status.yaml apres validation |

### Plan d'action

1. Appliquer les corrections 1-4 dans les 3 fichiers
2. Adapter les tests unitaires existants (`inactivity-monitor.test.ts`, `docker.connector.test.ts`, `proxmox.connector.test.ts`)
3. Verifier : tous les tests passent (backend + frontend)
4. Verifier : `tsc --noEmit` passe
5. Passer la Story 5.3 de `review` a `done`
6. Mettre a jour le document de Story 5.3

### Criteres de succes

- [ ] Les 4 corrections sont appliquees
- [ ] Un container Docker avec criteres par defaut est detecte comme inactif quand CPU et RAM sont sous les seuils
- [ ] La formule CPU Docker retourne des valeurs coherentes avec Proxmox et SSH
- [ ] La RAM Docker exclut le page cache
- [ ] Proxmox utilise `/status/shutdown` au lieu de `/status/stop`
- [ ] Tous les tests passent (0 regressions)
- [ ] TypeScript compile sans erreur
