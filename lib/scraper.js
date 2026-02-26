/**
 * lib/scraper.js — Product URL scraper
 * Tries JSON-LD → OpenGraph → Generic CSS selectors
 */
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeProduct(url) {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  });

  const $ = cheerio.load(data);
  const product =
    extractJsonLd($) ||
    extractOpenGraph($, url) ||
    extractGeneric($, url);

  if (!product || !product.name) throw new Error('تعذّر استخراج بيانات المنتج من هذا الرابط');

  return {
    name:        clean(product.name)        || 'Unknown Product',
    price:       clean(product.price)       || 'السعر غير متوفر',
    description: clean(product.description) || '',
    imageUrl:    resolveUrl(product.imageUrl, url) || null,
    brand:       clean(product.brand)       || siteName(url),
    url,
  };
}

function extractJsonLd($) {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const raw = JSON.parse($(el).html());
      const items = Array.isArray(raw) ? raw : [raw];
      const p = items.find(i => i['@type'] === 'Product');
      if (!p) continue;
      const offers = Array.isArray(p.offers) ? p.offers[0] : (p.offers || {});
      return {
        name:        p.name,
        price:       offers.price ? `${offers.priceCurrency || 'SAR'} ${offers.price}` : null,
        description: p.description,
        imageUrl:    typeof p.image === 'string' ? p.image : (Array.isArray(p.image) ? p.image[0] : p.image?.url),
        brand:       p.brand?.name || p.brand,
      };
    } catch {}
  }
  return null;
}

function extractOpenGraph($, url) {
  const price = $('meta[property="product:price:amount"]').attr('content');
  return {
    name:        $('meta[property="og:title"]').attr('content') || $('title').text(),
    price:       price ? `${$('meta[property="product:price:currency"]').attr('content') || 'SAR'} ${price}` : null,
    description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content'),
    imageUrl:    $('meta[property="og:image"]').attr('content'),
    brand:       $('meta[property="og:site_name"]').attr('content'),
  };
}

function extractGeneric($, url) {
  const t = (sels) => { for (const s of sels) { const v = $(s).first().text().trim(); if (v) return v; } return null; };
  const a = (sels, attr) => { for (const s of sels) { const v = $(s).first().attr(attr); if (v) return v; } return null; };
  return {
    name:     t(['h1.product-title','h1.product_title','h1[itemprop="name"]','#productTitle','h1']),
    price:    t(['[itemprop="price"]','.woocommerce-Price-amount','.product-price','.price .amount','.price']),
    description: t(['[itemprop="description"]','.product-description','.woocommerce-product-details__short-description']),
    imageUrl: a(['[itemprop="image"]','.woocommerce-product-gallery__image img','.product__image img'], 'src'),
  };
}

function clean(s) { return s ? String(s).replace(/\s+/g, ' ').trim().slice(0, 500) : ''; }
function siteName(url) { try { return new URL(url).hostname.replace('www.','').split('.')[0].replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); } catch { return 'Mahwous'; } }
function resolveUrl(src, base) {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  try { const u = new URL(base); return `${u.protocol}//${u.host}${src.startsWith('/') ? '' : '/'}${src}`; } catch { return src; }
}

module.exports = { scrapeProduct };
