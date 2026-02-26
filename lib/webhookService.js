/**
 * lib/webhookService.js — Make.com Webhook
 */
const fetch = require('node-fetch');

async function sendToMake(campaignData, opts) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) throw new Error('MAKE_WEBHOOK_URL غير مُعيَّن في متغيرات البيئة');

  const payload = {
    campaign_id: `mahwous_${Date.now()}`,
    timestamp:   new Date().toISOString(),
    product: {
      name:               campaignData.product?.name        || '',
      brand:              campaignData.product?.brand       || '',
      price:              campaignData.product?.price       || '',
      description:        campaignData.product?.description || '',
      store_url:          campaignData.product?.url         || '',
      original_image_url: campaignData.product?.imageUrl   || '',
    },
    generated_content: {
      arabic_brand_story: campaignData.content?.brand_story || '',
      captions: {
        post_instagram:    campaignData.content?.captions?.instagram || '',
        reels_tiktok:      campaignData.content?.captions?.tiktok    || '',
        x_twitter:         campaignData.content?.captions?.twitter   || '',
        facebook:          campaignData.content?.captions?.facebook  || '',
        pinterest:         campaignData.content?.captions?.pinterest || '',
        haraj:             campaignData.content?.captions?.haraj     || '',
        youtube:           campaignData.content?.captions?.youtube   || '',
      },
      video_hook_prompt:  campaignData.content?.video_hook_prompt  || '',
      video_broll_prompt: campaignData.content?.video_broll_prompt || '',
    },
    assets: {
      images: {
        story_9x16:     campaignData.imageUrls?.story_9x16     || '',
        vertical_4x5:   campaignData.imageUrls?.vertical_4x5   || '',
        square_1x1:     campaignData.imageUrls?.square_1x1     || '',
        landscape_16x9: campaignData.imageUrls?.landscape_16x9 || '',
        pinterest_2x3:  campaignData.imageUrls?.pinterest_2x3  || '',
      },
    },
    publishing: {
      post_to_instagram: !!opts?.instagram,
      post_to_facebook:  !!opts?.facebook,
      post_to_tiktok:    !!opts?.tiktok,
      post_to_linkedin:  !!opts?.linkedin,
      post_to_pinterest: !!opts?.pinterest,
      post_to_youtube:   !!opts?.youtube,
      post_to_whatsapp:  !!opts?.whatsapp,
      scheduled_time:    opts?.scheduledTime || new Date(Date.now() + 3600000).toISOString(),
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 30000,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Make.com رفض الطلب (${r.status}): ${txt.slice(0, 200)}`);
  }

  let resp;
  try { resp = await r.json(); } catch { resp = { status: 'accepted' }; }
  return { success: true, payload, response: resp };
}

module.exports = { sendToMake };
