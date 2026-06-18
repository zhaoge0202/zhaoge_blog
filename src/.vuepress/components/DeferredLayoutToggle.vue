<template>
  <button
    v-if="shouldShow"
    class="layout-toggle-btn"
    :class="{ 'is-hidden': isHidden }"
    :title="isHidden ? '退出沉浸式阅读' : '沉浸式阅读'"
    @click="toggleLayout"
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
        v-if="!isHidden"
        d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
      />
      <path
        v-else
        d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
      />
    </svg>
    <span>{{ isHidden ? "退出沉浸" : "沉浸阅读" }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePageData } from "vuepress/client";

const STORAGE_KEY = "interview-layout-hidden";
const isHidden = ref(false);
const shouldShow = ref(false);
const pageData = usePageData();

const originalTitle = computed(() => {
  const siteTitle = "Java 面试进阶指南";
  const title = pageData.value.title;

  return title ? `${title} | ${siteTitle}` : siteTitle;
});

const applyState = (hidden: boolean) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("layout-hidden", hidden);
  document.title = hidden ? "Java 面试进阶指南 - 沉浸式阅读" : originalTitle.value;
};

const toggleLayout = () => {
  isHidden.value = !isHidden.value;
};

watch(isHidden, (hidden) => {
  applyState(hidden);
  window.localStorage?.setItem(STORAGE_KEY, String(hidden));
});

watch(
  () => pageData.value.path,
  () => {
    if (isHidden.value) applyState(true);
  },
);

onMounted(() => {
  const show = () => {
    shouldShow.value = true;
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(show, { timeout: 1500 });
  } else {
    window.setTimeout(show, 800);
  }

  if (window.localStorage?.getItem(STORAGE_KEY) === "true") {
    isHidden.value = true;
    applyState(true);
  }
});
</script>

<style scoped lang="scss">
.layout-toggle-btn {
  position: fixed;
  right: 20px;
  bottom: 150px;
  z-index: 999;
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

  &.is-hidden {
    background: var(--vp-c-accent-bg);
    border-color: var(--vp-c-accent-bg);
    color: #fff;
  }
}

@media (max-width: 959px) {
  .layout-toggle-btn {
    display: none;
  }
}
</style>
