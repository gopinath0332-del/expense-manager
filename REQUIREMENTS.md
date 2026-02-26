# Expense Manager - Requirements

## Project Overview
A web application to automatically extract, analyze, and track expense data from PhonePe transaction reports (PDF format) and display them in an organized dashboard with persistent storage.

## Supported Report Sources

- PhonePe
- Axis Bank
- HDFC Bank
- PayZap

## Functional Requirements

### 1. PDF Upload & Processing
- Users should be able to upload a PDF file containing their PhonePe expense report
- The application should support password-protected PDF files
- Password should be securely managed via environment variables (.env file)
- Extract transaction data from the PDF report accurately

### 2. Data Analysis & Extraction
- Parse the PDF report structure and extract transaction details
- Identify and categorize the following information:
  - Transaction dates
  - Transaction amounts
  - Merchant/vendor names
  - Transaction categories (if available)
  - Payment status
- Handle edge cases and format variations in the report
- Support multiple bank-specific report formats (Axis Bank, HDFC Bank, PayZap, PhonePe)
- Implement modular parsers or adapter pattern so each bank/report type has a dedicated extractor
- Normalize vendor names, dates, and amount formats across sources to a common schema

### 3. Data Display & Visualization
- Display extracted expenses in a clear, organized table or list view
- Show summary statistics:
  - Total expenses
  - Expenses by category
  - Date-range analysis
- Provide filtering and sorting capabilities

### 4. Data Persistence
- Store all extracted expense data in Firestore database
- Maintain data integrity and prevent duplicates
- Allow users to view historical expense records

### Duplicate Detection & Deduplication
- Before inserting any extracted record into Firestore, the system must check whether the record (or an equivalent record) already exists.
- Define duplicate matching rules (in order of preference):
  1. Unique transaction ID/reference (if provided by the report)
 2. Normalized tuple of (date, amount, vendor/merchant, transaction type)
 3. Source file checksum + record index (to detect re-uploads of the same document)
- Normalize fields prior to matching (trim whitespace, unify date format, normalize currency/decimal separators, canonicalize vendor names)
- Use a deterministic record fingerprint/hash (e.g., SHA256 of normalized fields) to speed up duplicate checks
- Store the record fingerprint and source file checksum alongside each Firestore document to allow fast lookups and idempotent writes
- Prefer idempotent upserts: use the fingerprint or unique transaction ID as the Firestore document ID so repeated processing of the same report does not create duplicates
- Use Firestore transactions or batched writes when performing existence-check + insert to avoid race conditions
- Provide configurable duplicate handling policies: skip, update existing record, or create a linked duplicate with audit metadata

## User Stories & Acceptance Criteria

- As a user, I can upload a PDF and see parsed transactions in a table.  
  - Acceptance: All transactions appear with date, amount, vendor; no UI errors; duplicates are not created on re-upload.
- As a user, I can filter expenses by date range and category.  
  - Acceptance: Filters return correct subset and summary totals update accordingly.
- As an admin, I can view import logs and deduplication decisions.  
  - Acceptance: Import job shows skipped/updated/created counts and links to records.

## Data Model (Canonical Expense Document)

- Fields (recommended):
  - `id` (string) — Firestore document ID (use fingerprint or transaction ID when available)
  - `fingerprint` (string) — deterministic hash of normalized identifying fields
  - `source` (string) — e.g., `phonepe`, `axis`, `hdfc`, `payzap`
  - `source_transaction_id` (string|null)
  - `date` (ISO 8601 date string)
  - `amount` (number)
  - `currency` (string, e.g., `INR`)
  - `vendor` (string)
  - `category` (string|null)
  - `status` (string, e.g., `completed`, `pending`)
  - `raw_text` (object) — raw extracted fields for debugging
  - `source_file_checksum` (string) — checksum of the uploaded file
  - `created_at` / `updated_at` (timestamps)

Example JSON:

```json
{
  "id": "5f4d...",
  "fingerprint": "a3b2c1...",
  "source": "axis",
  "source_transaction_id": "AX12345",
  "date": "2026-02-10",
  "amount": 349.5,
  "currency": "INR",
  "vendor": "ACME STORE",
  "category": "Groceries",
  "status": "completed",
  "raw_text": {"line": "10 Feb 2026 ACME STORE 349.50"},
  "source_file_checksum": "sha256:...",
  "created_at": "2026-02-26T10:15:00Z"
}
```

## Deduplication — Concrete Pseudocode

1. Normalize fields:
   - `date` -> ISO 8601 (YYYY-MM-DD)
   - `amount` -> numeric with 2 decimals
   - `vendor` -> uppercase, trim, remove punctuation
2. Compute fingerprint: `fingerprint = SHA256(date + '|' + amount + '|' + vendor + '|' + (type||""))`
3. Attempt idempotent write:
   - If `source_transaction_id` exists, use it as primary key to check/insert.
   - Else, check Firestore for document with `fingerprint`.
   - If found, apply duplicate policy (skip/update/mark duplicate).
   - Else insert document with `id = fingerprint` (or a generated id) and store `fingerprint`.

Pseudocode example:

```text
record = normalize(extracted)
fingerprint = sha256(record.date + '|' + record.amount + '|' + record.vendor)
docRef = firestore.collection('expenses').doc(fingerprint)
firestore.runTransaction(tx -> {
  existing = tx.get(docRef)
  if (existing.exists) {
    // handle according to policy
    return {action: 'skipped', id: existing.id}
  } else {
    tx.set(docRef, {...record, fingerprint, source_file_checksum})
    return {action: 'created', id: docRef.id}
  }
})
```

## API & Integration Contracts (brief)

- `POST /api/upload` — multipart/form-data: `file`, `source`, `password?`  
  - Response: `{ jobId, status: 'queued' }`
- `GET /api/jobs/:jobId` — returns parse progress and summary (created/skipped/updated counts)
- `GET /api/expenses` — queryable by `date`, `vendor`, `category`, `source`
- Auth: use Firebase Auth tokens (Bearer) or API keys for server-to-server

Example `POST /api/upload` request body (multipart): `file=@report.pdf`, `source=axis`, `password=****`

## Testing Plan (brief)

- Unit tests:
  - Parser unit tests for each bank format with edge-case samples
  - Deduplication unit tests (same record variations must fingerprint equal)
- Integration tests:
  - Upload -> parse -> persist workflow using test Firestore emulator
  - Re-upload same file should not create duplicates
- Test assets:
  - Add a `test-data/` folder with representative PDF samples for PhonePe, Axis, HDFC, PayZap
- CI:
  - Run parser unit tests and integration tests against Firestore emulator on PRs

## Non-Functional Requirements

- **Security**: Sensitive information (database credentials, API keys) must be stored in `.env` file, not in source code
- **User Experience**: Intuitive and responsive UI design
- **Performance**: Efficient PDF parsing and data processing
- **Scalability**: Support multiple users with their own expense records
- **Data Validation**: Validate extracted data before storing in database

## Technical Stack

- **Frontend**: Vue.js (Vue 3 recommended) + Typescript
- **UI Component Library**: Bootstrap Vue (https://bootstrap-vue.org/) for responsive and accessible UI components
- **Backend**: Node.js/Firebase Functions (optional, for PDF processing)
- **Database**: Firestore
- **PDF Processing**: PDF parsing library (pdf-lib, pdfjs-dist, or similar)
- **Environment Management**: dotenv for configuration

## Implementation Considerations

- Implement error handling for corrupted or invalid PDF files
- Consider batch processing for large reports
- Add audit logs for data extraction activities
- Implement data export functionality (CSV/Excel) for user convenience
- Use Bootstrap Vue components for tables (b-table), forms (b-form), modals (b-modal), and buttons (b-button)
- Ensure responsive design using Bootstrap Vue's grid system and layout components
- Implement proper validation feedback using Bootstrap Vue form components with visual indicators

- When importing reports in bulk or re-processing large files, compute and persist the file checksum first and use it to short-circuit parsing if the file was already processed
- Log deduplication decisions (skipped/updated/created) with enough context for audit and user-facing history

## Reference
Refer to the PhonePe report screenshot for structure guidelines:
![phonepe](image.png)