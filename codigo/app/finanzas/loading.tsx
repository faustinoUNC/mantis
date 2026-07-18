import { Skeleton, SkeletonHeader } from "@/components/ui/skeleton";

// STORY-993: esqueleto del layout final de Finanzas (no spinner). Encabezado +
// stat cards + tabla.
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-lg border border-border p-4" aria-hidden>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-lg border border-border overflow-hidden" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-0">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
