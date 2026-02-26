/**
 * PayZapp (PayZap) Statement Parser
 *
 * Extracts transactions from HDFC PayZapp (PayZap) PDF transaction statements.
 *
 * PayZapp statement structure (typical):
 *   - Transactions shown with: Date | Description | Amount | Type (Dr/Cr)
 *   - Date format: DD MMM YYYY or DD-MMM-YYYY
 *   - Amount prefixed with ₹ or INR
 *   - Transaction type: Dr (debit) or Cr (credit)
 *
 * This parser is pattern-matched similar to PhonePe but adapted for PayZapp's layout.
 */
import type { BaseParser } from './baseParser'
import type { RawTransaction } from '@/types/expense'

export class PayZapParser implements BaseParser {
  /**
   * PayZapp date: "DD MMM YYYY" or "DD-MMM-YYYY"
   */
  private static readonly DATE_REGEX =
    /(\d{1,2}[\s\-][A-Za-z]{3,}[\s\-]\d{4})/

  /**
   * Amount: INR or ₹ followed by numeric value
   */
  private static readonly AMOUNT_REGEX =
    /(?:INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i

  /**
   * Debit/credit indicator
   */
  private static readonly TYPE_REGEX = /\b(Dr|Cr)\b/i

  /**
   * Header keywords to skip
   */
  private static readonly HEADER_KEYWORDS = [
    'date', 'description', 'amount', 'transaction', 'type', 'balance',
  ]

  parse(pdfText: string): RawTransaction[] {
    const transactions: RawTransaction[] = []
    const lines = pdfText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip header rows
      if (PayZapParser.HEADER_KEYWORDS.some((kw) => line.toLowerCase().startsWith(kw))) continue

      const dateMatch = line.match(PayZapParser.DATE_REGEX)
      if (!dateMatch) continue

      const date = dateMatch[1]

      // Look for amount in current or next line
      let amountLine = line
      if (!PayZapParser.AMOUNT_REGEX.test(line) && i + 1 < lines.length) {
        amountLine = lines[i + 1]
      }
      const amountMatch = amountLine.match(PayZapParser.AMOUNT_REGEX)
      const amount = amountMatch ? amountMatch[1] : '0'

      // Extract description/vendor: strip date and amount from line
      const vendor = line
        .replace(PayZapParser.DATE_REGEX, '')
        .replace(PayZapParser.AMOUNT_REGEX, '')
        .replace(PayZapParser.TYPE_REGEX, '')
        .replace(/\d{8,}/g, '') // remove long ref numbers
        .trim() || 'UNKNOWN'

      // Determine Dr/Cr
      const typeMatch = line.match(PayZapParser.TYPE_REGEX)
      const transactionType = typeMatch
        ? typeMatch[1].toUpperCase() === 'CR' ? 'CREDIT' : 'DEBIT'
        : 'DEBIT'

      if (amount && amount !== '0') {
        transactions.push({
          date,
          amount,
          vendor,
          transactionType,
          status: 'completed',
          rawFields: { date, amount, vendor },
        })
      }
    }

    return transactions
  }
}
