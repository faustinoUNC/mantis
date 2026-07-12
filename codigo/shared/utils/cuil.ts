// CUIL/CUIT: 11 dígitos con dígito verificador (mod 11). El DNI son los
// dígitos 3–10, por eso alcanza con pedir solo el CUIL.

const COEFICIENTES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Deja solo los dígitos (acepta "20-30123456-7" o "20301234567"). */
export function normalizarCuil(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Mensaje de error para mostrar al usuario, o null si el CUIL es válido.
 * Distingue el problema de cantidad de dígitos del de verificador, porque
 * "no es válido (11 dígitos)" confunde cuando los 11 dígitos están pero el
 * número no existe.
 */
export function errorCuil(valor: string, etiqueta = "CUIL"): string | null {
  const cuil = normalizarCuil(valor);
  if (cuil.length === 0) {
    return `Ingresá el ${etiqueta} en números.`;
  }
  if (cuil.length !== 11) {
    return `El ${etiqueta} debe tener 11 números (contamos ${cuil.length}, sin guiones ni puntos).`;
  }
  if (!cuilValido(cuil)) {
    return `El ${etiqueta} no es correcto: el último número es un dígito verificador que no corresponde a los 10 anteriores. Revisá que esté bien tipeado.`;
  }
  return null;
}

export function cuilValido(valor: string): boolean {
  const cuil = normalizarCuil(valor);
  if (!/^\d{11}$/.test(cuil)) return false;
  const suma = COEFICIENTES.reduce(
    (acc, coef, i) => acc + coef * Number(cuil[i]),
    0
  );
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(cuil[10]);
}
