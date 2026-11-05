import { createHash } from "node:crypto";
import { db } from "./db";
import type { AppState } from "../types";
export async function retainProofs(S: AppState) {
  for (const p of S.parcels) {
    if (!p.proof) continue;
    for (const key of ["photo", "signature"] as const) {
      const value = p.proof[key];
      if (typeof value !== "string" || !value.startsWith("data:image/"))
        continue;
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(value);
      if (!match) continue;
      const data = Buffer.from(match[2], "base64");
      const id = createHash("sha256").update(p.id).update(data).digest("hex");
      await db
        .prepare("INSERT OR IGNORE INTO proofs VALUES(?,?,?,?)")
        .run(id, p.id, match[1], data);
      p.proof[key] = "/api/proofs/" + id;
    }
  }
}
