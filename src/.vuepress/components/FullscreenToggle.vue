<template>
  <div v-if="shouldShow" class="fullscreen-toggle">
    <button
      class="fullscreen-toggle-btn"
      :class="{ 'is-active': isFullscreen }"
      type="button"
      :aria-pressed="isFullscreen"
      :title="title"
      @click="toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          v-if="!isFullscreen"
          d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
        />
        <path
          v-else
          d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
        />
      </svg>
      <span>{{ isFullscreen ? "退出全屏" : "全屏" }}</span>
    </button>
    <p v-if="hint" class="fullscreen-toggle-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitEnterFullscreen?: () => void;
};

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const shouldShow = ref(false);
const isFullscreen = ref(false);
const hint = ref("");
const supported = ref(true);
let hintTimer: number | undefined;

const title = computed(() =>
  isFullscreen.value ? "退出浏览器全屏" : "让文档占满整个屏幕",
);

const doc = (): FullscreenDocument => document as unknown as FullscreenDocument;

const fullscreenElement = (): Element | null => {
  const d = doc();

  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
};

const detectSupport = () => {
  const d = doc();
  const element = d.documentElement as FullscreenElement;

  supported.value = Boolean(
    d.fullscreenEnabled ||
    d.webkitFullscreenEnabled ||
    element.requestFullscreen ||
    element.webkitRequestFullscreen,
  );
};

const sync = () => {
  isFullscreen.value = Boolean(fullscreenElement());
};

const showHint = (text: string) => {
  hint.value = text;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    hint.value = "";
  }, 3200);
};

const enter = async () => {
  const element = document.documentElement as FullscreenElement;

  if (element.requestFullscreen) {
    await element.requestFullscreen({ navigationUI: "hide" });

    return;
  }

  element.webkitRequestFullscreen?.();
};

const exit = async () => {
  const d = doc();

  if (d.exitFullscreen) {
    await d.exitFullscreen();

    return;
  }

  await d.webkitExitFullscreen?.();
};

const toggle = async () => {
  try {
    if (fullscreenElement()) {
      await exit();
    } else {
      await enter();
    }
  } catch {
    showHint(
      supported.value
        ? "浏览器拒绝了全屏请求，请按 F11（macOS：⌃⌘F）手动全屏"
        : "当前环境（内嵌预览 / iframe）不允许页面全屏，请在新标签页打开，或按 F11（macOS：⌃⌘F）",
    );
  } finally {
    sync();
  }
};

onMounted(() => {
  detectSupport();
  sync();

  const show = () => {
    shouldShow.value = true;
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(show, { timeout: 1500 });
  } else {
    window.setTimeout(show, 800);
  }

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
});

onBeforeUnmount(() => {
  window.clearTimeout(hintTimer);
  document.removeEventListener("fullscreenchange", sync);
  document.removeEventListener("webkitfullscreenchange", sync);
});
</script>

<style scoped lang="scss">
.fullscreen-toggle {
  position: fixed;
  right: 20px;
  bottom: 205px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.fullscreen-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--vp-c-text);
  box-shadow: 0 8px 24px rgba(52, 39, 28, 0.12);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: var(--vp-c-accent);
    color: var(--vp-c-accent);
  }

  &.is-active {
    background: var(--vp-c-accent-bg);
    border-color: var(--vp-c-accent-bg);
    color: #fff;
  }
}

.fullscreen-toggle-hint {
  max-width: 15rem;
  margin: 0;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.5rem;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-mute);
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: right;
}

[data-theme="dark"] .fullscreen-toggle-btn {
  background: rgba(14, 22, 38, 0.9);
}

@media (max-width: 959px) {
  .fullscreen-toggle {
    display: none;
  }
}
</style>
