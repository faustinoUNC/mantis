"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BuscadorDireccion,
  type DireccionElegida,
} from "@/components/ui/buscador-direccion.client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapaDireccion } from "@/components/ui/mapa";
import { Select } from "@/components/ui/select";
import { crearAdministracion } from "@/features/cartera/service";
import { TIPOS_INMUEBLE, type Persona } from "@/features/cartera/types";
import { cn } from "@/shared/utils/cn";
import {
  PERSONA_VACIA,
  refPersona,
  SelectorPersona,
  validarPersona,
  type Modo,
} from "./persona-campos.client";

// Alta unificada (STORY-922, achicada en STORY-949): una Administración =
// propiedad + propietario. El inquilino NO se carga acá — el legajo se abre
// después desde el detalle de la propiedad (evita altas a medias si un dato
// del inquilino falla). Las piezas de persona (selector existente/nuevo,
// campos) viven en persona-campos.client (compartidas con el detalle).

const PASOS = ["Propietario", "Propiedad", "Confirmar"];

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
}: {
  propietarios: Persona[];
}) {
  const router = useRouter();

  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Paso 1 — propietario
  const [propModo, setPropModo] = useState<Modo>(propietarios.length ? "existente" : "nuevo");
  // STORY-981: arranca vacío — con el combo buscable elegir es explícito
  // (validarPersona avisa si falta).
  const [propId, setPropId] = useState("");
  const [propNuevo, setPropNuevo] = useState(PERSONA_VACIA);

  // Paso 2 — propiedad. El mapa se ubica recién al elegir una sugerencia
  // (pin exacto por lat/lon); tipear no dispara búsquedas en el mapa.
  const [direccion, setDireccion] = useState("");
  const [tipo, setTipo] = useState("");
  // STORY-999: sub-descripción de ubicación — un único campo libre para
  // piso+depto, casa/lote en complejo, nº de local, etc.
  const [unidad, setUnidad] = useState("");
  const [pin, setPin] = useState<DireccionElegida | null>(null);

  function validarPaso(p: number): string | null {
    if (p === 0) return validarPersona(propModo, propId, propNuevo, "propietario");
    if (p === 1) return direccion.trim() ? null : "Completá la dirección de la propiedad.";
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
      propiedad: { direccion: direccion.trim(), tipo: tipo.trim(), unidad: unidad.trim() },
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

  return (
    <div className="animate-aparecer max-w-3xl">
      <Link
        href="/cartera/propiedades"
        className="text-sm font-medium text-muted hover:text-foreground"
      >
        ← Volver
      </Link>
      <div className="mb-5 mt-3">
        <p className="text-[13px] font-medium text-muted">Administración</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Nueva administración</h1>
        <p className="text-sm text-muted mt-1">
          La propiedad y su propietario. Si está alquilada, el legajo del
          inquilino se abre después, desde el detalle de la propiedad.
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
              <Select
                label="Tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="">Sin especificar</option>
                {TIPOS_INMUEBLE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Input
                  label="Piso / unidad"
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  placeholder="Piso 3, Depto B · Casa 12 · Local 4 (opcional)"
                />
              </div>
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
                detalle={[tipo, unidad.trim()].filter(Boolean).join(" · ") || undefined}
                onCambiar={() => irA(1)}
              />
            </div>
            <p className="text-sm text-muted mt-4">
              La propiedad entra desocupada. Si tiene inquilino, abrí su legajo
              en el paso siguiente, desde el detalle de la propiedad.
            </p>
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
