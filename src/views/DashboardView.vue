<template>
  <div>
    <!-- Page Heading -->
    <div class="em-page-heading">📊 Dashboard</div>
    <p class="em-page-subtitle">Overview of your expense activity</p>

    <!-- Loading state -->
    <div v-if="store.isLoadingExpenses" class="text-center py-5">
      <div class="spinner-border" role="status" style="color: var(--em-accent-blue);">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <template v-else>
      <!-- Summary stat cards -->
      <div class="row g-4 mb-4">
        <!-- Total Spend -->
        <div class="col-sm-6 col-xl-3">
          <div class="card stat-card blue">
            <div class="stat-icon">💰</div>
            <div class="stat-value">₹{{ formatAmount(store.totalAmount) }}</div>
            <div class="stat-label">Total Spend</div>
          </div>
        </div>

        <!-- Transaction Count -->
        <div class="col-sm-6 col-xl-3">
          <div class="card stat-card purple">
            <div class="stat-icon">🧾</div>
            <div class="stat-value">{{ store.totalCount.toLocaleString() }}</div>
            <div class="stat-label">Transactions</div>
          </div>
        </div>

        <!-- Imports -->
        <div class="col-sm-6 col-xl-3">
          <div class="card stat-card green">
            <div class="stat-icon">📥</div>
            <div class="stat-value">{{ store.jobs.length }}</div>
            <div class="stat-label">Reports Imported</div>
          </div>
        </div>

        <!-- Sources -->
        <div class="col-sm-6 col-xl-3">
          <div class="card stat-card orange">
            <div class="stat-icon">🏦</div>
            <div class="stat-value">{{ store.availableSources.length }}</div>
            <div class="stat-label">Data Sources</div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <!-- Category breakdown -->
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header">Spend by Category</div>
            <div class="card-body p-4">
              <div v-if="sortedCategories.length === 0" class="text-center py-4" style="color: var(--em-text-muted);">
                No expense data yet. <RouterLink to="/upload">Upload a report</RouterLink> to get started.
              </div>
              <div v-for="([cat, amount], idx) in sortedCategories" :key="cat" class="category-bar" :style="{ animationDelay: `${idx * 0.05}s` }">
                <div class="category-bar-label" :title="cat">{{ cat }}</div>
                <div class="category-bar-track">
                  <div
                    class="category-bar-fill"
                    :style="{ width: `${(amount / maxCategoryAmount) * 100}%` }"
                  />
                </div>
                <div class="category-bar-amount">₹{{ formatAmount(amount) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Source breakdown + recent imports -->
        <div class="col-lg-5">
          <!-- By source -->
          <div class="card mb-4">
            <div class="card-header">Spend by Source</div>
            <div class="card-body p-4">
              <div v-if="Object.keys(store.byCategory).length === 0" style="color: var(--em-text-muted); font-size:0.875rem;">
                No data yet.
              </div>
              <div v-for="(amount, source) in sourceSpend" :key="source" class="d-flex justify-content-between align-items-center mb-2">
                <span>
                  <span class="badge me-2" :class="`source-${source}`">{{ source }}</span>
                </span>
                <span style="font-weight: 600; font-size: 0.9rem;">₹{{ formatAmount(amount) }}</span>
              </div>
            </div>
          </div>

          <!-- Recent imports -->
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              Recent Imports
              <RouterLink to="/history" class="btn btn-sm btn-outline-secondary py-1 px-2" style="font-size:0.75rem;">View All</RouterLink>
            </div>
            <div class="card-body p-0">
              <div v-if="store.jobs.length === 0" class="p-4 text-center" style="color: var(--em-text-muted); font-size:0.875rem;">
                No imports yet.
              </div>
              <ul class="list-group list-group-flush" style="--bs-list-group-bg: transparent; --bs-list-group-border-color: var(--em-border-color);">
                <li
                  v-for="job in recentJobs"
                  :key="job.jobId"
                  class="list-group-item"
                  style="color: var(--em-text-primary);"
                >
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <div style="font-weight:500; font-size:0.875rem;">{{ job.fileName }}</div>
                      <div style="font-size:0.75rem; color: var(--em-text-muted);">{{ formatDate(job.started_at) }}</div>
                    </div>
                    <span class="badge" :class="jobStatusClass(job.status)">{{ job.status }}</span>
                  </div>
                  <div class="mt-1" style="font-size:0.75rem; color: var(--em-text-muted);">
                    ✅ {{ job.created }} created &nbsp;·&nbsp; ⏭ {{ job.skipped }} skipped &nbsp;·&nbsp; ✏️ {{ job.updated }} updated
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useExpenseStore } from '@/stores/expenseStore'
import type { ImportJob } from '@/types/expense'

const store = useExpenseStore()

// Fetch data on mount
onMounted(async () => {
  await Promise.all([store.fetchExpenses(), store.fetchJobs()])
})

/** Sort categories by spend (descending) for the bar chart */
const sortedCategories = computed(() =>
  Object.entries(store.byCategory).sort(([, a], [, b]) => b - a),
)

/** Maximum category amount — used to normalise bar widths */
const maxCategoryAmount = computed(() =>
  sortedCategories.value[0]?.[1] ?? 1,
)

/** Source spend map (from byCategory via store) */
const sourceSpend = computed(() => {
  const result: Record<string, number> = {}
  for (const exp of store.expenses) {
    result[exp.source] = (result[exp.source] ?? 0) + exp.amount
  }
  return result
})

/** Last 5 import jobs */
const recentJobs = computed(() => store.jobs.slice(0, 5))

/** Format an amount with Indian-style locale formatting */
function formatAmount(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format an ISO date string to a human-readable date */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** CSS class for job status badge */
function jobStatusClass(status: ImportJob['status']): string {
  const map: Record<ImportJob['status'], string> = {
    completed: 'status-completed',
    failed: 'status-failed',
    processing: 'source-payzap',
    queued: 'source-axis',
  }
  return map[status] ?? ''
}
</script>
