const { sendToMake } = require('../../lib/webhookService');

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { campaignData, publishingOptions } = req.body || {};
  if (!campaignData) return res.status(400).json({ error: 'بيانات الحملة مطلوبة' });
  try {
    const result = await sendToMake(campaignData, publishingOptions || {});
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'فشل الإرسال' });
  }
}
