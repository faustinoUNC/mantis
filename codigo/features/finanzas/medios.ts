// Medios de pago (STORY-946/950). Viven fuera de service.ts porque un archivo
// "use server" solo puede exportar funciones async — exportar estas constantes
// desde ahí rompe el render con "found object" (fix STORY-950).

// STORY-950: métodos de pago para el cobro al pagador (lista cerrada, sin
// configurabilidad — Regla #0). Se puede combinar como máximo 2 (medio +
// medio2): cubre el caso real "mitad efectivo, mitad transferencia" sin la
// complejidad de N medios arbitrarios.
export const MEDIOS_COBRO = [
  "efectivo",
  "transferencia",
  "tarjeta_credito",
  "otro",
] as const;
export type MedioCobro = (typeof MEDIOS_COBRO)[number];

export const MEDIO_COBRO_LABEL: Record<MedioCobro, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_credito: "Tarjeta de crédito",
  otro: "Otro",
};

// STORY-946: métodos de pago para liquidar al técnico (lista cerrada, sin
// configurabilidad — Regla #0).
export const MEDIOS_LIQUIDACION = [
  "efectivo",
  "credito",
  "debito",
  "transferencia",
  "cheque",
  "pagare",
  "otros",
] as const;
export type MedioLiquidacion = (typeof MEDIOS_LIQUIDACION)[number];

export const MEDIO_LIQUIDACION_LABEL: Record<MedioLiquidacion, string> = {
  efectivo: "Efectivo",
  credito: "Crédito",
  debito: "Débito",
  transferencia: "Transferencia",
  cheque: "Cheque",
  pagare: "Pagaré",
  otros: "Otros",
};
