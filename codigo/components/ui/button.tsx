import { cn } from "@/shared/utils/cn";

type Variante = "primario" | "secundario" | "fantasma";

const estilos: Record<Variante, string> = {
  primario:
    "bg-mantis-600 text-papel hover:bg-mantis-700 active:translate-y-px shadow-papel",
  secundario:
    "bg-transparent text-tinta border border-tinta/25 hover:border-tinta/60 hover:bg-papel-2 active:translate-y-px",
  fantasma: "bg-transparent text-mantis-600 hover:bg-mantis-50",
};

export function Button({
  variante = "primario",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 min-h-tap px-5",
        "rounded-caja font-semibold text-[0.9375rem]",
        "transition-[background-color,border-color,transform] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senal-400",
        "disabled:opacity-45 disabled:pointer-events-none",
        estilos[variante],
        className
      )}
      {...props}
    />
  );
}
