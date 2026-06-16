<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>心路历程</h1>
        <p>记录学习误判、纠偏和项目复盘，支持草稿维护与发布。</p>
      </div>
      <button type="button" @click="startCreate">新增笔记</button>
    </div>

    <p v-if="message" class="notice">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="split">
      <section class="stack">
        <article
          v-for="note in notes"
          :key="note.id"
          class="card list-card"
          :class="{ selected: form.id === note.id }"
        >
          <p class="muted">
            {{ note.happenedOn }} · {{ note.noteType }} · {{ note.status }} · 排序 {{ note.sortOrder }}
          </p>
          <h2>{{ note.title }}</h2>
          <p>{{ note.content }}</p>
          <div class="actions">
            <button type="button" class="secondary" @click="selectNote(note)">编辑</button>
            <button type="button" class="secondary" :disabled="saving" @click="toggleStatus(note)">
              {{ note.status === 'PUBLISHED' ? '下线' : '发布' }}
            </button>
          </div>
        </article>
        <article v-if="notes.length === 0" class="card">暂无笔记。</article>
      </section>

      <form class="card form-panel" @submit.prevent="saveNote">
        <h2>{{ form.id ? '编辑笔记' : '新增笔记' }}</h2>
        <div class="form-grid">
          <label>
            标题
            <input v-model.trim="form.title" required />
          </label>
          <label>
            类型
            <select v-model="form.noteType" required>
              <option v-for="type in noteTypeOptions" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </label>
          <label>
            发生日期
            <input v-model="form.happenedOn" type="date" required />
          </label>
          <label>
            排序
            <input v-model.number="form.sortOrder" type="number" required />
          </label>
          <label>
            关联专题
            <select v-model="form.topicId">
              <option value="">不关联</option>
              <option v-for="topic in topics" :key="topic.id" :value="String(topic.id)">
                {{ topic.title }}
              </option>
            </select>
          </label>
          <label>
            关联题目 ID
            <input v-model.trim="form.questionId" placeholder="可选" />
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
          内容
          <textarea v-model.trim="form.content" rows="8" required />
        </label>
        <div class="form-actions">
          <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存笔记' }}</button>
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
type NoteType = 'LEARNING_LOG' | 'MISUNDERSTANDING' | 'REVISION' | 'PROJECT_REFLECTION' | 'INTERVIEW_REFLECTION';

type Topic = {
  id: number;
  title: string;
};

type Note = {
  id: number;
  topicId: number | null;
  questionId: number | null;
  title: string;
  content: string;
  noteType: NoteType;
  happenedOn: string;
  sortOrder: number;
  status: ContentStatus;
};

type NoteForm = {
  id: number | null;
  topicId: string;
  questionId: string;
  title: string;
  content: string;
  noteType: NoteType;
  happenedOn: string;
  sortOrder: number;
  status: ContentStatus;
};

type NotePayload = {
  topicId: number | null;
  questionId: number | null;
  noteType: NoteType;
  title: string;
  content: string;
  happenedOn: string;
  sortOrder: number;
};

const statusOptions: ContentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const noteTypeOptions: NoteType[] = [
  'LEARNING_LOG',
  'MISUNDERSTANDING',
  'REVISION',
  'PROJECT_REFLECTION',
  'INTERVIEW_REFLECTION',
];

const notes = ref<Note[]>([]);
const topics = ref<Topic[]>([]);
const saving = ref(false);
const message = ref('');
const error = ref('');

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): NoteForm => ({
  id: null,
  topicId: '',
  questionId: '',
  title: '',
  content: '',
  noteType: 'LEARNING_LOG',
  happenedOn: today(),
  sortOrder: 0,
  status: 'DRAFT',
});

const form = reactive<NoteForm>(emptyForm());

async function loadNotes() {
  notes.value = await apiGet<Note[]>('/api/admin/notes');
  if (!form.id && notes.value.length > 0) {
    selectNote(notes.value[0]);
  }
}

async function loadTopics() {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
}

function selectNote(note: Note) {
  Object.assign(form, {
    ...note,
    topicId: note.topicId == null ? '' : String(note.topicId),
    questionId: note.questionId == null ? '' : String(note.questionId),
  });
  error.value = '';
  message.value = '';
}

function startCreate() {
  resetForm();
  message.value = '正在新增笔记，保存后默认进入草稿状态。';
}

function resetForm() {
  Object.assign(form, emptyForm());
  error.value = '';
}

function nullableNumber(value: string) {
  return value.trim() === '' ? null : Number(value);
}

function toPayload(): NotePayload {
  return {
    topicId: nullableNumber(form.topicId),
    questionId: nullableNumber(form.questionId),
    noteType: form.noteType,
    title: form.title,
    content: form.content,
    happenedOn: form.happenedOn,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

async function saveNote() {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const saved = form.id
      ? await apiPut<Note, NotePayload>(`/api/admin/notes/${form.id}`, toPayload())
      : await apiPost<Note, NotePayload>('/api/admin/notes', toPayload());

    if (form.id && saved.status !== form.status) {
      await updateNoteStatus(saved.id, form.status);
    }

    await loadNotes();
    const latest = notes.value.find((note) => note.id === saved.id);
    if (latest) {
      selectNote(latest);
    }
    message.value = '笔记已保存。';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存笔记失败';
  } finally {
    saving.value = false;
  }
}

function updateNoteStatus(id: number, status: ContentStatus) {
  return apiPatch<Note>(`/api/admin/notes/${id}/status?status=${status}`);
}

async function toggleStatus(note: Note) {
  saving.value = true;
  error.value = '';
  message.value = '';
  const nextStatus: ContentStatus = note.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  try {
    const updated = await updateNoteStatus(note.id, nextStatus);
    await loadNotes();
    selectNote(updated);
    message.value = `笔记已${nextStatus === 'PUBLISHED' ? '发布' : '下线'}。`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '更新笔记状态失败';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadTopics();
  await loadNotes();
});
</script>
