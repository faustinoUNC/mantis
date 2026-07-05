import { cn } from "@/shared/utils/cn";

type Tono = "mantis" | "senal" | "alerta" | "neutro";

const tonos: Record<Tono, string> = {
  mantis: "bg-mantis-100 text-mantis-700 border-mantis-300",
  senal: "bg-senal-100 text-senal-600 border-senal-400/60",
  alerta: "bg-alerta-100 text-alerta-600 border-alerta-600/40",
  neutro: "bg-papel-2 text-neutral-600 border-neutral-400/50",
};

// Estilo "etiqueta estampada": mono, uppercase, borde visible.
export function Badge({
  tono = "neutro",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tono?: Tono }) {
  return (
    <span
      className={cn(
        "etiqueta inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] border",
        tonos[tono],
        className
      )}
      {...props}
    />
  );
}
