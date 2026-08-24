import { getHistory, RunEvent } from "@/lib/history";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
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

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}

export default async function Page() {
  const events: RunEvent[] = await getHistory();
  const sorted = [...events].reverse(); // newest first
  const total = events.length;
  const success = events.filter((e) => e.status === "success").length;
  const failed = total - success;
  const successRate = total ? Math.round((success / total) * 100) : 0;
  const lastRun = sorted[0];
  const nextRun = "in ~6h (cron: 0 */6 * * *)";

  const stats = [
    { label: "Total Runs", value: total, accent: true },
    { label: "Posted", value: success, accent: true },
    { label: "Failed", value: failed, danger: failed > 0 },
    { label: "Success Rate", value: `${successRate}%`, accent: true },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      {/* Header */}
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
          <p>Next run: {nextRun}</p>
        </div>
      </header>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`glass p-4 ${s.accent ? "glow-border" : ""}`}
          >
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

      {/* Live status banner */}
      <section className="mt-6">
        <div
          className={`glass flex items-center justify-between p-4 ${
            lastRun?.status === "failed" ? "" : "glow-border"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                lastRun?.status === "failed"
                  ? "bg-danger"
                  : "bg-cyan glow-border"
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

      {/* Run history */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Run History
        </h2>

        {sorted.length === 0 ? (
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
        Auto-generated · every 6h via GitHub Actions · data: history.json
      </footer>
    </main>
  );
}
