import {
  requireUser,
  sameOrigin,
  body,
  failure,
  ApiError,
} from "@/lib/server/auth";
import { readState, writeState, transaction, audit } from "@/lib/server/db";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser(["ADMIN", "GESTIONNAIRE", "AGENT"]);
    const b = await body(req);
    transaction(() => {
      const { S, revision } = readState();
      const booking = S.bookings.find((x) => x.id === b.id);
      if (!booking) throw new ApiError(404, "Réservation introuvable.");
      booking.paid = true;
      booking.method = "CASH";
      writeState(S, revision);
      audit(u.id, "booking.paid:" + booking.id);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
