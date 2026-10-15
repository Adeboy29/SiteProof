"use client";
import { useState } from "react";
import Link from "next/link";
import { browserDb } from "../../../lib/supabase";
export default function Password() {
  const [message, setMessage] = useState("");
  return (
    <div className="modal" style={{ margin: "10vh auto" }}>
      <h2>Set a new password</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = await browserDb().auth.updateUser({
            password: String(f.get("password")),
          });
          setMessage(
            error
              ? error.message
              : "Password updated. Return to your workspace.",
          );
        }}
      >
        <label>
          New password
          <input
            type="password"
            name="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <button className="primary">Update password</button>
      </form>
      <p role="status">{message}</p>
      <Link href="/">Return to workspace →</Link>
    </div>
  );
}
