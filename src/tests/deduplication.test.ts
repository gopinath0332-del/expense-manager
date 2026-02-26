/**
 * Unit tests for deduplication utility functions.
 *
 * These tests verify that:
 *  - normalizeDate handles all supported date formats
 *  - normalizeAmount strips symbols and rounds correctly
 *  - normalizeVendor uppercases and strips punctuation
 *  - computeFingerprint is deterministic and sensitive to field changes
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeDate,
  normalizeAmount,
  normalizeVendor,
  computeFingerprint,
} from '@/utils/deduplication'

// ─── normalizeDate ────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('returns ISO 8601 date as-is', () => {
    expect(normalizeDate('2026-02-10')).toBe('2026-02-10')
  })

  it('converts "DD MMM YYYY" format', () => {
    expect(normalizeDate('10 Feb 2026')).toBe('2026-02-10')
    expect(normalizeDate('01 Jan 2026')).toBe('2026-01-01')
    expect(normalizeDate('31 Dec 2025')).toBe('2025-12-31')
  })

  it('converts "DD-MMM-YYYY" format', () => {
    expect(normalizeDate('10-Feb-2026')).toBe('2026-02-10')
  })

  it('converts "DD/MM/YYYY" format', () => {
    expect(normalizeDate('10/02/2026')).toBe('2026-02-10')
  })

  it('converts "DD-MM-YYYY" format', () => {
    expect(normalizeDate('10-02-2026')).toBe('2026-02-10')
  })
})

// ─── normalizeAmount ──────────────────────────────────────────────────────────

describe('normalizeAmount', () => {
  it('parses plain number', () => {
    expect(normalizeAmount('349.50')).toBe(349.5)
  })

  it('strips ₹ symbol', () => {
    expect(normalizeAmount('₹1,234.56')).toBe(1234.56)
  })

  it('strips commas', () => {
    expect(normalizeAmount('1,00,000.00')).toBe(100000)
  })

  it('rounds to 2 decimal places', () => {
    expect(normalizeAmount('100.999')).toBe(101)
  })

  it('returns 0 for invalid input', () => {
    expect(normalizeAmount('N/A')).toBe(0)
  })
})

// ─── normalizeVendor ──────────────────────────────────────────────────────────

describe('normalizeVendor', () => {
  it('uppercases vendor name', () => {
    expect(normalizeVendor('Acme Store')).toBe('ACME STORE')
  })

  it('strips punctuation', () => {
    expect(normalizeVendor('ACME, STORE.')).toBe('ACME STORE')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeVendor('ACME   STORE')).toBe('ACME STORE')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeVendor('  ACME  ')).toBe('ACME')
  })
})

// ─── computeFingerprint ───────────────────────────────────────────────────────

describe('computeFingerprint', () => {
  it('returns a 64-character hex SHA256 string', () => {
    const fp = computeFingerprint('2026-02-10', 349.5, 'ACME STORE')
    expect(fp).toHaveLength(64)
    expect(fp).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic — same inputs produce same fingerprint', () => {
    const a = computeFingerprint('2026-02-10', 349.5, 'ACME STORE', 'DEBIT')
    const b = computeFingerprint('2026-02-10', 349.5, 'ACME STORE', 'DEBIT')
    expect(a).toBe(b)
  })

  it('produces different fingerprints for different amounts', () => {
    const a = computeFingerprint('2026-02-10', 100, 'VENDOR')
    const b = computeFingerprint('2026-02-10', 200, 'VENDOR')
    expect(a).not.toBe(b)
  })

  it('produces different fingerprints for different dates', () => {
    const a = computeFingerprint('2026-01-01', 100, 'VENDOR')
    const b = computeFingerprint('2026-02-01', 100, 'VENDOR')
    expect(a).not.toBe(b)
  })

  it('produces different fingerprints for different vendors', () => {
    const a = computeFingerprint('2026-01-01', 100, 'VENDOR A')
    const b = computeFingerprint('2026-01-01', 100, 'VENDOR B')
    expect(a).not.toBe(b)
  })

  it('treats empty transactionType as equivalent to no transactionType', () => {
    const a = computeFingerprint('2026-01-01', 100, 'VENDOR')
    const b = computeFingerprint('2026-01-01', 100, 'VENDOR', '')
    expect(a).toBe(b)
  })
})
