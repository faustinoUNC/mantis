"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BuscadorDireccion,
  type DireccionElegida,
} from "@/components/ui/buscador-direccion.client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MapaDireccion } from "@/components/ui/mapa";
import { crearAdministracion } from "@/features/cartera/service";
import type { Persona, RefPersona } from "@/features/cartera/types";
import { cuilValido } from "@/shared/utils/cuil";
import { cn } from "@/shared/utils/cn";

// Alta unificada (STORY-922): una Administración = propiedad + propietario
// (obligatorios) + inquilino con legajo (opcional). Wizard de 4 pasos chicos.

const PASOS = ["Propietario", "Propiedad", "Ocupación", "Confirmar"];

type DatosPersona = { nombre: string; email: string; telefono: string; cuil: string };
type Modo = "existente" | "nuevo";

const PERSONA_VACIA: DatosPersona = { nombre: "", email: "", telefono: "", cuil: "" };

function validarPersona(
  modo: Modo,
  id: string,
  nueva: DatosPersona,
  quien: string
): string | null {
  if (modo === "existente") {
    return id ? null : `Elegí un ${quien} de la lista.`;
  }
  if (!nueva.nombre.trim() || !nueva.email.trim()) {
    return `Completá nombre y email del ${quien}.`;
  }
  if (nueva.cuil.trim() && !cuilValido(nueva.cuil)) {
    return "El CUIL/CUIT no es válido (11 dígitos).";
  }
  return null;
}

function refPersona(modo: Modo, id: string, nueva: DatosPersona): RefPersona {
  return modo === "existente" ? { id } : { nueva };
}

function Stepper({ paso, onIr }: { paso: number; onIr: (p: number) => void }) {
  return (
    <ol className="flex items-center gap-2 mb-6" aria-label="Pasos del alta">
      {PASOS.map((label, i) => {
        const hecho = i < paso;
        const actual = i === paso;
        return (
          <li key={label} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => hecho && onIr(i)}
              disabled={!hecho}
              className={cn(
                "flex items-center gap-2 min-w-0",
                hecho && "cursor-pointer"
              )}
              aria-current={actual ? "step" : undefined}
            >
              <span
                className={cn(
                  "size-7 shrink-0 rounded-full border flex items-center justify-center text-[13px] font-semibold transition-colors",
                  hecho && "bg-brand border-brand text-white",
                  actual && "border-brand text-brand",
                  !hecho && !actual && "border-border-strong text-muted"
                )}
              >
                {hecho ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium truncate",
                  actual ? "text-foreground" : "text-muted",
                  !actual && "hidden sm:block"
                )}
              >
                {label}
              </span>
            </button>
            {i < PASOS.length - 1 && (
              <span
                aria-hidden
                className={cn("h-px flex-1 min-w-3", hecho ? "bg-brand" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Segmentado({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: Modo; label: string }[];
  valor: Modo;
  onCambio: (m: Modo) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1 gap-1 bg-surface-2/50">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          className={cn(
            "px-3.5 py-2 rounded-md text-sm font-medium transition-colors min-h-tap",
            valor === o.valor
              ? "bg-surface text-foreground border border-brand-soft-border shadow-none"
              : "text-muted hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CamposPersona({
  valores,
  onCambio,
  docLabel,
}: {
  valores: DatosPersona;
  onCambio: (v: DatosPersona) => void;
  docLabel: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 animate-aparecer">
      <Input label="Nombre" required value={valores.nombre} onChange={(e) => onCambio({ ...valores, nombre: e.target.value })} placeholder="Nombre y apellido" />
      <Input label="Correo electrónico" type="email" required value={valores.email} onChange={(e) => onCambio({ ...valores, email: e.target.value })} placeholder="correo@ejemplo.com" />
      <Input label="Teléfono" inputMode="numeric" value={valores.telefono} onChange={(e) => onCambio({ ...valores, telefono: e.target.value.replace(/\D/g, "") })} placeholder="Opcional, solo números" />
      <Input label={docLabel} inputMode="numeric" value={valores.cuil} onChange={(e) => onCambio({ ...valores, cuil: e.target.value })} placeholder="11 dígitos, opcional" />
    </div>
  );
}

function SelectorPersona({
  personas,
  quien,
  docLabel,
  modo,
  onModo,
  id,
  onId,
  nueva,
  onNueva,
}: {
  personas: Persona[];
  quien: string;
  docLabel: string;
  modo: Modo;
  onModo: (m: Modo) => void;
  id: string;
  onId: (id: string) => void;
  nueva: DatosPersona;
  onNueva: (v: DatosPersona) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {personas.length > 0 && (
        <Segmentado
          valor={modo}
          onCambio={onModo}
          opciones={[
            { valor: "existente", label: "Ya está en la cartera" },
            { valor: "nuevo", label: `Cargar ${quien} nuevo` },
          ]}
        />
      )}
      {modo === "existente" && personas.length > 0 ? (
        <div className="max-w-sm animate-aparecer">
          <Select label={quien[0].toUpperCase() + quien.slice(1)} value={id} onChange={(e) => onId(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <CamposPersona valores={nueva} onCambio={onNueva} docLabel={docLabel} />
      )}
    </div>
  );
}

function OpcionOcupacion({
  activa,
  titulo,
  detalle,
  onElegir,
}: {
  activa: boolean;
  titulo: string;
  detalle: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activa}
      className={cn(
        "flex-1 min-w-56 text-left rounded-lg border p-4 transition-colors",
        activa
          ? "border-brand bg-brand-soft/40"
          : "border-border hover:border-border-strong hover:bg-surface-2/60"
      )}
    >
      <p className={cn("font-medium", activa && "text-brand-active")}>{titulo}</p>
      <p className="text-sm text-muted mt-1">{detalle}</p>
    </button>
  );
}

function FilaResumen({
  label,
  valor,
  detalle,
  onCambiar,
}: {
  label: string;
  valor: string;
  detalle?: string;
  onCambiar: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="font-medium mt-0.5">{valor}</p>
        {detalle && <p className="text-sm text-muted mt-0.5">{detalle}</p>}
      </div>
      <button
        type="button"
        onClick={onCambiar}
        className="text-sm font-medium text-brand hover:text-brand-hover shrink-0 min-h-tap"
      >
        Cambiar
      </button>
    </div>
  );
}

export function AltaAdministracion({
  propietarios,
  inquilinos,
}: {
  propietarios: Persona[];
  inquilinos: Persona[];
}) {
  const router = useRouter();
  const hoy = new Date().toISOString().slice(0, 10);

  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Paso 1 — propietario
  const [propModo, setPropModo] = useState<Modo>(propietarios.length ? "existente" : "nuevo");
  const [propId, setPropId] = useState(propietarios[0]?.id ?? "");
  const [propNuevo, setPropNuevo] = useState(PERSONA_VACIA);

  // Paso 2 — propiedad. El mapa se ubica recién al elegir una sugerencia
  // (pin exacto por lat/lon); tipear no dispara búsquedas en el mapa.
  const [direccion, setDireccion] = useState("");
  const [tipo, setTipo] = useState("");
  const [pin, setPin] = useState<DireccionElegida | null>(null);

  // Paso 3 — ocupación
  const [ocupada, setOcupada] = useState<boolean | null>(null);
  const [inqModo, setInqModo] = useState<Modo>(inquilinos.length ? "existente" : "nuevo");
  const [inqId, setInqId] = useState(inquilinos[0]?.id ?? "");
  const [inqNuevo, setInqNuevo] = useState(PERSONA_VACIA);
  const [fechaInicio, setFechaInicio] = useState(hoy);

  function validarPaso(p: number): string | null {
    if (p === 0) return validarPersona(propModo, propId, propNuevo, "propietario");
    if (p === 1) return direccion.trim() ? null : "Completá la dirección de la propiedad.";
    if (p === 2) {
      if (ocupada === null) return "Contanos si la propiedad está alquilada hoy.";
      if (!ocupada) return null;
      return (
        validarPersona(inqModo, inqId, inqNuevo, "inquilino") ??
        (fechaInicio ? null : "Indicá desde cuándo está el inquilino.")
      );
    }
    return null;
  }

  function continuar() {
    const e = validarPaso(paso);
    setError(e);
    if (!e) setPaso(paso + 1);
  }

  function irA(p: number) {
    setError(null);
    setPaso(p);
  }

  async function confirmar() {
    setError(null);
    setEnviando(true);
    const r = await crearAdministracion({
      propietario: refPersona(propModo, propId, propNuevo),
      propiedad: { direccion: direccion.trim(), tipo: tipo.trim() },
      inquilino: ocupada
        ? { persona: refPersona(inqModo, inqId, inqNuevo), fecha_inicio: fechaInicio }
        : null,
    });
    if (!r.ok) {
      setEnviando(false);
      setError(r.error);
      return;
    }
    router.push(`/cartera/propiedades/${r.data!.propiedadId}`);
  }

  const nombrePropietario =
    propModo === "existente"
      ? propietarios.find((p) => p.id === propId)?.nombre ?? "—"
      : propNuevo.nombre || "—";
  const nombreInquilino =
    inqModo === "existente"
      ? inquilinos.find((i) => i.id === inqId)?.nombre ?? "—"
      : inqNuevo.nombre || "—";

  return (
    <div className="animate-aparecer max-w-3xl">
      <div className="mb-5">
        <p className="text-[13px] font-medium text-muted">Cartera</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Nueva administración</h1>
        <p className="text-sm text-muted mt-1">
          La propiedad y su propietario en un solo paso — y el inquilino, si lo hay.
        </p>
      </div>

      <Stepper paso={paso} onIr={irA} />

      <Card key={paso} className="p-5 animate-aparecer">
        {paso === 0 && (
          <>
            <h2 className="font-semibold tracking-tight mb-1">¿De quién es la propiedad?</h2>
            <p className="text-sm text-muted mb-4">
              El propietario que nos da la propiedad en administración.
            </p>
            <SelectorPersona
              personas={propietarios}
              quien="propietario"
              docLabel="CUIT / CUIL"
              modo={propModo}
              onModo={(m) => {
                setPropModo(m);
                setError(null);
              }}
              id={propId}
              onId={setPropId}
              nueva={propNuevo}
              onNueva={setPropNuevo}
            />
          </>
        )}

        {paso === 1 && (
          <>
            <h2 className="font-semibold tracking-tight mb-1">La propiedad</h2>
            <p className="text-sm text-muted mb-4">
              Empezá a escribir y elegí la dirección sugerida — el mapa se ubica solo.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <BuscadorDireccion
                value={direccion}
                onChange={setDireccion}
                onElegir={setPin}
                placeholder="Av. Colón 1234, Córdoba"
              />
              <Input
                label="Tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Depto, Casa, Local… (opcional)"
              />
            </div>
            {pin && (
              <div className="mt-4 animate-aparecer">
                <p className="text-[13px] font-medium text-muted mb-1.5">
                  Verificá que el pin apunte al inmueble:
                </p>
                <MapaDireccion
                  direccion={pin.etiqueta}
                  punto={pin.exacta ? pin : undefined}
                  alto={200}
                />
              </div>
            )}
          </>
        )}

        {paso === 2 && (
          <>
            <h2 className="font-semibold tracking-tight mb-1">¿Está alquilada hoy?</h2>
            <p className="text-sm text-muted mb-4">
              Una propiedad puede entrar en administración desocupada — el inquilino es opcional.
            </p>
            <div className="flex flex-wrap gap-3">
              <OpcionOcupacion
                activa={ocupada === true}
                titulo="Sí, tiene inquilino"
                detalle="Abrimos ahora el legajo con sus datos."
                onElegir={() => {
                  setOcupada(true);
                  setError(null);
                }}
              />
              <OpcionOcupacion
                activa={ocupada === false}
                titulo="No, está desocupada"
                detalle="Queda libre; abrís el legajo cuando entre un inquilino."
                onElegir={() => {
                  setOcupada(false);
                  setError(null);
                }}
              />
            </div>
            {ocupada && (
              <div className="mt-5 pt-5 border-t border-border animate-aparecer flex flex-col gap-4">
                <SelectorPersona
                  personas={inquilinos}
                  quien="inquilino"
                  docLabel="CUIL"
                  modo={inqModo}
                  onModo={(m) => {
                    setInqModo(m);
                    setError(null);
                  }}
                  id={inqId}
                  onId={setInqId}
                  nueva={inqNuevo}
                  onNueva={setInqNuevo}
                />
                <div className="max-w-48">
                  <Input
                    label="Inquilino desde"
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {paso === 3 && (
          <>
            <h2 className="font-semibold tracking-tight mb-1">Revisá antes de crear</h2>
            <p className="text-sm text-muted mb-4">
              Esto es lo que se va a dar de alta en la cartera.
            </p>
            <div className="rounded-lg border border-border">
              <FilaResumen
                label="Propietario"
                valor={nombrePropietario}
                detalle={propModo === "nuevo" ? "Se carga como propietario nuevo" : undefined}
                onCambiar={() => irA(0)}
              />
              <FilaResumen
                label="Propiedad"
                valor={direccion}
                detalle={tipo || undefined}
                onCambiar={() => irA(1)}
              />
              <FilaResumen
                label="Ocupación"
                valor={ocupada ? nombreInquilino : "Desocupada"}
                detalle={
                  ocupada
                    ? `Legajo vigente desde el ${new Date(`${fechaInicio}T00:00:00`).toLocaleDateString("es-AR")}`
                    : "Podés abrir el legajo desde la propiedad cuando entre un inquilino"
                }
                onCambiar={() => irA(2)}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-error">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          {paso > 0 ? (
            <Button type="button" variante="fantasma" onClick={() => irA(paso - 1)} disabled={enviando}>
              Volver
            </Button>
          ) : (
            <span />
          )}
          {paso < PASOS.length - 1 ? (
            <Button type="button" onClick={continuar}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={confirmar} disabled={enviando}>
              {enviando ? "Creando…" : "Crear administración"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
