#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# MANTIS 2 — RESET LIVIANO (probar de cero SIN re-registrar nada)
#
# Borra SOLO lo operativo: gestiones (+ eventos, presupuestos,
#   avances, conformidades por cascade), inbox, notificaciones,
#   log de emails y las fotos del bucket "gestiones".
# CONSERVA: usuarios, técnicos, cartera (propiedades/propietarios/
#   inquilinos/legajos), especialidades y toda la config.
#
# ¿Querés vaciar TODO (usuarios, técnicos y cartera incluidos)?
#   → usá ./scripts/reset-total.sh
#
# Uso:  ./scripts/reset-datos.sh
# Lee la service key de codigo/.env.local — no requiere psql.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://ejwokycbyjtlxwusbhtt.supabase.co"
SK="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$DIR/codigo/.env.local" | cut -d= -f2)"

if [ -z "$SK" ]; then
  echo "✖ No encontré SUPABASE_SERVICE_ROLE_KEY en codigo/.env.local" >&2
  exit 1
fi

api() { # api <tabla> — borra todas las filas vía REST (service role bypasea RLS)
  curl -s -X DELETE "$URL/rest/v1/$1?id=not.is.null" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" \
    -H "Prefer: count=exact" -o /dev/null -w "%{http_code}"
}

echo "→ Borrando datos operativos…"
for tabla in inbox_reportes gestiones notificaciones emails_enviados; do
  code="$(api "$tabla")"
  if [ "$code" = "204" ] || [ "$code" = "200" ]; then
    echo "  ✔ $tabla"
  else
    echo "  ✖ $tabla (HTTP $code)" >&2
    exit 1
  fi
done

echo "→ Limpiando fotos del bucket gestiones…"
carpetas="$(curl -s "$URL/storage/v1/object/list/gestiones" -X POST \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
  -d '{"prefix":"","limit":100}' | python3 -c "import json,sys; print(' '.join(o['name'] for o in json.load(sys.stdin)))")"

for carpeta in $carpetas; do
  archivos="$(curl -s "$URL/storage/v1/object/list/gestiones" -X POST \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$carpeta/\",\"limit\":100}" \
    | python3 -c "import json,sys; print(json.dumps(['$carpeta/'+o['name'] for o in json.load(sys.stdin) if o.get('id')]))")"
  if [ "$archivos" != "[]" ]; then
    curl -s -X DELETE "$URL/storage/v1/object/gestiones" \
      -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
      -d "{\"prefixes\": $archivos}" > /dev/null
    echo "  ✔ fotos de $carpeta"
  fi
done

echo "→ Verificación:"
restantes="$(curl -s "$URL/rest/v1/gestiones?select=id" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")"
echo "  gestiones restantes: $restantes"
echo "✅ Base limpia — usuarios, cartera, técnicos y config intactos."
