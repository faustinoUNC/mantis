import { useState } from "react";

// Paginación client-side sobre un array ya filtrado (STORY-910).
// Devuelve la porción de la página actual + las props listas para <Paginador>.
// Si la lista se achica (por un filtro), la página se clampa a un valor válido.
export function usePaginado<T>(items: T[], porPagina = 12) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const actual = Math.min(pagina, totalPaginas);
  const inicio = (actual - 1) * porPagina;
  const pageItems = items.slice(inicio, inicio + porPagina);

  return {
    pagina: actual,
    setPagina,
    pageItems,
    paginadorProps: {
      pagina: actual,
      totalPaginas,
      total: items.length,
      desde: items.length === 0 ? 0 : inicio + 1,
      hasta: Math.min(inicio + porPagina, items.length),
      onAnterior: () => setPagina((p) => Math.max(1, p - 1)),
      onSiguiente: () => setPagina((p) => Math.min(totalPaginas, p + 1)),
    },
  };
}
