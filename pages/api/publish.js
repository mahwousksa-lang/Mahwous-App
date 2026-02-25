/**
 * API Route: POST /api/publish
 * Sends campaign data to Make.com webhook
 */
const { sendToMake } = require('../../lib/webhookService');

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { campaignData, publishingOptions } = req.body;
  if (!campaignData) return res.status(400).json({ error: 'Campaign data is required' });

  try {
    const result = await sendToMake(campaignData, publishingOptions || {});
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Publish error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to publish to Make.com' });
  }
}
