/**
 * API Route: POST /api/scrape
 * Scrapes product data from a URL
 */
const { scrapeProduct } = require('../../lib/scraper');

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
  try {
    const product = await scrapeProduct(url);
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to scrape product' });
  }
}
