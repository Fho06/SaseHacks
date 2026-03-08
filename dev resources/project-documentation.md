# FinVoice AI Repository Documentation

Generated: March 8, 2026
Repository root: `C:\Users\Owner\.vscode\projects\Hackathons\SASEHACKS26\SaseHacks`

## 1. Project Summary

FinVoice AI is a finance-document analysis application built around retrieval-augmented generation. Users authenticate with Google through Firebase, upload financial documents, ask questions about those documents, receive grounded answers from Gemini, and optionally listen to answers through ElevenLabs text to speech. The repository also includes AI-generated financial summaries and PowerPoint presentation generation based on document briefings.

The current codebase is split into:
- A Vite + React + TypeScript frontend in `src`
- An Express + MongoDB + Gemini backend in `server`
- Static assets in `public`
- Ad hoc development utilities and notes in `dev resources`

## 2. Main User Workflows

### Authentication

Users sign in with Google from the frontend. Firebase web auth runs in the browser, and the frontend sends the Firebase ID token to the Express API in the `Authorization` header. The backend verifies that token with Firebase Admin and attaches `userId` to the request context.

### Upload and indexing

Authenticated users upload documents through the `FileUpload` component. The backend:
- Accepts uploaded files with `multer`
- Extracts text from PDFs with `pdf-parse`
- Generates an AI financial summary with Gemini
- Chunks the extracted text
- Embeds each chunk with Gemini embeddings
- Stores chunks and metadata in MongoDB Atlas
- Stores document summaries in a separate summaries collection

### Grounded Q and A

Users ask questions from the landing page or conversation mode. The backend:
- Embeds the question
- Retrieves relevant chunks from Atlas Vector Search and Atlas Search text search
- Applies reciprocal rank fusion when hybrid retrieval is enabled
- Builds a context string from retrieved chunks only
- Sends that context to Gemini to produce a grounded answer
- Returns answer text plus chunk citations

### Conversation mode

The repository includes a recurring conversation UI where users can:
- Browse previously uploaded documents
- Select one file or all files as context
- Upload additional files from the same screen
- Continue asking follow-up questions
- Play assistant responses with text to speech

### Presentation generation

The frontend can request a slide deck from the backend using a financial briefing. The backend uses Gemini to generate slide content, optionally generates a shared background image, and exports a `.pptx` file through `pptxgenjs`.

## 3. Frontend Architecture

### Entry points

The Vite runtime entry point is `src/main.tsx`, which renders `src/App.tsx`. `src/App.tsx` wraps the app with:
- `AuthProvider`
- `ThemeProvider`
- `FinVoiceLanding` from `src/app/page.tsx`

### Major frontend modules

- `src/app/page.tsx`
  The landing page and the main upload / ask / summary workflow. It also toggles into conversation mode.

- `src/components/DocumentChatWorkspace.tsx`
  The recurring conversation interface. It supports document selection, upload, deletion, ask flow, citations, and per-message text to speech.

- `src/components/FileUpload.tsx`
  Upload queue, drag-and-drop input, upload submission, document deletion, and local session list display.

- `src/providers/AuthProvider.tsx`
  Browser-side Firebase auth state and Google sign-in / sign-out actions.

- `src/lib/firebase.ts`
  Firebase web SDK initialization from Vite environment variables.

- `src/lib/api-auth.ts`
  Builds the `Authorization: Bearer <token>` header from the current Firebase user.

- `src/components/PresentationGenerator.tsx`
  Generates and exports slide decks from a financial briefing payload.

### Theme and layout

The app uses `next-themes`, but the repository is running as a Vite app, not a Next.js app. The active runtime path is `src/main.tsx -> src/App.tsx -> src/app/page.tsx`. The file `src/app/layout.tsx` exists but is not the actual application shell used by Vite.

## 4. Backend Architecture

The backend lives in `server/server.js` and exposes the main API routes.

### Primary routes

- `POST /upload`
  Upload files, extract text, summarize, chunk, embed, and store.

- `GET /documents`
  Return documents grouped by `documentId` for the authenticated user.

- `DELETE /documents/:documentId`
  Delete chunks and summaries for a document owned by the authenticated user.

- `POST /ask`
  Perform RAG retrieval and grounded answer generation.

- `GET /summary/:documentId`
  Return a stored AI financial briefing.

- `POST /resummarize/:documentId`
  Rebuild the summary from stored chunks.

- `POST /speech` and `GET /speech`
  Convert text to speech via ElevenLabs.

- `POST /chat`
  Lightweight chat endpoint that currently calls `answerQuestion(question)` without authenticated scoping.

- Presentation routes under `/presentation`
  Generate AI slides and export `.pptx`.

### Key backend modules

- `server/rag.js`
  Retrieval and answer generation. Uses Gemini embeddings and Gemini answer generation, with vector search, text search, reciprocal rank fusion, and session fallback logic.

- `server/chunker.js`
  Responsible for splitting extracted document text into chunks for storage and retrieval.

- `server/embeddings.js`
  Creates embeddings for chunk text and query text using Gemini.

- `server/summarizer.js`
  Produces a JSON financial briefing from uploaded document text using `gemini-2.5-flash`.

- `server/tts.js`
  Uses ElevenLabs to generate speech audio from answer text.

- `server/auth.js`
  Verifies Firebase ID tokens through Firebase Admin and attaches `userId` to requests.

- `server/search-indexes.js`
  Defines collection and index constants.

- `server/scripts/setup-indexes.js`
  Creates MongoDB indexes for user, session, and document metadata plus search-related structures.

## 5. Data Model and Persistence

### MongoDB collections

- `chunks`
  Stores embedded document chunks and retrieval metadata.

- `summaries`
  Stores AI-generated financial briefings by `documentId` and `userId`.

### Chunk-level fields currently in use

- `userId`
- `sessionId`
- `documentId`
- `filename`
- `sourceType`
- `page`
- `chunkIndex`
- `text`
- `embedding`
- `embeddingModel`
- `createdAt`

### Summary-level fields currently in use

- `userId`
- `sessionId`
- `documentId`
- `filename`
- `summary`
- `createdAt`
- `updatedAt`

### Current ownership model

Documents are linked to both:
- The authenticated user account via `userId`
- A frontend-controlled session token via `sessionId`

The intended current behavior is:
- User identity persists across refreshes because Firebase auth remains active
- The page session token is ephemeral and resets on refresh
- Documents remain stored under the user account in MongoDB
- The "uploaded in this session" list only shows documents whose stored `sessionId` matches the current page session

## 6. AI and Retrieval Stack

### Gemini usage

The repository currently uses Gemini for:
- Chunk embeddings
- Query embeddings
- Q and A answer generation
- Financial summary generation
- Presentation slide generation
- Background generation support

The summary and answer code currently reference `gemini-2.5-flash`.

### Retrieval strategy

The RAG path in `server/rag.js` currently does the following:
- Build a filter from `userId`, `documentId`, and optionally `sessionId`
- Run vector search against MongoDB Atlas Vector Search
- Run keyword search against Atlas Search text index when hybrid mode is enabled
- Fuse results with reciprocal rank fusion
- Fall back to session-scoped recent chunks if retrieval is empty

### Text to speech

Speech generation is handled through ElevenLabs. If ElevenLabs fails in the frontend, the UI falls back to browser speech synthesis where implemented.

## 7. Environment Configuration

### Frontend environment variables

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Backend environment variables

- `MONGODB_URI`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Security note

The repository contains environment usage for live services. Documentation and planning should continue to treat secrets as external configuration and never commit actual credentials.

## 8. Run and Build Commands

### Frontend

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`

### Backend

From the `server` directory:
- `npm install`
- `npm start`
- `npm run setup:indexes`

## 9. Current Implementation Status

### Implemented capabilities

- Google sign-in through Firebase web auth
- Firebase token verification in Express
- Per-user document ownership in MongoDB
- Upload and delete flows
- PDF parsing
- Chunking and Gemini embeddings
- Atlas-backed retrieval
- Gemini answer generation with citations
- Conversation mode with document selection
- Text to speech support
- AI financial briefing generation
- Presentation slide and PowerPoint generation

### Important repository realities

- The runtime frontend is Vite, even though some `src/app` naming and a `next.config.mjs` file remain in the repo.
- `src/app/layout.tsx` is not the live application shell in the Vite runtime path.
- `src/App.tsx` currently sets `ThemeProvider` with `defaultTheme="dark"`, which conflicts with earlier efforts to make light mode the default.
- `FileUpload.tsx` currently accepts both PDF and TXT files, which does not fully match a PDF-only product direction.

## 10. Current Technical Debt and Known Issues

### Type and lint health

Current repository checks show:
- `npm run build` passes
- `npm run typecheck` fails
- `npm run lint` fails

Known typecheck errors include:
- `src/components/ui/sidebar.tsx`
  `VariantProps` must be imported as a type-only import.
- `src/components/ui/sonner.tsx`
  `ToasterProps` must be imported as a type-only import.

Known lint issues include:
- Explicit `any` usage in `src/components/ChatBox.tsx`
- Explicit `any` usage in `src/components/FileUpload.tsx`
- Explicit `any` usage in `src/components/PresentationGenerator.tsx`
- Multiple `react-refresh/only-export-components` violations in shared UI files
- `Math.random()` purity issue in `src/components/ui/sidebar.tsx`
- Effect-state warning and dependency warning in `src/providers/AuthProvider.tsx`

### Architectural inconsistencies to track

- The repo contains some Next-style structure inside a Vite app, which increases confusion for future developers.
- There is both a generic `POST /chat` path and a scoped `POST /ask` path. The former currently bypasses the authenticated scoping behavior used by the main app.
- Theme configuration is split across multiple files and does not yet have a single canonical source of truth.
- Build success is ahead of type and lint cleanliness, which is workable for a hackathon but not ideal for maintainability.

## 11. Recommended Next Planning Steps

- Consolidate the app structure around Vite conventions and remove unused Next-specific artifacts.
- Make theme default behavior consistent in a single runtime path.
- Enforce PDF-only upload if that remains the product requirement.
- Close the current lint and typecheck failures so CI can be trusted.
- Decide whether `POST /chat` should remain, be secured, or be removed in favor of `POST /ask`.
- Add stronger repository-level documentation in `README.md` so operational setup does not rely on source inspection.
- Add tests for the upload, retrieval, auth, and session-scoping flows.
- Formalize the data schema for financial documents if the expanded finance-document model remains in scope.

## 12. Planning Notes for Future Contributors

This repository already contains the core mechanics for a useful document copilot: authenticated uploads, per-user persistence, session scoping, retrieval, grounded answers, summaries, and voice. The main planning challenge is no longer feature feasibility. It is consolidation: reducing architectural drift, improving type and lint hygiene, and making the runtime behavior easier to reason about for future contributors.

From a planning perspective, the most valuable short-term work is:
- stabilize the runtime surface area
- reduce ambiguity between account-level and session-level document views
- clean up developer ergonomics
- tighten the documentation around setup, environment configuration, and expected flows

