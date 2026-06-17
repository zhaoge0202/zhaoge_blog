<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>题目管理</h1>
        <p>左侧筛选并选择题目，右侧用 Markdown 编辑器编写摘要与正文，实时分屏预览。</p>
      </div>
    </div>

    <form class="card filters" @submit.prevent="loadQuestions">
      <label>
        关键词
        <input v-model.trim="filters.keyword" placeholder="标题或摘要" />
      </label>
      <label>
        状态
        <select v-model="filters.status">
          <option value="">全部状态</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>
      <button type="submit" :disabled="loading">筛选</button>
    </form>

    <p v-if="message" class="notice">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="workspace-shell">
      <aside class="list-panel card">
        <div class="list-panel-header">
          <div>
            <p class="muted">题目列表</p>
            <h2>{{ questions.length }} 道题</h2>
          </div>
        </div>
        <div class="list-stack">
          <article
            v-for="question in questions"
            :key="question.id"
            class="list-card"
            :class="{ selected: selectedQuestion?.id === question.id }"
            @click="selectQuestion(question.id)"
          >
            <div class="list-card-header">
              <div>
                <h3>{{ question.title }}</h3>
                <p class="muted">{{ question.slug }}</p>
              </div>
              <span class="badge">{{ question.status }}</span>
            </div>
            <p class="list-summary">{{ question.summary }}</p>
            <div class="badge-row">
              <span class="badge">{{ topicName(question.topicId) }}</span>
              <span class="badge">{{ question.difficulty }}</span>
              <span class="badge">{{ question.frequency }}</span>
            </div>
            <div class="list-card-footer">
              <span class="meta">排序 {{ question.sortOrder }}</span>
              <div class="actions">
                <button type="button" class="secondary compact" @click.stop="selectQuestion(question.id)">编辑</button>
                <button
                  type="button"
                  class="secondary compact"
                  :disabled="saving"
                  @click.stop="toggleStatus(question)"
                >
                  {{ question.status === 'PUBLISHED' ? '下线' : '发布' }}
                </button>
              </div>
            </div>
          </article>
          <article v-if="questions.length === 0" class="list-card empty-card">
            {{ loading ? '加载中...' : '暂无题目。' }}
          </article>
        </div>
      </aside>

      <section class="editor-shell">
        <form v-if="selectedQuestion" class="card editor-main" @submit.prevent="saveQuestion">
          <div class="editor-main-header">
            <div>
              <h2>编辑题目</h2>
              <p class="muted">当前编辑：{{ selectedQuestion.title }}（{{ selectedQuestion.slug }}）</p>
              <p v-if="loadingDetail" class="muted">正在加载题目详情...</p>
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
              专题
              <select v-model.number="form.topicId" required>
                <option v-for="topic in topics" :key="topic.id" :value="topic.id">
                  {{ topic.title }}
                </option>
              </select>
            </label>
            <label>
              排序
              <input v-model.number="form.sortOrder" type="number" required />
            </label>
            <label>
              难度
              <select v-model="form.difficulty" required>
                <option v-for="item in difficultyOptions" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>
            <label>
              频率
              <select v-model="form.frequency" required>
                <option v-for="item in frequencyOptions" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>
            <label>
              掌握层级
              <select v-model="form.masteryLevel" required>
                <option v-for="item in masteryOptions" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>
            <label>
              状态
              <select v-model="form.status" disabled>
                <option v-for="status in statusOptions" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </label>
          </div>

          <label class="field-block">
            <span class="field-label">摘要</span>
            <span class="muted">列表卡片和题目页顶部导语使用这段摘要。</span>
            <textarea v-model="form.summary" class="summary-input" rows="2" required></textarea>
          </label>

          <div class="field-block">
            <p class="field-label">正文</p>
            <p class="muted">用 Markdown 自由编写题目正文，左写右预览。</p>
            <MdEditor
              v-model="form.content"
              language="zh-CN"
              preview-theme="github"
              :toolbars-exclude="['save', 'github', 'fullscreen']"
              style="height: 560px"
            />
          </div>

          <div class="form-actions">
            <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存题目' }}</button>
            <button type="button" class="secondary" @click="reloadSelected">重载详情</button>
          </div>
        </form>

        <section v-else class="card empty-workspace">
          <h2>开始编辑</h2>
          <p>从左侧列表选择一条题目，右侧会显示可编辑内容和 Markdown 实时预览。</p>
        </section>
      </section>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { MdEditor } from 'md-editor-v3';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet, apiPatch, apiPut, type PageResponse } from '../lib/api';

type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Difficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
type Frequency = 'LOW' | 'MEDIUM' | 'HIGH' | 'MUST_KNOW';
type MasteryLevel = 'READ' | 'EXPLAIN' | 'DEEP_EXPLAIN' | 'PROJECT_READY';
type SectionType = 'BACKGROUND' | 'PRINCIPLE' | 'SOURCE_CODE' | 'COMPARISON' | 'SCENARIO' | 'SUMMARY';
type SourceType = 'JAVAGUIDE' | 'XIAOLIN' | 'OFFICIAL_DOC' | 'SOURCE_CODE' | 'PERSONAL_REVIEW';

type Topic = {
  id: number;
  title: string;
};

type QuestionSummary = {
  id: number;
  topicId: number;
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  frequency: Frequency;
  masteryLevel: MasteryLevel;
  sortOrder: number;
  status: ContentStatus;
};

type QuestionSection = {
  sectionType: SectionType;
  title: string;
  content: string;
  sortOrder: number;
};

type FollowUpQuestion = {
  questionText: string;
  answerHint: string;
  sortOrder: number;
};

type Misconception = {
  wrongStatement: string;
  whyWrong: string;
  correctStatement: string;
  sortOrder: number;
};

type CorrectionNote = {
  title: string;
  problem: string;
  correction: string;
  evidence: string;
  sourceType: SourceType;
};

type ProjectMapping = {
  scenario: string;
  projectTalkingPoint: string;
  riskPoint: string;
  interviewAnswer: string;
  sortOrder: number;
};

type ReferenceSource = {
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  usageNote: string;
  sortOrder: number;
};

type QuestionDetail = QuestionSummary & {
  content: string;
  sections: QuestionSection[];
  followUps: FollowUpQuestion[];
  misconceptions: Misconception[];
  corrections: CorrectionNote[];
  projectMappings: ProjectMapping[];
  references: ReferenceSource[];
};

type QuestionForm = {
  topicId: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  difficulty: Difficulty;
  frequency: Frequency;
  masteryLevel: MasteryLevel;
  sortOrder: number;
  status: ContentStatus;
};

type QuestionPayload = {
  topicId: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  difficulty: Difficulty;
  frequency: Frequency;
  masteryLevel: MasteryLevel;
  sortOrder: number;
  sections: QuestionSection[];
  followUps: FollowUpQuestion[];
  misconceptions: Misconception[];
  corrections: CorrectionNote[];
  projectMappings: ProjectMapping[];
  references: ReferenceSource[];
};

const statusOptions: ContentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const difficultyOptions: Difficulty[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const frequencyOptions: Frequency[] = ['LOW', 'MEDIUM', 'HIGH', 'MUST_KNOW'];
const masteryOptions: MasteryLevel[] = ['READ', 'EXPLAIN', 'DEEP_EXPLAIN', 'PROJECT_READY'];

const topics = ref<Topic[]>([]);
const questions = ref<QuestionSummary[]>([]);
const selectedQuestion = ref<QuestionDetail | null>(null);
const loading = ref(false);
const loadingDetail = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

const filters = reactive({
  keyword: '',
  status: '',
});

const form = reactive<QuestionForm>({
  topicId: 0,
  slug: '',
  title: '',
  summary: '',
  content: '',
  difficulty: 'BASIC',
  frequency: 'LOW',
  masteryLevel: 'READ',
  sortOrder: 0,
  status: 'DRAFT',
});

async function loadTopics() {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
}

async function loadQuestions() {
  loading.value = true;
  error.value = '';
  message.value = '';
  try {
    const params = new URLSearchParams({ size: '50' });
    if (filters.keyword) {
      params.set('keyword', filters.keyword);
    }
    if (filters.status) {
      params.set('status', filters.status);
    }
    const page = await apiGet<PageResponse<QuestionSummary>>(`/api/admin/questions?${params.toString()}`);
    questions.value = page.records;
    if (selectedQuestion.value && !questions.value.some((item) => item.id === selectedQuestion.value?.id)) {
      selectedQuestion.value = null;
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载题目失败';
  } finally {
    loading.value = false;
  }
}

async function selectQuestion(id: number) {
  loadingDetail.value = true;
  error.value = '';
  message.value = '';
  try {
    selectedQuestion.value = await apiGet<QuestionDetail>(`/api/admin/questions/${id}`);
    fillForm(selectedQuestion.value);
  } catch (caught) {
    selectedQuestion.value = null;
    error.value = caught instanceof Error ? caught.message : '加载题目详情失败';
  } finally {
    loadingDetail.value = false;
  }
}

function fillForm(question: QuestionDetail) {
  Object.assign(form, {
    topicId: question.topicId,
    slug: question.slug,
    title: question.title,
    summary: question.summary,
    content: question.content ?? '',
    difficulty: question.difficulty,
    frequency: question.frequency,
    masteryLevel: question.masteryLevel,
    sortOrder: question.sortOrder,
    status: question.status,
  });
}

function toPayload(): QuestionPayload {
  const detail = selectedQuestion.value;
  if (!detail) {
    throw new Error('请先选择题目');
  }
  return {
    topicId: Number(form.topicId),
    slug: form.slug,
    title: form.title,
    summary: form.summary,
    content: form.content,
    difficulty: form.difficulty,
    frequency: form.frequency,
    masteryLevel: form.masteryLevel,
    sortOrder: Number(form.sortOrder) || 0,
    // 子表集合前台已不再编辑，原样回传以保留既有数据。
    sections: detail.sections ?? [],
    followUps: detail.followUps ?? [],
    misconceptions: detail.misconceptions ?? [],
    corrections: detail.corrections ?? [],
    projectMappings: detail.projectMappings ?? [],
    references: detail.references ?? [],
  };
}

async function saveQuestion() {
  if (!selectedQuestion.value) {
    return;
  }
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const updated = await apiPut<QuestionDetail, QuestionPayload>(
      `/api/admin/questions/${selectedQuestion.value.id}`,
      toPayload(),
    );
    selectedQuestion.value = updated;
    fillForm(updated);
    await loadQuestions();
    message.value = '题目已保存。';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存题目失败';
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(question: QuestionSummary) {
  saving.value = true;
  error.value = '';
  message.value = '';
  const nextStatus: ContentStatus = question.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  try {
    const updated = await apiPatch<QuestionDetail>(`/api/admin/questions/${question.id}/status?status=${nextStatus}`);
    if (selectedQuestion.value?.id === question.id) {
      selectedQuestion.value = updated;
      fillForm(updated);
    }
    await loadQuestions();
    message.value = `题目已${nextStatus === 'PUBLISHED' ? '发布' : '下线'}。`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '更新题目状态失败';
  } finally {
    saving.value = false;
  }
}

async function reloadSelected() {
  if (selectedQuestion.value) {
    await selectQuestion(selectedQuestion.value.id);
  }
}

function topicName(topicId: number) {
  return topics.value.find((topic) => topic.id === topicId)?.title ?? `#${topicId}`;
}

onMounted(async () => {
  await loadTopics();
  await loadQuestions();
});
</script>
