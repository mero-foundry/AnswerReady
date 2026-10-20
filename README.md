# AnswerReady

AnswerReady audits how clearly AI search and chatbot-style buyers can understand a B2B SaaS website. It scans a public URL, scores the site across key buying signals, and produces a practical action plan for improving AI search visibility.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:8787`.

The Express server serves the app and scanner API from the same origin. The client is bundled with esbuild.

## Configuration

Use environment variables directly or copy `.env.example` for deployment.

```bash
OPENAI_API_KEY=... npm run dev
STRIPE_PAYMENT_LINK=https://buy.stripe.com/... npm run dev
```

- `OPENAI_API_KEY` enables AI-enriched summaries and actions. The app falls back to heuristic scoring without it.
- `OPENAI_MODEL` can override the default model.
- `PORT` controls the HTTP port. The default is `8787`.
- `STRIPE_PAYMENT_LINK` sends the unlock button to a live Stripe Payment Link.

## Checks

```bash
npm run ci
```

Or run individual checks:

```bash
npm run build
npm run lint
npm run test:e2e
npm audit --audit-level=moderate
```

## Production

```bash
npm run build
npm start
```

The Express server serves the built frontend from `dist` and exposes the scanner API.

## License

Licensed under the [MIT License](LICENSE).
