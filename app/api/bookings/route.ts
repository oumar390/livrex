import {
  requireUser,
  sameOrigin,
  body,
  failure,
  ApiError,
} from "@/lib/server/auth";
import { createBooking } from "@/lib/server/commands";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireUser();
    const key = req.headers.get("Idempotency-Key");
    if (!key || key.length > 100)
      throw new ApiError(400, "Identifiant de requête requis.");
    return Response.json(
      await createBooking(user, await body(req), user.id + ":" + key),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
