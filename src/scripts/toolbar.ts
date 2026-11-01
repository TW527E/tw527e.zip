type ThemeChoice = "auto" | "light" | "dark";

const ORDER: ThemeChoice[] = ["auto", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = {
  auto: "主題：跟著系統（點一下切換）",
  light: "主題：淺色（點一下切換）",
  dark: "主題：深色（點一下切換）",
};

function readChoice(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
}

function applyChoice(choice: ThemeChoice, button: HTMLElement) {
  const root = document.documentElement;
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {
    // 無痕模式等情況存不了也沒關係，只是下次不會記得
  }
  button.setAttribute("aria-label", LABEL[choice]);
  document.dispatchEvent(new CustomEvent("theme:change"));
}

function initTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  button.setAttribute("aria-label", LABEL[readChoice()]);
  button.addEventListener("click", () => {
    const next = ORDER[(ORDER.indexOf(readChoice()) + 1) % ORDER.length];
    applyChoice(next, button);
  });
}

function initViewBackground() {
  const button = document.getElementById("bg-view");
  if (!button) return;
  const set = (on: boolean) => {
    document.body.classList.toggle("view-bg", on);
    button.setAttribute("aria-pressed", String(on));
  };
  button.addEventListener("click", () => set(!document.body.classList.contains("view-bg")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("view-bg")) {
      set(false);
      button.focus();
    }
  });
}

export function initToolbar() {
  initTheme();
  initViewBackground();
  document.getElementById("bg-shuffle")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("bg:shuffle"));
  });
}
