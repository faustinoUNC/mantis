"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MapaDireccion } from "@/components/ui/mapa";
import { guardarPropiedad } from "@/features/cartera/service";
import type { Persona, Propiedad } from "@/features/cartera/types";

function Formulario({
  propietarios,
  onListo,
}: {
  propietarios: Persona[];
  onListo: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [direccionPreview, setDireccionPreview] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await guardarPropiedad({
      direccion: String(form.get("direccion")),
      tipo: String(form.get("tipo") ?? ""),
      propietario_id: String(form.get("propietario_id")),
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <Card className="animate-aparecer p-5 mb-4">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <Input label="Dirección" name="direccion" required placeholder="Av. Colón 1234, Córdoba" onBlur={(e) => setDireccionPreview(e.target.value)} />
        <Input label="Tipo" name="tipo" placeholder="Depto, Casa, Local… (opcional)" />
        <Select label="Propietario" name="propietario_id" required>
          {propietarios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        {error && (
          <p role="alert" className="text-sm font-medium text-error sm:col-span-2 lg:col-span-3">
            {error}
          </p>
        )}
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Crear propiedad"}
        </Button>
        {direccionPreview && (
          <div className="sm:col-span-2 lg:col-span-4 animate-aparecer">
            <p className="text-[13px] font-medium text-muted mb-1.5">
              Verificá que el pin apunte al inmueble antes de guardar:
            </p>
            <MapaDireccion direccion={direccionPreview} alto={200} />
          </div>
        )}
      </form>
    </Card>
  );
}

export function PropiedadesAbm({
  propiedades,
  propietariosActivos,
}: {
  propiedades: Propiedad[];
  propietariosActivos: Persona[];
}) {
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtradas = propiedades.filter((p) =>
    p.direccion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="animate-aparecer">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Cartera</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Propiedades</h1>
        </div>
        <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
          {creando ? "Cerrar" : "Nueva propiedad"}
        </Button>
      </div>

      {creando && <Formulario propietarios={propietariosActivos} onListo={() => setCreando(false)} />}

      <div className="mb-4 max-w-sm">
        <Input
          label="Buscar por dirección"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Escribí para filtrar…"
        />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Dirección", "Tipo", "Propietario", "Ocupación", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  {busqueda ? "Sin resultados para esa búsqueda." : "Todavía no hay propiedades cargadas."}
                </td>
              </tr>
            )}
            {filtradas.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
                  p.activa ? "" : "opacity-55"
                }`}
              >
                <td className="px-4 py-3 font-medium">{p.direccion}</td>
                <td className="px-4 py-3 text-muted">{p.tipo ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{p.propietario_nombre}</td>
                <td className="px-4 py-3">
                  <Badge tono={p.ocupada ? "brand" : "neutro"}>
                    {p.ocupada ? "Ocupada" : "Libre"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/cartera/propiedades/${p.id}`}
                    className="text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
