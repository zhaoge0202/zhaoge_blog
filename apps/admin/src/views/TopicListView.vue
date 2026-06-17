<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>专题管理</h1>
        <p>左侧选专题，右侧编辑摘要与正文，实时预览前台真实效果。</p>
      </div>
      <div class="form-actions">
        <button type="button" @click="startCreate">新增专题</button>
        <button v-if="isEditingTopic" type="button" class="secondary" @click="resetForm">{{ secondaryActionLabel }}</button>
      </div>
    </div>

    <p v-if="message" class="notice">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="workspace-shell">
      <aside class="list-panel card">
        <div class="list-panel-header">
          <div>
            <p class="muted">专题列表</p>
            <h2>{{ topics.length }} 个专题</h2>
          </div>
        </div>
        <div class="list-stack">
          <article
            v-for="topic in topics"
            :key="topic.id"
            class="list-card"
            :class="{ selected: form.id === topic.id }"
            @click="selectTopic(topic)"
          >
            <div class="list-card-header">
              <div>
                <h3>{{ topic.title }}</h3>
                <p class="muted">{{ topic.slug }}</p>
              </div>
              <span class="badge">{{ topic.status }}</span>
            </div>
            <p class="list-summary">{{ topic.summary }}</p>
            <div class="list-card-footer">
              <span class="meta">排序 {{ topic.sortOrder }}</span>
              <div class="actions">
                <button type="button" class="secondary compact" @click.stop="selectTopic(topic)">编辑</button>
                <button
                  type="button"
                  class="secondary compact"
                  :disabled="saving"
                  @click.stop="toggleStatus(topic)"
                >
                  {{ topic.status === 'PUBLISHED' ? '下线' : '发布' }}
                </button>
              </div>
            </div>
          </article>
          <article v-if="topics.length === 0" class="list-card empty-card">
            暂无专题。
          </article>
        </div>
      </aside>

      <section class="editor-shell">
        <div v-if="isEditingTopic" class="workspace-tabs">
          <button
            type="button"
            class="secondary"
            :class="{ active: activePanel === 'editor' }"
            @click="activePanel = 'editor'"
          >
            编辑
          </button>
          <button
            type="button"
            class="secondary"
            :class="{ active: activePanel === 'preview' }"
            @click="activePanel = 'preview'"
          >
            预览
          </button>
        </div>
        <form class="card editor-main" @submit.prevent="saveTopic">
          <template v-if="activePanel === 'editor'">
            <div class="editor-main-header">
              <div>
                <h2>{{ form.id ? '编辑专题' : '新增专题' }}</h2>
                <p v-if="form.id" class="muted">当前编辑：{{ form.title }}（{{ form.slug }}）</p>
                <p v-else-if="creating" class="muted">当前模式：新增专题草稿</p>
                <p v-else class="muted">先从左侧选择一个专题，或点击“新增专题”。</p>
              </div>
              <div v-if="isEditingTopic" class="status-chip-row">
                <span class="badge">{{ form.status }}</span>
              </div>
            </div>

            <template v-if="isEditingTopic">
              <div class="meta-grid">
                <label>
                  标题
                  <input v-model.trim="form.title" required />
                </label>
                <label>
                  Slug
                  <input v-model.trim="form.slug" required />
                </label>
                <label>
                  排序
                  <input v-model.number="form.sortOrder" type="number" required />
                </label>
                <label>
                  状态
                  <select v-model="form.status" :disabled="!form.id">
                    <option v-for="status in statusOptions" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </label>
              </div>

              <MarkdownEditor
                v-model="form.summary"
                hint="前台卡片和正文顶部导语使用这段摘要。"
                label="摘要"
              />
              <MarkdownEditor
                v-model="form.content"
                hint="这里直接写完整专题正文，推荐用 H2/H3、列表、引用和代码块组织结构。"
                label="正文"
              />

              <div class="form-actions">
                <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存专题' }}</button>
                <button type="button" class="secondary" @click="resetForm">{{ secondaryActionLabel }}</button>
              </div>
            </template>
          </template>
        </form>

        <MarkdownPreviewFrame
          v-if="isEditingTopic && activePanel === 'preview'"
          :dirty="isDirty"
          :extra="{ questions: topicPreviewQuestions }"
          :payload="topicPreviewPayload"
          :preview-url="previewUrl"
          title="专题详情页"
          type="topic-preview"
        />
        <section v-else class="card empty-workspace">
          <h2>开始编辑</h2>
          <p>从左侧选择一个专题进入编辑，或创建新的专题草稿。预览会在这里同步显示前台真实页面。</p>
        </section>
      </section>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import MarkdownEditor from '../components/MarkdownEditor.vue';
import MarkdownPreviewFrame from '../components/MarkdownPreviewFrame.vue';
import { apiGet, apiPatch, apiPost, apiPut } from '../lib/api';

type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

type Topic = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  targetAudience: string;
  whyImportant: string;
  prerequisites: string;
  knowledgeMap: string;
  interviewFocus: string;
  sortOrder: number;
  status: ContentStatus;
};

type TopicForm = Omit<Topic, 'id'> & {
  id: number | null;
};

type TopicPayload = Omit<Topic, 'id' | 'status'>;
type QuestionSummary = {
  id: number;
  topicId: number;
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  frequency: string;
  masteryLevel: string;
  sortOrder: number;
  status: string;
};

const statusOptions: ContentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const topics = ref<Topic[]>([]);
const topicQuestions = ref<QuestionSummary[]>([]);
const creating = ref(false);
const activePanel = ref<'editor' | 'preview'>('editor');
const saving = ref(false);
const message = ref('');
const error = ref('');
const previewUrl = `${import.meta.env.VITE_PREVIEW_BASE ?? ''}/preview/topic`;

const emptyForm = (): TopicForm => ({
  id: null,
  slug: '',
  title: '',
  summary: '',
  content: '',
  targetAudience: 'Java 后端开发者',
  whyImportant: '',
  prerequisites: '',
  knowledgeMap: '',
  interviewFocus: '',
  sortOrder: 0,
  status: 'DRAFT',
});

const form = reactive<TopicForm>(emptyForm());
const isEditingTopic = computed(() => creating.value || form.id !== null);
const secondaryActionLabel = computed(() => (form.id ? '重载专题' : '取消新增'));
const isDirty = computed(() => {
  if (creating.value) {
    return Boolean(form.title || form.slug || form.summary || form.content);
  }
  const current = topics.value.find((topic) => topic.id === form.id);
  if (!current) {
    return false;
  }
  return JSON.stringify({
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    content: form.content,
    sortOrder: form.sortOrder,
    status: form.status,
  }) !== JSON.stringify({
    title: current.title,
    slug: current.slug,
    summary: current.summary,
    content: current.content,
    sortOrder: current.sortOrder,
    status: current.status,
  });
});

const topicPreviewPayload = computed<Topic>(() => ({
  id: form.id ?? 0,
  slug: form.slug || 'preview',
  title: form.title || '未命名专题',
  summary: form.summary,
  content: form.content,
  targetAudience: form.targetAudience,
  whyImportant: form.whyImportant,
  prerequisites: form.prerequisites,
  knowledgeMap: form.knowledgeMap,
  interviewFocus: form.interviewFocus,
  sortOrder: Number(form.sortOrder) || 0,
  status: form.status,
}));

const topicPreviewQuestions = computed(() =>
  topicQuestions.value
    .filter((question) => (form.id ? question.topicId === form.id : false))
    .sort((left, right) => left.sortOrder - right.sortOrder),
);

async function loadTopics() {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
}

async function loadQuestions() {
  topicQuestions.value = (await apiGet<{ records: QuestionSummary[] }>('/api/admin/questions?size=200')).records;
}

function selectTopic(topic: Topic) {
  creating.value = false;
  activePanel.value = 'editor';
  Object.assign(form, topic);
  error.value = '';
  message.value = '';
}

function startCreate() {
  creating.value = true;
  activePanel.value = 'editor';
  Object.assign(form, emptyForm());
  error.value = '';
  message.value = '正在新增专题，保存后默认进入草稿状态。';
}

function resetForm() {
  if (form.id) {
    const current = topics.value.find((topic) => topic.id === form.id);
    if (current) {
      selectTopic(current);
    }
    return;
  }
  creating.value = false;
  activePanel.value = 'editor';
  Object.assign(form, emptyForm());
  error.value = '';
  message.value = '';
}

function toPayload(): TopicPayload {
  return {
    slug: form.slug,
    title: form.title,
    summary: form.summary,
    content: form.content,
    targetAudience: form.targetAudience,
    whyImportant: form.whyImportant,
    prerequisites: form.prerequisites,
    knowledgeMap: form.knowledgeMap,
    interviewFocus: form.interviewFocus,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

async function saveTopic() {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const saved = form.id
      ? await apiPut<Topic, TopicPayload>(`/api/admin/topics/${form.id}`, toPayload())
      : await apiPost<Topic, TopicPayload>('/api/admin/topics', toPayload());

    if (form.id && saved.status !== form.status) {
      await updateTopicStatus(saved.id, form.status);
    }

    await loadTopics();
    const latest = topics.value.find((topic) => topic.id === saved.id);
    if (latest) {
      selectTopic(latest);
    }
    creating.value = false;
    message.value = '专题已保存。';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存专题失败';
  } finally {
    saving.value = false;
  }
}

async function updateTopicStatus(id: number, status: ContentStatus) {
  return apiPatch<Topic>(`/api/admin/topics/${id}/status?status=${status}`);
}

async function toggleStatus(topic: Topic) {
  saving.value = true;
  error.value = '';
  message.value = '';
  const nextStatus: ContentStatus = topic.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  try {
    const updated = await updateTopicStatus(topic.id, nextStatus);
    await loadTopics();
    selectTopic(updated);
    message.value = `专题已${nextStatus === 'PUBLISHED' ? '发布' : '下线'}。`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '更新专题状态失败';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadTopics(), loadQuestions()]);
});
</script>
