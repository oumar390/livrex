import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction, audit } from "@/lib/server/db";
import {
  ApiError,
  body,
  sameOrigin,
  failure,
  hashPassword,
  verifyPassword,
  digest,
  COOKIE,
  currentUser,
} from "@/lib/server/auth";
import { NextResponse } from "next/server";
const schema = z.object({
  action: z.enum(["login", "register"]),
  name: z.string().trim().min(2).max(100).optional(),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export async function GET() {
  return Response.json({
    user: await currentUser(),
    needsSetup: !db.prepare("SELECT id FROM users LIMIT 1").get(),
  });
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success)
      throw new ApiError(
        422,
        "Vérifiez votre e-mail et votre mot de passe (10 caractères minimum).",
      );
    const b = parsed.data;
    const key = digest(b.email);
    const attempt = db
      .prepare("SELECT count,until FROM attempts WHERE key=?")
      .get(key) as { count: number; until: number } | undefined;
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      throw new ApiError(429, "Trop de tentatives. Réessayez dans 15 minutes.");
    db.prepare(
      "INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END",
    ).run(key, Date.now() + 900000, Date.now(), Date.now());
    let user = db.prepare("SELECT * FROM users WHERE email=?").get(b.email) as
      { id: string; password: string; role: string } | undefined;
    if (b.action === "register") {
      if (!b.name) throw new ApiError(422, "Indiquez votre nom.");
      if (user)
        throw new ApiError(409, "Ce compte existe déjà. Connectez-vous.");
      const password = hashPassword(b.password);
      user = transaction(() => {
        const role = db.prepare("SELECT id FROM users LIMIT 1").get()
          ? "CLIENT"
          : "ADMIN";
        const id = randomUUID();
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
          id,
          b.name!,
          b.email,
          password,
          role,
          Date.now(),
        );
        audit(id, "account.created");
        return { id, password, role };
      });
    } else if (!user || !verifyPassword(b.password, user.password))
      throw new ApiError(401, "E-mail ou mot de passe incorrect.");
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    db.prepare("DELETE FROM attempts WHERE key=?").run(key);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return res;
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const { cookies } = await import("next/headers");
    const token = (await cookies()).get(COOKIE)?.value;
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    const r = NextResponse.json({ ok: true });
    r.cookies.delete(COOKIE);
    return r;
  } catch (e) {
    return failure(e);
  }
}
