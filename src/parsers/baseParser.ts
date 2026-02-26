/**
 * Base parser interface (adapter pattern).
 *
 * Every bank-specific parser must implement this interface.
 * The parse() method receives the full text content extracted from a PDF
 * and returns an array of RawTransaction objects.
 *
 * Normalization (date/amount/vendor) happens AFTER parsing,
 * in the deduplication utility layer.
 */
import type { RawTransaction } from '@/types/expense'

export interface BaseParser {
  /**
   * Parse the full PDF text and return extracted transactions.
   * @param pdfText - The raw text content extracted from the PDF (all pages joined).
   * @returns Array of raw transaction records (un-normalized).
   */
  parse(pdfText: string): RawTransaction[]
}
