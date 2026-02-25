# 🌟 Mahwous AI Campaign Director
### مدير حملات مهووس الذكي — Luxury Perfume Marketing Automation

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local
# Fill in your API keys in .env.local
npm run dev
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLOUD_PROJECT_ID` | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `MAKE_WEBHOOK_URL` | Make.com webhook URL |
| `NEXT_PUBLIC_APP_URL` | Your app URL (default: http://localhost:3000) |
| `REMOVE_BG_API_KEY` | (Optional) remove.bg API key for better BG removal |

## Pipeline

1. **Scrape** → Extract product name, price, description, image from URL
2. **Remove BG** → Local flood-fill algorithm (or remove.bg API)  
3. **Imagen 3** → Generate Mahwous character via Vertex AI (9:16 master)
4. **Composite** → Place transparent bottle at lower-center (Sharp)
5. **Crop** → Generate 5 platform sizes with attention-based smart crop
6. **Gemini** → Generate Arabic captions + brand story
7. **Publish** → POST structured JSON to Make.com webhook

## Character DNA (Strict Visual Protocol)
- 3D Pixar/Disney quality render
- Gulf Arab male, golden-brown skin
- **NO GLASSES EVER** — clear warm brown eyes
- Short dark groomed beard
- Outfit: 50% Black suit + gold tie / 50% White Thobe + Black Bisht
- Character stands WITHOUT holding anything (bottle is composited separately)
