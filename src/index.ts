import { Bot, webhookCallback } from "https://deno.land/x/grammy@v1.40.0/mod.ts"; // আমরা npm ডিপেন্ডেন্সি ইউজ করব, কিন্তু টাইপের জন্য এখানে রাখলাম

interface Env {
  BOT_TOKEN: string;
  ADMIN_ID: string;
  SOURCE_CHANNEL_ID: string;
  DB: D1Database;
  VIDEO_TOKENS: KVNamespace;
}

interface VideoToken {
  messageId: number;
  chatId: string;
  views: number;
  createdAt: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // হেলথ চেক এন্ডপয়েন্ট (cron-job.org-এর জন্য)
    if (url.pathname === '/ping') {
      return new Response('OK', { status: 200 });
    }
    
    // টোকেন জেনারেট করার এন্ডপয়েন্ট (আপনি কল করবেন)
    if (url.pathname === '/generate' && request.method === 'POST') {
      return await handleGenerateToken(request, env);
    }
    
    // টোকেন ভেরিফাই করে ভিডিও ফরওয়ার্ড করার এন্ডপয়েন্ট
    if (url.pathname.startsWith('/video/')) {
      const token = url.pathname.split('/')[2];
      return await handleVideoAccess(token, env);
    }
    
    return new Response('Not Found', { status: 404 });
  },
};

// টোকেন জেনারেট করার ফাংশন
async function handleGenerateToken(request: Request, env: Env): Promise<Response> {
  try {
    const { messageId, chatId } = await request.json();
    
    // চেক করি চ্যাট আইডি সঠিক কিনা
    if (chatId !== env.SOURCE_CHANNEL_ID) {
      return new Response(JSON.stringify({ error: 'Invalid chat ID' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ইউনিক টোকেন জেনারেট (UUID ভি৪ স্টাইল)
    const token = crypto.randomUUID();
    
    // টোকেন সংরক্ষণ করি
    const tokenData: VideoToken = {
      messageId,
      chatId,
      views: 0,
      createdAt: Date.now()
    };
    
    await env.VIDEO_TOKENS.put(token, JSON.stringify(tokenData));
    
    // ডাটাবেজেও সংরক্ষণ করি (ব্যাকআপ ও অ্যানালিটিক্সের জন্য)
    await env.DB.prepare(
      `INSERT INTO video_tokens (token, message_id, chat_id, views, created_at) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(token, messageId, chatId, 0, Date.now()).run();
    
    // রেসপন্সে টোকেন ও ভিডিও লিংক পাঠাই
    return new Response(JSON.stringify({ 
      success: true,
      token: token,
      videoUrl: `https://t.me/c/${chatId.toString().replace('-100', '')}/${messageId}`,
      directLink: `${env.SERVER_URL}/video/${token}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ভিডিও অ্যাক্সেস ও ফরওয়ার্ড করার ফাংশন
async function handleVideoAccess(token: string, env: Env): Promise<Response> {
  try {
    // টোকেন থেকে ডাটা রিড করি
    const tokenData = await env.VIDEO_TOKENS.get(token);
    
    if (!tokenData) {
      return new Response('Invalid or expired token', { status: 404 });
    }
    
    const videoInfo: VideoToken = JSON.parse(tokenData);
    
    // ভিউ আপডেট করি
    videoInfo.views += 1;
    await env.VIDEO_TOKENS.put(token, JSON.stringify(videoInfo));
    
    // ডাটাবেজেও ভিউ আপডেট করি
    await env.DB.prepare(
      `UPDATE video_tokens SET views = views + 1 WHERE token = ?`
    ).bind(token).run();
    
    // ইউজারকে রিডাইরেক্ট করি টেলিগ্রাম মেসেজে
    // ফরম্যাট: https://t.me/c/CHANNEL_ID/MESSAGE_ID
    const telegramUrl = `https://t.me/c/${videoInfo.chatId.toString().replace('-100', '')}/${videoInfo.messageId}`;
    
    // HTML পেজ দেখাই (সরাসরি ভিডিও দেখানোর জন্য)
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Player</title>
        <style>
          body { margin: 0; padding: 20px; background: #000; color: #fff; font-family: Arial; text-align: center; }
          .container { max-width: 800px; margin: 0 auto; }
          .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 20px 0; }
          .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
          .views { color: #888; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Video Player</h2>
          <div class="video-container">
            <iframe src="https://t.me/${videoInfo.chatId}/${videoInfo.messageId}?embed=1" allowfullscreen></iframe>
          </div>
          <div class="views">👁️ Views: ${videoInfo.views}</div>
          <p><a href="${telegramUrl}" target="_blank" style="color: #888;">Open in Telegram</a></p>
        </div>
      </body>
      </html>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    return new Response('Error processing video', { status: 500 });
  }
                                     }
