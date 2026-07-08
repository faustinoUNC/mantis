"use client";

import { Button } from "@/components/ui/button";

// Paginador presentacional (STORY-910). No se muestra si todo entra en una página.
export function Paginador({
  pagina,
  totalPaginas,
  total,
  desde,
  hasta,
  onAnterior,
  onSiguiente,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  desde: number;
  hasta: number;
  onAnterior: () => void;
  onSiguiente: () => void;
}) {
  if (total === 0 || totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <p className="text-[13px] text-muted">
        <span className="font-medium text-foreground tabular-nums">
          {desde}–{hasta}
        </span>{" "}
        de <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variante="secundario"
          className="min-h-0 h-9 px-3 text-sm"
          disabled={pagina <= 1}
          onClick={onAnterior}
        >
          Anterior
        </Button>
        <span className="text-[13px] text-muted tabular-nums px-1">
          {pagina}/{totalPaginas}
        </span>
        <Button
          variante="secundario"
          className="min-h-0 h-9 px-3 text-sm"
          disabled={pagina >= totalPaginas}
          onClick={onSiguiente}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
