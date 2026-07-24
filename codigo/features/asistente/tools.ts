// STORY-1007 — Walter: catálogo de tools por rol. Módulo SERVER-ONLY (lo
// importa solo el route handler del asistente — nunca un client component).
//
// Seguridad (3 capas, ninguna sola alcanza):
//   1. Este catálogo se construye con el rol de la SESIÓN (obtenerUsuarioActual
//      en el route handler) — el rol jamás viaja desde el cliente.
//   2. Cada tool reusa los services de features/* con sus propias validaciones.
//   3. Los services usan el cliente Supabase de sesión → RLS scopea (ownership
//      del gestor, técnico solo lo suyo). PROHIBIDO el admin client acá.
import { tool } from "ai";
import { z } from "zod";
import type { Rol, UsuarioActual } from "@/features/auth/types";
import { historialGlobal, historialSistema } from "@/features/auditoria/service";
import {
  historialPropiedad,
  listarPersonas,
  listarPropiedades,
} from "@/features/cartera/service";
import { listarEmpleados } from "@/features/empleados/service";
import { listarEspecialidades } from "@/features/especialidades/service";
import { listarInbox } from "@/features/inbox/service";
import {
  estadisticasTecnicos,
  gestionesArchivadas,
  obtenerGestion,
  tableroGestiones,
} from "@/features/gestiones/service";
import { ETAPAS, ETAPAS_TERMINALES, type GestionResumen, type StatsTecnico } from "@/features/gestiones/types";
import { listarAdelantos } from "@/features/finanzas/consultas";
import { obtenerMetricas, type Metricas } from "@/features/metricas/service";
import { analizarPatronFondo } from "@/features/patrones-fondo/service";
import { misNotificaciones } from "@/features/notificaciones/service";
import { NOMBRE_ROL, RUTA_POR_ROL } from "@/features/auth/types";
import { listarTecnicos, misFranjas } from "@/features/tecnicos/service";
import { DIAS } from "@/features/tecnicos/types";
import { rutaPermitida } from "./config";

const ETIQUETA_ETAPA: Record<string, string> = {
  ...Object.fromEntries(ETAPAS.map((e) => [e.id, e.label])),
  cancelada: "Cancelada",
};

const ETAPA_IDS = [...ETAPAS.map((e) => e.id), "cancelada"] as unknown as [string, ...string[]];

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : null;

const plata = (n: number | null | undefined) =>
  n == null ? null : `$${Math.round(Number(n)).toLocaleString("es-AR")}`;

const trunc = (s: string | null | undefined, n: number) =>
  !s ? null : s.length > n ? `${s.slice(0, n)}…` : s;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Resumen compacto de una gestión PARA EL MODELO (nombres legibles, sin UUIDs
// sueltos — el id va aparte para detalle_gestion / deep links).
function compactar(g: GestionResumen) {
  return {
    id: g.id,
    descripcion: trunc(g.descripcion, 90),
    etapa: ETIQUETA_ETAPA[g.etapa] ?? g.etapa,
    urgente: g.urgencia === "urgente" || undefined,
    especialidad: g.especialidad,
    direccion: g.direccion,
    tecnico: g.tecnico_nombre,
    gestor: g.gestor_nombre,
    creada: fecha(g.creado_en),
    presupuesto_esperando_decision: g.presupuesto_pendiente || undefined,
    conformidad_rechazada: g.conformidad_rechazada || undefined,
    tecnico_aviso_no_puede_continuar: g.aviso_no_continua_en ? true : undefined,
    surgio_de_otra_gestion: g.gestion_origen_id ? true : undefined,
  };
}

function compactarStats(s: StatsTecnico | null | undefined) {
  if (!s) return null;
  return {
    estrellas: s.estrellas != null ? Math.round(s.estrellas * 10) / 10 : null,
    calificaciones: s.nCalif,
    desvio_presupuesto_pct: s.desvioPct,
    desvio_plazo_pct: s.desvioPlazoPct,
    obras_activas: s.obrasActivas,
    obras_realizadas: s.obrasRealizadas,
    rechazo_asignaciones_pct: s.pctRechazoAsig,
    abandonos: s.abandonos,
  };
}

// ── STORY-1026: pivoteo server-side para la tool `graficar` ──
// El modelo elige el cruce (dimensión × métrica); los NÚMEROS salen siempre de
// acá — mismos datos que Informes (obtenerMetricas, RLS de sesión). El mismo
// output alimenta el gráfico del cliente y el comentario del modelo, así el
// texto y el gráfico no pueden contradecirse (la falla del Walter v1).

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TOPE_GRUPOS = 12;

export type ArgsGrafico = {
  titulo: string;
  agrupar_por: "tecnico" | "gestor" | "especialidad" | "etapa" | "mes";
  metrica:
    | "cantidad"
    | "monto_cobrado"
    | "fee_inmobiliaria"
    | "tiempo_ciclo_dias"
    | "calificacion_promedio"
    | "dias_en_etapa";
  estado?: "activas" | "finalizadas" | "todas";
  periodo?: "este_mes" | "ultimos_3_meses" | "ultimos_6_meses" | "ultimo_anio" | "historico";
};

const labelMes = (clave: string) =>
  `${MESES_CORTOS[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`;

// Días promedio de permanencia por etapa (misma derivación que los cuellos de
// botella de metricas_negocio, sobre el event log completo).
function permanenciaPorEtapa(eventos: Metricas["eventos"]) {
  const porGestion = new Map<string, { aEtapa: string | null; t: number }[]>();
  for (const e of eventos) {
    if (e.tipo !== "transicion") continue;
    const lista = porGestion.get(e.gestionId) ?? [];
    lista.push({ aEtapa: e.aEtapa, t: new Date(e.creadoEn).getTime() });
    porGestion.set(e.gestionId, lista);
  }
  const acum = new Map<string, { total: number; n: number }>();
  for (const evs of porGestion.values()) {
    const orden = [...evs].sort((a, b) => a.t - b.t);
    for (let i = 0; i < orden.length - 1; i++) {
      const etapa = orden[i].aEtapa;
      if (!etapa) continue;
      const dias = (orden[i + 1].t - orden[i].t) / 86400000;
      const acc = acum.get(etapa) ?? { total: 0, n: 0 };
      acc.total += dias;
      acc.n += 1;
      acum.set(etapa, acc);
    }
  }
  return acum;
}

export function armarGrafico(m: Metricas, args: ArgsGrafico) {
  const { agrupar_por, metrica } = args;
  const estado = args.estado ?? "todas";
  const periodo = args.periodo ?? "historico";
  const titulo = args.titulo.trim().slice(0, 60) || "Gráfico";

  // Permanencia por etapa: cruce especial que sale del event log, no de filas.
  if (metrica === "dias_en_etapa") {
    if (agrupar_por !== "etapa") {
      return { error: "dias_en_etapa solo se cruza con agrupar_por: etapa. Rearmá el gráfico así." };
    }
    const serie = [...permanenciaPorEtapa(m.eventos).entries()]
      .map(([etapa, v]) => ({
        label: ETIQUETA_ETAPA[etapa] ?? etapa,
        valor: Math.round((v.total / v.n) * 10) / 10,
      }))
      .sort((a, b) => b.valor - a.valor);
    if (!serie.length) return { error: "Todavía no hay historial de etapas para graficar." };
    return { titulo, tipo: "barras", unidad: "días", serie };
  }

  // Las métricas de plata/ciclo son de gestiones COBRADAS (hechos congelados):
  // filtran y fechan por cobradoEn; el resto, por creadoEn.
  const usaCobro = metrica === "monto_cobrado" || metrica === "fee_inmobiliaria" || metrica === "tiempo_ciclo_dias";
  const ahora = new Date();
  const desde =
    periodo === "este_mes"
      ? new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()
      : periodo === "historico"
        ? null
        : ahora.getTime() -
          { ultimos_3_meses: 90, ultimos_6_meses: 180, ultimo_anio: 365 }[periodo] * 86400000;

  let filas = m.filas;
  if (estado === "activas") filas = filas.filter((f) => !ETAPAS_TERMINALES.has(f.etapa));
  if (estado === "finalizadas") filas = filas.filter((f) => f.etapa === "finalizado");
  if (usaCobro) filas = filas.filter((f) => f.cobradoEn && f.cobradoMonto != null);
  if (desde != null) {
    filas = filas.filter((f) => new Date((usaCobro ? f.cobradoEn : f.creadoEn) as string).getTime() >= desde);
  }

  const clave = (f: Metricas["filas"][number]): string | null => {
    switch (agrupar_por) {
      case "tecnico":
        return f.tecnicoNombre;
      case "gestor":
        return f.gestorNombre;
      case "especialidad":
        return f.especialidad;
      case "etapa":
        return ETIQUETA_ETAPA[f.etapa] ?? f.etapa;
      case "mes":
        return ((usaCobro ? f.cobradoEn : f.creadoEn) as string).slice(0, 7);
    }
  };

  // El mes corriente se marca "(en curso)": es parcial — Informes directamente
  // no lo dibuja en sus series (ventanaUtil); acá se muestra pero avisado.
  const mesActual = new Date().toISOString().slice(0, 7);
  const esPromedio = metrica === "tiempo_ciclo_dias" || metrica === "calificacion_promedio";
  const acum = new Map<string, { total: number; n: number }>();
  for (const f of filas) {
    const k = clave(f);
    if (k == null) continue; // sin técnico/gestor asignado: no es un grupo
    let v: number | null = null;
    if (metrica === "cantidad") v = 1;
    else if (metrica === "monto_cobrado") v = Number(f.cobradoMonto ?? 0);
    else if (metrica === "fee_inmobiliaria") v = Number(f.cobradoFee ?? 0);
    else if (metrica === "tiempo_ciclo_dias")
      v = (new Date(f.cobradoEn as string).getTime() - new Date(f.creadoEn).getTime()) / 86400000;
    else if (metrica === "calificacion_promedio") v = f.estrellas;
    if (v == null || v < 0) continue; // sin dato no hay promedio que valga
    const acc = acum.get(k) ?? { total: 0, n: 0 };
    acc.total += v;
    acc.n += 1;
    acum.set(k, acc);
  }

  const redondeo = metrica === "cantidad" ? (x: number) => x
    : esPromedio ? (x: number) => Math.round(x * 10) / 10
    : (x: number) => Math.round(x);
  let serie = [...acum.entries()].map(([k, v]) => ({
    label:
      agrupar_por === "mes"
        ? k === mesActual
          ? `${labelMes(k)} (en curso)`
          : labelMes(k)
        : k,
    _orden: k,
    valor: redondeo(esPromedio ? v.total / v.n : metrica === "cantidad" ? v.n : v.total),
  }));
  if (!serie.length) {
    return { error: "No hay datos para ese cruce con esos filtros. Probá otro período o estado, o avisale al usuario." };
  }

  serie =
    agrupar_por === "mes"
      ? serie.sort((a, b) => a._orden.localeCompare(b._orden))
      : serie.sort((a, b) => b.valor - a.valor);

  let mostrando_top: number | undefined;
  if (serie.length > TOPE_GRUPOS) {
    if (esPromedio) {
      mostrando_top = TOPE_GRUPOS;
      serie = serie.slice(0, TOPE_GRUPOS);
    } else {
      const resto = serie.slice(TOPE_GRUPOS - 1);
      serie = [
        ...serie.slice(0, TOPE_GRUPOS - 1),
        { label: "Otros", _orden: "~", valor: resto.reduce((s, x) => s + x.valor, 0) },
      ];
    }
  }

  const unidad =
    metrica === "cantidad" ? "gestiones"
    : metrica === "tiempo_ciclo_dias" ? "días"
    : metrica === "calificacion_promedio" ? "estrellas"
    : "$";
  return {
    titulo,
    tipo: agrupar_por === "mes" ? "linea" : "barras",
    unidad,
    serie: serie.map(({ label, valor }) => ({ label, valor })),
    ...(esPromedio ? {} : { total: serie.reduce((s, x) => s + x.valor, 0) }),
    ...(mostrando_top && { mostrando_top }),
  };
}

// Errores SIEMPRE escritos para el modelo (jamás stack traces): el modelo los
// convierte en una disculpa amable y sigue.
function seguro<A, R>(fn: (args: A) => Promise<R>) {
  return async (args: A): Promise<R | { error: string }> => {
    try {
      return await fn(args);
    } catch {
      return { error: "No pude consultar esos datos ahora. Probá de nuevo en un momento." };
    }
  };
}

export function crearTools(usuario: UsuarioActual) {
  const rol = usuario.rol;
  const esStaff = rol !== "tecnico";
  const veTecnicos = rol === "administrador" || rol === "gestor_mantenimiento";
  const veCartera = esStaff;
  const esAdmin = rol === "administrador";
  // STORY-1019: espejo del guard de /finanzas — si no puede entrar a
  // Finanzas, su asistente tampoco sabe de adelantos.
  const veFinanzas = rol === "administrador" || rol === "gestor_administrativo";

  // ── Compartidas (todos los roles) ──

  const buscar_gestiones = tool({
    description:
      "Buscá gestiones activas (las del alcance del usuario) filtrando por etapa, urgencia, texto libre (dirección, descripción, propietario, inquilino) o técnico. Usala cuando pregunten qué gestiones hay en tal etapa, de tal dirección o de tal técnico. Devuelve una lista compacta con id para detalle_gestion o para el deep link /gestiones/<id>.",
    inputSchema: z.object({
      etapa: z.enum(ETAPA_IDS).optional().describe("Etapa exacta del funnel"),
      urgencia: z.enum(["urgente", "normal"]).optional(),
      texto: z.string().optional().describe("Búsqueda libre: dirección, descripción, propietario o inquilino"),
      tecnico: z.string().optional().describe("Nombre (o parte) del técnico asignado"),
    }),
    execute: seguro(async ({ etapa, urgencia, texto, tecnico }) => {
      const todas = await tableroGestiones();
      let lista = todas;
      if (etapa) lista = lista.filter((g) => g.etapa === etapa);
      if (urgencia) lista = lista.filter((g) => g.urgencia === urgencia);
      if (tecnico) {
        const t = norm(tecnico);
        lista = lista.filter((g) => g.tecnico_nombre && norm(g.tecnico_nombre).includes(t));
      }
      if (texto) {
        const t = norm(texto);
        lista = lista.filter((g) =>
          [g.direccion, g.descripcion, g.propietario_nombre, g.inquilino_nombre]
            .filter(Boolean)
            .some((c) => norm(c as string).includes(t))
        );
      }
      return {
        total: lista.length,
        mostrando: Math.min(lista.length, 15),
        gestiones: lista.slice(0, 15).map(compactar),
      };
    }),
  });

  const detalle_gestion = tool({
    description:
      "El detalle completo de UNA gestión por su id (conseguilo antes con buscar_gestiones o mis_pendientes): etapa, presupuestos, avances, conformidad, montos, contacto para coordinar la visita, calificación y últimos movimientos. Usala para 'contame de la gestión X' o '¿en qué está lo de tal dirección?'.",
    inputSchema: z.object({
      id: z.string().uuid().describe("El id de la gestión"),
    }),
    execute: seguro(async ({ id }) => {
      const g = await obtenerGestion(id);
      if (!g) return { error: "No encontré esa gestión (o no está en tu alcance)." };
      const aprobado = g.presupuestos.find((p) => p.estado === "aprobado");
      return {
        ...compactar(g),
        direccion_completa: g.propiedad_unidad ? `${g.direccion} — ${g.propiedad_unidad}` : g.direccion,
        propietario: g.propietario_nombre,
        inquilino: g.inquilino_nombre,
        // STORY-1048: al técnico en una propiedad desocupada, Walter tampoco le
        // filtra al propietario — coordina el acceso con la inmobiliaria.
        contacto_para_visita:
          g.contacto_cliente?.tipo === "inmobiliaria"
            ? { tipo: "inmobiliaria", nota: "Propiedad desocupada — coordinar el acceso con la inmobiliaria" }
            : g.contacto_cliente
              ? { tipo: g.contacto_cliente.tipo, nombre: g.contacto_cliente.nombre, telefono: g.contacto_cliente.telefono }
              : null,
        // STORY-1031: con pago compartido se informa el reparto
        pagador:
          g.pagador === "compartido"
            ? `compartido (inquilino ${g.pagador_pct_inquilino ?? 50}% / propietario ${100 - (g.pagador_pct_inquilino ?? 50)}%)`
            : g.pagador,
        presupuestos: g.presupuestos.map((p) => ({
          estado: p.estado,
          materiales: plata(p.monto_materiales),
          mano_obra: plata(p.monto_mano_obra),
          plazo_dias: p.plazo_dias,
          trabajo: trunc(p.descripcion_trabajo, 120),
          motivo_rechazo: p.motivo_rechazo,
        })),
        plazo_comprometido_dias: aprobado?.plazo_dias ?? null,
        avances: g.avances.length,
        ultimo_avance: g.avances.at(-1)
          ? { tipo: g.avances.at(-1)!.tipo, nota: trunc(g.avances.at(-1)!.nota, 120), fecha: fecha(g.avances.at(-1)!.creado_en) }
          : null,
        conformidad: g.conformidades.at(-1)?.estado ?? null,
        costo_final: plata(g.costo_final),
        // STORY-1013: el fee de la inmobiliaria (cargo_admin) es dato administrativo
        // — la UI lo muestra solo en FinanzasAcciones (rol administrativo), nunca al
        // técnico. Walter respeta la misma doctrina: no se lo entrega al técnico.
        ...(rol !== "tecnico" && { cargo_admin: plata(g.cargo_admin) }),
        adelanto_materiales: plata(g.adelanto_materiales),
        rendicion_materiales: plata(g.materiales_total),
        calificacion_estrellas: g.calificacion?.estrellas ?? null,
        motivo_aviso_tecnico: trunc(g.aviso_no_continua_motivo, 120),
        vinculadas: g.vinculadas.map((v) => ({
          id: v.id,
          descripcion: trunc(v.descripcion, 60),
          etapa: ETIQUETA_ETAPA[v.etapa] ?? v.etapa,
        })),
        ultimos_movimientos: g.eventos.slice(-5).map((e) => ({
          tipo: e.tipo,
          a_etapa: e.a_etapa ? ETIQUETA_ETAPA[e.a_etapa] : null,
          actor: e.actor?.nombre ?? null,
          fecha: fecha(e.creado_en),
        })),
      };
    }),
  });

  const gestiones_archivadas = tool({
    description:
      "Las gestiones finalizadas que se archivaron (salieron del tablero). Usala si preguntan por el archivo o por un trabajo viejo que no aparece en el tablero.",
    inputSchema: z.object({
      texto: z.string().optional().describe("Filtro libre por dirección o descripción"),
    }),
    execute: seguro(async ({ texto }) => {
      let lista = await gestionesArchivadas();
      if (texto) {
        const t = norm(texto);
        lista = lista.filter((g) =>
          [g.direccion, g.descripcion].some((c) => norm(c).includes(t))
        );
      }
      return {
        total: lista.length,
        gestiones: lista.slice(0, 15).map((g) => ({
          ...compactar(g),
          archivada: fecha(g.archivada_en),
        })),
      };
    }),
  });

  const mis_pendientes = tool({
    description:
      "Lo accionable AHORA para el usuario según su rol: qué necesita su decisión o su próximo paso. Usala para '¿qué tengo pendiente?', '¿qué me toca hoy?', '¿qué necesita atención?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await tableroGestiones();
      if (rol === "tecnico") {
        return {
          asignaciones_por_responder: todas
            .filter((g) => g.etapa === "asignacion" && g.asignacion_aceptada == null && g.tecnico_nombre)
            .map(compactar),
          presupuestos_por_enviar: todas
            .filter((g) => g.etapa === "presupuesto" && !g.presupuesto_pendiente)
            .map(compactar),
          obras_en_ejecucion: todas.filter((g) => g.etapa === "en_ejecucion").map(compactar),
          conformidades_rechazadas_a_resubir: todas
            .filter((g) => g.conformidad_rechazada)
            .map(compactar),
        };
      }
      const base = {
        ingresadas_sin_arrancar: todas.filter((g) => g.etapa === "ingresado").map(compactar),
        urgentes_sin_tecnico: todas
          .filter((g) => g.urgencia === "urgente" && ["ingresado", "asignacion"].includes(g.etapa))
          .map(compactar),
        presupuestos_esperando_decision: todas
          .filter((g) => g.presupuesto_pendiente)
          .map(compactar),
        avisos_de_tecnicos_sin_resolver: todas
          .filter((g) => g.aviso_no_continua_en)
          .map(compactar),
      };
      if (rol === "gestor_administrativo" || rol === "administrador") {
        const m = await obtenerMetricas();
        return {
          ...base,
          por_cobrar: {
            gestiones: todas.filter((g) => g.etapa === "facturacion_cobro").map(compactar),
            monto_total: plata(m?.montoPorCobrar),
          },
          por_liquidar_a_tecnicos: {
            gestiones: todas.filter((g) => g.etapa === "liquidacion_tecnico").map(compactar),
            monto_total: plata(m?.montoPorLiquidar),
          },
        };
      }
      return base;
    }),
  });

  const mis_notificaciones = tool({
    description:
      "Las últimas notificaciones del usuario (las no leídas primero). Usala si pregunta qué se perdió o qué pasó mientras no estaba.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await misNotificaciones();
      const orden = [...todas].sort((a, b) => Number(!!a.leida_en) - Number(!!b.leida_en));
      return {
        sin_leer: todas.filter((n) => !n.leida_en).length,
        notificaciones: orden.slice(0, 10).map((n) => ({
          titulo: n.titulo,
          detalle: trunc(n.cuerpo, 100),
          fecha: fecha(n.creado_en),
          leida: !!n.leida_en,
          ruta: n.ruta,
        })),
      };
    }),
  });

  const sugerir_navegacion = tool({
    description:
      "Ofrecé botones para ir a pantallas del sistema. Usala SIEMPRE que la respuesta invite a ver o hacer algo en una pantalla (un detalle, el tablero, informes, cómo hacer X). Máximo 3 sugerencias, rutas SOLO de la lista permitida del rol (o /gestiones/<id> con un id real que hayas obtenido de otra tool).",
    inputSchema: z.object({
      sugerencias: z
        .array(
          z.object({
            label: z.string().max(40).describe("Texto del botón, corto y accionable"),
            ruta: z.string().describe("Ruta interna permitida para el rol"),
          })
        )
        .min(1)
        .max(3),
    }),
    execute: async ({ sugerencias }) => {
      // La whitelist es la garantía: lo que no valida, no se renderiza.
      const validas = sugerencias.filter((s) => rutaPermitida(rol, s.ruta));
      if (validas.length === 0) {
        return { error: "Ninguna ruta era válida para este rol. No ofrezcas esos links." };
      }
      return { botones: validas };
    },
  });

  // ── Staff (todos menos técnico) ──

  const resumen_tablero = tool({
    description:
      "Foto actual del tablero del usuario: cuántas gestiones hay por etapa, cuántas urgentes y señales de atención. Usala para '¿cómo está el tablero?', '¿cuántas gestiones tengo?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await tableroGestiones();
      const porEtapa = ETAPAS.map((e) => ({
        etapa: e.label,
        gestiones: todas.filter((g) => g.etapa === e.id).length,
      })).filter((e) => e.gestiones > 0);
      return {
        // Misma definición que Informes: activa = etapa no terminal.
        activas: todas.filter((g) => !ETAPAS_TERMINALES.has(g.etapa)).length,
        finalizadas_sin_archivar: todas.filter((g) => g.etapa === "finalizado").length,
        por_etapa: porEtapa,
        urgentes: todas.filter((g) => g.urgencia === "urgente").length,
        con_presupuesto_esperando_decision: todas.filter((g) => g.presupuesto_pendiente).length,
        con_aviso_de_tecnico: todas.filter((g) => g.aviso_no_continua_en).length,
      };
    }),
  });

  // STORY-1019: ciclo de vida de la plata adelantada — misma derivación única
  // que la pestaña Finanzas → Adelantos (features/finanzas/consultas.ts), con
  // su mismo guard de rol adentro. Responde "¿qué técnicos desasigné que
  // tenían adelanto?", "¿cuánta plata está en la calle?", "¿me deben plata?".
  const adelantos_tecnicos = tool({
    description:
      "Los adelantos de materiales entregados a técnicos, en sus tres estados (mismos datos que Finanzas → Adelantos): EN OBRA (curso normal), A RESOLVER (técnicos desasignados con plata en la mano, gestiones canceladas con adelanto, sobrantes de liquidación — agrupado por técnico con total) y SALDADOS. Usala para '¿qué técnicos me deben plata?', '¿a quién desasigné que tenía adelanto?', '¿cuánta plata hay en la calle en adelantos?'. Si ofrecés un botón, usá /finanzas?tab=adelantos (no /finanzas pelado, que cae en Cobros).",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const d = await listarAdelantos();
      return {
        en_obra: d.enObra.map((f) => ({
          gestion_id: f.id,
          tecnico: f.tecnicoNombre,
          monto: plata(f.monto),
          direccion: f.direccion,
          descripcion: trunc(f.descripcion, 70),
        })),
        a_resolver: d.aResolver.map((g) => ({
          tecnico: g.tecnicoNombre,
          total: plata(g.total),
          items: g.items.map((i) => ({
            gestion_id: i.gestionId,
            monto: plata(i.monto),
            origen: i.origen,
            direccion: i.direccion,
            descripcion: trunc(i.descripcion, 70),
            dias_pendiente: i.diasPendiente,
          })),
        })),
        saldados_recientes: d.saldados.slice(0, 10).map((f) => ({
          gestion_id: f.gestionId,
          tecnico: f.tecnicoNombre,
          monto: plata(f.monto),
          como: f.modo === "liquidacion" ? "descontado al liquidar" : `a mano: ${f.nota ?? ""}`,
        })),
        total_en_obra: plata(d.enObra.reduce((s, f) => s + f.monto, 0)),
        total_a_resolver: plata(d.aResolver.reduce((s, g) => s + g.total, 0)),
      };
    }),
  });

  const metricas_negocio = tool({
    description:
      "Los números del negocio (mismos datos que los informes del Inicio): plata por cobrar y por liquidar, ingresos cobrados por mes, tiempo de ciclo, cuellos de botella por etapa, capacidad de técnicos por especialidad. Usala para '¿cómo viene el negocio?', '¿cuánto facturamos?', '¿dónde se traba el funnel?'. Si la respuesta comenta la evolución mensual o compara categorías, llamá TAMBIÉN a graficar (sin que te lo pidan) para acompañarla con el gráfico.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const m = await obtenerMetricas();
      if (!m) return { error: "No hay métricas disponibles para este rol." };

      // Ingresos cobrados por mes (hechos congelados: cobrado_monto/fee).
      const porMes = new Map<string, { cobrado: number; fee: number; n: number }>();
      for (const f of m.filas) {
        if (!f.cobradoEn || f.cobradoMonto == null) continue;
        const mes = f.cobradoEn.slice(0, 7);
        const acc = porMes.get(mes) ?? { cobrado: 0, fee: 0, n: 0 };
        acc.cobrado += Number(f.cobradoMonto);
        acc.fee += Number(f.cobradoFee ?? 0);
        acc.n += 1;
        porMes.set(mes, acc);
      }
      const mesActual = new Date().toISOString().slice(0, 7);
      const ingresos = [...porMes.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 3)
        .map(([mes, v]) => ({
          mes,
          cobrado: plata(v.cobrado),
          fee_inmobiliaria: plata(v.fee),
          gestiones: v.n,
          // Mes parcial: los informes del Inicio lo excluyen de sus series.
          ...(mes === mesActual && { en_curso: true }),
        }));

      // Tiempo de ciclo (creación → cobro) de las cobradas, en días.
      const ciclos = m.filas
        .filter((f) => f.cobradoEn)
        .map((f) => (new Date(f.cobradoEn!).getTime() - new Date(f.creadoEn).getTime()) / 86400000)
        .filter((d) => d >= 0);
      const cicloPromedio = ciclos.length
        ? Math.round((ciclos.reduce((s, d) => s + d, 0) / ciclos.length) * 10) / 10
        : null;

      // Cuellos de botella: días promedio de permanencia por etapa (event log).
      const porGestion = new Map<string, { aEtapa: string | null; t: number }[]>();
      for (const e of m.eventos) {
        const lista = porGestion.get(e.gestionId) ?? [];
        lista.push({ aEtapa: e.aEtapa, t: new Date(e.creadoEn).getTime() });
        porGestion.set(e.gestionId, lista);
      }
      const permanencia = new Map<string, { total: number; n: number }>();
      for (const evs of porGestion.values()) {
        const orden = [...evs].sort((a, b) => a.t - b.t);
        for (let i = 0; i < orden.length - 1; i++) {
          const etapa = orden[i].aEtapa;
          if (!etapa) continue;
          const dias = (orden[i + 1].t - orden[i].t) / 86400000;
          const acc = permanencia.get(etapa) ?? { total: 0, n: 0 };
          acc.total += dias;
          acc.n += 1;
          permanencia.set(etapa, acc);
        }
      }
      const cuellos = [...permanencia.entries()]
        .map(([etapa, v]) => ({
          etapa: ETIQUETA_ETAPA[etapa] ?? etapa,
          dias_promedio: Math.round((v.total / v.n) * 10) / 10,
        }))
        .sort((a, b) => b.dias_promedio - a.dias_promedio)
        .slice(0, 4);

      return {
        // Los modelos chicos leen el tool result con más atención que el system
        // prompt: el empujón a graficar viaja acá (STORY-1026 v1.1).
        recordatorio:
          "Si tu respuesta compara meses o categorías (ingresos por mes, etapas, técnicos), llamá AHORA a la tool graficar para acompañarla con el gráfico — no lo describas solo en texto.",
        alcance: rol === "gestor_mantenimiento" ? "solo tus gestiones" : "todo el sistema",
        activas: m.activas,
        urgentes_sin_asignar: m.urgentesSinAsignar,
        por_cobrar: { gestiones: m.pendientesCobro, monto: plata(m.montoPorCobrar) },
        por_liquidar: { gestiones: m.pendientesLiquidacion, monto: plata(m.montoPorLiquidar) },
        ingresos_por_mes: ingresos,
        tiempo_ciclo_promedio_dias: cicloPromedio,
        cuellos_de_botella: cuellos,
        capacidad_tecnicos: m.capacidad,
        abandonos_por_tecnico: m.abandonos,
      };
    }),
  });

  // STORY-1026: gráficos dinámicos en el chat. El modelo compone el cruce con
  // enums; el server calcula la serie (armarGrafico) y el cliente la dibuja
  // desde el output de ESTA tool — el modelo jamás escribe un número del gráfico.
  const graficar = tool({
    description:
      "Mostrá un GRÁFICO dentro del chat (se dibuja solo a partir del resultado de esta tool — es la ÚNICA forma de graficar: nada de imágenes markdown ni HTML). Elegí el cruce: una dimensión (agrupar_por) × una métrica; el servidor calcula la serie con los mismos datos que los informes del Inicio. Usala proactivamente, sin que el usuario la pida, siempre que la respuesta compare categorías o muestre una evolución: rankings de técnicos o gestores, distribución por etapa o especialidad, ingresos o gestiones por mes. Después comentá en texto solo los 2-3 datos salientes del resultado — no repitas la lista entera.",
    inputSchema: z.object({
      titulo: z.string().max(60).describe("Título corto del gráfico, en español"),
      agrupar_por: z.enum(["tecnico", "gestor", "especialidad", "etapa", "mes"]),
      metrica: z
        .enum([
          "cantidad",
          "monto_cobrado",
          "fee_inmobiliaria",
          "tiempo_ciclo_dias",
          "calificacion_promedio",
          "dias_en_etapa",
        ])
        .describe(
          "cantidad = gestiones; monto_cobrado/fee_inmobiliaria = plata cobrada (hechos congelados); tiempo_ciclo_dias = promedio creación→cobro; calificacion_promedio = estrellas; dias_en_etapa = permanencia promedio (solo con agrupar_por: etapa)"
        ),
      estado: z.enum(["activas", "finalizadas", "todas"]).optional(),
      periodo: z
        .enum(["este_mes", "ultimos_3_meses", "ultimos_6_meses", "ultimo_anio", "historico"])
        .optional(),
    }),
    execute: seguro(async (args) => {
      const m = await obtenerMetricas();
      if (!m) return { error: "No hay métricas disponibles para este rol." };
      return armarGrafico(m, args);
    }),
  });

  const consultar_cartera = tool({
    description:
      "La cartera de la inmobiliaria: propiedades administradas (con propietario e inquilino actual), o el listado de propietarios o inquilinos con su contacto. Usala para '¿qué propiedades administramos?', 'el teléfono de tal propietario', '¿está ocupada tal dirección?'.",
    inputSchema: z.object({
      tipo: z.enum(["propiedades", "propietarios", "inquilinos"]),
      texto: z.string().optional().describe("Filtro libre por nombre o dirección"),
    }),
    execute: seguro(async ({ tipo, texto }) => {
      const t = texto ? norm(texto) : null;
      if (tipo === "propiedades") {
        let lista = await listarPropiedades();
        if (t)
          lista = lista.filter((p) =>
            [p.direccion, p.propietario_nombre, p.inquilino_nombre]
              .filter(Boolean)
              .some((c) => norm(c as string).includes(t))
          );
        return {
          total: lista.length,
          propiedades: lista.slice(0, 15).map((p) => ({
            id: p.id,
            direccion: p.unidad ? `${p.direccion} — ${p.unidad}` : p.direccion,
            tipo: p.tipo,
            propietario: p.propietario_nombre,
            inquilino: p.inquilino_nombre ?? (p.ocupada ? "ocupada" : "sin ocupar"),
            activa: p.activa,
          })),
        };
      }
      let personas = await listarPersonas(tipo);
      if (t) personas = personas.filter((p) => norm(p.nombre).includes(t));
      return {
        total: personas.length,
        [tipo]: personas.slice(0, 15).map((p) => ({
          nombre: p.nombre,
          telefono: p.telefono,
          email: p.email,
          activo: p.activo,
        })),
      };
    }),
  });

  const historial_propiedad = tool({
    description:
      "La historia completa de una propiedad: sus períodos de ocupación (legajos) y todas las obras de cada período, con estado, costo y reincidencias. Usala para '¿qué se hizo en tal dirección?', '¿cuánto se invirtió en tal propiedad?'. Pasale el id (conseguilo con consultar_cartera).",
    inputSchema: z.object({
      id: z.string().uuid().describe("El id de la propiedad"),
    }),
    execute: seguro(async ({ id }) => {
      const capitulos = await historialPropiedad(id);
      if (!capitulos) return { error: "No encontré esa propiedad (o no está en tu alcance)." };
      const obras = capitulos.flatMap((c) => c.obras);
      const porEspecialidad = new Map<string, number>();
      for (const o of obras) {
        porEspecialidad.set(o.especialidad, (porEspecialidad.get(o.especialidad) ?? 0) + 1);
      }
      return {
        total_obras: obras.length,
        terminadas: obras.filter((o) => o.estado === "terminada").length,
        total_invertido: plata(
          obras.reduce((s, o) => s + (o.costo ?? 0), 0)
        ),
        reincidencias: [...porEspecialidad.entries()]
          .filter(([, n]) => n >= 3)
          .map(([especialidad, n]) => ({ especialidad, obras: n })),
        periodos: capitulos.map((c) => ({
          ocupante: c.titulo,
          desde: c.desde,
          hasta: c.hasta ?? (c.vigente ? "vigente" : null),
          obras: c.obras.slice(0, 10).map((o) => ({
            que_se_hizo: trunc(o.trabajo ?? o.problema, 80),
            especialidad: o.especialidad,
            tecnico: o.tecnico,
            estado: o.estado,
            costo: plata(o.costo),
            terminada: fecha(o.terminada_en),
          })),
        })),
      };
    }),
  });

  // ── Solo administrador + gestor comercial ──

  const ranking_tecnicos = tool({
    description:
      `El ranking de desempeño de los técnicos aprobados: calificación promedio (estrellas), desvío de presupuesto y de plazo, obras activas y realizadas, rechazos de asignación y abandonos. Usala para '¿cuál es el mejor técnico?', '¿a quién conviene asignar?', '¿quién abandona trabajos?'. Si ofrecés un botón para ver más, apuntá al Inicio (${RUTA_POR_ROL[rol]}, ahí viven las cards de desempeño de los informes) — /tecnicos es el listado operativo y NO muestra el ranking.`,
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const tecnicos = (await listarTecnicos()).filter(
        (t) => t.estado === "aprobado" && t.esta_activo !== false
      );
      const stats = await estadisticasTecnicos(tecnicos.map((t) => t.id));
      const lista = tecnicos
        .map((t) => ({
          id: t.id,
          nombre: t.nombre,
          especialidades: t.especialidades,
          ...compactarStats(stats.get(t.id)),
        }))
        .sort((a, b) => (b.estrellas ?? -1) - (a.estrellas ?? -1));
      return { tecnicos: lista };
    }),
  });

  const detalle_tecnico = tool({
    description:
      "El perfil completo de UN técnico por nombre: contacto, especialidades, estado y su desempeño (estrellas, desvíos, obras, abandonos). Usala cuando pregunten por un técnico puntual.",
    inputSchema: z.object({
      nombre: z.string().describe("Nombre (o parte) del técnico"),
    }),
    execute: seguro(async ({ nombre }) => {
      const t = norm(nombre);
      const candidatos = (await listarTecnicos()).filter((x) => norm(x.nombre).includes(t));
      if (candidatos.length === 0) return { error: "No encontré un técnico con ese nombre." };
      if (candidatos.length > 3) {
        return {
          error: "Hay varios técnicos que matchean — pedí más precisión.",
          coincidencias: candidatos.slice(0, 10).map((c) => c.nombre),
        };
      }
      const stats = await estadisticasTecnicos(candidatos.map((c) => c.id));
      return {
        tecnicos: candidatos.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          email: c.email,
          telefono: c.telefono,
          estado: c.estado,
          activo: c.esta_activo,
          especialidades: c.especialidades,
          desempeno: compactarStats(stats.get(c.id)),
        })),
      };
    }),
  });

  const inbox_reportes = tool({
    description:
      "Los reportes del inbox (mails de propietarios/inquilinos) pendientes de convertir en gestión o descartar. Usala para '¿hay reportes nuevos?', '¿qué entró al inbox?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const reportes = await listarInbox();
      return {
        pendientes: reportes.length,
        reportes: reportes.slice(0, 10).map((r) => ({
          remitente: r.remitente,
          asunto: r.asunto,
          resumen: trunc(r.cuerpo, 150),
          recibido: fecha(r.recibido_en),
        })),
      };
    }),
  });

  // ── Solo administrador ──

  const auditoria_reciente = tool({
    description:
      "Quién hizo qué: los últimos eventos de auditoría, de las gestiones (transiciones, presupuestos) o del sistema (altas/bajas de empleados y técnicos, cambios de rol). Usala para '¿qué pasó hoy?', '¿quién movió tal gestión?', '¿quién aprobó a tal técnico?'.",
    inputSchema: z.object({
      ambito: z.enum(["gestiones", "sistema"]).describe("gestiones = el funnel; sistema = identidad y accesos"),
      busqueda: z.string().optional().describe("Filtro: dirección/descripción (gestiones) o nombre del afectado (sistema)"),
    }),
    execute: seguro(async ({ ambito, busqueda }) => {
      if (ambito === "sistema") {
        const p = await historialSistema({ busqueda, pagina: 1 });
        return {
          total: p.total,
          eventos: p.eventos.slice(0, 10).map((e) => ({
            tipo: e.tipo,
            afectado: e.afectado,
            actor: e.actor_nombre,
            fecha: fecha(e.creado_en),
          })),
        };
      }
      const p = await historialGlobal({ busqueda, pagina: 1 });
      return {
        total: p.total,
        eventos: p.eventos.slice(0, 10).map((e) => ({
          tipo: e.tipo,
          gestion: trunc(e.gestion_descripcion, 60),
          direccion: e.direccion,
          a_etapa: e.a_etapa ? ETIQUETA_ETAPA[e.a_etapa] ?? e.a_etapa : null,
          actor: e.actor_nombre,
          fecha: fecha(e.creado_en),
        })),
      };
    }),
  });

  const equipo_interno = tool({
    description:
      "El equipo interno del sistema: empleados (con rol y estado) y especialidades configuradas. Usala para '¿qué empleados hay?', '¿qué especialidades manejamos?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const [empleados, especialidades] = await Promise.all([
        listarEmpleados(),
        listarEspecialidades(),
      ]);
      return {
        empleados: empleados.map((e) => ({
          nombre: e.nombre,
          rol: NOMBRE_ROL[e.rol],
          activo: e.esta_activo,
        })),
        especialidades: especialidades.map((e) => e.nombre),
      };
    }),
  });

  // ── Solo técnico ──

  const mi_agenda = tool({
    description:
      "Las franjas de disponibilidad horaria del técnico (su agenda semanal). Usala para '¿qué horarios tengo cargados?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const franjas = await misFranjas();
      return {
        franjas: franjas.map((f) => ({
          dia: DIAS[f.dia_semana],
          desde: f.hora_desde,
          hasta: f.hora_hasta,
        })),
      };
    }),
  });

  // STORY-1051 Fase 2: análisis de patrón de fondo. Lee las notas de inspección
  // de las obras repetidas de un rubro en una propiedad y devuelve un veredicto
  // (fondo/coincidencia/insuficiente) con cita textual — el trabajo pesado lo
  // hace Sonnet 5 adentro del service; Walter (Haiku) solo relata el resultado.
  const analizar_patron_fondo = tool({
    description:
      "Analiza si las obras repetidas de un MISMO rubro en una MISMA propiedad son un PROBLEMA DE FONDO (misma causa raíz) o coincidencias, leyendo las notas de inspección del técnico. Usala cuando el usuario pide analizar/revisar un patrón de fondo de una propiedad (típicamente viene de la bandeja 'Para revisar de fondo'). Pasale la dirección y el rubro TAL CUAL vienen en el pedido. Al responder, presentá el veredicto y las citas textuales que devuelve; NO las cambies ni afirmes de más que la herramienta.",
    inputSchema: z.object({
      direccion: z.string().describe("La dirección de la propiedad, tal cual"),
      especialidad: z.string().describe("El rubro/especialidad, ej. Electricidad, Cerrajería"),
      plazo_anios: z
        .number()
        .nullable()
        .optional()
        .describe("Ventana en años; omitir/null = todo el histórico"),
    }),
    execute: seguro(async ({ direccion, especialidad, plazo_anios }) => {
      const r = await analizarPatronFondo(direccion, especialidad, plazo_anios ?? null);
      if (!r.ok) return { error: r.error };
      return {
        veredicto: r.veredicto,
        confianza: r.confianza,
        razonamiento: r.razonamiento,
        sugerencia: r.sugerencia,
        evidencia: r.obras, // [{ numero, cita_textual }]
      };
    }),
  });

  // El catálogo del rol ES la matriz de guards de las pantallas — el asistente
  // nunca sabe más que las pantallas del rol.
  return {
    buscar_gestiones,
    detalle_gestion,
    gestiones_archivadas,
    mis_pendientes,
    mis_notificaciones,
    sugerir_navegacion,
    ...(esStaff && { resumen_tablero, metricas_negocio, graficar, analizar_patron_fondo }),
    ...(veFinanzas && { adelantos_tecnicos }),
    ...(veCartera && { consultar_cartera, historial_propiedad }),
    ...(veTecnicos && { ranking_tecnicos, detalle_tecnico, inbox_reportes }),
    ...(esAdmin && { auditoria_reciente, equipo_interno }),
    ...(rol === "tecnico" && { mi_agenda }),
  };
}

export type RolAsistente = Rol;
