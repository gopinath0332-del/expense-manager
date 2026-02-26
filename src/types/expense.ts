/**
 * Canonical data model and TypeScript interfaces for the Expense Manager.
 * All parsers must normalize their output into CanonicalExpense before
 * writing to Firestore.
 */

/** Supported report sources */
export type ExpenseSource = 'phonepe' | 'axis' | 'hdfc' | 'payzap'

/** Transaction completion status */
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed'

/** How to handle duplicate records during import */
export type DuplicatePolicy = 'skip' | 'update' | 'mark_duplicate'

/**
 * Raw fields extracted directly from the PDF before normalization.
 * Kept for debugging and audit purposes.
 */
export interface RawTransactionFields {
  /** Raw parsed date string from the PDF */
  date?: string
  /** Raw amount string (may include currency symbols, commas) */
  amount?: string
  /** Raw vendor/merchant name from PDF */
  vendor?: string
  /** Any other raw text captured during parsing */
  [key: string]: string | undefined
}

/**
 * Intermediate structure returned by each parser before normalization.
 * Not stored in Firestore directly.
 */
export interface RawTransaction {
  /** Source-specific transaction ID/reference, if present */
  sourceTransactionId?: string
  /** Unparsed date string from the report */
  date: string
  /** Unparsed amount string from the report */
  amount: string
  /** Merchant or vendor name as printed in the report */
  vendor: string
  /** Transaction type: debit/credit/refund etc. */
  transactionType?: string
  /** Category hint extracted from report (not all sources provide this) */
  category?: string
  /** Raw status text from report */
  status?: string
  /** All raw fields for audit */
  rawFields: RawTransactionFields
}

/**
 * Canonical expense document stored in Firestore.
 * Follows the schema defined in REQUIREMENTS.md.
 */
export interface CanonicalExpense {
  /** Firestore document ID — equals fingerprint or source_transaction_id when available */
  id: string
  /** SHA256 hash of normalized (date|amount|vendor|type) — used for deduplication */
  fingerprint: string
  /** Report source (phonepe | axis | hdfc | payzap) */
  source: ExpenseSource
  /** Original transaction ID/reference from the source, if present */
  source_transaction_id: string | null
  /** ISO 8601 date (YYYY-MM-DD) */
  date: string
  /** Numeric amount rounded to 2 decimal places */
  amount: number
  /** Currency code, e.g. INR */
  currency: string
  /** Normalized vendor/merchant name (uppercase, stripped of punctuation) */
  vendor: string
  /** Expense category (null if not determinable) */
  category: string | null
  /** Completion status of the transaction */
  status: TransactionStatus
  /** Original raw fields preserved for debugging */
  raw_text: RawTransactionFields
  /** SHA256 checksum of the uploaded PDF file */
  source_file_checksum: string
  /** ISO 8601 timestamp when Firestore document was created */
  created_at: string
  /** ISO 8601 timestamp when Firestore document was last updated */
  updated_at: string
}

/**
 * Import job document stored in Firestore.
 * Tracks the progress and outcome of a single PDF upload-and-parse operation.
 */
export interface ImportJob {
  /** Unique job identifier (UUID) */
  jobId: string
  /** Current job status */
  status: 'queued' | 'processing' | 'completed' | 'failed'
  /** Report source selected by the user */
  source: ExpenseSource
  /** Name of the uploaded file */
  fileName: string
  /** SHA256 checksum of the uploaded PDF */
  source_file_checksum: string
  /** Number of expense records successfully created */
  created: number
  /** Number of records skipped due to duplicate detection */
  skipped: number
  /** Number of records that updated an existing document */
  updated: number
  /** List of errors encountered during parsing (if any) */
  errors: string[]
  /** ISO 8601 timestamp when the job was started */
  started_at: string
  /** ISO 8601 timestamp when the job finished (null if still running) */
  finished_at: string | null
}

/**
 * Result returned after attempting to upsert a single expense record.
 */
export interface UpsertResult {
  action: 'created' | 'skipped' | 'updated' | 'marked_duplicate'
  id: string
}

/**
 * Filter options for querying expenses from Firestore.
 */
export interface ExpenseFilter {
  source?: ExpenseSource
  category?: string
  vendor?: string
  /** ISO 8601 date string — lower bound (inclusive) */
  dateFrom?: string
  /** ISO 8601 date string — upper bound (inclusive) */
  dateTo?: string
}
