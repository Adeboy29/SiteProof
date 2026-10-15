"use client";
import { useState, useEffect } from "react";
import type { Milestone } from "../lib/domain";
export function Deadlines({
  milestones,
  onOpen,
}: {
  milestones: Milestone[];
  onOpen: (m: Milestone) => void;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const upcoming = milestones
    .filter(
      (m) =>
        m.status !== "accepted" &&
        new Date(m.due_date).getTime() >= now - 86400000,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Upcoming milestone deadlines</h2>
        <span className="count">{upcoming.length}</span>
      </div>
      {upcoming.map((m) => (
        <button className="milestone-row" key={m.id} onClick={() => onOpen(m)}>
          <div>
            <b>{m.title}</b>
            <small>
              Criteria v{m.version} · {m.status}
            </small>
          </div>
          <time dateTime={m.due_date}>
            {new Intl.DateTimeFormat("en-NG", {
              timeZone: "Africa/Lagos",
              day: "numeric",
              month: "short",
            }).format(new Date(m.due_date))}
          </time>
          <span>→</span>
        </button>
      ))}
      {!upcoming.length && (
        <p>No upcoming deadlines. Add a milestone to plan the next stage.</p>
      )}
    </section>
  );
}
