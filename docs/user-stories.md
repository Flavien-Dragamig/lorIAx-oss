# User Stories — LorIAx

## Epic 1 : Authentification et gestion des utilisateurs

### US-1.1 : Inscription et connexion
**En tant qu'** utilisateur, **je veux** pouvoir créer un compte et me connecter avec email/mot de passe, **afin de** disposer d'un espace personnel sécurisé.

**Critères d'acceptation :**
- Formulaire d'inscription avec email, nom, mot de passe
- Validation du format email et force du mot de passe
- Connexion par email/mot de passe
- Session persistante (cookie sécurisé)
- Déconnexion

### US-1.2 : Connexion LDAP / SSO
**En tant qu'** administrateur, **je veux** connecter LorIAx à notre annuaire LDAP/Active Directory, **afin que** les utilisateurs se connectent avec leurs identifiants habituels.

**Critères d'acceptation :**
- Configuration LDAP dans l'interface admin
- Synchronisation automatique des utilisateurs
- Mapping des groupes LDAP vers les équipes LorIAx

### US-1.3 : Gestion des rôles
**En tant qu'** administrateur, **je veux** attribuer des rôles (admin, éditeur, lecteur) aux utilisateurs, **afin de** contrôler qui peut faire quoi.

**Critères d'acceptation :**
- Rôles globaux : super_admin, admin, editor, viewer
- Interface d'administration des utilisateurs
- Changement de rôle immédiat

### US-1.4 : Création d'utilisateur par l'admin
**En tant qu'** administrateur ou super administrateur, **je veux** créer un compte utilisateur directement depuis l'interface d'administration, **afin d'** intégrer un collaborateur sans qu'il passe par l'inscription publique.

**Critères d'acceptation :**
- Bouton « + Ajouter un utilisateur » dans `Administration → Utilisateurs`
- Formulaire : nom, email, mot de passe (avec toggle voir/masquer), rôle
- Le sélecteur de rôle est filtré selon le rôle du connecté : un `admin` ne peut pas créer de `super_admin`
- Option d'envoi d'un email de bienvenue contenant les identifiants et le lien de connexion
- L'échec d'envoi de l'email n'empêche pas la création du compte
- Toast différencié : succès avec email / succès sans email / email demandé mais non envoyé

---

## Epic 2 : Espaces et organisation

### US-2.1 : Espace personnel
**En tant qu'** utilisateur, **je veux** avoir un espace de notes personnelles, **afin de** prendre des notes privées sans que personne ne les voie.

**Critères d'acceptation :**
- Espace personnel créé automatiquement à l'inscription
- Notes privées par défaut
- Possibilité de publier une note vers l'espace équipe/org

### US-2.2 : Espace équipe
**En tant que** membre d'un service, **je veux** accéder à un espace partagé avec mon équipe, **afin de** collaborer sur de la documentation commune.

**Critères d'acceptation :**
- Création d'un espace équipe par un admin
- Ajout/retrait de membres
- Permissions par défaut configurables (viewer/editor)

### US-2.3 : Espace organisation
**En tant qu'** administrateur, **je veux** un espace visible par tous les collaborateurs, **afin de** centraliser la documentation officielle.

**Critères d'acceptation :**
- Espace unique par organisation
- Visible par tous les utilisateurs authentifiés
- Seuls les admins peuvent éditer par défaut

### US-2.4 : Contrôle de visibilité par document
**En tant qu'** éditeur, **je veux** pouvoir définir la visibilité de chaque document (privé, équipe, public), **afin de** partager sélectivement mes notes.

**Critères d'acceptation :**
- Toggle de visibilité sur chaque document
- Privé = moi seul, équipe = mon équipe, public = toute l'org
- Permissions fines additionnelles (inviter un user spécifique)

---

## Epic 3 : Éditeur de documents

### US-3.1 : Édition WYSIWYG
**En tant qu'** utilisateur, **je veux** éditer mes documents dans un éditeur riche type Notion (pas de split-screen), **afin d'** avoir une expérience fluide et intuitive.

**Critères d'acceptation :**
- Éditeur WYSIWYG temps réel (rendu instantané)
- Formatage : gras, italique, souligné, barré, code inline
- Titres H1-H4
- Listes à puces, numérotées, à cocher
- Raccourcis clavier type Notion (Ctrl+B, Ctrl+I, etc.)

### US-3.2 : Slash commands
**En tant qu'** utilisateur, **je veux** taper "/" pour insérer des blocs, **afin d'** accéder rapidement à tous les types de contenu.

**Critères d'acceptation :**
- Menu slash commandes avec recherche
- Blocs disponibles : titre, liste, checklist, citation, callout, code, image, tableau, séparateur, toggle, embed
- Navigation clavier dans le menu

### US-3.3 : Blocs modulaires
**En tant qu'** utilisateur, **je veux** des blocs riches (tableaux, callouts, code syntax highlighted, toggles), **afin de** structurer mon contenu de manière variée.

**Critères d'acceptation :**
- Tableau éditable avec ajout/suppression lignes/colonnes
- Callout avec icône et couleur configurable
- Bloc code avec coloration syntaxique (lowlight)
- Toggle (contenu dépliable)
- Séparateur horizontal

### US-3.4 : Drag and drop
**En tant qu'** utilisateur, **je veux** réorganiser les blocs par glisser-déposer, **afin de** restructurer mes documents facilement.

**Critères d'acceptation :**
- Handle de drag visible au survol
- Déplacement de blocs par drag & drop
- Indicateur visuel de la position cible

### US-3.5 : Wiki-links
**En tant qu'** utilisateur, **je veux** créer des liens entre documents avec la syntaxe [[nom-du-doc]], **afin de** construire un réseau de connaissances interconnecté.

**Critères d'acceptation :**
- Autocomplétion en tapant [[
- Résolution des liens vers les documents existants
- Création de document depuis un lien vers un doc inexistant
- Backlinks visibles sur chaque document

### US-3.6 : Upload d'images et fichiers
**En tant qu'** utilisateur, **je veux** insérer des images et fichiers dans mes documents (copier-coller, drag & drop, bouton), **afin d'** enrichir mes notes.

**Critères d'acceptation :**
- Upload par copier-coller
- Upload par drag & drop
- Upload par bouton
- Stockage dans MinIO
- Preview inline des images

---

## Epic 4 : Templates

### US-4.1 : Templates de page
**En tant qu'** utilisateur, **je veux** créer un document à partir d'un template (PV réunion, wiki, rapport, etc.), **afin de** gagner du temps et standardiser les contenus.

**Critères d'acceptation :**
- Choix du template à la création d'un document
- Templates globaux (admin) et locaux (par espace)
- Preview du template avant sélection

### US-4.2 : Gestion des templates par l'admin
**En tant qu'** administrateur, **je veux** créer, modifier et supprimer des templates globaux, **afin de** standardiser les documents dans l'organisation.

**Critères d'acceptation :**
- CRUD de templates dans l'interface admin
- Assignation de catégorie et icône
- Activation/désactivation d'un template

### US-4.3 : Thèmes visuels
**En tant qu'** utilisateur, **je veux** personnaliser l'apparence de mon interface (thème clair/sombre, accents), **afin d'** avoir un environnement de travail confortable.

**Critères d'acceptation :**
- Toggle mode clair / sombre
- Persistance du choix dans les préférences utilisateur

---

## Epic 5 : Graphe de connaissances

### US-5.1 : Vue graphe
**En tant qu'** utilisateur, **je veux** voir une visualisation interactive du graphe de liens entre mes documents, **afin de** découvrir des connexions entre idées.

**Critères d'acceptation :**
- Graphe force-directed interactif (zoom, pan, drag nodes)
- Couleurs selon le type de nœud (document, tag)
- Clic sur un nœud ouvre le document
- Filtrage par espace

### US-5.2 : Backlinks
**En tant qu'** utilisateur, **je veux** voir la liste des documents qui pointent vers le document courant, **afin de** comprendre le contexte et naviguer entre documents liés.

**Critères d'acceptation :**
- Panel backlinks visible sur chaque document
- Lien cliquable vers le document source
- Extrait du contexte du lien

---

## Epic 6 : Intelligence artificielle

### US-6.1 : Recherche sémantique
**En tant qu'** utilisateur, **je veux** chercher dans la base par le sens (pas seulement les mots-clés), **afin de** trouver des documents pertinents même si les termes exacts diffèrent.

**Critères d'acceptation :**
- Barre de recherche avec mode "sémantique"
- Résultats classés par pertinence
- Indication du score de similarité
- Combiné avec la recherche full-text PostgreSQL

### US-6.2 : Chat RAG
**En tant qu'** utilisateur, **je veux** poser des questions en langage naturel sur ma base de connaissances, **afin d'** obtenir des réponses synthétisées basées sur mes documents.

**Critères d'acceptation :**
- Interface chat dans un panel latéral
- Réponses basées sur les documents de la base (RAG)
- Citations avec liens vers les sources
- Streaming de la réponse

### US-6.3 : Résumé de document
**En tant qu'** utilisateur, **je veux** générer un résumé d'un document ou d'un ensemble de documents, **afin d'** obtenir rapidement l'essentiel.

**Critères d'acceptation :**
- Bouton "Résumer" sur un document
- Résumé généré par l'IA avec le provider configuré
- Possibilité de copier ou d'insérer le résumé

### US-6.4 : Configuration IA par l'admin
**En tant qu'** administrateur, **je veux** configurer les providers IA (Claude, OpenAI, Ollama), **afin de** choisir le service adapté à notre politique de données.

**Critères d'acceptation :**
- Interface de configuration des providers
- Test de connexion
- Choix du provider par défaut
- Possibilité d'utiliser un LLM local (Ollama)

---

## Epic 7 : Embeds et intégrations

### US-7.1 : Link preview
**En tant qu'** utilisateur, **je veux** que les liens collés dans un document affichent automatiquement un aperçu riche (titre, description, image), **afin d'** enrichir mes notes sans effort.

**Critères d'acceptation :**
- Détection automatique des URLs
- Fetch des métadonnées (Open Graph)
- Rendu en bloc embed avec titre, description, image
- Fallback vers lien simple si les métadonnées ne sont pas disponibles

### US-7.2 : Google Docs embed
**En tant qu'** utilisateur, **je veux** intégrer un Google Doc dans mon document LorIAx, **afin de** centraliser l'accès sans dupliquer le contenu.

**Critères d'acceptation :**
- Coller un lien Google Docs => iframe embed
- Rendu responsive
- Indication visuelle "contenu externe"

---

## Epic 8 : Versioning

### US-8.1 : Historique des versions
**En tant qu'** utilisateur, **je veux** voir l'historique des modifications d'un document, **afin de** savoir qui a changé quoi et quand.

**Critères d'acceptation :**
- Liste des commits git pour un document
- Auteur, date, message de commit
- Clic pour voir le contenu à une version donnée

### US-8.2 : Restauration de version
**En tant qu'** utilisateur, **je veux** restaurer un document à une version antérieure, **afin de** récupérer du contenu supprimé ou modifié par erreur.

**Critères d'acceptation :**
- Bouton "Restaurer" sur une version
- Création d'un nouveau commit (pas de rewrite d'historique)
- Notification à l'utilisateur de la restauration

---

## Epic 9 : Navigation et recherche

### US-9.1 : Sidebar arborescente
**En tant qu'** utilisateur, **je veux** naviguer dans mes documents via une sidebar avec arborescence de dossiers, **afin de** retrouver rapidement mes notes.

**Critères d'acceptation :**
- Arborescence dépliable
- Dossiers et documents avec icônes
- Drag & drop pour réorganiser
- Indicateurs visuels (nouveau, modifié)

### US-9.2 : Barre de commandes
**En tant qu'** utilisateur, **je veux** une barre de commandes rapide (Ctrl+K), **afin d'** accéder à n'importe quel document ou action en quelques frappes.

**Critères d'acceptation :**
- Ouverture par Ctrl+K / Cmd+K
- Recherche dans les documents, espaces, commandes
- Navigation clavier
- Actions rapides (nouveau doc, changer d'espace)

### US-9.3 : Recherche full-text
**En tant qu'** utilisateur, **je veux** une recherche textuelle rapide dans tous mes documents accessibles, **afin de** retrouver un contenu précis.

**Critères d'acceptation :**
- Recherche full-text PostgreSQL (ts_vector, ts_query)
- Support du français (stemming, stop words)
- Résultats avec extraits et highlight
- Filtres par espace, date, auteur

### US-9.4 : Question IA
**En tant qu'** utilisateur, **je veux** poser des questions en langage naturel depuis la page de recherche, **afin d'** obtenir des réponses synthétisées à partir de mes documents.

**Critères d'acceptation :**
- Toggle entre mode recherche et mode question IA
- Réponse en streaming basée sur le RAG
- Interface avec exemples de questions

**Statut : fait**

---

## Epic 10 : Partage et contrôle d'accès

### US-10.1 : Gestion des membres d'un espace
**En tant qu'** administrateur d'un espace, **je veux** ajouter et gérer des membres avec des niveaux de permission, **afin de** contrôler qui peut accéder à quoi.

**Critères d'acceptation :**
- Recherche d'utilisateurs par nom ou email
- Ajout avec choix du rôle (lecteur, éditeur, administrateur)
- Modification du rôle en un clic
- Suppression d'un membre
- Affichage du propriétaire de l'espace

**Statut : fait**

### US-10.2 : Visibilité des documents
**En tant qu'** éditeur, **je veux** choisir la visibilité de chaque document (privé, équipe, public), **afin de** partager sélectivement mes contenus.

**Critères d'acceptation :**
- Popover de choix de visibilité depuis le header du document
- 3 niveaux : privé (moi seul), équipe (membres de l'espace), public (toute l'organisation)
- Mise à jour immédiate via API

**Statut : fait**

### US-10.3 : Espaces structurés
**En tant qu'** administrateur, **je veux** créer des espaces à partir de modèles prédéfinis (RH, Communication, Commercial, etc.), **afin de** structurer rapidement l'organisation.

**Critères d'acceptation :**
- Liste de modèles dans le dialogue de création d'espace
- Pré-remplissage du nom et de la description
- Espaces de type équipe ou organisation

**Statut : fait**

---

## Epic 11 : @Mentions

### US-11.1 : Mentionner un utilisateur
**En tant qu'** éditeur, **je veux** mentionner un collaborateur en tapant @, **afin de** le référencer dans un document.

**Critères d'acceptation :**
- Autocomplétion au caractère @
- Recherche par nom et email
- Rendu visuel distinct (badge coloré)
- Navigation clavier dans les suggestions

**Statut : fait**

---

## Epic 12 : Administration avancée

### US-12.1 : Gestion des templates
**En tant qu'** administrateur, **je veux** créer, modifier et supprimer des templates de documents, **afin de** standardiser les contenus.

**Critères d'acceptation :**
- CRUD complet dans l'onglet admin
- Catégorisation et icône
- Contenu en Markdown
- Toggle global / espace

**Statut : fait**

### US-12.2 : Paramètres système
**En tant qu'** administrateur, **je veux** configurer les paramètres généraux de l'application, **afin de** personnaliser le comportement pour mon organisation.

**Critères d'acceptation :**
- Nom et URL de l'application
- Inscription ouverte (toggle)
- Rôle par défaut
- Permissions par rôle (toggles matriciels)
- Configuration SMTP (à venir)

**Statut : fait**

### US-12.3 : Historique d'activité
**En tant qu'** administrateur d'espace, **je veux** voir l'historique des actions, **afin de** suivre l'activité de mon équipe.

**Critères d'acceptation :**
- Timeline regroupée par jour
- Actions : création, modification, suppression, ajout/retrait de membres
- Auteur et horodatage
- Lien depuis les paramètres d'espace

**Statut : fait**

---

## Epic 13 : Dossiers

### US-13.1 : Création de dossiers
**En tant qu'** utilisateur, **je veux** créer des dossiers dans la sidebar, **afin de** organiser mes documents en arborescence.

**Critères d'acceptation :**
- Bouton de création de dossier dans la sidebar
- Nom inline avec validation Entrée/Échap
- Dossier dépliable avec icône dédiée
- Drag & drop des documents dans les dossiers

**Statut : fait**

---

## Epic 14 : Apparence personnalisable

### US-14.1 : Personnalisation de l'éditeur
**En tant qu'** utilisateur, **je veux** personnaliser l'apparence de l'éditeur (couleur d'accentuation, police, fond, largeur), **afin d'** adapter mon environnement de travail à mes préférences.

**Critères d'acceptation :**
- Choix de couleur d'accentuation (5 couleurs LorIAx)
- Choix de police (serif, sans-serif, monospace)
- Choix de fond d'éditeur (blanc, crème, gris) avec adaptation dark mode
- Choix de largeur du contenu (60ch, 72ch, 90ch)
- Choix de taille de police (petit, normal, grand)
- Variables CSS personnalisables appliquées en temps réel
- Persistance en BDD (JSONB) + cache localStorage

**Statut : fait**

### US-14.2 : Presets d'apparence
**En tant qu'** utilisateur, **je veux** appliquer des presets d'apparence prédéfinis ou personnalisés, **afin de** basculer rapidement entre différentes configurations visuelles.

**Critères d'acceptation :**
- 3 presets prédéfinis (Classique, Focus, Rédaction)
- Application en un clic avec preview en temps réel
- Indicateur visuel du preset actif
- Création de presets personnalisés à partir de la configuration actuelle
- Édition et suppression des presets personnalisés
- Persistance des presets personnalisés en BDD

**Statut : fait**

---

## Epic 15 : Notifications

### US-15.1 : Notifications in-app
**En tant qu'** utilisateur, **je veux** être notifié quand quelqu'un me mentionne, commente mon document, répond à mon commentaire ou m'ajoute à un espace, **afin de** rester informé de l'activité qui me concerne.

**Critères d'acceptation :**
- Notification automatique lors d'une @mention dans un document
- Notification lors d'un commentaire sur un document que j'ai créé
- Notification lors d'une réponse à mon commentaire
- Notification lors d'un ajout à un espace (utilisateur ou équipe)
- Pas d'auto-notification (l'auteur de l'action n'est pas notifié)

**Statut : fait**

### US-15.2 : Centre de notifications
**En tant qu'** utilisateur, **je veux** un centre de notifications accessible depuis la sidebar, **afin de** consulter et gérer mes notifications.

**Critères d'acceptation :**
- Icône cloche dans le pied de page de la sidebar
- Badge avec compteur de notifications non lues
- Dropdown avec liste des notifications (icône par type, titre, message, date)
- Marquer une notification comme lue au clic
- Bouton « Tout marquer comme lu »
- Navigation directe vers le document concerné
- Rafraîchissement automatique (polling 30s)

**Statut : fait**

## Epic 8 : Classification de sécurité et partage externe

### US-8.1 : Classification de sécurité des documents
**En tant qu'** éditeur, **je veux** pouvoir classifier mes documents selon 4 niveaux de sensibilité (public, interne, confidentiel, secret), **afin de** contrôler qui peut y accéder en fonction de la nature du contenu.

**Critères d'acceptation :**
- 4 niveaux de classification : public, interne, confidentiel, secret
- Badge coloré avec icône visible dans le header du document
- Sélecteur de classification limité aux niveaux autorisés par l'espace
- La classification par défaut est héritée de l'espace

**Statut : fait**

### US-8.2 : Classification de sécurité des espaces
**En tant qu'** administrateur d'espace, **je veux** pouvoir définir un niveau de classification minimum pour l'espace, **afin que** les documents ne puissent pas être classifiés à un niveau inférieur.

**Critères d'acceptation :**
- Section « Classification de sécurité » dans les paramètres d'espace
- 4 niveaux sélectionnables avec description
- Avertissement visuel lors d'un abaissement de classification
- Les documents existants conservent leur classification lors d'un changement
- Indicateur coloré dans la sidebar (point vert/ambre/rouge)

**Statut : fait**

### US-8.3 : Partage externe par lien public
**En tant qu'** éditeur, **je veux** pouvoir partager un document classifié « public » via un lien accessible sans compte, **afin de** diffuser du contenu à des prospects, partenaires ou au grand public.

**Critères d'acceptation :**
- Bouton « Partager » visible uniquement si le document ET l'espace sont classifiés « public »
- Génération d'un lien unique par clic
- Possibilité de copier le lien et de le révoquer
- Compteur de vues sur chaque lien
- Page publique en lecture seule avec layout minimal (logo, titre, contenu)
- La page publique ne nécessite aucune authentification

**Statut : fait**

### US-8.4 : Filtrage par classification
**En tant qu'** utilisateur, **je veux** que les documents et espaces soient filtrés selon ma classification d'accès, **afin de** ne voir que le contenu auquel j'ai droit.

**Critères d'acceptation :**
- Les espaces « secret » sont masqués pour les non-admins sans permission explicite
- Les documents « secret » ne sont visibles que par l'auteur et les admins de l'espace
- Les documents « confidentiel » ne sont visibles que par les membres de l'espace
- La recherche et le graphe respectent les règles de classification
- Les admins globaux ont accès à tout

**Statut : fait**

---

## Epic 16 : Itinéraires cartographiques

### US-16.1 : Calcul d'itinéraire entre marqueurs
**En tant qu'** éditeur, **je veux** pouvoir calculer un itinéraire entre les marqueurs d'une carte, **afin de** visualiser un parcours avec distance et durée estimées.

**Critères d'acceptation :**
- Panneau itinéraire accessible depuis la toolbar de la carte
- Choix du profil de déplacement (voiture, vélo, à pied)
- Calcul via OSRM avec affichage de la polyline sur la carte
- Affichage de la distance et de la durée estimées
- Minimum 2 marqueurs requis pour calculer
- Possibilité de supprimer un itinéraire
- Itinéraire persisté dans les attributs du bloc (rendu sans recalcul)

**Statut : fait**

### US-16.2 : Personnalisation du style d'itinéraire
**En tant qu'** éditeur, **je veux** personnaliser l'apparence d'un itinéraire (couleur, épaisseur, pointillés, flèches), **afin de** l'adapter au contexte visuel du document.

**Critères d'acceptation :**
- 6 couleurs prédéfinies
- 3 épaisseurs (fin, normal, épais)
- Option pointillés
- Option flèches directionnelles (orientées dans le sens du trajet)
- Mise à jour en temps réel du rendu sur la carte

**Statut : fait**

---

## Epic 17 : Calendrier partagé

### US-17.1 : Calendrier personnel
**En tant qu'** utilisateur, **je veux** disposer d'un calendrier personnel automatiquement créé avec mon compte, **afin de** planifier mes événements et rendez-vous.

**Critères d'acceptation :**
- Calendrier personnel auto-créé à l'inscription
- Page calendrier dédiée avec vues mois, semaine, jour et agenda
- Création d'événements avec titre, dates, lieu, description, récurrence
- Navigation temporelle (précédent/suivant, aujourd'hui)

**Statut : fait**

### US-17.2 : Calendriers d'équipe et d'organisation
**En tant qu'** administrateur, **je veux** que chaque équipe et l'organisation disposent de calendriers partagés, **afin de** coordonner les plannings collectifs.

**Critères d'acceptation :**
- Calendrier d'équipe auto-créé avec l'équipe
- Calendrier d'organisation créé par un super_admin
- Panneau latéral avec liste des calendriers groupés par type
- Toggle de visibilité par calendrier (checkbox colorée)

**Statut : fait**

### US-17.3 : Synchronisation CalDAV
**En tant qu'** utilisateur, **je veux** synchroniser mon calendrier LorIAx avec Thunderbird, Apple Calendar ou DAVx⁵, **afin de** consulter mes événements dans mon client favori.

**Critères d'acceptation :**
- Serveur CalDAV intégré (PROPFIND, REPORT, GET/PUT/DELETE)
- Auto-discovery `.well-known/caldav`
- Auth CalDAV Basic (email/mdp) ou Bearer (clé API)
- Sync incrémentale via sync-token + CTag/ETag
- Page paramètres avec URL CalDAV personnelle et bouton copier

**Statut : fait**

### US-17.4 : Import/export et abonnements iCal
**En tant qu'** utilisateur, **je veux** importer/exporter des fichiers `.ics` et m'abonner à des calendriers externes, **afin d'** interopérer avec d'autres outils.

**Critères d'acceptation :**
- Import `.ics` multi-événements avec détection de doublons
- Export `.ics` complet d'un calendrier
- Abonnement à des flux ICS externes avec actualisation périodique

**Statut : fait**

### US-17.5 : Calendrier dans l'éditeur
**En tant qu'** éditeur, **je veux** insérer un mini-calendrier ou un événement inline dans un document, **afin de** contextualiser la planification dans mes notes.

**Critères d'acceptation :**
- Bloc calendrier via `/calendrier` — configurable (calendriers, vue, plage)
- Événement inline via `/événement` — titre + date, tooltip avec détails
- Notifications calendrier (rappels, invitations) in-app et par email

**Statut : fait**

---

## Epic 18 : Visioconférence et comptes-rendus IA

### US-18.1 : Lancer une réunion vidéo
**En tant qu'** utilisateur, **je veux** lancer une réunion vidéo directement depuis LorIAx (page dédiée ou bloc dans un document), **afin de** collaborer en visio sans quitter l'application.

**Critères d'acceptation :**
- Page `/meet` listant les réunions actives et récentes
- Bouton « Nouvelle réunion » avec sélection de l'espace cible
- Page `/meet/[roomName]` avec le composant Jitsi Meet intégré
- Authentification automatique via JWT (pas de login supplémentaire)
- Lien dans la sidebar (icône vidéo, entre Calendrier et Admin)

**Statut : planifié**

### US-18.2 : Bloc réunion dans l'éditeur
**En tant qu'** éditeur, **je veux** insérer un bloc de réunion dans un document via `/réunion`, **afin de** lancer et suivre une visio dans le contexte d'un document.

**Critères d'acceptation :**
- Slash command `/réunion` (alias : reunion, meeting, visio, jitsi, call, appel)
- Le bloc affiche un bouton « Rejoindre » avant le début, l'iframe Jitsi pendant, et le lien vers le compte-rendu après
- Barre de progression pendant la transcription et le résumé

**Statut : planifié**

### US-6.5 : Gestion avancée des IA (admin)
**En tant qu'** administrateur, **je veux** disposer d'une section admin dédiée pour gérer les fournisseurs IA, les prompts, les quotas, le monitoring et tester les modèles, **afin de** piloter finement l'usage de l'IA dans l'organisation.

**Critères d'acceptation :**
- Section `/admin/ai/` avec dashboard, réglages, providers, prompts, quotas, playground, logs
- Providers génériques : tout fournisseur compatible OpenAI en plus d'Anthropic
- Assignation d'un modèle par type d'usage (chat, résumé, transcription, embeddings) avec fallback automatique
- Bibliothèque de prompts versionnée avec diff, restauration et A/B testing
- Quotas hiérarchiques (organisation > équipe > utilisateur) avec blocage API et alertes
- Playground de test avec comparaison côte à côte de 2 modèles
- Historique des requêtes IA avec filtres avancés et export CSV

**Statut : planifié**

---

### US-19.1 : Intégrer une vidéo YouTube ou Vimeo dans un document
**En tant qu'** utilisateur, **je veux** coller une URL YouTube, Vimeo ou Dailymotion dans l'éditeur et obtenir un lecteur vidéo intégré, **afin d'** enrichir mes documents avec du contenu vidéo sans quitter LorIAx.

**Critères d'acceptation :**
- Slash command `/video` (aliases : youtube, vimeo, dailymotion, embed) insère un bloc de saisie d'URL
- L'URL est validée et le provider détecté (YouTube, Vimeo, Dailymotion)
- Le lecteur est affiché en ratio 16:9 avec une barre de contrôle (provider, ID, bouton Ouvrir, bouton Modifier)
- Coller une URL vidéo suivie d'un espace convertit automatiquement le texte en bloc (InputRule)
- Le bloc est inclus dans la page Showcase

**Statut : implémenté (Sprint 73)**

---

### US-19.2 : Personnaliser l'espacement vertical de l'éditeur
**En tant qu'** administrateur d'espace ou auteur de document, **je veux** choisir la densité verticale de l'éditeur (compact, normal, aéré), **afin d'** adapter l'expérience de lecture et d'écriture à chaque usage.

**Critères d'acceptation :**
- Paramètre `editorPaddingY` dans le preset d'apparence de l'espace (Compact / Normal / Aéré) — visible dans les paramètres si un preset est actif
- Bouton « Mise en page » dans le header du document — popover avec les 3 options, persisté en BDD (`properties JSONB`)
- Cascade de priorité : document > espace > défaut CSS (2rem)
- L'override du document est appliqué via CSS variable sans rechargement

**Statut : implémenté (Sprint 73)**

---

### US-18.3 : Compte-rendu automatique post-réunion
**En tant qu'** utilisateur, **je veux** recevoir automatiquement un compte-rendu structuré après chaque réunion, **afin de** retrouver le résumé, les décisions et les actions sans prise de notes manuelle.

**Critères d'acceptation :**
- Transcription audio différée via Whisper (auto-hébergé)
- Résumé structuré généré par le LLM configuré (résumé, décisions, actions, points en suspens)
- Document LorIAx créé automatiquement dans l'espace de la réunion
- Transcript complet disponible en annexe du document
- Lien direct vers le compte-rendu depuis le bloc réunion et la page `/meet`
- 100 % auto-hébergé — aucune donnée ne quitte l'infrastructure

**Statut : planifié**

---

## Epic 20 : Salles de réunion

### US-20.1 : Gérer les fiches de salles
**En tant qu'** administrateur ou gestionnaire de salles (`facility_manager`), **je veux** créer et maintenir des fiches pour chaque salle physique de l'organisation, **afin de** centraliser toutes les informations utiles (localisation, capacité, équipement).

**Critères d'acceptation :**
- Création d'une salle avec : nom (obligatoire), adresse, étage, capacité, description, équipements (tags libres)
- Upload de photo et de plan de salle (conversion WebP 2048px, stockage Garage S3)
- Activation/désactivation d'une salle (suspend les réservations sans supprimer les données)
- Interface dédiée dans `Administration → Salles de réunion`

**Statut : implémenté (Sprint 92)**

---

### US-20.2 : Configurer les horaires d'ouverture
**En tant que** gestionnaire de salles, **je veux** définir les créneaux d'ouverture jour par jour, **afin que** les utilisateurs ne puissent réserver que dans les plages autorisées.

**Critères d'acceptation :**
- Éditeur d'horaires par jour de semaine (lundi → dimanche)
- Plusieurs créneaux possibles par jour (ex : 8h-12h et 14h-18h)
- Jours fériés français 2026-2027 bloqués automatiquement
- Validation côté API : une réservation hors horaires est rejetée avec message explicite

**Statut : implémenté (Sprint 92)**

---

### US-20.3 : Attribuer les droits de réservation
**En tant qu'** administrateur ou gestionnaire de salles, **je veux** contrôler qui peut réserver chaque salle, **afin de** restreindre l'accès aux salles sensibles ou stratégiques.

**Critères d'acceptation :**
- Matrice de droits à 3 axes : par utilisateur précis, par équipe, par rôle global
- Logique OR : satisfaire un seul axe suffit pour être autorisé
- Les admins, super_admins et facility_managers passent toujours sans vérification de matrice
- Interface : panneau « Gérer les droits » sur chaque fiche salle avec toggle par entrée

**Statut : implémenté (Sprint 92)**

---

### US-20.4 : Réserver une salle
**En tant qu'** utilisateur autorisé, **je veux** réserver un créneau dans une salle disponible, **afin de** planifier une réunion sans conflit.

**Critères d'acceptation :**
- Formulaire de réservation : date, heure de début, heure de fin, titre (optionnel)
- Validation : créneau dans les horaires d'ouverture, hors jours fériés, sans chevauchement
- Anti-chevauchement garanti par contrainte PostgreSQL `EXCLUDE USING gist` (pas de race condition)
- Réservation confirmée immédiatement si l'utilisateur est autorisé (auto-validée)
- En cas de conflit : message d'erreur explicite (409 — créneau déjà réservé)
- Annulation possible par l'auteur, un admin ou un facility_manager

**Statut : implémenté (Sprint 92)**

---

### US-20.5 : Intégration au calendrier
**En tant qu'** utilisateur, **je veux** que mes réservations de salle apparaissent dans le calendrier partagé, **afin de** voir toutes mes réunions au même endroit.

**Critères d'acceptation :**
- Chaque réservation crée un événement dans le calendrier organisation « Salles de réunion » (auto-provisionné)
- L'événement est visible dans toutes les vues calendrier avec une icône salle distinctive
- Annuler la réservation supprime l'événement calendrier et envoie une notification aux participants

**Statut : implémenté (Sprint 92)**

---

### US-20.6 : Consulter le tableau d'occupation
**En tant qu'** administrateur ou gestionnaire de salles, **je veux** visualiser l'utilisation des salles dans le temps, **afin d'** identifier les salles sur-sollicitées et optimiser la politique de réservation.

**Critères d'acceptation :**
- Page `Organisation → Occupation` (visible par admin et facility_manager uniquement)
- Filtres : toutes les salles ou une salle spécifique, période 7 ou 30 jours
- Indicateurs : nombre de réservations par salle, top 5 utilisateurs, histogramme horaire des créneaux populaires
- Export CSV BOM UTF-8 (compatible Excel) sur la période sélectionnée

**Statut : implémenté (Sprint 92)**

---

### US-20.7 : Rôle gestionnaire de salles
**En tant qu'** administrateur, **je veux** désigner un gestionnaire de salles sans lui donner les droits d'administration complète, **afin de** déléguer la gestion des ressources physiques sans risque.

**Critères d'acceptation :**
- Rôle `facility_manager` attribuable depuis `Administration → Utilisateurs`
- Accès uniquement à l'onglet « Salles » dans l'interface d'administration
- Peut créer, modifier, supprimer toutes les salles et annuler toutes les réservations
- Ne peut pas accéder aux onglets Utilisateurs, Équipes, IA, Emails, Licences, Système, etc.

**Statut : implémenté (Sprint 92)**

---

### US-20.8 : Activer/désactiver le module
**En tant qu'** administrateur système, **je veux** activer ou désactiver le module de gestion des salles, **afin de** ne l'exposer qu'aux organisations qui en ont besoin.

**Critères d'acceptation :**
- Toggle dans `Administration → Système → Modules optionnels`
- Quand désactivé : toutes les routes `/api/meeting-rooms/*` renvoient 404, les onglets Salles disparaissent de l'admin et de la section Organisation
- Le flag est persisté dans `system_settings` (clé `meeting_rooms_enabled`)

**Statut : implémenté (Sprint 92)**

---

## Epic 22 : Templates et prompts natifs

### US-22.1 : Créer un document depuis un template natif
**En tant qu'** utilisateur, **je veux** trouver des modèles de documents prêts à l'emploi dans le picker de templates, **afin de** démarrer rapidement sans avoir à structurer un document de zéro.

**Critères d'acceptation :**
- Le picker `/` → « Utiliser un modèle » affiche les templates natifs (Markdown) sans configuration préalable
- Les catégories disponibles incluent : réunion, gestion de projet, ressources humaines, support, documentation, base de données
- Les templates natifs sont fusionnés avec les templates personnalisés de l'organisation

**Statut : implémenté (Sprint 94)**

### US-22.2 : Créer une base de données depuis un template
**En tant qu'** utilisateur, **je veux** insérer une base de données pré-structurée via le picker de templates, **afin de** disposer immédiatement des colonnes adaptées au cas d'usage (suivi de tâches, CRM, inventaire…).

**Critères d'acceptation :**
- La catégorie « base de données » dans le picker de templates liste les modèles de bases disponibles
- La sélection d'un template de base crée un bloc DatabaseBlock avec les colonnes prédéfinies
- Aucune configuration manuelle des colonnes n'est requise

**Statut : implémenté (Sprint 94)**

### US-22.3 : Disposer de prompts IA fonctionnels sans configuration
**En tant qu'** administrateur, **je veux** que le chat IA, les résumés et les embeddings fonctionnent dès l'installation, **afin de** ne pas avoir à créer manuellement les prompts système avant la mise en service.

**Critères d'acceptation :**
- Les fonctionnalités IA (chat, résumé document, résumé réunion, embeddings) utilisent des prompts natifs si aucun prompt personnalisé n'est défini en base
- Les prompts natifs sont visibles et remplaçables dans `Administration → IA → Prompts`

**Statut : implémenté (Sprint 94)**

### US-22.4 : Utiliser des templates métier courants (réunion, commercial, agile)
**En tant qu'** utilisateur, **je veux** accéder à des modèles de documents adaptés aux situations récurrentes de mon organisation, **afin de** structurer mes écrits sans repartir de zéro.

**Critères d'acceptation :**
- Le picker de templates inclut : CR réunion interne (🔒 confidentiel, usage interne), Suivi client (fiche vivante : contacts, historique, statut contrat), TOP 5 hebdo (5 priorités RAG avec responsable et avancement), Sprint Meeting (revue sprint, backlog sélectionné, démos, rétrospective)
- Les templates apparaissent dans les catégories appropriées (réunion, commercial, projet)
- Le contenu inséré est complet et immédiatement utilisable

**Statut : implémenté (Sprint 97)**

### US-22.5 : Créer des bases de données RH, CRM et achats depuis un template
**En tant qu'** utilisateur, **je veux** insérer une base de données structurée pour mes clients, collaborateurs ou fournisseurs en un seul geste, **afin de** disposer immédiatement des colonnes métier sans les configurer manuellement.

**Critères d'acceptation :**
- La catégorie « base de données » du picker inclut : Base de données clients (Nom, Société, Contact, Email, Téléphone, Secteur, Statut select, Notes), Base de données utilisateurs (Nom, Prénom, Rôle, Équipe, Email, Date d'entrée, Statut select), Base de données fournisseurs (Nom, Contact, Catégorie, Email, Téléphone, Délai livraison, Conditions paiement, Évaluation select étoiles)
- La sélection crée un DatabaseBlock avec toutes les colonnes pré-configurées
- Les colonnes de type `select` ont leurs options prédéfinies

**Statut : implémenté (Sprint 97)**

---

## Epic 26 : Bibliothèque d'images Studio

### US-26.1 : Téléverser et réutiliser des images dans le Studio
**En tant qu'** éditeur, **je veux** téléverser des images depuis mon poste et les retrouver dans la bibliothèque de mon espace, **afin de** les réutiliser facilement dans mes créations Studio.

**Critères d'acceptation :**
- Onglet "Téléverser" dans le panneau Images du Studio : sélection de fichier ou glisser-déposer (JPG, PNG, WebP, GIF, SVG — 10 Mo max)
- Onglet "Bibliothèque" : grille de miniatures des images de l'espace + images org-partagées
- Clic sur une miniature insère l'image sur le canvas (redimensionnée à 60 % de la largeur)
- Renommage de l'image depuis la bibliothèque
- Suppression depuis la bibliothèque (retire S3 + BDD)
- URLs présignées Garage S3 (TTL 24h)

**Statut : implémenté (Sprint 107)**

### US-26.2 : Rechercher et insérer des photos Unsplash dans le Studio
**En tant qu'** éditeur, **je veux** chercher des photos libres de droits Unsplash directement depuis le Studio, **afin d'** enrichir mes visuels sans quitter l'application.

**Critères d'acceptation :**
- Onglet "Unsplash" dans le panneau Images : photos populaires au chargement, champ de recherche
- Grille de résultats avec aperçu en basse résolution
- Clic → insertion en haute résolution sur le canvas + appel `downloadLocation` (conformité ToS Unsplash)
- La clé Unsplash n'est jamais exposée côté client (proxy serveur `/api/studio/unsplash`)
- Fonctionne sans `UNSPLASH_ACCESS_KEY` : l'onglet reste accessible mais renvoie une liste vide

**Statut : implémenté (Sprint 107)**

### US-26.3 : Gérer la bibliothèque d'images et les providers depuis l'administration
**En tant qu'** administrateur, **je veux** gérer les images partagées à l'échelle de l'organisation et configurer les providers d'images, **afin de** mettre à disposition des assets communs sans que les éditeurs aient à les uploader individuellement.

**Critères d'acceptation :**
- Page `Administration → Images` : grille des images org-partagées avec upload, renommage, suppression
- Section providers : liste des providers (Unsplash, etc.), toggle activer/désactiver, champ clé API (masqué, chiffré AES-256-GCM)
- Contrainte unique : un seul provider par nom et par organisation

**Statut : implémenté (Sprint 107)**

---

## Epic 21 : Tableau de bord des services internes

### US-21.1 : Visualiser l'état des modules en un coup d'œil
**En tant qu'** administrateur, **je veux** voir l'état de tous les modules internes sur une seule page, **afin de** diagnostiquer rapidement un problème sans parcourir chaque onglet de configuration.

**Critères d'acceptation :**
- Grille de 8 cartes dans `Administration → Services` (Visioconférence, Transcription, Collaboration, Salles, LDAP, IA, Email, Sauvegardes)
- Chaque carte affiche : une pill "Activé / Désactivé" et une pill de santé ("Opérationnel", "Hors ligne", "Démarrage", "Configuré", "Non configuré")
- Les cartes avec santé live indiquent la latence en ms
- Polling automatique toutes les 30 secondes

**Statut : implémenté (Sprint 92)**

### US-21.2 : Activer/désactiver un module depuis le tableau de bord
**En tant qu'** administrateur, **je veux** basculer un module depuis le tableau de bord, **afin de** ne pas devoir naviguer dans chaque onglet pour activer ou désactiver une fonctionnalité.

**Critères d'acceptation :**
- Toggle sur les cartes des modules toggleables (Visio, Collab, Salles, LDAP, IA)
- Mise à jour optimiste avec rollback sur erreur
- Modules sans activation manuelle (Whisper, Email, Backup) affichent la pill "Auto-détecté" sans toggle

**Statut : implémenté (Sprint 92)**

---

## Epic 23 : Messagerie live (Chat)

### US-23.1 : Envoyer et recevoir des messages en temps réel
**En tant qu'** utilisateur, **je veux** échanger des messages instantanés avec mes collègues dans des canaux d'équipe, d'espace ou en direct, **afin de** communiquer sans quitter l'application.

**Critères d'acceptation :**
- Le panneau chat (320px, rétractable à droite) s'ouvre via l'icône `MessageSquare` dans le header
- Les messages envoyés apparaissent immédiatement pour tous les membres du canal (WebSocket)
- `Enter` envoie, `Shift+Enter` insère un saut de ligne
- Les messages consécutifs du même auteur sont regroupés (sans répéter avatar/nom)
- L'état ouvert/fermé du panneau est mémorisé dans `localStorage`

**Statut : implémenté (Sprint 99)**

### US-23.2 : Consulter l'historique des messages avec chargement infini
**En tant qu'** utilisateur, **je veux** faire défiler l'historique complet d'un canal, **afin de** retrouver des informations échangées antérieurement.

**Critères d'acceptation :**
- Pagination curseur vers le haut (IntersectionObserver sur le premier message visible)
- 50 messages chargés par page, chargement automatique au défilement
- Horodatage relatif affiché (`il y a 3 min`)
- Actions au survol : Répondre (quote dans l'input), Verser dans le document, Supprimer (auteur/admin)

**Statut : implémenté (Sprint 99)**

### US-23.3 : Ouvrir une conversation directe avec un collègue
**En tant qu'** utilisateur, **je veux** démarrer ou retrouver une conversation privée (1:1) avec un autre membre de mon organisation, **afin de** lui envoyer un message sans passer par un canal d'équipe.

**Critères d'acceptation :**
- `POST /api/chat/channels/direct` crée ou retrouve le canal DM existant entre les deux utilisateurs
- Le canal apparaît dans la section « Messages directs » de la liste des canaux
- Badge de messages non lus visible sur le canal concerné

**Statut : implémenté (Sprint 99)**

### US-23.4 : Verser un message dans un document ouvert
**En tant qu'** utilisateur, **je veux** citer un message de chat dans le document que j'édite actuellement, **afin de** garder une trace contextualisée dans mes notes.

**Critères d'acceptation :**
- L'action « Verser dans le document » est visible au survol d'un message si un document est ouvert dans l'onglet courant
- Un bloc `blockquote` TipTap est inséré dans le document avec les attributs `data-chat-author`, `data-chat-date`, `data-chat-channel`
- Le champ `document_ref` du message est mis à jour pour traçabilité
- Vérifications : l'utilisateur est membre du canal ET a le droit d'écriture sur le document

**Statut : implémenté (Sprint 99)**

### US-23.5 : Être notifié des nouveaux messages non lus
**En tant qu'** utilisateur, **je veux** voir un badge indiquant mes messages non lus, **afin de** ne pas manquer une communication même si le panneau chat est fermé.

**Critères d'acceptation :**
- Badge total non-lus affiché sur l'icône de toggle du panneau chat
- Badge par canal dans la liste des canaux
- Notification in-app dans le dropdown notifications avec extrait du message
- Email digest quotidien (8h00) récapitulant les messages non lus (fréquence configurable : quotidien / jamais)

**Statut : implémenté (Sprint 99)**

---

## Épique 24 : Présence et statut utilisateurs

### US-24.1 : Voir le statut en ligne de mes collègues
**En tant qu'** utilisateur, **je veux** voir en un coup d'œil qui est en ligne, absent ou en réunion, **afin de** savoir quand contacter un collègue.

**Critères d'acceptation :**
- Badge de présence (vert/orange/rouge/gris) affiché sur les avatars dans la sidebar et le panneau équipe
- Statut déduit automatiquement : en ligne si actif < 5 min, absent si > 5 min, hors ligne si > 15 min
- Statut "en réunion" déduit depuis l'agenda CalDAV si un événement est en cours
- Statut "absent" si weekend ou événement toute la journée dans l'agenda

**Statut : implémenté (Sprint 100)**

### US-24.2 : Définir un statut personnalisé avec emoji
**En tant qu'** utilisateur, **je veux** indiquer à mes collègues ce que je fais avec un emoji et un texte court, **afin de** communiquer mon contexte sans interrompre le travail des autres.

**Critères d'acceptation :**
- Clic sur mon avatar ouvre un popover avec 4 statuts prédéfinis (disponible, occupé, ne pas déranger, absent)
- Zone custom : emoji (max 10 car.) + texte (max 100 car.)
- Durée configurable : 30 min, 1h, jusqu'à ce soir, indéfini
- Le statut custom s'efface automatiquement à l'expiration du TTL

**Statut : implémenté (Sprint 100)**

### US-24.3 : Consulter la disponibilité de l'équipe sur 3 jours
**En tant qu'** utilisateur, **je veux** visualiser les créneaux libres/occupés de mes collègues sur les 3 prochains jours, **afin de** planifier des réunions sans avoir à consulter chaque agenda individuellement.

**Critères d'acceptation :**
- Panneau équipe (drawer droit) affiche un planning 3 jours par membre
- Créneaux colorés : vert = libre, orange = occupé, gris = absent
- Actualisation toutes les 30 secondes (SWR polling)
- Membres triés : en ligne / absent en premier, hors ligne en dernier

**Statut : implémenté (Sprint 100)**

---

## Épique 25 : Attribution des tâches

### US-25.1 : Assigner une tâche inline à un collègue
**En tant qu'** utilisateur, **je veux** assigner une case à cocher de mon document à un collègue, **afin de** lui déléguer une action sans quitter l'éditeur.

**Critères d'acceptation :**
- Un bouton avatar (24 px) apparaît à droite de chaque case à cocher dans l'éditeur
- Clic ouvre un popover avec recherche des membres de l'espace (barre de recherche filtrante)
- La sélection d'un membre met à jour l'attribut `assigneeId` du nœud TipTap
- La tâche est synchronisée en base (table `tasks`, kind `document_item`) dans les 2 secondes
- Écrire `@prénom` dans le texte de la tâche auto-assigne au premier utilisateur mentionné

**Statut : implémenté (Sprint 101)**

### US-25.2 : Assigner un événement Gantt à un responsable
**En tant qu'** utilisateur, **je veux** désigner un responsable pour un événement de mon planning Gantt, **afin de** savoir qui est en charge de chaque jalon.

**Critères d'acceptation :**
- La dialog d'édition d'un événement Gantt contient une section « Responsable »
- Combobox avec recherche parmi les membres de l'espace
- L'avatar et le nom du responsable sont affichés si assigné, sinon « Aucun responsable »
- La modification est persistée via `PATCH /api/events/[id]` avec `assigneeId`
- La vue Gantt affiche l'avatar du responsable sur l'événement

**Statut : implémenté (Sprint 101)**

### US-25.3 : Consulter toutes mes tâches assignées
**En tant qu'** utilisateur, **je veux** disposer d'une page récapitulant toutes mes tâches (documents et Gantt), **afin de** gérer mes responsabilités sans naviguer document par document.

**Critères d'acceptation :**
- Page `/tasks` accessible depuis la sidebar (icône CheckSquare + badge)
- Tâches groupées par statut : Ouvertes, En cours, Terminées, Annulées
- Chaque tâche affiche : titre, lien vers le contexte (document ou Gantt), badge statut, date d'échéance
- Changement de statut inline via un dropdown
- Actualisation automatique toutes les 30 secondes

**Statut : implémenté (Sprint 101)**

### US-25.4 : Recevoir une notification lors d'une assignation
**En tant qu'** utilisateur, **je veux** être notifié quand une tâche m'est assignée, **afin de** ne pas manquer de nouvelles responsabilités.

**Critères d'acceptation :**
- Notification in-app de type `task_assigned` créée à chaque assignation
- Si les préférences email le permettent, un email est envoyé avec un lien vers le document ou la vue Gantt
- Le badge notification dans la sidebar se met à jour en temps réel

**Statut : implémenté (Sprint 101)**

## US-26 — Apparence personnalisée avancée

### US-26.1 : Activer un preset d'apparence Terminal (CRT phosphore)
**En tant qu'** utilisateur, **je veux** pouvoir activer un thème visuel rétro-futuriste "Terminal", **afin de** personnaliser l'interface selon mes préférences esthétiques.

**Critères d'acceptation :**
- Preset "Terminal" disponible dans Paramètres > Apparence, avec aperçu visuel distinctif
- L'activation change l'apparence de toute l'application (sidebar, topbar, éditeur) : fond sombre phosphore, texte vert, police monospace
- Les effets CRT (scanlines + vignette) sont actifs par défaut
- Un panneau d'effets spécifiques apparaît dans la section Apparence quand le preset est actif
- Le preset est persisté et restauré au rechargement sans flash du thème par défaut

**Statut : implémenté (Sprint 108)**

### US-26.2 : Configurer les effets CRT du preset Terminal
**En tant qu'** utilisateur ayant activé le preset Terminal, **je veux** ajuster les effets visuels CRT, **afin de** trouver le bon équilibre entre esthétique et lisibilité.

**Critères d'acceptation :**
- Toggle pour activer/désactiver l'effet de glitch (micro-distorsions périodiques)
- Toggle pour activer/désactiver le scan vertical (faisceau animé simulant le balayage CRT)
- Slider pour régler l'intensité des lignes de scan (0–100 %)
- Les changements sont appliqués en temps réel sans rechargement

**Statut : implémenté (Sprint 108)**

## US-27 — Alias des commandes slash personnalisables

### US-27.1 : Personnaliser les alias d'une commande slash
**En tant qu'** administrateur, **je veux** ajouter ou supprimer des alias pour chaque commande slash de l'éditeur, **afin de** les adapter au vocabulaire de mon organisation et réduire les incompréhensions des utilisateurs.

**Critères d'acceptation :**
- La page `/admin/editor` liste toutes les commandes slash disponibles (33 commandes)
- Chaque ligne affiche les alias actifs sous forme de badges supprimables
- Un champ "ajouter un alias" permet de saisir un mot-clé et de l'ajouter (Entrée ou bouton +)
- Un bouton de réinitialisation (RotateCcw) restaure les alias par défaut d'une commande
- Un badge "modifié" indique visuellement les commandes personnalisées
- Le bouton "Enregistrer" persiste toutes les modifications en base de données

**Statut : implémenté (Sprint 113)**

### US-27.2 : Rechercher une commande slash par alias personnalisé
**En tant qu'** utilisateur, **je veux** retrouver une commande slash en tapant un mot-clé défini par mon administrateur, **afin de** bénéficier du vocabulaire de mon organisation dans l'éditeur.

**Critères d'acceptation :**
- La recherche dans le menu slash utilise les alias personnalisés en priorité sur les alias par défaut
- Les alias personnalisés sont chargés au démarrage de l'éditeur
- Si aucun alias personnalisé n'est défini, les alias par défaut s'appliquent

**Statut : implémenté (Sprint 113)**

## US-28 — Banques d'images multi-fournisseurs dans l'éditeur

### US-28.1 : Insérer une image depuis l'éditeur via un panneau unifié
**En tant qu'** auteur, **je veux** insérer une image dans mon document via la commande `/image`, avec le choix entre un fichier local, une URL ou une banque d'images, **afin de** trouver rapidement le bon visuel sans quitter l'éditeur.

**Critères d'acceptation :**
- La commande `/image` ouvre un panneau compact positionné sous le curseur
- Onglet « Ordinateur » : sélection d'un fichier local uploadé via `/api/attachments`
- Onglet « URL » : saisie d'URL avec prévisualisation debounce (400 ms) et bouton Insérer
- Onglet « Banque » : grille 4 colonnes avec les fournisseurs activés par l'admin, barre de recherche
- Le panneau se ferme au clic extérieur

**Statut : implémenté (Sprint 114)**

### US-28.2 : Configurer des banques d'images depuis l'administration
**En tant qu'** administrateur, **je veux** ajouter, activer ou supprimer des fournisseurs d'images (Unsplash, Pexels, Pixabay, Shutterstock, Getty, ou personnalisé), **afin que** les auteurs aient accès aux bonnes ressources visuelles selon les droits de l'organisation.

**Critères d'acceptation :**
- La page `/admin/images` propose un bouton « + Ajouter un fournisseur »
- Le formulaire liste les fournisseurs connus (Unsplash, Pexels, Pixabay, Shutterstock, Getty) avec slug pré-rempli, et une option « Personnalisé »
- Pour les fournisseurs connus : champ clé API uniquement
- Pour un fournisseur personnalisé : champ slug, nom affiché, URL de base, clé API
- Les fournisseurs personnalisés affichent un badge « intégration manuelle » (pas de recherche automatique)
- Chaque fournisseur peut être supprimé depuis la liste

**Statut : implémenté (Sprint 114)**


## US-29 — Éditeur vidéo/son intégré

### US-29.1 : Créer et monter une vidéo sans quitter l'espace de travail
**En tant qu'** auteur, **je veux** monter une vidéo directement depuis LorIAx, **afin de** produire du contenu vidéo sans outil externe ni export/import de fichiers.

**Critères d'acceptation :**
- La sidebar propose une entrée « Vidéo » (icône Clapperboard)
- La page liste les projets vidéo avec bouton « Nouveau projet »
- L'éditeur plein-écran affiche : médiathèque à gauche, preview au centre, timeline en bas
- Les clips se glissent depuis la médiathèque vers la timeline (drag & drop)
- Le player HTML5 se synchronise avec la tête de lecture de la timeline

**Statut : implémenté (Sprint 115)**

### US-29.2 : Importer des vidéos et des stocks Pexels
**En tant qu'** auteur, **je veux** importer mes propres vidéos ou rechercher des clips Pexels gratuits, **afin d'** enrichir mon montage avec des ressources libres.

**Critères d'acceptation :**
- Upload de fichiers vidéo/audio (mp4, mov, webm, avi, mkv, mp3, wav, aac, ogg) directement vers S3 via URL signée
- Recherche Pexels Vidéo depuis la médiathèque (onglet « Stock Pexels »)
- Téléchargement Pexels côté serveur → stocké en S3 (pas de re-upload client)
- Les clips téléchargés apparaissent immédiatement dans la médiathèque

**Statut : implémenté (Sprint 115)**

### US-29.3 : Exporter la vidéo montée en MP4
**En tant qu'** auteur, **je veux** exporter mon montage en MP4 720p ou 1080p, **afin de** partager la vidéo finale.

**Critères d'acceptation :**
- Le panneau « Exporter » propose le choix de résolution (720p / 1080p)
- L'export déclenche un job serveur (`fluent-ffmpeg`) avec statut affiché (En cours / Prêt / Erreur)
- Un lien de téléchargement apparaît quand le job est terminé
- Le polling s'arrête automatiquement après 5 erreurs consécutives

**Statut : implémenté (Sprint 115)**

### US-30.1 : Insérer un projet de montage vidéo dans un document
**En tant qu'** auteur, **je veux** taper `/montage` ou `/video` dans l'éditeur pour insérer un bloc vidéo lié à un projet, **afin de** référencer mon travail de montage directement dans le document de contexte.

**Critères d'acceptation :**
- La commande `/montage` (alias : `/video`, `/film`, `/clip`) apparaît dans le menu slash
- Un bloc carte est inséré avec le titre éditable « Nouveau montage »
- Le projet vidéo est créé automatiquement via POST `/api/video/projects` au premier rendu
- Le bouton « Ouvrir l'éditeur » ouvre `/video-editor/[id]` dans un nouvel onglet
- Le titre du bloc se synchronise avec `updateAttributes` (persisté dans Yjs)
- Le bloc est draggable et supprimable comme les autres blocs éditeur

**Statut : implémenté (Sprint 117)**

---

## US-31 — SaaS hébergé multi-tenant

### US-31.1 : Créer son espace LorIAx en self-service

**En tant que** responsable d'une structure, **je veux** créer mon espace LorIAx sur `mon-org.loriax.fr` en remplissant un formulaire, **afin de** démarrer sans aucun déploiement technique.

**Critères d'acceptation :**
- Le formulaire demande : nom, email, mot de passe, nom de l'organisation, slug souhaité
- Le slug est validé en temps réel (disponibilité, format, mots réservés)
- La création est atomique : utilisateur + organisation + membership owner + espace "Général"
- Après inscription, l'utilisateur est connecté automatiquement et redirigé vers `/onboarding`
- Un sous-domaine inconnu affiche une page d'erreur claire avec lien vers `/signup`

**Statut : ✅ livré — v1.14.0**

### US-31.2 : Gérer son abonnement et passer à un plan supérieur

**En tant qu'** administrateur d'un espace LorIAx hébergé, **je veux** consulter mon plan actuel et monter en gamme depuis les paramètres, **afin d'** accéder à plus d'utilisateurs, d'espaces et de fonctionnalités.

**Critères d'acceptation :**
- L'onglet "Abonnement" dans `/settings` affiche le plan actuel avec ses limites
- Les plans Starter, Pro et Équipe sont présentés avec tarifs et fonctionnalités
- Le bouton "Passer à [plan]" redirige vers le checkout Stripe sans friction
- Après paiement, le plan de l'organisation est mis à jour automatiquement via webhook
- Un lien "Gérer la facturation" donne accès au portail Stripe pour les plans payants

**Statut : ✅ livré — v1.14.0**
