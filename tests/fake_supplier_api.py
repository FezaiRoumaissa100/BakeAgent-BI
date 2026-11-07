"""tests/fake_supplier_api.py — fausse API de caisse pour tester BD/002_import_from_api.py sans vrai fournisseur.

Lancer :   python tests/fake_supplier_api.py 8765            (pages plafonnées à 100 lignes)
Puis :     set API_BASE_URL=http://127.0.0.1:8765/v1
           set API_TOKEN=test-token-123
           python BD/002_import_from_api.py --since 2025-01-01 --until 2025-02-28 --dry-run
Variantes (3e argument) : noweight (sans produit au poids), nopage (ignore le numéro de page), short (oublie une page).
A n'utiliser que sur une COPIE de la base (ou avec --dry-run) : l'import remplace les jours importés.

Comme une vraie API de fournisseur : jeton obligatoire, filtre de dates, pages PLAFONNÉES à 100 lignes
(même si on en demande 1000), heures en UTC (« Z »), produits vendus au poids (quantité 0,35…),
retours (quantité négative), et un produit dont la famille change en cours de route."""
import json, random, sys
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

TOKEN = "test-token-123"
MAX_PAGE = int(sys.argv[2]) if len(sys.argv) > 2 else 100
NO_WEIGHT = len(sys.argv) > 3 and sys.argv[3] == "noweight"
MODE = sys.argv[3] if len(sys.argv) > 3 else ""   # variante sans produit au poids (pour tester l'ancien script)
random.seed(42)
PROD = [("BAGUETTE", "Pains & Baguettes", 1.20), ("CROISSANT", "Viennoiseries", 1.30),
        ("PAIN AU CHOCOLAT", "Viennoiseries", 1.50), ("TARTE FRUITS 6P", "Patisseries", 21.0),
        ("FLAN AU KG", "Patisseries", 18.0),          # vendu au poids (prix au kg)
        ("SANDWICH JAMBON", "Snacking", 5.50)]
PARIS = timezone(timedelta(hours=1))  # heure d'hiver, suffisant pour le test (janvier-février)
ROWS = []
rid = 1000
d = date(2025, 1, 1)
while d <= date(2025, 2, 28):
    if d.weekday() != 2:  # fermé le mercredi
        for t in range(1, random.randint(25, 40)):
            local = datetime(d.year, d.month, d.day, random.choice([7, 8, 9, 10, 11, 12, 16, 18, 19]), random.randint(0, 59), tzinfo=PARIS)
            if t == 1:  # une vente tardive : 23 h 40 heure de Paris = 22 h 40 UTC ; et une à 0 h 30 → la veille en UTC
                local = local.replace(hour=0, minute=30)
            ticket = f"T{d:%m%d}-{t:03d}"
            for _ in range(random.randint(1, 3)):
                name, cat, price = random.choice(PROD)
                if NO_WEIGHT and "KG" in name:
                    name, cat, price = PROD[0]
                if name == "SANDWICH JAMBON" and d >= date(2025, 2, 1):
                    cat = "Traiteur & Salé"   # la caisse a changé la famille au 1er février
                qty = round(random.uniform(0.2, 0.9), 3) if "KG" in name else random.randint(1, 4)
                rid += 1
                ROWS.append({"id": rid, "sold_at": local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "ticket": ticket,
                             "product_name": name, "category": cat, "qty": qty, "unit_price": price, "total": round(qty * price, 2)})
            if t == 5 and d.day == 10:  # un retour
                rid += 1
                ROWS.append({"id": rid, "sold_at": local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "ticket": ticket,
                             "product_name": "CROISSANT", "category": "Viennoiseries", "qty": -1, "unit_price": 1.30, "total": -1.30})
    d += timedelta(days=1)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if self.headers.get("Authorization") != f"Bearer {TOKEN}":
            return self._send(401, {"error": "unauthorized"})
        if u.path == "/v1/all":
            return self._send(200, {"data": ROWS})
        if u.path != "/v1/sales":
            return self._send(404, {"error": "not found"})
        f, t = date.fromisoformat(q["from"]), date.fromisoformat(q["to"])
        # Le fournisseur filtre sur la date UTC (comme beaucoup d'API)
        sel = [r for r in ROWS if f <= date.fromisoformat(r["sold_at"][:10]) <= t]
        size = min(int(q.get("page_size", 50)), MAX_PAGE)
        page = 1 if MODE == "nopage" else int(q.get("page", 1))
        data = sel[(page - 1) * size: page * size]
        if MODE == "short" and page == 3:
            data = []   # l'API « oublie » des pages
        self._send(200, {"data": data, "page": page, "page_size": size, "total": len(sel)})
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"Fausse API : {len(ROWS)} lignes, pages plafonnées à {MAX_PAGE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
