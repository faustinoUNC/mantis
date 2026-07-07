#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# MANTIS 2 — RESET TOTAL (vaciar la base para arrancar de cero)
#
# Borra TODO menos lo imprescindible: gestiones y su historial,
#   inbox, notificaciones, emails, técnicos, cartera (propiedades/
#   propietarios/inquilinos/legajos), TODOS los usuarios menos Admin
#   (fila en `usuarios` + login en `auth`) y las fotos de los buckets.
# CONSERVA: el usuario Admin, las especialidades y matriz_notificaciones.
#
# ⚠️  Irreversible. Tras correrlo hay que RE-REGISTRAR gestores/técnicos.
#     Para un reset suave que conserva usuarios/cartera → reset-datos.sh
#
# Uso:  ./scripts/reset-total.sh
# Lee la service key de codigo/.env.local — no requiere psql.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://ejwokycbyjtlxwusbhtt.supabase.co"
SK="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$DIR/codigo/.env.local" | cut -d= -f2)"
ADMIN_EMAIL="ausitesis+admin@gmail.com"

if [ -z "$SK" ]; then
  echo "✖ No encontré SUPABASE_SERVICE_ROLE_KEY en codigo/.env.local" >&2
  exit 1
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

echo "→ Borrando tablas (orden por FK RESTRICT)…"
# gestiones cascadea a avances/conformidades/eventos/notificaciones/presupuestos
del gestiones
del notificaciones
del inbox_reportes
del emails_enviados
# tecnicos cascadea a tecnico_especialidades y franjas_disponibilidad
del tecnicos
# cartera: legajos → propiedades/inquilinos → propietarios
del legajos
del propiedades
del inquilinos
del propietarios
# usuarios: todos menos admin (eventos/inbox/gestiones ya borrados)
del usuarios "rol=neq.administrador"

echo "→ Borrando logins de auth (todos menos Admin)…"
ids="$(curl -s "$URL/auth/v1/admin/users?per_page=1000" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  | python3 -c "import json,sys; print(' '.join(u['id'] for u in json.load(sys.stdin)['users'] if u['email']!='$ADMIN_EMAIL'))")"
for id in $ids; do
  curl -s -X DELETE "$URL/auth/v1/admin/users/$id" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK" -o /dev/null
  echo "  ✔ auth user $id"
done

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

echo "✅ Base vacía — quedan solo Admin, especialidades y config. Re-registrá gestores/técnicos para probar."
