/**
 * Vue Router configuration
 *
 * Defines all application routes:
 *   /          → DashboardView  (summary cards and stats)
 *   /upload    → UploadView     (PDF upload form)
 *   /expenses  → ExpensesView   (filterable transaction table)
 *   /history   → HistoryView    (import job audit log)
 */
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import UploadView from '@/views/UploadView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import HistoryView from '@/views/HistoryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { title: 'Dashboard' },
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
      meta: { title: 'Upload Report' },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: ExpensesView,
      meta: { title: 'Expenses' },
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
      meta: { title: 'Import History' },
    },
  ],
})

// Update document title on each route change
router.afterEach((to) => {
  const title = to.meta?.title as string | undefined
  document.title = title ? `${title} — Expense Manager` : 'Expense Manager'
})

export default router
