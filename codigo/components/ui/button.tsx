import { cn } from "@/shared/utils/cn";

type Variante = "primario" | "secundario" | "fantasma";

const estilos: Record<Variante, string> = {
  primario: "bg-brand text-white hover:bg-brand-hover",
  secundario:
    "bg-surface text-foreground border border-border-strong hover:bg-surface-2",
  fantasma: "bg-transparent text-muted hover:bg-surface-2 hover:text-foreground",
};

export function Button({
  variante = "primario",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 min-h-tap px-4",
        "rounded-md font-medium text-[0.9375rem]",
        "transition-colors duration-150 active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:opacity-45 disabled:pointer-events-none",
        estilos[variante],
        className
      )}
      {...props}
    />
  );
}
