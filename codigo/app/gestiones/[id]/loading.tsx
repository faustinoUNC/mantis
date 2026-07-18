import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// STORY-993: esqueleto del layout final del detalle de gestión (no spinner) — el
// salto más visible del sistema (se abre desde tablero/mis-trabajos).
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-4 w-28" />
      <div>
        <Skeleton className="h-7 w-2/3 max-w-md" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <SkeletonCard lineas={3} />
      <SkeletonCard lineas={4} />
    </div>
  );
}
