// Teléfono: solo dígitos, sin formato impuesto (Regla #0 — la validación
// vive en la app, sin constraint en DB; mismo criterio que el CUIL).

/** Deja solo los dígitos (acepta "351-6602217" o "351 660 2217"). */
export function normalizarTelefono(valor: string): string {
  return valor.replace(/\D/g, "");
}

const MIN_DIGITOS = 6;
const MAX_DIGITOS = 14;

/**
 * Mensaje de error para mostrar al usuario, o null si el teléfono es válido.
 * Rango 6–14 dígitos: cubre fijos y celulares locales/internacionales sin
 * imponer un formato específico.
 */
export function errorTelefono(valor: string, etiqueta = "teléfono"): string | null {
  const telefono = normalizarTelefono(valor);
  if (telefono.length === 0) {
    return `Ingresá el ${etiqueta} en números.`;
  }
  if (telefono.length < MIN_DIGITOS || telefono.length > MAX_DIGITOS) {
    return `El ${etiqueta} debe tener entre ${MIN_DIGITOS} y ${MAX_DIGITOS} números (contamos ${telefono.length}).`;
  }
  return null;
}
