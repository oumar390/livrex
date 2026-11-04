import "server-only";
import { cookies } from "next/headers";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
import type { User, Role } from "../auth-types";
export const COOKIE = "livrex_session";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const a = Buffer.from(key, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return (
    (db
      .prepare(
        "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
      )
      .get(digest(token), Date.now()) as unknown as User) || null
  );
}
export async function requireUser(roles?: Role[]) {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "Connectez-vous pour continuer.");
  if (roles && !roles.includes(u.role))
    throw new ApiError(403, "Votre rôle ne permet pas cette action.");
  return u;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    throw new ApiError(403, "Origine de la requête refusée.");
}
export function failure(e: unknown) {
  if (e instanceof ApiError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.message === "CONFLICT")
    return Response.json(
      { error: "Les données ont changé. Rechargez puis réessayez." },
      { status: 409 },
    );
  console.error(e instanceof Error ? e.message : "Erreur serveur");
  return Response.json(
    { error: "Une erreur est survenue. Réessayez." },
    { status: 500 },
  );
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 8_000_000)
    throw new ApiError(413, "Fichier trop volumineux.");
  const text = await req.text();
  if (text.length > 8_000_000)
    throw new ApiError(413, "Requête trop volumineuse.");
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ApiError(400, "Un objet JSON est attendu.");
    return value;
  } catch {
    throw new ApiError(400, "JSON invalide.");
  }
}
