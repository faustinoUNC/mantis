"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Barra de filtros de un listado (STORY-910): búsqueda + slot `extra` para
// controles propios de la pantalla (p. ej. gestor y orden en el tablero).
// Con `campos` (STORY-927) suma el selector "Buscar por" — "Todo" por defecto.
export function FiltrosLista({
  consulta,
  onConsulta,
  placeholder = "Escribí para filtrar…",
  campos,
  campo,
  onCampo,
  extra,
}: {
  consulta: string;
  onConsulta: (v: string) => void;
  placeholder?: string;
  campos?: { id: string; label: string }[];
  campo?: string;
  onCampo?: (v: string) => void;
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
      {campos && campos.length > 1 && onCampo && (
        <div className="w-44">
          <Select label="Buscar por" value={campo} onChange={(e) => onCampo(e.target.value)}>
            <option value="todo">Todo</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {extra}
    </div>
  );
}
