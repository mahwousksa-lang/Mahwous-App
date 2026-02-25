/**
 * Make.com Webhook Service
 * Sends structured campaign payload to Make.com automation
 */

const fetch = require('node-fetch');

async function sendToMake(campaignData, publishingOptions) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL not configured');

  const payload = {
    campaign_id: `mahwous_${Date.now()}`,
    timestamp: new Date().toISOString(),
    product: {
      name: campaignData.product.name,
      brand: campaignData.product.brand,
      price: campaignData.product.price,
      description: campaignData.product.description,
      store_url: campaignData.product.url,
      original_image_url: campaignData.product.imageUrl,
    },
    generated_content: {
      arabic_brand_story: campaignData.content.brand_story,
      arabic_voiceover: campaignData.content.brand_story,
      captions: {
        post_instagram: campaignData.content.captions.instagram,
        reels_tiktok: campaignData.content.captions.tiktok,
        x_twitter: campaignData.content.captions.twitter,
        facebook: campaignData.content.captions.facebook,
        linkedin: campaignData.content.captions.instagram,
        pinterest: campaignData.content.captions.pinterest,
        haraj: campaignData.content.captions.haraj,
        youtube_description: campaignData.content.captions.youtube,
      },
      video_prompt_hook: campaignData.content.video_hook_prompt,
      video_prompt_broll: campaignData.content.video_broll_prompt,
    },
    assets: {
      images: {
        story_9x16: campaignData.imageUrls.story_9x16,
        vertical_4x5: campaignData.imageUrls.vertical_4x5,
        square_1x1: campaignData.imageUrls.square_1x1,
        landscape_16x9: campaignData.imageUrls.landscape_16x9,
        pinterest_2x3: campaignData.imageUrls.pinterest_2x3,
      },
      video_url: campaignData.videoUrl || null,
    },
    publishing: {
      post_to_instagram: !!publishingOptions.instagram,
      post_to_facebook: !!publishingOptions.facebook,
      post_to_tiktok: !!publishingOptions.tiktok,
      post_to_linkedin: !!publishingOptions.linkedin,
      post_to_pinterest: !!publishingOptions.pinterest,
      post_to_youtube: !!publishingOptions.youtube,
      post_to_whatsapp: !!publishingOptions.whatsapp,
      post_to_snapchat: !!publishingOptions.snapchat,
      scheduled_time: publishingOptions.scheduledTime || new Date(Date.now() + 3600000).toISOString(),
    },
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 30000,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Make.com webhook failed: ${response.status} — ${errorText}`);
  }

  let responseData;
  try {
    responseData = await response.json();
  } catch {
    responseData = { status: 'accepted' };
  }

  return { success: true, payload, response: responseData };
}

module.exports = { sendToMake };
