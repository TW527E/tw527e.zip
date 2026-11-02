/** 複製文字到剪貼簿；不支援時退回舊方法，成功回傳 true */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "visually-hidden";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const timers = new WeakMap<HTMLElement, number>();

/** 複製按鈕按下後的回饋：圖示變勾勾、螢幕報讀器念出結果 */
export function flashCopied(button: HTMLElement, ok: boolean, label: string) {
  const status = document.getElementById("copy-status");
  if (status) status.textContent = ok ? `已複製 ${label}` : `沒複製到，請自己選取 ${label}`;
  if (!ok) return;
  button.classList.add("is-done");
  clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => button.classList.remove("is-done"), 1600),
  );
}

/** 有 data-copy 的按鈕：點了就複製 data-copy 的內容 */
export function initCopyButtons(root: ParentNode = document) {
  for (const button of root.querySelectorAll<HTMLElement>("[data-copy]")) {
    button.addEventListener("click", async () => {
      const text = button.dataset.copy ?? "";
      const ok = await copyText(text);
      flashCopied(button, ok, button.dataset.copyLabel ?? "");
    });
  }
}
