# FinVoice AI - Technical Documentation

Generated: March 8, 2026  
Repository root: `C:\Users\Owner\.vscode\projects\Hackathons\SASEHACKS26\SaseHacks`

## 1. Project Overview

FinVoice AI is a finance-document intelligence application. It lets authenticated users upload documents, indexes them into MongoDB Atlas with embeddings, answers natural-language questions using retrieval-augmented generation (RAG), generates structured financial briefings, and supports text-to-speech playback.

Primary stack:
- Frontend: Vite + React + TypeScript + Tailwind (with shadcn/ui primitives)
- Backend: Express (Node.js, ESM)
- Database: MongoDB Atlas (`ragDB`)
- AI: Google Gemini (embeddings + generation)
- Auth: Firebase Google sign-in (frontend SDK + backend token verification)
- Voice: ElevenLabs API with browser speech fallback
- Output generation: PowerPoint export via `pptxgenjs`

Core goals:
- Ground answers in uploaded evidence
- Keep user data scoped to authenticated owners
- Provide source visibility (chunk-level citations)
- Support recurring Q&A over previously uploaded files

---

## 2. Runtime Architecture

```text
Browser (React/Vite)
  -> Firebase Web Auth (Google Sign-In)
  -> Express API (Authorization: Bearer <Firebase ID Token>)
      -> Firebase Admin verifyIdToken
      -> MongoDB Atlas (chunks + summaries)
      -> Gemini API (embeddings, answers, summaries, slide JSON, backgrounds)
      -> ElevenLabs API (TTS audio)
```

Major runtime paths:
- Frontend entry: `src/main.tsx` -> `src/App.tsx` -> `src/app/page.tsx`
- Backend entry: `server/server.js` (port `5050`)

Important repository note:
- The app has some Next-style folders/files (`src/app/*`, `next.config.mjs`), but active runtime is Vite React, not Next server routing.

---

## 3. Repository Structure (Key Areas)

### Frontend
- `src/app/page.tsx`: main landing page, upload/ask UI, summary display, conversation mode toggle
- `src/components/FileUpload.tsx`: drag/drop queue, upload submit, delete document
- `src/components/DocumentChatWorkspace.tsx`: recurring conversation mode with per-file/all-files scope
- `src/components/LoginButton.tsx`: Google sign-in/out control
- `src/providers/AuthProvider.tsx`: auth state context + Firebase auth actions
- `src/lib/firebase.ts`: Firebase SDK initialization from `VITE_FIREBASE_*`
- `src/lib/api-auth.ts`: builds `Authorization` header with Firebase ID token
- `src/components/PresentationGenerator.tsx`: front-end slide generation/export UX
- `src/app/globals.css`: design tokens, light/dark theme palette, utility styles

### Backend
- `server/server.js`: Express app + API routes
- `server/auth.js`: Firebase Admin verification middleware
- `server/mongodb.js`: Atlas connection + `db` export
- `server/chunker.js`: chunking strategy
- `server/embeddings.js`: Gemini embedding calls
- `server/rag.js`: retrieval + answer generation (vector/text hybrid)
- `server/summarizer.js`: AI financial briefing generation
- `server/tts.js`: ElevenLabs speech generation
- `server/presentation-routes.js`: presentation API routes
- `server/presentation-ai.js`: Gemini slide JSON generation
- `server/background-generator.js`: Gemini SVG background generation
- `server/ppt-generator.js`: PowerPoint binary generation
- `server/scripts/setup-indexes.js`: Atlas Search + Mongo index setup

---

## 4. Main Features and How They Work

## 4.1 Google Authentication

### Frontend flow
1. `AuthProvider` initializes Firebase auth (if all `VITE_FIREBASE_*` values are valid).
2. User clicks `Sign in with Google` in `LoginButton`.
3. `signInWithPopup` returns a signed-in Firebase user.
4. API calls use `getAuthHeader()` to fetch the current ID token and send:
   - `Authorization: Bearer <id_token>`

### Backend flow
1. Protected routes call `verifyFirebaseAuth` middleware.
2. Middleware verifies token via Firebase Admin SDK.
3. Request gets `req.auth = { userId, email }`.
4. Routes scope data access by `userId`.

Why this matters:
- User identity is cryptographically verified server-side.
- Document ownership and retrieval are tied to Firebase UID, not just frontend state.

---

## 4.2 Document Upload, Parsing, Chunking, Embedding, Storage

Route: `POST /upload` (authenticated)

Pipeline per uploaded file:
1. Assign `documentId = randomUUID()`.
2. Parse content:
   - `text/plain`: direct UTF-8 decode
   - others (expected PDFs): `pdf-parse`
3. Generate summary with Gemini (`generateFinancialSummary`).
4. Split extracted text with `chunkText(text, size=1800, overlap=200)`.
5. Embed each chunk with `gemini-embedding-001`.
6. Insert chunk documents into `chunks` collection.
7. Insert summary into `summaries` collection.
8. Return upload metadata (`documentId`, chunk count, summary).

Stored chunk fields include:
- `userId`, `sessionId`, `documentId`, `filename`, `sourceType`
- `chunkIndex`, `text`, `embedding`, `embeddingModel`, `createdAt`

Complex behavior:
- Upload accepts a frontend-provided `sessionId`; if absent server creates one.
- Ownership is account-level (`userId`) while UI list can be session-scoped.

---

## 4.3 Retrieval-Augmented Question Answering (RAG)

Route: `POST /ask` (authenticated)

Inputs:
- `question` (required)
- optional `documentId` scope
- optional `sessionId` scope
- `hybrid` (default true)
- `limit` (clamped 1..10)

RAG internals in `server/rag.js`:
1. Embed question with Gemini.
2. Build retrieval filter from `{ userId, documentId, sessionId }`.
3. Run Atlas Vector Search (`$vectorSearch`) over `embedding`.
4. Optionally run Atlas Search text query (`$search`) over `text`, `filename`, `sourceType`.
5. Fuse vector + text rankings with Reciprocal Rank Fusion (RRF).
6. If no results, fallback to recent chunks in scope (`runSessionFallback`).
7. Build prompt context from retrieved chunks only.
8. Generate final answer with `gemini-2.5-flash`.
9. Return plain answer + citation objects.

Important grounding properties:
- Normal Q&A never sends full raw PDF binary to Gemini.
- It sends retrieved chunk text only.
- Citations preserve `documentId`, `filename`, `chunkIndex` so UI can expose evidence.

---

## 4.4 Recurring Conversation Mode

Component: `src/components/DocumentChatWorkspace.tsx`

Behavior:
- Opens from main page via `Conversation Mode` button.
- Left sidebar allows:
  - upload more files
  - select a specific file scope
  - select `All files context`
  - delete uploaded documents
- Chat panel stores message history in component state.
- Follow-up prompts are context-enriched by including recent turns (`buildContextualQuestion`), then sent to `/ask`.
- Responses include optional citations in collapsible source section.

Scoping model:
- If one file selected, `documentId` sent to backend.
- If all files selected, no `documentId` filter sent.
- Authentication still required; backend restricts by `userId`.

---

## 4.5 AI Financial Briefing (Summary)

Generator: `server/summarizer.js`

Usage points:
- During upload, summary is generated and stored.
- User can trigger `POST /resummarize/:documentId` to regenerate from stored chunks.
- Frontend displays briefing sections:
  - title
  - summary
  - key metrics
  - major risks
  - management tone
  - red flags

Implementation details:
- Raw text is truncated to first 25,000 chars before summarization.
- Gemini is instructed to return strict JSON.
- If JSON parse fails, backend returns a safe fallback summary object.

---

## 4.6 Text-to-Speech (TTS)

Routes:
- `POST /speech`
- `GET /speech?text=...`

Backend behavior:
- Validates non-empty text and max length (`<= 8000` chars).
- Calls ElevenLabs (`eleven_multilingual_v2`) using `ELEVENLABS_API_KEY` and optional `ELEVENLABS_VOICE_ID`.
- Streams/concatenates audio and returns `audio/mpeg`.

Frontend behavior:
- TTS is opt-in (`off` by default in current UI state).
- If ElevenLabs fails, fallback to browser `speechSynthesis` when available.
- Landing page shortcuts:
  - `Alt+M`: toggle TTS
  - `Alt+P`: play/stop latest answer
  - `Esc`: stop playback

---

## 4.7 AI Presentation Generation and Export

Routes under `/presentation`:
- `POST /presentation/generate-presentation`
- `POST /presentation/export-presentation`

Flow:
1. Frontend sends financial briefing + optional instructions.
2. `presentation-ai.js` asks Gemini for strict slide deck JSON.
3. Optional background SVG is generated by Gemini (`background-generator.js`).
4. `ppt-generator.js` renders slides with `pptxgenjs` (title, bullets, metric, two-column, chart, insight layouts).
5. Export endpoint returns `.pptx` binary.

Design choices:
- Keeps generation deterministic at schema level (JSON contract).
- Allows iterative edit mode by passing existing slides back into model.

---

## 5. API Surface

## 5.1 Core Endpoints

- `GET /`
  - health response `{ status: "server running" }`

- `POST /upload` (auth)
  - multipart field: `files`
  - form fields: `sessionId?`, `sourceType?`
  - returns indexed file metadata and chunk counts

- `GET /documents` (auth)
  - returns user-owned docs grouped by `documentId`, with summaries when available

- `DELETE /documents/:documentId` (auth)
  - optional body `{ sessionId }`
  - deletes chunks + summaries for matching owned document

- `POST /ask` (auth)
  - body: `{ question, documentId?, sessionId?, hybrid?, limit? }`
  - returns `{ answer, sources[] }`

- `GET /summary/:documentId` (auth)
  - returns summary object

- `POST /resummarize/:documentId` (auth)
  - regenerates summary from stored chunks

- `POST /speech`
  - body: `{ text }`
  - returns `audio/mpeg`

- `GET /speech?text=...`
  - returns `audio/mpeg`

- `POST /chat` (not auth-protected currently)
  - legacy lightweight wrapper over `answerQuestion(question)`

- `POST /presentation/generate-presentation`
- `POST /presentation/export-presentation`

## 5.2 Auth Header Contract

For authenticated routes:
```http
Authorization: Bearer <firebase_id_token>
```

If missing/invalid:
- `401 Missing auth token` or `401 Invalid auth token`

If Firebase Admin not configured:
- `500 Firebase Admin is not configured...`

---

## 6. Data Model

Database: `ragDB`

Collections:
- `chunks`
- `summaries`

### `chunks` document (logical schema)
```json
{
  "userId": "firebase_uid",
  "sessionId": "uuid",
  "documentId": "uuid",
  "filename": "sample.pdf",
  "sourceType": "user_upload",
  "page": null,
  "chunkIndex": 0,
  "text": "...",
  "embedding": [0.01, -0.02, ...],
  "embeddingModel": "gemini-embedding-001",
  "createdAt": "2026-03-08T..."
}
```

### `summaries` document (logical schema)
```json
{
  "userId": "firebase_uid",
  "sessionId": "uuid",
  "documentId": "uuid",
  "filename": "sample.pdf",
  "summary": {
    "title": "AI Financial Briefing",
    "summary": "...",
    "keyMetrics": [],
    "majorRisks": [],
    "managementTone": "",
    "redFlags": []
  },
  "createdAt": "2026-03-08T...",
  "updatedAt": "2026-03-08T..."
}
```

Ownership and visibility model:
- Persistent ownership: `userId`
- Session-scoped UI grouping: `sessionId`
- Document identity for retrieval/delete/summaries: `documentId`

---

## 7. Search and Indexing Strategy

Constants in `server/search-indexes.js`:
- collection: `chunks`
- vector index: `vector_index`
- text index: `text_index`
- vector path: `embedding`

`server/scripts/setup-indexes.js` provisions:
- Atlas Vector Search index with filter fields:
  - `userId`, `sessionId`, `documentId`, `filename`, `sourceType`
- Atlas Search text index for:
  - `text`, `filename`, `sourceType`
- Mongo B-tree indexes for common ownership/time/document queries.

Why hybrid retrieval:
- Vector search captures semantic similarity.
- Text search captures exact symbol/key-term matches.
- RRF combines both to reduce single-method blind spots.

---

## 8. Frontend State and UX Mechanics

## 8.1 Main Landing Page (`page.tsx`)

Key state groups:
- Auth/user state from `AuthProvider`
- Session state (`sessionId`, in-session docs)
- Account document inventory (`allUserDocs`)
- Prompt/Q&A state (`promptInput`, `askResponse`, errors, loading)
- Summary state (`summary`, resummarize flow)
- TTS state (`ttsEnabled`, `ttsLoading`, speaking state)
- Mode toggle (`conversationMode`)

Interaction pattern:
1. Load user docs after auth.
2. Filter docs by current ephemeral session for “Uploaded in this session”.
3. Ask questions scoped to current session.
4. Show Gemini answer above summary section.
5. Optional voice playback and citation disclosure.

## 8.2 Conversation Workspace

Core features:
- Document picker with all-files option
- Multi-turn chat
- Source breakdown per assistant response
- Per-message voice playback
- In-place upload and delete

---

## 9. Environment Configuration

## 9.1 Frontend (`.env` at repo root)

Required for auth:
- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional in many setups)

## 9.2 Backend (`server/.env`)

Core:
- `MONGODB_URI`
- `GEMINI_API_KEY`

TTS:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID` (optional)

Firebase Admin verification:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (newline-escaped in env)

Security requirement:
- Never commit real keys to source control.
- Rotate any previously exposed credentials.

---

## 10. Local Development Runbook

From repository root:
```bash
npm install
npm run dev
```

Backend in separate terminal:
```bash
cd server
npm install
npm run setup:indexes
npm start
```

Expected local URLs:
- Frontend: Vite default (`http://localhost:5173` unless changed)
- Backend: `http://localhost:5050`

Build check:
```bash
npm run build
```

Optional quality checks:
```bash
npm run typecheck
npm run lint
```

---

## 11. Complex Technical Details and Design Rationale

### 11.1 Account persistence vs session isolation
- Auth persists through Firebase login state.
- Session ID is lightweight client-generated context marker.
- This enables:
  - durable account-level storage
  - temporary “uploaded this session” UX filtering

### 11.2 Retrieval fallback behavior
If strict scoped retrieval returns no chunks, `rag.js` can:
- retry without server-side vector filter (then locally post-filter)
- fallback to recent chunks in scope
This prevents hard failures from index lag/misconfiguration and broad prompts.

### 11.3 Response sanitation
Frontend strips model artifacts from responses:
- chunk markers like `[1]`
- markdown emphasis symbols
- punctuation spacing issues
This improves readability while citations remain available in a dedicated panel.

### 11.4 Presentation generation reliability
Gemini output is constrained with a strict JSON schema request.
The server then validates parseability and slide array presence before rendering.

---

## 12. Known Limitations and Technical Debt

- `POST /chat` is not auth-scoped like `/ask`; treat as legacy path.
- File upload currently accepts PDF and TXT in frontend component; product policy may require PDF-only.
- Some repository artifacts are legacy/non-runtime (`src/app/layout.tsx`, `src/components/ChatBox.tsx`, `next.config.mjs`).
- Root README is still default Vite template; operational docs live in this file.
- No formal automated test suite is wired in root scripts; backend `test` script is placeholder.

---

## 13. Production Hardening Checklist

- Move all secrets into managed environment variables (no plaintext in repo).
- Add rate limiting and request-size limits on upload and ask endpoints.
- Enforce file-type and file-size constraints server-side.
- Add structured logs for upload, retrieval, and LLM latency/cost telemetry.
- Add request tracing IDs for cross-service debugging.
- Add integration tests for:
  - auth middleware
  - upload parse/chunk/embed pipeline
  - retrieval scoping by `userId` and `documentId`
  - summary regeneration
  - TTS fallback behavior
- Add CI gates for `build`, `typecheck`, `lint`.

---

## 14. Quick Troubleshooting

### Google sign-in fails in production
- Add deployed domain in Firebase Console:
  - Authentication -> Settings -> Authorized domains
- Verify all `VITE_FIREBASE_*` values are from same Firebase project.

### `Cannot POST /portfolio/analyze` style errors
- That route is not in current active backend tree; use existing documented routes.

### Upload succeeds but no answer found
- Ensure chunks exist for same `userId` and scope (`documentId`/`sessionId`).
- Verify vector/text indexes are set up (`npm run setup:indexes` in `server`).

### ElevenLabs 401
- Check `ELEVENLABS_API_KEY` and account access.
- UI should fallback to browser speech where available.

### Firebase Admin misconfigured
- Confirm `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `server/.env`.
- Ensure private key keeps escaped newlines (`\n`) in env string.

---

## 15. Feature Summary (Executive)

Implemented primary capabilities:
- Google-authenticated document ownership
- Upload -> parse -> chunk -> embed -> store pipeline
- Hybrid RAG retrieval with citations
- Recurring conversation mode with per-file scope
- AI financial briefing generation and regeneration
- Voice playback via ElevenLabs + browser fallback
- AI presentation generation and PowerPoint export

Net effect:
- FinVoice currently functions as an authenticated, citation-aware financial document copilot with voice and presentation extensions.
