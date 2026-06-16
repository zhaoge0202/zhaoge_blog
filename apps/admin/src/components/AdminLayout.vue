<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>内容后台</h2>
      <p>{{ auth.displayName || '管理员' }}</p>
      <router-link to="/dashboard">控制台</router-link>
      <router-link to="/topics">专题管理</router-link>
      <router-link to="/questions">题目管理</router-link>
      <router-link to="/notes">心路历程</router-link>
      <button style="margin-top: 24px" @click="logout">退出</button>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  router.push('/login');
}
</script>
