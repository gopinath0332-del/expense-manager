/**
 * Deduplication utility module.
 *
 * Provides:
 *  - normalizeRecord()     — Canonicalizes raw transaction fields before fingerprinting
 *  - computeFingerprint()  — SHA256 hash for deduplication key
 *  - computeFileChecksum() — SHA256 of an uploaded File's bytes (for short-circuit logic)
 *
 * Fingerprint algorithm (from REQUIREMENTS.md):
 *   SHA256(date + '|' + amount + '|' + vendor + '|' + (type || ''))
 */
import CryptoJS from 'crypto-js'
import type { RawTransaction } from '@/types/expense'

/**
 * Normalizes a raw date string to ISO 8601 format (YYYY-MM-DD).
 * Handles common formats: "DD MMM YYYY", "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD".
 */
export function normalizeDate(rawDate: string): string {
  const trimmed = rawDate.trim()

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // "DD MMM YYYY" or "DD-MMM-YYYY" (e.g., "10 Feb 2026", "10-Feb-2026")
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const longMatch = trimmed.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,})[\s\-\/](\d{4})$/)
  if (longMatch) {
    const day = longMatch[1].padStart(2, '0')
    const month = monthNames[longMatch[2].toLowerCase().slice(0, 3)]
    const year = longMatch[3]
    if (month) return `${year}-${month}-${day}`
  }

  // "DD/MM/YYYY" or "DD-MM-YYYY"
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3]
    return `${year}-${month}-${day}`
  }

  // Fallback: return as-is and log warning
  console.warn(`[deduplication] Could not normalize date: "${rawDate}"`)
  return trimmed
}

/**
 * Normalizes an amount string to a numeric value rounded to 2 decimal places.
 * Strips currency symbols (₹, $, etc.), commas, and extra whitespace.
 */
export function normalizeAmount(rawAmount: string): number {
  // Remove currency symbols, commas, and whitespace; keep decimal point and digits
  const cleaned = rawAmount.replace(/[₹$€£,\s]/g, '').trim()
  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) {
    console.warn(`[deduplication] Could not parse amount: "${rawAmount}"`)
    return 0
  }
  return Math.round(parsed * 100) / 100
}

/**
 * Normalizes a vendor/merchant name:
 * - Uppercase
 * - Trim leading/trailing whitespace
 * - Remove punctuation (retain alphanumeric and spaces)
 * - Collapse multiple spaces into one
 */
export function normalizeVendor(rawVendor: string): string {
  return rawVendor
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9 ]/g, '')  // strip punctuation
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim()
}

/**
 * Normalizes a raw transaction into canonical fields suitable for fingerprinting and storage.
 * Returns an object with normalized date, amount, vendor, and optional transaction type.
 */
export function normalizeRecord(raw: RawTransaction): {
  date: string
  amount: number
  vendor: string
  transactionType: string
} {
  return {
    date: normalizeDate(raw.date),
    amount: normalizeAmount(raw.amount),
    vendor: normalizeVendor(raw.vendor),
    transactionType: (raw.transactionType ?? '').toUpperCase().trim(),
  }
}

/**
 * Computes a deterministic SHA256 fingerprint for a transaction record.
 * Used as the Firestore document ID to ensure idempotent writes.
 *
 * Formula: SHA256("YYYY-MM-DD|amount.toFixed(2)|VENDOR|TYPE")
 */
export function computeFingerprint(
  date: string,
  amount: number,
  vendor: string,
  transactionType = '',
): string {
  const payload = `${date}|${amount.toFixed(2)}|${vendor}|${transactionType.toUpperCase().trim()}`
  return CryptoJS.SHA256(payload).toString(CryptoJS.enc.Hex)
}

/**
 * Computes a SHA256 checksum of a File's binary content.
 * Used to detect re-uploads of the same PDF and short-circuit parsing.
 * Returns the checksum prefixed with "sha256:" for clarity.
 */
export async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const wordArray = CryptoJS.lib.WordArray.create(buffer as ArrayBuffer)
  const hash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex)
  return `sha256:${hash}`
}
