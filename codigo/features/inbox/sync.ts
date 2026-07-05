import { createAdminClient } from "@/shared/lib/supabase/admin";

// Núcleo de la sincronización Gmail → inbox_reportes. SIN chequeo de sesión:
// lo invocan el server action (con rol verificado) y la ruta de cron (con
// secreto verificado). Idempotente por unique(gmail_message_id).

async function accessTokenGmail(): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

function decodificarBase64Url(datos: string): string {
  return Buffer.from(
    datos.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

type ParteGmail = {
  mimeType?: string;
  body?: { data?: string };
  parts?: ParteGmail[];
};

function extraerTexto(parte: ParteGmail): string | null {
  if (parte.mimeType === "text/plain" && parte.body?.data) {
    return decodificarBase64Url(parte.body.data);
  }
  for (const p of parte.parts ?? []) {
    const texto = extraerTexto(p);
    if (texto) return texto;
  }
  return null;
}

export async function ejecutarSincronizacion(): Promise<
  { ok: true; nuevos: number } | { ok: false; error: string }
> {
  const token = await accessTokenGmail();
  if (!token) return { ok: false, error: "No se pudo conectar con Gmail." };
  const auth = { Authorization: `Bearer ${token}` };

  // Solo mails con "mantenimiento" en el asunto (casilla compartida) y sin
  // los emails del propio sistema. Sin is:unread: los auto-enviados nacen
  // leídos — la idempotencia es por gmail_message_id contra la DB.
  const consulta = encodeURIComponent(
    "in:inbox subject:mantenimiento -from:onboarding@resend.dev"
  );
  const lista = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${consulta}`,
    { headers: auth }
  );
  if (!lista.ok) return { ok: false, error: "Gmail rechazó la consulta." };
  const { messages } = (await lista.json()) as { messages?: { id: string }[] };
  if (!messages?.length) return { ok: true, nuevos: 0 };

  const admin = createAdminClient();
  const { data: existentes } = await admin
    .from("inbox_reportes")
    .select("gmail_message_id")
    .in("gmail_message_id", messages.map((m) => m.id));
  const yaIngestados = new Set(
    (existentes ?? []).map((e) => e.gmail_message_id)
  );

  let nuevos = 0;
  for (const m of messages.filter((m) => !yaIngestados.has(m.id))) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: auth }
    );
    if (!res.ok) continue;
    const msg = (await res.json()) as {
      id: string;
      snippet?: string;
      internalDate?: string;
      payload?: ParteGmail & { headers?: { name: string; value: string }[] };
    };

    const header = (nombre: string) =>
      msg.payload?.headers?.find(
        (h) => h.name.toLowerCase() === nombre.toLowerCase()
      )?.value ?? null;
    const cuerpo =
      (msg.payload ? extraerTexto(msg.payload) : null) ?? msg.snippet ?? "";

    const { error } = await admin.from("inbox_reportes").insert({
      gmail_message_id: msg.id,
      remitente: header("From"),
      asunto: header("Subject"),
      cuerpo: cuerpo.slice(0, 5000),
      recibido_en: msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : null,
    });
    if (!error) nuevos++;
  }

  return { ok: true, nuevos };
}
