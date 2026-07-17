import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Historial } from "@/components/cartera/historial.client";
import { Legajos } from "@/components/cartera/legajos.client";
import { PropietarioSeccion } from "@/components/cartera/propietario.client";
import { BotonGoogleMaps, MapaDireccion } from "@/components/ui/mapa";
import {
  historialPropiedad,
  legajosDePropiedad,
  listarInquilinosSinLegajo,
  listarPersonas,
  obtenerPropiedad,
} from "@/features/cartera/service";
import type { Persona } from "@/features/cartera/types";

export default async function PropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [propiedad, legajos, inquilinosLibres, propietarios, capitulos] =
    await Promise.all([
      obtenerPropiedad(id),
      legajosDePropiedad(id),
      listarInquilinosSinLegajo(),
      listarPersonas("propietarios"),
      historialPropiedad(id),
    ]);
  if (!propiedad) notFound();

  const propietario = propiedad.propietarios as unknown as Persona | null;

  return (
    <div className="animate-aparecer max-w-3xl">
      <Link
        href="/cartera/propiedades"
        className="text-sm font-medium text-muted hover:text-foreground"
      >
        ← Administraciones
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {propiedad.direccion}
          </h1>
          <p className="text-sm text-muted mt-1">{propiedad.tipo ?? "Sin tipo"}</p>
        </div>
        {!propiedad.activa && <Badge tono="error">Inactiva</Badge>}
      </div>

      <section className="mt-6 flex flex-col gap-3">
        <MapaDireccion direccion={propiedad.direccion} />
        <div>
          <BotonGoogleMaps direccion={propiedad.direccion} />
        </div>
      </section>

      <PropietarioSeccion
        propiedadId={id}
        propietario={propietario}
        propietariosActivos={propietarios.filter((p) => p.activo)}
      />

      <Legajos
        propiedadId={id}
        legajos={legajos}
        inquilinosActivos={inquilinosLibres}
      />

      {capitulos && <Historial capitulos={capitulos} />}
    </div>
  );
}
