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
