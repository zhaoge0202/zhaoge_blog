<template>
  <main class="login">
    <form class="card login-form stack" @submit.prevent="submit">
      <div>
        <h1>Java 面试进阶后台</h1>
        <p>维护专题、题目、纠偏记录和心路历程。</p>
      </div>
      <label>
        用户名
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        密码
        <input v-model="password" autocomplete="current-password" type="password" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">登录</button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const username = ref('admin');
const password = ref('admin123456');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.login(username.value, password.value);
    router.push('/dashboard');
  } catch {
    error.value = '登录失败，请检查用户名或密码';
  }
}
</script>
