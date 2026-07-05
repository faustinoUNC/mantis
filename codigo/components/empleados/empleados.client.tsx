"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NOMBRE_ROL, type Rol } from "@/features/auth/types";
import {
  cambiarEstadoEmpleado,
  crearEmpleado,
  editarEmpleado,
} from "@/features/empleados/service";
import type { Empleado } from "@/features/empleados/types";

const ROLES = Object.keys(NOMBRE_ROL) as Rol[];

function OpcionesRol() {
  return ROLES.map((rol) => (
    <option key={rol} value={rol}>
      {NOMBRE_ROL[rol]}
    </option>
  ));
}

function FormNuevo({ onListo }: { onListo: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const resultado = await crearEmpleado({
      nombre: String(form.get("nombre")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      rol: String(form.get("rol")) as Rol,
    });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onListo();
  }

  return (
    <Card className="animate-aparecer p-5 mb-4">
      <form
        onSubmit={onSubmit}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end"
      >
        <Input label="Nombre" name="nombre" required placeholder="Nombre y apellido" />
        <Input label="Correo electrónico" name="email" type="email" required placeholder="nombre@inmobiliaria.com" />
        <Input label="Contraseña inicial" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" />
        <Select label="Rol" name="rol" defaultValue="gestor_mantenimiento">
          <OpcionesRol />
        </Select>
        {error && (
          <p role="alert" className="text-sm font-medium text-error sm:col-span-2 lg:col-span-3">
            {error}
          </p>
        )}
        <Button type="submit" disabled={enviando} className="lg:col-start-4">
          {enviando ? "Creando…" : "Crear empleado"}
        </Button>
      </form>
    </Card>
  );
}

function Fila({ empleado }: { empleado: Empleado }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    const form = new FormData(e.currentTarget);
    const resultado = await editarEmpleado(empleado.id, {
      nombre: String(form.get("nombre")),
      rol: String(form.get("rol")) as Rol,
    });
    setGuardando(false);
    if (resultado.ok) setEditando(false);
  }

  if (editando) {
    return (
      <tr className="border-b border-border bg-surface-2/50">
        <td colSpan={5} className="px-4 py-3">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-40">
              <Input label="Nombre" name="nombre" defaultValue={empleado.nombre} required />
            </div>
            <div className="flex-1 min-w-40">
              <Select label="Rol" name="rol" defaultValue={empleado.rol}>
                <OpcionesRol />
              </Select>
            </div>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </form>
        </td>
      </tr>
    );
  }

  async function toggleEstado() {
    setGuardando(true);
    const r = await cambiarEstadoEmpleado(empleado.id, !empleado.esta_activo);
    setGuardando(false);
    if (!r.ok) alert(r.error);
  }

  return (
    <tr
      className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
        empleado.esta_activo ? "" : "opacity-55"
      }`}
    >
      <td className="px-4 py-3 font-medium">{empleado.nombre}</td>
      <td className="px-4 py-3 text-muted">{empleado.email}</td>
      <td className="px-4 py-3">
        <Badge tono="neutro">{NOMBRE_ROL[empleado.rol]}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge tono={empleado.esta_activo ? "brand" : "error"}>
          {empleado.esta_activo ? "Activo" : "Inhabilitado"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Button variante="fantasma" className="min-h-0 h-8 px-2.5 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Button>
        <Button
          variante="fantasma"
          disabled={guardando}
          className={`min-h-0 h-8 px-2.5 text-sm ${
            empleado.esta_activo ? "text-error hover:text-error" : ""
          }`}
          onClick={toggleEstado}
        >
          {empleado.esta_activo ? "Inhabilitar" : "Habilitar"}
        </Button>
      </td>
    </tr>
  );
}

export function Empleados({ empleados }: { empleados: Empleado[] }) {
  const [creando, setCreando] = useState(false);

  return (
    <div className="animate-aparecer">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Mantenedor</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Empleados</h1>
        </div>
        <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
          {creando ? "Cerrar" : "Nuevo empleado"}
        </Button>
      </div>

      {creando && <FormNuevo onListo={() => setCreando(false)} />}

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Nombre</th>
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Correo</th>
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Rol</th>
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => (
              <Fila key={e.id} empleado={e} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
