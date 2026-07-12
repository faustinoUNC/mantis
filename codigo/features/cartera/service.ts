"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/empleados/types";
import { createClient } from "@/shared/lib/supabase/server";
import { cuilValido, normalizarCuil } from "@/shared/utils/cuil";
import { normalizarTelefono } from "@/shared/utils/telefono";
import type { Legajo, Persona, Propiedad, RefPersona, TipoPersona } from "./types";

// RLS staff-only hace cumplir los permisos en las 4 tablas de cartera.

// Cuenta gestiones no terminales por propiedad o legajo, para bloquear bajas
// (STORY-924). Admin client (defensa en profundidad estilo datosResumen): la
// RLS limita al gestor de mantenimiento a SUS gestiones y acá hay que ver las
// de todos; los ids vienen de lecturas de cartera con el client de sesión.
async function contarGestionesAbiertas(
  columna: "propiedad_id" | "legajo_id",
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  const { createAdminClient } = await import("@/shared/lib/supabase/admin");
  const admin = createAdminClient();
  const { count } = await admin
    .from("gestiones")
    .select("id", { count: "exact", head: true })
    .in(columna, ids)
    .not("etapa", "in", "(finalizado,cancelada)");
  return count ?? 0;
}

// ── Propietarios e inquilinos (misma forma, tablas separadas) ──

export async function listarPersonas(tipo: TipoPersona): Promise<Persona[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(tipo)
    .select("id, nombre, email, telefono, documento:cuil, activo")
    .order("nombre");
  return (data ?? []) as unknown as Persona[];
}

export async function guardarPersona(
  tipo: TipoPersona,
  datos: { nombre: string; email: string; telefono: string; documento: string },
  id?: string
): Promise<ActionResult> {
  if (datos.documento && !cuilValido(datos.documento)) {
    return { ok: false, error: "El CUIL/CUIT no es válido (11 dígitos)." };
  }
  const supabase = await createClient();
  const fila = {
    nombre: datos.nombre,
    email: datos.email,
    telefono: normalizarTelefono(datos.telefono) || null,
    cuil: datos.documento ? normalizarCuil(datos.documento) : null,
  };
  const { error } = id
    ? await supabase.from(tipo).update(fila).eq("id", id)
    : await supabase.from(tipo).insert(fila);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath(`/cartera/${tipo}`);
  return { ok: true };
}

export async function cambiarEstadoPersona(
  tipo: TipoPersona,
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  // Baja con validación de negocio (STORY-924); reactivar no valida nada.
  if (!activo) {
    if (tipo === "inquilinos") {
      const { data: legajos } = await supabase
        .from("legajos")
        .select("id, fecha_fin")
        .eq("inquilino_id", id);
      if ((legajos ?? []).some((l) => l.fecha_fin === null)) {
        return {
          ok: false,
          error: "Tiene un legajo vigente — cerralo desde la propiedad antes de desactivarlo.",
        };
      }
      // legajo_id de la gestión es snapshot: un legajo ya cerrado puede
      // tener una gestión viva, por eso se miran TODOS sus legajos.
      const abiertas = await contarGestionesAbiertas(
        "legajo_id",
        (legajos ?? []).map((l) => l.id)
      );
      if (abiertas > 0) {
        return {
          ok: false,
          error: `Tiene ${abiertas} gestión(es) abierta(s) — finalizalas o cancelalas antes de desactivarlo.`,
        };
      }
    } else {
      const { data: propiedades } = await supabase
        .from("propiedades")
        .select("id")
        .eq("propietario_id", id);
      const abiertas = await contarGestionesAbiertas(
        "propiedad_id",
        (propiedades ?? []).map((p) => p.id)
      );
      if (abiertas > 0) {
        return {
          ok: false,
          error: `Tiene ${abiertas} gestión(es) abierta(s) en sus propiedades — finalizalas o cancelalas antes de desactivarlo.`,
        };
      }
    }
  }

  const { error } = await supabase.from(tipo).update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };
  revalidatePath(`/cartera/${tipo}`);
  return { ok: true };
}

// ── Propiedades ──

export async function listarPropiedades(): Promise<Propiedad[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propiedades")
    .select(
      "id, direccion, tipo, propietario_id, activa, propietarios(nombre), legajos(id, fecha_fin, inquilinos(nombre))"
    )
    .order("direccion");
  type Fila = {
    id: string;
    direccion: string;
    tipo: string | null;
    propietario_id: string;
    activa: boolean;
    propietarios: { nombre: string } | { nombre: string }[] | null;
    legajos: {
      id: string;
      fecha_fin: string | null;
      inquilinos: { nombre: string } | null;
    }[];
  };
  return ((data ?? []) as unknown as Fila[]).map((p) => {
    const prop = Array.isArray(p.propietarios)
      ? p.propietarios[0]
      : p.propietarios;
    const vigente = p.legajos.find((l) => l.fecha_fin === null);
    return {
      id: p.id,
      direccion: p.direccion,
      tipo: p.tipo,
      propietario_id: p.propietario_id,
      propietario_nombre: prop?.nombre ?? "—",
      activa: p.activa,
      ocupada: Boolean(vigente),
      inquilino_nombre: vigente?.inquilinos?.nombre ?? null,
    };
  });
}

// ── Alta unificada "Administración" (STORY-922) ──
// Wizard sobre las tablas existentes — SIN entidad nueva. Inserts secuenciales:
// todo estado intermedio es válido (propietario sin propiedades, propiedad
// desocupada), así que un fallo parcial nunca corrompe y no hace falta RPC.

async function resolverPersona(
  tipo: TipoPersona,
  ref: RefPersona
): Promise<{ id: string } | { error: string }> {
  if ("id" in ref) return { id: ref.id };
  if (!ref.nueva.nombre || !ref.nueva.email) {
    return { error: "Completá nombre y email." };
  }
  if (ref.nueva.cuil && !cuilValido(ref.nueva.cuil)) {
    return { error: "El CUIL/CUIT no es válido (11 dígitos)." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tipo)
    .insert({
      nombre: ref.nueva.nombre,
      email: ref.nueva.email,
      telefono: normalizarTelefono(ref.nueva.telefono) || null,
      cuil: ref.nueva.cuil ? normalizarCuil(ref.nueva.cuil) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: `No se pudo guardar el ${tipo === "propietarios" ? "propietario" : "inquilino"}.` };
  }
  return { id: data.id };
}

export async function crearAdministracion(datos: {
  propietario: RefPersona;
  propiedad: { direccion: string; tipo: string };
  inquilino: { persona: RefPersona; fecha_inicio: string } | null;
}): Promise<ActionResult<{ propiedadId: string }>> {
  if (!datos.propiedad.direccion) {
    return { ok: false, error: "Completá la dirección de la propiedad." };
  }

  const propietario = await resolverPersona("propietarios", datos.propietario);
  if ("error" in propietario) return { ok: false, error: propietario.error };

  const supabase = await createClient();
  const { data: propiedad, error: errorPropiedad } = await supabase
    .from("propiedades")
    .insert({
      direccion: datos.propiedad.direccion,
      tipo: datos.propiedad.tipo || null,
      propietario_id: propietario.id,
    })
    .select("id")
    .single();
  if (errorPropiedad || !propiedad) {
    return {
      ok: false,
      error: "No se pudo crear la propiedad. El propietario quedó guardado en la cartera.",
    };
  }

  if (datos.inquilino) {
    const inquilino = await resolverPersona("inquilinos", datos.inquilino.persona);
    if ("error" in inquilino) {
      return {
        ok: false,
        error: `${inquilino.error} La propiedad quedó creada como desocupada — podés abrir el legajo desde su detalle.`,
      };
    }
    const { error: errorLegajo } = await supabase.from("legajos").insert({
      propiedad_id: propiedad.id,
      inquilino_id: inquilino.id,
      fecha_inicio: datos.inquilino.fecha_inicio,
    });
    if (errorLegajo) {
      return {
        ok: false,
        error: "La propiedad quedó creada, pero no se pudo abrir el legajo — abrilo desde su detalle.",
      };
    }
  }

  revalidatePath("/cartera/propiedades");
  return { ok: true, data: { propiedadId: propiedad.id } };
}

export async function cambiarEstadoPropiedad(
  id: string,
  activa: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!activa) {
    const abiertas = await contarGestionesAbiertas("propiedad_id", [id]);
    if (abiertas > 0) {
      return {
        ok: false,
        error: `La propiedad tiene ${abiertas} gestión(es) abierta(s) — finalizalas o cancelalas antes de desactivarla.`,
      };
    }
  }
  const { error } = await supabase
    .from("propiedades")
    .update({ activa })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };
  revalidatePath("/cartera/propiedades");
  return { ok: true };
}

export async function obtenerPropiedad(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propiedades")
    .select("id, direccion, tipo, activa, propietarios(id, nombre, email)")
    .eq("id", id)
    .single();
  return data;
}

// ── Legajos ──

export async function legajosDePropiedad(
  propiedadId: string
): Promise<Legajo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legajos")
    .select("id, propiedad_id, inquilino_id, fecha_inicio, fecha_fin, inquilinos(nombre)")
    .eq("propiedad_id", propiedadId)
    .order("fecha_inicio", { ascending: false });
  type Fila = Omit<Legajo, "inquilino_nombre"> & {
    inquilinos: { nombre: string } | null;
  };
  return ((data ?? []) as unknown as Fila[]).map((l) => ({
    ...l,
    inquilino_nombre: l.inquilinos?.nombre ?? "—",
  }));
}

export async function abrirLegajo(datos: {
  propiedad_id: string;
  inquilino_id: string;
  fecha_inicio: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("legajos").insert(datos);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya hay un legajo vigente en esta propiedad. Cerralo primero."
        : "No se pudo abrir el legajo.",
    };
  }
  revalidatePath(`/cartera/propiedades/${datos.propiedad_id}`);
  return { ok: true };
}

export async function cerrarLegajo(
  id: string,
  propiedadId: string,
  fechaFin: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // El caller debe poder VER el legajo según RLS antes de contar gestiones
  // con el admin client (mismo criterio que datosResumen).
  const { data: visible } = await supabase
    .from("legajos")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!visible) return { ok: false, error: "No se pudo cerrar el legajo." };

  const abiertas = await contarGestionesAbiertas("legajo_id", [id]);
  if (abiertas > 0) {
    return {
      ok: false,
      error: `El legajo tiene ${abiertas} gestión(es) abierta(s) — finalizalas o cancelalas antes de cerrarlo.`,
    };
  }

  const { error } = await supabase
    .from("legajos")
    .update({ fecha_fin: fechaFin })
    .eq("id", id)
    .is("fecha_fin", null);
  if (error) {
    return {
      ok: false,
      error: error.code === "23514"
        ? "La fecha de fin no puede ser anterior al inicio."
        : "No se pudo cerrar el legajo.",
    };
  }
  revalidatePath(`/cartera/propiedades/${propiedadId}`);
  return { ok: true };
}

// ── Resumen de obras por legajo (STORY-802) ──

async function datosResumen(legajoId: string) {
  const { obtenerUsuarioActual } = await import("@/features/auth/service");
  const actual = await obtenerUsuarioActual();
  if (
    !actual ||
    !["administrador", "gestor_mantenimiento", "gestor_administrativo"].includes(actual.rol)
  ) {
    return null;
  }

  // Defensa en profundidad: el caller debe poder VER este legajo según RLS
  // (hoy toda la cartera es staff-only; si mañana se acota, esto lo respeta).
  const sesion = await createClient();
  const { data: visible } = await sesion
    .from("legajos")
    .select("id")
    .eq("id", legajoId)
    .maybeSingle();
  if (!visible) return null;

  // Admin client SOLO para las gestiones: el resumen debe incluir las de
  // TODOS los gestores (la RLS de gestiones limita al gestor a las propias).
  const { createAdminClient } = await import("@/shared/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: legajo } = await admin
    .from("legajos")
    .select(
      "fecha_inicio, fecha_fin, inquilinos(nombre), propiedades(direccion, propietarios(nombre, email))"
    )
    .eq("id", legajoId)
    .single();
  if (!legajo) return null;

  const { data: gestiones } = await admin
    .from("gestiones")
    .select(
      "descripcion, etapa, costo_final, pagador, creado_en, especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre)"
    )
    .eq("legajo_id", legajoId)
    .order("creado_en");

  type L = {
    fecha_inicio: string;
    fecha_fin: string | null;
    inquilinos: { nombre: string } | null;
    propiedades: {
      direccion: string;
      propietarios: { nombre: string; email: string } | null;
    } | null;
  };
  type G = {
    descripcion: string;
    etapa: string;
    costo_final: number | null;
    pagador: string | null;
    creado_en: string;
    especialidades: { nombre: string } | null;
    tecnico: { nombre: string } | null;
  };
  const l = legajo as unknown as L;
  const fechaCorta = (f: string) =>
    new Date(`${f.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR");

  return {
    emailPropietario: l.propiedades?.propietarios?.email ?? null,
    datos: {
      direccion: l.propiedades?.direccion ?? "—",
      propietario: l.propiedades?.propietarios?.nombre ?? "—",
      inquilino: l.inquilinos?.nombre ?? "—",
      periodo: `${fechaCorta(l.fecha_inicio)} — ${l.fecha_fin ? fechaCorta(l.fecha_fin) : "vigente"}`,
      fecha: new Date().toLocaleDateString("es-AR"),
      obras: ((gestiones ?? []) as unknown as G[]).map((g) => ({
        fecha: fechaCorta(g.creado_en),
        especialidad: g.especialidades?.nombre ?? "—",
        descripcion: g.descripcion,
        tecnico: g.tecnico?.nombre ?? null,
        costo: g.costo_final != null ? Number(g.costo_final) : null,
        pagador: g.pagador,
        finalizada: g.etapa === "finalizado",
      })),
    },
  };
}

export async function descargarResumenObras(
  legajoId: string
): Promise<ActionResult<{ base64: string; filename: string }>> {
  const r = await datosResumen(legajoId);
  if (!r) return { ok: false, error: "No tenés permiso o el legajo no existe." };

  const { generarResumenPDF } = await import("./resumen-pdf");
  const base64 = await generarResumenPDF(r.datos);
  return {
    ok: true,
    data: { base64, filename: `resumen-obras-${legajoId.slice(0, 8)}.pdf` },
  };
}

export async function enviarResumenObras(legajoId: string): Promise<ActionResult> {
  const r = await datosResumen(legajoId);
  if (!r) return { ok: false, error: "No tenés permiso o el legajo no existe." };
  if (!r.emailPropietario) {
    return { ok: false, error: "El propietario no tiene email cargado." };
  }

  const { generarResumenPDF } = await import("./resumen-pdf");
  const { enviarEmailDocumento } = await import("@/features/email/service");
  const base64 = await generarResumenPDF(r.datos);
  await enviarEmailDocumento({
    para: r.emailPropietario,
    // STORY-935: saludo por nombre, como el resto de los emails
    destinatario: r.datos.propietario,
    asunto: `Resumen de obras — ${r.datos.direccion}`,
    titulo: "Resumen de obras de tu propiedad",
    cuerpo: `Te enviamos el detalle de los trabajos de mantenimiento realizados en ${r.datos.direccion} durante el período ${r.datos.periodo}.`,
    tipo: "resumen_obras",
    gestion_id: undefined as unknown as string,
    adjunto: {
      filename: `resumen-obras-${legajoId.slice(0, 8)}.pdf`,
      contentBase64: base64,
    },
  });
  return { ok: true };
}
