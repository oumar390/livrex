import { randomBytes, randomUUID } from "node:crypto";
import {
  requireUser,
  sameOrigin,
  body,
  failure,
  ApiError,
  digest,
} from "@/lib/server/auth";
import { db, audit } from "@/lib/server/db";
export async function GET() {
  try {
    const u = await requireUser();
    return Response.json(
      await db
        .prepare(
          "SELECT id,name,created FROM api_keys WHERE user_id=? ORDER BY created DESC",
        )
        .all(u.id),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const b = await body(req);
    if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100)
      throw new ApiError(422, "Indiquez un nom pour cette clé.");
    const count = (await db
      .prepare("SELECT count(*) AS n FROM api_keys WHERE user_id=?")
      .get(u.id)) as {
      n: number;
    };
    if (count.n >= 10)
      throw new ApiError(
        422,
        "Limite de 10 clés atteinte. Révoquez une clé inutilisée.",
      );
    const token = "lx_" + randomBytes(32).toString("hex");
    await db
      .prepare("INSERT INTO api_keys VALUES(?,?,?,?,?)")
      .run(randomUUID(), u.id, b.name.trim(), digest(token), Date.now());
    await audit(u.id, "api_key.created");
    return Response.json(
      { token },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const b = await body(req);
    if (typeof b.id !== "string") throw new ApiError(422, "Clé invalide.");
    await db
      .prepare("DELETE FROM api_keys WHERE id=? AND user_id=?")
      .run(b.id, u.id);
    await audit(u.id, "api_key.revoked");
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
