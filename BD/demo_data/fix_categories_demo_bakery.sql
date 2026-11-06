-- ================================================================
-- BD/demo_data/fix_categories_demo_bakery.sql
-- SPÉCIFIQUE à la boulangerie de démonstration (noms d'articles de ses ventes). N'est PAS une étape d'installation :
-- pour un autre client, corriger les familles dans BD/api_mapping.json (« category_overrides »).
-- Correction de familles mal classées par la règle de mots-clés du notebook d'origine.
--
--   PAIN AU CHOCOLAT, PAIN CHOCO AMANDES, PAIN AUX RAISINS, PAIN SUISSE PEPITO : le mot « PAIN » les avait classés en
--       « Pains & Baguettes » ; ce sont des viennoiseries (le pain au chocolat est le 2e produit de la famille en volume).
--   SANDWICH COMPLET : le mot « COMPLET » (pain complet) l'avait classé en « Pains & Baguettes » ; c'est un sandwich.
--   BOTTEREAU : contient « EAU », donc classé « Boissons » ; ce sont des beignets bretons, une viennoiserie.
--
-- Effet : la part de « Pains & Baguettes » dans le chiffre d'affaires baisse (viennoiseries en hausse). Les ventes, les
-- prévisions et les quantités ne changent pas.
-- Sans danger à relancer. Les produits déjà importés gardent cette famille aux imports suivants (le produit existe déjà).
-- ================================================================
UPDATE dim_products p
SET category_id = c.category_id
FROM dim_categories c
WHERE (c.category_name = 'Viennoiseries'
       AND p.article_name IN ('PAIN AU CHOCOLAT', 'PAIN CHOCO AMANDES', 'PAIN AUX RAISINS', 'PAIN SUISSE PEPITO', 'BOTTEREAU'))
   OR (c.category_name = 'Traiteur & Sale' AND p.article_name = 'SANDWICH COMPLET');
