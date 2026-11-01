// 留言板：留一句話，送出前才載入 Turnstile 人機驗證（不拖慢首頁載入），成功後變成彈幕。
import { MAX_LENGTH, normalize, reject, rejectName } from "../../functions/_lib/filter";

const NAME_KEY = "guestbook-name";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

/** 第一次按送出時才去載 Turnstile 的程式 */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("load failed"));
    };
    document.head.append(script);
  });
  return loading;
}

/** 跑一次人機驗證，拿到 token。大部分人不用點任何東西；需要確認時框框會出現在 container 裡 */
async function getToken(container: HTMLElement, sitekey: string): Promise<string> {
  const turnstile = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const id = turnstile.render(container, {
      sitekey,
      action: "guestbook",
      appearance: "interaction-only",
      language: "zh-tw",
      callback: (token: string) => {
        // token 只能用一次，拿到就把元件拿掉，下次重新驗證
        turnstile.remove(id);
        resolve(token);
      },
      "error-callback": () => {
        turnstile.remove(id);
        reject(new Error("challenge failed"));
      },
      "timeout-callback": () => {
        turnstile.remove(id);
        reject(new Error("challenge timeout"));
      },
    });
  });
}

export function initGuestbook() {
  const form = document.getElementById("guestbook-form") as HTMLFormElement | null;
  if (!form) return;
  const fieldset = form.querySelector("fieldset")!;
  const input = form.querySelector<HTMLInputElement>("#guestbook-text")!;
  const nameInput = form.querySelector<HTMLInputElement>("#guestbook-name")!;
  const count = document.getElementById("guestbook-count")!;
  const status = document.getElementById("guestbook-status")!;
  const captcha = document.getElementById("guestbook-captcha")!;
  const send = form.querySelector<HTMLButtonElement>(".guestbook__send")!;
  const api = form.dataset.api ?? "/api/messages";
  const sitekey = form.dataset.sitekey ?? "";

  const show = (text: string, kind: "" | "ok" | "error" = "") => {
    status.textContent = text;
    status.className = `guestbook__status${kind ? ` is-${kind}` : ""}`;
  };

  const updateCount = () => {
    const length = Array.from(normalize(input.value)).length;
    count.textContent = `${length}/${MAX_LENGTH}`;
    count.classList.toggle("is-over", length > MAX_LENGTH);
  };

  fieldset.disabled = false;
  input.addEventListener("input", updateCount);
  // 記住上次的署名，下次不用再打
  try {
    nameInput.value = localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    // 存不了也沒關係
  }

  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = normalize(input.value);
    const name = normalize(nameInput.value);
    const problem = reject(text);
    const nameProblem = problem ? null : rejectName(name);
    if (problem || nameProblem) {
      show((problem ?? nameProblem)!, "error");
      (problem ? input : nameInput).focus();
      return;
    }

    busy = true;
    send.disabled = true;
    show("確認你不是機器人…");
    try {
      const token = await getToken(captcha, sitekey).catch(() => {
        throw new Error("人機驗證沒通過，再試一次");
      });
      show("送出中…");
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, name, token }),
      }).catch(() => {
        throw new Error("連不上伺服器，等一下再試");
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: { text: string; name: string };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "送不出去，等一下再試");

      input.value = "";
      updateCount();
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch {
        // 存不了也沒關係
      }
      show("收到了！看看背景～", "ok");
      document.dispatchEvent(new CustomEvent("danmaku:add", { detail: { text: data.message?.text ?? text, name: data.message?.name ?? name } }));
    } catch (err) {
      show(err instanceof Error ? err.message : "送不出去，等一下再試", "error");
    } finally {
      busy = false;
      send.disabled = false;
    }
  });
}
