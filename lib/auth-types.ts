export const ROLES = [
  "CLIENT",
  "AGENT",
  "CHAUFFEUR",
  "LIVREUR",
  "GESTIONNAIRE",
  "ADMIN",
] as const;
export type Role = (typeof ROLES)[number];
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: "Client",
  AGENT: "Agent d’agence",
  CHAUFFEUR: "Chauffeur",
  LIVREUR: "Livreur",
  GESTIONNAIRE: "Gestionnaire",
  ADMIN: "Administrateur",
};
export const ROLE_PATH: Record<Role, string> = {
  CLIENT: "/activites",
  AGENT: "/agent",
  CHAUFFEUR: "/chauffeur",
  LIVREUR: "/livreur",
  GESTIONNAIRE: "/gestion",
  ADMIN: "/admin",
};
