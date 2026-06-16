<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>题目管理</h1>
        <p>题目是最小内容单元，独立发布和检索。</p>
      </div>
    </div>
    <table class="table card">
      <thead>
        <tr>
          <th>标题</th>
          <th>难度</th>
          <th>频率</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="question in questions" :key="question.id">
          <td>{{ question.title }}</td>
          <td>{{ question.difficulty }}</td>
          <td>{{ question.frequency }}</td>
          <td>{{ question.status }}</td>
        </tr>
      </tbody>
    </table>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet, type PageResponse } from '../lib/api';

type Question = {
  id: number;
  title: string;
  difficulty: string;
  frequency: string;
  status: string;
};

const questions = ref<Question[]>([]);

onMounted(async () => {
  const page = await apiGet<PageResponse<Question>>('/api/admin/questions?size=50');
  questions.value = page.records;
});
</script>
