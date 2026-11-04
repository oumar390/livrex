import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/server/auth";
import type { Role } from "@/lib/auth-types";
export default async function RoleGate({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const u = await currentUser();
  if (!u) redirect("/connexion?next=/pro");
  if (u.role !== "ADMIN" && !roles.includes(u.role))
    return (
      <section className="wrap empty-state">
        <h1>Un espace dédié à votre métier.</h1>
        <p>Votre compte ne donne pas accès à cette page.</p>
        <Link className="btn btn-accent" href="/pro">
          Revenir à mon espace
        </Link>
      </section>
    );
  return children;
}
