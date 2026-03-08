# FinVoice AI Repository Documentation

Generated: March 8, 2026
Repository root: `C:\Users\Owner\.vscode\projects\Hackathons\SASEHACKS26\SaseHacks`

## 1. Project Summary

FinVoice AI is a finance-document intelligence app with authenticated upload, retrieval-augmented Q and A, AI summaries, optional voice playback, presentation generation, and a newly added stock analysis workflow for public equities.

The current repository is split into:
- A Vite + React + TypeScript frontend in `src`
- An Express + MongoDB backend in `server`
- Static assets in `public`
- Developer utilities and generated docs in `dev resources`

## 2. What Changed Recently

The latest changes introduce a full stock analysis slice across frontend, backend, persistence, and tests.

### New frontend additions

- `src/components/portfolio/PortfolioAnalysisTab.tsx`
  New dedicated UI for stock/company assessment with:
  - Query input by ticker or company name
  - Overall score and verdict rendering
  - Category scorecards for Growth, Financial Health, News Outlook, and Stock Value
  - Per-question scoring breakdowns
  - Top positives and risks
  - Source list with filings and news links
  - Portfolio history view

- `src/lib/portfolio-api.ts`
  Typed client functions for:
  - `POST /portfolio/analyze`
  - `GET /portfolio/history`

- `src/app/page.tsx`
  Main landing page now includes a Stock Analysis tab switch into `PortfolioAnalysisTab`.

### New backend additions

- New authenticated route group mounted in `server/server.js`:
  - `app.use("/portfolio", verifyFirebaseAuth, portfolioRoutes)`

- New backend module folder: `server/portfolio`
  - `routes.js`: portfolio endpoints and persistence writes
  - `analyzer.js`: orchestration pipeline and Gemini call
  - `company-resolver.js`: SEC ticker/name resolution
  - `news-discovery.js`: multi-provider news discovery, ranking, dedupe
  - `article-extractor.js`: lightweight article text extraction
  - `sec-data.js`: SEC filings and company facts snapshot
  - `market-data.js`: market data via primary provider config with fallback providers
  - `peer-valuation.js`: peer P/E comparison using static peer map
  - `scoring.js`: deterministic scoring formulas and verdict bands
  - `validation.js`: input/payload normalization and guardrails
  - `prompt.js`: strict JSON prompt template
  - `questions.js`: canonical question sets
  - `cache.js`: Redis/Upstash-backed cache with in-memory TTL fallback
  - `collections.js`: portfolio collection names
  - `config.js`: portfolio provider/cache configuration

### New tests and scripts

- New backend tests in `server/tests`:
  - `article-extractor.test.js`
  - `auth-middleware.test.js`
  - `model-json.test.js`
  - `portfolio-config.test.js`
  - `provider-fallbacks.test.js`
  - `scoring.test.js`
  - `source-compliance.test.js`
  - `stock-value-evidence.test.js`
  - `validation.test.js`

- `package.json` (root) now includes:
  - `npm test` -> delegates to `server` tests

- `server/package.json` now includes:
  - `npm test` -> `node --test tests/**/*.test.js`

## 3. Main User Workflows

### 3.1 Document intelligence workflow

1. User signs in with Google via Firebase web auth.
2. Frontend sends Firebase ID token in `Authorization` header.
3. User uploads PDF/TXT files.
4. Backend parses text, chunks content, embeds chunks, stores in MongoDB, and generates summary.
5. User asks questions; backend retrieves relevant chunks (vector + text hybrid path) and returns grounded answer with citations.
6. User can listen to answers through ElevenLabs with browser speech fallback.
7. User can regenerate summaries and generate slide decks.

### 3.2 Stock analysis workflow (new)

1. Authenticated user opens Stock Analysis tab from landing page.
2. User submits company query (ticker or company name).
3. Backend resolves company identity and gathers evidence:
   - News sources
   - Extracted article content
   - SEC filings and financial facts
   - Market quote metrics
   - Peer valuation comparison
4. Backend prompts Gemini for structured JSON analysis.
5. Backend normalizes output to fixed question schema, computes deterministic scores, and returns analysis + sources + warnings + disclaimer.
6. Backend stores portfolio analysis artifacts and exposes history for later recall.

## 4. Frontend Architecture

### Entry points

- Runtime entry: `src/main.tsx`
- Application shell: `src/App.tsx`
- Main page: `src/app/page.tsx`

`src/app/layout.tsx` exists, but the active runtime path is still Vite (`main.tsx -> App.tsx -> page.tsx`), not Next.js app-router runtime.

### Major frontend modules

- `src/app/page.tsx`
  Landing page, upload and ask flow, conversation mode entry, summary display, and tab switch to stock analysis.

- `src/components/documents/DocumentChatWorkspace.tsx`
  Conversation workspace with document selection and follow-up Q and A.

- `src/components/documents/FileUpload.tsx`
  Upload handling, session-level document list, and delete flow.

- `src/components/portfolio/PortfolioAnalysisTab.tsx`
  New portfolio UI workflow.

- `src/lib/portfolio-api.ts`
  New typed portfolio API client.

- `src/components/PresentationGenerator.tsx`
  Generates slide decks from financial briefing payloads.

- `src/providers/AuthProvider.tsx`
  Browser auth state and token-backed session context.

## 5. Backend Architecture

Primary API is implemented in `server/server.js`.

### Existing document/chat routes

- `POST /upload` (auth required)
- `GET /documents` (auth required)
- `DELETE /documents/:documentId` (auth required)
- `POST /ask` (auth required)
- `GET /summary/:documentId` (auth required)
- `POST /resummarize/:documentId` (auth required)
- `POST /speech`
- `GET /speech`
- `POST /chat` (not auth-scoped in the same way as `/ask`)
- `/presentation/*` routes

### New stock-analysis routes (all auth required)

- `POST /portfolio/analyze`
  - Validates input (`query` required, max 120 chars)
  - Creates running job record
  - Runs analysis pipeline
  - Persists analysis and source artifacts
  - Marks job completed
  - Returns analysis payload + config warnings + disclaimer

- `GET /portfolio/analysis/:ticker`
  - Returns latest stored analysis for the authenticated user+ticker

- `GET /portfolio/news/:ticker`
  - Returns latest saved news artifacts for that user+ticker

- `GET /portfolio/history`
  - Returns most recent analysis history items (up to 25)

## 6. Stock Analysis Pipeline Details

`server/portfolio/analyzer.js` orchestrates the following steps:

1. Resolve ticker/company:
   - `resolveCompanyInput` supports raw ticker, canonical name match, partial name match, and alias map.
2. Gather news:
   - Configurable API provider (if configured)
   - Google News RSS fallback
   - Dedupe + ranking based on relevance, recency, and source reputation
3. Extract article body text:
   - HTML stripping fallback to snippet when fetch fails
4. Fetch SEC snapshot:
   - Latest 10-K, 10-Q, and optional 8-K signal
   - Revenue, net income, operating cash flow, long-term debt series
5. Fetch market snapshot:
   - Primary market provider fields (configured by env) with Yahoo/Stooq-derived fallback coverage where needed
6. Fetch peer valuation:
   - Static peer map and median trailing P/E comparison
7. Build evidence bundle and call Gemini (`gemini-2.5-flash`) with strict JSON schema prompt.
8. Normalize and score:
   - Clamp question scores to 1..5
   - Compute category scores to 0..100
   - Compute weighted overall score:
     - Growth 30%
     - Financial Health 30%
     - News Outlook 20%
     - Stock Value 20%
   - Map score to verdict band.
9. Validate and normalize final payload (`ensureAnalysisPayload`) to guarantee required shape.

### Caching behavior

- News, SEC snapshot, market snapshot, and peer valuation lookups use Redis/Upstash cache when configured.
- In-memory TTL cache remains as fallback and is process-local (resets on restart).

## 7. Data Model and Persistence

### Existing collections

- `chunks`
- `summaries`

### New portfolio collections

- `portfolioAnalyses`
  Stores completed portfolio analyses by user+ticker+timestamp.

- `portfolioJobs`
  Stores analysis job lifecycle records (`running`, `completed`, and `failed` inserts).

- `companyProfiles`
  Stores lightweight ticker/company profile metadata.

- `companySnapshots`
  Stores per-user ticker source snapshots.

- `newsArticles`
  Stores deduplicated/upserted news records per ticker+url.

## 8. Environment Configuration

### Frontend env vars

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Backend env vars (document/chat stack)

- `MONGODB_URI`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Backend env vars (new portfolio stack)

- `NEWS_API_URL`
- `NEWS_API_KEY`
- `MARKET_DATA_API_URL`
- `MARKET_DATA_API_KEY`
- `SEC_USER_AGENT`
- `PORTFOLIO_CACHE_TTL_MS` (optional numeric override)
- `PORTFOLIO_NEWS_LIMIT` (optional numeric override)
- `REDIS_URL` (optional)
- `UPSTASH_REDIS_REST_URL` (optional)
- `UPSTASH_REDIS_REST_TOKEN` (optional)
- `PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS` (optional comma-separated allowlist)
- `PORTFOLIO_MAX_SNIPPET_CHARS` (optional)
- `PORTFOLIO_MAX_EXTRACTED_CHARS` (optional)
- `PORTFOLIO_ROBOTS_CACHE_TTL_MS` (optional)
- `PORTFOLIO_SOURCE_RATE_LIMIT_WINDOW_MS` (optional)
- `PORTFOLIO_SOURCE_RATE_LIMIT_MAX_REQUESTS` (optional)
- `PORTFOLIO_ROBOTS_FAIL_CLOSED` (optional boolean)

### Security note

Keep all secrets in local environment configuration and never commit real credentials.

## 9. Run, Build, and Test Commands

### Frontend/root

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`
- `npm test` (new; runs backend Node tests via `npm --prefix server test`)

### Backend

From `server` directory:

- `npm install`
- `npm start`
- `npm run setup:indexes`
- `npm test`

## 10. Current Implementation Status (Verified March 8, 2026)

### Command health

- `npm test`: passes (9 tests)
- `npm run build`: passes
- `npm run typecheck`: fails
  - `src/components/ui/sidebar.tsx` type-only import issue
  - `src/components/ui/sonner.tsx` type-only import issue
- `npm run lint`: fails
  - Existing `any` usages
  - `react-refresh/only-export-components` violations
  - React purity/effect warnings in shared UI/auth files

### Functional status

- Core document intelligence pipeline remains operational.
- Portfolio analysis end-to-end path is implemented and user-accessible from the landing page.
- Portfolio pipeline includes source fallback and payload normalization safeguards.
- Generated portfolio response explicitly includes a non-advisory disclaimer.

## 11. Known Risks and Technical Debt

- Runtime structure still mixes Next-style folder naming with a Vite runtime path.
- `src/App.tsx` uses `ThemeProvider defaultTheme="dark"` while `src/app/layout.tsx` is configured for light and is not the live runtime shell.
- `POST /chat` remains behaviorally separate from authenticated scoped `/ask`.
- Portfolio cache depends on runtime configuration. Redis/Upstash is used when configured, otherwise fallback is in-memory.
- Provider configuration warning checks do not fully enforce all provider keys at runtime.
- Build currently succeeds while typecheck/lint fail, so CI signal is incomplete.

## 12. Recommended Next Steps

- Add/extend MongoDB indexes for new portfolio collections (`portfolioAnalyses`, `portfolioJobs`, `newsArticles`, `companySnapshots`) based on query patterns.
- Add tests for portfolio route handlers (`/portfolio/analyze`, `/portfolio/history`, `/portfolio/analysis/:ticker`) including auth and error paths.
- Close current TypeScript and ESLint failures to restore trusted quality gates.
- Decide whether to secure, deprecate, or remove `POST /chat` in favor of `/ask`.
- Consolidate runtime architecture and theming defaults so there is one canonical shell path.
