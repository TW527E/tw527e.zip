// 背景設定
// provider:
//   "local"  → 從 local 清單隨機挑一張（預設）
//   "remote" → 先試 remote.url（例如隨機圖 API），失敗或逾時就退回 local
// 不管哪一種，最後都會退回 fallback；連 fallback 都失敗就只顯示漸層，頁面照常顯示。
// 若改用 remote，記得把該網域加進 public/_headers 的 CSP img-src。
//
// tone：這張圖比較亮（light）還是比較暗（dark）。
// 淺色主題優先挑 light 的圖、深色主題優先挑 dark 的圖，玻璃上的字才看得清楚。
//
// device（可省略）：只在某種版面出現。
//   "mobile"  → 只有手機版面（畫面寬度 959px 以下）會挑到，適合直的圖
//   "desktop" → 只有電腦版面（960px 以上）會挑到，適合很寬的圖
//   省略      → 兩種版面都會挑到
//
// weight（可省略，預設 1）：被挑中的機會。2 就是一般圖的兩倍，0.5 是一半，0 是不會被隨機挑到。
export interface BackgroundImage {
  src: string;
  tone: "light" | "dark";
  device?: "mobile" | "desktop";
  weight?: number;
}

export interface BackgroundConfig {
  provider: "local" | "remote";
  local: BackgroundImage[];
  fallback: { light: string; dark: string };
  remote: {
    url: string;
    timeoutMs: number;
  };
}

export const background: BackgroundConfig = {
  provider: "local",
  local: [
    { src: "/bg/1.avif", tone: "light" },
    { src: "/bg/2.avif", tone: "dark" },
    { src: "/bg/3.avif", tone: "dark", device: "desktop" },
    { src: "/bg/4.avif", tone: "dark", weight: 2 },
    { src: "/bg/5.avif", tone: "light", device: "desktop", weight: 1.3 },
    { src: "/bg/6.avif", tone: "light" },
    { src: "/bg/7.avif", tone: "light" },
    { src: "/bg/8.avif", tone: "light", device: "desktop", weight: 1.2 },
    { src: "/bg/9.avif", tone: "light", device: "desktop", weight: 1.1 },
    { src: "/bg/10.avif", tone: "dark", weight: 0.5 },
    { src: "/bg/VRChat_2023-11-04_20-35-09.863_2160x3840.webp", tone: "light", device: "mobile" },
    { src: "/bg/VRChat_2026-04-12_23-42-30.322_2160x3840_wrld_68cd9caa-a1a1-4519-a638-fdc6f71ae2fa.avif", tone: "light", device: "mobile", weight: 1.2 },
    { src: "/bg/VRChat_2026-05-12_21-08-15.336_1080x1920_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light", device: "mobile", weight: 0.6 },
    { src: "/bg/VRChat_2026-05-12_21-10-18.696_1080x1920_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "dark", device: "mobile", weight: 0.5 },
    { src: "/bg/VRChat_2026-06-15_14-55-01.689_2160x3840_wrld_f5eb13b9-5f46-47fd-8d2a-ecda9b6f69cb.avif", tone: "dark", device: "mobile", weight: 1.2 },
    { src: "/bg/VRChat_2026-09-30_21-32-48.540_2160x3840_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "light", device: "mobile", weight: 1.1 },
    { src: "/bg/VRChat_2026-01-01_15-46-19.480_2160x3840_wrld_571be847-fc14-45c5-bc25-12ee29588c7f.avif", tone: "light", device: "mobile", weight: 0.9 },
    { src: "/bg/VRChat_2026-05-12_21-09-29.773_1080x1920_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light", device: "mobile", weight: 0.3 },
    { src: "/bg/VRChat_2026-05-12_21-12-12.000_1080x1920_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light", device: "mobile", weight: 0.5 },
    { src: "/bg/VRChat_2026-05-12_21-13-43.611_1080x1920_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light", device: "mobile" },
    { src: "/bg/VRChat_2023-11-05_23-53-31.601_3840x2160.webp", tone: "dark", device: "desktop", weight: 1.1 },
    { src: "/bg/VRChat_2023-11-12_00-17-10.104_3840x2160.webp", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2024-02-06_23-55-13.561_3840x2160_wrld_2755f213-a369-46a3-97c9-791d289f9ba1.webp", tone: "light", weight: 1.3 },
    { src: "/bg/VRChat_2024-02-06_23-55-30.857_3840x2160_wrld_2755f213-a369-46a3-97c9-791d289f9ba1.webp", tone: "light", device: "desktop", weight: 1.3 },
    { src: "/bg/VRChat_2024-03-31_15-44-12.968_3840x2160_wrld_f0cecb84-d135-4504-a4eb-55d517ac6bcf.webp", tone: "dark", weight: 1.1 },
    { src: "/bg/VRChat_2024-05-26_23-08-39.298_3840x2160_wrld_955dca77-cfd2-4ce0-9d0b-bb2af99aa87c.avif", tone: "dark", weight: 1.1 },
    { src: "/bg/VRChat_2024-06-18_22-43-04.141_3840x2160_wrld_955dca77-cfd2-4ce0-9d0b-bb2af99aa87c.avif", tone: "dark" },
    { src: "/bg/VRChat_2024-10-03_23-43-02.525_1920x1080_wrld_4e7bc01b-98a2-4001-acb0-d0a54d9d583f.avif", tone: "dark", weight: 1.05 },
    { src: "/bg/VRChat_2024-10-20_17-01-34.936_3840x2160_wrld_736bad27-4663-4346-a345-26e1e859d94e.avif", tone: "light", device: "desktop", weight: 1.4 },
    { src: "/bg/VRChat_2024-12-22_15-04-45.645_3840x2160_wrld_4ae52b66-3445-40a9-8c02-caf0d1347ac8.avif", tone: "dark", device: "desktop", weight: 1.2 },
    { src: "/bg/VRChat_2024-12-29_16-59-18.080_2160x3840_wrld_3bfa6430-1536-45e6-a8ef-062b488aefab.avif", tone: "dark", device: "mobile", weight: 1.5 },
    { src: "/bg/VRChat_2026-05-26_00-18-21.573_3840x2160_wrld_0c5b4cd0-a2a6-49fd-8c42-4862062b3671.avif", tone: "dark" },
    { src: "/bg/VRChat_2025-06-14_14-24-34.607_3840x2160_wrld_3bfa6430-1536-45e6-a8ef-062b488aefab.avif", tone: "light", weight: 1.5 },
    { src: "/bg/VRChat_2025-06-18_22-45-44.472_3840x2160_wrld_ed4a3561-4498-4450-96ee-9b711f730586.avif", tone: "dark", weight: 1.1 },
    { src: "/bg/VRChat_2025-06-20_21-40-01.593_3840x2160_wrld_38640b02-e7fa-4a79-8fa0-105bcca20700.avif", tone: "dark", device: "desktop", weight: 0.8 },
    { src: "/bg/VRChat_2025-07-22_01-43-52.247_3840x2160_wrld_c4069ce3-06db-4723-ac01-18437ab3f050.avif", tone: "light", device: "desktop", weight: 1.2 },
    { src: "/bg/VRChat_2025-07-22_01-50-58.668_3840x2160_wrld_c4069ce3-06db-4723-ac01-18437ab3f050.avif", tone: "light", weight: 1.2 },
    { src: "/bg/VRChat_2025-07-23_07-50-12.647_1920x1080.avif", tone: "light", device: "desktop", weight: 1.1 },
    { src: "/bg/VRChat_2025-07-23_08-31-11.805_1920x1080.avif", tone: "light", device: "desktop", weight: 0.9 },
    { src: "/bg/VRChat_2025-07-23_12-30-12.944_1920x1080.avif", tone: "dark", device: "desktop", weight: 0.9 },
    { src: "/bg/VRChat_2026-05-25_00-24-40.521_3840x2160_wrld_929c02a8-780f-493c-8a68-72125b7b6b53.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2025-09-02_23-05-20.503_3840x2160_wrld_4e7bc01b-98a2-4001-acb0-d0a54d9d583f.avif", tone: "dark" },
    { src: "/bg/VRChat_2025-07-23_20-47-56.820_3840x2160_wrld_d0833ed4-6695-4c4d-8e7b-95d025c2608e.avif", tone: "light", device: "desktop", weight: 0.7 },
    { src: "/bg/VRChat_2025-09-29_22-21-26.634_2048x1440.avif", tone: "light", device: "desktop", weight: 1.1 },
    { src: "/bg/VRChat_2025-10-06_23-20-12.807_3840x2160_wrld_a7700e61-4792-48d9-b897-f20712365bf3.avif", tone: "dark", device: "desktop", weight: 1.2 },
    { src: "/bg/VRChat_2025-10-06_23-20-54.924_3840x2160_wrld_a7700e61-4792-48d9-b897-f20712365bf3.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2025-10-06_23-24-26.219_3840x2160_wrld_a7700e61-4792-48d9-b897-f20712365bf3.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2025-10-06_23-33-04.419_3840x2160_wrld_a7700e61-4792-48d9-b897-f20712365bf3.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2025-11-24_21-20-58.949_3840x2160_wrld_cd5dcd24-df86-419a-80e4-b36f4785908a.avif", tone: "light", weight: 1.2 },
    { src: "/bg/VRChat_2026-01-01_00-01-07.866_3840x2160_wrld_95317403-8519-4803-8a7f-2cc93a3582a8.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-01-01_00-45-03.836_2048x1440.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-02-04_22-58-11.321_3840x2160_wrld_59144203-48ff-40bc-aa71-9b4b1f954bfc.avif", tone: "dark", weight: 1.3 },
    { src: "/bg/VRChat_2026-02-05_00-12-24.108_3840x2160_wrld_59144203-48ff-40bc-aa71-9b4b1f954bfc.avif", tone: "dark", weight: 0.7 },
    { src: "/bg/VRChat_2026-02-20_21-57-50.994_2048x1440.avif", tone: "dark", weight: 0.1 },
    { src: "/bg/VRChat_2026-05-07_23-10-11.640_3840x2160_wrld_d0833ed4-6695-4c4d-8e7b-95d025c2608e.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-05-12_21-07-03.554_1920x1080_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light" },
    { src: "/bg/VRChat_2026-05-12_21-09-10.830_1920x1080_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "dark", device: "desktop", weight: 0.5 },
    { src: "/bg/VRChat_2026-05-12_21-14-02.491_1920x1080_wrld_9456049c-dc11-46a0-97b9-44934b8a4771.avif", tone: "light", device: "desktop", weight: 0.5 },
    { src: "/bg/VRChat_2026-06-16_13-29-12.701_3840x2160_wrld_e684c2c3-4a13-4ad4-9b9c-698b1059b359.avif", tone: "dark", weight: 1.4 },
    { src: "/bg/VRChat_2026-06-16_18-29-28.131_3840x2160_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "dark", device: "desktop", weight: 1.4 },
    { src: "/bg/VRChat_2026-06-20_20-02-08.600_3840x2160_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-06-20_23-08-29.300_3840x2160_wrld_e684c2c3-4a13-4ad4-9b9c-698b1059b359.avif", tone: "light", weight: 1.3 },
    { src: "/bg/VRChat_2026-06-20_23-27-37.462_3840x2160_wrld_e684c2c3-4a13-4ad4-9b9c-698b1059b359.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-07-06_08-35-08.228_3840x2160_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "dark" },
    { src: "/bg/VRChat_2026-07-09_16-52-22.966_3840x2160_wrld_faaa0b96-2934-4bd2-bb60-8508edc96b4b.avif", tone: "dark" },
    { src: "/bg/VRChat_2026-07-09_17-01-43.915_2048x1440.avif", tone: "dark" },
    { src: "/bg/VRChat_2026-07-09_17-37-19.899_3840x2160_wrld_3632c71d-cbfa-4107-91ea-063675cc42e3.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-07-10_09-48-54.356_3840x2160_wrld_2d1cc673-650f-4c64-8c82-a08d5ccd02b2.avif", tone: "dark", device: "desktop", weight: 1.3 },
    { src: "/bg/VRChat_2026-07-10_09-50-22.832_3840x2160_wrld_2d1cc673-650f-4c64-8c82-a08d5ccd02b2.avif", tone: "dark", device: "desktop", weight: 1.3 },
    { src: "/bg/VRChat_2026-07-10_09-51-40.134_3840x2160_wrld_2d1cc673-650f-4c64-8c82-a08d5ccd02b2.avif", tone: "dark", device: "desktop", weight: 1.3 },
    { src: "/bg/VRChat_2026-07-10_21-36-12.948_3840x2160_wrld_955dca77-cfd2-4ce0-9d0b-bb2af99aa87c.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-07-11_11-09-47.453_2048x1440.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-07-13_20-11-22.407_3840x2160_wrld_48ea5e28-89ac-4e39-be98-f0ebdaf5a8d0.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-07-13_20-12-20.805_3840x2160_wrld_48ea5e28-89ac-4e39-be98-f0ebdaf5a8d0.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-07-23_17-57-30.626_2048x1440.avif", tone: "light", device: "desktop" },
    { src: "/bg/VRChat_2026-07-25_16-48-40.283_3840x2160_wrld_68dcfff3-d6ae-40d9-835b-a2e3267e47e8.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-08-27_20-32-28.827_2048x1440.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-08-27_20-33-16.953_2048x1440.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-08-29_23-18-32.787_2048x1440.avif", tone: "dark", device: "desktop" },
    { src: "/bg/VRChat_2026-09-30_21-33-04.550_3840x2160_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "dark" },
    { src: "/bg/VRChat_2026-09-30_22-20-12.531_3840x2160_wrld_677b8e51-a009-4695-b4a1-cc4d55f9affe.avif", tone: "dark" },
    { src: "/bg/圖片_20260710100545_51_190.avif", tone: "dark", device: "desktop" },
    { src: "/bg/圖片_20260710100546_52_190.avif", tone: "dark", device: "desktop" },
    // 只給手機或電腦的圖，像這樣加：
    // { src: "/bg/11.avif", tone: "dark", device: "mobile" },
    // { src: "/bg/12.avif", tone: "light", device: "desktop" },
    // 想讓某張常出現一點：
    // { src: "/bg/13.avif", tone: "light", weight: 3 },
  ],
  fallback: { light: "/bg/default-light.avif", dark: "/bg/default-dark.avif" },
  remote: {
    url: "",
    timeoutMs: 3000,
  },
};
