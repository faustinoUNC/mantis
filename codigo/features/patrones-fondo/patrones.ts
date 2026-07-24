// STORY-1051 — Patrones de fondo: la lógica pura de la bandeja "Para revisar
// de fondo". Agrupa las obras por (propiedad, especialidad), cuenta, ordena por
// severidad y aplica el ciclo de vida (ocultar/reaparecer) sobre las revisiones.
// Módulo puro (sin 'use server') → lo consume el panel client-side, como
// `historial.ts`. Toda la detección es aritmética barata sobre datos que ya
// viajan en `metricas.filas`; Walter (Fase 2) es otra capa, a demanda.

import { estadoObra } from "@/features/cartera/historial";

const MS_ANIO = 365 * 24 * 3600 * 1000;

// Una obra tal como llega desde `metricas.filas` (el subconjunto que usa la
// bandeja). `estado` se deriva de `etapa` + `cargoCancelacion` con el mismo
// `estadoObra` del historial — una sola definición de "cancelada/terminada".
export interface ObraParaPatron {
  id: string;
  numero: number; // #N corto, para citar antecedentes
  propiedadId: string;
  especialidadId: string | null;
  especialidad: string;
  direccion: string | null;
  descripcion: string;
  etapa: string;
  cargoCancelacion: number | null;
  creadoEn: string; // ISO — fecha en que se reportó la obra
}

// Una fila de la tabla `revisiones_fondo`: la marca de "ya atendí este patrón".
// El ciclo de vida se DERIVA comparando esta fecha contra la obra más nueva.
export interface RevisionFondo {
  propiedadId: string;
  especialidadId: string;
  atendidaEn: string; // ISO
  resultado: "descartada" | "gestion_iniciada";
  gestionFondoId: string | null; // la gestión que se creó, si resultado = gestion_iniciada
}

export interface ObraDelPatron {
  id: string;
  numero: number; // #N corto
  titulo: string; // descripción de la obra (link a su timeline en la UI)
  fecha: string; // ISO
}

export interface PatronFondo {
  propiedadId: string;
  especialidadId: string;
  especialidad: string;
  direccion: string;
  cantidad: number;
  obras: ObraDelPatron[]; // de la más nueva a la más vieja
  // El patrón volvió a la bandeja porque entró una obra nueva después de
  // haberlo atendido. `motivoReaparicion` explica por qué (Sally: la fila no
  // vuelve muda). El caso estrella: tras una gestión de fondo terminada = "el
  // arreglo no aguantó".
  reaparecida: boolean;
  motivoReaparicion: string | null;
}

export interface OpcionesBandeja {
  minReiteraciones: number; // filtro "sensibilidad" (≥N). Default UI: 3.
  ventanaAnios: number | null; // filtro "plazo". null = todo el histórico.
}

const clave = (propiedadId: string, especialidadId: string) =>
  `${propiedadId}::${especialidadId}`;

// La detección: candidatas = (propiedad, especialidad) con ≥ minReiteraciones
// obras NO canceladas dentro de la ventana, ordenadas peor-arriba. El ciclo de
// vida oculta las atendidas y reaparece las que sumaron una obra nueva.
//
// Orden por severidad SIN fórmula con constantes ocultas (Grumbal): más obras
// arriba; a igual cantidad, las más apretadas en el tiempo; a igual span, la
// más reciente. El orden solo RANKEA, nunca excluye — excluir es tarea de los
// dos filtros (que el usuario mueve en vivo).
export function armarPatrones(
  obras: ObraParaPatron[],
  revisiones: RevisionFondo[],
  opciones: OpcionesBandeja,
  ahora: number
): PatronFondo[] {
  // Ids de gestiones canceladas (para el borde "la gestión de fondo se canceló"
  // → la marca de atendida-vía-gestión deja de valer). Una obra cancelada
  // tampoco cuenta como reiteración ni dispara reaparición.
  const canceladas = new Set<string>();
  const terminadas = new Set<string>();
  for (const o of obras) {
    const est = estadoObra(o.etapa, o.cargoCancelacion);
    if (est === "cancelada") canceladas.add(o.id);
    else if (est === "terminada") terminadas.add(o.id);
  }

  const desde =
    opciones.ventanaAnios != null ? ahora - opciones.ventanaAnios * MS_ANIO : null;

  // La revisión vigente por (propiedad, especialidad): la de fecha más nueva
  // que sigue siendo válida (una gestión de fondo cancelada NO cuenta).
  const revisionPorClave = new Map<string, RevisionFondo>();
  for (const r of revisiones) {
    if (
      r.resultado === "gestion_iniciada" &&
      r.gestionFondoId &&
      canceladas.has(r.gestionFondoId)
    ) {
      continue; // la fondo se canceló → no atacaste nada → no oculta
    }
    const k = clave(r.propiedadId, r.especialidadId);
    const prev = revisionPorClave.get(k);
    if (!prev || r.atendidaEn > prev.atendidaEn) revisionPorClave.set(k, r);
  }

  // Agrupar obras no canceladas y dentro de la ventana.
  const grupos = new Map<string, ObraParaPatron[]>();
  for (const o of obras) {
    if (!o.especialidadId || canceladas.has(o.id)) continue;
    if (desde != null && new Date(o.creadoEn).getTime() < desde) continue;
    const k = clave(o.propiedadId, o.especialidadId);
    const lista = grupos.get(k) ?? [];
    lista.push(o);
    grupos.set(k, lista);
  }

  const patrones: PatronFondo[] = [];
  for (const [k, lista] of grupos) {
    if (lista.length < opciones.minReiteraciones) continue;

    const orden = [...lista].sort(
      (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
    );
    const newestEn = new Date(orden[0].creadoEn).getTime();

    // Ciclo de vida: ¿está atendida (oculta) o reaparece?
    const rev = revisionPorClave.get(k);
    let reaparecida = false;
    let motivoReaparicion: string | null = null;
    if (rev) {
      const atendidaMs = new Date(rev.atendidaEn).getTime();
      if (newestEn <= atendidaMs) continue; // atendida y sin novedad → oculta
      // Entró una obra nueva después de atenderla → reaparece.
      reaparecida = true;
      const fondoTerminada =
        rev.resultado === "gestion_iniciada" &&
        rev.gestionFondoId &&
        terminadas.has(rev.gestionFondoId);
      motivoReaparicion = fondoTerminada
        ? "El arreglo de fondo no aguantó: entró una obra nueva de este rubro."
        : rev.resultado === "descartada"
          ? "Descartada antes, pero entró una obra nueva de este rubro."
          : "Entró una obra nueva de este rubro desde que la atendiste.";
    }

    const primero = orden[orden.length - 1];
    patrones.push({
      propiedadId: primero.propiedadId,
      especialidadId: primero.especialidadId!,
      especialidad: primero.especialidad,
      direccion: primero.direccion ?? primero.descripcion,
      cantidad: orden.length,
      obras: orden.map((o) => ({
        id: o.id,
        numero: o.numero,
        titulo: o.descripcion,
        fecha: o.creadoEn,
      })),
      reaparecida,
      motivoReaparicion,
    });
  }

  // Peor-arriba: cantidad desc → span (más apretado) asc → más reciente primero.
  return patrones.sort((a, b) => {
    if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
    const spanA =
      new Date(a.obras[0].fecha).getTime() -
      new Date(a.obras[a.obras.length - 1].fecha).getTime();
    const spanB =
      new Date(b.obras[0].fecha).getTime() -
      new Date(b.obras[b.obras.length - 1].fecha).getTime();
    if (spanA !== spanB) return spanA - spanB;
    return new Date(b.obras[0].fecha).getTime() - new Date(a.obras[0].fecha).getTime();
  });
}
