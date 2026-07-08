// Helpers de filtrado client-side para los listados (STORY-910).

// Minúsculas y sin acentos, para buscar sin depender de tildes.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ¿La consulta aparece en alguno de los campos? Consulta vacía → todo pasa.
export function coincideTexto(
  consulta: string,
  ...campos: (string | null | undefined)[]
): boolean {
  const q = normalizar(consulta.trim());
  if (!q) return true;
  return campos.some((c) => !!c && normalizar(c).includes(q));
}

// Rango inclusivo sobre la parte YYYY-MM-DD de una fecha ISO.
// Extremos vacíos = sin límite por ese lado.
export function enRangoFecha(
  fechaISO: string,
  desde: string,
  hasta: string
): boolean {
  const dia = fechaISO.slice(0, 10);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}
