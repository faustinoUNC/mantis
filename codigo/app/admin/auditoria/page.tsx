import { Auditoria } from "@/components/auditoria/auditoria.client";
import {
  historialGlobal,
  historialSistema,
  listarActores,
} from "@/features/auditoria/service";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [inicial, inicialSistema, actores] = await Promise.all([
    historialGlobal(),
    historialSistema(),
    listarActores(),
  ]);
  return (
    <Auditoria
      inicial={inicial}
      inicialSistema={inicialSistema}
      actores={actores}
      tabInicial={tab === "sistema" ? "sistema" : "gestiones"}
    />
  );
}
