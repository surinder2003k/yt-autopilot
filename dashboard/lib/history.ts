const HISTORY_URL =
  "https://raw.githubusercontent.com/surinder2003k/yt-autopilot/main/history.json";

export interface RunEvent {
  ts: string;
  status: "success" | "failed";
  topic_index?: number;
  topic: string;
  title?: string;
  video_id?: string;
  url?: string;
  tags?: string[];
  task_id?: string | null;
  error?: string;
}

export async function getHistory(): Promise<RunEvent[]> {
  try {
    const res = await fetch(HISTORY_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as RunEvent[]) : [];
  } catch {
    return [];
  }
}
