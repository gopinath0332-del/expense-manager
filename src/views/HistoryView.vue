<template>
  <div>
    <div class="em-page-heading">📜 Import History</div>
    <p class="em-page-subtitle">Audit log of all PDF import jobs and their deduplication outcomes</p>

    <!-- Loading state -->
    <div v-if="store.isLoadingJobs" class="text-center py-5">
      <div class="spinner-border" role="status" style="color: var(--em-accent-blue);">
        <span class="visually-hidden">Loading history...</span>
      </div>
    </div>

    <div v-else class="card">
      <div class="card-body p-0" style="overflow-x:auto;">
        <!-- Empty state -->
        <div v-if="store.jobs.length === 0" class="text-center py-5" style="color: var(--em-text-muted);">
          No imports yet. <RouterLink to="/upload">Upload your first report.</RouterLink>
        </div>

        <!-- Jobs table -->
        <table v-else id="history-table" class="table table-dark mb-0">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>File</th>
              <th>Source</th>
              <th>Status</th>
              <th class="text-center">Created</th>
              <th class="text-center">Skipped</th>
              <th class="text-center">Updated</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in store.jobs" :key="job.jobId">
              <!-- Date -->
              <td style="white-space:nowrap; font-size:0.85rem;">
                <div>{{ formatDate(job.started_at) }}</div>
                <div style="color: var(--em-text-muted); font-size:0.75rem;">{{ formatTime(job.started_at) }}</div>
              </td>

              <!-- File name -->
              <td style="max-width:200px;">
                <div
                  style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.875rem;"
                  :title="job.fileName"
                >
                  {{ job.fileName }}
                </div>
                <!-- File checksum for audit -->
                <div
                  style="font-size:0.7rem; color: var(--em-text-muted); font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                  :title="job.source_file_checksum"
                >
                  {{ job.source_file_checksum.slice(0, 20) }}…
                </div>
              </td>

              <!-- Source badge -->
              <td>
                <span class="badge" :class="`source-${job.source}`">{{ job.source }}</span>
              </td>

              <!-- Status badge -->
              <td>
                <span class="badge" :class="statusClass(job.status)">{{ job.status }}</span>
              </td>

              <!-- Counts -->
              <td class="text-center" style="color: var(--em-accent-green); font-weight:600;">{{ job.created }}</td>
              <td class="text-center" style="color: var(--em-accent-orange); font-weight:600;">{{ job.skipped }}</td>
              <td class="text-center" style="color: var(--em-accent-blue); font-weight:600;">{{ job.updated }}</td>

              <!-- Warnings / errors -->
              <td>
                <span v-if="job.errors.length === 0" style="color: var(--em-text-muted); font-size:0.8rem;">—</span>
                <details v-else>
                  <summary style="cursor:pointer; font-size:0.8rem; color: var(--em-accent-orange);">
                    ⚠️ {{ job.errors.length }} warning(s)
                  </summary>
                  <ul class="mt-1 mb-0" style="font-size:0.75rem; padding-left:1rem; max-width:300px;">
                    <li v-for="(err, i) in job.errors" :key="i">{{ err }}</li>
                  </ul>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useExpenseStore } from '@/stores/expenseStore'
import type { ImportJob } from '@/types/expense'

const store = useExpenseStore()

onMounted(() => void store.fetchJobs())

/** Format ISO date to readable local date */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format ISO date to readable time */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** CSS class for status badge */
function statusClass(status: ImportJob['status']): string {
  const map: Record<ImportJob['status'], string> = {
    completed: 'status-completed',
    failed: 'status-failed',
    processing: 'source-payzap',
    queued: 'source-axis',
  }
  return map[status] ?? ''
}
</script>
