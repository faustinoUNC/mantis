"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/empleados/types";
import { createClient } from "@/shared/lib/supabase/server";
import { errorCuil, normalizarCuil } from "@/shared/utils/cuil";
import {
  cuilCruzadoOtraPersona,
  duplicadoPersona,
  ERROR_DUPLICADO_DB,
} from "@/shared/utils/duplicados";
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
  const telefono = normalizarTelefono(datos.telefono);
  if (!telefono) {
    return { ok: false, error: "El teléfono es obligatorio." };
  }
  const errCuil = errorCuil(datos.documento, "CUIL/CUIT");
  if (errCuil) {
    return { ok: false, error: errCuil };
  }
  const supabase = await createClient();
  const fila = {
    nombre: datos.nombre,
    email: datos.email.trim().toLowerCase(),
    telefono,
    cuil: normalizarCuil(datos.documento),
  };
  const dup = await duplicadoPersona(supabase, tipo, fila, id);
  if (dup) return { ok: false, error: dup };
  // STORY-963: el mismo CUIL no puede ser de otra persona en la otra tabla.
  const cruzado = await cuilCruzadoOtraPersona(supabase, tipo, fila.cuil, fila.nombre, id);
  if (cruzado) return { ok: false, error: cruzado };
  const { error } = id
    ? await supabase.from(tipo).update(fila).eq("id", id)
    : await supabase.from(tipo).insert(fila);
  if (error) {
    return { ok: false, error: error.code === "23505" ? ERROR_DUPLICADO_DB : "No se pudo guardar." };
  }
  // Las personas se editan desde la propiedad (STORY-941): refrescar lista y detalles.
  revalidatePath("/cartera/propiedades");
  revalidatePath("/cartera/propiedades/[id]", "page");
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
  revalidatePath("/cartera/propiedades");
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

// ── Alta unificada "Administración" (STORY-922, achicada en STORY-949) ──
// Wizard sobre las tablas existentes — SIN entidad nueva. El alta crea SOLO
// propietario + propiedad (el legajo del inquilino se abre después, desde el
// detalle): así el único estado intermedio posible (propietario sin
// propiedades) es válido y no hace falta RPC.

async function resolverPersona(
  tipo: TipoPersona,
  ref: RefPersona
): Promise<{ id: string } | { error: string }> {
  if ("id" in ref) return { id: ref.id };
  if (!ref.nueva.nombre || !ref.nueva.email) {
    return { error: "Completá nombre y email." };
  }
  const telefono = normalizarTelefono(ref.nueva.telefono);
  if (!telefono) {
    return { error: "El teléfono es obligatorio." };
  }
  const errCuil = errorCuil(ref.nueva.cuil, "CUIL/CUIT");
  if (errCuil) {
    return { error: errCuil };
  }
  const supabase = await createClient();
  const fila = {
    nombre: ref.nueva.nombre,
    email: ref.nueva.email.trim().toLowerCase(),
    telefono,
    cuil: normalizarCuil(ref.nueva.cuil),
  };
  const dup = await duplicadoPersona(supabase, tipo, fila);
  if (dup) return { error: dup };
  // STORY-963: el mismo CUIL no puede ser de otra persona en la otra tabla.
  const cruzado = await cuilCruzadoOtraPersona(supabase, tipo, fila.cuil, fila.nombre);
  if (cruzado) return { error: cruzado };
  const { data, error } = await supabase.from(tipo).insert(fila).select("id").single();
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? ERROR_DUPLICADO_DB
          : `No se pudo guardar el ${tipo === "propietarios" ? "propietario" : "inquilino"}.`,
    };
  }
  return { id: data.id };
}

export async function crearAdministracion(datos: {
  propietario: RefPersona;
  propiedad: { direccion: string; tipo: string };
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
    .select(
      "id, direccion, tipo, activa, propietarios(id, nombre, email, telefono, documento:cuil, activo)"
    )
    .eq("id", id)
    .single();
  return data;
}

// Cambiar el propietario de una propiedad existente (STORY-941 — caso venta):
// uno ya cargado o uno nuevo, misma forma que el wizard de alta.
export async function cambiarPropietario(
  propiedadId: string,
  ref: RefPersona
): Promise<ActionResult> {
  const propietario = await resolverPersona("propietarios", ref);
  if ("error" in propietario) return { ok: false, error: propietario.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("propiedades")
    .update({ propietario_id: propietario.id })
    .eq("id", propiedadId);
  if (error) return { ok: false, error: "No se pudo cambiar el propietario." };

  revalidatePath("/cartera/propiedades");
  revalidatePath(`/cartera/propiedades/${propiedadId}`);
  return { ok: true };
}

// ── Legajos ──

export async function legajosDePropiedad(
  propiedadId: string
): Promise<Legajo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legajos")
    .select(
      "id, propiedad_id, inquilino_id, fecha_inicio, fecha_fin, inquilinos(id, nombre, email, telefono, documento:cuil, activo)"
    )
    .eq("propiedad_id", propiedadId)
    .order("fecha_inicio", { ascending: false });
  type Fila = Omit<Legajo, "inquilino_nombre" | "inquilino"> & {
    inquilinos: Persona | null;
  };
  return ((data ?? []) as unknown as Fila[]).map((l) => ({
    ...l,
    inquilino: l.inquilinos ?? null,
    inquilino_nombre: l.inquilinos?.nombre ?? "—",
  }));
}

// Un inquilino con legajo vigente no puede abrir otro (STORY-949): el
// desplegable de apertura solo ofrece a los que están libres.
export async function listarInquilinosSinLegajo(): Promise<Persona[]> {
  const supabase = await createClient();
  const [inquilinos, { data: vigentes }] = await Promise.all([
    listarPersonas("inquilinos"),
    supabase.from("legajos").select("inquilino_id").is("fecha_fin", null),
  ]);
  const ocupados = new Set((vigentes ?? []).map((v) => v.inquilino_id));
  return inquilinos.filter((i) => i.activo && !ocupados.has(i.id));
}

// El inquilino puede ser uno ya cargado o uno nuevo (STORY-941): al cambiar
// el ocupante de una propiedad existente, el alta se hace acá mismo.
export async function abrirLegajo(datos: {
  propiedad_id: string;
  inquilino: RefPersona;
  fecha_inicio: string;
}): Promise<ActionResult> {
  const inquilino = await resolverPersona("inquilinos", datos.inquilino);
  if ("error" in inquilino) return { ok: false, error: inquilino.error };

  const supabase = await createClient();
  // Revalida en el server lo que el desplegable ya filtra: una pestaña vieja
  // puede ofrecer un inquilino que mientras tanto abrió legajo en otro lado.
  const { data: vigente } = await supabase
    .from("legajos")
    .select("id")
    .eq("inquilino_id", inquilino.id)
    .is("fecha_fin", null)
    .limit(1)
    .maybeSingle();
  if (vigente) {
    return {
      ok: false,
      error: "Ese inquilino ya tiene un legajo vigente en otra propiedad.",
    };
  }
  const { error } = await supabase.from("legajos").insert({
    propiedad_id: datos.propiedad_id,
    inquilino_id: inquilino.id,
    fecha_inicio: datos.fecha_inicio,
  });
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
      "descripcion, etapa, costo_final, cargo_admin, cobrado_monto, pagador, creado_en, especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre)"
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
    cargo_admin: number | null;
    cobrado_monto: number | null;
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
        // STORY-942: el costo que ve el propietario es lo COBRADO (con fee
        // adentro) — el mismo número de su nota de cobro, sin delatar la
        // comisión. Fallback para obras sin cobro registrado.
        costo:
          g.cobrado_monto != null
            ? Number(g.cobrado_monto)
            : g.costo_final != null
              ? Number(g.costo_final) + Number(g.cargo_admin ?? 0)
              : null,
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
