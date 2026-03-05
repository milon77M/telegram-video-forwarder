// টেলিগ্রাম API কল করার জন্য হেল্পার ফাংশন
async function callTelegramAPI(token, method, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

// মেসেজ পাঠানোর ফাংশন
async function sendMessage(token, chatId, text) {
  return callTelegramAPI(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  });
}

// টেলিগ্রাম লিংক থেকে মেসেজ আইডি বের করার ফাংশন
function extractMessageIdFromLink(link) {
  const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
  return match ? parseInt(match[2], 10) : null;
}

// ইউনিক টোকেন জেনারেট
function generateToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// HTML পেজ তৈরি
function createVideoPage(messageId, chatId, views, serverUrl, token) {
  const cleanChatId = chatId.toString().replace('-100', '');
  const telegramUrl = `https://t.me/c/${cleanChatId}/${messageId}`;
  const embedUrl = `https://t.me/c/${cleanChatId}/${messageId}?embed=1`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Player</title>
  <style>
    body { margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; margin: 20px 0; }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 12px; }
    .views { background: #f3f4f6; padding: 15px; border-radius: 10px; text-align: center; margin: 20px 0; }
    .views span { font-weight: bold; color: #667eea; font-size: 24px; }
    .button { display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 50px; text-decoration: none; text-align: center; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="text-align: center;">🎬 Video Player</h2>
    <div class="video-container">
      <iframe src="${embedUrl}" allowfullscreen></iframe>
    </div>
    <div class="views">
      👁️ Views: <span>${views}</span>
    </div>
    <a href="${telegramUrl}" target="_blank" class="button">📱 Open in Telegram</a>
    <div class="footer">⚠️ This link is for this video only</div>
  </div>
</body>
</html>`;
}

// Cloudflare Worker মেইন হ্যান্ডলার
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // হেলথ চেক
    if (url.pathname === '/ping') {
      return new Response('OK', { status: 200 });
    }
    
    // ওয়েবহুক এন্ডপয়েন্ট
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        console.log('Update received:', JSON.stringify(update));
        
        // মেসেজ চেক
        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || '';
          
          // /start কমান্ড
          if (text === '/start') {
            await sendMessage(env.BOT_TOKEN, chatId,
              '👋 Welcome! Send me a Telegram video link.\n\n' +
              'Example: https://t.me/c/123456/7'
            );
            return new Response('OK');
          }
          
          // ভিডিও লিংক চেক
          if (text.includes('t.me/')) {
            await sendMessage(env.BOT_TOKEN, chatId, '⏳ Processing video...');
            
            const messageId = extractMessageIdFromLink(text);
            if (!messageId) {
              await sendMessage(env.BOT_TOKEN, chatId, '❌ Invalid link format');
              return new Response('OK');
            }
            
            // টোকেন জেনারেট
            const token = generateToken();
            const tokenData = {
              messageId,
              chatId: env.SOURCE_CHANNEL_ID,
              views: 0,
              createdAt: Date.now()
            };
            
            // KV-তে সেভ
            await env.VIDEO_TOKENS.put(token, JSON.stringify(tokenData));
            
            // D1-তে সেভ (যদি সম্ভব হয়)
            try {
              await env.DB.prepare(
                `INSERT INTO video_tokens (token, message_id, chat_id, views, created_at) 
                 VALUES (?, ?, ?, ?, ?)`
              ).bind(token, messageId, env.SOURCE_CHANNEL_ID, 0, Date.now()).run();
            } catch (dbErr) {
              console.error('DB error (non-critical):', dbErr);
            }
            
            const serverUrl = env.SERVER_URL || `${url.protocol}//${url.host}`;
            const directLink = `${serverUrl}/video/${token}`;
            
            await sendMessage(env.BOT_TOKEN, chatId,
              `✅ Video ready!\n\n` +
              `Share this link: ${directLink}\n\n` +
              `Users will only see this video, not your channel.`
            );
          } else {
            await sendMessage(env.BOT_TOKEN, chatId, '❌ Send a Telegram video link');
          }
        }
        return new Response('OK');
        
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
      }
    }
    
    // ভিডিও অ্যাক্সেস এন্ডপয়েন্ট
    if (url.pathname.startsWith('/video/')) {
      const token = url.pathname.split('/')[2];
      
      try {
        const tokenData = await env.VIDEO_TOKENS.get(token);
        if (!tokenData) {
          return new Response('Invalid token', { status: 404 });
        }
        
        const videoInfo = JSON.parse(tokenData);
        
        // ভিউ আপডেট
        videoInfo.views += 1;
        await env.VIDEO_TOKENS.put(token, JSON.stringify(videoInfo));
        
        try {
          await env.DB.prepare(
            `UPDATE video_tokens SET views = views + 1 WHERE token = ?`
          ).bind(token).run();
        } catch (dbErr) {
          console.error('DB update error:', dbErr);
        }
        
        const serverUrl = env.SERVER_URL || `${url.protocol}//${url.host}`;
        const html = createVideoPage(
          videoInfo.messageId,
          videoInfo.chatId,
          videoInfo.views,
          serverUrl,
          token
        );
        
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' }
        });
        
      } catch (error) {
        return new Response('Error', { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
