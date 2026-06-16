<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>题目管理</h1>
        <p>题目是最小内容单元，支持检索、上下线和基础信息维护。</p>
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

    <section class="split">
      <table class="table card">
        <thead>
          <tr>
            <th>标题</th>
            <th>专题</th>
            <th>难度</th>
            <th>频率</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="question in questions"
            :key="question.id"
            :class="{ selected: selectedQuestion?.id === question.id }"
          >
            <td>
              <strong>{{ question.title }}</strong>
              <p class="muted">{{ question.summary }}</p>
            </td>
            <td>{{ topicName(question.topicId) }}</td>
            <td>{{ question.difficulty }}</td>
            <td>{{ question.frequency }}</td>
            <td>{{ question.status }}</td>
            <td class="actions">
              <button type="button" class="secondary" @click="selectQuestion(question.id)">
                编辑
              </button>
              <button
                type="button"
                class="secondary"
                :disabled="saving"
                @click="toggleStatus(question)"
              >
                {{ question.status === 'PUBLISHED' ? '下线' : '发布' }}
              </button>
            </td>
          </tr>
          <tr v-if="questions.length === 0">
            <td colspan="6">{{ loading ? '加载中...' : '暂无题目。' }}</td>
          </tr>
        </tbody>
      </table>

      <form class="card form-panel" @submit.prevent="saveQuestion">
        <h2>基础信息编辑</h2>
        <p v-if="!selectedQuestion" class="muted">请选择一条题目后编辑。</p>
        <template v-else>
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
          <label>
            摘要
            <textarea v-model.trim="form.summary" rows="3" required />
          </label>
          <label>
            短答案
            <textarea v-model.trim="form.shortAnswer" rows="4" required />
          </label>
          <label>
            长答案
            <textarea v-model.trim="form.longAnswer" rows="5" required />
          </label>
          <label>
            深挖点
            <textarea v-model.trim="form.deepDive" rows="4" required />
          </label>
          <label>
            答题策略
            <textarea v-model.trim="form.answerStrategy" rows="4" required />
          </label>
          <div class="form-actions">
            <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存基础信息' }}</button>
            <button type="button" class="secondary" @click="reloadSelected">重载详情</button>
          </div>
        </template>
      </form>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
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
const loading = ref(false);
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
  error.value = '';
  message.value = '';
  selectedQuestion.value = await apiGet<QuestionDetail>(`/api/admin/questions/${id}`);
  fillForm(selectedQuestion.value);
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
