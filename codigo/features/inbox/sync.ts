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
  if (!token) {
    // Visible en los logs de Vercel: si el refresh token muere, que se sepa
    console.error("inbox/sync: no se pudo obtener el access token de Gmail (¿refresh token revocado?)");
    return { ok: false, error: "No se pudo conectar con Gmail." };
  }
  const auth = { Authorization: `Bearer ${token}` };

  // Solo mails con "mantenimiento" en el asunto (casilla compartida) y sin
  // los emails del propio sistema. Sin is:unread: los auto-enviados nacen
  // leídos — la idempotencia es por gmail_message_id contra la DB.
  const consulta = encodeURIComponent(
    "in:inbox subject:mantenimiento -from:onboarding@resend.dev"
  );
  // Paginado completo: sin esto, los mails más viejos que la primera página
  // nunca vuelven a entrar a la ventana y se pierden.
  const messages: { id: string }[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${consulta}` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const lista = await fetch(url, { headers: auth });
    if (!lista.ok) {
      console.error(`inbox/sync: Gmail rechazó la consulta (HTTP ${lista.status})`);
      return { ok: false, error: "Gmail rechazó la consulta." };
    }
    const json = (await lista.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    messages.push(...(json.messages ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken && messages.length < 1000);
  if (!messages.length) return { ok: true, nuevos: 0 };

  const admin = createAdminClient();
  // En tandas: el .in() viaja por URL y con cientos de ids se pasa de largo
  const yaIngestados = new Set<string>();
  for (let i = 0; i < messages.length; i += 200) {
    const { data: existentes } = await admin
      .from("inbox_reportes")
      .select("gmail_message_id")
      .in("gmail_message_id", messages.slice(i, i + 200).map((m) => m.id));
    for (const e of existentes ?? []) yaIngestados.add(e.gmail_message_id);
  }

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
