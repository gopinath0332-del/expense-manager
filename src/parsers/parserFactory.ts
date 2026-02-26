/**
 * Parser Factory
 *
 * Implements the factory function pattern to return the correct parser
 * instance based on the selected report source.
 *
 * Usage:
 *   const parser = getParser('phonepe')
 *   const transactions = parser.parse(pdfText)
 */
import type { BaseParser } from './baseParser'
import { PhonePeParser } from './phonePeParser'
import { AxisBankParser } from './axisBankParser'
import { HDFCBankParser } from './hdfcBankParser'
import { PayZapParser } from './payZapParser'
import type { ExpenseSource } from '@/types/expense'

/**
 * Returns the appropriate parser for the given expense source.
 * Throws an error if the source is not supported.
 *
 * @param source - The source identifier ('phonepe' | 'axis' | 'hdfc' | 'payzap')
 * @returns An instance of the matching BaseParser implementation
 */
export function getParser(source: ExpenseSource): BaseParser {
  switch (source) {
    case 'phonepe':
      return new PhonePeParser()
    case 'axis':
      return new AxisBankParser()
    case 'hdfc':
      return new HDFCBankParser()
    case 'payzap':
      return new PayZapParser()
    default: {
      // TypeScript exhaustiveness check — this branch should never be reached
      const _exhaustive: never = source
      throw new Error(`Unsupported report source: ${_exhaustive}`)
    }
  }
}
