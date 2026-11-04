"use client";
import { useState, useEffect } from "react";
import { PageHead } from "@/components/ui";
import { ROLES, ROLE_LABELS, type User, type Role } from "@/lib/auth-types";
export default function Team() {
  const [users, setUsers] = useState<User[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = () =>
    fetch("/api/team")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setUsers(d);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function change(id: string, role: Role) {
    setError("");
    setMessage("");
    const r = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    const d = await r.json();
    if (!r.ok) setError(d.error);
    else {
      setMessage("Rôle enregistré. La personne devra se reconnecter.");
      load();
    }
  }
  return (
    <section className="view">
      <PageHead
        eyebrow="Administration"
        title="L’équipe et ses accès"
        lead="Chaque personne crée son compte. Attribuez-lui ensuite le rôle correspondant à son métier."
      />
      <div className="wrap">
        {error && (
          <p className="errbox" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="note" role="status">
            {message}
          </p>
        )}
        <div className="team-list">
          {users.map((u) => (
            <div className="card team-member" key={u.id}>
              <div className="avatar">{u.name[0]}</div>
              <div>
                <h3>{u.name}</h3>
                <p className="muted">{u.email}</p>
              </div>
              <label>
                <span className="sr-only">Rôle de {u.name}</span>
                <select
                  className="in"
                  value={u.role}
                  onChange={(e) => change(u.id, e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
