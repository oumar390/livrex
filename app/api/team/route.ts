import {
  requireUser,
  sameOrigin,
  body,
  failure,
  ApiError,
} from "@/lib/server/auth";
import { db, transaction, audit } from "@/lib/server/db";
import { ROLES } from "@/lib/auth-types";
export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    return Response.json(
      db.prepare("SELECT id,name,email,role FROM users ORDER BY created").all(),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser(["ADMIN"]);
    const b = await body(req);
    if (!ROLES.includes(b.role)) throw new ApiError(422, "Rôle invalide.");
    transaction(() => {
      const target = db
        .prepare("SELECT role FROM users WHERE id=?")
        .get(b.id) as { role: string } | undefined;
      if (!target) throw new ApiError(404, "Compte introuvable.");
      if (
        target.role === "ADMIN" &&
        b.role !== "ADMIN" &&
        Number(
          (
            db
              .prepare("SELECT count(*) AS n FROM users WHERE role='ADMIN'")
              .get() as { n: number }
          ).n,
        ) <= 1
      )
        throw new ApiError(422, "Conservez au moins un administrateur.");
      db.prepare("UPDATE users SET role=? WHERE id=?").run(b.role, b.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(b.id);
      audit(u.id, "role.updated:" + b.id + ":" + b.role);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
