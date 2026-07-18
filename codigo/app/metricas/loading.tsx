import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

// STORY-993: esqueleto del layout final de Informes (no spinner). Encabezado +
// grilla de cards de gráfico.
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lineas={1} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-lg border border-border p-5" aria-hidden>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-52 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
