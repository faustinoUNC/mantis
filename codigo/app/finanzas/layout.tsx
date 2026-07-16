import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Finanzas: solo staff administrativo (admin + gestor administrativo).
// El gestor de mantenimiento y el técnico no operan la plata (PRD).
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAlguno([
    "administrador",
    "gestor_administrativo",
  ]);
  return <PanelShell usuario={usuario}>{children}</PanelShell>;
}
