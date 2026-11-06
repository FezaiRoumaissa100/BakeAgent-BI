# Audit of the data and the dashboard — 29 October 2026

Done from three angles: **data engineer** (are the tables right and consistent?), **baker** (does the screen tell me what to make?) and **manager / CEO** (do the numbers mean what they say?). Everything below was measured on the real database (`retail_db`, 225,865 ticket lines, 1 Jan 2024 – 31 Dec 2025) or on the code. Nothing is committed.

## A. Mistakes found and corrected

| # | Mistake | Angle | What was wrong | Correction | Effect |
|---|---|---|---|---|---|
| 1 | API import: stray sales counted as open days | Data | My first importer put every day with sales in `daily_aggregates`. The demo table only has open days (a few stray sales on a closed Wednesday are not). The dashboard reads "the last day" from that table, so a Wednesday with 2 tickets could have become "today". My first fix used a fixed 25 tickets, which only suited this shop. | Relative rule: a day is open at 15 % of the usual tickets (median of the 28 previous sales days), the same principle as the forecast; `open_day_min_ratio` in `client_settings.json`. | Works for a small or a big shop; the forecast and the import agree on which days are open (130 = 130 on the test shop). |
| 2 | API import: tourist season lost for next summer | Data | The forecast projects last year's season when the future calendar has no tourist days. My importer flagged a few future July days, which would have made it think the calendar was complete, and the rest of the summer would lose its flag. Also, days put in the calendar before their sales arrived stayed "off season". | Flag set only up to the last sale; corrected on days that already existed; left false after. | Summer forecasts keep the tourist uplift. |
| 3 | "Bought together" rules mixed tickets of different days | Data | The notebook identified a ticket by its number alone, but numbers are reused (131,315 distinct numbers for 131,853 real tickets) and the rest of the dashboard uses (day, number). | `BD/analytics.py` uses (day, number). | Small change (lift ≤ 0.02). |
| 4 | **COUPE was 34 of the 50 association rules** | Manager | COUPE costs 0.20 EUR and sits on 16,042 tickets, next to bread: it is the bread-slicing service, not a product. "Whoever buys a loaf buys the slicing" told nothing. | `basket_excluded_articles` in `client_settings.json`; the table was recomputed (backup: `Downloads/association_rules_before_coupe_fix.csv`). | 22 rows (18 rules) left, none with COUPE; the top rule is now baguette + pain au chocolat -> croissant (lift 2.56). The "Bought together" page changes accordingly. |
| 5 | Products in the wrong family | Data / manager | The keyword rule matched "PAIN" in *pain au chocolat*, *pain aux raisins*, *pain choco amandes*, *pain suisse*, "COMPLET" in *sandwich complet*, and "EAU" in *bottereau* (a Breton fritter, classified as a drink). | `BD/demo_data/fix_categories_demo_bakery.sql` (6 products, demo-specific; backup: `Downloads/dim_products_before_category_fix.csv`). | Share of revenue: Pains & Baguettes 45.3 % -> 38.1 %, Viennoiseries 8.1 % -> 13.3 %, Traiteur & Sale 9.5 % -> 11.6 %. Sales and forecasts unchanged. |
| 6 | Coffee, sweets and slicing on the "To prepare" list | Baker | The production list asked the baker to prepare *café ou eau* (11 "to prepare"), sweets and COUPE. | `production_excluded_*` in `client_settings.json`: hidden from the prep list, risk grid, stock entry and tray sizes. Still in sales and statistics. | 46 products on the 1 Jan list instead of 51. |
| 7 | Counting in single pieces only | Baker | The bakery works in trays / batches. | Tray sizes (table `product_tray_sizes`, page *Saisie du stock > Tailles de plaque*): trays on the prep list, the batch plan, the printed sheet, and stock entry in trays. Sales and forecasts stay in pieces. | See section C. |
| 8 | Database password in the import script | Data | `001_import_from_pkl.py` had it in clear. | Read from `PG_URL` / `DB_*` variables (`BD/db_config.py`). | Default is still the local one (see B8). |

## B. Found, not changed (needs a decision or information)

1. **Two names for the same product: `GD FAR BRETON` and `GRAND FAR BRETON`.** Sold on the same day on 71 days, so it is a till button duplicated, not a replacement. It splits the demand (384 and 1,426 pieces), the forecasts, and the prep list shows two lines. Merging changes product ids in forecasts and stock entries: ask the shop which is current, then merge in one go.
2. **547 ticket lines are exact copies** (same day, ticket, product, quantity, price, hour; 521 groups; 0.24 % of lines). Could be a customer scanning twice on purpose or a double export. Not removed. Ask the till supplier.
3. **The October 2025 break is still unexplained.** Tickets per day fall from about 190 to 80–90 while items per ticket go from 2.3 to 4.0 and the ticket value doubles. The forecast pipeline raised the check itself ("changement de caisse ? À vérifier avec la boutique"). Its September 2024 alert (-54 %) is a false alarm: it compares September with the tourist summer before it.
4. **97 % of the products are "Niche / À surveiller"** (140 of 144), because the statuses ask for 10 % / 30 % / 50 % of all tickets. That is a rule of the specification (`backend/config.py` says changes need the supervisor's written approval), but as a reading tool it flags almost everything.
5. **No real waste is measured yet.** `daily_production` is empty (nobody has entered prepared / left). The "Avoidable unsold" figure is the model's estimate, not what was thrown away.
6. **The prep list is deliberately generous.** "To prepare" is the upper bound of the forecast (9 days out of 10 without running out). The forecast itself was 19.7 % too high on the 6 test windows the pipeline reports (3.6 % on 11 windows): the list leans toward surplus. Tray rounding adds to it (section C).
7. **Smaller inconsistencies.** `daily_aggregates.ref_actives` is 0 on every row; `product_penetration` is read by no page; 31 Dec 2024 differs from its lines by 4 items and 51 EUR in `daily_aggregates`; `/api/performance` takes 11–17 s and the Produits tabs about 15 s each.
8. **Credentials and quality.** The database password still has a default in `backend/db/db.py` and `BD/db_config.py`: set `DB_PASS` in the environment and remove the default before any shared deployment. ESLint reports hundreds of errors (mostly `any`), as before.

## C. Trays: what to know before relying on them

- The five tray sizes in the database (baguette, traditional baguette, banette: 8; croissant, pain au chocolat: 20) are **my estimates**, shown as "size to confirm" until the bakery saves them. I kept the list short on purpose: for a product that sells less than a tray a day, rounding up to a whole tray makes more surplus than service.
- With a *perfect* forecast and these sizes, rounding up on the last 60 days of sales leaves extra pieces equal to: baguette 12 %, traditional baguette 16 %, banette 36 %, croissant 64 %, pain au chocolat 68 % of what was sold. (Recent sales are low: the October 2025 break, and winter.) The prep list shows the total as "Whole-tray surplus", and each product can be set to *nearest* or *none*.
- Plan for the baker: confirm sizes, then decide per product whether a partial tray is acceptable.

## D. How it was checked

- Importer on a throwaway copy of the database: 52 checks (rebuilding December 2025 from a fake API reproduces the real lines, aggregates, events and analytics; errors leave the database untouched).
- Tray API: 11 tests (`python tests/test_trays_engine.py`, throwaway database). Tray arithmetic: 8 tests (`node --test tests/trays.test.ts`), including exact piece <-> tray round trips and "the batches add up to the total".
- Screens (prep list, batch plan, stock entry in trays, tray editor) opened in the browser; a tray size saved and removed again from the editor; no entry was saved to `daily_production`.

## E. Made independent of this sample data (follow-up)

The demo data is not a real client, so everything above was reviewed for what is specific to it:
- All shop-specific values (excluded articles and families, tourist months, hemisphere, open-day rule, basket thresholds) now live in `client_settings.json`; the French events in `events_config.json` (profile `FR`, switch-off supported). The two SQL fixes for the demo's article names moved to `BD/demo_data/` and are not setup steps.
- New in `api_mapping.json`: `article_aliases` and `category_overrides`, to fix what a client's till sends without touching code.
- Proof: `tests/test_other_shop.py` imports a deliberately different shop from an empty database (39 checks, all pass), `tests/test_client_settings.py` covers the settings and the open-day rule (14 tests), and the earlier importer test on the demo data still passes (52 checks).
- Checked on that other shop: the forecast pipeline agrees with the importer on which days are open, and with 5 months of history it falls back to the 4-week same-weekday average instead of failing.
- Not done (needs the real client): the real API field names, the client's article list (families, services, duplicates), its events and opening hours, its tray sizes. Some older screens still carry French labels or the demo bakery's family names in translation tables (`frontend/src/lib/i18n.ts`); unknown families are shown as they come.

## F. Second check on a different shop (dashboard pages)

The whole dashboard was run on the test shop (forecasts included) and every page read. Fixed:
- Vue du Jour footer showed the demo's fixed end date (31/12/2025): now the real last day.
- Performance counted a closed day with a few stray sales as an open day: Monday became "the weakest day, 38x below Sunday" and the headline said 141 open days instead of 130. Open days now come from `daily_aggregates` (demo: 620 open days instead of 658 days with any sale).
- Performance ended with "l'été et les fêtes portent l'année", true for the demo only: removed. A weekday never open now reads "fermée le lundi" instead of "ouverte seulement 0 fois".
- Alertes showed zeros and "undefined" in the season section with under a year of sales: it now says the season forecast needs about a year.
- Till articles that are not products (bag, slicing service) were ranked as products: "Carrier Bag est le produit qui fait venir les clients". New setting `non_product_articles` takes them out of every product analysis (revenue and ticket totals unchanged). Demo: COUPE is gone from presence, matrix, rhythm, basket role and top lists; multi-product tickets 57,168 -> 51,221.
- "À revoir" called half the menu weak on a small catalogue (8 products, 52 % of revenue), because two big sellers pull the averages up. A product is now "à revoir" when it is below both averages AND earns less than half of an average product (or meets the strict criterion of the specification). Test shop: 1 product, 3.3 % of revenue. Demo: 79 products, 7.3 % of revenue (before: 101 products, 22.7 %).
Checks: `tests/test_other_shop.py` 47/47, `tests/test_client_settings.py` 15, tray API 11, tray arithmetic 8, demo importer 52/52.
Left as is: screens keep French weekday names and the demo bakery's family translations.

## G. Daily totals and shop forecast without non-products

- `daily_aggregates.nb_articles` now counts products only (one definition, `BD/analytics.recount_daily_articles`, used by both imports); revenue and tickets unchanged. Vue du Jour "Articles" and the articles per hour follow.
- The forecast pipeline no longer forecasts non-products, so the shop total (sum of products) excludes them, and the per-product list on Prévisions no longer has a line for them.
- Demo: articles over 620 days 349,282 -> 330,043 (-5.5 %, COUPE); revenue 845,794 EUR and 131,709 tickets unchanged (backup: `Downloads/daily_aggregates_before_article_recount.csv`). Forecasts recomputed (runs 5 and 6; previous tables backed up in `forecasting/data/`). Next 14 days: 3,984 -> 3,693 articles. Measured on the same 6 test windows, the shop forecast got slightly better: daily error 33.7 % -> 31.8 %, weekly 31.1 % -> 29.8 %, bias +19.7 % -> +13.5 %.
- Test shop: 166 -> 128 articles on the last day; the 7-day shop forecast (1,478) matches the sum of products and a usual week without bags (1,498). `tests/test_other_shop.py` now 53 checks, all pass; demo importer 52/52, settings 15, trays 11 + 8.
- Small side effect: the revenue forecast is the sum of products too, so it leaves out non-product revenue (0.5 % of revenue on both shops), while revenue history includes it.
