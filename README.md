# Expense Manager

A modern web application to automatically extract, analyze, and track expense data from bank and UPI payment PDFs (PhonePe, Axis Bank, HDFC Bank, PayZapp) with Firestore persistence and deduplication.

## Features

- 📤 **PDF Upload** — drag-and-drop upload with password-protected PDF support
- 🏦 **Multi-Source Parsing** — dedicated parsers for PhonePe, Axis Bank, HDFC Bank, PayZapp
- 🔍 **Deduplication** — SHA256 fingerprint-based idempotent writes; 3 policies: skip, update, mark_duplicate
- 📊 **Dashboard** — total spend, category breakdown, source analysis, recent imports
- 📋 **Expenses Table** — filterable by date, vendor, category, source; sortable; CSV export
- 📜 **Import History** — full audit log of every import job with created/skipped/updated counts
- ☁️ **Firestore Backend** — scalable, real-time database with emulator support for local dev

## Tech Stack

| Layer            | Technology                       |
| ---------------- | -------------------------------- |
| Frontend         | Vue 3 + TypeScript + Vite        |
| UI Components    | bootstrap-vue-next + Bootstrap 5 |
| State Management | Pinia                            |
| Routing          | Vue Router 4                     |
| Database         | Firebase Firestore               |
| PDF Parsing      | pdfjs-dist                       |
| Hashing          | crypto-js (SHA256)               |
| Tests            | Vitest + jsdom                   |

## Project Structure

```
src/
├── composables/        # Upload, expenses, and job polling hooks
│   ├── useUpload.ts    # Full PDF pipeline: extract → parse → deduplicate → persist
│   ├── useExpenses.ts  # Reactive expense list with filters, sort, CSV export
│   └── useJob.ts       # Import job polling
├── firebase.ts         # Firebase app and Firestore initialization
├── parsers/            # Adapter-pattern PDF parsers
│   ├── baseParser.ts   # Base interface for all parsers
│   ├── phonePeParser.ts
│   ├── axisBankParser.ts
│   ├── hdfcBankParser.ts
│   ├── payZapParser.ts
│   └── parserFactory.ts
├── router/             # Vue Router routes
├── services/
│   └── firestoreService.ts  # Firestore CRUD + deduplication transaction
├── stores/
│   └── expenseStore.ts      # Pinia global state
├── tests/              # Vitest unit tests
│   ├── deduplication.test.ts
│   └── parsers/
│       ├── phonePe.test.ts
│       └── axisBank.test.ts
├── types/
│   └── expense.ts      # TypeScript interfaces and types
├── utils/
│   └── deduplication.ts # Normalization and SHA256 fingerprinting
└── views/              # Page views
    ├── DashboardView.vue
    ├── UploadView.vue
    ├── ExpensesView.vue
    └── HistoryView.vue
└── test-data/          # Sample PDFs for manual/integration testing (gitignored)
```

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd expense-manager-1
npm install
```

### 2. Configure Firebase

```bash
cp .env.example .env
```

Edit `.env` and fill in your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Get these from [Firebase Console](https://console.firebase.google.com) → Project Settings → Web App.

### 3. Run the development server

```bash
npm run dev
# Opens at http://localhost:5173
```

### 4. (Optional) Use Firebase Emulator for local development

```bash
firebase emulators:start --only firestore
```

Set `VITE_USE_FIREBASE_EMULATOR=true` in `.env` to connect to it.

## Running Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

- `deduplication.test.ts` — date normalization, amount parsing, vendor normalization, fingerprint determinism
- `parsers/phonePe.test.ts` — PhonePe statement text extraction
- `parsers/axisBank.test.ts` — Axis Bank statement text extraction

## Building for Production

```bash
npm run build
# Output in /dist
```

## Data Model

Each expense stored in Firestore follows this canonical schema:

```json
{
  "id": "<fingerprint or transaction_id>",
  "fingerprint": "<sha256>",
  "source": "phonepe | axis | hdfc | payzap",
  "source_transaction_id": "<string | null>",
  "date": "YYYY-MM-DD",
  "amount": 349.5,
  "currency": "INR",
  "vendor": "ACME STORE",
  "category": "<string | null>",
  "status": "completed | pending | failed | reversed",
  "raw_text": { "...": "original pdf fields for debugging" },
  "source_file_checksum": "sha256:...",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

## Deduplication Logic

1. Normalize: date → ISO 8601, amount → 2dp, vendor → uppercase + no punctuation
2. Fingerprint: `SHA256(date|amount|vendor|type)`
3. Check Firestore for existing doc with fingerprint as ID
4. Apply configured policy: **skip** (default) / **update** / **mark_duplicate**

## Adding a New Bank Parser

1. Create `src/parsers/myBankParser.ts` implementing `BaseParser`
2. Add the source type to `ExpenseSource` in `src/types/expense.ts`
3. Register in `src/parsers/parserFactory.ts`
4. Add UI option in `UploadView.vue` source selector
5. Write unit tests in `src/tests/parsers/myBank.test.ts`

## Adding Sample PDFs for Testing

Place PDF files in `test-data/` (gitignored). See `test-data/README.md` for details.
