import { PersonasAbm } from "@/components/cartera/personas.client";
import { listarPersonas } from "@/features/cartera/service";

export default async function PropietariosPage() {
  const personas = await listarPersonas("propietarios");
  return <PersonasAbm tipo="propietarios" personas={personas} />;
}
