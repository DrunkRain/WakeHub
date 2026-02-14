# Session Backup — Party Mode : Monitoring Avancé & Veille Concurrentielle

**Date :** 2026-02-14
**Participants :** Drunkrain, Winston (Architecte), John (PM), Mary (Analyste), Bob (SM), Amelia (Dev)
**Contexte :** Discussion Party Mode suite à une veille concurrentielle (Lazytainer, Sablier, Pulse)

---

## Contexte du projet

WakeHub est un outil de gestion d'infrastructure domestique/homelab qui permet de :
- Gérer un arbre d'hébergement (machines physiques, VMs Proxmox, LXCs, conteneurs Docker)
- Définir des dépendances fonctionnelles entre nœuds
- Démarrer/arrêter en cascade (respect des dépendances)
- Surveiller l'inactivité et déclencher des arrêts automatiques

### État actuel du projet

- **Epics 1-4** : Done (auth, arbre de nœuds, dépendances, dashboard/cascade/SSE)
- **Epic 5** (Arrêt Automatique sur Inactivité) : In-progress
  - Stories 5.1-5.3 : review
  - Story 5.4 (suppression critère httpAccess) : review — vient d'être implémentée
  - Le critère `httpAccess` a été supprimé car c'était un health check, pas un détecteur d'activité réelle
- **Epic 6** (Journalisation & Diagnostic) : Backlog

### Architecture monitoring actuelle

Le fichier `apps/server/src/services/inactivity-monitor.ts` implémente :
- `checkActivity()` avec un pattern extensible (array de checks)
- 3 critères : `lastAccess` (TCP port 22), `networkConnections` (SSH `ss -tun`), `cpuRamActivity` (SSH ou API plateforme)
- Connecteurs : `DockerConnector`, `ProxmoxConnector` avec `getStats()` pour CPU/RAM
- Seuils hardcodés : `CPU_LOAD_THRESHOLD = 0.5`, `RAM_USAGE_THRESHOLD = 0.5`
- Safe fallbacks systématiques (en cas de doute → considérer actif)

### Diagnostic de fiabilité par type de nœud

| Type | `lastAccess` | `networkConnections` | `cpuRamActivity` | Fiabilité |
|------|-------------|---------------------|-------------------|-----------|
| **Physical** | TCP port 22 ✅ | SSH `ss -tun` ✅ | SSH loadavg+free ✅ | **Solide** |
| **VM** | TCP port 22 ✅ | Skipped (safe fallback) ⚠️ | Proxmox API ✅ | **Correct** |
| **LXC** | TCP port 22 ✅ | Skipped (safe fallback) ⚠️ | Proxmox API ✅ | **Correct** |
| **Container** | Fallback CPU/RAM Docker ✅ | Skipped ⚠️ | Docker API stats ✅ | **Faible** |

**Problème principal :** Les conteneurs Docker n'ont aucune visibilité réseau. Un service idle mais avec un process en fond (ex: Jellyfin) peut ne jamais être détecté comme inactif si les seuils CPU/RAM ne sont pas adaptés.

---

## Veille concurrentielle — Synthèse

### Lazytainer (Go, monitoring réseau)
- Boucle toutes les X secondes, compte les paquets réseau sur l'interface du container
- Si paquets < seuil minimum pendant N cycles → inactif → stop/pause
- Paramètres : `minPacketThreshold`, `pollRate`, `inactiveTimeout`
- Docker socket read-only pour stop/start
- **Pattern retenu :** Delta paquets réseau, applicable via Docker stats API (`rx_bytes`/`tx_bytes`)

### Sablier (Go, sessions à expiration)
- Quand requête arrive → démarrer le container, créer/renouveler session TTL
- Ticker vérifie toutes les 20s si sessions expirées → stop
- Healthchecks Docker pour readiness
- **Provider pattern** : interface commune Start/Stop/Status/List par plateforme
- **Pattern retenu (post-MVP) :** Wake-on-request via reverse proxy
- **Pattern déjà couvert :** Provider pattern ≈ nos connecteurs existants

### Pulse (monitoring Proxmox)
- API REST Proxmox : `rrddata` pour métriques CPU/RAM/net historiques
- Pas besoin d'agent dans les VMs/LXC
- Polling régulier, stockage des métriques, détection de tendance
- **Pattern retenu :** `rrddata` Proxmox pour compteurs réseau (`netin`/`netout`) sans SSH

---

## Décisions prises

### Scope MVP
1. **Wake-on-request → POST-MVP**, pas dans le scope actuel
2. **Focus MVP** → Monitoring fiable pour extinction de cascade sur les 4 types de nœuds
3. Pas d'iptables/conntrack (trop invasif)
4. Pas de reverse proxy
5. Pas de QEMU guest agent (trop de setup utilisateur)

### Priorisation validée par Drunkrain

**P0 — Seuils configurables (Epic 5, Story 5.5)**
- Exposer `cpuLoadThreshold` et `ramUsageThreshold` dans la règle d'inactivité (au lieu des constantes hardcodées)
- Débloque la fiabilité pour TOUS les types de nœuds sans nouveau code de monitoring
- Modification chirurgicale, pas de changement d'architecture

**P1 — Monitoring réseau Docker (Epic 7)**
- Nouveau critère basé sur le delta `rx_bytes`/`tx_bytes` des Docker stats API
- Pattern Lazytainer simplifié : comparer les bytes entre deux ticks de monitoring
- Nécessite un cache de compteurs réseau par nœud (changement de paradigme : stateless → stateful)
- Signal réseau beaucoup plus fiable que CPU/RAM pour détecter l'activité réelle des conteneurs

**P2 — Monitoring réseau VMs/LXCs (Epic 7)**
- Même logique de delta réseau, mais via `rrddata` Proxmox (`netin`/`netout`)
- Remplace le `networkConnections` actuellement skippé pour VMs/LXCs
- Pas besoin de SSH dans les VMs

### Organisation proposée
- **P0 → intégrer dans l'Epic 5** comme Story 5.5 (seuils configurables) pour clôturer l'epic proprement
- **P1 + P2 → nouvel Epic 7** "Monitoring Réseau Avancé" (ou renommer l'Epic 6 actuel)
- L'Epic 7 nécessite une réflexion d'architecture en amont (cache de compteurs, nouveau type de critère)

---

## Points techniques à considérer pour l'implémentation

### P0 (seuils configurables)
- Ajouter `cpuThreshold?: number` et `ramThreshold?: number` à `MonitoringCriteria` dans `packages/shared`
- Ou créer un champ séparé dans `InactivityRule` (à décider)
- Migration DB ou default JSON à adapter
- Retirer les constantes `CPU_LOAD_THRESHOLD` et `RAM_USAGE_THRESHOLD` du code
- Tests existants à adapter pour les nouveaux seuils

### P1 (monitoring réseau Docker)
- Docker stats API retourne `networks.eth0.rx_bytes` et `tx_bytes`
- Stocker les bytes du tick précédent dans un `Map<nodeId, { rxBytes: number, txBytes: number }>`
- Delta = bytes actuels - bytes précédents. Si delta < seuil → inactif
- Nouveau critère `networkTraffic` distinct de `networkConnections` (SSH)
- Attention : le premier tick n'a pas de précédent → safe fallback (actif)

### P2 (monitoring réseau Proxmox)
- Endpoint : `GET /api2/json/nodes/{node}/qemu|lxc/{vmid}/rrddata?timeframe=hour`
- Retourne `netin`/`netout` en bytes, séries temporelles
- Comparer les dernières valeurs pour détecter un delta
- Étendre `ProxmoxConnector.getStats()` pour inclure les métriques réseau

---

## Action suivante

Lancer un **[CC] Course Correction** pour :
1. Formaliser P0 comme Story 5.5 dans l'Epic 5
2. Créer l'Epic 7 "Monitoring Réseau Avancé" avec les stories P1 et P2
3. Mettre à jour le PRD et les epics en conséquence
