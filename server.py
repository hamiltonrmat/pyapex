import http.server
import socketserver
import os

PORT = int(os.environ.get("PORT", 8000))

# --- Génération dynamique de config.js à partir des variables d'environnement ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://bkjfseezlnkdeufopqjo.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "MISSING_KEY")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "apex42")

config_content = f"""// Fichier généré automatiquement par server.py — ne pas modifier
const SUPABASE_URL = "{SUPABASE_URL}";
const SUPABASE_ANON_KEY = "{SUPABASE_ANON_KEY}";
const ADMIN_PASSWORD = "{ADMIN_PASSWORD}";
"""

with open("js/config.js", "w") as f:
    f.write(config_content)

print(f"✅ config.js généré (SUPABASE_URL={SUPABASE_URL[:30]}...)")

# --- Serveur HTTP statique ---
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"🚀 PyApex server running on port {PORT}")
    httpd.serve_forever()
