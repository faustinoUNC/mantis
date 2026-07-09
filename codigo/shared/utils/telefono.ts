// Teléfono: solo dígitos, sin formato impuesto (Regla #0 — la validación
// vive en la app, sin constraint en DB; mismo criterio que el CUIL).

/** Deja solo los dígitos (acepta "351-6602217" o "351 660 2217"). */
export function normalizarTelefono(valor: string): string {
  return valor.replace(/\D/g, "");
}
