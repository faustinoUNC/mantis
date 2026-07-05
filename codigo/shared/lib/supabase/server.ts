import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente de SERVIDOR con la sesión del usuario (respeta RLS).
// Es el client por defecto para todos los services.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll desde un Server Component: ignorable si hay middleware
            // refrescando la sesión.
          }
        },
      },
    }
  )
}
