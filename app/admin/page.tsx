"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Admin = {
  users: { id: string; email: string }[];
  organizations: { id: string; name: string }[];
  activity: { id: string; type: string; summary: string }[];
  health: string;
};
export default function Admin() {
  const [data, setData] = useState<Admin | null>(null),
    [message, setMessage] = useState("Loading administrator workspace…");
  async function load() {
    const r = await fetch("/api/admin"),
      b = await r.json();
    if (!r.ok) setMessage(b.error);
    else {
      setData(b);
      setMessage("");
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <main>
      <div className="page-heading">
        <h1>Platform administration</h1>
        <Link href="/">Workspace →</Link>
      </div>
      <p role="status">{message}</p>
      {data && (
        <>
          <div className="panel">
            <h2>System health</h2>
            <p>{data.health}</p>
            <p>
              Finalized decisions can only be challenged through an appeal or
              traceable reassessment.
            </p>
          </div>
          <div className="bottom-grid">
            <section className="panel">
              <h2>Users</h2>
              {data.users.map((u) => (
                <div className="activity" key={u.id}>
                  <div>
                    <b>{u.email}</b>
                    <small>{u.id}</small>
                  </div>
                </div>
              ))}
              <form
                className="space-top"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const r = await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "invite_user",
                      email: f.get("email"),
                    }),
                  });
                  setMessage(
                    r.ok ? "Invitation issued." : "Invitation failed.",
                  );
                  load();
                }}
              >
                <label>
                  User email <input type="email" name="email" required />
                </label>
                <button className="primary">Invite user</button>
              </form>
            </section>
            <section className="panel">
              <h2>Organizations</h2>
              {data.organizations.map((o) => (
                <div className="activity" key={o.id}>
                  {o.name}
                </div>
              ))}
            </section>
          </div>
          <section className="panel">
            <h2>Audit records</h2>
            {data.activity.map((a) => (
              <div key={a.id} className="activity">
                <b>{a.type}</b>
                <span>{a.summary}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
