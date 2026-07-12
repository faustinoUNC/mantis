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
export async function duplicadoPersona(
  supabase: SupabaseClient,
  tabla: TablaPersona,
  datos: { email?: string | null; cuil?: string | null; telefono?: string | null },
  excluirId?: string
): Promise<string | null> {
  for (const campo of ["email", "cuil", "telefono"] as const) {
    const valor = datos[campo];
    if (!valor) continue;
    let query = supabase.from(tabla).select("id").eq(campo, valor).limit(1);
    if (excluirId) query = query.neq("id", excluirId);
    const { data } = await query;
    if (data && data.length > 0) {
      return `Ya hay un ${NOMBRE_TABLA[tabla]} registrado con ese ${ETIQUETA[campo]}.`;
    }
  }
  return null;
}

// Mensaje de fallback si un alta concurrente coló un duplicado entre el
// chequeo previo y el insert — lo atrapa el índice UNIQUE (código 23505).
export const ERROR_DUPLICADO_DB =
  "Ese email, CUIL o teléfono ya está en uso — revisá los datos.";
