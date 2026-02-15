---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments: [product-brief-WakeHub-2026-02-08.md]
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
  projectContext: 0
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - WakeHub

**Author:** Drunkrain
**Date:** 2026-02-08

## Resume Executif

Les homelabbers font tourner leurs machines en permanence faute de solution native pour gerer l'alimentation intelligemment. Resultat : des couts d'electricite inutiles, du bruit, de la chaleur, une usure prematuree du materiel, et une charge mentale constante (penser a allumer, naviguer, ne pas oublier d'eteindre).

WakeHub est une application open-source de gestion intelligente de l'alimentation pour homelab. Elle permet de demarrer un service en un clic — avec demarrage automatique en cascade de toutes ses dependances (machine physique, VM, conteneur) — et d'eteindre automatiquement les services inactifs tout en protegeant les dependances partagees.

**Differenciateur principal :** Aucun outil existant dans l'ecosysteme homelab ne combine dashboard de services, demarrage en cascade des dependances et arret automatique sur inactivite. WakeHub comble ce vide.

**Type de projet :** Web App (SPA React + API backend), deployee via Docker, projet greenfield.
**Ressources :** Developpeur solo assiste par IA. Projet open-source communautaire sur GitHub.
**Objectif a 3 mois :** Prototype fonctionnel deploye sur le homelab personnel de l'auteur.

## Criteres de Succes

### Succes Utilisateur
- Un service est accessible en moins de **2 minutes** apres le clic (variable selon la complexite de la chaine)
- L'arret automatique s'execute apres **30 minutes** d'inactivite par defaut (configurable par service)
- Experience fluide : un clic → cascade → redirection vers le service
- Configuration intuitive sans connaissances techniques avancees

### Succes Technique
- Service permanent **24/7** — seul composant toujours allume du homelab
- Dashboard charge en moins de **15 secondes**
- **100% des operations** documentees dans les logs (demarrages, arrets, erreurs, decisions)
- API Proxmox, Docker et WoL/SSH gerees avec gestion d'erreurs fiable
- Dependances partagees protegees — aucune extinction accidentelle

### Succes Business (Projet Open-Source)
- **A 3 mois** : Prototype fonctionnel deploye sur le homelab personnel
- **A 12 mois** : Petite communaute active, contributions externes, croissance organique
- **Indicateurs** : Retours communaute, pulls Docker Hub, etoiles GitHub, issues et PRs actives

### Resultats Mesurables

| Metrique | Cible |
|---|---|
| Temps de demarrage d'une chaine complete | < 2 minutes |
| Delai d'inactivite par defaut | 30 minutes |
| Temps de chargement du dashboard | < 15 secondes |
| Disponibilite de WakeHub | 24/7 |
| Couverture des logs | 100% des operations |

## Perimetre Produit & Cadrage

### MVP (Phase 1)

**Parcours utilisateur supportes :**
- Sophie — Demarrage d'un service en un clic avec cascade de dependances
- Sophie — Premiere configuration de l'infrastructure
- Marc — Gestion d'une cascade en echec (erreurs et logs)
- Le depanneur — Consultation des logs pour comprendre les decisions

**Capacites indispensables :**
- Dashboard centralise avec UI soignee, moderne et statut en temps reel
- Demarrage/arret manuel des services en un clic
- Demarrage en cascade des chaines de dependances
- Arret en cascade intelligent avec protection des dependances partagees
- Arret automatique sur inactivite (30 min par defaut, configurable)
- Support des 3 plateformes : machines physiques (WoL/SSH), VMs Proxmox (API), conteneurs Docker (API)
- Authentification securisee (login, creation de compte, recuperation mot de passe)
- Logging complet de toutes les operations
- Interface de configuration des machines, dependances et regles d'inactivite
- Redirection automatique vers le service une fois disponible

**Approche MVP :** Resolution de probleme — prouver que le concept fonctionne sur le homelab personnel.
**Ressources :** Developpeur solo assiste par IA. Priorisation stricte.

### Phase 2 — Croissance
- Metriques et statistiques (temps d'execution, economie d'energie estimee, historique)
- Tableaux de bord analytiques
- Detection passive des tentatives d'acces (demarrage auto depuis TV/telephone)
- Auto-decouverte des appareils sur le reseau
- Planification horaire (regles temporelles)
- Auto-decouverte des metriques disponibles via les API

### Phase 3 — Expansion
- Systeme de plugins communautaires
- Integration Home Assistant (plugin)
- Notifications et alertes (plugin)
- Support d'autres hyperviseurs : VMware, LXC natif, TrueNAS (plugins)
- Application mobile

## Innovation & Patterns Novateurs

### Zones d'Innovation
- **Gestion d'alimentation native integree au dashboard** : Aucun outil homelab ne combine visualisation des services et controle natif de l'alimentation
- **Orchestration des dependances avec arret intelligent** : Verification des dependances partagees avant arret — approche inedite dans le contexte homelab
- **Combinaison triple inedite** : Dashboard + demarrage en cascade + arret automatique sur inactivite

### Contexte de Marche
- Dashboards existants (Homarr, Heimdall, Homer) : pas de gestion d'alimentation
- Monitoring (Uptime Kuma, Grafana) : surveillance sans controle
- WoL et scripts : solutions fragmentees sans intelligence
- WakeHub : espace vide entre le dashboard et l'orchestration d'alimentation

### Validation & Risques

| Risque | Mitigation |
|---|---|
| Orchestration multi-plateforme | Connecteurs modulaires independants avec interface commune, test isole par plateforme |
| Temps reel (WebSocket/SSE) | Commencer avec SSE, fallback polling si necessaire |
| Fiabilite des cascades | Timeouts configurables, logging detaille, relance manuelle |
| Developpeur solo | Assistance IA, architecture modulaire, contributions open-source futures |
| Adoption incertaine | Premier utilisateur = auteur, feedback Reddit r/selfhosted et r/homelab |

## Parcours Utilisateur

### Parcours 1 : Sophie — "Je veux juste regarder un film" (Succes principal)

**Situation** : Sophie, homelabber intermediaire, rentre du travail. Elle veut regarder un film sur Jellyfin. Son NAS, la VM media et le conteneur Jellyfin sont eteints — WakeHub les a arretes apres 30 minutes d'inactivite ce matin.

**Scene d'ouverture** : Sophie ouvre le dashboard WakeHub. L'interface est claire — tous ses services avec leur statut. Jellyfin affiche "eteint".

**Action montante** : Elle clique sur "Jellyfin". WakeHub affiche la progression : demarrage du NAS... VM media... conteneur Jellyfin...

**Climax** : En moins de 2 minutes, Jellyfin est operationnel. Redirection automatique vers Jellyfin. Sophie lance son film.

**Resolution** : Deux heures plus tard, le film est fini. Apres 30 minutes sans activite, WakeHub verifie : qBittorrent utilise-t-il le NAS ? Non. Il eteint Jellyfin, puis la VM, puis le NAS. Le homelab est silencieux.

**Capacites revelees** : Dashboard temps reel, demarrage en un clic, progression visuelle, redirection automatique, detection d'inactivite, arret intelligent avec verification des dependances partagees.

---

### Parcours 2 : Marc — "La cascade echoue" (Recuperation d'erreur)

**Situation** : Marc demarre Nextcloud. La chaine inclut un serveur physique, une VM et le conteneur Nextcloud.

**Scene d'ouverture** : Marc clique sur Nextcloud. Le serveur physique repond au WoL... mais la VM ne demarre pas. Erreur Proxmox : etat verrouille apres une coupure de courant.

**Action montante** : WakeHub affiche clairement : "Echec VM-Storage — erreur Proxmox : etat verrouille". Progression arretee a l'etape concernee. Evenement enregistre dans les logs.

**Climax** : Marc voit le probleme immediatement, corrige la VM dans Proxmox, relance depuis WakeHub.

**Resolution** : Deuxieme tentative reussie. Logs complets avec horodatage, erreur et recuperation.

**Capacites revelees** : Gestion d'erreurs dans les cascades, feedback visuel clair, logging detaille, relance de cascade.

---

### Parcours 3 : Sophie — "Premiere configuration" (Administrateur)

**Situation** : Sophie installe WakeHub via `docker compose up`. NAS Synology, serveur Proxmox avec 2 VMs, 5 conteneurs Docker.

**Scene d'ouverture** : Premier lancement — formulaire de creation de compte. Puis dashboard vide, invitation a ajouter sa premiere machine.

**Action montante** :
1. Ajout du NAS (IP + MAC pour WoL). Test de connexion.
2. Ajout du serveur Proxmox (URL API + identifiants). WakeHub liste les VMs.
3. Selection des VMs. Detection des conteneurs Docker via l'API.
4. Definition des dependances : Jellyfin → VM-Media → NAS. qBittorrent → NAS.
5. Configuration de l'inactivite : 30 min pour Jellyfin, 2h pour qBittorrent.

**Climax** : Infrastructure complete dans le dashboard — dependances visualisees. Test : clic sur Jellyfin → cascade → ca marche.

**Resolution** : Homelab configure en une session. Plus jamais de machines qui tournent pour rien.

**Capacites revelees** : Creation de compte, ajout de machines (WoL, Proxmox API, Docker API), configuration des dependances, test de connexion, regles d'inactivite par service.

---

### Parcours 4 : Emma — "Ca marche, c'est tout" (Utilisateur secondaire)

**Situation** : Emma veut regarder Jellyfin depuis la tele. Elle ne sait pas que WakeHub existe. Jellyfin est eteint.

**Deroulement** : Emma ouvre Jellyfin — ne repond pas. Elle previent Sophie. Sophie ouvre WakeHub sur son telephone, clique sur Jellyfin. En moins de 2 minutes, Emma rafraichit et lance sa serie.

**Version future** : Avec la detection passive, WakeHub demarrera automatiquement le service sans intervention de Sophie.

**Capacites revelees** : Dashboard responsive, demarrage a distance, besoin futur de detection passive.

---

### Parcours 5 : Le depanneur — "Pourquoi ca ne s'eteint pas ?" (Diagnostic)

**Situation** : Marc remarque que sa VM de stockage est active depuis 3 jours sans utilisation apparente.

**Deroulement** : Consultation des logs. Decouverte : qBittorrent (dependant du NAS) est actif en continu — telechargement torrent depuis 3 jours. Log clair : "Arret VM-Storage annule — dependant actif : qBittorrent (72h)".

**Resolution** : Marc arrete qBittorrent manuellement. WakeHub eteint proprement le NAS puis la VM.

**Capacites revelees** : Logs avec raison des decisions, transparence des dependances partagees, arret manuel, historique des decisions.

---

### Parcours 6 : Lucas — "Mon premier homelab intelligent" (Debutant)

**Situation** : Lucas a un Raspberry Pi et 3 conteneurs Docker (Pi-hole, Nextcloud, Home Assistant). Il decouvre WakeHub sur Reddit r/selfhosted.

**Scene d'ouverture** : `docker compose up` — WakeHub demarre. Premier lancement : formulaire de creation de compte. Dashboard vide.

**Action montante** : Lucas ajoute son Raspberry Pi (IP + MAC). Il connecte l'API Docker — WakeHub liste ses 3 conteneurs. Il definit une dependance simple : Nextcloud → Raspberry Pi. Il configure 30 minutes d'inactivite pour Nextcloud.

**Climax** : Premier test — clic sur Nextcloud. Le Pi est deja allume, le conteneur demarre en 10 secondes. Redirection automatique. Lucas comprend le potentiel.

**Resolution** : Le soir, Nextcloud s'eteint automatiquement apres 30 minutes. Le lendemain, un clic suffit. Lucas planifie deja d'ajouter un NAS pour etendre son homelab.

**Capacites revelees** : Installation simple via Docker, ajout de machines, auto-detection des conteneurs, configuration de dependances basiques, arret automatique, experience d'onboarding fluide.

---

### Parcours 7 : Le contributeur — "Ajouter le support TrueNAS" (Open-source)

**Situation** : Alex utilise TrueNAS, non supporte dans le MVP. Il veut contribuer.

**Deroulement** : Decouverte sur Reddit r/selfhosted → repo GitHub → documentation et code lisibles → comprehension des patterns d'integration → developpement du module TrueNAS → Pull Request → merge.

**Capacites revelees** : Architecture extensible et documentee, patterns clairs pour les integrations, documentation contributeur.

---

### Resume des Capacites par Parcours

| Parcours | Capacites cles |
|---|---|
| Sophie — Succes | Dashboard, cascade, redirection, arret auto, dependances partagees |
| Marc — Erreur | Gestion d'erreurs, feedback visuel, logging, relance |
| Sophie — Config | Creation de compte, ajout machines, config dependances, regles d'inactivite |
| Emma — Secondaire | Dashboard responsive, demarrage a distance |
| Depanneur | Logs detailles, raison des decisions, historique |
| Lucas — Debutant | Installation Docker, ajout machines, auto-detection conteneurs, onboarding |
| Contributeur | Architecture extensible, documentation, patterns d'integration |

## Exigences Specifiques Web App

### Vue d'Ensemble
SPA React deployee via Docker en reseau local. Pages principales :
- **Dashboard** : Etat de tous les services en temps reel
- **Vue Machine** : Detail d'une machine avec VMs, conteneurs et dependances
- **Settings** : Configuration des machines, dependances, regles d'inactivite
- **Logs** : Historique des operations et diagnostic

### Architecture Technique

**Frontend :**
- React (SPA avec routing cote client via React Router)
- Communication temps reel (WebSocket ou SSE) pour mise a jour instantanee des statuts
- Design responsive (desktop, tablette, telephone)

**Compatibilite navigateurs :** Chrome, Firefox, Edge, Safari (dernieres versions). Support etendu si le cout de compatibilite est faible. Pas d'Internet Explorer.

**SEO :** Aucun pour l'application (reseau local). SEO pour la page GitHub (README, descriptions, tags).

**Accessibilite :** Navigation clavier, contraste, labels ARIA, information non dependante de la couleur seule.

### Implementation
- **Deployment** : Conteneur Docker unique (frontend + backend)
- **API Backend** : API REST pour communication frontend-backend
- **Persistance** : Base de donnees pour la configuration (machines, dependances, regles, comptes)
- **Securite** : Authentification par login securise, chiffrement des donnees sensibles en base

## Exigences Fonctionnelles

### Authentification & Securite Utilisateur

- FR1: Lors de la premiere ouverture, le systeme affiche un formulaire de creation de compte (nom d'utilisateur, mot de passe, confirmation)
- FR2: L'utilisateur peut se connecter via login avec mot de passe hache et session authentifiee (nom d'utilisateur + mot de passe)
- FR3: L'utilisateur peut activer "Se souvenir de moi" pour maintenir sa session
- FR4: L'utilisateur peut reinitialiser son mot de passe via un formulaire de reset securise (verification de l'identite par question ou token)

### Gestion de l'Infrastructure

- FR5: L'administrateur peut ajouter une machine physique (adresse IP, adresse MAC)
- FR6: L'administrateur peut ajouter un serveur Proxmox (URL API, identifiants)
- FR7: L'administrateur peut ajouter un hote Docker (URL API)
- FR8: Le systeme liste les VMs disponibles sur un serveur Proxmox connecte
- FR9: Le systeme liste les conteneurs disponibles sur un hote Docker connecte
- FR10: L'administrateur peut tester la connexion a une machine ou un service
- FR11: L'administrateur peut supprimer une machine, VM ou conteneur
- FR12: L'administrateur peut modifier les parametres d'une machine, VM ou conteneur

### Gestion des Dependances

- FR13: L'administrateur peut definir des liens de dependance entre machines, VMs, conteneurs et services
- FR14: L'administrateur peut definir des dependances partagees (ressource utilisee par plusieurs services)
- FR15: Le systeme calcule la chaine de dependances complete pour un service donne
- FR16: L'administrateur peut visualiser le graphe de dependances de son infrastructure
- FR17: L'administrateur peut modifier ou supprimer un lien de dependance

### Controle d'Alimentation

- FR18: L'utilisateur peut demarrer un service en un clic depuis le dashboard
- FR19: Le systeme demarre automatiquement toute la chaine de dependances (cascade ascendante)
- FR20: L'utilisateur peut arreter manuellement un service depuis le dashboard
- FR21: Le systeme arrete un service et ses dependances en cascade (cascade descendante)
- FR22: Le systeme verifie qu'aucun service actif n'utilise une dependance partagee avant de l'eteindre
- FR23: Le systeme demarre une machine physique via Wake-on-LAN
- FR24: Le systeme arrete une machine physique via SSH ou API
- FR25: Le systeme demarre et arrete une VM via l'API Proxmox
- FR26: Le systeme demarre et arrete un conteneur via l'API Docker
- FR27: Le systeme affiche la progression de chaque etape lors d'un demarrage en cascade
- FR28: L'utilisateur peut relancer un demarrage en cascade apres un echec

### Surveillance d'Inactivite & Arret Automatique

- FR29: Le systeme surveille l'activite d'un service selon des criteres configurables (connexions reseau, requetes API, activite CPU/RAM, sessions utilisateur, accessibilite HTTP/HTTPS du service)
- FR30: Le systeme declenche un arret automatique apres une periode d'inactivite configurable
- FR31: L'administrateur peut definir un delai d'inactivite par defaut (30 minutes)
- FR32: L'administrateur peut personnaliser le delai d'inactivite par service
- FR33: Le systeme respecte les dependances partagees lors d'un arret automatique
- FR34: Le systeme annule un arret automatique si un dependant actif est detecte
- FR48: L'administrateur peut configurer les seuils CPU et RAM de detection d'inactivite par regle (defaut 50%)
- FR49: Le systeme detecte l'inactivite reseau des conteneurs Docker via le delta de trafic (rx_bytes/tx_bytes) entre deux cycles de monitoring
- FR50: Le systeme detecte l'inactivite reseau des VMs et LXCs via les metriques Proxmox rrddata (netin/netout) sans necessite de SSH

### Dashboard & Visualisation

- FR35: L'utilisateur voit l'etat de toutes les machines, VMs et conteneurs en temps reel
- FR36: L'utilisateur voit le statut de chaque service (allume, eteint, en demarrage, en arret, erreur)
- FR37: Le systeme met a jour les statuts en temps reel sans rechargement de page
- FR38: L'utilisateur peut acceder a une vue detaillee d'une machine (VMs, conteneurs, dependances)
- FR39: L'utilisateur est redirige automatiquement vers le service une fois operationnel

### Configuration & Parametrage

- FR40: L'administrateur peut acceder a une page de parametres dediee
- FR41: L'administrateur peut configurer les identifiants de connexion aux API (Proxmox, Docker)
- FR42: L'administrateur peut configurer les parametres de connexion SSH pour les machines physiques
- FR43: L'administrateur peut definir l'URL d'acces a chaque service (pour la redirection)

### Journalisation & Diagnostic

- FR44: Le systeme enregistre toutes les operations (demarrages, arrets, erreurs) avec horodatage
- FR45: Le systeme enregistre la raison de chaque decision (arret annule car dependant actif, etc.)
- FR46: L'utilisateur peut consulter l'historique des logs depuis l'interface
- FR47: Le systeme affiche l'etape en echec, le code d'erreur et le message de la plateforme lors d'une cascade echouee

## Exigences Non-Fonctionnelles

### Performance
- Dashboard charge en moins de **15 secondes**
- Cascade complete en moins de **2 minutes** (variable selon complexite)
- Mises a jour temps reel en moins de **3 secondes** apres changement d'etat
- Appels API avec timeout configurable (30 secondes par defaut) pour eviter les blocages

### Securite
- Donnees sensibles chiffrees au repos (identifiants API, cles SSH, tokens)
- Mots de passe utilisateur haches avec bcrypt ou argon2
- Communications frontend-backend via HTTPS

### Fiabilite
- Service permanent 24/7
- Redemarrage automatique du conteneur apres defaillance ou reboot
- Documentation pour configurer la chaine de recuperation apres coupure de courant :
  - BIOS : "Power On after AC Loss"
  - Demarrage automatique du service Docker au boot
  - Politique de redemarrage du conteneur WakeHub
- Chaine de recuperation : courant → machine hote → Docker → WakeHub → reprise de la surveillance
- Resilience : les operations en cours lors d'un crash ne corrompent pas la base de donnees

### Integration
- Connecteurs d'API avec interface commune pour ajouter de nouvelles plateformes
- Gestion des erreurs API avec messages incluant le type d'erreur, le code et la description (timeout, authentification echouee, service indisponible)
- Compatibilite avec les versions majeures actuelles des API Proxmox et Docker

### Accessibilite
- Navigation au clavier fonctionnelle
- Contraste conforme WCAG AA (ratio 4.5:1 minimum)
- Labels ARIA sur les elements interactifs
- Information non dependante de la couleur seule
