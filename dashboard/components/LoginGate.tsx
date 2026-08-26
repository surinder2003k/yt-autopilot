"use client";

import { useEffect, useState } from "react";

const USER = "sunny";
const PASS = "3424";
const KEY = "ytap_auth";

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);

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

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!login(u, p)) setErr(true);
          }}
          className="card w-full max-w-sm p-6"
        >
          <h1 className="text-xl font-semibold">YT Auto-Pilot</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to view the monitor
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <input
              value={u}
              onChange={(e) => {
                setU(e.target.value);
                setErr(false);
              }}
              placeholder="Username"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              type="password"
              value={p}
              onChange={(e) => {
                setP(e.target.value);
                setErr(false);
              }}
              placeholder="Password"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            {err && (
              <p className="text-xs text-red-600">
                Invalid username or password
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-1">
              Sign in
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-50">
      <button onClick={logout} className="btn">
        Logout
      </button>
    </div>
  );
}
