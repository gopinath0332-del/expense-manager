/**
 * Axis Bank Statement Parser
 *
 * Extracts transactions from Axis Bank PDF account statements.
 *
 * Axis Bank table structure (typical):
 *   Tran Date | Chq./Ref.No. | Transaction Remarks        | Withdrawal | Deposit | Balance
 *   01-01-2026 | 12345       | NEFT/IMPS VENDOR NAME HERE | 1,000.00   |         | 50,000.00
 *
 * The parser looks for lines matching the Axis date pattern (DD-MM-YYYY)
 * followed by an optional ref number, narration, and debit/credit amounts.
 *
 * Note: Real PDFs may render table rows as multiple lines depending on PDF structure.
 * This parser handles both single-line and split-line row formats.
 */
import type { BaseParser } from './baseParser'
import type { RawTransaction } from '@/types/expense'

export class AxisBankParser implements BaseParser {
  /**
   * Matches Axis Bank date format: DD-MM-YYYY or DD/MM/YYYY
   */
  private static readonly DATE_REGEX = /^(\d{2}[-\/]\d{2}[-\/]\d{4})/

  /**
   * Matches an amount field: digits with optional commas and decimals
   */
  private static readonly AMOUNT_REGEX = /([\d,]+\.\d{2})/g

  /**
   * Table header keywords used to skip header rows
   */
  private static readonly HEADER_KEYWORDS = [
    'tran date', 'withdrawal', 'deposit', 'balance', 'chq', 'ref.no', 'particulars',
  ]

  parse(pdfText: string): RawTransaction[] {
    const transactions: RawTransaction[] = []
    const lines = pdfText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip table headers and decorative lines
      if (AxisBankParser.HEADER_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))) continue
      if (/^[-=*]+$/.test(line)) continue

      const dateMatch = line.match(AxisBankParser.DATE_REGEX)
      if (!dateMatch) continue

      const date = dateMatch[1]

      // Collect all amount-like tokens in the line
      const amounts = [...line.matchAll(AxisBankParser.AMOUNT_REGEX)].map((m) => m[1])

      // Determine debit vs credit — Axis format: withdrawal column before deposit
      // Heuristic: if 2+ amounts, first non-balance is the transaction amount
      const amount = amounts[0] ?? '0'

      // Extract narration: text between the ref number and first amount
      // Remove the date and all amount tokens from the line to isolate narration
      const narration = line
        .replace(AxisBankParser.DATE_REGEX, '')
        .replace(AxisBankParser.AMOUNT_REGEX, '')
        .replace(/\d{6,}/g, '') // remove long ref numbers
        .trim()

      const vendor = narration || 'UNKNOWN'

      // Determine transaction type from narration keywords
      let transactionType = 'DEBIT'
      if (/credit|deposit|received|salary|inward/i.test(narration)) {
        transactionType = 'CREDIT'
      }

      if (amount && amount !== '0') {
        transactions.push({
          date,
          amount,
          vendor,
          transactionType,
          status: 'completed',
          rawFields: { date, amount, vendor, line },
        })
      }
    }

    return transactions
  }
}
