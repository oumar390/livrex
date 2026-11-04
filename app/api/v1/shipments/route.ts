import { db } from "@/lib/server/db";
import type { User } from "@/lib/auth-types";
import {
  requireUser,
  sameOrigin,
  body,
  failure,
  digest,
  ApiError,
} from "@/lib/server/auth";
import { createParcel } from "@/lib/server/commands";
import { Q } from "@/lib/data";
export async function GET() {
  return Response.json({
    name: "LIVREX API",
    version: "v1",
    status: "ok",
    authentication:
      "Clé API Bearer ou session sécurisée requise pour créer un envoi",
    zones: Object.keys(Q),
  });
}
export async function POST(req: Request) {
  try {
    const bearer = req.headers.get("authorization");
    let u: User;
    if (bearer?.startsWith("Bearer ")) {
      const row = db
        .prepare(
          "SELECT u.id,u.name,u.email,u.role FROM users u JOIN api_keys k ON k.user_id=u.id WHERE k.token=?",
        )
        .get(digest(bearer.slice(7)));
      if (!row) throw new ApiError(401, "Clé API invalide.");
      u = row as unknown as User;
    } else {
      sameOrigin(req);
      u = await requireUser();
    }
    const b = await body(req);
    const p = createParcel(
      u,
      {
        type: "EXPRESS",
        weight: b.weight_kg,
        cons:
          typeof b.conservation === "string"
            ? b.conservation.toUpperCase()
            : (b.conservation ?? "SEC"),
        fragile: b.fragile ?? false,
        desc: b.description || "Envoi e-commerce",
        sender: b.sender?.name || u.name,
        senderTel: b.sender?.phone || b.recipient?.phone,
        recipient: b.recipient?.name || "Destinataire",
        recipientTel: b.recipient?.phone,
        from: "DKR",
        to: "TBA",
        fromQ: b.pickup,
        toQ: b.dropoff,
        L: b.dimensions_cm?.l ?? 20,
        W: b.dimensions_cm?.w ?? 15,
        H: b.dimensions_cm?.h ?? 10,
        service:
          typeof b.service === "string"
            ? b.service.toUpperCase()
            : (b.service ?? "STANDARD"),
      },
      u.id +
        ":api:" +
        (req.headers.get("Idempotency-Key") || crypto.randomUUID()),
    );
    return Response.json(
      {
        object: "shipment",
        id: p.id,
        status: "created",
        price: { amount: p.price, currency: "XOF" },
        payment_status: "pending",
      },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
