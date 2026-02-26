<template>
  <div>
    <div class="em-page-heading">📤 Upload Report</div>
    <p class="em-page-subtitle">Upload a PDF bank or UPI statement to extract and store transactions</p>

    <div class="row g-4">
      <!-- Upload form -->
      <div class="col-lg-7">
        <div class="card">
          <div class="card-header">Import a PDF Statement</div>
          <div class="card-body p-4">
            <form @submit.prevent="handleUpload" novalidate>

              <!-- Source selector -->
              <div class="mb-4">
                <label class="form-label" for="source-select">Report Source</label>
                <select
                  id="source-select"
                  v-model="form.source"
                  class="form-select"
                  required
                  :disabled="isLoading"
                >
                  <option value="" disabled>Select your bank / UPI app...</option>
                  <option value="phonepe">📱 PhonePe</option>
                  <option value="axis">🏦 Axis Bank</option>
                  <option value="hdfc">🏦 HDFC Bank</option>
                  <option value="payzap">💳 PayZapp</option>
                </select>
              </div>

              <!-- File drop zone -->
              <div class="mb-4">
                <label class="form-label">PDF File</label>
                <div
                  class="drop-zone"
                  :class="{ dragover: isDragging }"
                  @dragover.prevent="isDragging = true"
                  @dragleave="isDragging = false"
                  @drop.prevent="onDrop"
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    :disabled="isLoading"
                    @change="onFileChange"
                  />
                  <div v-if="!form.file">
                    <div style="font-size:2.5rem; margin-bottom:0.5rem;">📄</div>
                    <p style="color: var(--em-text-secondary); margin:0; font-size:0.9rem;">
                      Drag &amp; drop a PDF here, or click to browse
                    </p>
                    <p style="color: var(--em-text-muted); margin-top:0.25rem; font-size:0.8rem;">
                      Supports: PhonePe, Axis, HDFC, PayZapp statements
                    </p>
                  </div>
                  <div v-else>
                    <div style="font-size:2rem; margin-bottom:0.5rem;">✅</div>
                    <p style="color: var(--em-accent-green); font-weight:600; margin:0;">{{ form.file.name }}</p>
                    <p style="color: var(--em-text-muted); font-size:0.8rem; margin-top:0.25rem;">
                      {{ formatBytes(form.file.size) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Password (optional) -->
              <div class="mb-4">
                <label class="form-label" for="pdf-password">
                  PDF Password
                  <span style="color: var(--em-text-muted); text-transform:none; font-weight:400;">— optional</span>
                </label>
                <input
                  id="pdf-password"
                  v-model="form.password"
                  type="password"
                  class="form-control"
                  placeholder="Leave empty if PDF is not password-protected"
                  :disabled="isLoading"
                  autocomplete="off"
                />
              </div>

              <!-- Duplicate policy -->
              <div class="mb-4">
                <label class="form-label" for="dup-policy">Duplicate Handling Policy</label>
                <select id="dup-policy" v-model="form.duplicatePolicy" class="form-select" :disabled="isLoading">
                  <option value="skip">Skip — ignore duplicates (recommended)</option>
                  <option value="update">Update — overwrite existing records</option>
                  <option value="mark_duplicate">Mark — flag as duplicate and keep both</option>
                </select>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                id="upload-submit-btn"
                class="btn btn-primary w-100 py-2"
                :disabled="isLoading || !form.file || !form.source"
              >
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status" />
                {{ isLoading ? 'Processing...' : '🚀 Upload & Extract' }}
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Progress / result panel -->
      <div class="col-lg-5">
        <!-- Progress card (shown while loading) -->
        <div v-if="isLoading || job" class="card mb-4">
          <div class="card-header">Import Progress</div>
          <div class="card-body p-4">
            <!-- Progress bar -->
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span style="font-size:0.8125rem; color: var(--em-text-secondary);">Progress</span>
              <span style="font-size:0.8125rem; font-weight:600;">{{ progress }}%</span>
            </div>
            <div class="progress mb-4">
              <div class="progress-bar" :style="{ width: `${progress}%` }" />
            </div>

            <!-- Job results (shown after completion) -->
            <template v-if="job">
              <div class="row g-3 mb-3">
                <div class="col-4 text-center">
                  <div style="font-size:1.5rem; font-weight:700; color: var(--em-accent-green);">{{ job.created }}</div>
                  <div style="font-size:0.75rem; color: var(--em-text-muted); text-transform:uppercase;">Created</div>
                </div>
                <div class="col-4 text-center">
                  <div style="font-size:1.5rem; font-weight:700; color: var(--em-accent-orange);">{{ job.skipped }}</div>
                  <div style="font-size:0.75rem; color: var(--em-text-muted); text-transform:uppercase;">Skipped</div>
                </div>
                <div class="col-4 text-center">
                  <div style="font-size:1.5rem; font-weight:700; color: var(--em-accent-blue);">{{ job.updated }}</div>
                  <div style="font-size:0.75rem; color: var(--em-text-muted); text-transform:uppercase;">Updated</div>
                </div>
              </div>

              <div
                class="alert mb-0"
                :class="job.status === 'completed' ? 'alert-success' : 'alert-danger'"
                style="font-size:0.875rem;"
              >
                <strong>{{ job.status === 'completed' ? '✅ Import complete' : '❌ Import failed' }}</strong>
                <div v-if="job.errors.length" class="mt-2">
                  <details>
                    <summary style="cursor:pointer;">{{ job.errors.length }} warning(s)</summary>
                    <ul class="mt-2 mb-0">
                      <li v-for="(err, i) in job.errors" :key="i" style="font-size:0.8rem;">{{ err }}</li>
                    </ul>
                  </details>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Tips card -->
        <div class="card">
          <div class="card-header">💡 Tips</div>
          <div class="card-body p-4">
            <ul style="color: var(--em-text-secondary); font-size:0.875rem; padding-left:1.25rem; margin:0; line-height:2;">
              <li>Download statements from your bank's official app or website</li>
              <li>For PhonePe, go to <strong>Profile → Statement</strong> and export as PDF</li>
              <li>Use the <em>Skip</em> policy to safely re-upload the same file without creating duplicates</li>
              <li>Password is your mobile number or date-of-birth for most bank PDFs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUpload } from '@/composables/useUpload'
import type { ExpenseSource, DuplicatePolicy } from '@/types/expense'

const { isLoading, progress, job, upload } = useUpload()

// Form state
const form = reactive({
  file: null as File | null,
  source: '' as ExpenseSource | '',
  password: '',
  duplicatePolicy: 'skip' as DuplicatePolicy,
})

const isDragging = ref(false)

/** Handle file input change event */
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) form.file = input.files[0]
}

/** Handle drag-and-drop file drop */
function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && file.type === 'application/pdf') form.file = file
}

/** Human-readable file size */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Submit the upload form */
async function handleUpload() {
  if (!form.file || !form.source) return
  try {
    await upload(
      form.file,
      form.source as ExpenseSource,
      form.password || undefined,
      form.duplicatePolicy,
    )
  } catch {
    // Error is already set in the composable — handled by the result panel
  }
}
</script>
