# Sellexplain — Gemini Edition

Paste English text, select a word, phrase, or sentence, and get a contextual explanation in an overlay card.

## Features
- Word / phrase / sentence auto-detection
- Context-aware explanation
- Easy Hinglish
- IELTS-friendly alternative
- Gemini model selector
- Per-request and session token usage
- Five themes with saved preferences
- Server-side Gemini API key

## Gemini models
- `gemini-2.5-flash-lite` — fastest and budget-friendly
- `gemini-2.5-flash` — balanced default
- `gemini-2.5-pro` — strongest for complex text

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Set `GEMINI_API_KEY`
4. `npm run dev`

## Vercel
Set `GEMINI_API_KEY` in Project Settings → Environment Variables. Optional: set `GEMINI_MODEL=gemini-2.5-flash`.

Never commit `.env.local` or any real API key.
