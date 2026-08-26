"use client";

import { useAuth } from "@/components/LoginGate";
import type { RunEvent } from "@/lib/history";
import { useEffect, useState } from "react";

const HISTORY_URL =
  "https://raw.githubusercontent.com/surinder2003k/yt-autopilot/main/history.json";

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

function nextRunUTC(kind: "short" | "normal"): Date {
  const now = new Date();
  const d = new Date(now.getTime());
  if (kind === "short") {
    d.setUTCMinutes(0, 0, 0);
    while (d.getTime() <= now.getTime() || d.getUTCHours() % 6 !== 0) {
      d.setUTCHours(d.getUTCHours() + 1);
    }
  } else {
    d.setUTCMinutes(30, 0, 0);
    while (d.getTime() <= now.getTime() || d.getUTCHours() % 12 !== 0) {
      d.setUTCHours(d.getUTCHours() + 1);
    }
  }
  return d;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function fmtClockIST(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    day: "2-digit",
    month: "short",
  });
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return "";
  }
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdown(target: Date, now: number): string {
  const diff = Math.max(0, target.getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function Page() {
  const { authed } = useAuth();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const now = useNow(1000);

  const load = async () => {
    try {
      const res = await fetch(HISTORY_URL, { cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      setEvents(Array.isArray(data) ? (data as RunEvent[]) : []);
    } catch {
      setEvents([]);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (authed) load();
    const id = setInterval(() => {
      if (authed) load();
    }, 60000);
    return () => clearInterval(id);
  }, [authed]);

  if (authed !== true) return null;

  const sorted = [...events].reverse();
  const total = events.length;
  const success = events.filter((e) => e.status === "success").length;
  const failed = total - success;
  const successRate = total ? Math.round((success / total) * 100) : 0;
  const lastRun = sorted[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">YT Auto-Pilot</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automated YouTube pipeline monitor
          </p>
        </div>
        <span
          className={`badge ${
            lastRun?.status === "failed"
              ? "text-red-600"
              : lastRun?.status === "success"
                ? "text-green-700"
                : ""
          }`}
        >
          {lastRun ? `Last run ${timeAgo(lastRun.ts)}` : "No runs yet"}
        </span>
      </div>

      {/* Next runs */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Next Short · every 6h</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {countdown(nextRunUTC("short"), now)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            at {fmtClockIST(nextRunUTC("short"))} IST
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">
            Next Normal Video · every 12h
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {countdown(nextRunUTC("normal"), now)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            at {fmtClockIST(nextRunUTC("normal"))} IST
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: "Runs", value: total },
          { label: "Posted", value: success },
          { label: "Failed", value: failed },
          { label: "Success", value: `${successRate}%` },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-lg font-semibold">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* History */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Recent uploads
          </h2>
          <button onClick={load} className="btn">
            Refresh
          </button>
        </div>

        {!loaded ? (
          <div className="card p-8 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-400">
            No uploads yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((e, i) => (
              <article key={i} className="card flex items-center gap-4 p-4">
                <span
                  className={`dot ${e.status === "success" ? "dot-ok" : "dot-bad"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {e.title || e.topic}
                  </p>
                  <p className="text-xs text-gray-400">
                    {e.video_type === "normal" ? "Normal video" : "Short"} ·{" "}
                    {fmtDate(e.ts)}
                  </p>
                </div>
                {e.status === "success" && e.url && (
                  <a href={e.url} target="_blank" rel="noreferrer" className="btn">
                    Watch
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-xs text-gray-400">
        Shorts every 6h · Normal videos every 12h · GitHub Actions
      </footer>
    </main>
  );
}
