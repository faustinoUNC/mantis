"use client";

import { Input } from "@/components/ui/input";

// Barra de filtros de un listado (STORY-910): búsqueda + slot `extra` para
// controles propios de la pantalla (p. ej. gestor y orden en el tablero).
export function FiltrosLista({
  consulta,
  onConsulta,
  placeholder = "Buscar…",
  extra,
}: {
  consulta: string;
  onConsulta: (v: string) => void;
  placeholder?: string;
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
    </div>
  );
}
