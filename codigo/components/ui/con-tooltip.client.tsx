"use client";

// Tooltip estético del sistema (STORY-996/997): cajita bg-foreground que
// aparece al hacer hover sobre el contenido. Reemplaza el title nativo.
// Posiciones: "arriba" (izq), "abajo" (centrado), "abajo-der".
export function ConTooltip({
  children,
  ayuda,
  pos = "arriba",
  className = "",
}: {
  children: React.ReactNode;
  ayuda: string;
  pos?: "arriba" | "abajo" | "abajo-der";
  className?: string;
}) {
  const posCls =
    pos === "arriba"
      ? "bottom-full left-0 mb-1.5"
      : pos === "abajo-der"
        ? "top-full right-0 mt-1.5"
        : "top-full left-1/2 -translate-x-1/2 mt-1.5";
  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        className={`pointer-events-none absolute z-50 w-max max-w-[220px] rounded-md bg-foreground px-2.5 py-1.5 text-[11px] font-normal leading-snug text-background opacity-0 shadow-overlay transition-opacity duration-150 group-hover/tt:opacity-100 ${posCls}`}
      >
        {ayuda}
      </span>
    </span>
  );
}
