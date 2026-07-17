"use server";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import { baseUrl } from "@/shared/utils/base-url";

// ÚNICO punto de salida de emails (CLAUDE.md §3). Resend por fetch directo
// (desviación consciente: sin SDK ni React Email — Regla #0). Los fallos se
// loguean como 'fallido' y NUNCA rompen el flujo que los dispara.

const REMITENTE = "MANTIS <onboarding@resend.dev>";

// HACK DE TESTING (hasta verificar dominio en Resend): el modo testing de
// Resend solo entrega a la dirección EXACTA de la cuenta — los alias con
// "+" rebotan. Se normaliza al enviar; el log guarda el destinatario real.
function destinoEntregable(para: string): string {
  const m = para.match(/^ausitesis\+[^@]+@gmail\.com$/i);
  return m ? "ausitesis@gmail.com" : para;
}

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

type Cta = { href: string; label: string };

// El saludo por nombre hace que se sepa a simple vista para quién es el
// mail (clave mientras la casilla de prueba es compartida). Se omite si no
// hay un nombre real ("—" es el fallback de datosDocumento).
function plantilla(
  titulo: string,
  cuerpo: string,
  destinatario?: string,
  cta?: Cta
): string {
  const nombre = destinatario?.trim();
  const saludo =
    nombre && nombre !== "—"
      ? `<p style="margin:0 0 14px;font-size:15px;color:#18181b">Hola, ${esc(nombre)}:</p>`
      : "";
  const boton = cta
    ? `<p style="margin:22px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:11px 22px;border-radius:8px">${esc(cta.label)}</a></p>
    <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa">Si el botón no funciona, copiá y pegá este enlace en el navegador:<br>${esc(cta.href)}</p>`
    : "";
  return `<!doctype html><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;font-weight:800;font-size:15px;letter-spacing:-0.02em;text-transform:uppercase;color:#18181b">Man<span style="color:#059669">—</span>tis</p>
    <h1 style="margin:0 0 10px;font-size:19px;letter-spacing:-0.01em;color:#18181b">${esc(titulo)}</h1>
    ${saludo}
    <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b">${esc(cuerpo)}</p>
    ${boton}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 14px">
    <p style="margin:0;font-size:12px;color:#a1a1aa">Este correo es informativo — no hace falta responderlo. Ante cualquier consulta, contactá a la inmobiliaria.</p>
  </div></body>`;
}

async function enviarEmail(datos: {
  para: string;
  destinatario?: string; // nombre para el saludo del cuerpo
  asunto: string;
  titulo: string;
  cuerpo: string;
  tipo: string;
  gestion_id?: string;
  adjunto?: { filename: string; contentBase64: string };
  cta?: Cta;
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
        to: [destinoEntregable(datos.para)],
        subject: datos.asunto,
        html: plantilla(datos.titulo, datos.cuerpo, datos.destinatario, datos.cta),
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
    asunto: "Nueva gestión de mantenimiento",
    titulo: "Gestión de mantenimiento registrada",
    cuerpo: (d) =>
      `La inmobiliaria está gestionando un mantenimiento en ${d}. Te vamos a avisar cuando haya novedades.`,
  },
  tecnico_asignado: {
    asunto: "Técnico asignado para el mantenimiento",
    titulo: "Técnico asignado",
    cuerpo: (d) =>
      `Ya hay un técnico asignado para el mantenimiento en ${d}. Se va a coordinar la visita a la brevedad.`,
  },
  resuelto: {
    asunto: "El mantenimiento quedó resuelto",
    titulo: "Trabajo terminado ✔",
    cuerpo: (d) =>
      `El mantenimiento en ${d} quedó terminado y verificado por la inmobiliaria.`,
  },
};

// Resultado del enrolamiento, al TÉCNICO (STORY-501 v1.2 — deuda de
// STORY-303: sin esto solo se enteraba al reintentar el login). Desde
// STORY-955 el aprobado no tiene contraseña todavía: el email trae el
// link para crearla.
export async function emailResultadoTecnico(
  tecnico: { nombre: string; email: string },
  resultado: "aprobado" | "rechazado",
  opciones?: { motivo?: string; linkCrearContrasena?: string }
): Promise<void> {
  const contenido =
    resultado === "aprobado"
      ? {
          asunto: "Tu solicitud fue aprobada",
          titulo: "¡Bienvenido a la red de técnicos!",
          cuerpo:
            "La inmobiliaria aprobó tu solicitud. Creá tu contraseña para empezar a usar el sistema.",
          cta: opciones?.linkCrearContrasena
            ? { href: opciones.linkCrearContrasena, label: "Crear tu contraseña" }
            : undefined,
        }
      : {
          // El reintento pisa la solicitud rechazada (STORY-958): el mail
          // invita a corregir y volver a enviarla.
          asunto: "Novedades sobre tu solicitud",
          titulo: "Tu solicitud fue rechazada",
          cuerpo: `La inmobiliaria revisó tu solicitud y no fue aprobada. Motivo: ${opciones?.motivo || "sin especificar"}. Si podés corregirlo, volvé a enviar la solicitud desde la página de registro.`,
          cta: {
            href: `${baseUrl()}/registro-tecnico`,
            label: "Volver a enviar la solicitud",
          },
        };
  await enviarEmail({
    para: tecnico.email,
    destinatario: tecnico.nombre,
    ...contenido,
    tipo: `tecnico_${resultado}`,
  });
}

// Verificación del correo del técnico recién registrado (STORY-955): la
// solicitud llega al staff recién cuando abre este link.
export async function emailVerificacionTecnico(
  tecnico: { nombre: string; email: string },
  link: string
): Promise<void> {
  await enviarEmail({
    para: tecnico.email,
    destinatario: tecnico.nombre,
    // Nombre en el asunto: rompe el agrupado de Gmail entre reintentos —
    // el link de cada mail anterior muere al reintentar y hay que abrir
    // el último (casilla de prueba compartida, STORY-958 v2).
    asunto: `Verificá tu correo, ${tecnico.nombre}`,
    titulo: "Falta un paso: verificá tu correo",
    cuerpo:
      "Recibimos tu solicitud para sumarte como técnico. Tocá el botón para confirmar que este correo es tuyo — recién ahí la inmobiliaria la va a revisar.",
    cta: { href: link, label: "Verificar mi correo" },
    tipo: "verificacion_email",
  });
}

// Link para crear/restablecer la contraseña (STORY-955/956): lo piden el
// propio usuario ("olvidé mi contraseña") o el admin (blanqueo de empleado).
export async function emailRecuperarContrasena(
  para: { nombre?: string; email: string },
  link: string,
  tipo: "recuperar_contrasena" | "restablecer_contrasena" = "recuperar_contrasena"
): Promise<void> {
  await enviarEmail({
    para: para.email,
    destinatario: para.nombre,
    asunto: "Restablecé tu contraseña",
    titulo: "Creá una contraseña nueva",
    cuerpo:
      tipo === "restablecer_contrasena"
        ? "La inmobiliaria pidió restablecer la contraseña de tu cuenta. Tocá el botón para elegir una nueva."
        : "Pediste restablecer tu contraseña. Tocá el botón para elegir una nueva. Si no fuiste vos, ignorá este correo.",
    cta: { href: link, label: "Crear contraseña nueva" },
    tipo,
  });
}

// Documentos de finanzas (nota de cobro / comprobante) con PDF adjunto.
export async function enviarEmailDocumento(datos: {
  para: string;
  destinatario?: string;
  asunto: string;
  titulo: string;
  cuerpo: string;
  tipo: string;
  gestion_id: string;
  adjunto: { filename: string; contentBase64: string };
}): Promise<void> {
  await enviarEmail(datos);
}

// Email de estado a inquilino y propietario de la gestión (PRD §8 — ninguno
// accede al sistema, solo reciben). Se avisa a los dos siempre: la
// inmobiliaria puede iniciar la gestión sin que ninguno la haya reportado,
// así que el texto no da por hecho quién reportó qué. Lookups con admin
// client: el flujo que dispara ya validó el acceso.
export async function emailEstadoGestion(
  gestionId: string,
  tipo: keyof typeof EMAILS_ESTADO
): Promise<void> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gestiones")
    .select("legajo_id, propiedades(direccion, propietarios(nombre, email))")
    .eq("id", gestionId)
    .single();
  if (!g) return;

  const propiedad = g.propiedades as unknown as {
    direccion: string;
    propietarios: { nombre: string; email: string } | null;
  } | null;

  const destinatarios: { nombre: string; email: string }[] = [];

  if (g.legajo_id) {
    const { data: legajo } = await admin
      .from("legajos")
      .select("inquilinos(nombre, email)")
      .eq("id", g.legajo_id)
      .single();
    const inquilino = legajo?.inquilinos as unknown as {
      nombre: string;
      email: string;
    } | null;
    if (inquilino?.email) destinatarios.push(inquilino);
  }

  const propietario = propiedad?.propietarios;
  if (propietario?.email) destinatarios.push(propietario);

  if (destinatarios.length === 0) return;

  const def = EMAILS_ESTADO[tipo];
  const direccion = propiedad?.direccion ?? "la propiedad";
  for (const destinatario of destinatarios) {
    await enviarEmail({
      para: destinatario.email,
      destinatario: destinatario.nombre,
      asunto: def.asunto,
      titulo: def.titulo,
      cuerpo: def.cuerpo(direccion),
      tipo,
      gestion_id: gestionId,
    });
  }
}
