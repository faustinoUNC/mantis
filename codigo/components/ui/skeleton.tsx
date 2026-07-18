import { cn } from "@/shared/utils/cn";

// Bloque de carga (DESIGN.md §skeleton, STORY-993): superficie hundida con un
// pulso muy sutil. El @media prefers-reduced-motion de globals.css anula el
// pulso para quien lo pidió. NO es un spinner a pantalla completa.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden />;
}

// Card placeholder con el tratamiento del contract (surface + borde hairline).
export function SkeletonCard({
  className,
  lineas = 3,
}: {
  className?: string;
  lineas?: number;
}) {
  return (
    <div className={cn("bg-surface rounded-lg border border-border p-4", className)} aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: lineas }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === lineas - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

// Encabezado de página (título + subtítulo, patrón STORY-990) en modo carga.
export function SkeletonHeader() {
  return (
    <div className="mb-5" aria-hidden>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
    </div>
  );
}
