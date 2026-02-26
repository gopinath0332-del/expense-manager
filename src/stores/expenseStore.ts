/**
 * Pinia store for expenses
 *
 * Centralized state management for:
 *  - expense list and active filters
 *  - dashboard summary statistics
 *  - import history (jobs list)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getExpenses, getAllJobs } from '@/services/firestoreService'
import type { CanonicalExpense, ImportJob, ExpenseFilter } from '@/types/expense'

export const useExpenseStore = defineStore('expenses', () => {
  // ─── State ───────────────────────────────────────────────────────────────
  const expenses = ref<CanonicalExpense[]>([])
  const jobs = ref<ImportJob[]>([])
  const isLoadingExpenses = ref(false)
  const isLoadingJobs = ref(false)
  const filters = ref<ExpenseFilter>({})

  // ─── Getters (computed) ──────────────────────────────────────────────────

  /** Total spend across all loaded expenses */
  const totalAmount = computed(() =>
    expenses.value.reduce((sum, e) => sum + e.amount, 0),
  )

  /** Count of expenses */
  const totalCount = computed(() => expenses.value.length)

  /** Spend grouped by category */
  const byCategory = computed(() => {
    const result: Record<string, number> = {}
    for (const e of expenses.value) {
      const key = e.category ?? 'Uncategorized'
      result[key] = (result[key] ?? 0) + e.amount
    }
    return result
  })

  /** Distinct list of categories available in loaded data */
  const availableCategories = computed(() => Object.keys(byCategory.value).sort())

  /** Distinct list of sources available in loaded data */
  const availableSources = computed(() =>
    [...new Set(expenses.value.map((e) => e.source))],
  )

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Fetch expenses from Firestore with current filter state */
  async function fetchExpenses() {
    isLoadingExpenses.value = true
    try {
      expenses.value = await getExpenses(filters.value)
    } finally {
      isLoadingExpenses.value = false
    }
  }

  /** Fetch all import jobs for the history page */
  async function fetchJobs() {
    isLoadingJobs.value = true
    try {
      jobs.value = await getAllJobs()
    } finally {
      isLoadingJobs.value = false
    }
  }

  /** Update a filter key and re-fetch expenses */
  function setFilter(key: keyof ExpenseFilter, value: string | undefined) {
    filters.value = { ...filters.value, [key]: value }
    void fetchExpenses()
  }

  /** Clear all active filters and reload */
  function clearFilters() {
    filters.value = {}
    void fetchExpenses()
  }

  return {
    expenses,
    jobs,
    isLoadingExpenses,
    isLoadingJobs,
    filters,
    totalAmount,
    totalCount,
    byCategory,
    availableCategories,
    availableSources,
    fetchExpenses,
    fetchJobs,
    setFilter,
    clearFilters,
  }
})
