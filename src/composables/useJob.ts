/**
 * useJob composable
 *
 * Provides reactive access to a single ImportJob document.
 * Polls Firestore every 2 seconds while the job is processing,
 * and stops polling once it reaches 'completed' or 'failed'.
 *
 * Usage:
 *   const { job, isPolling, startPolling, stopPolling } = useJob()
 *   startPolling(jobId)
 */
import { ref, onUnmounted } from 'vue'
import { getJob } from '@/services/firestoreService'
import type { ImportJob } from '@/types/expense'

export function useJob() {
  const job = ref<ImportJob | null>(null)
  const isPolling = ref(false)
  const error = ref<string | null>(null)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Fetch the job once and update local state.
   */
  async function fetchJob(jobId: string) {
    try {
      const result = await getJob(jobId)
      if (result) job.value = result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch job'
    }
  }

  /**
   * Start polling Firestore for job updates every 2 seconds.
   * Automatically stops when the job reaches a terminal status.
   */
  function startPolling(jobId: string) {
    // Fetch immediately
    void fetchJob(jobId)
    isPolling.value = true

    pollInterval = setInterval(async () => {
      await fetchJob(jobId)
      // Stop polling when job reaches terminal state
      if (job.value?.status === 'completed' || job.value?.status === 'failed') {
        stopPolling()
      }
    }, 2000)
  }

  /**
   * Stop the polling interval.
   */
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    isPolling.value = false
  }

  // Clean up on component unmount to avoid memory leaks
  onUnmounted(stopPolling)

  return { job, isPolling, error, startPolling, stopPolling, fetchJob }
}
