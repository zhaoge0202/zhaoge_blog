<template>
  <section class="preview-panel card">
    <div class="preview-header">
      <div>
        <p class="muted">真实前台预览</p>
        <h2>{{ title }}</h2>
      </div>
      <div class="preview-meta">
        <span class="preview-state">{{ syncState }}</span>
        <a :href="previewUrl" rel="noreferrer" target="_blank">新窗口打开</a>
      </div>
    </div>
    <iframe
      ref="iframeRef"
      class="preview-frame"
      referrerpolicy="origin"
      sandbox="allow-same-origin allow-scripts"
      :src="previewUrl"
      title="前台真实预览"
      @load="sendPreview"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  extra?: Record<string, unknown>;
  dirty?: boolean;
  payload: Record<string, unknown>;
  previewUrl: string;
  title: string;
  type: 'question-preview' | 'topic-preview';
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const targetOrigin = computed(() => new URL(props.previewUrl, window.location.origin).origin);
const previewStorageKey = computed(() => `admin-preview:${props.type}`);
const syncState = ref('预览加载中');
let retryTimer: number | null = null;
let retryCount = 0;
let hasConnected = false;

function clearRetryTimer() {
  if (retryTimer !== null) {
    window.clearInterval(retryTimer);
    retryTimer = null;
  }
}

function postPreview() {
  const message = {
    ...(props.extra ?? {}),
    payload: props.payload,
    type: props.type,
  };
  localStorage.setItem(previewStorageKey.value, JSON.stringify(message));
  iframeRef.value?.contentWindow?.postMessage(
    message,
    targetOrigin.value,
  );
}

function scheduleRetry() {
  clearRetryTimer();
  retryCount = 0;
  retryTimer = window.setInterval(() => {
    postPreview();
    retryCount += 1;
    if (retryCount >= 12) {
      clearRetryTimer();
    }
  }, 250);
}

function sendPreview() {
  if (hasConnected) {
    syncState.value = props.dirty ? '草稿预览中' : '预览已连接';
  }
  postPreview();
  scheduleRetry();
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== targetOrigin.value) {
    return;
  }
  if (event.data?.type === 'preview-applied') {
    syncState.value = props.dirty ? '草稿预览中' : '预览已同步';
    clearRetryTimer();
    return;
  }
  if (event.data?.type === 'preview-ready') {
    hasConnected = true;
    syncState.value = '预览已连接';
    sendPreview();
  }
}

watch(
  () => [props.payload, props.extra, props.dirty],
  () => nextTick(sendPreview),
  { deep: true },
);

onMounted(() => window.addEventListener('message', handleMessage));
onBeforeUnmount(() => {
  clearRetryTimer();
  window.removeEventListener('message', handleMessage);
});
</script>
