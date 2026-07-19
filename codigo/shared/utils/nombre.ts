// Nombre de persona (propietario, inquilino, empleado, técnico): solo letras,
// espacios, guiones y apóstrofes — nada de números (Regla #0: validación en
// la app, sin constraint en DB; mismo criterio que teléfono/CUIL).

const SOLO_LETRAS = /^[A-Za-zÀ-ÖØ-öø-ÿ'´\s-]+$/;

/**
 * Mensaje de error para mostrar al usuario, o null si el nombre es válido.
 * Distingue "tiene números" de "tiene otros símbolos" porque el primer caso
 * es el que más confunde al usuario (parece un nombre válido a simple vista).
 */
export function errorNombre(valor: string, etiqueta = "nombre"): string | null {
  const nombre = valor.trim();
  if (nombre.length === 0) {
    return `Ingresá el ${etiqueta}.`;
  }
  if (/\d/.test(nombre)) {
    return `El ${etiqueta} no puede tener números.`;
  }
  if (!SOLO_LETRAS.test(nombre)) {
    return `El ${etiqueta} solo puede tener letras, espacios, guiones y apóstrofes.`;
  }
  return null;
}
