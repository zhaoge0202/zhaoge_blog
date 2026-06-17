<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>题目管理</h1>
        <p>先筛选和选择题目，再在右侧工作区集中编辑摘要与回答内容。</p>
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
        <div v-if="selectedQuestion" class="workspace-tabs">
          <button
            type="button"
            class="secondary"
            :class="{ active: activePanel === 'summary' }"
            @click="activePanel = 'summary'"
          >
            摘要
          </button>
          <button
            type="button"
            class="secondary"
            :class="{ active: activePanel === 'core' }"
            @click="activePanel = 'core'"
          >
            核心回答
          </button>
          <button
            type="button"
            class="secondary"
            :class="{ active: activePanel === 'deep' }"
            @click="activePanel = 'deep'"
          >
            深入回答
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
        <form class="card editor-main" @submit.prevent="saveQuestion">
          <template v-if="activePanel !== 'preview'">
            <div class="editor-main-header">
              <div>
                <h2>Markdown 编辑</h2>
                <p v-if="selectedQuestion" class="muted">当前编辑：{{ selectedQuestion.title }}（{{ selectedQuestion.slug }}）</p>
                <p v-else class="muted">请从左侧选择一条题目进入编辑。</p>
                <p v-if="loadingDetail" class="muted">正在加载题目详情...</p>
              </div>
              <div v-if="selectedQuestion" class="status-chip-row">
                <span class="badge">{{ form.status }}</span>
              </div>
            </div>

            <template v-if="selectedQuestion">
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

              <MarkdownEditor
                v-if="activePanel === 'summary'"
                v-model="form.summary"
                hint="列表卡片和题目页顶部导语使用这段摘要。"
                label="摘要"
              />
              <div v-if="activePanel === 'core'" class="stack">
                <MarkdownEditor
                  v-model="form.shortAnswer"
                  hint="30 秒短回答，前台第一屏答案块会直接展示。"
                  label="30 秒回答"
                />
                <MarkdownEditor
                  v-model="form.longAnswer"
                  hint="2 分钟展开回答，用于面试时从结论展开到机制。"
                  label="2 分钟回答"
                />
              </div>
              <div v-if="activePanel === 'deep'" class="stack">
                <MarkdownEditor
                  v-model="form.deepDive"
                  hint="深度解释、原理、边界和实现细节。"
                  label="深度解释"
                />
                <MarkdownEditor
                  v-model="form.answerStrategy"
                  hint="告诉自己实际该怎么答，避免只会背。"
                  label="回答策略"
                />
              </div>

              <div class="form-actions">
                <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存题目' }}</button>
                <button type="button" class="secondary" @click="reloadSelected">重载详情</button>
              </div>
            </template>
          </template>
        </form>

        <MarkdownPreviewFrame
          v-if="selectedQuestion && activePanel === 'preview'"
          :dirty="isDirty"
          :payload="questionPreviewPayload"
          :preview-url="previewUrl"
          title="题目详情页"
          type="question-preview"
        />
        <section v-else class="card empty-workspace">
          <h2>开始编辑</h2>
          <p>从左侧列表选择一条题目，右侧会显示可编辑内容和前台真实预览。</p>
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
  shortAnswer: string;
  longAnswer: string;
  deepDive: string;
  answerStrategy: string;
  sections: QuestionSection[];
  followUps: FollowUpQuestion[];
  misconceptions: Misconception[];
  corrections: CorrectionNote[];
  projectMappings: ProjectMapping[];
  references: ReferenceSource[];
};

type QuestionForm = Omit<QuestionDetail, 'id' | 'sections' | 'followUps' | 'misconceptions' | 'corrections' | 'projectMappings' | 'references'>;
type QuestionPayload = Omit<QuestionDetail, 'id' | 'status'>;

const statusOptions: ContentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const difficultyOptions: Difficulty[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const frequencyOptions: Frequency[] = ['LOW', 'MEDIUM', 'HIGH', 'MUST_KNOW'];
const masteryOptions: MasteryLevel[] = ['READ', 'EXPLAIN', 'DEEP_EXPLAIN', 'PROJECT_READY'];

const topics = ref<Topic[]>([]);
const questions = ref<QuestionSummary[]>([]);
const selectedQuestion = ref<QuestionDetail | null>(null);
const activePanel = ref<'summary' | 'core' | 'deep' | 'preview'>('summary');
const loading = ref(false);
const loadingDetail = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');
const previewUrl = `${import.meta.env.VITE_PREVIEW_BASE ?? ''}/preview/question`;

const filters = reactive({
  keyword: '',
  status: '',
});

const form = reactive<QuestionForm>({
  topicId: 0,
  slug: '',
  title: '',
  summary: '',
  difficulty: 'BASIC',
  frequency: 'LOW',
  masteryLevel: 'READ',
  shortAnswer: '',
  longAnswer: '',
  deepDive: '',
  answerStrategy: '',
  sortOrder: 0,
  status: 'DRAFT',
});
const isDirty = computed(() => {
  const current = selectedQuestion.value;
  if (!current) {
    return false;
  }
  return JSON.stringify({
    topicId: form.topicId,
    slug: form.slug,
    title: form.title,
    summary: form.summary,
    difficulty: form.difficulty,
    frequency: form.frequency,
    masteryLevel: form.masteryLevel,
    shortAnswer: form.shortAnswer,
    longAnswer: form.longAnswer,
    deepDive: form.deepDive,
    answerStrategy: form.answerStrategy,
    sortOrder: form.sortOrder,
  }) !== JSON.stringify({
    topicId: current.topicId,
    slug: current.slug,
    title: current.title,
    summary: current.summary,
    difficulty: current.difficulty,
    frequency: current.frequency,
    masteryLevel: current.masteryLevel,
    shortAnswer: current.shortAnswer,
    longAnswer: current.longAnswer,
    deepDive: current.deepDive,
    answerStrategy: current.answerStrategy,
    sortOrder: current.sortOrder,
  });
});

const questionPreviewPayload = computed<QuestionDetail>(() => {
  const detail = selectedQuestion.value;
  return {
    id: detail?.id ?? 0,
    topicId: Number(form.topicId),
    slug: form.slug || 'preview',
    title: form.title || '未命名题目',
    summary: form.summary,
    difficulty: form.difficulty,
    frequency: form.frequency,
    masteryLevel: form.masteryLevel,
    shortAnswer: form.shortAnswer,
    longAnswer: form.longAnswer,
    deepDive: form.deepDive,
    answerStrategy: form.answerStrategy,
    sortOrder: Number(form.sortOrder) || 0,
    status: form.status,
    sections: detail?.sections ?? [],
    followUps: detail?.followUps ?? [],
    misconceptions: detail?.misconceptions ?? [],
    corrections: detail?.corrections ?? [],
    projectMappings: detail?.projectMappings ?? [],
    references: detail?.references ?? [],
  };
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
  activePanel.value = 'summary';
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
    difficulty: question.difficulty,
    frequency: question.frequency,
    masteryLevel: question.masteryLevel,
    shortAnswer: question.shortAnswer,
    longAnswer: question.longAnswer,
    deepDive: question.deepDive,
    answerStrategy: question.answerStrategy,
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
    difficulty: form.difficulty,
    frequency: form.frequency,
    masteryLevel: form.masteryLevel,
    shortAnswer: form.shortAnswer,
    longAnswer: form.longAnswer,
    deepDive: form.deepDive,
    answerStrategy: form.answerStrategy,
    sortOrder: Number(form.sortOrder) || 0,
    sections: detail.sections.map(({ sectionType, title, content, sortOrder }) => ({
      sectionType,
      title,
      content,
      sortOrder,
    })),
    followUps: detail.followUps.map(({ questionText, answerHint, sortOrder }) => ({
      questionText,
      answerHint,
      sortOrder,
    })),
    misconceptions: detail.misconceptions.map(({ wrongStatement, whyWrong, correctStatement, sortOrder }) => ({
      wrongStatement,
      whyWrong,
      correctStatement,
      sortOrder,
    })),
    corrections: detail.corrections.map(({ title, problem, correction, evidence, sourceType }) => ({
      title,
      problem,
      correction,
      evidence,
      sourceType,
    })),
    projectMappings: detail.projectMappings.map(({ scenario, projectTalkingPoint, riskPoint, interviewAnswer, sortOrder }) => ({
      scenario,
      projectTalkingPoint,
      riskPoint,
      interviewAnswer,
      sortOrder,
    })),
    references: detail.references.map(({ sourceName, sourceUrl, sourceType, usageNote, sortOrder }) => ({
      sourceName,
      sourceUrl,
      sourceType,
      usageNote,
      sortOrder,
    })),
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
    message.value = '题目基础信息已保存。';
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
