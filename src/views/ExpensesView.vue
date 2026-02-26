<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <div>
        <div class="em-page-heading">📋 Expenses</div>
        <p class="em-page-subtitle">{{ sortedExpenses.length.toLocaleString() }} transactions found</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button
          id="clear-filters-btn"
          class="btn btn-outline-secondary"
          @click="store.clearFilters(); void refresh()"
        >
          🔄 Reset
        </button>
        <button id="export-csv-btn" class="btn btn-outline-secondary" @click="exportCSV">
          ⬇️ Export CSV
        </button>
        <RouterLink to="/upload" class="btn btn-primary">+ Upload Report</RouterLink>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="card mb-4">
      <div class="card-body p-3">
        <div class="row g-2 align-items-end">
          <div class="col-sm-6 col-md-3">
            <label class="form-label" for="filter-source">Source</label>
            <select
              id="filter-source"
              class="form-select form-select-sm"
              v-model="localFilters.source"
              @change="applyFilters"
            >
              <option value="">All Sources</option>
              <option value="phonepe">PhonePe</option>
              <option value="axis">Axis Bank</option>
              <option value="hdfc">HDFC Bank</option>
              <option value="payzap">PayZapp</option>
            </select>
          </div>

          <div class="col-sm-6 col-md-3">
            <label class="form-label" for="filter-category">Category</label>
            <select
              id="filter-category"
              class="form-select form-select-sm"
              v-model="localFilters.category"
              @change="applyFilters"
            >
              <option value="">All Categories</option>
              <option v-for="cat in store.availableCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="col-sm-6 col-md-2">
            <label class="form-label" for="filter-date-from">From Date</label>
            <input
              id="filter-date-from"
              type="date"
              class="form-control form-control-sm"
              v-model="localFilters.dateFrom"
              @change="applyFilters"
            />
          </div>

          <div class="col-sm-6 col-md-2">
            <label class="form-label" for="filter-date-to">To Date</label>
            <input
              id="filter-date-to"
              type="date"
              class="form-control form-control-sm"
              v-model="localFilters.dateTo"
              @change="applyFilters"
            />
          </div>

          <div class="col-md-2">
            <label class="form-label" for="filter-vendor">Vendor</label>
            <input
              id="filter-vendor"
              type="text"
              class="form-control form-control-sm"
              placeholder="Search vendor..."
              v-model="localFilters.vendor"
              @input="applyFilters"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Summary totals bar -->
    <div v-if="sortedExpenses.length > 0" class="d-flex gap-4 flex-wrap mb-3" style="font-size:0.875rem; color: var(--em-text-secondary);">
      <span>Total: <strong style="color: var(--em-accent-green);">₹{{ formatAmount(summary.totalAmount) }}</strong></span>
      <span>Count: <strong>{{ summary.totalCount }}</strong></span>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border" role="status" style="color: var(--em-accent-blue);">
        <span class="visually-hidden">Loading expenses...</span>
      </div>
    </div>

    <!-- Expenses table -->
    <div v-else class="card">
      <div class="card-body p-0" style="overflow-x: auto;">
        <div v-if="sortedExpenses.length === 0" class="text-center py-5" style="color: var(--em-text-muted);">
          No expenses match your filters. <RouterLink to="/upload">Upload a report</RouterLink> to add transactions.
        </div>

        <table v-else id="expenses-table" class="table table-dark mb-0">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                :id="`col-${col.key}`"
                style="cursor:pointer; white-space:nowrap; user-select:none;"
                @click="toggleSort(col.key as keyof CanonicalExpense)"
              >
                {{ col.label }}
                <span v-if="sortField === col.key" style="font-size:0.75rem; margin-left:2px;">
                  {{ sortAscending ? '▲' : '▼' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="expense in sortedExpenses" :key="expense.id">
              <td>{{ expense.date }}</td>
              <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" :title="expense.vendor">
                {{ expense.vendor }}
              </td>
              <td style="font-weight:600; color: var(--em-accent-green);">₹{{ formatAmount(expense.amount) }}</td>
              <td>
                <span class="badge" :class="`source-${expense.source}`">{{ expense.source }}</span>
              </td>
              <td>{{ expense.category ?? '—' }}</td>
              <td>
                <span class="badge" :class="`status-${expense.status}`">{{ expense.status }}</span>
              </td>
              <td style="font-size:0.75rem; color: var(--em-text-muted); font-family: monospace;">
                {{ expense.source_transaction_id ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useExpenses } from '@/composables/useExpenses'
import { useExpenseStore } from '@/stores/expenseStore'
import type { CanonicalExpense } from '@/types/expense'

const store = useExpenseStore()
const {
  sortedExpenses,
  filters,
  sortField,
  sortAscending,
  summary,
  isLoading,
  refresh,
  exportCSV,
} = useExpenses()

// Local copy of filters for form binding before applying to composable
const localFilters = reactive({
  source: '',
  category: '',
  dateFrom: '',
  dateTo: '',
  vendor: '',
})

// Table column definitions
const columns = [
  { key: 'date', label: 'Date' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'amount', label: 'Amount' },
  { key: 'source', label: 'Source' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'source_transaction_id', label: 'Transaction ID' },
]

/** Toggle sort: same column reverses direction; new column defaults to desc */
function toggleSort(field: keyof CanonicalExpense) {
  if (sortField.value === field) {
    sortAscending.value = !sortAscending.value
  } else {
    sortField.value = field
    sortAscending.value = false
  }
}

/** Apply the filter form values to the composable and re-fetch */
function applyFilters() {
  filters.value = {
    source: (localFilters.source || undefined) as CanonicalExpense['source'] | undefined,
    category: localFilters.category || undefined,
    dateFrom: localFilters.dateFrom || undefined,
    dateTo: localFilters.dateTo || undefined,
    vendor: localFilters.vendor || undefined,
  }
  void refresh()
}

/** Format amount in Indian locale */
function formatAmount(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(() => {
  void refresh()
  void store.fetchExpenses()
})
</script>
