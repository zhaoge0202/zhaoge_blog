<template>
  <AdminLayout>
    <div class="toolbar">
      <div>
        <h1>心路历程</h1>
        <p>记录学习误判、纠偏和项目复盘。</p>
      </div>
    </div>
    <section class="stack">
      <article v-for="note in notes" :key="note.id" class="card">
        <p>{{ note.happenedOn }} · {{ note.noteType }} · {{ note.status }}</p>
        <h2>{{ note.title }}</h2>
        <p>{{ note.content }}</p>
      </article>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { apiGet } from '../lib/api';

type Note = {
  id: number;
  title: string;
  content: string;
  noteType: string;
  happenedOn: string;
  status: string;
};

const notes = ref<Note[]>([]);

onMounted(async () => {
  notes.value = await apiGet<Note[]>('/api/admin/notes');
});
</script>
