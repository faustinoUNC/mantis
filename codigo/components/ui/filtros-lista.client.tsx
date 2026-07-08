"use client";

import { Input } from "@/components/ui/input";

// Barra de filtros de un listado (STORY-910): búsqueda + rango de fecha opcional
// + slot `extra` para controles propios de la pantalla (p. ej. filtro por gestor).
export function FiltrosLista({
  consulta,
  onConsulta,
  placeholder = "Buscar…",
  fecha,
  extra,
}: {
  consulta: string;
  onConsulta: (v: string) => void;
  placeholder?: string;
  fecha?: {
    desde: string;
    hasta: string;
    onDesde: (v: string) => void;
    onHasta: (v: string) => void;
  };
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex-1 min-w-52">
        <Input
          label="Buscar"
          placeholder={placeholder}
          value={consulta}
          onChange={(e) => onConsulta(e.target.value)}
        />
      </div>
      {extra}
      {fecha && (
        <>
          <div className="w-40">
            <Input
              label="Desde"
              type="date"
              value={fecha.desde}
              onChange={(e) => fecha.onDesde(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label="Hasta"
              type="date"
              value={fecha.hasta}
              onChange={(e) => fecha.onHasta(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}
