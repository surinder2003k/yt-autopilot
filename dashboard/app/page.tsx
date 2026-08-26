"use client";

import { useAuth } from "@/components/LoginGate";
import type { RunEvent } from "@/lib/history";
import { useEffect, useState } from "react";

const HISTORY_URL =
  "https://raw.githubusercontent.com/surinder2003k/yt-autopilot/main/history.json";

// ---- Cron schedule (GitHub Actions, UTC) ----
// Shorts:  "0 */6 * * *"  -> 00:00, 06:00, 12:00, 18:00 UTC
// Normal:  "30 */12 * * *" -> 00:30, 12:30 UTC
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
  return { diff, text: `${h}h ${m}m ${s}s` };
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
    // auto-refresh history every 60s so "last run" stays fresh
    const id = setInterval(() => {
      if (authed) load();
    }, 60000);
    return () => clearInterval(id);
  }, [authed]);

  if (authed !== true) return null; // gate handles its own UI

  const sorted = [...events].reverse();
  const total = events.length;
  const success = events.filter((e) => e.status === "success").length;
  const failed = total - success;
  const successRate = total ? Math.round((success / total) * 100) : 0;
  const lastRun = sorted[0];

  const nextShort = nextRunUTC("short");
  const nextNormal = nextRunUTC("normal");
  const shortCd = countdown(nextShort, now);
  const normalCd = countdown(nextNormal, now);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan glow-border" />
            <h1 className="text-2xl font-semibold tracking-tight glow-text text-cyan">
              YT AUTO-PILOT
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Read-only monitor · automated YouTube Shorts pipeline
          </p>
        </div>
        <div className="text-right text-xs text-[var(--muted-foreground)]">
          <p>
            Last run:{" "}
            <span className="text-[var(--foreground)]">
              {lastRun ? timeAgo(lastRun.ts) : "—"}
            </span>
          </p>
        </div>
      </header>

      {/* ---- LIVE NEXT-POST COUNTDOWN ---- */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass glow-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              Next Short (every 6h)
            </p>
            <span className="rounded-full border border-[var(--border)] bg-[rgba(0,240,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-cyan">
              Short
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-cyan glow-text tabular-nums">
            {shortCd.text}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            posts at {fmtClockIST(nextShort)} IST
          </p>
        </div>

        <div className="glass glow-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              Next Normal Video (every 12h)
            </p>
            <span className="rounded-full border border-[var(--border)] bg-[rgba(0,240,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-cyan">
              7-10 min
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-cyan glow-text tabular-nums">
            {normalCd.text}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            posts at {fmtClockIST(nextNormal)} IST
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Runs", value: total, accent: true },
          { label: "Posted", value: success, accent: true },
          { label: "Failed", value: failed, danger: failed > 0 },
          { label: "Success Rate", value: `${successRate}%`, accent: true },
        ].map((s) => (
          <div key={s.label} className={`glass p-4 ${s.accent ? "glow-border" : ""}`}>
            <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              {s.label}
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                s.danger ? "text-danger" : "text-cyan glow-text"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <div
          className={`glass flex items-center justify-between p-4 ${
            lastRun?.status === "failed" ? "" : "glow-border"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                lastRun?.status === "failed" ? "bg-danger" : "bg-cyan glow-border"
              }`}
            />
            <span className="text-sm">
              {lastRun
                ? lastRun.status === "success"
                  ? "Pipeline healthy — last post went live"
                  : "Last run failed — check Telegram alert"
                : "No runs yet"}
            </span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">
            {lastRun ? fmtDate(lastRun.ts) : ""}
          </span>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Run History
          </h2>
          <button
            onClick={load}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-cyan transition hover:bg-[rgba(0,240,255,0.08)]"
          >
            Refresh
          </button>
        </div>

        {!loaded ? (
          <div className="glass p-8 text-center text-sm text-[var(--muted-foreground)]">
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-[var(--muted-foreground)]">
            No posts yet. The pipeline runs every 6 hours.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((e, i) => (
              <article key={i} className="glass p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                          e.status === "success" ? "bg-cyan" : "bg-danger"
                        }`}
                      />
                      <h3 className="truncate text-base font-medium text-[var(--foreground)]">
                        {e.title || e.topic}
                      </h3>
                      {e.video_type === "short" && (
                        <span className="ml-2 rounded-full border border-[var(--border)] bg-[rgba(0,240,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-cyan">
                          Short
                        </span>
                      )}
                      {e.video_type === "normal" && (
                        <span className="ml-2 rounded-full border border-[var(--border)] bg-[rgba(0,240,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-cyan">
                          7-10 min
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                      {e.topic}
                    </p>
                    {e.status === "success" && e.tags && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {e.status === "failed" && e.error && (
                      <p className="mt-2 text-xs text-danger">{e.error}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {timeAgo(e.ts)}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {fmtDate(e.ts)}
                    </p>
                    {e.status === "success" && e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-cyan transition hover:bg-[rgba(0,240,255,0.08)]"
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

      <footer className="mt-12 text-center text-xs text-[var(--muted-foreground)]">
        Auto-generated · Shorts every 6h + Normal video every 12h via GitHub
        Actions · data: history.json
      </footer>
    </main>
  );
}
