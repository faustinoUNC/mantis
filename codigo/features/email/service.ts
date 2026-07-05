"use server";

import { createAdminClient } from "@/shared/lib/supabase/admin";

// ÚNICO punto de salida de emails (CLAUDE.md §3). Resend por fetch directo
// (desviación consciente: sin SDK ni React Email — Regla #0). Los fallos se
// loguean como 'fallido' y NUNCA rompen el flujo que los dispara.

const REMITENTE = "MANTIS <onboarding@resend.dev>";

// Todo valor dinámico se escapa antes de entrar al HTML del email
// (la dirección de la propiedad es texto cargado por usuarios).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plantilla(titulo: string, cuerpo: string): string {
  return `<!doctype html><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;font-weight:800;font-size:15px;letter-spacing:-0.02em;text-transform:uppercase;color:#18181b">Man<span style="color:#059669">—</span>tis</p>
    <h1 style="margin:0 0 10px;font-size:19px;letter-spacing:-0.01em;color:#18181b">${esc(titulo)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b">${esc(cuerpo)}</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 14px">
    <p style="margin:0;font-size:12px;color:#a1a1aa">Este correo es informativo — no hace falta responderlo. Ante cualquier consulta, contactá a la inmobiliaria.</p>
  </div></body>`;
}

async function enviarEmail(datos: {
  para: string;
  asunto: string;
  titulo: string;
  cuerpo: string;
  tipo: string;
  gestion_id?: string;
  adjunto?: { filename: string; contentBase64: string };
}): Promise<void> {
  const admin = createAdminClient();
  let estado = "enviado";
  let error: string | null = null;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [datos.para],
        subject: datos.asunto,
        html: plantilla(datos.titulo, datos.cuerpo),
        ...(datos.adjunto && {
          attachments: [
            {
              filename: datos.adjunto.filename,
              content: datos.adjunto.contentBase64,
            },
          ],
        }),
      }),
    });
    if (!res.ok) {
      estado = "fallido";
      error = (await res.text()).slice(0, 300);
    }
  } catch (e) {
    estado = "fallido";
    error = e instanceof Error ? e.message : "error desconocido";
  }

  await admin.from("emails_enviados").insert({
    para: datos.para,
    asunto: datos.asunto,
    tipo: datos.tipo,
    gestion_id: datos.gestion_id ?? null,
    estado,
    error,
  });
}

const EMAILS_ESTADO: Record<
  string,
  { asunto: string; titulo: string; cuerpo: (direccion: string) => string }
> = {
  reporte_recibido: {
    asunto: "Recibimos tu reporte de mantenimiento",
    titulo: "Tu reporte quedó registrado",
    cuerpo: (d) =>
      `La inmobiliaria ya está gestionando el mantenimiento reportado en ${d}. Te vamos a avisar cuando haya novedades.`,
  },
  tecnico_asignado: {
    asunto: "Un técnico va a atender tu reporte",
    titulo: "Técnico asignado",
    cuerpo: (d) =>
      `Ya hay un técnico asignado para el mantenimiento en ${d}. Se va a coordinar la visita a la brevedad.`,
  },
  resuelto: {
    asunto: "El mantenimiento quedó resuelto",
    titulo: "Trabajo terminado ✔",
    cuerpo: (d) =>
      `El mantenimiento en ${d} quedó terminado y verificado por la inmobiliaria. ¡Gracias por avisarnos!`,
  },
};

// Documentos de finanzas (nota de cobro / comprobante) con PDF adjunto.
export async function enviarEmailDocumento(datos: {
  para: string;
  asunto: string;
  titulo: string;
  cuerpo: string;
  tipo: string;
  gestion_id: string;
  adjunto: { filename: string; contentBase64: string };
}): Promise<void> {
  await enviarEmail(datos);
}

// Email de estado al INQUILINO del legajo de la gestión (PRD §8 — el
// inquilino recibe, nunca accede). Lookups con admin client: el flujo que
// dispara ya validó el acceso.
export async function emailEstadoGestion(
  gestionId: string,
  tipo: keyof typeof EMAILS_ESTADO
): Promise<void> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select("legajo_id, propiedades(direccion)")
    .eq("id", gestionId)
    .single();
  if (!g?.legajo_id) return; // propiedad sin inquilino — no hay a quién avisar

  const { data: legajo } = await admin
    .from("legajos")
    .select("inquilinos(email)")
    .eq("id", g.legajo_id)
    .single();
  const inquilino = legajo?.inquilinos as unknown as { email: string } | null;
  if (!inquilino?.email) return;

  const propiedad = g.propiedades as unknown as { direccion: string } | null;
  const def = EMAILS_ESTADO[tipo];
  await enviarEmail({
    para: inquilino.email,
    asunto: def.asunto,
    titulo: def.titulo,
    cuerpo: def.cuerpo(propiedad?.direccion ?? "tu propiedad"),
    tipo,
    gestion_id: gestionId,
  });
}
