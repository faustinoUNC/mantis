// STORY-985: estado y costo de una obra PARA EL CLIENTE (propietario/gestor
// leyendo el historial), derivados en UN solo lugar y compartidos por la vista
// de la propiedad y el PDF "Resumen de obras". Módulo puro — sin 'use server'.

export type EstadoObra = "terminada" | "en_curso" | "cancelada";

export const ESTADO_OBRA_LABEL: Record<EstadoObra, string> = {
  terminada: "Terminada",
  en_curso: "En curso",
  cancelada: "Cancelada",
};

// La obra está terminada cuando la conformidad se aprobó (etapas de plata en
// adelante) — el funnel completo es asunto interno. La cancelación con cargo
// transita por Cobro, por eso `cargo_cancelacion` decide antes que la etapa
// (allowlist, lección de la STORY-984).
export function estadoObra(
  etapa: string,
  cargoCancelacion: number | null
): EstadoObra {
  if (etapa === "cancelada" || cargoCancelacion != null) return "cancelada";
  if (["facturacion_cobro", "liquidacion_tecnico", "finalizado"].includes(etapa)) {
    return "terminada";
  }
  return "en_curso";
}

// El costo que ve el cliente es lo COBRADO (fee adentro, STORY-942) — el mismo
// número de su nota de cobro. Fallbacks: costo final + cargo admin (aún sin
// cobro registrado) y el cargo de cancelación (cancelada con cargo sin cobrar).
export function costoObra(g: {
  cobrado_monto: number | null;
  costo_final: number | null;
  cargo_admin: number | null;
  cargo_cancelacion: number | null;
}): number | null {
  if (g.cobrado_monto != null) return Number(g.cobrado_monto);
  if (g.costo_final != null) return Number(g.costo_final) + Number(g.cargo_admin ?? 0);
  if (g.cargo_cancelacion != null) return Number(g.cargo_cancelacion);
  return null;
}

// STORY-1031: cuánto de una obra pagó cada parte — con pago compartido el
// costo se reparte por el % anclado (mismo redondeo que la nota: centavos,
// el propietario absorbe el resto); con pagador único va entero a un balde.
export function parteObra(
  o: { costo: number | null; pagador: string | null; pagador_pct_inquilino: number | null },
  parte: "inquilino" | "propietario"
): number {
  if (o.costo == null) return 0;
  if (o.pagador === parte) return o.costo;
  if (o.pagador === "compartido") {
    const inquilino = Math.round(o.costo * (o.pagador_pct_inquilino ?? 50)) / 100;
    return parte === "inquilino" ? inquilino : o.costo - inquilino;
  }
  return 0;
}

export interface ObraHistorial {
  id: string;
  legajo_id: string | null;
  estado: EstadoObra;
  con_cargo: boolean; // cancelada con cargo: cuenta en la plata
  trabajo: string | null; // qué se hizo (presupuesto aprobado)
  problema: string; // qué se reportó (descripción original)
  especialidad: string;
  tecnico: string | null;
  costo: number | null;
  pagador: string | null;
  // STORY-1031: % del inquilino cuando pagador = "compartido"
  pagador_pct_inquilino: number | null;
  reportada_en: string; // ISO
  terminada_en: string | null; // ISO — última salida de obra a Conformidad
}

export interface CapituloHistorial {
  tipo: "legajo" | "desocupada";
  legajo_id: string | null;
  titulo: string; // nombre del inquilino o "Propiedad sin ocupar"
  desde: string | null; // fecha (YYYY-MM-DD)
  hasta: string | null; // null = vigente / hasta hoy
  vigente: boolean;
  obras: ObraHistorial[];
}

// La línea de tiempo de la propiedad: los legajos son los capítulos y las
// obras sin legajo caen en el hueco "sin ocupar" que les toca por fecha.
// Devuelve del más reciente al más viejo; capítulos "sin ocupar" solo si
// tienen obras (los de legajo quedan aunque estén vacíos: son historia y
// llevan los botones del PDF).
export function armarCapitulos(
  legajos: {
    id: string;
    inquilino_nombre: string;
    fecha_inicio: string;
    fecha_fin: string | null;
  }[],
  obras: ObraHistorial[]
): CapituloHistorial[] {
  const orden = [...legajos].sort((a, b) =>
    a.fecha_inicio.localeCompare(b.fecha_inicio)
  );
  const porLegajo = new Map<string, CapituloHistorial>();
  // Huecos: -1 = antes del primer legajo; i = después del legajo i (índice asc).
  const huecos = new Map<number, ObraHistorial[]>();

  const capituloLegajo = (l: (typeof orden)[number]): CapituloHistorial => ({
    tipo: "legajo",
    legajo_id: l.id,
    titulo: l.inquilino_nombre,
    desde: l.fecha_inicio,
    hasta: l.fecha_fin,
    vigente: l.fecha_fin === null,
    obras: [],
  });
  orden.forEach((l) => porLegajo.set(l.id, capituloLegajo(l)));

  for (const o of obras) {
    if (o.legajo_id && porLegajo.has(o.legajo_id)) {
      porLegajo.get(o.legajo_id)!.obras.push(o);
      continue;
    }
    const fecha = o.reportada_en.slice(0, 10);
    let slot = -1;
    for (let i = 0; i < orden.length; i++) {
      if (orden[i].fecha_inicio <= fecha) slot = i;
    }
    const lista = huecos.get(slot) ?? [];
    lista.push(o);
    huecos.set(slot, lista);
  }

  const capituloHueco = (slot: number): CapituloHistorial => ({
    tipo: "desocupada",
    legajo_id: null,
    titulo: "Propiedad sin ocupar",
    desde: slot >= 0 ? orden[slot].fecha_fin : null,
    hasta: orden[slot + 1]?.fecha_inicio ?? null,
    vigente: false,
    obras: huecos.get(slot)!,
  });

  const capitulos: CapituloHistorial[] = [];
  if (huecos.has(-1)) capitulos.push(capituloHueco(-1));
  orden.forEach((l, i) => {
    capitulos.push(porLegajo.get(l.id)!);
    if (huecos.has(i)) capitulos.push(capituloHueco(i));
  });

  const clave = (o: ObraHistorial) => o.terminada_en ?? o.reportada_en;
  capitulos.forEach((c) =>
    c.obras.sort((a, b) => clave(b).localeCompare(clave(a)))
  );
  return capitulos.reverse();
}
