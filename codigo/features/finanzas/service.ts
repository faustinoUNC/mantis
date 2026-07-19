"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { enviarEmailDocumento } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { avanzarEtapa } from "@/features/gestiones/service";
import type { Pagador } from "@/features/gestiones/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import {
  MEDIO_LIQUIDACION_LABEL,
  MEDIOS_COBRO,
  MEDIOS_LIQUIDACION,
  type MedioCobro,
  type MedioLiquidacion,
} from "./medios";
import { generarPDF, type DatosDocumento } from "./pdf";

const BUCKET = "gestiones";
const MAX_COMPROBANTE_BYTES = 8 * 1024 * 1024;
// STORY-986: comprobante de pago real que la administración sube al liquidar
// — PDF (transferencia) o imagen (foto del recibo firmado).
const MIME_COMPROBANTE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function exigirAdministrativo() {
  const actual = await obtenerUsuarioActual();
  if (
    actual?.rol !== "administrador" &&
    actual?.rol !== "gestor_administrativo"
  ) {
    return null;
  }
  return actual;
}

// Rol + ownership: el gestor de mantenimiento solo opera SUS gestiones
// (PRD §2.1) — el resto del service usa admin client y no pasa por RLS.
async function exigirMantenimiento(gestionId: string) {
  const actual = await obtenerUsuarioActual();
  if (
    actual?.rol !== "administrador" &&
    actual?.rol !== "gestor_mantenimiento"
  ) {
    return null;
  }
  if (actual.rol === "gestor_mantenimiento") {
    const admin = createAdminClient();
    const { data } = await admin
      .from("gestiones")
      .select("gestor_id")
      .eq("id", gestionId)
      .single();
    if (data?.gestor_id !== actual.id) return null;
  }
  return actual;
}

// Arma los datos del documento. Admin client tras verificar rol: cruza
// legajo/inquilino/propietario que el rol administrativo no siempre lee.
// Los overrides permiten previsualizar con lo tipeado SIN escribir en la DB.
async function datosDocumento(
  gestionId: string,
  tipo: "nota" | "detalle" | "presupuesto",
  overrides?: { cargoAdmin?: number; pagador?: Pagador }
): Promise<
  | { datos: DatosDocumento; emailDestinatario: string | null }
  | null
> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select(
      "id, numero, descripcion, pagador, costo_final, cargo_admin, cargo_cancelacion, materiales_total, adelanto_materiales, liq_monto, liq_factura_ref, liq_medio, liq_pagada_en, legajo_id, creado_en, propiedades(direccion, propietarios(nombre, email)), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre, email), presupuestos(monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, creado_en)"
    )
    .eq("id", gestionId)
    .single();
  if (!g) return null;

  type Joined = {
    propiedades: {
      direccion: string;
      propietarios: { nombre: string; email: string } | null;
    } | null;
    especialidades: { nombre: string } | null;
    tecnico: { nombre: string; email: string } | null;
    presupuestos: {
      monto_materiales: number;
      monto_mano_obra: number;
      descripcion_trabajo: string | null;
      plazo_dias: number | null;
      notas: string | null;
      estado: string;
      creado_en: string;
    }[];
  };
  const j = g as unknown as Joined;
  const aprobado = j.presupuestos.find((p) => p.estado === "aprobado");
  // STORY-934: en nota y detalle la línea de materiales usa la RENDICIÓN
  // real del técnico (fallback: lo presupuestado, para gestiones viejas).
  const materialesRendidos = g.materiales_total != null;
  // Para el PDF de presupuesto: el vigente (aprobado, o el último enviado)
  const vigente =
    aprobado ??
    [...j.presupuestos]
      .filter((p) => p.estado === "enviado")
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0] ??
    null;

  let destinatarioNombre = "—";
  let destinatarioRotulo = "Destinatario";
  let emailDestinatario: string | null = null;

  // Nota y presupuesto van al PAGADOR elegido en pantalla o confirmado.
  // STORY-943: ya no hay "sugerido" — sin elección explícita no hay
  // destinatario (los flujos lo validan antes de llegar acá).
  const pagador = overrides?.pagador ?? g.pagador ?? null;
  if (tipo === "detalle") {
    destinatarioNombre = j.tecnico?.nombre ?? "—";
    destinatarioRotulo = "Técnico";
    emailDestinatario = j.tecnico?.email ?? null;
  } else if (pagador === "propietario") {
    destinatarioNombre = j.propiedades?.propietarios?.nombre ?? "—";
    destinatarioRotulo = "Propietario";
    emailDestinatario = j.propiedades?.propietarios?.email ?? null;
  } else if (pagador === "inquilino" && g.legajo_id) {
    const { data: legajo } = await admin
      .from("legajos")
      .select("fecha_fin, inquilinos(nombre, email)")
      .eq("id", g.legajo_id)
      .single();
    // STORY-962: si el legajo está cerrado el inquilino ya no habita — el
    // documento cae al propietario (defensa por si una pestaña vieja llega acá).
    const inq =
      legajo && legajo.fecha_fin == null
        ? (legajo.inquilinos as unknown as { nombre: string; email: string } | null)
        : null;
    if (inq) {
      destinatarioNombre = inq.nombre ?? "—";
      destinatarioRotulo = "Inquilino";
      emailDestinatario = inq.email ?? null;
    } else {
      destinatarioNombre = j.propiedades?.propietarios?.nombre ?? "—";
      destinatarioRotulo = "Propietario";
      emailDestinatario = j.propiedades?.propietarios?.email ?? null;
    }
  }

  const cargoAdmin = Number(overrides?.cargoAdmin ?? g.cargo_admin ?? 0);
  // STORY-972: la nota de una cancelación con cargo cobra SOLO el cargo —
  // sin desglose de obra (no hubo obra terminada que facturar).
  const esCancelacion = tipo === "nota" && g.cargo_cancelacion != null;
  // El fee de la inmobiliaria viaja al PAGADOR: entra al presupuesto (lo
  // aprueba sabiendo el total real) y a la nota. Nunca al detalle del técnico.
  const total = esCancelacion
    ? Number(g.cargo_cancelacion)
    : tipo === "presupuesto"
      ? Number(vigente?.monto_materiales ?? 0) +
        Number(vigente?.monto_mano_obra ?? 0) +
        cargoAdmin
      : tipo === "detalle"
        ? Number(g.liq_monto ?? g.costo_final ?? 0)
        : Number(g.costo_final ?? 0) + cargoAdmin;

  return {
    emailDestinatario,
    datos: {
      tipo,
      // STORY-1009: el documento lleva el mismo número visible de la gestión
      numero: String(g.numero),
      // Detalle: la fecha del documento es la del pago real (no la de
      // regeneración/descarga), para que valga como constancia del pago.
      fecha:
        tipo === "detalle" && g.liq_pagada_en
          ? new Date(g.liq_pagada_en).toLocaleDateString("es-AR")
          : new Date().toLocaleDateString("es-AR"),
      destinatarioNombre,
      destinatarioRotulo,
      direccion: j.propiedades?.direccion ?? "—",
      especialidad: j.especialidades?.nombre ?? "—",
      descripcion: g.descripcion,
      detalleTrabajo: esCancelacion
        ? "Cargo por cancelación acordado con la administración."
        : tipo === "presupuesto"
          ? [vigente?.descripcion_trabajo, vigente?.notas].filter(Boolean).join(" — ") || null
          : aprobado?.descripcion_trabajo ?? aprobado?.notas ?? null,
      tecnicoNombre: esCancelacion ? null : j.tecnico?.nombre ?? null,
      presupuesto: !esCancelacion && (tipo === "presupuesto" ? vigente : aprobado)
        ? {
            materiales:
              tipo === "presupuesto"
                ? Number(vigente!.monto_materiales)
                : Number(g.materiales_total ?? aprobado!.monto_materiales),
            manoObra: Number((tipo === "presupuesto" ? vigente : aprobado)!.monto_mano_obra),
          }
        : null,
      total,
      facturaRef: tipo === "presupuesto" || esCancelacion ? null : g.liq_factura_ref,
      cancelacion: esCancelacion,
      medioPago:
        tipo === "detalle" && g.liq_medio
          ? MEDIO_LIQUIDACION_LABEL[g.liq_medio as MedioLiquidacion]
          : null,
      plazoDias: tipo === "presupuesto" ? vigente?.plazo_dias ?? null : null,
      materialesRendidos: tipo !== "presupuesto" && materialesRendidos,
      // STORY-977: el adelanto es un ajuste entre inmobiliaria↔técnico — solo
      // se muestra en el detalle del técnico, nunca en la nota al pagador.
      adelantoMateriales:
        tipo === "detalle" ? Number(g.adelanto_materiales ?? 0) : null,
    },
  };
}

async function registrarEvento(
  gestionId: string,
  tipo: string,
  actorId: string,
  detalle?: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase
    .from("eventos_gestion")
    .insert({ gestion_id: gestionId, tipo, actor_id: actorId, detalle: detalle ?? null });
}

function cargoInvalido(cargoAdmin?: number) {
  return cargoAdmin != null && (!Number.isFinite(cargoAdmin) || cargoAdmin < 0);
}

// STORY-943: el pagador del presupuesto se elige explícitamente (no hay más
// sugerido) y "inquilino" solo vale si la gestión tiene legajo.
async function errorPagador(
  gestionId: string,
  pagador?: Pagador
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select("pagador, legajo_id, legajos(fecha_fin)")
    .eq("id", gestionId)
    .single();
  const efectivo = pagador ?? g?.pagador ?? null;
  if (!efectivo) return "Elegí quién paga la obra.";
  // STORY-962: "inquilino" solo si el legajo sigue vigente (fecha_fin null);
  // un legajo cerrado = el inquilino se fue → paga el propietario.
  const legajoVigente =
    g?.legajo_id != null &&
    (g.legajos as unknown as { fecha_fin: string | null } | null)?.fecha_fin == null;
  if (efectivo === "inquilino" && !legajoVigente) {
    return "La propiedad no tiene inquilino vigente — el pago solo puede ser del propietario.";
  }
  return null;
}

// Solo las acciones REALES (enviar/emitir) persisten el fee — la vista
// previa nunca escribe en la base.
async function guardarCargoAdmin(gestionId: string, cargoAdmin?: number) {
  if (cargoAdmin == null) return;
  const admin = createAdminClient();
  await admin.from("gestiones").update({ cargo_admin: cargoAdmin }).eq("id", gestionId);
}

// STORY-934: la nota usa SIEMPRE el fee anclado en la aprobación del
// presupuesto — en facturación ya no se corrige (doctrina "fee fijo").
export async function emitirNotaCobro(gestionId: string): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(gestionId, "nota");
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "La gestión no tiene costo final." };
  if (!doc.emailDestinatario) {
    return { ok: false, error: "El pagador no tiene email cargado." };
  }

  const pdf = await generarPDF(doc.datos);
  await enviarEmailDocumento({
    para: doc.emailDestinatario,
    destinatario: doc.datos.destinatarioNombre,
    asunto: doc.datos.cancelacion
      ? `Cargo por cancelación — ${doc.datos.direccion}`
      : `Nota de cobro — ${doc.datos.direccion}`,
    titulo: doc.datos.cancelacion
      ? "Nota de cobro por cancelación del trabajo"
      : "Nota de cobro por trabajo de mantenimiento",
    cuerpo: doc.datos.cancelacion
      ? `Te enviamos el detalle del cargo por la cancelación del trabajo en ${doc.datos.direccion}. El documento adjunto tiene el importe acordado.`
      : `Te enviamos el detalle del trabajo realizado en ${doc.datos.direccion}. El documento adjunto tiene el desglose completo.`,
    tipo: "nota_cobro",
    gestion_id: gestionId,
    adjuntos: [
      {
        filename: `nota-cobro-${doc.datos.numero}.pdf`,
        contentBase64: pdf,
      },
    ],
  });

  const supabase = await createClient();
  const { error: errorMarca } = await supabase
    .from("gestiones")
    .update({ nota_emitida_en: new Date().toISOString() })
    .eq("id", gestionId);
  if (errorMarca) {
    // El email ya salió: no fallar, pero dejar rastro (evita reenvíos a ciegas)
    console.error("emitirNotaCobro: no se pudo marcar nota_emitida_en", errorMarca);
  }
  await registrarEvento(gestionId, "nota_cobro_enviada", actual.id, {
    total: doc.datos.total,
    para: doc.datos.destinatarioRotulo.toLowerCase(),
  });

  return { ok: true };
}

export interface DocumentoGenerado {
  base64: string;
  filename: string;
  destinatario: { nombre: string; rotulo: string; email: string | null };
}

export async function descargarDocumento(
  gestionId: string,
  tipo: "nota" | "detalle"
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(gestionId, tipo);
  if (!doc) return { ok: false, error: "Gestión no encontrada." };

  const base64 = await generarPDF(doc.datos);
  return {
    ok: true,
    data: {
      base64,
      filename: `${tipo === "nota" ? "nota-cobro" : "detalle-liquidacion"}-${doc.datos.numero}.pdf`,
      destinatario: {
        nombre: doc.datos.destinatarioNombre,
        rotulo: doc.datos.destinatarioRotulo,
        email: doc.emailDestinatario,
      },
    },
  };
}

// PDF/email del presupuesto en su etapa (staff de mantenimiento).
export async function descargarPresupuestoPDF(
  gestionId: string,
  opciones?: { cargoAdmin?: number; pagador?: Pagador }
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirMantenimiento(gestionId);
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (cargoInvalido(opciones?.cargoAdmin)) {
    return { ok: false, error: "El cargo administrativo no puede ser negativo." };
  }
  const errPagador = await errorPagador(gestionId, opciones?.pagador);
  if (errPagador) return { ok: false, error: errPagador };

  // Vista previa pura: fee y pagador tipeados viajan como override
  const doc = await datosDocumento(gestionId, "presupuesto", opciones);
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "No hay presupuesto cargado." };

  const base64 = await generarPDF(doc.datos);
  return {
    ok: true,
    data: {
      base64,
      filename: `presupuesto-${doc.datos.numero}.pdf`,
      destinatario: {
        nombre: doc.datos.destinatarioNombre,
        rotulo: doc.datos.destinatarioRotulo,
        email: doc.emailDestinatario,
      },
    },
  };
}

export async function enviarPresupuestoEmail(
  gestionId: string,
  cargoAdmin?: number,
  pagador?: Pagador
): Promise<ActionResult> {
  const actual = await exigirMantenimiento(gestionId);
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (cargoInvalido(cargoAdmin)) {
    return { ok: false, error: "El cargo administrativo no puede ser negativo." };
  }
  const errPagador = await errorPagador(gestionId, pagador);
  if (errPagador) return { ok: false, error: errPagador };

  // Enviar SÍ persiste: el pagador elegido y el fee quedan anclados a lo
  // que realmente se mandó (el email debe ir a quien se ve en pantalla)
  await guardarCargoAdmin(gestionId, cargoAdmin);
  if (pagador) {
    const admin = createAdminClient();
    await admin.from("gestiones").update({ pagador }).eq("id", gestionId);
  }
  const doc = await datosDocumento(gestionId, "presupuesto", { cargoAdmin, pagador });
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "No hay presupuesto cargado." };
  if (!doc.emailDestinatario) {
    return { ok: false, error: "El destinatario no tiene email cargado." };
  }

  const pdf = await generarPDF(doc.datos);
  await enviarEmailDocumento({
    para: doc.emailDestinatario,
    destinatario: doc.datos.destinatarioNombre,
    asunto: `Presupuesto de obra — ${doc.datos.direccion}`,
    titulo: "Presupuesto por trabajo de mantenimiento",
    cuerpo: `Te enviamos el presupuesto por el trabajo a realizar en ${doc.datos.direccion}. El documento adjunto tiene el detalle completo.`,
    tipo: "presupuesto",
    gestion_id: gestionId,
    adjuntos: [
      {
        filename: `presupuesto-${doc.datos.numero}.pdf`,
        contentBase64: pdf,
      },
    ],
  });

  // STORY-935: marca persistida del envío — habilita "Aprobar y ejecutar"
  // (sobrevive al refresh; el reenvío solo actualiza la fecha).
  const admin = createAdminClient();
  await admin
    .from("gestiones")
    .update({ presupuesto_enviado_en: new Date().toISOString() })
    .eq("id", gestionId);

  const supabase = await createClient();
  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "presupuesto_enviado_pagador",
    actor_id: actual.id,
    detalle: {
      total: doc.datos.total,
      para: doc.datos.destinatarioRotulo.toLowerCase(),
    },
  });

  return { ok: true };
}

// STORY-950: permite combinar hasta 2 medios de pago (ej. mitad efectivo,
// mitad transferencia) en vez de forzar un único medio para el 100%. El
// monto del segundo medio lo tipea la administración; el del primero es el
// resto (se calcula acá, nunca confiando en lo que mande el cliente).
export async function registrarCobro(
  gestionId: string,
  datos: {
    medio: MedioCobro;
    medio2?: MedioCobro;
    monto2?: number;
    recargoPct?: number;
  }
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (!MEDIOS_COBRO.includes(datos.medio)) {
    return { ok: false, error: "Indicá el medio de cobro." };
  }

  const supabase = await createClient();
  // STORY-914: congelar el monto facturado y el fee del momento del cobro.
  // Las métricas históricas leen de estos snapshots, así una corrección
  // posterior de costo_final/cargo_admin no reescribe el pasado.
  const { data: g } = await supabase
    .from("gestiones")
    .select("costo_final, cargo_admin, cargo_cancelacion")
    .eq("id", gestionId)
    .single();
  // STORY-967: una cancelación con cargo se cobra por este mismo circuito —
  // el total es el cargo y es 100% de la casa (no hay técnico que liquidar).
  const cargoCancelacion =
    g?.cargo_cancelacion == null ? null : Number(g.cargo_cancelacion);
  const costoFinal = Number(g?.costo_final ?? 0);
  const cargoAdmin = cargoCancelacion ?? Number(g?.cargo_admin ?? 0);
  const total = cargoCancelacion ?? costoFinal + cargoAdmin;

  let medioCobro2: string | null = null;
  let montoCobro2: number | null = null;
  if (datos.medio2) {
    if (!MEDIOS_COBRO.includes(datos.medio2)) {
      return { ok: false, error: "Indicá el segundo medio de cobro." };
    }
    if (datos.medio2 === datos.medio) {
      return { ok: false, error: "Elegí dos medios de pago distintos para combinar." };
    }
    const monto2 = Number(datos.monto2);
    if (!Number.isFinite(monto2) || monto2 <= 0) {
      return { ok: false, error: "Ingresá el monto del segundo medio." };
    }
    if (monto2 >= total) {
      return {
        ok: false,
        error: `El monto del segundo medio no puede ser mayor o igual al total a cobrar ($ ${total.toLocaleString("es-AR")}).`,
      };
    }
    medioCobro2 = datos.medio2;
    montoCobro2 = monto2;
  }

  // STORY-975: recargo por tarjeta de crédito — lo tipea la administración en
  // el momento del cobro (varía según financiera/promo del día, no es un %
  // fijo) y se calcula SOLO sobre la porción que efectivamente se paga con
  // tarjeta (relevante en un cobro combinado). Nunca se confía en un monto
  // calculado del lado del cliente: acá se recalcula desde cero.
  const montoTarjeta =
    datos.medio === "tarjeta_credito"
      ? total - (montoCobro2 ?? 0)
      : medioCobro2 === "tarjeta_credito"
        ? (montoCobro2 ?? 0)
        : 0;
  let recargoPct: number | null = null;
  let recargoMonto: number | null = null;
  if (montoTarjeta > 0 && datos.recargoPct) {
    const pct = Number(datos.recargoPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return {
        ok: false,
        error: "El recargo por tarjeta tiene que ser un porcentaje entre 0 y 100.",
      };
    }
    if (pct > 0) {
      recargoPct = pct;
      recargoMonto = Math.round(montoTarjeta * pct) / 100;
    }
  }
  const totalFinal = total + (recargoMonto ?? 0);

  const { error } = await supabase
    .from("gestiones")
    .update({
      cobrado_en: new Date().toISOString(),
      medio_cobro: datos.medio,
      medio_cobro_2: medioCobro2,
      cobrado_monto: totalFinal,
      cobrado_monto_2: montoCobro2,
      cobrado_fee: cargoAdmin,
      recargo_tarjeta_pct: recargoPct,
      recargo_tarjeta_monto: recargoMonto,
    })
    .eq("id", gestionId);
  if (error) {
    console.error("registrarCobro: update falló", error);
    return { ok: false, error: "No se pudo registrar el cobro." };
  }

  // STORY-973: el total viaja en el evento — la Actividad cuenta el cobro
  // completo (cuánto y con qué medios) sin leer campos de la gestión.
  await registrarEvento(gestionId, "cobro_registrado", actual.id, {
    medio: datos.medio,
    medio2: medioCobro2,
    monto2: montoCobro2,
    recargoPct,
    recargoMonto,
    total: totalFinal,
  });
  // STORY-967: el cobro de una cancelación cierra la gestión en `cancelada`
  // (no hay nada que liquidarle al técnico — se salta esa etapa).
  if (cargoCancelacion != null) {
    return avanzarEtapa(gestionId, "cancelada", {
      motivo: "Cargo por cancelación cobrado",
    });
  }
  return avanzarEtapa(gestionId, "liquidacion_tecnico");
}

// STORY-977: adelanto de materiales al técnico ANTES de rendir la obra — un
// solo campo (no una tabla de entregas: revive STORY-933, descartada por
// complejidad, con el diseño más simple posible).
// v1.1: cada carga SUMA al total ya adelantado (permite más de un adelanto)
// y ya no hay tope contra el presupuesto — puede terminar superando lo
// debido al técnico; ese excedente se muestra como "sobrante" al liquidar.
// v1.2: solo se puede adelantar en ejecución (antes de rendir la obra) — ya
// no en conformidad ni en liquidación técnico, guard server-side además de
// sacarlo de esas pantallas.
// STORY-1002: cada adelanto exige su comprobante (recibo firmado por el
// técnico o constancia de transferencia) — se valida y sube ANTES de tocar
// la fila, y el path queda en el detalle del evento del adelanto.
export async function registrarAdelantoMateriales(
  gestionId: string,
  formData: FormData
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  const monto = Number(formData.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "Ingresá un monto válido." };
  }
  const comprobante = formData.get("comprobante");
  if (!(comprobante instanceof File) || comprobante.size === 0) {
    return { ok: false, error: "Adjuntá el comprobante del adelanto (recibo firmado o transferencia)." };
  }
  const ext = MIME_COMPROBANTE[comprobante.type];
  if (!ext) {
    return { ok: false, error: "El comprobante tiene que ser un PDF o una imagen (JPG, PNG o WEBP)." };
  }
  if (comprobante.size > MAX_COMPROBANTE_BYTES) {
    return { ok: false, error: "El comprobante no puede superar los 8 MB." };
  }

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("gestiones")
    .select("etapa, adelanto_materiales")
    .eq("id", gestionId)
    .single();
  type Fila = {
    etapa: string;
    adelanto_materiales: number | null;
  };
  const fila = g as unknown as Fila | null;
  if (!fila || fila.etapa !== "en_ejecucion") {
    return { ok: false, error: "El adelanto solo se puede cargar en ejecución." };
  }
  const total = Number(fila.adelanto_materiales ?? 0) + monto;

  const path = `${gestionId}/adelanto-comprobante-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await comprobante.arrayBuffer()), {
      contentType: comprobante.type,
    });
  if (upErr) return { ok: false, error: "No se pudo subir el comprobante. Probá de nuevo." };

  const { error } = await supabase
    .from("gestiones")
    .update({ adelanto_materiales: total })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo guardar el adelanto." };

  await registrarEvento(gestionId, "adelanto_materiales_registrado", actual.id, { monto, total, comprobante_path: path });
  revalidatePath(`/gestiones/${gestionId}`);
  return { ok: true };
}

// STORY-946: la administración ya no tipea el monto — lo calcula el sistema
// (mismo criterio que el sugerido de STORY-934: materiales rendidos + mano
// de obra presupuestada, con fallback a costo_final para gestiones viejas
// sin rendición). La administración solo confirma el medio de pago.
export async function registrarLiquidacion(
  gestionId: string,
  formData: FormData
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  const medio = String(formData.get("medio")) as MedioLiquidacion;
  if (!MEDIOS_LIQUIDACION.includes(medio)) {
    return { ok: false, error: "Indicá el método de pago." };
  }

  // STORY-986: comprobante de pago real, opcional. Se valida y sube ANTES de
  // registrar la liquidación — si el archivo es inválido no se liquida a medias.
  let comprobantePath: string | null = null;
  let comprobanteExt: string | null = null;
  let comprobanteBytes: Buffer | null = null;
  const comprobante = formData.get("comprobante");
  if (comprobante instanceof File && comprobante.size > 0) {
    const ext = MIME_COMPROBANTE[comprobante.type];
    if (!ext) {
      return { ok: false, error: "El comprobante tiene que ser un PDF o una imagen (JPG, PNG o WEBP)." };
    }
    if (comprobante.size > MAX_COMPROBANTE_BYTES) {
      return { ok: false, error: "El comprobante no puede superar los 8 MB." };
    }
    comprobanteBytes = Buffer.from(await comprobante.arrayBuffer());
    comprobanteExt = ext;
    const path = `${gestionId}/comprobante-pago-${Date.now()}.${ext}`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, comprobanteBytes, { contentType: comprobante.type });
    if (upErr) return { ok: false, error: "No se pudo subir el comprobante. Probá de nuevo." };
    comprobantePath = path;
  }

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("gestiones")
    .select("costo_final, materiales_total, adelanto_materiales, presupuestos(monto_mano_obra, estado)")
    .eq("id", gestionId)
    .single();
  type Fila = {
    costo_final: number | null;
    materiales_total: number | null;
    adelanto_materiales: number | null;
    presupuestos: { monto_mano_obra: number; estado: string }[];
  };
  const fila = g as unknown as Fila | null;
  const aprobado = fila?.presupuestos.find((p) => p.estado === "aprobado");
  const manoObra = aprobado ? Number(aprobado.monto_mano_obra) : 0;
  // STORY-964: el técnico rinde el total real de la obra,
  // así que no se suman aparte. Fallback a costo_final para gestiones viejas.
  const base =
    fila?.materiales_total != null
      ? Number(fila.materiales_total) + manoObra
      : Number(fila?.costo_final ?? 0);
  if (!base || base <= 0) {
    return { ok: false, error: "No se pudo calcular el monto a liquidar." };
  }
  // STORY-977: la plata ya entregada como adelanto se resta acá — puede dar
  // $0 (adelanto cubrió todo) sin bloquear el cierre de la gestión.
  // v1.1: si el adelanto superó lo debido, el excedente queda registrado
  // como "sobrante" (no hay forma de cobrárselo al técnico automáticamente).
  const adelanto = Number(fila?.adelanto_materiales ?? 0);
  const monto = Math.max(base - adelanto, 0);
  const sobrante = Math.max(adelanto - base, 0);

  const { error } = await supabase
    .from("gestiones")
    .update({
      liq_monto: monto,
      liq_medio: medio,
      liq_pagada_en: new Date().toISOString(),
      liq_comprobante_path: comprobantePath,
    })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo registrar la liquidación." };

  const doc = await datosDocumento(gestionId, "detalle");
  if (doc?.emailDestinatario) {
    const pdf = await generarPDF(doc.datos);
    // Siempre va el detalle; si se subió un comprobante de pago, se suma como
    // segundo adjunto (STORY-986).
    const adjuntos = [
      {
        filename: `detalle-liquidacion-${doc.datos.numero}.pdf`,
        contentBase64: pdf,
      },
    ];
    if (comprobanteBytes && comprobanteExt) {
      adjuntos.push({
        filename: `comprobante-pago-${doc.datos.numero}.${comprobanteExt}`,
        contentBase64: comprobanteBytes.toString("base64"),
      });
    }
    await enviarEmailDocumento({
      para: doc.emailDestinatario,
      destinatario: doc.datos.destinatarioNombre,
      asunto: `Detalle de tu liquidación — ${doc.datos.direccion}`,
      titulo: "Liquidación de tu trabajo",
      cuerpo: comprobanteBytes
        ? `Registramos el pago por el trabajo en ${doc.datos.direccion}. Adjuntamos el detalle de la liquidación y el comprobante de pago.`
        : `Registramos el pago por el trabajo en ${doc.datos.direccion}. Adjuntamos el detalle de la liquidación.`,
      tipo: "detalle_liquidacion",
      gestion_id: gestionId,
      adjuntos,
    });
  }

  await registrarEvento(gestionId, "liquidacion_registrada", actual.id, {
    monto,
    medio,
    ...(sobrante > 0 ? { sobrante } : {}),
    ...(comprobantePath ? { comprobante: true } : {}),
  });
  return avanzarEtapa(gestionId, "finalizado");
}
