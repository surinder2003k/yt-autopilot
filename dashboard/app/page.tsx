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
      year: "numeric",
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

function countdown(target: Date, now: number) {
  const diff = Math.max(0, target.getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
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

  const nextShort = nextRunUTC("short");
  const nextNormal = nextRunUTC("normal");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          YT Auto-Pilot Monitor
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only dashboard for the automated YouTube Shorts pipeline
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Last run:{" "}
          <span className="font-medium text-gray-900">
            {lastRun ? timeAgo(lastRun.ts) : "—"}
          </span>
        </p>
      </header>

      {/* Countdown cards - plain, no animation */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-600">
            Next Short (every 6h)
          </p>
          <p className="mt-2 text-xl font-semibold text-gray-900 tabular-nums">
            {countdown(nextShort, now)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            posts at {fmtClockIST(nextShort)} IST
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-600">
            Next Normal Video (every 12h)
          </p>
          <p className="mt-2 text-xl font-semibold text-gray-900 tabular-nums">
            {countdown(nextNormal, now)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            posts at {fmtClockIST(nextNormal)} IST
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Runs", value: total },
          { label: "Posted", value: success },
          { label: "Failed", value: failed },
          { label: "Success Rate", value: `${successRate}%` },
        ].map((s) => (
          <div key={s.label} className="border rounded p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      {/* Health bar */}
      <section className="mb-6">
        <div className="rounded-lg bg-gray-900/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block w-6 h-6 rounded bg-gray-300/20"></span>
            <span className="text-sm text-gray-400">
              {lastRun
                ? lastRun.status === "success"
                  ? "Pipeline healthy — last post went live"
                  : "Last run failed — check Telegram alert"
                : "No runs yet"}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {lastRun ? fmtDate(lastRun.ts) : ""}
          </span>
        </div>
      </section>

      {/* History */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Run History
          </h2>
          <button
            onClick={load}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {!loaded ? (
          <div className="border rounded p-8 text-center text-sm text-gray-500">
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="border rounded p-8 text-center text-sm text-gray-500">
            No posts yet. The pipeline runs every 6 hours.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((e, i) => (
              <article key={i} className="border rounded p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-6 rounded bg-gray-300/20"></span>
                      <h3 className="truncate text-base font-medium text-gray-800">
                        {e.title || e.topic}
                      </h3>
                      {e.video_type === "short" && (
                        <span className="ml-2 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Short
                        </span>
                      )}
                      {e.video_type === "normal" && (
                        <span className="ml-2 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          7-10 min
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {e.topic}
                    </p>
                    {e.status === "failed" && e.error && (
                      <p className="mt-2 text-xs text-red-600">{e.error}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">
                      {timeAgo(e.ts)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {fmtDate(e.ts)}
                    </p>
                    {e.status === "success" && e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                        >
                        Watch ↗
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-sm text-gray-400">
        Auto-generated · Shorts every 6h + Normal video every 12h via GitHub Actions
      </footer>
    </main>
  );
}