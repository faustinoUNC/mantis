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

// Campo elegible del selector "Buscar por" (STORY-927): cada pantalla declara
// los suyos y `de` extrae los valores del ítem donde buscar.
export type CampoBusqueda<T> = {
  id: string;
  label: string;
  de: (x: T) => (string | null | undefined)[];
};

// Como coincideTexto, pero acotado al campo elegido ("todo" = todos).
export function coincideCampo<T>(
  consulta: string,
  campo: string,
  campos: CampoBusqueda<T>[],
  x: T
): boolean {
  const activos = campo === "todo" ? campos : campos.filter((c) => c.id === campo);
  return coincideTexto(consulta, ...activos.flatMap((c) => c.de(x)));
}
