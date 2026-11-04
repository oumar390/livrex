import RoleGate from "@/components/RoleGate";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGate roles={["LIVREUR", "GESTIONNAIRE"]}>{children}</RoleGate>;
}
