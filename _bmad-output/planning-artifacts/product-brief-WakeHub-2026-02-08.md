---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
date: 2026-02-08
author: Drunkrain
---

# Product Brief: WakeHub

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Resume Executif

WakeHub est une application open-source de gestion intelligente de l'alimentation pour homelab. Elle repond a un probleme universel des homelabbers : des machines qui tournent 24/7 alors que les services ne sont utilises qu'une fraction du temps, generant des couts d'electricite inutiles, du bruit, de la chaleur et une usure prematuree du materiel.

WakeHub propose un dashboard centralise ou l'utilisateur clique sur un service — WakeHub demarre automatiquement toute la chaine de dependances (machine physique, VM, conteneur, service), puis redirige l'utilisateur vers le service une fois pret. Quand le service n'est plus utilise, WakeHub l'eteint automatiquement selon des criteres d'inactivite configurables par l'utilisateur.

Projet communautaire partage sur GitHub, WakeHub s'inscrit dans l'ecosysteme open-source du homelab.

---

## Vision Fondamentale

### Enonce du Probleme

Les homelabbers font tourner leurs machines (physiques, VMs, conteneurs) en permanence faute de solution native pour gerer l'alimentation de maniere intelligente. Les approches existantes — Wake-on-LAN manuel, scripts cron, arret manuel — sont fragmentees, penibles et reposent sur la memoire de l'utilisateur pour eteindre les machines inutilisees.

### Impact du Probleme

- **Cout energetique** : Des machines allumees 24/7 pour des services utilises quelques heures par jour
- **Nuisances** : Bruit et chaleur excessifs dans l'environnement domestique
- **Usure materielle** : Degradation acceleree des composants par un fonctionnement continu inutile
- **Charge mentale** : L'utilisateur doit penser a allumer, naviguer, puis se souvenir d'eteindre

### Pourquoi les Solutions Existantes Echouent

Il existe de nombreux outils de regroupement et de monitoring de services (dashboards, reverse proxies), mais aucun ne propose une gestion native de l'alimentation integree au workflow d'acces aux services. Le Wake-on-LAN classique et les scripts maison demandent une intervention manuelle a chaque etape et n'offrent aucune automatisation de l'extinction. Le processus reste casse : lancer un script, aller sur la machine, ne pas oublier d'eteindre.

### Solution Proposee

WakeHub est un dashboard centralise qui :
- Affiche l'ensemble des machines, VMs et conteneurs du homelab
- Permet de demarrer un service d'un seul clic, en activant automatiquement toute la chaine de dependances
- Redirige l'utilisateur vers le service des qu'il est operationnel
- Eteint automatiquement les services et machines inactifs selon des criteres configurables
- Decouvre automatiquement les metriques disponibles via les API des plateformes (Proxmox, Docker, etc.) pour proposer des options d'automatisation a l'utilisateur

### Differenciateurs Cles

- **Gestion des dependances** : Demarrage et arret en cascade de toute la chaine (machine physique → VM → conteneur → service)
- **Auto-decouverte des metriques** : Detection automatique des metriques disponibles via les API pour simplifier la configuration de l'automatisation
- **Experience en un clic** : De "je veux regarder un film" a "Jellyfin est ouvert" sans intervention manuelle intermediaire
- **Open-source et communautaire** : Concu par et pour les homelabbers, dans l'esprit de l'ecosysteme homelab

## Utilisateurs Cibles

### Utilisateurs Principaux

#### Persona 1 : Marc — L'informaticien pro
- **Profil** : Administrateur systeme ou developpeur, homelab avance avec plusieurs machines physiques, VMs et dizaines de conteneurs
- **Motivations** : Economiser de l'argent, simplifier la gestion via un dashboard visuel plutot que maintenir ses propres scripts
- **Frustration actuelle** : Ses scripts WoL et cron fonctionnent mais sont penibles a maintenir et manquent de visibilite globale
- **Ce qu'il cherche dans WakeHub** : Un dashboard centralise, une solution fiable qui remplace ses scripts maison, et une economie tangible sur sa facture d'electricite
- **Moment de succes** : Quand il supprime ses vieux scripts et gere tout depuis WakeHub

#### Persona 2 : Sophie — La homelabber intermediaire
- **Profil** : Passionnee de tech, connait les bases de Docker et du reseau, mais n'est pas sysadmin de metier
- **Motivations** : Simplicite de configuration, interface visuelle claire, pouvoir gerer son homelab sans passer des heures en ligne de commande
- **Frustration actuelle** : Laisse ses machines tourner en permanence faute de solution simple pour gerer l'alimentation
- **Ce qu'elle cherche dans WakeHub** : Une configuration facile, une interface intuitive, des presets et de l'auto-decouverte pour eviter la configuration manuelle
- **Moment de succes** : Quand elle parametre ses premieres machines et voit ses premieres automatisations fonctionner

#### Persona 3 : Lucas — Le homelabber debutant
- **Profil** : A un Raspberry Pi et quelques conteneurs Docker, decouvre le monde du self-hosting
- **Motivations** : Apprendre, experimenter, mais sans se noyer dans la complexite
- **Frustration actuelle** : Ne sait pas vraiment comment gerer l'alimentation de ses services, tout tourne en permanence par defaut
- **Ce qu'il cherche dans WakeHub** : Une installation ultra-simple via Docker, une prise en main immediate, une detection automatique de ses appareils sur le reseau
- **Moment de succes** : Quand il installe WakeHub en un `docker compose up` et que ses appareils apparaissent automatiquement

### Utilisateurs Secondaires

#### Le membre du foyer — Emma
- **Profil** : Conjointe, enfant ou colocataire qui utilise les services du homelab (Jellyfin, Nextcloud, etc.) sans aucune connaissance technique
- **Experience** : Ne sait pas que WakeHub existe. Elle lance Jellyfin depuis sa tele ou son telephone. Si le service est eteint, WakeHub detecte la tentative d'acces, demarre la chaine de dependances, et Emma ne voit qu'un temps de chargement legerement plus long que d'habitude
- **Moment de succes** : Elle ne remarque rien — tout fonctionne, toujours

### Parcours Utilisateur

1. **Decouverte** : L'utilisateur trouve WakeHub sur GitHub, via les communautes homelab (Reddit r/homelab, r/selfhosted) ou par le bouche-a-oreille
2. **Installation** : Deploiement simple via Docker (`docker compose up`). WakeHub demarre et detecte automatiquement les appareils presents sur le reseau
3. **Configuration initiale** : L'utilisateur ajoute ses services, WakeHub decouvre les metriques disponibles via les API et propose des options d'automatisation
4. **Moment "Aha!"** : L'utilisateur parametre ses premieres machines, configure ses premieres regles d'automatisation, et voit le systeme fonctionner — demarrage en cascade, arret automatique
5. **Usage quotidien** : Un clic sur un service depuis le dashboard (ou acces direct depuis un appareil comme une tele) — tout demarre et s'eteint automatiquement
6. **Long terme** : Ajout de nouvelles machines, affinement des regles d'automatisation, contribution au projet open-source

## Metriques de Succes

### Succes Utilisateur
- **Retours positifs** : Feedback de la communaute (issues, discussions GitHub, forums homelab)
- **Nombre de telechargements** : Pulls Docker, clones GitHub, telechargements des releases
- **Satisfaction personnelle** : WakeHub fonctionne de maniere fiable sur le homelab de l'auteur — premier critere de succes
- **Adoption communautaire** : Si d'autres homelabbers l'adoptent et trouvent de la valeur, c'est la cerise sur le gateau

### Objectifs du Projet
- **A 3 mois** : Un prototype fonctionnel deploye sur le homelab personnel, capable de gerer le demarrage et l'arret automatique de services
- **A 12 mois** : Une petite communaute active autour du projet, des contributions externes, une base d'utilisateurs qui grandit organiquement

### Indicateurs de Performance (KPI)

#### Metriques internes a l'application
L'application doit collecter et afficher des statistiques sur l'ensemble des operations disponibles, notamment :

- **Temps moyen d'execution par service** : Duree entre le declenchement et la disponibilite du service
- **Economie d'energie estimee** : Temps d'inactivite gagne par machine/service (heures eteintes vs. scenario 24/7)
- **Nombre de demarrages/arrets automatiques** : Par jour, semaine, mois — par service et globalement
- **Taux de reussite des demarrages en cascade** : Pourcentage de chaines de dependances completees sans erreur
- **Temps de reponse de l'auto-decouverte** : Performance de la detection des appareils et metriques
- **Uptime des services** : Temps de fonctionnement effectif vs. temps total disponible
- **Statistiques generales** : Toute metrique disponible est collectee et presentee a l'utilisateur

#### Metriques du projet open-source
- **Etoiles GitHub** : Indicateur de visibilite et d'interet
- **Issues et Pull Requests** : Signe d'une communaute engagee
- **Pulls Docker Hub** : Mesure d'adoption reelle

## Perimetre MVP

### Fonctionnalites Essentielles

#### Dashboard & Interface
- **UI travaillee et user-friendly** : Interface soignee, moderne et belle a voir — non-negociable
- **Vue centralisee** : Affichage de toutes les machines physiques, VMs Proxmox et conteneurs Docker avec leur statut en temps reel
- **Demarrage/arret manuel** : Controle direct des services depuis le dashboard en un clic

#### Gestion des Dependances
- **Chaines de dependances** : Demarrage en cascade automatique (machine physique → VM → conteneur → service)
- **Arret en cascade intelligent** : Avant d'eteindre une dependance, WakeHub verifie qu'aucun autre service actif ne l'utilise. Exemple : le NAS ne s'eteint pas a l'arret de Jellyfin si qBittorrent est encore en cours d'utilisation
- **Dependances partagees** : Gestion native des ressources utilisees par plusieurs services — une dependance ne s'eteint que lorsque tous ses dependants sont inactifs
- **Configuration des dependances** : Interface pour definir les liens entre machines, VMs, conteneurs et services

#### Arret Automatique sur Inactivite
- **Detection d'inactivite** : Surveillance de l'activite des services selon des criteres configurables par l'utilisateur
- **Arret automatique** : Extinction des services et de leurs dependances (sous reserve de verification des dependances partagees) lorsque les criteres d'inactivite sont atteints
- **Parametrage utilisateur** : Seuils et regles d'inactivite personnalisables par service

#### Plateformes Supportees (MVP)
- **Machines physiques** : Demarrage via Wake-on-LAN, arret via SSH/API
- **VMs Proxmox** : Gestion via l'API Proxmox
- **Conteneurs Docker** : Gestion via l'API Docker

### Hors Perimetre MVP
- **Detection passive** : Demarrage automatique lors d'une tentative d'acces depuis un appareil (tele, telephone) — reporte en version future
- **Auto-decouverte reseau** : Detection automatique des appareils sur le reseau — reporte en version future
- **Notifications** : Alertes et notifications — version future
- **Integration Home Assistant** : Interoperabilite avec l'ecosysteme domotique — version future
- **Autres hyperviseurs** : Support VMware, LXC natif, etc. — version future
- **Application mobile** : Interface mobile dediee — version future
- **Planification horaire** : Regles temporelles (eteindre a minuit, etc.) — version future

### Criteres de Succes du MVP
- WakeHub est deploye sur le homelab personnel de l'auteur
- Les services peuvent etre demarres et arretes directement depuis le dashboard
- Les chaines de dependances fonctionnent de maniere fiable
- Les dependances partagees sont correctement protegees (aucune extinction si un autre service actif les utilise)
- L'arret automatique sur inactivite fonctionne correctement
- L'interface est intuitive et visuellement soignee

### Vision Future
- **Systeme de plugins communautaires** : Architecture extensible permettant a la communaute de developper des integrations (Home Assistant, notifications, nouveaux hyperviseurs) sous forme de plugins
- **Detection passive** : WakeHub agit comme point d'entree intelligent, demarrant les services a la demande lorsqu'un appareil tente d'y acceder
- **Auto-decouverte reseau** : Scan automatique du reseau pour detecter et proposer l'ajout de nouvelles machines
- **Ecosysteme d'integrations** : Notifications, domotique, monitoring avance — portes par la communaute via le systeme de plugins
