# Test Data

Place representative PDF samples here for manual testing and integration tests.

## Required Files

| Filename             | Description                        |
| -------------------- | ---------------------------------- |
| `phonepe_sample.pdf` | PhonePe transaction history export |
| `axis_sample.pdf`    | Axis Bank account statement        |
| `hdfc_sample.pdf`    | HDFC Bank account statement        |
| `payzap_sample.pdf`  | PayZapp transaction statement      |

## How to Obtain Sample PDFs

- **PhonePe**: Profile → Transaction History → Download Statement
- **Axis Bank**: Net Banking → Account → Download Statement
- **HDFC Bank**: NetBanking → My Accounts → Download Statement
- **PayZapp**: PayZapp app → Transaction History → Export

## Notes

- Sample files added here are **gitignored** — never commit real transaction data.
- For CI/CD integration tests, use redacted/anonymized files only.
- Password-protected PDFs: configure the password in `.env` as `VITE_PDF_DEFAULT_PASSWORD`.
