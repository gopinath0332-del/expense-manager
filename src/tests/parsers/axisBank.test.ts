/**
 * Unit tests for the Axis Bank PDF parser.
 *
 * Uses representative text fixture strings simulating the
 * text extracted from an Axis Bank account statement PDF.
 */
import { describe, it, expect } from 'vitest'
import { AxisBankParser } from '@/parsers/axisBankParser'

// Simulate an Axis Bank statement text block with a table row
const AXIS_SAMPLE_TEXT = `
Account Statement - Axis Bank

Tran Date  Chq./Ref.No.  Transaction Remarks          Withdrawal  Deposit  Balance
01-01-2026 12345          NEFT ACME VENDORS PVT LTD    1000.00              49000.00
15-01-2026 67890          UPI/SALARY COMPANY           25000.00             74000.00
20-01-2026 11223          IMPS AMAZON SHOPPING         2499.00              71501.00
`

describe('AxisBankParser', () => {
  const parser = new AxisBankParser()

  it('extracts transactions from Axis statement text', () => {
    const results = parser.parse(AXIS_SAMPLE_TEXT)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts a valid date for each transaction', () => {
    const results = parser.parse(AXIS_SAMPLE_TEXT)
    for (const r of results) {
      // Date should contain numbers and separator
      expect(r.date).toMatch(/\d/)
    }
  })

  it('extracts a numeric-looking amount', () => {
    const results = parser.parse(AXIS_SAMPLE_TEXT)
    for (const r of results) {
      // Amount should be a string parseable as a number > 0
      const parsed = parseFloat(r.amount.replace(',', ''))
      expect(parsed).toBeGreaterThan(0)
    }
  })

  it('skips header rows (no "Tran Date" transactions)', () => {
    const results = parser.parse(AXIS_SAMPLE_TEXT)
    // "Tran Date" should not appear as a vendor
    const hasHeaderRow = results.some((r) => r.vendor.toLowerCase().includes('tran date'))
    expect(hasHeaderRow).toBe(false)
  })

  it('returns empty array for empty input', () => {
    expect(parser.parse('')).toEqual([])
  })
})
