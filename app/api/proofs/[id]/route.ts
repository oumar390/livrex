import { requireUser, failure, ApiError } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!/^[a-f0-9]{64}$/.test(id))
      throw new ApiError(404, "Pièce introuvable.");
    const row = db
      .prepare("SELECT parcel_id,mime,data FROM proofs WHERE id=?")
      .get(id) as
      { parcel_id: string; mime: string; data: Uint8Array } | undefined;
    if (!row) throw new ApiError(404, "Pièce introuvable.");
    if (
      user.role === "CLIENT" &&
      !db
        .prepare("SELECT id FROM ownership WHERE id=? AND user_id=?")
        .get(row.parcel_id, user.id)
    )
      throw new ApiError(404, "Pièce introuvable.");
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
