/**
 * PhonePe Statement Parser
 *
 * Extracts transactions from PhonePe PDF transaction reports.
 *
 * PhonePe statement structure (per the requirements screenshot):
 *   - Each transaction block contains:
 *       <Merchant/Recipient Name>
 *       <DD MMM YYYY, HH:MM AM/PM>   (date + time on same line)
 *       <Transaction type: Paid/Received/Refund>
 *       ₹<Amount>
 *       Status: <Completed/Failed/Pending/Reversed>
 *       UPI transaction ID: <ID>
 *
 * The parser uses a multi-line sliding-window approach:
 * groups of 6 lines per transaction.
 */
import type { BaseParser } from './baseParser'
import type { RawTransaction } from '@/types/expense'

export class PhonePeParser implements BaseParser {
  /**
   * Regular expressions for identifying key fields in a PhonePe statement.
   */
  private static readonly DATE_REGEX =
    /(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/

  private static readonly AMOUNT_REGEX =
    /₹\s*([\d,]+(?:\.\d{1,2})?)/

  private static readonly STATUS_REGEX =
    /(?:Status\s*[:\-]?\s*)?(Completed|Failed|Pending|Reversed)/i

  private static readonly TXN_ID_REGEX =
    /UPI\s+transaction\s+ID\s*[:\-]?\s*([A-Za-z0-9]+)/i

  private static readonly TYPE_REGEX =
    /^(Paid|Received|Refund|Sent|Transferred)/i

  /**
   * Maps PhonePe status strings to our canonical status enum.
   */
  private static mapStatus(raw: string): RawTransaction['status'] {
    const lower = raw.toLowerCase()
    if (lower === 'completed') return 'completed'
    if (lower === 'pending') return 'pending'
    if (lower === 'failed') return 'failed'
    if (lower === 'reversed') return 'reversed'
    return 'completed'
  }

  parse(pdfText: string): RawTransaction[] {
    const transactions: RawTransaction[] = []
    // Split into lines and remove blank lines / page headers
    const lines = pdfText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    let i = 0
    while (i < lines.length) {
      // Look for an amount line (₹...) as the anchor for a transaction block
      if (PhonePeParser.AMOUNT_REGEX.test(lines[i])) {
        // Scan backward for the date (within 5 lines)
        let date = ''
        let vendor = ''
        for (let back = i - 1; back >= Math.max(0, i - 5); back--) {
          const dateMatch = lines[back].match(PhonePeParser.DATE_REGEX)
          if (dateMatch) {
            date = dateMatch[1]
            // The line before the date is typically the merchant/vendor name
            if (back > 0) vendor = lines[back - 1]
            break
          }
        }

        const amountMatch = lines[i].match(PhonePeParser.AMOUNT_REGEX)
        const amount = amountMatch ? amountMatch[1] : '0'

        // Scan forward for status and transaction ID (within 4 lines)
        let status = 'Completed'
        let sourceTransactionId: string | undefined
        let transactionType = ''
        for (let fwd = i + 1; fwd < Math.min(lines.length, i + 5); fwd++) {
          const statusMatch = lines[fwd].match(PhonePeParser.STATUS_REGEX)
          if (statusMatch) status = statusMatch[1]
          const txnMatch = lines[fwd].match(PhonePeParser.TXN_ID_REGEX)
          if (txnMatch) sourceTransactionId = txnMatch[1]
          const typeMatch = lines[fwd].match(PhonePeParser.TYPE_REGEX)
          if (typeMatch) transactionType = typeMatch[1]
        }

        // Only add if we found both a vendor and a date
        if (vendor && date) {
          transactions.push({
            sourceTransactionId,
            date,
            amount,
            vendor,
            transactionType,
            status: PhonePeParser.mapStatus(status),
            rawFields: {
              date,
              amount,
              vendor,
              status,
              transactionType,
            },
          })
        }
      }
      i++
    }

    return transactions
  }
}
