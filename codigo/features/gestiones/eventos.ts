// STORY-974: labels y lectura humana de eventos_gestion en UN solo lugar.
// Actividad (detalle.client.tsx) y Auditoría (auditoria.client.tsx) tenían
// cada una su copia y ya habían divergido (tecnico_no_continua, imputado y
// cargo se veían en una pantalla y no en la otra). Archivo client-safe: sin
// "use server".

import {
  MEDIO_COBRO_LABEL,
  MEDIO_LIQUIDACION_LABEL,
} from "@/features/finanzas/medios";
import { ETAPAS } from "@/features/gestiones/types";

export const LABEL_EVENTO: Record<string, string> = {
  creada: "Gestión creada",
  transicion: "Cambio de etapa",
  asignacion_solicitada: "Asignación enviada al técnico",
  asignacion_aceptada: "El técnico aceptó el trabajo",
  asignacion_rechazada: "El técnico rechazó la asignación",
  asignacion_cancelada: "Solicitud de asignación cancelada por el gestor",
  presupuesto_enviado: "Presupuesto enviado",
  presupuesto_aprobado: "Presupuesto aprobado",
  presupuesto_rechazado: "Presupuesto rechazado",
  presupuesto_enviado_pagador: "Presupuesto enviado por email al pagador",
  // STORY-1017: ampliación de presupuesto a mitad de obra
  ampliacion_solicitada: "Ampliación de presupuesto solicitada",
  ampliacion_enviada_pagador: "Ampliación enviada por email al pagador",
  ampliacion_aprobada: "Ampliación de presupuesto autorizada",
  ampliacion_rechazada: "Ampliación de presupuesto rechazada",
  conformidad_aprobada: "Conformidad aprobada",
  conformidad_rechazada: "Conformidad rechazada",
  materiales_rendidos: "Comprobantes de materiales rendidos",
  adelanto_materiales_registrado: "Adelanto de materiales registrado",
  // STORY-1019: cierre manual de un adelanto "a resolver"
  adelanto_saldado: "Adelanto saldado con el técnico",
  tecnico_no_continua: "El técnico avisó que no puede continuar",
  aviso_resuelto: "El gestor resolvió el aviso — el técnico continúa",
  gestor_reasignado: "Gestor reasignado",
  nota_cobro_enviada: "Nota de cobro enviada",
  cobro_registrado: "Cobro registrado",
  liquidacion_registrada: "Liquidación registrada",
  archivada: "Gestión archivada",
  desarchivada: "Gestión desarchivada",
};

export function etiquetaEtapa(id: string | null) {
  if (id === "cancelada") return "Cancelada"; // terminal fuera del stepper
  return ETAPAS.find((e) => e.id === id)?.label ?? id ?? "";
}

// STORY-973: labels de cobro y liquidación en un solo mapa (las claves
// compartidas, ej. "efectivo", tienen el mismo label en ambos).
const MEDIO_LABEL: Record<string, string> = {
  ...MEDIO_LIQUIDACION_LABEL,
  ...MEDIO_COBRO_LABEL,
};

// Datos pertinentes del evento, legibles ("Técnico: X · Total: $ Y")
export function detalleLegible(detalle: Record<string, unknown> | null): string | null {
  if (!detalle) return null;
  const plataD = (v: unknown) => `$ ${Number(v).toLocaleString("es-AR")}`;
  const partes: string[] = [];
  if (detalle.tecnico) partes.push(`Técnico: ${detalle.tecnico}`);
  if (detalle.nuevo_gestor) partes.push(`Nuevo gestor: ${detalle.nuevo_gestor}`);
  if (detalle.total != null) partes.push(`Total: ${plataD(detalle.total)}`);
  if (detalle.costo_final != null) partes.push(`Costo final: ${plataD(detalle.costo_final)}`);
  if (detalle.monto != null) partes.push(`Monto: ${plataD(detalle.monto)}`);
  // STORY-977 v1.1: si el adelanto de materiales superó lo debido al
  // liquidar, queda documentado como sobrante en el evento.
  if (detalle.sobrante != null) partes.push(`Sobrante: ${plataD(detalle.sobrante)}`);
  // STORY-1032: deudas de otras gestiones retenidas de esta liquidación —
  // el técnico también lo ve (se le aclara qué se descontó de su pago).
  if (Array.isArray(detalle.deudas_descontadas) && detalle.deudas_descontadas.length > 0) {
    const ds = detalle.deudas_descontadas as { descripcion?: unknown; monto?: unknown }[];
    partes.push(
      `Descontado por adelantos pendientes: ${ds
        .map((d) => `${plataD(d.monto ?? 0)} de «${String(d.descripcion ?? "otra gestión")}»`)
        .join(" · ")}`
    );
  }
  // STORY-1018: adelanto confirmado por encima del techo autorizado de
  // materiales — la Auditoría responde "quién autorizó dar de más".
  if (detalle.excedente_tope != null)
    partes.push(`Excedió lo autorizado en ${plataD(detalle.excedente_tope)}`);
  // STORY-1019: el saldado manual dice de dónde venía la plata y cómo se
  // arregló (la nota es la constancia).
  if (detalle.origen === "desasignacion") partes.push("Origen: desasignación");
  if (detalle.origen === "cancelacion") partes.push("Origen: cancelación");
  if (detalle.origen === "sobrante") partes.push("Origen: sobrante de liquidación");
  if (detalle.nota) partes.push(String(detalle.nota));
  if (detalle.plazo_dias != null) partes.push(`Plazo: ${detalle.plazo_dias} día${Number(detalle.plazo_dias) === 1 ? "" : "s"}`);
  // STORY-1031: el pago compartido se cuenta con su reparto.
  if (detalle.pagador) {
    partes.push(
      detalle.pagador === "compartido" && detalle.pct_inquilino != null
        ? `Paga: compartido (inquilino ${detalle.pct_inquilino}% / propietario ${100 - Number(detalle.pct_inquilino)}%)`
        : `Paga: ${detalle.pagador}`
    );
  }
  // STORY-1036: cobro por parte de un pago compartido — quién pagó este cobro.
  if (detalle.parte === "inquilino" || detalle.parte === "propietario")
    partes.push(`Pagó: ${detalle.parte}`);
  if (detalle.medio) partes.push(`Medio: ${MEDIO_LABEL[String(detalle.medio)] ?? detalle.medio}`);
  // STORY-973: el cobro combinado (STORY-950) se cuenta completo.
  if (detalle.medio2) {
    const label = MEDIO_LABEL[String(detalle.medio2)] ?? detalle.medio2;
    partes.push(
      detalle.monto2 != null ? `2º medio: ${label} (${plataD(detalle.monto2)})` : `2º medio: ${label}`
    );
  }
  if (detalle.factura_ref) partes.push(`Factura: ${detalle.factura_ref}`);
  if (detalle.para) partes.push(`Para: ${detalle.para}`);
  // STORY-967: el cargo de la cancelación, con nombre propio.
  if (detalle.cargo != null) partes.push(`Cargo: ${plataD(detalle.cargo)}`);
  // STORY-966: la desasignación imputada al técnico se dice con todas las
  // letras, y el saliente queda nombrado (STORY-974 — estaba congelado en el
  // evento y no se mostraba). El evento guarda el UUID; nombrarSalientes()
  // lo traduce server-side — si quedó sin resolver, el id crudo no aporta.
  if (detalle.imputado === "tecnico") partes.push("Abandonada por el técnico");
  if (detalle.tecnico_saliente && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(String(detalle.tecnico_saliente)))
    partes.push(`Saliente: ${detalle.tecnico_saliente}`);
  // STORY-1014: la plata en la mano del saliente queda dicha con todas las
  // letras (congelada al desasignar; la columna viva se resetea).
  if (detalle.adelanto_saliente != null)
    partes.push(`Adelanto al saliente: ${plataD(detalle.adelanto_saliente)}`);
  if (detalle.devolucion_adelanto != null)
    partes.push(`Devuelto/ajustado en el acto: ${plataD(detalle.devolucion_adelanto)}`);
  if (detalle.motivo && detalle.motivo !== "reasignar") partes.push(String(detalle.motivo));
  return partes.length ? partes.join(" · ") : null;
}
