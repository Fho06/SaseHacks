# FinVoice AI - Project Highlights

Generated: March 8, 2026

## 1. What FinVoice AI Is

FinVoice AI is a financial document intelligence platform that helps users:
- Upload finance documents
- Ask natural-language questions grounded in those documents
- Receive citation-backed answers
- Generate structured financial briefings
- Listen to responses using text-to-speech
- Run stock analysis on public companies

It is designed as a research and due-diligence assistant, not personalized investment advice.

## 2. Value Proposition

FinVoice AI solves three common problems in financial research:
- Information overload: long filings and reports are hard to process quickly
- Trust gap in generic AI: users need evidence-backed outputs
- Slow analysis cycles: manual cross-referencing takes significant time

Core value:
- Faster analysis through AI-assisted summarization and Q&A
- Better trust through source citations and transparent retrieval context
- Better usability through conversational workflow and optional voice playback

## 3. Core Product Features and Logic

## 3.1 Authenticated Document Ingestion

Feature:
- Users sign in with Google and upload documents.

Main logic:
- Firebase Web Auth handles user sign-in on frontend.
- Frontend sends Firebase ID token in `Authorization: Bearer <token>`.
- Backend verifies token with Firebase Admin and binds requests to `userId`.
- Uploaded files are parsed, chunked, embedded, and persisted in MongoDB.

Why it matters:
- Each document is tied to account ownership (`userId`) and query scope.

## 3.2 RAG-Based Q&A (Document Intelligence)

Feature:
- Ask questions about uploaded files and receive grounded answers with citations.

Main logic:
1. User question is embedded with Gemini embeddings.
2. Backend retrieves relevant document chunks from MongoDB:
   - Atlas Vector Search (semantic relevance)
   - Atlas Search text query (keyword relevance)
3. Results are fused using reciprocal rank fusion.
4. Only retrieved evidence chunks are sent to Gemini for answer generation.
5. Answer and source references are returned to the UI.

Why it matters:
- Reduces hallucinations by constraining generation to retrieved evidence.
- Preserves explainability through chunk-level citations.

## 3.3 Recurring Conversation Mode

Feature:
- A chat workspace for iterative follow-up questions.

Main logic:
- User can select:
  - One specific document
  - All uploaded files as context
- Message history is used to resolve follow-up references.
- Each turn still calls scoped retrieval and grounded generation.
- Sources remain available per assistant message.

Why it matters:
- Supports deeper investigation without losing context.

## 3.4 AI Financial Briefing

Feature:
- Auto-generated structured summary for uploaded documents.

Main logic:
- Backend prompts Gemini to return JSON with:
  - Summary
  - Key metrics
  - Major risks
  - Management tone
  - Red flags
- Summary is stored in MongoDB and can be regenerated.

Why it matters:
- Converts long content into a fast executive snapshot.

## 3.5 Text-to-Speech (TTS)

Feature:
- Users can listen to generated answers.

Main logic:
- Primary speech generation via ElevenLabs API.
- Browser speech synthesis fallback when ElevenLabs fails.
- Per-message playback controls in chat and global playback controls on landing flow.

Why it matters:
- Improves accessibility and hands-free review.

## 3.6 Stock Analysis Module

Feature:
- Analyze a public company by ticker or name.

Main logic:
1. Resolve company/ticker.
2. Gather evidence:
   - News discovery + extraction
   - SEC filings and facts
   - Market data and valuation signals
   - Peer comparison
3. Send normalized evidence bundle to Gemini for structured analysis.
4. Compute final scoring deterministically in backend:
   - Growth
   - Financial Health
   - News Outlook
   - Stock Value
5. Return verdict, positives, risks, bottom line, and source list.

Why it matters:
- Produces consistent, explainable, multi-factor stock assessment output.

## 4. RAG and Gemini: How They Are Used

## 4.1 RAG Role

RAG is used to ground answers in stored evidence:
- Parse once
- Chunk once
- Embed once
- Retrieve relevant chunks at query time
- Generate answer from retrieved context only

This architecture improves factual reliability and traceability versus plain chat completion.

## 4.2 Gemini Role

Gemini is used for:
- Embeddings (`gemini-embedding-001`)
- Document Q&A generation (`gemini-2.5-flash`)
- Financial briefing generation (structured JSON output)
- Stock analysis reasoning over normalized evidence bundles
- Slide content and visual background generation for presentation workflows

Important design pattern:
- Keep scoring formulas and key business logic deterministic in backend code.
- Use Gemini for reasoning and language generation, not as the sole source of arithmetic logic.

## 5. Tech Stack

Frontend:
- Vite
- React
- TypeScript
- Tailwind CSS + shadcn/ui
- next-themes for theme handling
- Firebase Web SDK for Google auth

Backend:
- Node.js + Express
- MongoDB Atlas
- Firebase Admin SDK (token verification)
- Gemini API (`@google/genai`)
- ElevenLabs API
- Multer + pdf-parse for ingestion
- PptxGenJS (+ Sharp) for presentation export

Infrastructure/Operational:
- Environment-driven configuration for all external providers
- Atlas Search and Vector Search indexes
- Optional Redis/Upstash cache in portfolio pipeline with in-memory fallback

## 6. Data and Ownership Model

Main storage:
- `chunks`: document text chunks + embeddings + metadata
- `summaries`: AI-generated financial briefings

Portfolio/stock analysis storage:
- `portfolioAnalyses`
- `portfolioJobs`
- `companyProfiles`
- `companySnapshots`
- `newsArticles`

Ownership and scoping:
- Persistent account ownership by `userId`
- Session-level grouping via `sessionId` for UX behavior
- Document-specific scoping by `documentId`

## 7. Explainability and Trust Mechanisms

Trust controls already present:
- Authenticated data access by verified user identity
- Citation surfaces in Q&A responses
- Retrieval-first answer path (evidence before generation)
- Explicit disclaimer language for stock analysis outputs
- Structured output schemas for summary/analysis workflows

## 8. Noteworthy Implementation Patterns

- Hybrid retrieval strategy (semantic + keyword) to improve coverage.
- Fallback strategy across external providers to preserve resilience.
- Structured JSON prompting to stabilize downstream rendering.
- Frontend answer text cleanup for readability while preserving citations separately.
- Modular portfolio pipeline design (`server/portfolio/*`) for easier iteration.

## 9. Current Positioning

FinVoice AI is best described as:
- A citation-aware financial document copilot
- A practical RAG system with authenticated user scoping
- A multi-feature workflow combining ingestion, Q&A, summary, voice, and stock assessment

It is optimized for research productivity and explainability, not automated trading or personalized investment advice.
