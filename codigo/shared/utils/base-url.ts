// URL pública de la app, para armar links absolutos en emails (STORY-955).
// VERCEL_PROJECT_PRODUCTION_URL la expone Vercel solo (sin protocolo);
// NEXT_PUBLIC_APP_URL permite pisarla a mano si algún día hace falta.
export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
