/**
 * Product Scraper - Extracts product data from e-commerce URLs
 */
const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPER_CONFIG = {
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  },
};

async function scrapeProduct(url) {
  const response = await axios.get(url, SCRAPER_CONFIG);
  const $ = cheerio.load(response.data);

  let product = extractJsonLd($) || extractOpenGraph($, url) || extractGeneric($, url);

  if (!product || !product.name) throw new Error('Could not extract product data from this URL');

  return {
    name: cleanText(product.name) || 'Unknown Product',
    price: cleanText(product.price) || 'Price not available',
    description: cleanText(product.description) || '',
    imageUrl: resolveUrl(product.imageUrl, url),
    url,
    brand: cleanText(product.brand) || extractBrand(url),
  };
}

function extractJsonLd($) {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    try {
      const data = JSON.parse($(script).html());
      const items = Array.isArray(data) ? data : [data];
      const product = items.find((d) => d['@type'] === 'Product');
      if (product) {
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
        return {
          name: product.name,
          price: offers.price ? `${offers.priceCurrency || 'SAR'} ${offers.price}` : null,
          description: product.description,
          imageUrl: typeof product.image === 'string' ? product.image : product.image?.[0] || product.image?.url,
          brand: product.brand?.name || product.brand,
        };
      }
    } catch (e) {}
  }
  return null;
}

function extractOpenGraph($, url) {
  const priceAmount = $('meta[property="product:price:amount"]').attr('content');
  return {
    name: $('meta[property="og:title"]').attr('content') || $('title').text(),
    price: priceAmount ? `${$('meta[property="product:price:currency"]').attr('content') || 'SAR'} ${priceAmount}` : null,
    description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content'),
    imageUrl: $('meta[property="og:image"]').attr('content'),
    brand: $('meta[property="og:site_name"]').attr('content'),
  };
}

function extractGeneric($, url) {
  return {
    name: findFirst($, ['h1.product-title', 'h1.product_title', 'h1[itemprop="name"]', '#productTitle', 'h1'], 'text'),
    price: findFirst($, ['[itemprop="price"]', '.woocommerce-Price-amount', '.product-price', '.price'], 'text'),
    description: findFirst($, ['[itemprop="description"]', '.product-description', '.woocommerce-product-details__short-description', '.description'], 'text'),
    imageUrl: findFirst($, ['[itemprop="image"]', '.woocommerce-product-gallery__image img', '.product__image img', 'img.product-image'], 'src'),
  };
}

function findFirst($, selectors, attr) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const val = attr === 'text' ? el.text().trim() : el.attr(attr);
      if (val && val.trim()) return val.trim();
    }
  }
  return null;
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().substring(0, 500);
}

function resolveUrl(imageUrl, baseUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  try {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  } catch { return imageUrl; }
}

function extractBrand(url) {
  try {
    return new URL(url).hostname.replace('www.', '').split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch { return 'Mahwous'; }
}

module.exports = { scrapeProduct };
