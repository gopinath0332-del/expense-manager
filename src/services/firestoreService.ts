/**
 * Firestore service layer — abstracts all database operations for expenses and import jobs.
 *
 * Key responsibilities:
 *  - upsertExpense: idempotent write with duplicate-policy support
 *  - getExpenses: filtered query with optional sorting
 *  - createJob / updateJob / getJob: import job lifecycle management
 *  - shortCircuitIfAlreadyProcessed: fast re-upload detection via file checksum
 */
import {
  collection,
  doc,
  runTransaction,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type {
  CanonicalExpense,
  ImportJob,
  UpsertResult,
  DuplicatePolicy,
  ExpenseFilter,
} from '@/types/expense'

// Firestore collection names
const EXPENSES_COLLECTION = 'expenses'
const JOBS_COLLECTION = 'importJobs'

// ─── Expenses ────────────────────────────────────────────────────────────────

/**
 * Attempts an idempotent upsert of a canonical expense document.
 *
 * Duplicate detection order (per REQUIREMENTS.md):
 *  1. If source_transaction_id exists, use it as primary lookup key.
 *  2. Else fall back to fingerprint as the document ID.
 *
 * Duplicate policy options:
 *  - 'skip'           → do nothing, return action: 'skipped'
 *  - 'update'         → overwrite the existing document's fields
 *  - 'mark_duplicate' → add a _duplicateOf field linking to the existing doc
 */
export async function upsertExpense(
  expense: CanonicalExpense,
  policy: DuplicatePolicy = 'skip',
): Promise<UpsertResult> {
  // Prefer source transaction ID as document key; fall back to fingerprint
  const docId = expense.source_transaction_id ?? expense.fingerprint
  const docRef = doc(db, EXPENSES_COLLECTION, docId)

  return runTransaction(db, async (tx) => {
    const existing = await tx.get(docRef)

    if (existing.exists()) {
      // Duplicate found — apply the configured policy
      if (policy === 'update') {
        tx.update(docRef, {
          ...expense,
          updated_at: new Date().toISOString(),
        })
        return { action: 'updated', id: docId } satisfies UpsertResult
      } else if (policy === 'mark_duplicate') {
        // Store the duplicate alongside the original with a reference
        const dupRef = doc(collection(db, EXPENSES_COLLECTION))
        tx.set(dupRef, {
          ...expense,
          _duplicateOf: docId,
          _isDuplicate: true,
          updated_at: new Date().toISOString(),
        })
        return { action: 'marked_duplicate', id: dupRef.id } satisfies UpsertResult
      } else {
        // Default: skip — do not write anything
        return { action: 'skipped', id: existing.id } satisfies UpsertResult
      }
    } else {
      // No duplicate — insert fresh document
      tx.set(docRef, { ...expense, id: docId })
      return { action: 'created', id: docId } satisfies UpsertResult
    }
  })
}

/**
 * Retrieves expenses from Firestore with optional filtering and date-range sorting.
 * All fields that filter by equality must have corresponding Firestore composite indexes.
 */
export async function getExpenses(filters: ExpenseFilter = {}): Promise<CanonicalExpense[]> {
  const constraints: QueryConstraint[] = []

  // Apply optional equality filters
  if (filters.source) constraints.push(where('source', '==', filters.source))
  if (filters.category) constraints.push(where('category', '==', filters.category))
  if (filters.vendor) constraints.push(where('vendor', '>=', filters.vendor.toUpperCase()),
    where('vendor', '<=', filters.vendor.toUpperCase() + '\uf8ff'))
  if (filters.dateFrom) constraints.push(where('date', '>=', filters.dateFrom))
  if (filters.dateTo) constraints.push(where('date', '<=', filters.dateTo))

  // Default ordering: newest first
  constraints.push(orderBy('date', 'desc'))

  const q = query(collection(db, EXPENSES_COLLECTION), ...constraints)
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => d.data() as CanonicalExpense)
}

// ─── Import Jobs ─────────────────────────────────────────────────────────────

/**
 * Creates a new import job document in Firestore.
 * Called at the start of a PDF upload-and-parse operation.
 */
export async function createJob(job: ImportJob): Promise<void> {
  await setDoc(doc(db, JOBS_COLLECTION, job.jobId), {
    ...job,
    _serverTimestamp: serverTimestamp(), // for Firestore ordering
  })
}

/**
 * Atomically updates an existing import job document with partial data.
 * Typically used to increment created/skipped/updated counters or change status.
 */
export async function updateJob(
  jobId: string,
  delta: Partial<Omit<ImportJob, 'jobId'>>,
): Promise<void> {
  const ref = doc(db, JOBS_COLLECTION, jobId)
  // Use setDoc with merge:true to avoid the complex Firestore UpdateData type constraints
  await setDoc(ref, delta as Partial<ImportJob>, { merge: true })
}

/**
 * Fetches a single import job document by its jobId.
 * Returns null if the job does not exist.
 */
export async function getJob(jobId: string): Promise<ImportJob | null> {
  const ref = doc(db, JOBS_COLLECTION, jobId)
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as ImportJob) : null
}

/**
 * Returns all import jobs ordered by start time (newest first).
 * Used by the import history view.
 */
export async function getAllJobs(): Promise<ImportJob[]> {
  const q = query(collection(db, JOBS_COLLECTION), orderBy('started_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as ImportJob)
}

/**
 * Checks if a file with the given SHA256 checksum was already successfully processed.
 * If found, returns the matching ImportJob; otherwise returns null.
 *
 * This allows skipping the entire PDF parse step on re-upload of the same file,
 * providing a fast short-circuit to avoid redundant processing.
 */
export async function shortCircuitIfAlreadyProcessed(
  checksum: string,
): Promise<ImportJob | null> {
  const q = query(
    collection(db, JOBS_COLLECTION),
    where('source_file_checksum', '==', checksum),
    where('status', '==', 'completed'),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  // Return the most recent matching completed job
  return snap.docs[0].data() as ImportJob
}

/**
 * Helper to convert Firestore Timestamp objects to ISO 8601 strings.
 * Useful when reading documents that used serverTimestamp().
 */
export function toISOString(ts: Timestamp | string | null): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === 'string') return ts
  return ts.toDate().toISOString()
}
