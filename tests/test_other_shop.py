"""Test d'onboarding : un commerce TOTALEMENT différent de la boulangerie de démonstration, importé depuis une base vide
(python tests/test_other_shop.py ; base jetable retail_db_othershop, jamais retail_db).
A completely different shop (English names, other hemisphere, closed Mondays, 5 months of data, no tourist season,
no line ids, timestamps in UTC, different field names) imported from scratch into an EMPTY database."""
import json, os, random, subprocess, sys, threading, tempfile
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import pandas as pd
import psycopg2

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = tempfile.mkdtemp(prefix="othershop_")
IMPORTER = os.path.join(REPO, "BD", "002_import_from_api.py")
DB = "retail_db_othershop"
ADMIN = dict(host=os.getenv("DB_HOST", "127.0.0.1"), user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASS", "admin123"))
TZ = "Australia/Sydney"
START, END = date(2026, 3, 2), date(2026, 7, 31)          # a Monday .. a Friday : 21+ weeks, less than a year
RES = []


def check(name, ok, detail=""):
    RES.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))


def q(c, sql, p=None):
    cur = c.cursor(); cur.execute(sql, p); r = cur.fetchall(); cur.close(); return r


# ---------- 1. synthetic shop ----------
rnd = random.Random(7)
PRODUCTS = {  # name: (dept, price)
    "Sourdough Loaf": ("Bread", 4.5), "Baguette": ("Bread", 2.2), "Rye Loaf": ("Bread", 5.0),
    "Croissant": ("Pastry", 3.2), "Pain au Chocolat": ("Bread", 3.5), "Cinnamon Roll": ("Pastry", 3.8),   # pain au chocolat mis-filed on purpose
    "Chocolate Cake Slice": ("Cakes", 5.5), "Choc Cake Slice": ("Cakes", 5.5), "Cheesecake Slice": ("Cakes", 5.8),   # duplicate till button
    "Latte": ("Coffee", 4.2), "Espresso": ("Coffee", 3.0), "Ham Sandwich": ("Sandwiches", 7.5),
    "Carrier Bag": ("Extras", 0.1),
}
BREAKFAST = ["Croissant", "Latte"]
lines, n_order = [], 0
d = START
while d <= END:
    wd = d.weekday()
    if wd == 0:                                            # Monday: closed, a few stray sales on some Mondays
        n_tickets = rnd.choice([0, 0, 0, 1, 2])
    else:
        n_tickets = rnd.randint(55, 85) if wd >= 5 else rnd.randint(30, 48)
    for _ in range(n_tickets):
        n_order += 1
        hour = min(15, max(6, int(rnd.gauss(9.5, 2.2))))
        ts = pd.Timestamp(d) + pd.Timedelta(hours=hour, minutes=rnd.randint(0, 59))
        utc = ts.tz_localize(TZ).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
        items = set(rnd.sample(list(PRODUCTS)[:12], rnd.randint(1, 3)))
        if rnd.random() < 0.35: items |= set(BREAKFAST)
        if rnd.random() < 0.5: items.add("Carrier Bag")
        for it in sorted(items):
            dept, price = PRODUCTS[it]
            lines.append({"order_ref": f"W{n_order}", "at": utc, "sku_name": it, "dept": dept, "units": rnd.randint(1, 3), "price_each": price,
                          "_local_hour": hour, "_local_day": str(d)})
    d += timedelta(days=1)
RET = []
for i in range(6):                                          # returns (negative quantity)
    l = dict(lines[i * 50]); l["order_ref"] = f"RET{i}"; l["units"] = -1; RET.append(l)
lines += RET
print("synthetic lines:", len(lines), "days:", (END - START).days + 1)

STATE = {"rows": lines, "token": "tok-123"}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urlparse(self.path); qs = {k: v[0] for k, v in parse_qs(u.query).items()}
        if self.headers.get("X-Api-Key") != STATE["token"]:
            self.send_response(403); self.end_headers(); return
        d1, d2 = qs["since"], qs["until"]
        sel = [r for r in STATE["rows"] if d1 <= r["_local_day"] <= d2]
        page, size = int(qs["p"]), int(qs["n"])
        body = json.dumps({"result": {"items": sel[(page - 1) * size: page * size]}}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)


srv = HTTPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

MAPPING = {
    "endpoint": "orders/lines", "auth": {"type": "header", "name": "X-Api-Key"},
    "params": {"date_from": "since", "date_to": "until", "to_inclusive": True, "window_days": 20, "page": "p", "page_size": "n",
               "page_size_value": 300, "date_format": "%Y-%m-%d"},
    "response": {"records_path": "result.items", "pagination": "page"},
    "fields": {"line_id": None, "timestamp": "at", "date": None, "hour": None, "ticket_number": "order_ref", "article": "sku_name",
               "category": "dept", "quantity": "units", "unit_price": "price_each", "total_revenue": None, "event": None},
    "timezone": TZ, "overlap_days": 3,
    "article_aliases": {"choc cake slice": "Chocolate Cake Slice"},
    "category_overrides": {"Pain au Chocolat": "Pastry"},
}
SETTINGS = {"non_product_articles": ["carrier bag"], "production_excluded_categories": ["Extras"],
            "production_excluded_articles": [], "basket_excluded_articles": [], "touristic_months": [], "hemisphere": "south", "open_day_min_ratio": 0.15,
            "open_day_min_tickets": None, "basket_min_support": 0.01, "basket_min_lift": 1.2}
EVENTS = {"profile": "AU-demo", "enabled": True, "events": [
    {"name": "Mothers Day", "rule": {"type": "nth_weekday", "month": 5, "weekday": 6, "n": 2}},
    {"name": "Good Friday", "rule": {"type": "easter", "offset_from": -2, "offset_to": -2}},
    {"name": "Winter Fair", "rule": {"type": "range", "from": [7, 10], "to": [7, 12]}}]}
def wjson(name, obj):
    p = os.path.join(SCRATCH, name); json.dump(obj, open(p, "w", encoding="utf-8")); return p
MAP_P, SET_P, EV_P = wjson("os_map.json", MAPPING), wjson("os_settings.json", SETTINGS), wjson("os_events.json", EVENTS)

adm = psycopg2.connect(dbname="postgres", **ADMIN); adm.autocommit = True
adm.cursor().execute(f"DROP DATABASE IF EXISTS {DB}"); adm.cursor().execute(f"CREATE DATABASE {DB}"); adm.close()
C = psycopg2.connect(dbname=DB, **ADMIN); C.autocommit = True
C.cursor().execute(open(os.path.join(REPO, "BD", "schema.sql"), encoding="utf-8").read())

ENV = dict(os.environ, PG_URL=f"postgresql+psycopg2://{ADMIN['user']}:{ADMIN['password']}@{ADMIN['host']}:5432/{DB}", API_BASE_URL=f"http://127.0.0.1:{port}",
           API_TOKEN=STATE["token"], CLIENT_SETTINGS=SET_P, PYTHONIOENCODING="utf-8", DB_NAME=DB)


def run(args):
    p = subprocess.run([sys.executable, "-c",
                        "import sys, runpy; sys.path.insert(0, r'%s'); sys.argv=['x']+%r; runpy.run_path(r'%s', run_name='__main__')"
                        % (os.path.join(REPO, "BD"), args + ["--mapping", MAP_P, "--events-config", EV_P], IMPORTER)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", env=ENV)
    return p.returncode, p.stdout + p.stderr


# ---------- 2. import into an empty database ----------
rc, out = run(["--no-refresh"])
check("base vide sans --since : message clair", rc != 0 and "Base vide" in out, out.strip().splitlines()[-1][:100])
rc, out = run(["--since", str(START), "--until", str(END), "--no-refresh"])
print(out)
check("import d'un autre commerce depuis une base vide : code 0", rc == 0)
check("lignes à quantité négative écartées et signalées", "quantité négative" in out and "6 ligne" in out)

n_lines = q(C, "select count(*) from fact_ticket_lines")[0][0]
expected = len([l for l in lines if l["units"] > 0])
check("toutes les lignes valides sont en base", n_lines == expected, f"{n_lines} / {expected}")
prods = {r[0]: r[1] for r in q(C, "select p.article_name, c.category_name from dim_products p left join dim_categories c using(category_id)")}
check("doublon de bouton regroupé (Choc Cake Slice -> Chocolate Cake Slice)", "Choc Cake Slice" not in prods and "Chocolate Cake Slice" in prods and len(prods) == 12, str(len(prods)))
check("famille corrigée (Pain au Chocolat -> Pastry)", prods.get("Pain au Chocolat") == "Pastry")
check("familles de la caisse reprises telles quelles", prods.get("Latte") == "Coffee" and prods.get("Cheesecake Slice") == "Cakes")

# open days: Tue..Sun traffic, Mondays are stray
agg = {r[0]: r[1] for r in q(C, "select date_id, nb_tickets from daily_aggregates")}
mondays = [x for x in agg if x.weekday() == 0]
real_days = {date.fromisoformat(l["_local_day"]) for l in lines if l["units"] > 0 and date.fromisoformat(l["_local_day"]).weekday() != 0}
check("jours ouverts = jours à vraie activité (mardi-dimanche)", set(agg) == real_days, f"{len(agg)} vs {len(real_days)}")
check("lundis fermés avec quelques ventes isolées : pas des jours ouverts", not mondays and "trop calmes" in out)
check("mais leurs lignes de ticket sont gardées", q(C, "select count(*) from fact_ticket_lines where extract(dow from date_id) = 1")[0][0] > 0)

# calendar: southern hemisphere seasons, no tourist season
seas = {r[0]: r[1] for r in q(C, "select d.date_id, s.season_name from dim_dates d join dim_seasons s using(season_id)")}
check("saisons de l'hémisphère sud (1er mars = été, 1er mai = automne, 15 juillet = hiver)",
      seas.get(date(2026, 3, 3)) == "Ete" and seas.get(date(2026, 5, 5)) == "Automne" and seas.get(date(2026, 7, 15)) == "Hiver", str({k: seas.get(k) for k in (date(2026, 3, 3), date(2026, 5, 5), date(2026, 7, 15))}))
check("aucune saison touristique (réglage vide)", q(C, "select count(*) from dim_dates where is_touristic")[0][0] == 0)
check("calendrier prolongé de 15 jours après la dernière vente", q(C, "select max(date_id) from dim_dates")[0][0] == END + timedelta(days=15))

# events from the client's own calendar
evd = {r[0]: r[1] for r in q(C, "select distinct f.date_id, e.event_name from fact_ticket_lines f join dim_events e using(event_id) where e.is_event")}
check("événements du calendrier de ce client (fête des mères, vendredi saint, foire d'hiver)",
      evd.get(date(2026, 5, 10)) == "Mothers Day" and evd.get(date(2026, 4, 3)) == "Good Friday" and evd.get(date(2026, 7, 11)) == "Winter Fair", str(sorted(set(evd.values()))))
check("aucun événement français appliqué", not ({"Noel", "Paques", "Galette des Rois"} & set(evd.values())))

# hours: UTC -> Sydney local
h_db = q(C, "select min(hour), max(hour) from fact_ticket_lines")[0]
check("heures converties du UTC à l'heure locale (6 h - 15 h)", h_db == (6, 15), str(h_db))

# analytics
vel = q(C, "select count(*) from product_velocity_stats")[0][0]
check("vitesse de vente calculée pour chaque produit", vel == 12, str(vel))
rules = q(C, "select antecedents_str, consequents_str, lift from association_rules")
check("règles calculées sans 'Carrier Bag' (pas un produit pour ce client)", not any("Carrier" in (a + c) for a, c, _ in rules), f"{len(rules)} lignes")
check("l'association petit-déjeuner (Croissant + Latte) est trouvée", any(("Croissant" in a and "Latte" in c) or ("Latte" in a and "Croissant" in c) for a, c, _ in rules))

# ---------- 3. idempotence on another shop ----------
snap = lambda: q(C, "select (select count(*) from fact_ticket_lines), (select sum(total_revenue) from fact_ticket_lines), (select count(*) from daily_aggregates), (select count(*) from dim_dates)")[0]
before = snap()
rc, out = run(["--until", str(END), "--no-refresh"])
check("relance (recouvrement par défaut) : code 0 et mêmes totaux", rc == 0 and snap() == before, str(snap()) + " vs " + str(before))

# ---------- 3b. daily article totals without non-products ----------
bad_days = q(C, """SELECT a.date_id FROM daily_aggregates a
                   JOIN (SELECT f.date_id, SUM(f.quantity) FILTER (WHERE p.article_name <> 'Carrier Bag') AS q,
                                SUM(f.total_revenue) AS ca, COUNT(DISTINCT f.ticket_number) AS t
                         FROM fact_ticket_lines f JOIN dim_products p USING (product_id) GROUP BY f.date_id) s USING (date_id)
                   WHERE a.nb_articles <> s.q OR abs(a.ca_jour - s.ca) > 0.01 OR a.nb_tickets <> s.t""")
check("articles du jour sans les sacs ; chiffre d'affaires et tickets complets", not bad_days, str(bad_days[:3]))

# ---------- 3c. forecasts: the bag is neither forecast nor in the shop total ----------
r = subprocess.run([sys.executable, os.path.join(REPO, "forecasting", "refresh_forecasts.py"), "--no-backup"],
                   capture_output=True, text=True, encoding="utf-8", errors="replace", env=ENV)
check("calcul des prévisions sur ce commerce : code 0", r.returncode == 0, (r.stdout + r.stderr).strip().splitlines()[-1][:120])
bag_id = q(C, "select product_id from dim_products where article_name = 'Carrier Bag'")[0][0]
check("pas de prévision produit pour le sac", q(C, "select count(*) from product_forecast_models where product_id = %s", (bag_id,))[0][0] == 0)
run = q(C, "select max(run_id) from product_forecast_runs where horizon < 30")[0][0]
shop = q(C, "select sum(yhat) from shop_forecasts where run_id = %s and kind = 'court' and ds <= (select min(ds) + 6 from shop_forecasts where run_id = %s and kind = 'court')", (run, run))[0][0]
prod = q(C, "select sum(yhat) from product_forecasts where run_id = %s and ds <= (select min(ds) + 6 from product_forecasts where run_id = %s)", (run, run))[0][0]
avg_week = q(C, "select avg(w) from (select sum(nb_articles) w from daily_aggregates group by date_trunc('week', date_id)) x")[0][0]
check("total boutique prévu (7 j) proche de la somme des produits, du niveau d'une semaine sans sacs",
      shop and prod and abs(float(shop) - float(prod)) / float(prod) < 0.25 and abs(float(shop) - float(avg_week)) / float(avg_week) < 0.25,
      f"boutique {float(shop):.0f} · produits {float(prod):.0f} · semaine habituelle {float(avg_week):.0f}")

# ---------- 4. backend on this data ----------
os.environ.update(DB_HOST=ADMIN["host"], DB_PORT="5432", DB_NAME=DB, DB_USER=ADMIN["user"], DB_PASS=ADMIN["password"], CLIENT_SETTINGS=SET_P)
sys.path.insert(0, os.path.join(REPO, "backend"))
from fastapi.testclient import TestClient
import main
cl = TestClient(main.app, raise_server_exceptions=False)
for path in ["/api/data-period", "/api/daily-kpis", "/api/performance", "/api/products/associations", "/api/products/matrix", "/api/products/velocity",
             "/api/products/penetration", "/api/products/contribution", "/api/products/ticket-contribution", "/api/products/frequency",
             "/api/production", "/api/production/summary", "/api/production/trays", "/api/production/slots"]:
    r = cl.get(path)
    check(f"GET {path} répond sans erreur serveur", r.status_code == 200, f"HTTP {r.status_code}")
items = cl.get("/api/production/trays").json()["items"]
names = [i["article"] for i in items]
check("tailles de plaque : 'Carrier Bag' et la famille 'Extras' absents (réglage de ce client)", "Carrier Bag" not in names)
day = cl.get("/api/production").json()
check("saisie du stock : jour par défaut = dernier jour ouvert, sans articles exclus", day.get("date") == str(max(real_days)) and "Carrier Bag" not in [i["article"] for i in day["items"]], str(day.get("date")))
cr = next(i for i in items if i["article"] == "Croissant")
check("enregistrer une plaque pour un produit de ce commerce", cl.put(f"/api/production/trays/{cr['product_id']}", json={"pieces_per_tray": 12, "rounding": "up"}).json()["ok"])
check("la plaque apparaît dans la saisie du stock", next(i for i in cl.get("/api/production").json()["items"] if i["article"] == "Croissant")["tray"]["pieces"] == 12)
k = cl.get("/api/daily-kpis").json()
q_day = q(C, "select sum(f.quantity) from fact_ticket_lines f join dim_products p using(product_id) where date_id = %s and p.article_name <> 'Carrier Bag'", (max(real_days),))[0][0]
check("Vue du Jour : « Articles » sans les sacs", k.get("qte_jour") == int(q_day), f"{k.get('qte_jour')} vs {q_day}")
fl = cl.get("/api/forecast/products").json()
check("Prévisions : le sac n'est pas dans la liste des produits prévus", fl.get("available") and "Carrier Bag" not in [i["article"] for i in fl["items"]], str(len(fl.get("items", []))))
lists = [i["article"] for key in ("top_qte", "top_ca", "top_tkt") for i in (k.get(key) or [])]
pairs = [p["pa"] + p["pb"] for p in (k.get("top_pairs") or [])]
check("Vue du Jour : le sac n'est ni dans les classements ni dans les paires", lists and "Carrier Bag" not in lists and not any("Carrier" in x for x in pairs))
check("Vue du Jour : un ticket « croissant + sac » compte comme un seul produit", k.get("nb_mono", 0) > 0, f"mono {k.get('nb_mono')} multi {k.get('nb_multi')}")
check("Vue du Jour : le chiffre d'affaires du jour garde le sac (c'est une vente)", k.get("ca_jour", 0) == float(q(C, "select sum(total_revenue) from fact_ticket_lines where date_id = %s", (max(real_days),))[0][0]))
pen = cl.get("/api/products/penetration").json()
check("Produits : le plus présent est un vrai produit", pen["items"][0]["article"] != "Carrier Bag" and "Carrier Bag" not in [i["article"] for i in pen["items"]], pen["items"][0]["article"])
mx = cl.get("/api/products/matrix").json()
rev = [i for i in mx["items"] if i["a_revoir"]]
share = sum(i["ca_total"] for i in rev) / max(sum(i["ca_total"] for i in mx["items"]), 1) * 100
check("Produits : « à revoir » ne vise pas la moitié du chiffre d'affaires", share < 10, f"{len(rev)} produits, {share:.1f} % du CA")
check("Produits : le sac n'est pas dans la matrice", "Carrier Bag" not in [i["article"] for i in mx["items"]])
perf = cl.get("/api/performance").json()
check("Performance : le sac n'est pas dans les meilleurs produits", "Carrier Bag" not in [i["article"] for i in perf["top_products"]["by_ca"] + perf["top_products"].get("by_qte", [])])
check("Performance : le chiffre d'affaires total garde le sac", abs(perf["kpis"]["total_ca"] - float(q(C, "select sum(total_revenue) from fact_ticket_lines")[0][0])) < 0.01)
check("tableau de bord : dernier jour affiché = dernier jour ouvert (pas un lundi isolé)", str(k.get("date"))[:10] == str(max(real_days)) and k.get("tickets", 0) >= 25, f"{k.get('date')} {k.get('tickets')}")
for path in ["/api/performance", "/api/products/associations", "/api/products/matrix", "/api/products/velocity", "/api/production/summary", "/api/alerts", "/api/forecast", "/api/alerts/products", "/api/forecast/products"]:
    j = cl.get(path).json()
    flag = (j.get("error") or ("available=False" if j.get("available") is False else None)) if isinstance(j, dict) else None
    print("   ", path, "->", flag or "contenu")
srv.shutdown()
print("\nRESUME :", sum(ok for _, ok in RES), "/", len(RES), "OK")
print("ECHECS :", [n for n, ok in RES if not ok])

C.close()
try:
    from db.db import get_connection
    get_connection().close()
except Exception:
    pass
adm = psycopg2.connect(dbname="postgres", **ADMIN); adm.autocommit = True
adm.cursor().execute(f"DROP DATABASE IF EXISTS {DB}"); adm.close()
sys.exit(0 if all(ok for _, ok in RES) else 1)
