import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Métricas: staff (el técnico tiene su vista en Mis trabajos).
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
