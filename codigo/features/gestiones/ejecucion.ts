// STORY-966: duración de la ÚLTIMA visita completa a en_ejecucion, derivada
// de los eventos de transición. Con desasignación de técnico una gestión puede
// pasar dos veces por la misma etapa — la última visita es la del técnico que
// terminó (retroceso total: lo anterior se rehizo), y evita el doble conteo
// que inflaba cuellos/ciclo/plazo. Módulo puro: lo usan el panel de métricas
// (client) y las stats del picker (server).

export interface TransicionEjecucion {
  aEtapa: string | null;
  deEtapa: string | null;
  t: number; // epoch ms
}

// Devuelve días de la última entrada→salida completa de en_ejecucion, o null.
export function ultimaEjecucionDias(
  transiciones: TransicionEjecucion[]
): number | null {
  const evs = [...transiciones].sort((a, b) => a.t - b.t);
  let entrada: number | null = null;
  let duracion: number | null = null;
  for (const e of evs) {
    if (e.aEtapa === "en_ejecucion") entrada = e.t;
    if (e.deEtapa === "en_ejecucion" && entrada != null && e.t > entrada) {
      duracion = (e.t - entrada) / 86400000;
      entrada = null;
    }
  }
  return duracion;
}

// STORY-1024: eventos de pausa ("no puedo continuar" / resuelto) en epoch ms.
// Una pausa abre con tecnico_no_continua y cierra con aviso_resuelto O con la
// siguiente transición del funnel (avanzar_etapa limpia la marca al pasar).
export interface EventoPausa {
  tipo: "inicio" | "fin"; // tecnico_no_continua | aviso_resuelto
  t: number; // epoch ms
}

// Milisegundos pausados dentro de [entrada, salida]. Cada inicio cierra con el
// primer cierre posterior (fin explícito o transición); si no hay, con salida.
function msPausado(
  entrada: number,
  salida: number,
  pausas: EventoPausa[],
  transiciones: TransicionEjecucion[]
): number {
  const cierres = [
    ...pausas.filter((p) => p.tipo === "fin").map((p) => p.t),
    ...transiciones.map((t) => t.t),
  ].sort((a, b) => a - b);
  let total = 0;
  let cursor = entrada; // evita doble conteo si dos pausas quedaran solapadas
  for (const p of pausas.filter((p) => p.tipo === "inicio").sort((a, b) => a.t - b.t)) {
    const fin = cierres.find((c) => c > p.t) ?? salida;
    const desde = Math.max(p.t, cursor);
    const hasta = Math.min(fin, salida);
    if (hasta > desde) {
      total += hasta - desde;
      cursor = hasta;
    }
  }
  return total;
}

// STORY-984: días de ejecución PARA la métrica de cumplimiento de plazo.
// Solo cuenta la obra realmente terminada (salida a conformidad — cancelar o
// desasignar en plena ejecución no es cumplir el plazo; allowlist porque la
// cancelación con cargo sale a facturacion_cobro, no a cancelada) y con piso
// de 1 día: el plazo comprometido nunca puede ser menor a 1 (min del form),
// así que una obra de horas cumple, no "se adelanta un 98%". El ciclo sigue
// usando ultimaEjecucionDias — necesita la fracción real de obra.
// STORY-1024: descuenta las pausas dentro del span — el tiempo que la gestión
// esperó una decisión del gestor no es plazo del técnico.
export function ejecucionParaPlazoDias(
  transiciones: TransicionEjecucion[],
  pausas: EventoPausa[] = []
): number | null {
  const evs = [...transiciones].sort((a, b) => a.t - b.t);
  let entrada: number | null = null;
  let span: { entrada: number; salida: number } | null = null;
  for (const e of evs) {
    if (e.aEtapa === "en_ejecucion") entrada = e.t;
    if (e.deEtapa === "en_ejecucion" && entrada != null && e.t > entrada) {
      if (e.aEtapa === "conformidad") span = { entrada, salida: e.t };
      entrada = null;
    }
  }
  if (span == null) return null;
  const pausado = msPausado(span.entrada, span.salida, pausas, evs);
  return Math.max(1, (span.salida - span.entrada - pausado) / 86400000);
}
