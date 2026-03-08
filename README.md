# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Portfolio Provider Configuration

The portfolio analysis backend uses provider abstractions with explicit primary + fallback behavior:

- Filings/facts primary: SEC EDGAR (`data.sec.gov`)
- News primary: GNews (`NEWS_API_URL` + `NEWS_API_KEY`)
- News fallback: Google News RSS
- Market primary: FMP (`MARKET_DATA_API_URL` + `MARKET_DATA_API_KEY`)
- Market fallback: Yahoo + Stooq price history + SEC-derived valuation ratios
- Cache primary: Redis (`REDIS_URL` or Upstash REST)
- Cache fallback: in-memory TTL cache (dev/hackathon fallback)

Required backend env vars:

- `SEC_USER_AGENT`
- `NEWS_API_URL`
- `NEWS_API_KEY`
- `MARKET_DATA_API_URL`
- `MARKET_DATA_API_KEY`
- `PORTFOLIO_CACHE_TTL_MS`
- `PORTFOLIO_NEWS_LIMIT`

Optional Redis env vars:

- `REDIS_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Additional compliance env vars:

- `PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS` (comma-separated licensed domains for full-text extraction)
- `PORTFOLIO_MAX_SNIPPET_CHARS` (max snippet chars stored/sent from news providers)
- `PORTFOLIO_MAX_EXTRACTED_CHARS` (max extracted full-text chars, licensed domains only)
- `PORTFOLIO_ROBOTS_CACHE_TTL_MS` (robots.txt cache TTL)
- `PORTFOLIO_ROBOTS_FAIL_CLOSED` (`true` recommended for compliance; snippet-only when robots unavailable)
- `PORTFOLIO_SOURCE_RATE_LIMIT_WINDOW_MS` (per-domain crawl window)
- `PORTFOLIO_SOURCE_RATE_LIMIT_MAX_REQUESTS` (max crawl requests per domain per window)
- `PORTFOLIO_EVIDENCE_CHUNK_SIZE` (chunk size for portfolio evidence RAG ingestion)
- `PORTFOLIO_EVIDENCE_CHUNK_OVERLAP` (chunk overlap for portfolio evidence RAG ingestion)
- `PORTFOLIO_EVIDENCE_MAX_CHUNKS` (max embedded chunks per ticker run)
- `PORTFOLIO_EVIDENCE_RETRIEVE_LIMIT` (retrieved evidence chunks sent to Gemini per run)

Behavior notes:

- In `production`, startup fails fast if `SEC_USER_AGENT` is missing.
- If provider keys are missing, the app logs explicit warnings and uses fallbacks.
- In-memory cache remains available for local/dev fallback.
- Full-text article extraction only occurs on licensed domains in `PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS`.
- Robots.txt is checked before article crawling; disallowed or unknown policy can force snippet-only mode.
- Per-domain extraction rate limits are enforced, with compliance audit events stored in `portfolioSourceAudits`.
- When live quote feeds are sparse, stock-value ratios are derived from SEC fundamentals + fallback price history to reduce false low valuations.
- Portfolio external evidence (news + SEC + market + peer valuation) is normalized, chunked, embedded, and stored in `chunks` with `sourceType=portfolio_evidence` for RAG retrieval in portfolio analysis.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

