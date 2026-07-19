// STORY-1007 — Walter: endpoint de chat del asistente. Excepción documentada a
// la regla "no rutas api" (ARQUITECTURA.md): el streaming de chat necesita un
// Response/SSE que useChat consume nativo — las server actions no lo soportan.
//
// Seguridad: la sesión se valida ACÁ, antes de tocar el LLM. El rol sale de
// obtenerUsuarioActual() (sesión) — el body solo trae mensajes. Las tools
// corren con el cliente Supabase de sesión (RLS). La API key vive solo en el
// server; el browser jamás habla con Anthropic directo.
import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { LIMITES, MODELO_ASISTENTE } from "@/features/asistente/config";
import { promptAsistente } from "@/features/asistente/prompt";
import { crearTools } from "@/features/asistente/tools";

export const maxDuration = 30;

// Rate limit simple por usuario (en memoria del proceso — suficiente para el
// despliegue actual de una instancia; guardrail de demo, no de facturación).
const ventanas = new Map<string, number[]>();
function excedeLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const ventana = (ventanas.get(usuarioId) ?? []).filter(
    (t) => ahora - t < 60 * 60 * 1000
  );
  if (ventana.length >= LIMITES.mensajesPorHora) return true;
  ventana.push(ahora);
  ventanas.set(usuarioId, ventana);
  return false;
}

// Los UIMessage llegan del cliente = input NO confiable: se acota cantidad,
// se filtran roles raros y se recorta el texto antes de tocar el modelo.
function sanitizarMensajes(mensajes: unknown): UIMessage[] | null {
  if (!Array.isArray(mensajes) || mensajes.length === 0) return null;
  const validos = mensajes.filter(
    (m): m is UIMessage =>
      !!m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      Array.isArray((m as UIMessage).parts)
  );
  if (validos.length === 0) return null;
  const ultimos = validos.slice(-LIMITES.mensajesHistorial);
  for (const m of ultimos) {
    for (const p of m.parts) {
      if (p.type === "text" && p.text.length > LIMITES.caracteresInput) {
        p.text = p.text.slice(0, LIMITES.caracteresInput);
      }
    }
  }
  const ultimo = ultimos.at(-1);
  if (ultimo?.role !== "user") return null;
  return ultimos;
}

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return Response.json({ error: "Sin sesión." }, { status: 401 });
  }
  if (excedeLimite(usuario.id)) {
    return Response.json(
      { error: "Alcanzaste el límite de mensajes por hora. Probá más tarde." },
      { status: 429 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const mensajes = sanitizarMensajes(body.messages);
  if (!mensajes) {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const resultado = streamText({
    model: anthropic(MODELO_ASISTENTE),
    system: promptAsistente(usuario),
    messages: await convertToModelMessages(mensajes),
    tools: crearTools(usuario),
    stopWhen: stepCountIs(LIMITES.pasosMaximos),
    maxOutputTokens: LIMITES.tokensSalida,
  });

  return resultado.toUIMessageStreamResponse({
    // El detalle real queda en el log del server; al cliente va un mensaje amable.
    onError: (error) => {
      console.error("[asistente]", error);
      return "No pude responder ahora. Probá de nuevo en un momento.";
    },
  });
}
