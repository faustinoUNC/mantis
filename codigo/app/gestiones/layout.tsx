import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Detalle de gestión: cualquier rol logueado — RLS decide qué gestiones ve.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAlguno([
    "administrador",
    "gestor_mantenimiento",
    "gestor_administrativo",
    "tecnico",
  ]);
  return <PanelShell usuario={usuario}>{children}</PanelShell>;
}
