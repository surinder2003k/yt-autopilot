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
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!login(u, p)) setErr(true);
          }}
          className="card w-full max-w-sm p-6"
        >
          <h1 className="text-center text-xl font-semibold text-[#1f2933]">
            YT Auto-Pilot
          </h1>
          <p className="mt-1 text-center text-xs text-[#5b6770]">
            Sign in to view the monitor
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <input
              value={u}
              onChange={(e) => {
                setU(e.target.value);
                setErr(false);
              }}
              placeholder="username"
              className="rounded border border-[#cbd5e0] bg-white px-3 py-2 text-sm text-[#1f2933] outline-none placeholder:text-[#8a96a3] focus:border-[#0b7fa8]"
            />
            <input
              type="password"
              value={p}
              onChange={(e) => {
                setP(e.target.value);
                setErr(false);
              }}
              placeholder="password"
              className="rounded border border-[#cbd5e0] bg-white px-3 py-2 text-sm text-[#1f2933] outline-none placeholder:text-[#8a96a3] focus:border-[#0b7fa8]"
            />
            {err && (
              <p className="text-xs text-[#d64545]">Invalid username or password</p>
            )}
            <button
              type="submit"
              className="mt-1 rounded border border-[#0b7fa8] bg-[#0b7fa8] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#096b8f]"
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
        className="rounded border border-[#cbd5e0] bg-white px-3 py-1 text-xs text-[#5b6770] transition hover:bg-[#f4f6f8]"
      >
        Logout
      </button>
    </div>
  );
}
