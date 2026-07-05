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

// Arma los datos del documento. Admin client tras verificar rol: cruza
// legajo/inquilino/propietario que el rol administrativo no siempre lee.
async function datosDocumento(
  gestionId: string,
  tipo: "nota" | "comprobante"
): Promise<
  | { datos: DatosDocumento; emailDestinatario: string | null }
  | null
> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, pagador, costo_final, liq_monto, liq_factura_ref, legajo_id, creado_en, propiedades(direccion, propietarios(nombre, email)), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre, email), presupuestos(monto_materiales, monto_mano_obra, notas, estado)"
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
      notas: string | null;
      estado: string;
    }[];
  };
  const j = g as unknown as Joined;
  const aprobado = j.presupuestos.find((p) => p.estado === "aprobado");

  let destinatarioNombre = "—";
  let destinatarioRotulo = "Destinatario";
  let emailDestinatario: string | null = null;

  if (tipo === "comprobante") {
    destinatarioNombre = j.tecnico?.nombre ?? "—";
    destinatarioRotulo = "Técnico";
    emailDestinatario = j.tecnico?.email ?? null;
  } else if (g.pagador === "propietario") {
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

  const total =
    tipo === "comprobante"
      ? Number(g.liq_monto ?? g.costo_final ?? 0)
      : Number(g.costo_final ?? 0);

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
      detalleTrabajo: aprobado?.notas ?? null,
      tecnicoNombre: j.tecnico?.nombre ?? null,
      presupuesto: aprobado
        ? {
            materiales: Number(aprobado.monto_materiales),
            manoObra: Number(aprobado.monto_mano_obra),
          }
        : null,
      total,
      facturaRef: g.liq_factura_ref,
    },
  };
}

async function registrarEvento(gestionId: string, tipo: string, actorId: string) {
  const supabase = await createClient();
  await supabase
    .from("eventos_gestion")
    .insert({ gestion_id: gestionId, tipo, actor_id: actorId });
}

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

export async function descargarDocumento(
  gestionId: string,
  tipo: "nota" | "comprobante"
): Promise<ActionResult<{ base64: string; filename: string }>> {
  const actual = await exigirAdministrativo();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const doc = await datosDocumento(gestionId, tipo);
  if (!doc) return { ok: false, error: "Gestión no encontrada." };

  const base64 = await generarPDF(doc.datos);
  return {
    ok: true,
    data: {
      base64,
      filename: `${tipo === "nota" ? "nota-cobro" : "comprobante-liquidacion"}-${doc.datos.numero}.pdf`,
    },
  };
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
