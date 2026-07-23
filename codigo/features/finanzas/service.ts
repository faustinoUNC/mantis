"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { enviarEmailDocumento } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { avanzarEtapa } from "@/features/gestiones/service";
import type { Pagador } from "@/features/gestiones/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import { adelantosAResolverDeTecnico } from "./consultas";
import {
  claveDeuda,
  repartoGestion,
  type AmpliacionReparto,
  type PagadorObra,
} from "./consultas-types";
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

// El adelanto lo carga el administrativo/admin (dinero es su rol, ver
// exigirAdministrativo) O el gestor de mantenimiento dueño de la gestión —
// pedido de Fausti: el gestor comercial ya está ahí en ejecución y no
// siempre está la administración a mano para adelantarle al técnico.
async function exigirAdelanto(gestionId: string) {
  const actual = await obtenerUsuarioActual();
  if (!actual) return null;
  if (actual.rol === "administrador" || actual.rol === "gestor_administrativo") {
    return actual;
  }
  if (actual.rol === "gestor_mantenimiento") {
    const admin = createAdminClient();
    const { data } = await admin
      .from("gestiones")
      .select("gestor_id")
      .eq("id", gestionId)
      .single();
    if (data?.gestor_id === actual.id) return actual;
  }
  return null;
}

// Arma los datos del documento. Admin client tras verificar rol: cruza
// legajo/inquilino/propietario que el rol administrativo no siempre lee.
// Los overrides permiten previsualizar con lo tipeado SIN escribir en la DB.
async function datosDocumento(
  gestionId: string,
  tipo: "nota" | "detalle" | "presupuesto",
  overrides?: {
    cargoAdmin?: number;
    pagador?: Pagador;
    pctInquilino?: number;
    // STORY-1036: nota de cobro POR PARTE de un pago compartido — el
    // documento cobra solo el monto de esa parte.
    parteNota?: "inquilino" | "propietario";
  }
): Promise<
  | {
      datos: DatosDocumento;
      emailDestinatario: string | null;
      // STORY-1031: a quién(es) mandar el documento — 1 entrada con pagador
      // único, 2 con compartido (cada una con su nombre para el saludo).
      envios: { nombre: string; email: string | null }[];
    }
  | null
> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select(
      "id, numero, descripcion, pagador, pagador_pct_inquilino, costo_final, cargo_admin, cargo_cancelacion, cargo_cancelacion_pagador, materiales_total, adelanto_materiales, liq_monto, liq_factura_ref, liq_medio, liq_pagada_en, legajo_id, tecnico_id, creado_en, propiedades(direccion, propietarios(nombre, email)), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre, email), presupuestos(monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, creado_en)"
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

  // ── Destinatarios y reparto (STORY-1031/1036/1038/1039) ──
  // Se resuelven SIEMPRE los dos contactos; quién recibe el documento y cómo
  // se divide depende del pagador elegido (presupuesto) o de quién DEBE plata
  // (nota) — que con una ampliación de otro pagador puede ser una parte que la
  // obra base no incluía.
  const propietario = {
    nombre: j.propiedades?.propietarios?.nombre ?? "—",
    email: j.propiedades?.propietarios?.email ?? null,
  };
  // STORY-962: el inquilino solo cuenta si el legajo sigue vigente.
  let inq: { nombre: string; email: string | null } | null = null;
  if (tipo !== "detalle" && g.legajo_id) {
    const { data: legajo } = await admin
      .from("legajos")
      .select("fecha_fin, inquilinos(nombre, email)")
      .eq("id", g.legajo_id)
      .single();
    inq =
      legajo && legajo.fecha_fin == null
        ? (legajo.inquilinos as unknown as { nombre: string; email: string } | null)
        : null;
  }

  const cargoAdmin = Number(overrides?.cargoAdmin ?? g.cargo_admin ?? 0);
  // STORY-972: la nota de una cancelación con cargo cobra SOLO el cargo.
  const esCancelacion = tipo === "nota" && g.cargo_cancelacion != null;
  // El fee de la inmobiliaria viaja al PAGADOR: entra al presupuesto y a la
  // nota. Nunca al detalle del técnico.
  const total = esCancelacion
    ? Number(g.cargo_cancelacion)
    : tipo === "presupuesto"
      ? Number(vigente?.monto_materiales ?? 0) +
        Number(vigente?.monto_mano_obra ?? 0) +
        cargoAdmin
      : tipo === "detalle"
        ? Number(g.liq_monto ?? g.costo_final ?? 0)
        : Number(g.costo_final ?? 0) + cargoAdmin;

  const obraPagador = (overrides?.pagador ?? g.pagador ?? null) as PagadorObra | null;
  const pctInquilino = overrides?.pctInquilino ?? g.pagador_pct_inquilino ?? null;
  // STORY-1038/1039: en la NOTA el reparto considera las ampliaciones con
  // pagador propio; en el presupuesto no (todavía no se ejecutó ni cobró).
  const ampliacionesReparto =
    tipo === "nota"
      ? await ampliacionesRepartoDeGestion(admin, gestionId, g.tecnico_id ?? null)
      : [];
  // STORY-1047: la nota de una cancelación NO se reparte por el pagador de la
  // obra — el cargo lo paga la parte elegida al cancelar (una sola).
  const reparto =
    tipo === "nota" && !esCancelacion
      ? repartoGestion(total, obraPagador, pctInquilino, ampliacionesReparto)
      : null;

  // Pagador EFECTIVO del documento: en la nota, quién debe plata (una parte o
  // las dos, STORY-1039); en el presupuesto, el pagador elegido (con la defensa
  // de legajo cerrado → cae al propietario, STORY-962).
  let pagadorEfectivo: PagadorObra | null;
  if (tipo === "detalle") {
    pagadorEfectivo = null;
  } else if (esCancelacion) {
    // STORY-1047: destinatario = pagador del cargo, independiente de la obra.
    pagadorEfectivo = (g.cargo_cancelacion_pagador as PagadorObra | null) ?? null;
    if (pagadorEfectivo === "inquilino" && !inq) pagadorEfectivo = "propietario";
  } else if (tipo === "nota" && reparto) {
    const inqDebe = reparto.montoInquilino > 0 && inq != null;
    const propDebe = reparto.montoPropietario > 0 || !inq;
    pagadorEfectivo = inqDebe && propDebe ? "compartido" : inqDebe ? "inquilino" : "propietario";
  } else {
    pagadorEfectivo = obraPagador;
    if ((pagadorEfectivo === "inquilino" || pagadorEfectivo === "compartido") && !inq) {
      pagadorEfectivo = "propietario";
    }
  }

  let destinatarioNombre = "—";
  let destinatarioRotulo = "Destinatario";
  let emailDestinatario: string | null = null;
  let envios: { nombre: string; email: string | null }[] = [];
  let splitInquilino: { nombre: string; email: string | null } | null = null;

  if (tipo === "detalle") {
    destinatarioNombre = j.tecnico?.nombre ?? "—";
    destinatarioRotulo = "Técnico";
    emailDestinatario = j.tecnico?.email ?? null;
  } else if (pagadorEfectivo === "propietario") {
    destinatarioNombre = propietario.nombre;
    destinatarioRotulo = "Propietario";
    emailDestinatario = propietario.email;
  } else if (pagadorEfectivo === "inquilino" && inq) {
    destinatarioNombre = inq.nombre ?? "—";
    destinatarioRotulo = "Inquilino";
    emailDestinatario = inq.email ?? null;
  } else if (pagadorEfectivo === "compartido" && inq) {
    // El documento es UNO por parte y va a los dos (STORY-1036).
    destinatarioNombre = `${inq.nombre} y ${propietario.nombre}`;
    destinatarioRotulo = "Inquilino y propietario";
    emailDestinatario = inq.email ?? null;
    splitInquilino = inq;
    envios = [
      { nombre: inq.nombre, email: inq.email ?? null },
      { nombre: propietario.nombre, email: propietario.email },
    ];
  }
  if (envios.length === 0) {
    envios = [{ nombre: destinatarioNombre, email: emailDestinatario }];
  }

  // STORY-1032: deudas de otras gestiones retenidas al liquidar — congeladas
  // en el evento de la liquidación; el detalle del técnico las muestra para que
  // el total pagado cierre (también al re-descargar).
  let descuentosDeuda: { descripcion: string; monto: number }[] = [];
  if (tipo === "detalle" && g.liq_pagada_en) {
    const { data: evLiq } = await admin
      .from("eventos_gestion")
      .select("detalle")
      .eq("gestion_id", gestionId)
      .eq("tipo", "liquidacion_registrada")
      .order("creado_en", { ascending: false })
      .limit(1);
    const crudo = (evLiq?.[0]?.detalle as Record<string, unknown> | null)?.deudas_descontadas;
    if (Array.isArray(crudo)) {
      descuentosDeuda = crudo.map((d) => ({
        descripcion: String((d as Record<string, unknown>).descripcion ?? "otra gestión"),
        monto: Number((d as Record<string, unknown>).monto ?? 0),
      }));
    }
  }

  // Split de la nota — montos por parte (STORY-1039: del repartoGestion).
  const split =
    tipo === "nota" && reparto && splitInquilino
      ? {
          pctInquilino: pctInquilino ?? 50,
          inquilinoNombre: splitInquilino.nombre,
          montoInquilino: reparto.montoInquilino,
          propietarioNombre: propietario.nombre,
          montoPropietario: reparto.montoPropietario,
        }
      : null;

  // STORY-1036: nota por parte — el destinatario es ESA parte y el total del
  // documento es SU monto; el total de la obra queda como contexto en el PDF.
  let totalDoc = total;
  let parteNota: { pct: number; totalObra: number } | null = null;
  if (tipo === "nota" && overrides?.parteNota && split && splitInquilino) {
    const esInq = overrides.parteNota === "inquilino";
    destinatarioNombre = esInq ? splitInquilino.nombre : propietario.nombre;
    destinatarioRotulo = esInq ? "Inquilino" : "Propietario";
    emailDestinatario = esInq ? splitInquilino.email : propietario.email;
    envios = [{ nombre: destinatarioNombre, email: emailDestinatario }];
    totalDoc = esInq ? split.montoInquilino : split.montoPropietario;
    parteNota = {
      pct: esInq ? split.pctInquilino : 100 - split.pctInquilino,
      totalObra: total,
    };
  }

  return {
    emailDestinatario,
    envios,
    datos: {
      tipo,
      split,
      parteNota,
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
      total: totalDoc,
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
      descuentosDeuda: descuentosDeuda.length > 0 ? descuentosDeuda : null,
    },
  };
}

// STORY-1038: ampliaciones aprobadas con pagador PROPIO del técnico actual —
// componen el costo_final que se cobra, así que su pagador cuenta en el
// reparto compartido. Las de un saliente son historial (STORY-983) y no se
// cobran acá; las heredadas (pagador null) caen en la base por % de obra.
async function ampliacionesRepartoDeGestion(
  admin: ReturnType<typeof createAdminClient>,
  gestionId: string,
  tecnicoId: string | null
): Promise<AmpliacionReparto[]> {
  if (!tecnicoId) return [];
  const { data } = await admin
    .from("ampliaciones")
    .select("monto, pagador, pagador_pct_inquilino")
    .eq("gestion_id", gestionId)
    .eq("estado", "aprobada")
    .eq("tecnico_id", tecnicoId)
    .not("pagador", "is", null);
  return ((data ?? []) as {
    monto: number;
    pagador: "inquilino" | "propietario" | "compartido" | null;
    pagador_pct_inquilino: number | null;
  }[]).map((a) => ({
    monto: Number(a.monto),
    pagador: a.pagador,
    pagadorPctInquilino: a.pagador_pct_inquilino,
  }));
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
  // STORY-1031: compartido también necesita un inquilino habitando.
  if ((efectivo === "inquilino" || efectivo === "compartido") && !legajoVigente) {
    return "La propiedad no tiene inquilino vigente — el pago solo puede ser del propietario.";
  }
  return null;
}

// STORY-1031: % del inquilino en un pago compartido — entero entre 1 y 99.
function errorPctInquilino(pagador?: Pagador, pct?: number): string | null {
  if (pagador !== "compartido") return null;
  if (!Number.isInteger(pct) || pct! < 1 || pct! > 99) {
    return "Indicá qué % paga el inquilino (entre 1 y 99).";
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
  // STORY-1031: con pago compartido la nota va a los DOS.
  if (doc.envios.some((e) => !e.email)) {
    return {
      ok: false,
      error:
        doc.envios.length > 1
          ? "Falta el email del inquilino o del propietario — con pago compartido la nota va a los dos."
          : "El pagador no tiene email cargado.",
    };
  }

  // STORY-1036: con pago compartido cada parte recibe SU nota — un PDF por
  // parte, con su monto (antes iba el mismo documento a los dos).
  if (doc.datos.split) {
    for (const parte of ["inquilino", "propietario"] as const) {
      const docParte = await datosDocumento(gestionId, "nota", { parteNota: parte });
      if (!docParte || !docParte.emailDestinatario) continue; // ya validado arriba
      const pdfParte = await generarPDF(docParte.datos);
      await enviarEmailDocumento({
        para: docParte.emailDestinatario,
        destinatario: docParte.datos.destinatarioNombre,
        asunto: docParte.datos.cancelacion
          ? `Cargo por cancelación — ${docParte.datos.direccion}`
          : `Nota de cobro — ${docParte.datos.direccion}`,
        titulo: docParte.datos.cancelacion
          ? "Nota de cobro por cancelación del trabajo"
          : "Nota de cobro por trabajo de mantenimiento",
        cuerpo: docParte.datos.cancelacion
          ? `Te enviamos el detalle del cargo por la cancelación del trabajo en ${docParte.datos.direccion}. El cargo es compartido: la nota adjunta es por tu parte.`
          : `Te enviamos el detalle del trabajo realizado en ${docParte.datos.direccion}. El gasto es compartido: la nota adjunta es por tu parte.`,
        tipo: "nota_cobro",
        gestion_id: gestionId,
        adjuntos: [
          {
            filename: `nota-cobro-${docParte.datos.numero}-${parte}.pdf`,
            contentBase64: pdfParte,
          },
        ],
      });
    }
  } else {
    const pdf = await generarPDF(doc.datos);
    for (const destino of doc.envios) {
      await enviarEmailDocumento({
        para: destino.email!,
        destinatario: destino.nombre,
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
    }
  }

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
  tipo: "nota" | "detalle",
  // STORY-1036: nota de un pago compartido — vista previa/descarga POR PARTE
  parte?: "inquilino" | "propietario"
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(
    gestionId,
    tipo,
    parte ? { parteNota: parte } : undefined
  );
  if (!doc) return { ok: false, error: "Gestión no encontrada." };

  const base64 = await generarPDF(doc.datos);
  return {
    ok: true,
    data: {
      base64,
      filename: `${tipo === "nota" ? "nota-cobro" : "detalle-liquidacion"}-${doc.datos.numero}${parte ? `-${parte}` : ""}.pdf`,
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
  opciones?: { cargoAdmin?: number; pagador?: Pagador; pctInquilino?: number }
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirMantenimiento(gestionId);
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (cargoInvalido(opciones?.cargoAdmin)) {
    return { ok: false, error: "El cargo administrativo no puede ser negativo." };
  }
  const errPagador = await errorPagador(gestionId, opciones?.pagador);
  if (errPagador) return { ok: false, error: errPagador };
  const errPct = errorPctInquilino(opciones?.pagador, opciones?.pctInquilino);
  if (errPct) return { ok: false, error: errPct };

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
  pagador?: Pagador,
  pctInquilino?: number
): Promise<ActionResult> {
  const actual = await exigirMantenimiento(gestionId);
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (cargoInvalido(cargoAdmin)) {
    return { ok: false, error: "El cargo administrativo no puede ser negativo." };
  }
  const errPagador = await errorPagador(gestionId, pagador);
  if (errPagador) return { ok: false, error: errPagador };
  const errPct = errorPctInquilino(pagador, pctInquilino);
  if (errPct) return { ok: false, error: errPct };

  // Enviar SÍ persiste: el pagador elegido y el fee quedan anclados a lo
  // que realmente se mandó (el email debe ir a quien se ve en pantalla)
  await guardarCargoAdmin(gestionId, cargoAdmin);
  if (pagador) {
    const admin = createAdminClient();
    await admin
      .from("gestiones")
      .update({
        pagador,
        pagador_pct_inquilino: pagador === "compartido" ? pctInquilino : null,
      })
      .eq("id", gestionId);
  }
  const doc = await datosDocumento(gestionId, "presupuesto", {
    cargoAdmin,
    pagador,
    pctInquilino,
  });
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "No hay presupuesto cargado." };
  // STORY-1031: con pago compartido el documento va a los DOS — sin el email
  // de alguna de las partes no se envía.
  if (doc.envios.some((e) => !e.email)) {
    return {
      ok: false,
      error:
        doc.envios.length > 1
          ? "Falta el email del inquilino o del propietario — con pago compartido el presupuesto va a los dos."
          : "El destinatario no tiene email cargado.",
    };
  }

  const pdf = await generarPDF(doc.datos);
  for (const destino of doc.envios) {
    await enviarEmailDocumento({
      para: destino.email!,
      destinatario: destino.nombre,
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
  }

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

// STORY-1017: aviso de ampliación de presupuesto al pagador — mismo circuito
// del presupuesto inicial pero sin PDF nuevo: los tres números van en el
// cuerpo (aprobado, ampliación, nuevo total) y la nota formal llega al final
// como siempre. Marca enviada_pagador_en: el gate para registrar la
// autorización (espejo de presupuesto_enviado_en, STORY-935).
export async function enviarAmpliacionEmail(
  gestionId: string,
  ampliacionId: string,
  // STORY-1038: en obras compartidas el gestor puede re-elegir quién paga la
  // ampliación (una parte o ambas con %); default heredado en la UI. Ignorado
  // en obras de pagador único (la ampliación la paga el mismo pagador).
  pagadorAmpliacion?: { pagador: Pagador; pctInquilino?: number }
): Promise<ActionResult> {
  const actual = await exigirMantenimiento(gestionId);
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const admin = createAdminClient();
  const { data: amp } = await admin
    .from("ampliaciones")
    .select("monto, motivo, estado")
    .eq("id", ampliacionId)
    .eq("gestion_id", gestionId)
    .single();
  if (!amp || amp.estado !== "enviada") {
    return { ok: false, error: "La ampliación ya fue resuelta." };
  }

  // Lo que el pagador ya conoce: presupuesto aprobado + fee anclado.
  const { data: aprobados } = await admin
    .from("presupuestos")
    .select("monto_materiales, monto_mano_obra")
    .eq("gestion_id", gestionId)
    .eq("estado", "aprobado")
    .order("creado_en", { ascending: false })
    .limit(1);
  const aprobado = aprobados?.[0];
  if (!aprobado) {
    return { ok: false, error: "La gestión no tiene presupuesto aprobado." };
  }
  const { data: g } = await admin
    .from("gestiones")
    .select("cargo_admin, pagador, pagador_pct_inquilino")
    .eq("id", gestionId)
    .single();

  // STORY-1039: SIEMPRE se puede re-elegir quién paga la ampliación (antes solo
  // en obras compartidas). Default: hereda el pagador de la obra. Si se le
  // atribuye a una parte distinta de una obra de pagador único, la gestión
  // pasa a cobrarse dividida (repartoGestion / esRepartido lo detectan).
  const obraPagador = (g?.pagador as Pagador | null) ?? "propietario";
  const pagAmp: Pagador = pagadorAmpliacion?.pagador ?? obraPagador;
  const pctAmp =
    pagAmp === "compartido"
      ? pagadorAmpliacion?.pctInquilino ??
        Number(g?.pagador_pct_inquilino ?? 50)
      : null;
  const errPct = errorPctInquilino(pagAmp, pctAmp ?? undefined);
  if (errPct) return { ok: false, error: errPct };

  // Destinatarios según el pagador de la AMPLIACIÓN (no el de la obra):
  // datosDocumento con override resuelve envios[] (1 con parte única, 2 con
  // compartido, orden [inquilino, propietario]) y la dirección.
  const doc = await datosDocumento(gestionId, "presupuesto", {
    pagador: pagAmp,
    pctInquilino: pctAmp ?? undefined,
  });
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (doc.envios.some((e) => !e.email)) {
    return {
      ok: false,
      error:
        doc.envios.length > 1
          ? "Falta el email del inquilino o del propietario — con ampliación compartida el aviso va a los dos."
          : "El pagador de la ampliación no tiene email cargado.",
    };
  }

  const monto = Number(amp.monto);
  const aprobadoTotal =
    Number(aprobado.monto_materiales) +
    Number(aprobado.monto_mano_obra) +
    Number(g?.cargo_admin ?? 0);
  const plata = (v: number) => `$ ${v.toLocaleString("es-AR")}`;

  // Monto que le toca a cada destino de la ampliación (compartido: reparto por
  // %; parte única: el monto entero).
  const montosPorDestino =
    pagAmp === "compartido" && pctAmp != null
      ? (() => {
          const r = repartoGestion(monto, "compartido", pctAmp);
          return [r.montoInquilino, r.montoPropietario];
        })()
      : [monto];

  for (const [i, destino] of doc.envios.entries()) {
    const tuParte = montosPorDestino[i] ?? monto;
    const detalleParte =
      doc.envios.length > 1
        ? `De ese gasto extra, la parte que te corresponde es ${plata(tuParte)}. `
        : "";
    await enviarEmailDocumento({
      para: destino.email!,
      destinatario: destino.nombre,
      asunto: `Ampliación de presupuesto — ${doc.datos.direccion}`,
      titulo: "Ampliación del presupuesto aprobado",
      cuerpo:
        `Durante el trabajo en ${doc.datos.direccion} surgieron gastos no previstos: ${amp.motivo}. ` +
        `El presupuesto que aprobaste fue de ${plata(aprobadoTotal)}; la ampliación solicitada es de ${plata(monto)}. ` +
        detalleParte +
        `Confirmá tu decisión con la inmobiliaria — el gasto extra no se realiza sin tu autorización.`,
      tipo: "ampliacion",
      gestion_id: gestionId,
      adjuntos: [],
    });
  }

  await admin
    .from("ampliaciones")
    .update({
      enviada_pagador_en: new Date().toISOString(),
      // STORY-1038/1039: se ancla el pagador de la ampliación al enviar (espejo
      // del pagador de la obra en el presupuesto) — SIEMPRE, sea la obra
      // compartida o de pagador único.
      pagador: pagAmp,
      pagador_pct_inquilino: pagAmp === "compartido" ? pctAmp : null,
    })
    .eq("id", ampliacionId);

  await registrarEvento(gestionId, "ampliacion_enviada_pagador", actual.id, {
    monto,
    total: aprobadoTotal + monto,
    para: doc.datos.destinatarioRotulo.toLowerCase(),
  });

  return { ok: true };
}

// STORY-950: permite combinar hasta 2 medios de pago (ej. mitad efectivo,
// mitad transferencia) en vez de forzar un único medio para el 100%. El
// monto del segundo medio lo tipea la administración; el del primero es el
// resto (se calcula acá, nunca confiando en lo que mande el cliente).
// STORY-1036: con pagador compartido cada parte se cobra POR SEPARADO y en
// momentos distintos — `parte` dice quién está pagando. Cada cobro parcial
// queda como evento `cobro_registrado` con su parte (hecho congelado); los
// snapshots de la gestión se congelan recién con el SEGUNDO cobro, y ahí la
// etapa avanza como siempre.
export async function registrarCobro(
  gestionId: string,
  datos: {
    medio: MedioCobro;
    medio2?: MedioCobro;
    monto2?: number;
    recargoPct?: number;
    parte?: "inquilino" | "propietario";
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
    .select("costo_final, cargo_admin, cargo_cancelacion, pagador, pagador_pct_inquilino, tecnico_id")
    .eq("id", gestionId)
    .single();
  // STORY-967: una cancelación con cargo se cobra por este mismo circuito —
  // el total es el cargo y es 100% de la casa (no hay técnico que liquidar).
  const cargoCancelacion =
    g?.cargo_cancelacion == null ? null : Number(g.cargo_cancelacion);
  const costoFinal = Number(g?.costo_final ?? 0);
  const cargoAdmin = cargoCancelacion ?? Number(g?.cargo_admin ?? 0);
  const total = cargoCancelacion ?? costoFinal + cargoAdmin;

  // STORY-1036/1039: "cobro dividido" = ambas partes deben plata (obra
  // compartida, o una ampliación atribuida a la otra parte). En ese caso el
  // monto a cobrar es el de LA PARTE; la parte ya cobrada se valida contra los
  // eventos — nunca dos veces la misma.
  const admin = createAdminClient();
  const ampliaciones = await ampliacionesRepartoDeGestion(
    admin,
    gestionId,
    (g?.tecnico_id as string | null) ?? null
  );
  const reparto = repartoGestion(
    total,
    (g?.pagador as PagadorObra | null) ?? null,
    g?.pagador_pct_inquilino == null ? null : Number(g.pagador_pct_inquilino),
    ampliaciones
  );
  // STORY-1047: una cancelación con cargo NUNCA se cobra dividida — el cargo lo
  // paga la parte elegida al cancelar (cargo_cancelacion_pagador), no el pagador
  // de la obra. Aunque la obra fuera compartida, es un cobro de una sola parte.
  const esRepartido =
    cargoCancelacion == null && reparto.montoInquilino > 0 && reparto.montoPropietario > 0;
  if (esRepartido && !datos.parte) {
    return { ok: false, error: "Indicá qué parte está pagando." };
  }
  if (!esRepartido && datos.parte) {
    return { ok: false, error: "Esta gestión no se cobra dividida." };
  }
  let baseParte = total;
  let cobroPrevio: { total: number } | null = null;
  if (esRepartido && datos.parte) {
    baseParte = datos.parte === "inquilino" ? reparto.montoInquilino : reparto.montoPropietario;

    const { data: previos } = await admin
      .from("eventos_gestion")
      .select("detalle")
      .eq("gestion_id", gestionId)
      .eq("tipo", "cobro_registrado");
    for (const e of (previos ?? []) as { detalle: Record<string, unknown> | null }[]) {
      const p = e.detalle?.parte;
      if (p === datos.parte) {
        return { ok: false, error: "Esa parte ya está cobrada." };
      }
      if (p === "inquilino" || p === "propietario") {
        cobroPrevio = { total: Number(e.detalle?.total ?? 0) };
      }
    }
  }

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
    if (monto2 >= baseParte) {
      return {
        ok: false,
        error: `El monto del segundo medio no puede ser mayor o igual al total a cobrar ($ ${baseParte.toLocaleString("es-AR")}).`,
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
      ? baseParte - (montoCobro2 ?? 0)
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
  const totalFinal = baseParte + (recargoMonto ?? 0);

  // STORY-1036: primer cobro parcial de un cobro dividido — solo el evento (la
  // gestión sigue en facturación esperando a la otra parte, sin snapshots).
  if (esRepartido && !cobroPrevio) {
    await registrarEvento(gestionId, "cobro_registrado", actual.id, {
      parte: datos.parte,
      medio: datos.medio,
      medio2: medioCobro2,
      monto2: montoCobro2,
      recargoPct,
      recargoMonto,
      total: totalFinal,
    });
    revalidatePath(`/gestiones/${gestionId}`);
    revalidatePath("/finanzas");
    return { ok: true };
  }

  // Cobro único (pagador simple) o SEGUNDA parte de un compartido: congelar
  // los snapshots (en compartido, el monto es la SUMA de ambas partes y los
  // medios viven en los eventos — cada parte pagó con el suyo).
  const { error } = await supabase
    .from("gestiones")
    .update({
      cobrado_en: new Date().toISOString(),
      medio_cobro: esRepartido ? null : datos.medio,
      medio_cobro_2: esRepartido ? null : medioCobro2,
      cobrado_monto: totalFinal + (cobroPrevio?.total ?? 0),
      cobrado_monto_2: esRepartido ? null : montoCobro2,
      cobrado_fee: cargoAdmin,
      recargo_tarjeta_pct: esRepartido ? null : recargoPct,
      recargo_tarjeta_monto: esRepartido ? null : recargoMonto,
    })
    .eq("id", gestionId);
  if (error) {
    console.error("registrarCobro: update falló", error);
    return { ok: false, error: "No se pudo registrar el cobro." };
  }

  // STORY-973: el total viaja en el evento — la Actividad cuenta el cobro
  // completo (cuánto y con qué medios) sin leer campos de la gestión.
  await registrarEvento(gestionId, "cobro_registrado", actual.id, {
    ...(esRepartido ? { parte: datos.parte } : {}),
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
  const actual = await exigirAdelanto(gestionId);
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
    .select("etapa, adelanto_materiales, tecnico_id")
    .eq("id", gestionId)
    .single();
  type Fila = {
    etapa: string;
    adelanto_materiales: number | null;
    tecnico_id: string | null;
  };
  const fila = g as unknown as Fila | null;
  if (!fila || fila.etapa !== "en_ejecucion") {
    return { ok: false, error: "El adelanto solo se puede cargar en ejecución." };
  }
  const total = Number(fila.adelanto_materiales ?? 0) + monto;

  // STORY-1018: mismo techo que muestra la UI (materiales del presupuesto
  // vigente + ampliaciones aprobadas del técnico actual). Si el acumulado lo
  // supera, el excedente queda CONGELADO en el evento — un aviso que no deja
  // huella es cortesía, no control (la Auditoría responde "quién autorizó dar
  // de más"). Sigue sin ser un tope: no bloquea nada (doctrina v1.1).
  let excedenteTope = 0;
  const { data: presAprobado } = await supabase
    .from("presupuestos")
    .select("monto_materiales")
    .eq("gestion_id", gestionId)
    .eq("estado", "aprobado")
    .order("creado_en", { ascending: false })
    .limit(1);
  if (presAprobado?.length && fila.tecnico_id) {
    const { data: amps } = await supabase
      .from("ampliaciones")
      .select("monto")
      .eq("gestion_id", gestionId)
      .eq("estado", "aprobada")
      .eq("tecnico_id", fila.tecnico_id);
    const tope =
      Number(presAprobado[0].monto_materiales) +
      (amps ?? []).reduce((s, a) => s + Number(a.monto), 0);
    if (total > tope) excedenteTope = total - tope;
  }

  const path = `${gestionId}/adelanto-comprobante-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await comprobante.arrayBuffer()), {
      contentType: comprobante.type,
    });
  if (upErr) return { ok: false, error: "No se pudo subir el comprobante. Probá de nuevo." };

  // Admin client: exigirAdelanto() ya validó rol + ownership; el trigger de
  // columnas de finanzas en gestiones está pensado para el rol administrativo
  // y no contempla al gestor de mantenimiento (patrón "rendición").
  const { error } = await admin
    .from("gestiones")
    .update({ adelanto_materiales: total })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo guardar el adelanto." };

  await registrarEvento(gestionId, "adelanto_materiales_registrado", actual.id, {
    monto,
    total,
    comprobante_path: path,
    ...(excedenteTope > 0 ? { excedente_tope: excedenteTope } : {}),
  });
  revalidatePath(`/gestiones/${gestionId}`);
  return { ok: true };
}

// STORY-1019: cierre MANUAL de un adelanto "a resolver" (desasignación,
// cancelación o sobrante de liquidación). No es cobranza: registra el hecho
// de que se arregló, con nota obligatoria (la constancia de CÓMO). Los hechos
// congelados no se editan — el estado cambia agregando este evento; la
// derivación de features/finanzas/consultas.ts lo lee para cerrar el ítem.
// El monto y el técnico se recalculan del hecho de origen (no se confía en
// el form). Sin fila en matriz_notificaciones: no notifica (el que salda es
// el que registra).
export async function marcarAdelantoSaldado(
  gestionId: string,
  formData: FormData
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  const nota = String(formData.get("nota") ?? "").trim();
  if (!nota) {
    return { ok: false, error: "Contá cómo se arregló — la nota es la constancia." };
  }
  const origen = String(formData.get("origen") ?? "");
  const origenEventoId = String(formData.get("origen_evento_id") ?? "") || null;
  if (!["desasignacion", "cancelacion", "sobrante"].includes(origen)) {
    return { ok: false, error: "Origen inválido." };
  }

  const admin = createAdminClient();
  // Recalcular el ENTREGADO + técnico desde el hecho de origen.
  let entregadoOrigen = 0;
  let tecnicoId: string | null = null;
  if (origen === "cancelacion") {
    const { data: g } = await admin
      .from("gestiones")
      .select("etapa, adelanto_materiales, tecnico_id")
      .eq("id", gestionId)
      .single();
    const fila = g as unknown as { etapa: string; adelanto_materiales: number | null; tecnico_id: string | null } | null;
    if (!fila || fila.etapa !== "cancelada" || Number(fila.adelanto_materiales ?? 0) <= 0) {
      return { ok: false, error: "Esta gestión no tiene un adelanto a resolver por cancelación." };
    }
    entregadoOrigen = Number(fila.adelanto_materiales);
    tecnicoId = fila.tecnico_id;
  } else {
    if (!origenEventoId) return { ok: false, error: "Falta el evento de origen." };
    const { data: e } = await admin
      .from("eventos_gestion")
      .select("id, gestion_id, detalle")
      .eq("id", origenEventoId)
      .eq("gestion_id", gestionId)
      .single();
    const ev = e as unknown as { detalle: Record<string, unknown> | null } | null;
    if (!ev) return { ok: false, error: "No se encontró el registro de origen." };
    if (origen === "desasignacion") {
      const entregado = Number(ev.detalle?.adelanto_saliente ?? 0);
      const devuelto = Number(ev.detalle?.devolucion_adelanto ?? 0);
      entregadoOrigen = Math.max(entregado - devuelto, 0);
      const saliente = String(ev.detalle?.tecnico_saliente ?? "");
      tecnicoId = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(saliente) ? saliente : null;
    } else {
      entregadoOrigen = Number(ev.detalle?.sobrante ?? 0);
      const { data: g } = await admin
        .from("gestiones")
        .select("tecnico_id")
        .eq("id", gestionId)
        .single();
      tecnicoId = (g as unknown as { tecnico_id: string | null } | null)?.tecnico_id ?? null;
    }
    if (entregadoOrigen <= 0) return { ok: false, error: "Ese adelanto no tiene monto a resolver." };
  }

  // STORY-1032: los descuentos desde liquidaciones pueden haber recuperado
  // una parte — el saldado manual cierra el RESTO (si no queda nada, el
  // origen ya está saldado). Mismo criterio de suma que la derivación.
  const { data: previos } = await admin
    .from("eventos_gestion")
    .select("detalle")
    .eq("gestion_id", gestionId)
    .eq("tipo", "adelanto_saldado");
  const saldadoPrevio = ((previos ?? []) as { detalle: Record<string, unknown> | null }[])
    .filter((p) =>
      origen === "cancelacion"
        ? p.detalle?.origen === "cancelacion"
        : String(p.detalle?.origen_evento_id ?? "") === origenEventoId
    )
    .reduce((s, p) => s + Number(p.detalle?.monto ?? 0), 0);
  const monto = Math.max(entregadoOrigen - saldadoPrevio, 0);
  if (monto <= 0) return { ok: false, error: "Ese adelanto ya estaba marcado como saldado." };

  // Nombre congelado del técnico (el evento debe leerse solo, sin joins).
  let tecnicoNombre: string | null = null;
  if (tecnicoId) {
    const { data: t } = await admin.from("tecnicos").select("nombre").eq("id", tecnicoId).single();
    tecnicoNombre = (t as unknown as { nombre: string } | null)?.nombre ?? null;
  }

  await registrarEvento(gestionId, "adelanto_saldado", actual.id, {
    monto,
    origen,
    ...(origenEventoId ? { origen_evento_id: origenEventoId } : {}),
    ...(tecnicoId ? { tecnico_id: tecnicoId } : {}),
    ...(tecnicoNombre ? { tecnico: tecnicoNombre } : {}),
    nota,
  });
  revalidatePath(`/gestiones/${gestionId}`);
  revalidatePath("/finanzas");
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
    .select("descripcion, tecnico_id, costo_final, materiales_total, adelanto_materiales, presupuestos(monto_mano_obra, estado)")
    .eq("id", gestionId)
    .single();
  type Fila = {
    descripcion: string;
    tecnico_id: string | null;
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

  // STORY-1032: deudas "a resolver" del técnico (cross-gestión) tildadas para
  // retener de esta liquidación. Se re-deriva TODO en el server — del cliente
  // solo viajan las claves; los montos salen de la derivación única. Si la
  // plata no alcanza, se retiene lo que entre (descuento PARCIAL) y el resto
  // sigue a resolver. El orden es el de la derivación (la más vieja primero).
  const seleccion = [...new Set(formData.getAll("deuda").map(String).filter(Boolean))];
  const descuentos: {
    gestion_id: string;
    descripcion: string;
    origen: string;
    origen_evento_id: string | null;
    tecnico_id: string | null;
    tecnico: string;
    monto: number;
  }[] = [];
  if (seleccion.length > 0) {
    if (!fila?.tecnico_id) {
      return { ok: false, error: "La gestión no tiene técnico al que descontarle deudas." };
    }
    const deudas = await adelantosAResolverDeTecnico(fila.tecnico_id);
    const elegidas = deudas.filter((d) => seleccion.includes(claveDeuda(d)));
    if (elegidas.length !== seleccion.length) {
      return {
        ok: false,
        error: "Alguna de las deudas seleccionadas ya no está pendiente. Refrescá la página y volvé a intentar.",
      };
    }
    let restante = monto;
    for (const d of elegidas) {
      const retenido = Math.min(d.monto, restante);
      if (retenido <= 0) continue;
      restante -= retenido;
      descuentos.push({
        gestion_id: d.gestionId,
        descripcion: d.descripcion,
        origen: d.origen,
        origen_evento_id: d.origenEventoId,
        tecnico_id: d.tecnicoId,
        tecnico: d.tecnicoNombre,
        monto: retenido,
      });
    }
  }
  const totalDescontado = descuentos.reduce((s, d) => s + d.monto, 0);
  const montoPagado = monto - totalDescontado;

  const { error } = await supabase
    .from("gestiones")
    .update({
      liq_monto: montoPagado,
      liq_medio: medio,
      liq_pagada_en: new Date().toISOString(),
      liq_comprobante_path: comprobantePath,
    })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo registrar la liquidación." };

  // Los descuentos se asientan como saldados (parciales o totales) en la
  // gestión de ORIGEN de cada deuda — DESPUÉS de asentar la liquidación: si
  // un insert falla, la deuda sigue "a resolver" (molesta dos veces, nunca
  // pierde plata en silencio) y queda el saldado manual como red.
  const fallidas: string[] = [];
  for (const d of descuentos) {
    const { error: errSaldado } = await supabase.from("eventos_gestion").insert({
      gestion_id: d.gestion_id,
      tipo: "adelanto_saldado",
      actor_id: actual.id,
      detalle: {
        monto: d.monto,
        origen: d.origen,
        ...(d.origen_evento_id ? { origen_evento_id: d.origen_evento_id } : {}),
        ...(d.tecnico_id ? { tecnico_id: d.tecnico_id } : {}),
        tecnico: d.tecnico,
        via: "liquidacion",
        gestion_liquidacion_id: gestionId,
        nota: `Descontado de la liquidación de «${fila?.descripcion ?? "otra gestión"}»`,
      },
    });
    if (errSaldado) fallidas.push(d.descripcion);
    else revalidatePath(`/gestiones/${d.gestion_id}`);
  }

  // El evento va ANTES del email: el PDF del detalle lee las deudas
  // descontadas de acá (así la re-descarga también las muestra).
  await registrarEvento(gestionId, "liquidacion_registrada", actual.id, {
    monto: montoPagado,
    medio,
    ...(sobrante > 0 ? { sobrante } : {}),
    ...(comprobantePath ? { comprobante: true } : {}),
    ...(descuentos.length > 0
      ? {
          deudas_descontadas: descuentos.map((d) => ({
            gestion_id: d.gestion_id,
            descripcion: d.descripcion,
            monto: d.monto,
          })),
        }
      : {}),
  });

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

  if (descuentos.length > 0) revalidatePath("/finanzas");
  const avance = await avanzarEtapa(gestionId, "finalizado");
  if (fallidas.length > 0) {
    return {
      ok: false,
      error: `La liquidación se registró, pero no se pudo asentar el descuento de «${fallidas.join("», «")}» — esa deuda sigue a resolver (saldala a mano desde su gestión).`,
    };
  }
  return avance;
}
