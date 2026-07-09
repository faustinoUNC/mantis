// CUIL/CUIT: 11 dígitos con dígito verificador (mod 11). El DNI son los
// dígitos 3–10, por eso alcanza con pedir solo el CUIL.

const COEFICIENTES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Deja solo los dígitos (acepta "20-30123456-7" o "20301234567"). */
export function normalizarCuil(valor: string): string {
  return valor.replace(/\D/g, "");
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
