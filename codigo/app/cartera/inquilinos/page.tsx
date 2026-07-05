import { PersonasAbm } from "@/components/cartera/personas.client";
import { listarPersonas } from "@/features/cartera/service";

export default async function InquilinosPage() {
  const personas = await listarPersonas("inquilinos");
  return <PersonasAbm tipo="inquilinos" personas={personas} />;
}
