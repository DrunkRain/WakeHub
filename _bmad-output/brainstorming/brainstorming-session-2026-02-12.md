---
stepsCompleted: [1, 2, 3]
inputDocuments: [prd.md, architecture.md, ux-design-specification.md]
session_topic: 'Repenser le modele de relations entre entites infrastructure et orchestration allumage/extinction'
session_goals: 'Definir un modele de donnees et une architecture de commande pour la hierarchie physique → hote → VM/conteneur avec cascades fiables'
selected_approach: 'collaborative-exploration'
techniques_used: [scenario-analysis, edge-case-exploration, real-world-mapping]
ideas_generated: [arbre-hebergement, graphe-dependances, capacites-controle, decouverte-auto, epinglage-dashboard, confirmation-extinction, pre-remplissage-auto-detect]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Drunkrain
**Date:** 2026-02-12

## Session Overview

**Topic:** Repenser le modele de relations entre entites d'infrastructure (machines physiques, hotes Proxmox/Docker, VMs, LXC, conteneurs) et la logique d'orchestration des commandes d'allumage/extinction pour WakeHub.

**Probleme identifie:** L'ancien modele unifie "services" ne distinguait pas correctement les entites qui peuvent s'eteindre elles-memes de celles qui ne peuvent etre controlees que par leur parent. Exemple : Docker est un service de l'OS, il ne peut pas s'eteindre lui-meme — seul son hote peut l'arreter. Un conteneur Docker est controle par le daemon Docker, pas par lui-meme.

**Homelab de reference (Drunkrain) :**
- Machine 1 (Proxmox) : VM-Docker (avec conteneurs), VM-Ubuntu Server
- Machine 2 (Proxmox) : VM-Home Assistant, LXC-Jellyfin, LXC-Cloudflared
- NAS (machine physique simple)

---

## Modele Retenu : Deux Couches Superposees

### Types d'Entites

| Type | Peut etre allume par | Peut etre eteint par | Capacites optionnelles |
|---|---|---|---|
| Machine physique | WoL | SSH | proxmox_api, docker_api |
| VM | Proxmox API du parent | Proxmox API du parent | docker_api |
| LXC | Proxmox API du parent | Proxmox API du parent | docker_api |
| Conteneur Docker | Docker API du parent | Docker API du parent | aucune |

**Remarques :**
- Une machine physique peut avoir Proxmox ET/OU Docker (Raspberry Pi = Docker sans Proxmox)
- Une VM ou un LXC peut faire tourner Docker (VM-Docker, LXC avec Docker)
- Un conteneur Docker est toujours une feuille (pas de capacites de controle)
- Une machine physique sans Proxmox ni Docker est valide (NAS Synology, PC gaming — juste WoL+SSH)

### Couche 1 — Arbre d'Hebergement (Structurel)

**Nature :** Parent-enfant strict, 0 ou 1 parent par entite.

**Fonction :** Represente "qui tourne sur quoi" et determine le canal de commande (comment WakeHub parle a chaque noeud).

**Decouverte :**
- Proxmox : connexion API → decouverte automatique des VMs et LXCs
- Docker : connexion API → decouverte automatique des conteneurs
- Les entites decouvertes restent en etat "decouvert mais pas configure" → l'utilisateur voit "X services a configurer" dans la page detail de l'hote et choisit lesquels activer
- **Pre-remplissage automatique :** quand l'utilisateur configure un service auto-detecte, le formulaire est pre-rempli avec toutes les donnees deja connues de l'API (nom, ID plateforme, statut, ressources, ports, image...). L'utilisateur n'a qu'a completer les infos que WakeHub ne peut pas deviner (dependances fonctionnelles, URL du service, regles d'inactivite)

**Canal de commande :**
- Pour controler un noeud, on utilise la capacite du parent qui correspond
- Machine physique avec proxmox_api → controle ses VMs/LXCs via Proxmox API
- VM avec docker_api → controle ses conteneurs via Docker API
- Machine physique avec docker_api (Raspberry Pi) → controle ses conteneurs directement

**Acces Docker API :** Deux modes possibles pour maximiser la flexibilite :
- Acces direct via IP de la VM/LXC (port 2375/2376)
- Tunnel SSH a travers la VM/LXC

**Topologies supportees :**
```
A) Machine → Proxmox → VM/LXC → Docker → Conteneurs  (cas Drunkrain)
B) Machine → Docker → Conteneurs                       (Raspberry Pi)
C) Machine → Proxmox → VM/LXC                          (sans Docker)
D) Machine seule                                        (NAS, PC gaming)
```

### Couche 2 — Graphe de Dependances (Fonctionnel)

**Nature :** Graphe oriente, defini par l'utilisateur, flexible.

**Fonction :** Represente "qui a besoin de quoi pour fonctionner". Impacte le demarrage (allumer les dependances d'abord) et l'extinction (proteger si dependants actifs).

**Regles :**
- N'importe quel noeud peut dependre de n'importe quel autre (cross-arbre possible)
- Les dependances peuvent etre partagees (NAS utilise par Jellyfin ET Plex)
- Detection de cycles obligatoire a la creation du lien (bloque si cycle detecte)
- Les dependances sont arbitraires : donnees, reseau, ou simplement "je veux que ca vive ensemble"

**Exemple concret :**
```
LXC-Jellyfin (Machine2) ──depends on──→ NAS (machine standalone)
Conteneur-Sandbox ──depends on──→ LXC-Jellyfin
```

---

## Regles d'Orchestration

### Demarrage d'un Noeud

Sequentiel, jamais parallele.

1. **Resoudre les dependances fonctionnelles (Couche 2)** : identifier toutes les dependances recursives, les demarrer dans l'ordre (les plus profondes d'abord)
2. **Pour chaque noeud a demarrer** : remonter l'arbre d'hebergement (Couche 1), s'assurer que chaque parent est allume du haut vers le bas (machine physique → hyperviseur → VM → Docker → conteneur)
3. Attendre que chaque noeud soit effectivement up avant de passer au suivant

**Exemple — Demarrage de Jellyfin :**
1. Jellyfin depend du NAS (Couche 2) → demarrer le NAS (WoL), attendre up
2. Jellyfin est sur Machine2/Proxmox/LXC (Couche 1) → demarrer Machine2 (WoL), attendre up → LXC-Jellyfin (Proxmox API), attendre up

### Extinction d'un Noeud

Bottom-up dans l'arbre, puis re-evaluation des dependances.

1. **Descendre l'arbre d'hebergement** : eteindre tous les enfants d'abord (recursivement, bottom-up)
2. **Eteindre le noeud demande**
3. **Re-evaluer les dependances fonctionnelles** : les dependances du noeud eteint (et de ses enfants) ont-elles encore des dependants actifs ailleurs ?
   - Si non ET option "Confirmer avant extinction" desactivee → eteindre automatiquement
   - Si non ET option "Confirmer avant extinction" activee → notification/popup de proposition
   - Si oui → laisser la dependance allumee

**Exemple — Extinction de Machine1 :**
1. Eteindre les conteneurs Docker sur VM-Docker (Docker API)
2. Eteindre VM-Docker (Proxmox API)
3. Eteindre VM-Ubuntu (Proxmox API)
4. Eteindre Machine1 (SSH)
5. Re-evaluation : le NAS a-t-il encore des dependants actifs ? Si non → proposer l'extinction du NAS (si option "Confirmer" activee) ou eteindre auto (si desactivee)

### Protection des Dependances Partagees

Avant d'eteindre un noeud, verifier qu'aucun dependant actif n'existe en dehors de la cascade en cours. Les noeuds qu'on est deja en train d'eteindre dans cette meme cascade ne comptent pas comme "dependants actifs".

### Option "Confirmer avant extinction automatique"

- Configurable par noeud
- Activee par defaut sur les machines physiques
- Desactivee par defaut sur les VMs, LXCs et conteneurs
- Ne concerne que l'extinction par re-evaluation (pas l'extinction explicite par l'utilisateur)
- L'extinction explicite utilise la popup de confirmation classique ("Eteindre X et ses Y dependants ?")

---

## Dashboard et Visibilite

- **Tout noeud est epinglable** sur le dashboard (machine physique, VM, LXC, conteneur)
- L'utilisateur compose son dashboard librement via :
  - Bouton "Epingler" dans la page detail d'un noeud
  - Bouton "Epingler" dans la ligne du tableau machines
  - Bouton "+" sur le dashboard pour ajouter un service

---

## Decisions Cles Prises

| Decision | Choix | Rationale |
|---|---|---|
| Modele de donnees | Deux couches (arbre + graphe) | Separe hebergement et dependance fonctionnelle |
| Canal de commande | Deduit de la capacite du parent | Simple, pas de config explicite |
| Decouverte | Auto pour Proxmox/Docker, manuelle pour machines physiques | Equilibre UX |
| Entites decouvertes | Etat "decouvert non configure" | Ne noie pas l'utilisateur |
| Demarrage | Sequentiel (deps d'abord, puis arbre) | Fiabilite, pas de race condition |
| Extinction | Bottom-up + re-evaluation des deps | Propre et intelligent |
| Cycles | Bloques a la creation | Prevention plutot que detection |
| Dashboard | Epinglage libre par l'utilisateur | Flexibilite maximale |
| Confirmation extinction | Option par noeud, defaut selon type | Controle fin sans friction |
| Pre-remplissage config | Formulaire pre-rempli depuis les donnees API | Zero re-saisie, UX fluide |
