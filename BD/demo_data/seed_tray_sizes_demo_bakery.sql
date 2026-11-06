-- ================================================================
-- BD/demo_data/seed_tray_sizes_demo_bakery.sql
-- SPÉCIFIQUE à la boulangerie de démonstration (noms d'articles de ses ventes). N'est PAS une étape d'installation :
-- pour un autre client, les tailles se saisissent dans « Saisie du stock > Tailles de plaque ».
-- Tailles de plaque DE DÉPART pour les produits les plus vendus.
--
-- [ATTENTION] Ce sont des ESTIMATIONS (is_estimate = TRUE), pas des mesures : la boulangerie doit les confirmer
-- (page « Saisie du stock » > « Tailles de plaque » > Confirmer / modifier). Le tableau de bord les signale
-- « taille à confirmer » tant qu'elles ne l'ont pas été.
-- Sans danger à relancer : ne remplace jamais une taille déjà saisie ou confirmée (ON CONFLICT DO NOTHING).
-- ================================================================
CREATE TABLE IF NOT EXISTS product_tray_sizes (
    product_id      INTEGER PRIMARY KEY REFERENCES dim_products(product_id) ON DELETE CASCADE,
    pieces_per_tray INTEGER NOT NULL CHECK (pieces_per_tray BETWEEN 1 AND 1000),
    rounding        VARCHAR(10) NOT NULL DEFAULT 'up' CHECK (rounding IN ('up', 'nearest', 'none')),
    is_estimate     BOOLEAN NOT NULL DEFAULT TRUE,
    note            VARCHAR(200),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Seulement les produits de base dont la vente d'un jour remplit au moins une plaque (ou presque) : pour un produit qui se vend
-- moins qu'une plaque par jour, un arrondi à la plaque entière fabrique plus d'invendus que de service (voir BD/README.md).
INSERT INTO product_tray_sizes (product_id, pieces_per_tray, rounding, is_estimate, note)
SELECT p.product_id, v.pieces, 'up', TRUE, 'Estimation de départ : à confirmer par la boulangerie'
FROM (VALUES
    ('BAGUETTE',            8),
    ('TRADITIONAL BAGUETTE', 8),
    ('BANETTE',             8),
    ('CROISSANT',          20),
    ('PAIN AU CHOCOLAT',   20)
) AS v(article, pieces)
JOIN dim_products p ON p.article_name = v.article
ON CONFLICT (product_id) DO NOTHING;
