// Concatena clases condicionales sin dependencias externas.
export function cn(...clases: Array<string | false | null | undefined>) {
  return clases.filter(Boolean).join(" ");
}
