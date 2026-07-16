// STORY-980: labels y lectura humana de eventos_sistema en UN solo lugar
// (lección STORY-974: nunca un slug crudo en la tabla del admin). Archivo
// client-safe: sin "use server".

import { NOMBRE_ROL, type Rol } from "@/features/auth/types";

export const LABEL_EVENTO_SISTEMA: Record<string, string> = {
  empleado_creado: "Empleado creado",
  rol_cambiado: "Cambio de rol",
  empleado_desactivado: "Empleado inhabilitado",
  empleado_reactivado: "Empleado habilitado",
  contrasena_blanqueada: "Contraseña blanqueada",
  tecnico_postulado: "Técnico postulado desde el registro público",
  tecnico_alta_manual: "Técnico dado de alta por el staff",
  tecnico_aprobado: "Postulación de técnico aprobada",
  tecnico_rechazado: "Postulación de técnico rechazada",
  tecnico_inhabilitado: "Técnico inhabilitado",
  tecnico_rehabilitado: "Técnico habilitado",
};

// Datos pertinentes del evento, legibles. El afectado y su email tienen
// columna propia en la tabla; acá va el resto del snapshot congelado.
export function detalleSistemaLegible(
  detalle: Record<string, unknown> | null
): string | null {
  if (!detalle) return null;
  const rol = (v: unknown) => NOMBRE_ROL[v as Rol] ?? String(v);
  const partes: string[] = [];
  if (detalle.rol) partes.push(`Rol: ${rol(detalle.rol)}`);
  if (detalle.de && detalle.a) partes.push(`${rol(detalle.de)} → ${rol(detalle.a)}`);
  if (detalle.reintento) partes.push("Reintento tras un rechazo");
  if (detalle.motivo) partes.push(String(detalle.motivo));
  return partes.length ? partes.join(" · ") : null;
}
