"use client";

import { useEffect, useState } from "react";

const USER = "sunny";
const PASS = "3424";
const KEY = "ytap_auth";

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    setAuthed(localStorage.getItem(KEY) === "1");
  }, []);

  const login = (u: string, p: string) => {
    if (u === USER && p === PASS) {
      localStorage.setItem(KEY, "1");
      setAuthed(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    setAuthed(false);
  };

  return { authed, login, logout };
}

export function LoginGate() {
  const { authed, login, logout } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);

  if (authed === null) return null; // loading

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!login(u, p)) setErr(true);
          }}
          className="glass glow-border w-full max-w-sm p-8"
        >
          <h1 className="text-center text-xl font-semibold glow-text text-cyan">
            YT AUTO-PILOT
          </h1>
          <p className="mt-1 text-center text-xs text-[var(--muted-foreground)]">
            Sign in to view the monitor
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <input
              value={u}
              onChange={(e) => {
                setU(e.target.value);
                setErr(false);
              }}
              placeholder="username"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-cyan"
            />
            <input
              type="password"
              value={p}
              onChange={(e) => {
                setP(e.target.value);
                setErr(false);
              }}
              placeholder="password"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-cyan"
            />
            {err && (
              <p className="text-xs text-danger">Invalid username or password</p>
            )}
            <button
              type="submit"
              className="mt-1 rounded-lg border border-[var(--border)] bg-[rgba(0,240,255,0.08)] px-3 py-2 text-sm font-medium text-cyan transition hover:bg-[rgba(0,240,255,0.16)]"
            >
              Enter
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-50">
      <button
        onClick={logout}
        className="rounded-lg border border-[var(--border)] bg-[rgba(0,240,255,0.06)] px-3 py-1 text-xs text-[var(--muted-foreground)] transition hover:text-cyan"
      >
        Logout
      </button>
    </div>
  );
}
