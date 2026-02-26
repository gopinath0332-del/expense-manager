/**
 * HDFC Bank Statement Parser
 *
 * Extracts transactions from HDFC Bank PDF account statements.
 *
 * HDFC Bank table column order (typical):
 *   Date | Narration | Chq/Ref Number | Value Date | Withdrawal Amt.(INR) | Deposit Amt.(INR) | Closing Balance(INR)
 *   01/01/26 | UPI/VENDOR/UTR... | 123456 | 01/01/26 | 500.00 | | 10,000.00
 *
 * HDFC uses DD/MM/YY dates (2-digit year) or DD/MM/YYYY.
 * Narration often contains UPI reference in format: UPI/<vendor>/<UTR>/<remarks>
 */
import type { BaseParser } from './baseParser'
import type { RawTransaction } from '@/types/expense'

export class HDFCBankParser implements BaseParser {
  /**
   * HDFC uses DD/MM/YY or DD/MM/YYYY date format
   */
  private static readonly DATE_REGEX = /^(\d{2}\/\d{2}\/\d{2,4})/

  /**
   * Amount: comma-separated value with 2 decimal places
   */
  private static readonly AMOUNT_REGEX = /([\d,]+\.\d{2})/g

  /**
   * UPI narration pattern: UPI/VENDOR_NAME/UTR_NUMBER/REMARKS
   */
  private static readonly UPI_NARRATION_REGEX =
    /UPI[\/\-]([^\/]+)\/([^\/]+)\/?(.*)?/i

  /**
   * Table header keywords used to skip header rows
   */
  private static readonly HEADER_KEYWORDS = [
    'date', 'narration', 'chq', 'withdrawal', 'deposit', 'closing', 'balance', 'value date',
  ]

  /**
   * Resolves a 2-digit year to a 4-digit year (assume 20xx for years <= 50)
   */
  private static expandYear(date: string): string {
    return date.replace(/(\d{2})\/(\d{2})\/(\d{2})$/, (_, d, m, y) => {
      const full = parseInt(y) <= 50 ? `20${y}` : `19${y}`
      return `${d}/${m}/${full}`
    })
  }

  parse(pdfText: string): RawTransaction[] {
    const transactions: RawTransaction[] = []
    const lines = pdfText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    for (const line of lines) {
      // Skip header rows
      const lower = line.toLowerCase()
      if (HDFCBankParser.HEADER_KEYWORDS.some((kw) => lower.startsWith(kw))) continue
      if (/^[-=*\s]+$/.test(line)) continue

      const dateMatch = line.match(HDFCBankParser.DATE_REGEX)
      if (!dateMatch) continue

      const date = HDFCBankParser.expandYear(dateMatch[1])

      // Extract amounts
      const amounts = [...line.matchAll(HDFCBankParser.AMOUNT_REGEX)].map((m) => m[1])
      // HDFC: first amount is Withdrawal, second is Deposit, third is Balance
      // Use first available as transaction amount
      const amount = amounts[0] ?? '0'

      // Extract narration part (between date and first amount)
      const narrationRaw = line
        .replace(HDFCBankParser.DATE_REGEX, '')
        .replace(HDFCBankParser.AMOUNT_REGEX, '')
        .replace(/\d{6,}/g, '') // remove reference numbers
        .trim()

      // Try to parse UPI narration for a cleaner vendor name
      let vendor = narrationRaw
      let sourceTransactionId: string | undefined
      const upiMatch = narrationRaw.match(HDFCBankParser.UPI_NARRATION_REGEX)
      if (upiMatch) {
        vendor = upiMatch[1].trim() || narrationRaw
        sourceTransactionId = upiMatch[2]?.trim()
      }

      // Determine debit vs credit
      const transactionType = /credit|deposit|received|salary|inward/i.test(narrationRaw)
        ? 'CREDIT'
        : 'DEBIT'

      if (amount && amount !== '0' && vendor) {
        transactions.push({
          sourceTransactionId,
          date,
          amount,
          vendor,
          transactionType,
          status: 'completed',
          rawFields: { date, amount, vendor: narrationRaw },
        })
      }
    }

    return transactions
  }
}
