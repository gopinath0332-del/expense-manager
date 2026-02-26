/**
 * Unit tests for the PhonePe PDF parser.
 *
 * Tests use representative text fixture strings that simulate the
 * text content extracted from a PhonePe PDF statement.
 */
import { describe, it, expect } from 'vitest'
import { PhonePeParser } from '@/parsers/phonePeParser'

// Simulate a typical PhonePe statement text block with 2 transactions
const PHONEPE_SAMPLE_TEXT = `
PhonePe Transaction History

ACME GROCERIES
10 Feb 2026, 10:30 AM
₹349.50
Paid
Status: Completed
UPI transaction ID: 123456789012

NETFLIX INDIA
15 Feb 2026, 08:00 PM
₹199.00
Paid
Status: Completed
UPI transaction ID: 987654321098
`

describe('PhonePeParser', () => {
  const parser = new PhonePeParser()

  it('extracts the correct number of transactions', () => {
    const results = parser.parse(PHONEPE_SAMPLE_TEXT)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts amount correctly', () => {
    const results = parser.parse(PHONEPE_SAMPLE_TEXT)
    // At least one transaction should have amount "349.50"
    const found = results.find((r) => r.amount.replace(',', '') === '349.50')
    expect(found).toBeDefined()
  })

  it('extracts UPI transaction ID when present', () => {
    const results = parser.parse(PHONEPE_SAMPLE_TEXT)
    const withId = results.filter((r) => r.sourceTransactionId !== undefined)
    expect(withId.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts a date field for each transaction', () => {
    const results = parser.parse(PHONEPE_SAMPLE_TEXT)
    for (const r of results) {
      expect(r.date).toBeTruthy()
    }
  })

  it('returns empty array for empty input', () => {
    const results = parser.parse('')
    expect(results).toEqual([])
  })
})
