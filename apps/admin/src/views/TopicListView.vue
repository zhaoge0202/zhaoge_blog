<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>专题管理</h1>
        <p>左侧选专题，右侧用 Markdown 编辑器编写摘要与正文，左写右实时预览。</p>
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
        <form v-if="isEditingTopic" class="card editor-main" @submit.prevent="saveTopic">
          <div class="editor-main-header">
            <div>
              <h2>{{ form.id ? '编辑专题' : '新增专题' }}</h2>
              <p v-if="form.id" class="muted">当前编辑：{{ form.title }}（{{ form.slug }}）</p>
              <p v-else class="muted">当前模式：新增专题草稿</p>
            </div>
            <div class="status-chip-row">
              <span class="badge">{{ form.status }}</span>
            </div>
          </div>

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

          <label class="field-block">
            <span class="field-label">摘要</span>
            <span class="muted">前台卡片和正文顶部导语使用这段摘要。</span>
            <textarea v-model="form.summary" class="summary-input" rows="2" required></textarea>
          </label>

          <div class="field-block">
            <p class="field-label">正文</p>
            <p class="muted">用 Markdown 自由编写专题正文，推荐用 H2/H3、列表、引用和代码块组织结构。</p>
            <MdEditor
              v-model="form.content"
              language="zh-CN"
              preview-theme="github"
              :toolbars-exclude="['save', 'github', 'fullscreen']"
              style="height: 560px"
            />
          </div>

          <div class="form-actions">
            <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存专题' }}</button>
            <button type="button" class="secondary" @click="resetForm">{{ secondaryActionLabel }}</button>
          </div>
        </form>

        <section v-else class="card empty-workspace">
          <h2>开始编辑</h2>
          <p>从左侧选择一个专题进入编辑，或创建新的专题草稿。</p>
        </section>
      </section>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { MdEditor } from 'md-editor-v3';
import AdminLayout from '../components/AdminLayout.vue';
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

const statusOptions: ContentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const topics = ref<Topic[]>([]);
const creating = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

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

async function loadTopics() {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
}

function selectTopic(topic: Topic) {
  creating.value = false;
  Object.assign(form, topic);
  error.value = '';
  message.value = '';
}

function startCreate() {
  creating.value = true;
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
  await loadTopics();
});
</script>
