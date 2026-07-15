import type { SupabaseClient } from "@supabase/supabase-js";

type TablaPersona = "tecnicos" | "propietarios" | "inquilinos";
type CampoDuplicable = "email" | "cuil" | "telefono";

const ETIQUETA: Record<CampoDuplicable, string> = {
  email: "email",
  cuil: "CUIL/CUIT",
  telefono: "teléfono",
};

const NOMBRE_TABLA: Record<TablaPersona, string> = {
  tecnicos: "técnico",
  propietarios: "propietario",
  inquilinos: "inquilino",
};

// Unicidad por tipo (técnicos entre sí, propietarios entre sí, inquilinos
// entre sí) — NO cruzada entre tablas. Chequeo previo al insert/update para
// dar un mensaje en español antes de pegar contra el índice UNIQUE de la
// migración correspondiente (que es la garantía real ante altas concurrentes).
// Se chequean LOS TRES campos y el mensaje nombra todos los repetidos, para
// que el usuario corrija todo de una y no descubra el siguiente al reintentar.
export async function duplicadoPersona(
  supabase: SupabaseClient,
  tabla: TablaPersona,
  datos: { email?: string | null; cuil?: string | null; telefono?: string | null },
  excluirId?: string
): Promise<string | null> {
  const campos = (["email", "cuil", "telefono"] as const).filter((c) => datos[c]);
  const resultados = await Promise.all(
    campos.map((campo) => {
      let query = supabase.from(tabla).select("id").eq(campo, datos[campo]!).limit(1);
      if (excluirId) query = query.neq("id", excluirId);
      return query;
    })
  );
  const repetidos = campos.filter((_, i) => (resultados[i].data?.length ?? 0) > 0);
  if (repetidos.length === 0) return null;
  const lista = repetidos.map((c) => `ese ${ETIQUETA[c]}`);
  const detalle =
    lista.length > 1
      ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`
      : lista[0];
  return `Ya hay un ${NOMBRE_TABLA[tabla]} registrado con ${detalle}.`;
}

// Mensaje de fallback si un alta concurrente coló un duplicado entre el
// chequeo previo y el insert — lo atrapa el índice UNIQUE (código 23505).
export const ERROR_DUPLICADO_DB =
  "Ese email, CUIL o teléfono ya está en uso — revisá los datos.";

const normalizarNombre = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

// STORY-963: el CUIL identifica a una persona — no puede pertenecer a dos
// personas DISTINTAS entre propietarios e inquilinos. Pero una MISMA persona
// sí puede ser propietaria de un inmueble e inquilina de otro. Por eso el
// bloqueo es "inteligente": choca solo si el CUIL ya existe en la otra tabla
// con OTRO nombre (otra persona); si el nombre coincide, es la misma persona
// en su otro rol y se permite. `duplicadoPersona` sigue cubriendo la unicidad
// intra-tabla; esto agrega la dimensión cruzada que las tablas separadas no dan.
export async function cuilCruzadoOtraPersona(
  supabase: SupabaseClient,
  tablaActual: "propietarios" | "inquilinos",
  cuil: string | null | undefined,
  nombre: string,
  excluirId?: string
): Promise<string | null> {
  if (!cuil) return null;
  const otraTabla = tablaActual === "propietarios" ? "inquilinos" : "propietarios";
  let query = supabase.from(otraTabla).select("id, nombre").eq("cuil", cuil).limit(1);
  if (excluirId) query = query.neq("id", excluirId);
  const { data } = await query;
  const existente = data?.[0] as { id: string; nombre: string } | undefined;
  if (!existente) return null;
  if (normalizarNombre(existente.nombre) === normalizarNombre(nombre)) return null;
  return `Ese CUIL ya pertenece a ${existente.nombre} (registrado como ${NOMBRE_TABLA[otraTabla]}). Un CUIL no puede ser de dos personas distintas.`;
}
