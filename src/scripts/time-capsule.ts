const DAY = 86_400_000;

interface Span {
  start: Date;
  end: Date;
}

function spans(now: Date): Record<string, Span> {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  // 一週從星期一開始
  const weekday = (now.getDay() + 6) % 7;
  return {
    day: { start: new Date(y, m, d), end: new Date(y, m, d + 1) },
    week: { start: new Date(y, m, d - weekday), end: new Date(y, m, d - weekday + 7) },
    month: { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) },
    year: { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) },
  };
}

function remainingText(key: string, ms: number): string {
  if (key === "day") {
    const h = Math.floor(ms / 3_600_000);
    const min = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `還剩 ${h} 小時 ${min} 分` : `還剩 ${min} 分`;
  }
  const days = Math.ceil(ms / DAY);
  return `還剩 ${days} 天`;
}

/** 依日曆算兩個日期差幾天（不受夏令時間影響） */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY);
}

function render(root: HTMLElement) {
  const now = new Date();
  const all = spans(now);
  for (const item of root.querySelectorAll<HTMLElement>("[data-key]")) {
    const span = all[item.dataset.key ?? ""];
    if (!span) continue;
    const total = span.end.getTime() - span.start.getTime();
    const passed = now.getTime() - span.start.getTime();
    const pct = Math.min(100, Math.max(0, (passed / total) * 100));
    const pctEl = item.querySelector<HTMLElement>("[data-pct]");
    const left = item.querySelector<HTMLElement>("[data-left]");
    const bar = item.querySelector<HTMLElement>("[data-bar]");
    const track = bar?.parentElement;
    if (pctEl) pctEl.textContent = `${Math.floor(pct)}%`;
    if (left) left.textContent = remainingText(item.dataset.key ?? "", total - passed);
    if (bar) bar.style.width = `${pct}%`;
    track?.setAttribute("aria-valuenow", Math.floor(pct).toString());
  }

  const since = document.getElementById("since");
  const sinceDate = root.dataset.since;
  if (since && sinceDate) {
    const [y, m, d] = sinceDate.split("-").map(Number);
    const days = daysBetween(new Date(y, (m || 1) - 1, d || 1), now);
    if (Number.isFinite(days) && days >= 0) {
      since.replaceChildren("這個小站已經開了 ", Object.assign(document.createElement("strong"), { textContent: days.toLocaleString("zh-TW") }), " 天，謝謝你來玩");
      since.hidden = false;
    }
  }
}

export function initTimeCapsule() {
  const root = document.getElementById("capsule");
  if (!root) return;
  render(root);
  // 每 30 秒更新一次就夠了；分頁在背景時不更新
  let timer = window.setInterval(() => render(root), 30_000);
  document.addEventListener("visibilitychange", () => {
    clearInterval(timer);
    if (document.visibilityState === "visible") {
      render(root);
      timer = window.setInterval(() => render(root), 30_000);
    }
  });
}
