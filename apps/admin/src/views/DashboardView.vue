<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>控制台</h1>
        <p>查看当前内容生产状态。</p>
      </div>
    </div>
    <section class="grid">
      <article class="card">
        <p>专题数</p>
        <h2>{{ stats?.topicCount ?? '-' }}</h2>
      </article>
      <article class="card">
        <p>题目数</p>
        <h2>{{ stats?.questionCount ?? '-' }}</h2>
      </article>
      <article class="card">
        <p>草稿题</p>
        <h2>{{ stats?.draftQuestionCount ?? '-' }}</h2>
      </article>
      <article class="card">
        <p>心路记录</p>
        <h2>{{ stats?.noteCount ?? '-' }}</h2>
      </article>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet } from '../lib/api';

type DashboardStats = {
  topicCount: number;
  questionCount: number;
  draftQuestionCount: number;
  noteCount: number;
};

const stats = ref<DashboardStats | null>(null);

onMounted(async () => {
  stats.value = await apiGet<DashboardStats>('/api/admin/dashboard');
});
</script>
