<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>专题管理</h1>
        <p>V1 聚焦并发、JVM、MySQL、Redis。</p>
      </div>
    </div>
    <table class="table card">
      <thead>
        <tr>
          <th>标题</th>
          <th>Slug</th>
          <th>状态</th>
          <th>排序</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="topic in topics" :key="topic.id">
          <td>{{ topic.title }}</td>
          <td>{{ topic.slug }}</td>
          <td>{{ topic.status }}</td>
          <td>{{ topic.sortOrder }}</td>
        </tr>
      </tbody>
    </table>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet } from '../lib/api';

type Topic = {
  id: number;
  title: string;
  slug: string;
  status: string;
  sortOrder: number;
};

const topics = ref<Topic[]>([]);

onMounted(async () => {
  topics.value = await apiGet<Topic[]>('/api/admin/topics');
});
</script>
