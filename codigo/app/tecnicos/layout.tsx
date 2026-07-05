import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Red de técnicos: admin + gestor de mantenimiento.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAlguno(["administrador", "gestor_mantenimiento"]);
  return <PanelShell usuario={usuario}>{children}</PanelShell>;
}
