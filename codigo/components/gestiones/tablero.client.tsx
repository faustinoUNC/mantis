"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BotonIcono } from "@/components/ui/boton-icono.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ComboFiltrable } from "@/components/ui/combo-filtrable.client";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NOMBRE_ROL, type Rol } from "@/features/auth/types";
import type { Especialidad } from "@/features/especialidades/types";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { crearGestion } from "@/features/gestiones/service";
import { Icono } from "@/components/ui/iconos";
import type { GestionResumen, Urgencia } from "@/features/gestiones/types";
import { ETAPAS, ETAPAS_TERMINALES } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";

// Columnas accionables por rol (visual; el permiso real vive en avanzar_etapa)
const COLUMNAS_MANTENIMIENTO = new Set([
  "ingresado",
  "asignacion",
  "presupuesto",
  "en_ejecucion",
  "conformidad",
]);
const COLUMNAS_ADMINISTRATIVO = new Set([
  "facturacion_cobro",
  "liquidacion_tecnico",
]);

function accionable(rol: Rol, etapa: string) {
  if (rol === "administrador") return true;
  if (rol === "gestor_mantenimiento") return COLUMNAS_MANTENIMIENTO.has(etapa);
  if (rol === "gestor_administrativo") return COLUMNAS_ADMINISTRATIVO.has(etapa);
  return false;
}

function diasEn(fecha: string) {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  return dias === 0 ? "hoy" : `${dias} d`;
}

function TarjetaGestion({
  gestion,
  activa,
  resaltada,
  onHoverVinculos,
}: {
  gestion: GestionResumen;
  activa: boolean;
  // STORY-1001: otra card vinculada a esta tiene el mouse encima
  resaltada: boolean;
  onHoverVinculos: (ids: string[] | null) => void;
}) {
  // STORY-1001: ids emparentados (su origen + las que surgieron de ella) —
  // al hacer hover se resaltan las contrapartes presentes en el tablero.
  const vinculos = [
    ...(gestion.gestion_origen_id ? [gestion.gestion_origen_id] : []),
    ...gestion.vinculadas_ids,
  ];
  const tituloVinculo = [
    gestion.origen && `Surgió de: ${gestion.origen.descripcion}`,
    gestion.vinculadas_ids.length > 0 &&
      (gestion.vinculadas_ids.length === 1
        ? "1 gestión surgió de esta"
        : `${gestion.vinculadas_ids.length} gestiones surgieron de esta`),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/gestiones/${gestion.id}`}
      className="block group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onMouseEnter={vinculos.length ? () => onHoverVinculos(vinculos) : undefined}
      onMouseLeave={vinculos.length ? () => onHoverVinculos(null) : undefined}
    >
      <Card
        className={cn(
          "p-3.5 transition-all duration-150 group-hover:border-brand/40 group-focus-visible:border-brand/40 group-hover:-translate-y-px",
          gestion.urgencia === "urgente" && "border-l-2 border-l-urgente",
          !activa && "opacity-50",
          resaltada && "border-brand ring-2 ring-brand/30"
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium leading-snug truncate group-hover:text-brand-active transition-colors">
            {gestion.direccion}
          </p>
          {/* STORY-1009: identificador corto — dos gestiones parecidas en la
              misma propiedad se distinguen por el número. */}
          <span className="font-mono text-[11px] text-muted/80 shrink-0">
            #{gestion.numero}
          </span>
        </div>
        <p className="text-[12px] text-muted mt-1.5 line-clamp-2">
          {gestion.descripcion}
        </p>
        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border/70">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-medium text-muted truncate">
              {gestion.especialidad}
            </span>
            {gestion.urgencia === "urgente" && (
              <Badge tono="urgente">Urgente</Badge>
            )}
            {/* STORY-966: volvió a Asignación con técnico previo (baja,
                abandono o reasignación) — hay que reasignar cuanto antes. */}
            {gestion.etapa === "asignacion" && gestion.desasignada_en && (
              <Badge tono="urgente">Reasignar</Badge>
            )}
            {/* STORY-976: el técnico avisó que no puede continuar — la obra
                está en pausa hasta que el gestor decida. */}
            {gestion.aviso_no_continua_en && (
              <Badge tono="urgente">Técnico no continúa</Badge>
            )}
            {/* STORY-1001: vinculada a otra gestión — el hover resalta la
                contraparte; el title cuenta el vínculo aunque la otra ya no
                esté en el tablero. */}
            {vinculos.length > 0 && (
              <Badge tono="neutro" className="shrink-0 gap-1 px-1.5" title={tituloVinculo}>
                <Icono id="vinculo" size={12} strokeWidth={2} />
                {gestion.vinculadas_ids.length > 0 && (
                  <span className="font-mono text-[11px] leading-none">
                    {gestion.vinculadas_ids.length}
                  </span>
                )}
              </Badge>
            )}
          </div>
          <span className="font-mono text-[12px] text-muted/80 shrink-0">
            {diasEn(gestion.creado_en)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function FormNueva({
  propiedades,
  especialidades,
  vinculables,
  onListo,
}: {
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
  // STORY-1001: gestiones en curso que pueden ser origen de esta
  vinculables: { id: string; label: string; propiedad_id: string; direccion: string }[];
  onListo: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [propiedadId, setPropiedadId] = useState("");
  const [origenId, setOrigenId] = useState("");

  // STORY-1001: con origen elegido, la propiedad es la del origen (la
  // vinculada nace de la misma propiedad por definición) — se fija y bloquea.
  const origen = vinculables.find((v) => v.id === origenId);
  function onOrigen(v: string) {
    setOrigenId(v);
    const o = vinculables.find((x) => x.id === v);
    if (o) setPropiedadId(o.propiedad_id);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!propiedadId) return setError("Seleccioná una propiedad de la lista.");
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await crearGestion({
      descripcion: String(form.get("descripcion")),
      propiedad_id: propiedadId,
      especialidad_id: String(form.get("especialidad_id")),
      urgencia: String(form.get("urgencia")) as Urgencia,
      gestion_origen_id: origenId || undefined,
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <Card className="animate-aparecer p-5 mb-5">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Input label="Descripción" name="descripcion" required placeholder="Qué hay que arreglar y dónde (ambiente)" />
        </div>
        {/* STORY-1001 (card #19): trabajo adicional descubierto en la
            inspección/ejecución — la gestión nueva puede nacer vinculada a la
            que la originó. Vínculo informativo, nunca bloquea. */}
        <ComboFiltrable
          label="¿Surgió de otra gestión? (opcional)"
          opciones={vinculables.map((v) => ({ value: v.id, label: v.label }))}
          value={origenId}
          onChange={onOrigen}
          textoTodos="No — gestión independiente"
        />
        {origen ? (
          <Input label="Propiedad (de la gestión de origen)" value={origen.direccion} disabled readOnly />
        ) : (
          <ComboFiltrable
            label="Propiedad"
            opciones={propiedades.map((p) => ({ value: p.id, label: p.direccion }))}
            value={propiedadId}
            onChange={setPropiedadId}
            textoTodos={null}
            placeholder="Buscar por dirección…"
          />
        )}
        <Select label="Especialidad" name="especialidad_id" required>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <Select label="Urgencia" name="urgencia" defaultValue="normal">
          <option value="normal">Normal</option>
          <option value="urgente">Urgente</option>
        </Select>
        {error && (
          <p role="alert" className="text-sm font-medium text-error sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={enviando} className="lg:col-start-3 self-end">
          {enviando ? "Creando…" : "Crear gestión"}
        </Button>
      </form>
    </Card>
  );
}

const CAMPOS_BUSQUEDA: CampoBusqueda<GestionResumen>[] = [
  // STORY-1009: buscable por número, con o sin "#"
  { id: "numero", label: "N°", de: (g) => [`#${g.numero}`, String(g.numero)] },
  { id: "descripcion", label: "Descripción", de: (g) => [g.descripcion] },
  { id: "direccion", label: "Dirección", de: (g) => [g.direccion] },
  { id: "propietario", label: "Propietario", de: (g) => [g.propietario_nombre] },
  { id: "inquilino", label: "Inquilino", de: (g) => [g.inquilino_nombre] },
  { id: "especialidad", label: "Especialidad", de: (g) => [g.especialidad] },
  { id: "tecnico", label: "Técnico", de: (g) => [g.tecnico_nombre] },
];

export function Tablero({
  gestiones,
  rol,
  propiedades,
  especialidades,
}: {
  gestiones: GestionResumen[];
  rol: Rol;
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
}) {
  const [creando, setCreando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [campo, setCampo] = useState("todo");
  const [gestor, setGestor] = useState("");
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  // STORY-1001: ids a resaltar mientras el mouse está sobre una card
  // vinculada — presentación pura, vive y muere acá.
  const [vinculosResaltados, setVinculosResaltados] = useState<string[] | null>(null);
  const puedeCrear = rol === "administrador" || rol === "gestor_mantenimiento";
  const esAdmin = rol === "administrador";

  // Gestores presentes en las gestiones (para el filtro del admin).
  // STORY-979: por id, nunca por nombre — dos usuarios pueden llamarse igual
  // (p. ej. la misma persona como admin y como gestor). El rol desambigua.
  const gestores = useMemo(() => {
    const porId = new Map<string, { nombre: string; rol: Rol | null }>();
    for (const g of gestiones) {
      porId.set(g.gestor_id, { nombre: g.gestor_nombre, rol: g.gestor_rol });
    }
    return [...porId.entries()]
      .map(([id, u]) => ({
        id,
        etiqueta: u.rol ? `${u.nombre} (${NOMBRE_ROL[u.rol]})` : u.nombre,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [gestiones]);

  // STORY-1001: candidatas a gestión de origen en el alta — las del tablero
  // en etapa no terminal (RLS ya acotó a lo que este rol puede ver).
  const vinculables = useMemo(
    () =>
      gestiones
        .filter((g) => !ETAPAS_TERMINALES.has(g.etapa))
        .map((g) => ({
          id: g.id,
          propiedad_id: g.propiedad_id,
          direccion: g.direccion,
          label: `#${g.numero} · ${g.direccion} — ${g.descripcion}`,
        })),
    [gestiones]
  );

  // Búsqueda + (admin) gestor asignado + orden por fecha de ingreso.
  const filtradas = useMemo(
    () =>
      gestiones
        .filter(
          (g) =>
            coincideCampo(consulta, campo, CAMPOS_BUSQUEDA, g) &&
            (gestor === "" || g.gestor_id === gestor)
        )
        .sort((a, b) =>
          orden === "desc"
            ? b.creado_en.localeCompare(a.creado_en)
            : a.creado_en.localeCompare(b.creado_en)
        ),
    [gestiones, consulta, campo, gestor, orden]
  );

  return (
    <div className="animate-aparecer">
      <RefrescoVivo tabla="gestiones" />
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Tablero</h1>
          {puedeCrear && (
            <BotonIcono
              icono={creando ? "cerrar" : "mas"}
              titulo={creando ? "Cerrar" : "Nueva gestión"}
              variante={creando ? "secundario" : "primario"}
              pos="abajo-der"
              onClick={() => setCreando(!creando)}
            />
          )}
        </div>
        <p className="text-sm text-muted mt-1">
          Seguí cada mantenimiento por su etapa, del reporte a la liquidación.
        </p>
      </div>

      {creando && (
        <FormNueva
          propiedades={propiedades}
          especialidades={especialidades}
          vinculables={vinculables}
          onListo={() => setCreando(false)}
        />
      )}

      <FiltrosLista
        consulta={consulta}
        onConsulta={setConsulta}
        campos={CAMPOS_BUSQUEDA}
        campo={campo}
        onCampo={setCampo}
        extra={
          <>
            <div className="w-52">
              <Select
                label="Orden por fecha"
                value={orden}
                onChange={(e) => setOrden(e.target.value as "desc" | "asc")}
              >
                <option value="desc">Más recientes primero</option>
                <option value="asc">Más antiguas primero</option>
              </Select>
            </div>
            {esAdmin && (
              <div className="w-52">
                <ComboFiltrable
                  label="Gestor"
                  opciones={gestores.map((g) => ({ value: g.id, label: g.etiqueta }))}
                  value={gestor}
                  onChange={setGestor}
                  textoTodos="Todos los gestores"
                />
              </div>
            )}
          </>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 max-h-[calc(100dvh-13rem)]">
        {ETAPAS.map((etapa) => {
          const columna = filtradas.filter((g) => g.etapa === etapa.id);
          const activa = accionable(rol, etapa.id);
          return (
            <section
              key={etapa.id}
              className={cn(
                "w-64 shrink-0 snap-start rounded-lg border bg-surface-2/50 flex flex-col min-h-0",
                activa ? "border-border" : "border-transparent opacity-80"
              )}
              aria-label={etapa.label}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
                <span
                  className={cn(
                    "size-1.5 rounded-pill shrink-0",
                    activa ? "bg-brand" : "bg-border-strong"
                  )}
                  aria-hidden
                />
                <h2
                  className={cn(
                    "text-[13px] font-semibold tracking-tight truncate",
                    activa ? "text-foreground" : "text-muted"
                  )}
                >
                  {etapa.label}
                </h2>
                <span
                  className={cn(
                    "ml-auto font-mono text-[12px] rounded-pill px-1.5 py-0.5",
                    columna.length > 0
                      ? "bg-surface text-foreground border border-border"
                      : "text-muted/60"
                  )}
                >
                  {columna.length}
                </span>
              </header>
              <div className="flex flex-col gap-2 flex-1 min-h-28 overflow-y-auto px-2 pb-2">
                {columna.length === 0 && (
                  <div className="flex-1 grid place-items-center rounded-md border border-dashed border-border/80 py-6">
                    <span className="text-[12px] text-muted/60">Sin gestiones</span>
                  </div>
                )}
                {columna.map((g) => (
                  <TarjetaGestion
                    key={g.id}
                    gestion={g}
                    activa={activa}
                    resaltada={vinculosResaltados?.includes(g.id) ?? false}
                    onHoverVinculos={setVinculosResaltados}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
