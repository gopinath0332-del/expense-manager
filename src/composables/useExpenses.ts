/**
 * useExpenses composable
 *
 * Provides reactive, filterable expense data fetched from Firestore.
 * Includes derived summary statistics (totals, by-category breakdown).
 *
 * Usage:
 *   const { expenses, filters, summary, isLoading, refresh } = useExpenses()
 */
import { ref, computed, type Ref } from 'vue'
import { getExpenses } from '@/services/firestoreService'
import type { CanonicalExpense, ExpenseFilter } from '@/types/expense'

export interface ExpenseSummary {
  totalAmount: number
  totalCount: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
}

export function useExpenses() {
  const expenses: Ref<CanonicalExpense[]> = ref([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Filter state — reactive, bound to filter controls in the view
  const filters: Ref<ExpenseFilter> = ref({
    source: undefined,
    category: undefined,
    vendor: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  })

  // Sort state
  const sortField = ref<keyof CanonicalExpense>('date')
  const sortAscending = ref(false)

  /**
   * Fetch expenses from Firestore using the current filter state.
   * Called on mount and whenever filters change.
   */
  async function refresh() {
    isLoading.value = true
    error.value = null
    try {
      const results = await getExpenses(filters.value)
      expenses.value = results
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load expenses'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Client-side sorted expenses derived from the fetched data.
   * Client-side sort avoids requiring Firestore compound indexes for every sort combination.
   */
  const sortedExpenses = computed(() => {
    const list = [...expenses.value]
    list.sort((a, b) => {
      const aVal = a[sortField.value] ?? ''
      const bVal = b[sortField.value] ?? ''
      if (aVal < bVal) return sortAscending.value ? -1 : 1
      if (aVal > bVal) return sortAscending.value ? 1 : -1
      return 0
    })
    return list
  })

  /**
   * Summary statistics computed from the currently loaded expenses.
   * Updates automatically when expenses change.
   */
  const summary = computed<ExpenseSummary>(() => {
    const byCategory: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    let total = 0

    for (const exp of expenses.value) {
      total += exp.amount

      // Accumulate by category
      const cat = exp.category ?? 'Uncategorized'
      byCategory[cat] = (byCategory[cat] ?? 0) + exp.amount

      // Accumulate by source
      bySource[exp.source] = (bySource[exp.source] ?? 0) + exp.amount
    }

    return {
      totalAmount: Math.round(total * 100) / 100,
      totalCount: expenses.value.length,
      byCategory,
      bySource,
    }
  })

  /**
   * Exports the current expenses list as a downloadable CSV file.
   */
  function exportCSV() {
    const headers = ['Date', 'Vendor', 'Amount', 'Currency', 'Category', 'Source', 'Status', 'Transaction ID']
    const rows = sortedExpenses.value.map((e) => [
      e.date,
      `"${e.vendor}"`,
      e.amount.toFixed(2),
      e.currency,
      e.category ?? '',
      e.source,
      e.status,
      e.source_transaction_id ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    expenses,
    sortedExpenses,
    filters,
    sortField,
    sortAscending,
    summary,
    isLoading,
    error,
    refresh,
    exportCSV,
  }
}
