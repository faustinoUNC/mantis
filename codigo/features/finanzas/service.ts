"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { enviarEmailDocumento } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { avanzarEtapa } from "@/features/gestiones/service";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import { generarPDF, type DatosDocumento } from "./pdf";

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

async function exigirMantenimiento() {
  const actual = await obtenerUsuarioActual();
  if (
    actual?.rol !== "administrador" &&
    actual?.rol !== "gestor_mantenimiento"
  ) {
    return null;
  }
  return actual;
}

// Arma los datos del documento. Admin client tras verificar rol: cruza
// legajo/inquilino/propietario que el rol administrativo no siempre lee.
async function datosDocumento(
  gestionId: string,
  tipo: "nota" | "comprobante" | "presupuesto"
): Promise<
  | { datos: DatosDocumento; emailDestinatario: string | null }
  | null
> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, pagador, pagador_sugerido, costo_final, cargo_admin, liq_monto, liq_factura_ref, legajo_id, creado_en, propiedades(direccion, propietarios(nombre, email)), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre, email), presupuestos(monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, creado_en)"
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

  // Nota y presupuesto van al PAGADOR (confirmado, o sugerido si aún no)
  const pagador = g.pagador ?? g.pagador_sugerido;
  if (tipo === "comprobante") {
    destinatarioNombre = j.tecnico?.nombre ?? "—";
    destinatarioRotulo = "Técnico";
    emailDestinatario = j.tecnico?.email ?? null;
  } else if (pagador === "propietario") {
    destinatarioNombre = j.propiedades?.propietarios?.nombre ?? "—";
    destinatarioRotulo = "Propietario";
    emailDestinatario = j.propiedades?.propietarios?.email ?? null;
  } else if (g.legajo_id) {
    const { data: legajo } = await admin
      .from("legajos")
      .select("inquilinos(nombre, email)")
      .eq("id", g.legajo_id)
      .single();
    const inq = legajo?.inquilinos as unknown as {
      nombre: string;
      email: string;
    } | null;
    destinatarioNombre = inq?.nombre ?? "—";
    destinatarioRotulo = "Inquilino";
    emailDestinatario = inq?.email ?? null;
  }

  const cargoAdmin = Number(g.cargo_admin ?? 0);
  const total =
    tipo === "presupuesto"
      ? Number(vigente?.monto_materiales ?? 0) + Number(vigente?.monto_mano_obra ?? 0)
      : tipo === "comprobante"
        ? Number(g.liq_monto ?? g.costo_final ?? 0)
        : Number(g.costo_final ?? 0) + cargoAdmin;

  return {
    emailDestinatario,
    datos: {
      tipo,
      numero: g.id.slice(0, 8).toUpperCase(),
      fecha: new Date().toLocaleDateString("es-AR"),
      destinatarioNombre,
      destinatarioRotulo,
      direccion: j.propiedades?.direccion ?? "—",
      especialidad: j.especialidades?.nombre ?? "—",
      descripcion: g.descripcion,
      detalleTrabajo:
        tipo === "presupuesto"
          ? [vigente?.descripcion_trabajo, vigente?.notas].filter(Boolean).join(" — ") || null
          : aprobado?.descripcion_trabajo ?? aprobado?.notas ?? null,
      tecnicoNombre: j.tecnico?.nombre ?? null,
      presupuesto: (tipo === "presupuesto" ? vigente : aprobado)
        ? {
            materiales: Number((tipo === "presupuesto" ? vigente : aprobado)!.monto_materiales),
            manoObra: Number((tipo === "presupuesto" ? vigente : aprobado)!.monto_mano_obra),
          }
        : null,
      total,
      facturaRef: tipo === "presupuesto" ? null : g.liq_factura_ref,
      plazoDias: tipo === "presupuesto" ? vigente?.plazo_dias ?? null : null,
      cargoAdmin: tipo === "nota" ? cargoAdmin : null,
    },
  };
}

async function registrarEvento(gestionId: string, tipo: string, actorId: string) {
  const supabase = await createClient();
  await supabase
    .from("eventos_gestion")
    .insert({ gestion_id: gestionId, tipo, actor_id: actorId });
}

async function guardarCargoAdmin(gestionId: string, cargoAdmin?: number) {
  if (cargoAdmin == null || cargoAdmin < 0) return;
  const admin = createAdminClient();
  await admin.from("gestiones").update({ cargo_admin: cargoAdmin }).eq("id", gestionId);
}

export async function emitirNotaCobro(
  gestionId: string,
  cargoAdmin?: number
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  await guardarCargoAdmin(gestionId, cargoAdmin);
  const doc = await datosDocumento(gestionId, "nota");
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "La gestión no tiene costo final." };
  if (!doc.emailDestinatario) {
    return { ok: false, error: "El pagador no tiene email cargado." };
  }

  const pdf = await generarPDF(doc.datos);
  await enviarEmailDocumento({
    para: doc.emailDestinatario,
    asunto: `Nota de cobro — ${doc.datos.direccion}`,
    titulo: "Nota de cobro por trabajo de mantenimiento",
    cuerpo: `Te enviamos el detalle del trabajo realizado en ${doc.datos.direccion}. El documento adjunto tiene el desglose completo.`,
    tipo: "nota_cobro",
    gestion_id: gestionId,
    adjunto: {
      filename: `nota-cobro-${doc.datos.numero}.pdf`,
      contentBase64: pdf,
    },
  });

  const supabase = await createClient();
  await supabase
    .from("gestiones")
    .update({ nota_emitida_en: new Date().toISOString() })
    .eq("id", gestionId);
  await registrarEvento(gestionId, "nota_cobro_enviada", actual.id);

  return { ok: true };
}

export interface DocumentoGenerado {
  base64: string;
  filename: string;
  destinatario: { nombre: string; rotulo: string; email: string | null };
}

export async function descargarDocumento(
  gestionId: string,
  tipo: "nota" | "comprobante",
  opciones?: { cargoAdmin?: number }
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  if (tipo === "nota") await guardarCargoAdmin(gestionId, opciones?.cargoAdmin);
  const doc = await datosDocumento(gestionId, tipo);
  if (!doc) return { ok: false, error: "Gestión no encontrada." };

  const base64 = await generarPDF(doc.datos);
  return {
    ok: true,
    data: {
      base64,
      filename: `${tipo === "nota" ? "nota-cobro" : "comprobante-liquidacion"}-${doc.datos.numero}.pdf`,
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
  gestionId: string
): Promise<ActionResult<DocumentoGenerado>> {
  const actual = await exigirMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(gestionId, "presupuesto");
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
  gestionId: string
): Promise<ActionResult> {
  const actual = await exigirMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(gestionId, "presupuesto");
  if (!doc) return { ok: false, error: "Gestión no encontrada." };
  if (!doc.datos.total) return { ok: false, error: "No hay presupuesto cargado." };
  if (!doc.emailDestinatario) {
    return { ok: false, error: "El destinatario no tiene email cargado." };
  }

  const pdf = await generarPDF(doc.datos);
  await enviarEmailDocumento({
    para: doc.emailDestinatario,
    asunto: `Presupuesto de obra — ${doc.datos.direccion}`,
    titulo: "Presupuesto por trabajo de mantenimiento",
    cuerpo: `Te enviamos el presupuesto por el trabajo a realizar en ${doc.datos.direccion}. El documento adjunto tiene el detalle completo.`,
    tipo: "presupuesto",
    gestion_id: gestionId,
    adjunto: {
      filename: `presupuesto-${doc.datos.numero}.pdf`,
      contentBase64: pdf,
    },
  });

  const supabase = await createClient();
  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "presupuesto_enviado_pagador",
    actor_id: actual.id,
  });

  return { ok: true };
}

export async function registrarCobro(
  gestionId: string,
  medio: "transferencia" | "efectivo" | "otro"
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("gestiones")
    .update({ cobrado_en: new Date().toISOString(), medio_cobro: medio })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo registrar el cobro." };

  await registrarEvento(gestionId, "cobro_registrado", actual.id);
  return avanzarEtapa(gestionId, "liquidacion_tecnico");
}

export async function registrarLiquidacion(
  gestionId: string,
  datos: { monto: number; factura_ref: string }
): Promise<ActionResult> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (!datos.monto || datos.monto <= 0) {
    return { ok: false, error: "Indicá el monto liquidado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("gestiones")
    .update({
      liq_monto: datos.monto,
      liq_factura_ref: datos.factura_ref || null,
      liq_pagada_en: new Date().toISOString(),
    })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo registrar la liquidación." };

  const doc = await datosDocumento(gestionId, "comprobante");
  if (doc?.emailDestinatario) {
    const pdf = await generarPDF(doc.datos);
    await enviarEmailDocumento({
      para: doc.emailDestinatario,
      asunto: `Comprobante de liquidación — ${doc.datos.direccion}`,
      titulo: "Liquidación de tu trabajo",
      cuerpo: `Registramos el pago por el trabajo en ${doc.datos.direccion}. Adjuntamos el comprobante con el detalle.`,
      tipo: "comprobante_liquidacion",
      gestion_id: gestionId,
      adjunto: {
        filename: `comprobante-${doc.datos.numero}.pdf`,
        contentBase64: pdf,
      },
    });
  }

  await registrarEvento(gestionId, "liquidacion_registrada", actual.id);
  return avanzarEtapa(gestionId, "finalizado");
}
