import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Sección compartida: admin y ambos gestores (nunca técnico). Una sola
// pantalla (Administraciones) — los ABMs sueltos de personas se eliminaron
// en STORY-941: todo se gestiona desde la propiedad.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAlguno([
    "administrador",
    "gestor_mantenimiento",
    "gestor_administrativo",
  ]);
  return <PanelShell usuario={usuario}>{children}</PanelShell>;
}
