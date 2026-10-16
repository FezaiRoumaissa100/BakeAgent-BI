# Prévision par produit

Pipeline automatique qui prévoit les ventes **de chaque produit** pour les prochains jours.
Il s'ajoute à la prévision globale existante (Prophet, notebook) sans la modifier.

## Lancer
```powershell
pip install -r forecasting\requirements.txt     # une seule fois
python forecasting\pipeline.py                   # calcule et enregistre dans la base
```
Relancer chaque semaine (ou après chaque import de nouvelles ventes).
Essai sans toucher à la base : `python forecasting\export_data.py` puis `python forecasting\pipeline.py --csv`.

## Ce qu'il fait
1. **Contrôles** : ruptures de volume (ex. baisse brutale des tickets), jours absents, valeurs aberrantes.
2. **Classement des produits** (Syntetos-Boylan) : régulier, irrégulier, intermittent, sporadique ;
   + saisonnier, inactif, historique insuffisant (pas de prévision pour ces deux derniers).
3. **Compétition de méthodes** sur 6 périodes de 14 jours réparties sur la dernière année (non vues par les modèles),
   plus la même période que l'horizon un an plus tôt quand l'historique le permet (au moins ~1 an et 5 semaines) :
   moyenne des 4 derniers mêmes jours, même période l'an dernier ajustée au niveau actuel, TSB (ventes intermittentes),
   modèle global de gradient boosting (tous les produits ensemble, avec jour, mois, saison touristique, événements),
   Prophet par produit s'il est installé. Toutes les méthodes sont comparées sur les mêmes périodes ; la plus précise
   (WAPE) est retenue, la plus simple sauf gain d'au moins 2 points.
4. **Règle de saison** : un produit dont la saison démarre ou s'arrête pendant l'horizon d'après l'an dernier
   (bûches, galettes…) suit « même période l'an dernier ».
5. **Jours d'événement** (Noël, réveillon, 1er janvier, Pâques…) : le type de chaque événement est appris dans le
   calendrier (date fixe, lié à Pâques, ou même jour de semaine) puis projeté sur l'avenir quand le calendrier n'est
   pas rempli. Ces jours-là : moitié modèle ajusté à l'écart de la boutique l'an dernier, moitié ventes du produit
   le même jour l'an dernier. Un jour d'habitude fermé (ex. mercredi) est prévu ouvert s'il s'agit d'un jour
   d'événement ouvert l'an dernier avec un vrai volume (ex. 24/12).
6. **Prévision** des prochains jours avec une fourchette basse / haute calibrée sur les erreurs réellement observées
   pendant les tests (quantiles 10 % / 90 %) ; sa couverture réelle, mesurée sur des périodes non utilisées pour la
   construire, est enregistrée et affichée. Jours fermés détectés (jour de semaine fermé, fermeture saisonnière,
   jour férié fermé l'an dernier).

Rien n'est propre à une boulangerie : tout est détecté dans les données. Réglages : `config.json`.
Jours fériés : `jours_feries_pays` ("FR" par défaut, "" pour aucun) et `jours_feries_dates` (dates fixes en plus,
"MM-JJ") ; un jour férié n'est traité à part que s'il a réellement été un jour particulier l'an dernier.
Deux réglages à revoir seulement pour une boutique très différente : `seuil_jour_ouvert_pct` (15 : un jour compte
comme ouvert s'il vend au moins 15 % d'un jour normal) et `poids_an_dernier_jours_evenement` (0.5 : jours de fête,
moitié ventes du même jour l'an dernier, moitié modèle). Le contrôle « jours ambigus » avertit sur la page Prévisions
si beaucoup de jours sont proches du seuil d'ouverture.

7. **Toute la boutique** (graphique « Historique + Prévision », prévision de saison, page Alertes) :
   - 7 / 14 jours = somme des prévisions par produit combinée avec les ventes de la boutique le même jour l'an dernier
     (poids choisi sur les tests, 50 % par défaut : la somme des produits suit le niveau récent, l'an dernier voit venir
     les changements de saison et les jours fériés) ; chiffre d'affaires = quantités × prix récent de chaque produit ;
   - précision mesurée honnêtement : pour chaque fenêtre de test, chaque produit utilise la méthode qu'il aurait
     choisie sans cette fenêtre ; fourchettes ajustées pour viser ≈ 10 % des jours au-dessus de la borne haute ;
   - saison = période choisie dans les données (mois « saison touristique » du calendrier, sinon mois nettement au-dessus
     de la médiane, + un mois avant et après ; sans saison marquée : les 3 mois suivants). Prévision = même jour l'an
     dernier × évolution des ventes puissance α, α choisi en testant des prévisions faites à des dates passées ;
   - erreurs et fourchettes mesurées, enregistrées et affichées. Si le pipeline n'a pas été lancé, le tableau de bord
     se replie sur l'ancienne prévision Prophet du notebook (non vérifiée).

## Résultats (nouvelles tables)
`product_forecast_runs`, `product_forecast_models`, `product_forecasts`, `shop_forecasts`, `forecast_data_checks`.
Le tableau de bord les lit via `/api/forecast`, `/api/alerts`, `/api/forecast/products`, `/api/forecast/products/{id}` et `/api/alerts/products`.
