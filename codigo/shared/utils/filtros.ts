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
