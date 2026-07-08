#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# MANTIS 2 — REVERTIR CARGA DEMO (STORY-918) — TODO en un comando.
#
# Deja la base y el storage EXACTAMENTE como estaban antes de demo-seed.sql,
# aunque las gestiones demo hayan sido movidas de etapa / editadas después.
# No se apoya en '[DEMO]' ni en la etapa: ancla en las RELACIONES con las
# personas y la cartera demo (ausitesis+demo…), que ninguna feature reasigna.
#
# Borra (service role, bypasea RLS): fotos del storage, emails, inbox demo,
# notificaciones, gestiones demo (+ hijos por cascade), usuarios/técnicos demo
# (auth.users → cascade) y la cartera demo. NO toca nada real.
#
# Uso:  ./scripts/demo-borrar.sh
# Lee la service key de codigo/.env.local — no requiere psql.
#
# Equivalente SQL (solo base, sin fotos): scripts/demo-borrar.sql
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://ejwokycbyjtlxwusbhtt.supabase.co"
SK="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$DIR/codigo/.env.local" | cut -d= -f2)"
[ -z "$SK" ] && { echo "✖ No encontré SUPABASE_SERVICE_ROLE_KEY en codigo/.env.local" >&2; exit 1; }

python3 - "$URL" "$SK" <<'PY'
import sys, json, urllib.request, urllib.parse
URL, SK = sys.argv[1], sys.argv[2]
H = {"apikey": SK, "Authorization": f"Bearer {SK}"}

def req(method, path, data=None, base="rest/v1", ctype="application/json"):
    url = f"{URL}/{base}/{path}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, method=method, headers={**H, "Content-Type": ctype})
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw and resp.headers.get("content-type","").startswith("application/json") else raw

def get(path):  return req("GET", path)
def delete(path): return req("DELETE", path)

# ── 1) Capturar identidades demo (antes de borrar nada) ──
gest = [r["id"] for r in get("gestiones?select=id,descripcion,propiedad_id,gestor_id,tecnico_id")]  # todas, filtro abajo
demo_owner = [r["id"] for r in get("propietarios?select=id&email=like.ausitesis%2Bdemo*")]
demo_inq   = [r["id"] for r in get("inquilinos?select=id&email=like.ausitesis%2Bdemo*")]
demo_users = [r["id"] for r in get("tecnicos?select=id&email=like.ausitesis%2Bdemo*")] + \
             [r["id"] for r in get("usuarios?select=id&email=like.ausitesis%2Bdemo*")]
demo_users = list(set(demo_users))
demo_props = [r["id"] for r in get("propiedades?select=id&propietario_id=in.(%s)" % ",".join(demo_owner))] if demo_owner else []

allg = get("gestiones?select=id,descripcion,propiedad_id,gestor_id,tecnico_id")
sp, su = set(demo_props), set(demo_users)
demo_gest = [g["id"] for g in allg
             if (g["descripcion"] or "").startswith("[DEMO] ")
             or g["propiedad_id"] in sp or g["gestor_id"] in su or g["tecnico_id"] in su]

tec_ids = [r["id"] for r in get("tecnicos?select=id&email=like.ausitesis%2Bdemo*")]

# ── 2) Fotos del storage (usa los UUID capturados) ──
def borrar_carpeta(bucket, pref):
    listado = req("POST", f"list/{bucket}", {"prefix": f"{pref}/", "limit": 100}, base="storage/v1/object")
    archivos = [f"{pref}/{o['name']}" for o in listado if o.get("id")]
    if archivos:
        req("DELETE", bucket, {"prefixes": archivos}, base="storage/v1/object")
        return len(archivos)
    return 0
fotos = 0
for g in demo_gest: fotos += borrar_carpeta("gestiones", g)
for t in tec_ids:   fotos += borrar_carpeta("documentacion-tecnicos", t)
print(f"  ✔ fotos borradas: {fotos}")

def in_list(col, ids): return f"{col}=in.(%s)" % ",".join(ids)

# ── 3) Emails (FK SET NULL → borrar explícito) ──
if demo_gest: delete("emails_enviados?" + in_list("gestion_id", demo_gest))
delete("emails_enviados?para=like.ausitesis%2Bdemo*")

# ── 4) Inbox: demo por marcador; desvincular refs demo en reportes reales ──
delete("inbox_reportes?gmail_message_id=like.demo-*")
if demo_users: req("PATCH", "inbox_reportes?" + in_list("procesado_por", demo_users), {"procesado_por": None})
if demo_gest:  req("PATCH", "inbox_reportes?" + in_list("gestion_id", demo_gest), {"gestion_id": None})

# ── 5) Notificaciones de gestiones demo (no cascadean por gestión) ──
if demo_gest: delete("notificaciones?" + in_list("gestion_id", demo_gest))

# ── 6) Gestiones demo (cascade: eventos, presupuestos, avances, conformidades,
#       calificaciones y notificaciones asociadas) ──
if demo_gest: delete("gestiones?" + in_list("id", demo_gest))

# ── 7) Personas demo: auth.users vía Admin API (cascade a usuarios/tecnicos/
#       tecnico_especialidades/franjas/notificaciones) ──
auth_demo = [u["id"] for u in req("GET", "admin/users?per_page=200", base="auth/v1")["users"]
             if (u.get("email") or "").startswith("ausitesis+demo")]
for uid in auth_demo:
    req("DELETE", f"admin/users/{uid}", base="auth/v1")

# ── 8) Cartera demo ──
if demo_props: delete("legajos?" + in_list("propiedad_id", demo_props))
if demo_inq:   delete("legajos?" + in_list("inquilino_id", demo_inq))
if demo_props: delete("propiedades?" + in_list("id", demo_props))
if demo_inq:   delete("inquilinos?" + in_list("id", demo_inq))
if demo_owner: delete("propietarios?" + in_list("id", demo_owner))

# ── Verificación ──
def n(path): return len(get(path))
print("  ── verificación (demo debe dar 0) ──")
print(f"    gestiones demo:    {sum(1 for g in get('gestiones?select=descripcion') if (g['descripcion'] or '').startswith('[DEMO] '))}")
print(f"    usuarios demo:     {n('usuarios?select=id&email=like.ausitesis%2Bdemo*')}")
print(f"    tecnicos demo:     {n('tecnicos?select=id&email=like.ausitesis%2Bdemo*')}")
print(f"    propietarios demo: {n('propietarios?select=id&email=like.ausitesis%2Bdemo*')}")
print(f"    inbox demo:        {n('inbox_reportes?select=id&gmail_message_id=like.demo-*')}")
print("  ── reales (no deben cambiar) ──")
print(f"    gestiones reales:  {sum(1 for g in get('gestiones?select=descripcion') if not (g['descripcion'] or '').startswith('[DEMO] '))}")
print(f"    usuarios reales:   {n('usuarios?select=id&email=not.like.ausitesis%2Bdemo*')}")
print(f"    tecnicos reales:   {n('tecnicos?select=id&email=not.like.ausitesis%2Bdemo*')}")
PY

echo "✅ Carga demo revertida — base y storage como antes de demo-seed.sql."
