# FinVoice AI

FinVoice AI is a financial research assistant that combines document intelligence, retrieval-augmented question answering, AI-generated briefings, presentation generation, text-to-speech, and public stock analysis in a single application.

Live app: `https://sase-hacks-n252.vercel.app/`

## Overview

The project is built as a full-stack app:

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express
- Data: MongoDB Atlas
- Auth: Firebase Authentication
- AI: Google Gemini
- Voice: ElevenLabs with browser speech fallback

FinVoice AI is designed for research productivity and explainability. It helps users upload financial documents, ask grounded questions with source references, generate structured financial summaries, export presentation decks, and run company-level stock analysis using a combination of SEC data, news, market data, and deterministic scoring.

It is not intended to provide personalized financial advice.

## Core Features

### 1. Document Intelligence

- Upload PDF and TXT files
- Parse, chunk, embed, and store documents in MongoDB
- Ask natural-language questions about uploaded files
- Return grounded answers with source references
- Support both single-document and all-documents scope

### 2. Conversation Mode

- Continue follow-up questions in a dedicated chat workspace
- Preserve recent message context for multi-turn analysis
- Switch between one file or all uploaded files as retrieval scope

### 3. AI Financial Briefings

- Generate structured summaries for uploaded documents
- Surface key takeaways, metrics, risks, and red flags
- Regenerate summaries on demand

### 4. Text-to-Speech

- Read generated answers aloud
- Use ElevenLabs as the primary provider
- Fall back to browser speech synthesis if the API is unavailable

### 5. Presentation Generation

- Generate slide outlines from financial briefings
- Export PowerPoint files
- Attach AI-generated slide backgrounds when available

### 6. Stock Analysis

- Analyze a public company by ticker or company name
- Combine evidence from news, SEC filings, market data, and peer valuation
- Produce structured output across:
  - Growth
  - Financial Health
  - News Outlook
  - Stock Value
- Compute deterministic category scores and an overall verdict
- Save historical analyses per user

## How It Works

### Document Q&A workflow

1. A signed-in user uploads one or more files.
2. The backend extracts text, splits it into chunks, generates embeddings, and stores them in MongoDB.
3. When the user asks a question, the backend retrieves relevant chunks using retrieval logic and sends only relevant evidence to Gemini.
4. The response is returned with source references so the UI can show where the answer came from.

### Stock analysis workflow

1. The user submits a ticker or company name.
2. The backend resolves the company identity.
3. Evidence is gathered from SEC filings, news providers, article extraction, market data providers, and peer valuation logic.
4. Gemini generates structured analysis content.
5. Backend code normalizes the model output and calculates final scores deterministically.
6. The analysis, sources, and history are persisted for the authenticated user.

## Repository Structure

```text
.
|-- src/                    # React frontend
|-- public/                 # Static assets
|-- server/                 # Express backend
|   |-- portfolio/          # Stock analysis pipeline
|   |-- routes/             # Chat and presentation routes
|   |-- services/           # RAG, summaries, TTS, PPT, embeddings
|   |-- tests/              # Node test suite
|-- dev resources/          # Internal project docs and helper scripts
```

## Main Frontend Areas

- `src/app/page.tsx`: landing page and main product shell
- `src/components/documents/FileUpload.tsx`: authenticated file ingestion
- `src/components/documents/DocumentChatWorkspace.tsx`: multi-turn document chat
- `src/components/portfolio/PortfolioAnalysisTab.tsx`: stock analysis experience
- `src/components/PresentationGenerator.tsx`: slide generation and export
- `src/providers/AuthProvider.tsx`: Firebase auth state handling

## Main Backend Areas

- `server/server.js`: API entry point
- `server/routes/chat.js`: general chat route
- `server/routes/presentation-routes.js`: presentation generation and export
- `server/portfolio/routes.js`: stock analysis endpoints
- `server/portfolio/analyzer.js`: orchestration for stock analysis
- `server/services/rag.js`: retrieval-augmented Q&A
- `server/services/summarizer.js`: financial summary generation
- `server/services/tts.js`: speech generation

## API Summary

### Document and chat routes

- `POST /upload`
- `GET /documents`
- `DELETE /documents/:documentId`
- `POST /ask`
- `GET /summary/:documentId`
- `POST /resummarize/:documentId`
- `POST /chat`
- `GET /speech`
- `POST /speech`

### Presentation routes

- `POST /presentation/generate-presentation`
- `POST /presentation/export-presentation`

### Portfolio routes

- `POST /portfolio/analyze`
- `GET /portfolio/analysis/:ticker`
- `GET /portfolio/news/:ticker`
- `GET /portfolio/history`

Most document and portfolio endpoints require Firebase-authenticated requests.

## Environment Variables

Do not commit real secrets. Keep all credentials in local `.env` files or your deployment platform.

### Frontend

Create a root `.env` with values for:

```bash
VITE_API_BASE_URL=http://localhost:5050
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### Backend

Create `server/.env` with the core backend configuration:

```bash
MONGODB_URI=...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
SEC_USER_AGENT=...
NEWS_API_URL=...
NEWS_API_KEY=...
MARKET_DATA_API_URL=...
MARKET_DATA_API_KEY=...
```

### Optional portfolio configuration

```bash
PORTFOLIO_CACHE_TTL_MS=3600000
PORTFOLIO_NEWS_LIMIT=10
REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS=
PORTFOLIO_MAX_SNIPPET_CHARS=
PORTFOLIO_MAX_EXTRACTED_CHARS=
PORTFOLIO_ROBOTS_CACHE_TTL_MS=
PORTFOLIO_ROBOTS_FAIL_CLOSED=true
PORTFOLIO_SOURCE_RATE_LIMIT_WINDOW_MS=
PORTFOLIO_SOURCE_RATE_LIMIT_MAX_REQUESTS=
PORTFOLIO_EVIDENCE_CHUNK_SIZE=
PORTFOLIO_EVIDENCE_CHUNK_OVERLAP=
PORTFOLIO_EVIDENCE_MAX_CHUNKS=
PORTFOLIO_EVIDENCE_RETRIEVE_LIMIT=
```

If Redis or Upstash is not configured, the portfolio pipeline falls back to an in-memory TTL cache.

## Local Development

### 1. Install dependencies

```bash
npm install
npm --prefix server install
```

### 2. Start the backend

```bash
npm --prefix server start
```

The Express server runs on `http://localhost:5050`.

### 3. Start the frontend

In a separate terminal:

```bash
npm run dev
```

The Vite app runs on its local dev server and should point to the backend through `VITE_API_BASE_URL`.

## Available Scripts

From the project root:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm test
```

From `server/`:

```bash
npm start
npm run setup:indexes
npm test
```

## Testing

The backend test suite covers key portfolio and compliance behavior, including:

- input validation
- scoring logic
- provider fallback behavior
- source compliance rules
- article extraction
- auth middleware behavior

Run tests with:

```bash
npm test
```

## Notes and Constraints

- The frontend runtime is Vite-based even though `src/app/` and `src/app/layout.tsx` exist.
- Stock analysis output includes an informational disclaimer and is not personalized financial advice.
- Some external provider integrations rely on environment configuration and may degrade to fallback behavior when keys are missing.
- MongoDB indexes may need to be created for production-scale use, especially for search, vector retrieval, and portfolio history queries.

## Suggested Demo Flow

1. Sign in with Google.
2. Upload a financial PDF.
3. Review the generated summary.
4. Ask follow-up questions in the main flow or conversation mode.
5. Play the answer with text-to-speech.
6. Generate a presentation.
7. Open Stock Analysis and analyze a public company such as `AAPL` or `MSFT`.

## License

No license is currently declared in the root project.
