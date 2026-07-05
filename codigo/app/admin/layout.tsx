import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirRol } from "@/features/auth/guard";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirRol("administrador");
  return <PanelShell usuario={usuario}>{children}</PanelShell>;
}
