import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import TopicListView from '../views/TopicListView.vue';
import QuestionListView from '../views/QuestionListView.vue';
import NoteListView from '../views/NoteListView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: LoginView },
    { path: '/dashboard', component: DashboardView },
    { path: '/topics', component: TopicListView },
    { path: '/questions', component: QuestionListView },
    { path: '/notes', component: NoteListView },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.path !== '/login' && !auth.token) {
    return '/login';
  }
  if (to.path === '/login' && auth.token) {
    return '/dashboard';
  }
  return true;
});
