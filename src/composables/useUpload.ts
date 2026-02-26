/**
 * useUpload composable
 *
 * Implements the full PDF upload-and-parse pipeline:
 *   1. Compute file SHA256 checksum
 *   2. Short-circuit if file was already successfully processed (same checksum + completed job)
 *   3. Extract text from PDF using pdfjs-dist (supports password-protected files)
 *   4. Select the appropriate parser via factory
 *   5. Parse raw transactions
 *   6. Normalize fields and compute fingerprints
 *   7. Upsert each expense into Firestore with deduplication
 *   8. Write and update ImportJob document for audit and progress tracking
 *
 * Returns reactive state: { isLoading, progress, job, error, upload }
 */
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import * as pdfjsLib from 'pdfjs-dist'
import type { ExpenseSource, DuplicatePolicy, ImportJob } from '@/types/expense'
import { computeFileChecksum, normalizeRecord, computeFingerprint } from '@/utils/deduplication'
import { getParser } from '@/parsers/parserFactory'
import {
  upsertExpense,
  createJob,
  updateJob,
  shortCircuitIfAlreadyProcessed,
} from '@/services/firestoreService'

// Set the pdfjs worker script path. This CDN URL avoids needing a local worker file.
// For a self-hosted setup, copy the worker to /public and change this path.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

/**
 * Extracts all text from a PDF file using pdfjs-dist.
 * Supports password-protected PDFs via the optional password parameter.
 * Joins all pages' text content with newlines.
 */
async function extractPdfText(file: File, password?: string): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    password: password || undefined,
  })

  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages
  const pageTexts: string[] = []

  // Extract text from each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()
    // Join text items for the page, preserving newlines between items
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('\n')
    pageTexts.push(pageText)
  }

  return pageTexts.join('\n')
}

export function useUpload() {
  // Reactive state exposed to the calling component
  const isLoading = ref(false)
  const progress = ref(0) // 0–100
  const job = ref<ImportJob | null>(null)
  const error = ref<string | null>(null)

  /**
   * Main upload handler:
   *   - Accepts a File, source, optional password, and duplicate policy
   *   - Runs the full pipeline and updates reactive state
   */
  async function upload(
    file: File,
    source: ExpenseSource,
    password?: string,
    duplicatePolicy: DuplicatePolicy = 'skip',
  ): Promise<ImportJob> {
    isLoading.value = true
    error.value = null
    progress.value = 0

    const jobId = uuidv4()
    const now = new Date().toISOString()

    let currentJob: ImportJob = {
      jobId,
      status: 'queued',
      source,
      fileName: file.name,
      source_file_checksum: '',
      created: 0,
      skipped: 0,
      updated: 0,
      errors: [],
      started_at: now,
      finished_at: null,
    }

    try {
      // Step 1: Compute file checksum for short-circuit and deduplication
      progress.value = 5
      const checksum = await computeFileChecksum(file)
      currentJob.source_file_checksum = checksum

      // Step 2: Short-circuit if this exact file was already fully processed
      const existingJob = await shortCircuitIfAlreadyProcessed(checksum)
      if (existingJob) {
        // Return the previous job result; no new records are created
        const shortCircuitJob: ImportJob = {
          ...existingJob,
          jobId,
          started_at: now,
          finished_at: new Date().toISOString(),
          status: 'completed',
          errors: [`File already processed in job ${existingJob.jobId}. All records skipped.`],
        }
        await createJob(shortCircuitJob)
        job.value = shortCircuitJob
        return shortCircuitJob
      }

      // Step 3: Create a new job document in Firestore  
      currentJob.status = 'processing'
      await createJob(currentJob)
      job.value = { ...currentJob }

      // Step 4: Extract PDF text (may throw PasswordException for wrong password)
      progress.value = 15
      const pdfText = await extractPdfText(file, password)

      // Step 5: Parse raw transactions using the selected bank parser
      progress.value = 30
      const parser = getParser(source)
      const rawTransactions = parser.parse(pdfText)

      if (rawTransactions.length === 0) {
        throw new Error(
          'No transactions found in the PDF. Please verify the source and file format.',
        )
      }

      // Step 6: Normalize and upsert each transaction
      const total = rawTransactions.length
      for (let i = 0; i < total; i++) {
        const raw = rawTransactions[i]

        try {
          // Normalize fields and compute deterministic fingerprint
          const normalized = normalizeRecord(raw)
          const fingerprint = computeFingerprint(
            normalized.date,
            normalized.amount,
            normalized.vendor,
            normalized.transactionType,
          )

          // Build canonical expense document
          const docId = raw.sourceTransactionId ?? fingerprint
          const expense = {
            id: docId,
            fingerprint,
            source,
            source_transaction_id: raw.sourceTransactionId ?? null,
            date: normalized.date,
            amount: normalized.amount,
            currency: 'INR',
            vendor: normalized.vendor,
            category: raw.category ?? null,
            status: (raw.status ?? 'completed') as 'completed' | 'pending' | 'failed' | 'reversed',
            raw_text: raw.rawFields,
            source_file_checksum: checksum,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Upsert with configured duplicate policy
          const result = await upsertExpense(expense, duplicatePolicy)

          // Increment the appropriate counter on the job
          if (result.action === 'created') currentJob.created++
          else if (result.action === 'skipped') currentJob.skipped++
          else if (result.action === 'updated') currentJob.updated++
        } catch (txnErr) {
          // Record individual transaction errors without failing the whole job
          currentJob.errors.push(
            `Row ${i + 1}: ${txnErr instanceof Error ? txnErr.message : String(txnErr)}`,
          )
        }

        // Update progress (30% to 90% across transactions)
        progress.value = 30 + Math.round(((i + 1) / total) * 60)
      }

      // Step 7: Finalize the job document
      currentJob.status = 'completed'
      currentJob.finished_at = new Date().toISOString()
      await updateJob(jobId, {
        status: 'completed',
        created: currentJob.created,
        skipped: currentJob.skipped,
        updated: currentJob.updated,
        errors: currentJob.errors,
        finished_at: currentJob.finished_at,
      })

      progress.value = 100
      job.value = { ...currentJob }
      return currentJob
    } catch (err) {
      // Mark the job as failed and surface the error to the UI
      currentJob.status = 'failed'
      currentJob.finished_at = new Date().toISOString()
      const message = err instanceof Error ? err.message : 'Unknown error during upload'
      currentJob.errors.push(message)
      error.value = message

      // Try to persist the failed job for audit purposes
      try {
        await updateJob(jobId, {
          status: 'failed',
          errors: currentJob.errors,
          finished_at: currentJob.finished_at,
        })
      } catch {
        // Ignore secondary failure — job may not exist if it failed before createJob
      }

      job.value = { ...currentJob }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, progress, job, error, upload }
}
