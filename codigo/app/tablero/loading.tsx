import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

// STORY-993: esqueleto del layout final del tablero (no spinner). El sidebar lo
// mantiene el layout; acá va solo el contenido: encabezado, filtros y columnas.
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="flex flex-wrap gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-44" />
        ))}
      </div>
      <div className="flex gap-3 overflow-x-hidden">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} lineas={2} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
