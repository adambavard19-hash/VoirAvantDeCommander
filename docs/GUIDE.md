# Guide d'utilisation — du nouveau restaurant au QR code

## 1. Créer le restaurant

**Administration → Restaurants → « + Créer un restaurant »**

Renseignez le nom (seul champ obligatoire), puis selon vos informations : type de cuisine, accroche,
logo, photo de couverture, photos de la salle, adresse, téléphone, réseaux sociaux, informations
pratiques (horaires, services…), langues proposées et identité visuelle.

- Choisissez une **ambiance prédéfinie** ou une couleur : la palette complète (fonds, textes, boutons)
  est calculée automatiquement avec un contraste lisible. Si vous ajoutez un logo, sa couleur
  dominante vous est proposée.
- L'aperçu à droite montre le rendu sur téléphone.

À l'enregistrement, le logiciel crée un **espace indépendant** : menu (avec les catégories Entrées,
Plats, Desserts, Boissons), dossier de fichiers, paramètres et une **adresse stable**
`…/menu/nom-du-restaurant`.

## 2. Importer tous les fichiers en une fois

**Onglet « Import intelligent »**

Déposez en une seule fois : photos, menu (PDF, Excel, CSV ou texte), modèles 3D `.glb` et `.usdz`,
ou une archive `.zip`, ou un dossier complet. Puis **« Analyser et associer »**.

Le logiciel :
- lit le menu (catégories, noms, descriptions, prix, déclinaisons, allergènes **explicitement** indiqués) ;
- regroupe les fichiers d'un même plat par leur nom (`burger-maison.glb` + `burger-maison.usdz` + `Burger_Maison.jpg`) ;
- associe chaque groupe au plat correspondant ;
- utilise les noms de dossiers comme indice de catégorie (`Desserts/tiramisu.glb`).

**Vérifiez l'écran de relecture** :
- **vert** : association certaine (noms identiques) ;
- **jaune** : ressemblance à valider (✓ pour confirmer, ✕ pour dissocier) — jamais appliquée sans vous ;
- **Fichiers non associés** : choisissez le plat, ou créez un plat à partir du fichier ;
- corrigez les noms, prix, catégories et allergènes si besoin.

**« Appliquer au brouillon »** : rien n'est encore visible des clients.

> Conseil : nommez les fichiers comme les plats du menu (`tarte-tatin.glb`, `tarte-tatin.usdz`, `tarte-tatin.jpg`).
> Un tableau Excel/CSV peut aussi indiquer explicitement les fichiers dans des colonnes `Photo`, `GLB`, `USDZ`.

## 3. Vérifier le menu et la 3D

**Onglet « Menu »** : glisser-déposer pour réordonner catégories et plats, prix modifiables directement,
interrupteur « Disponible / Épuisé » (appliqué immédiatement au menu en ligne), œil pour masquer un plat.

Ouvrez un plat pour régler sa fiche : description, déclinaisons de prix, allergènes, pictogrammes,
recommandations « Parfait avec… », photo, GLB, USDZ, et la **taille réelle** :
1. le logiciel affiche les dimensions mesurées dans le GLB ;
2. saisissez les dimensions réelles du plat servi (assiette comprise) ;
3. en cas d'écart, « Corriger l'échelle du GLB » crée une version à la bonne taille ;
4. vérifiez sur iPhone (USDZ), puis **« Je confirme la taille réelle »**.

Tant que la taille n'est pas validée, le client peut redimensionner le plat en réalité augmentée.

## 4. Traduire

**Onglet « Traductions »** : « Tout traduire automatiquement » (si un service est configuré), puis relisez.
Toute correction manuelle est conservée et ne sera jamais écrasée. Si vous modifiez un texte d'origine,
sa traduction est signalée « à revoir » et le client voit le texte d'origine en attendant.

## 5. Prévisualiser puis publier

**« Prévisualiser »** ouvre le brouillon tel que les clients le verront. **« Publier »** liste les points à vérifier
(photos manquantes, 3D incomplète, traductions…) puis met la version en ligne. Chaque publication est
conservée et peut être restaurée depuis la vue d'ensemble.

## 6. QR code

**Onglet « QR code »** : aperçu, copie du lien, téléchargement PNG (2000 px), SVG (imprimeur) et PDF :
carte de table A6, chevalet A5 à plier, affiche A4, planche de 12 autocollants. Personnalisez couleurs,
logo central et textes.

**« Créer les liens d'envoi »** prépare un message (e-mail, WhatsApp ou copier-coller) avec des liens de
téléchargement sécurisés, valables 30 jours, que le restaurateur peut ouvrir sans compte.

**Le QR code ne change jamais** : modifiez prix, photos ou plats, publiez, et le menu scanné est à jour.

## 7. Ensuite

- **Vue d'ensemble** : consultations, plats les plus regardés, usage de la 3D et de l'AR (30 jours), checklist de mise en service.
- **Utilisateurs** : créez un compte restaurateur limité à son restaurant (propriétaire : modifie et publie ; éditeur : modifie seulement).
- **Demandes** : demandes de démonstration reçues depuis le site.
