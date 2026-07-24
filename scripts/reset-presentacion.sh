#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# MANTIS 2 — RESET PARA LA PRESENTACIÓN (borrado 100% + admin único)
#
# Deja la base con UN SOLO usuario: Giuliano Vigetti (administrador).
# Borra ABSOLUTAMENTE todo lo demás:
#   · gestiones + todo su historial (eventos, presupuestos, avances,
#     conformidades, ampliaciones, calificaciones, notificaciones)
#   · inbox, emails, eventos_sistema, revisiones_fondo
#   · técnicos, cartera (propietarios/inquilinos/propiedades/legajos)
#   · TODOS los usuarios y TODOS los logins de auth
#   · TODAS las especialidades (se recrean en la fase de siembra)
#   · las fotos de los buckets `gestiones` y `documentacion-tecnicos`
# CONSERVA solo: `matriz_notificaciones` (config) y el nuevo admin.
#
# ⚠️  IRREVERSIBLE. No tiene vuelta atrás. Pensado para correr JUSTO
#     antes de empezar la carga manual de datos para la presentación.
#
# Orden de borrado validado contra las FK reales (ON DELETE RESTRICT/
# NO ACTION exigen borrar hijos antes que padres — 2026-07-24).
#
# Uso:
#   ./scripts/reset-presentacion.sh          # pide confirmación (tipear BORRAR)
#   ./scripts/reset-presentacion.sh -y       # sin prompt (para correr desde tooling)
#
# Lee la service key de codigo/.env.local — no requiere psql.
# NOTA: el reinicio de la secuencia gestiones_numero_seq (para que los
#       casos nuevos arranquen en #1) se corre aparte por SQL (ver el
#       aviso al final) — no hay endpoint REST para ALTER SEQUENCE.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://ejwokycbyjtlxwusbhtt.supabase.co"
SK="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$DIR/codigo/.env.local" | cut -d= -f2)"

# ── Nuevo admin único ──
NEW_EMAIL="ausitesis+admingiulianovigetti@gmail.com"
NEW_PASS="admingiulianovigetti123"
NEW_NAME="Giuliano Vigetti"

if [ -z "$SK" ]; then
  echo "✖ No encontré SUPABASE_SERVICE_ROLE_KEY en codigo/.env.local" >&2
  exit 1
fi

# ── Confirmación (salvo -y / --yes) ──
if [ "${1:-}" != "-y" ] && [ "${1:-}" != "--yes" ]; then
  echo "⚠️  Esto BORRA TODA la base del proyecto ejwokycbyjtlxwusbhtt (irreversible)."
  echo "   Va a quedar SOLO el admin: $NEW_EMAIL"
  read -r -p "   Escribí BORRAR para continuar: " confirm
  [ "$confirm" = "BORRAR" ] || { echo "Cancelado."; exit 1; }
fi

del() { # del <tabla> [filtro] — borra filas vía REST (service role bypasea RLS)
  local filtro="${2:-id=not.is.null}"
  local code
  code="$(curl -s -X DELETE "$URL/rest/v1/$1?$filtro" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -o /dev/null -w "%{http_code}")"
  if [ "$code" = "204" ] || [ "$code" = "200" ]; then
    echo "  ✔ $1"
  else
    echo "  ✖ $1 (HTTP $code)" >&2; exit 1
  fi
}

echo "→ Borrando tablas (orden por FK: hijos antes que padres)…"
# 1) revisiones_fondo: su actor_id → usuarios es NO ACTION (va antes que usuarios)
del revisiones_fondo
# 2) gestiones: cascadea ampliaciones/avances/calificaciones/conformidades/
#    eventos_gestion/presupuestos/notificaciones(gestion_id); anula gestion_id
#    en emails/inbox. Deja libres tecnicos/legajos/propiedades/usuarios (eran padres).
del gestiones
# 3) tablas que referencian usuarios con NO ACTION y no cascadean de gestiones
del eventos_sistema
del notificaciones          # las que quedaran sin gestion_id
del inbox_reportes          # procesado_por → usuarios (NO ACTION)
del emails_enviados
# 4) técnicos y su config (avances RESTRICT sobre tecnicos ya se fue con gestiones)
del franjas_disponibilidad
del tecnico_especialidades  # RESTRICT sobre especialidades
del tecnicos
# 5) cartera (legajos antes de inquilinos/propiedades; propiedades antes de propietarios)
del legajos
del propiedades
del inquilinos
del propietarios
# 6) usuarios (ya no queda nada que los referencie con RESTRICT/NO ACTION)
del usuarios
# 7) especialidades (gestiones y tecnico_especialidades ya borrados)
del especialidades

echo "→ Borrando TODOS los logins de auth…"
ids="$(curl -s "$URL/auth/v1/admin/users?per_page=1000" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  | python3 -c "import json,sys; print(' '.join(u['id'] for u in json.load(sys.stdin)['users']))")"
for id in $ids; do
  curl -s -X DELETE "$URL/auth/v1/admin/users/$id" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -o /dev/null
done
echo "  ✔ auth vacío"

echo "→ Limpiando fotos de los buckets…"
for bucket in gestiones documentacion-tecnicos; do
  carpetas="$(curl -s "$URL/storage/v1/object/list/$bucket" -X POST \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":1000}' \
    | python3 -c "import json,sys; print(' '.join(o['name'] for o in json.load(sys.stdin)))")"
  for carpeta in $carpetas; do
    archivos="$(curl -s "$URL/storage/v1/object/list/$bucket" -X POST \
      -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
      -d "{\"prefix\":\"$carpeta/\",\"limit\":1000}" \
      | python3 -c "import json,sys; print(json.dumps(['$carpeta/'+o['name'] for o in json.load(sys.stdin) if o.get('id')]))")"
    if [ "$archivos" != "[]" ]; then
      curl -s -X DELETE "$URL/storage/v1/object/$bucket" \
        -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
        -d "{\"prefixes\": $archivos}" > /dev/null
      echo "  ✔ $bucket/$carpeta"
    fi
  done
done

echo "→ Creando el admin único ($NEW_NAME)…"
resp="$(curl -s -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\",\"email_confirm\":true}")"
GID="$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")"
if [ -z "$GID" ]; then
  # fallback: ya existía → recuperar su id
  GID="$(curl -s "$URL/auth/v1/admin/users?per_page=1000" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" \
    | python3 -c "import json,sys; print(next((u['id'] for u in json.load(sys.stdin)['users'] if u['email']=='$NEW_EMAIL'),''))")"
fi
if [ -z "$GID" ]; then
  echo "  ✖ No pude crear ni recuperar el auth user de $NEW_EMAIL" >&2
  echo "    Respuesta: $resp" >&2; exit 1
fi

# fila en usuarios (mismo uuid que auth). Upsert por si un trigger la precreó.
code="$(curl -s -X POST "$URL/rest/v1/usuarios?on_conflict=id" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "{\"id\":\"$GID\",\"nombre\":\"$NEW_NAME\",\"email\":\"$NEW_EMAIL\",\"rol\":\"administrador\",\"esta_activo\":true}" \
  -o /dev/null -w "%{http_code}")"
if [ "$code" = "201" ] || [ "$code" = "204" ] || [ "$code" = "200" ]; then
  echo "  ✔ usuarios (Giuliano, administrador) — id $GID"
else
  echo "  ✖ usuarios (HTTP $code)" >&2; exit 1
fi

echo "→ Verificación:"
for t in usuarios gestiones tecnicos propietarios especialidades; do
  n="$(curl -s "$URL/rest/v1/$t?select=id" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Prefer: count=exact" \
    -H "Range: 0-0" -D - -o /dev/null | grep -i 'content-range' | sed 's#.*/##' | tr -d '\r')"
  printf '  %-16s %s\n' "$t" "${n:-?}"
done

echo
echo "✅ Base vaciada. Queda SOLO: $NEW_EMAIL / $NEW_PASS (administrador)."
echo "⚠️  FALTA un paso (correr por SQL, no hay REST para secuencias):"
echo "      alter sequence gestiones_numero_seq restart with 1;"
echo "    → así el primer caso nuevo será #1 y no #259."
