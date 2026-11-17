import { defineClientConfig, withBase } from "vuepress/client";
import { h } from "vue";
import DeferredLayoutToggle from "./components/DeferredLayoutToggle.vue";
import ClickImagePreview from "./components/ClickImagePreview.vue";
import FullscreenToggle from "./components/FullscreenToggle.vue";

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

const getCurrentLocation = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

// 搜索 worker 由 slimsearch 在用户点开搜索面板时才 new Worker()，2.3MB 的脚本得现场下载，
// 弱网下点开后只能盯着"正在加载搜索索引…"。这里趁页面加载完的空闲时段把它取进 HTTP 缓存
// （worker 与站点同源，响应带 max-age=600），用户点开搜索时 new Worker() 直接命中缓存。
// 站点部署在 GitHub Pages（国内直连较慢），这一步是省掉等待感最直接的办法。
const SEARCH_WORKER_FILE = "slimsearch.worker.js";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

const shouldPrefetchSearchWorker = (): boolean => {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;

  // 省流量模式、2G 等弱网下不预取，不拿用户流量换这点等待
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType))
    return false;

  return true;
};

const prefetchSearchWorker = (): void => {
  if (typeof window === "undefined" || !shouldPrefetchSearchWorker()) return;

  fetch(withBase(SEARCH_WORKER_FILE), { credentials: "same-origin" }).catch(
    () => {
      // 预取失败不影响搜索：真到点开时仍会重新请求
    },
  );
};

const scheduleSearchWorkerPrefetch = (): void => {
  if (typeof window === "undefined") return;

  const run = (): void => prefetchSearchWorker();
  const scheduled = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
  };

  if (scheduled.requestIdleCallback) {
    scheduled.requestIdleCallback(run, { timeout: 4000 });
    return;
  }

  window.setTimeout(run, 3000);
};

export default defineClientConfig({
  enhance({ app, router }) {
    router.onError((error, to) => {
      if (typeof window === "undefined") return;

      const message = error instanceof Error ? error.message : String(error);
      if (!CHUNK_LOAD_ERROR_PATTERN.test(message)) return;

      const target = to?.fullPath || getCurrentLocation();
      const reloadKey = `interview:chunk-reload:${target}`;

      if (window.sessionStorage.getItem(reloadKey) === "1") return;

      window.sessionStorage.setItem(reloadKey, "1");
      window.location.assign(target);
    });

    router.afterEach((to) => {
      if (typeof window === "undefined") return;
      window.sessionStorage.removeItem(`interview:chunk-reload:${to.fullPath}`);
    });

    // 等首屏资源抢完再预取，避免和 LCP 抢带宽
    if (typeof window !== "undefined") {
      void router.isReady().then(() => {
        if (document.readyState === "complete") {
          scheduleSearchWorkerPrefetch();
          return;
        }

        window.addEventListener("load", scheduleSearchWorkerPrefetch, {
          once: true,
        });
      });
    }
  },
  rootComponents: [
    () => h(DeferredLayoutToggle),
    () => h(FullscreenToggle),
    () => h(ClickImagePreview),
  ],
});
