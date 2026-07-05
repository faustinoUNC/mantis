import { NextResponse, type NextRequest } from "next/server";
import { ejecutarSincronizacion } from "@/features/inbox/sync";

// Sondeo automático de la casilla: pg_cron (Supabase) llama acá cada 1 min
// con el secreto compartido. Ruta permitida por NFR10 (webhooks y cron).
export async function POST(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const resultado = await ejecutarSincronizacion();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 502 });
}
