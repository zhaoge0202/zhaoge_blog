<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>专题管理</h1>
        <p>查看专题并维护知识主线、面试焦点和发布状态。</p>
      </div>
      <button type="button" @click="startCreate">新增专题</button>
    </div>

    <p v-if="message" class="notice">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="split">
      <table class="table card">
        <thead>
          <tr>
            <th>标题</th>
            <th>Slug</th>
            <th>状态</th>
            <th>排序</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="topic in topics"
            :key="topic.id"
            :class="{ selected: form.id === topic.id }"
          >
            <td>
              <strong>{{ topic.title }}</strong>
              <p class="muted">{{ topic.summary }}</p>
            </td>
            <td>{{ topic.slug }}</td>
            <td>{{ topic.status }}</td>
            <td>{{ topic.sortOrder }}</td>
            <td class="actions">
              <button type="button" class="secondary" @click="selectTopic(topic)">编辑</button>
              <button
                type="button"
                class="secondary"
                :disabled="saving"
                @click="toggleStatus(topic)"
              >
                {{ topic.status === 'PUBLISHED' ? '下线' : '发布' }}
              </button>
            </td>
          </tr>
          <tr v-if="topics.length === 0">
            <td colspan="5">暂无专题。</td>
          </tr>
        </tbody>
      </table>

      <form class="card form-panel" @submit.prevent="saveTopic">
        <h2>{{ form.id ? '编辑专题' : '新增专题' }}</h2>
        <div class="form-grid">
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
        <label>
          摘要
          <textarea v-model.trim="form.summary" rows="3" required />
        </label>
        <label>
          重要性
          <textarea v-model.trim="form.whyImportant" rows="3" required />
        </label>
        <label>
          知识主线
          <textarea v-model.trim="form.knowledgeMap" rows="4" required />
        </label>
        <label>
          面试焦点
          <textarea v-model.trim="form.interviewFocus" rows="4" required />
        </label>
        <details>
          <summary>补充字段</summary>
          <label>
            目标人群
            <textarea v-model.trim="form.targetAudience" rows="2" required />
          </label>
          <label>
            前置知识
            <textarea v-model.trim="form.prerequisites" rows="2" required />
          </label>
        </details>
        <div class="form-actions">
          <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存专题' }}</button>
          <button type="button" class="secondary" @click="resetForm">清空</button>
        </div>
      </form>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet, apiPatch, apiPost, apiPut } from '../lib/api';

type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

type Topic = {
  id: number;
  slug: string;
  title: string;
  summary: string;
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
const saving = ref(false);
const message = ref('');
const error = ref('');

const emptyForm = (): TopicForm => ({
  id: null,
  slug: '',
  title: '',
  summary: '',
  targetAudience: 'Java 后端开发者',
  whyImportant: '',
  prerequisites: '',
  knowledgeMap: '',
  interviewFocus: '',
  sortOrder: 0,
  status: 'DRAFT',
});

const form = reactive<TopicForm>(emptyForm());

async function loadTopics() {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
  if (!form.id && topics.value.length > 0) {
    selectTopic(topics.value[0]);
  }
}

function selectTopic(topic: Topic) {
  Object.assign(form, topic);
  error.value = '';
  message.value = '';
}

function startCreate() {
  resetForm();
  message.value = '正在新增专题，保存后默认进入草稿状态。';
}

function resetForm() {
  Object.assign(form, emptyForm());
  error.value = '';
}

function toPayload(): TopicPayload {
  return {
    slug: form.slug,
    title: form.title,
    summary: form.summary,
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

onMounted(loadTopics);
</script>
