import { Bot, webhookCallback } from "https://deno.land/x/grammy@v1.40.0/mod.ts";

interface Env {
  BOT_TOKEN: string;
  ADMIN_ID: string;
  SOURCE_CHANNEL_ID: string;
  DB: D1Database;
  VIDEO_TOKENS: KVNamespace;
  SERVER_URL?: string;
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
    const method = request.method;

    // হেলথ চেক এন্ডপয়েন্ট (cron-job.org-এর জন্য)
    if (url.pathname === '/ping') {
      return new Response('OK', { status: 200 });
    }

    // ===== টেলিগ্রাম ওয়েবহুক এন্ডপয়েন্ট (সবচেয়ে গুরুত্বপূর্ণ) =====
    if (url.pathname === '/webhook' && method === 'POST') {
      try {
        // বট ইনিশিয়ালাইজ করি
        const bot = new Bot(env.BOT_TOKEN);

        // /start কমান্ড হ্যান্ডলার
        bot.command('start', async (ctx) => {
          await ctx.reply(
            '👋 স্বাগতম! আমি আপনার ভিডিও ফরওয়ার্ড বট।\n\n' +
            '📹 আপনি আমাকে টেলিগ্রাম চ্যানেলের ভিডিও লিংক পাঠালে আমি একটি ইউনিক লিংক তৈরি করব।\n\n' +
            '➡️ সেই লিংক ইউজারকে দিলে তারা শুধু ভিডিও দেখতে পারবে, চ্যানেলে যেতে পারবে না।\n\n' +
            '🔗 এখন একটি ভিডিও লিংক পাঠান (যেমন: https://t.me/c/123456/7)'
          );
        });

        // ভিডিও লিংক হ্যান্ডলার (যেকোনো টেক্সট মেসেজ)
        bot.on('message:text', async (ctx) => {
          const text = ctx.message.text;
          
          // চেক করি এটা ভিডিও লিংক কিনা
          if (text.includes('t.me/')) {
            await ctx.reply('⏳ ভিডিও প্রসেস করা হচ্ছে... দয়া করে অপেক্ষা করুন।');

            // ভিডিও লিংক থেকে মেসেজ আইডি ও চ্যানেল আইডি বের করি
            const messageId = extractMessageIdFromLink(text);
            const chatId = env.SOURCE_CHANNEL_ID;

            if (!messageId) {
              await ctx.reply('❌ ভুল লিংক ফরম্যাট। সঠিক টেলিগ্রাম ভিডিও লিংক দিন।');
              return;
            }

            // টোকেন জেনারেট করি
            const token = crypto.randomUUID();
            
            // টোকেন ডাটা সংরক্ষণ
            const tokenData: VideoToken = {
              messageId,
              chatId,
              views: 0,
              createdAt: Date.now()
            };

            try {
              // KV-তে সংরক্ষণ
              await env.VIDEO_TOKENS.put(token, JSON.stringify(tokenData));

              // D1 ডাটাবেজে সংরক্ষণ
              await env.DB.prepare(
                `INSERT INTO video_tokens (token, message_id, chat_id, views, created_at) 
                 VALUES (?, ?, ?, ?, ?)`
              ).bind(token, messageId, chatId, 0, Date.now()).run();

              // সার্ভার URL বের করি (রিকোয়েস্ট থেকে)
              const serverUrl = env.SERVER_URL || `${url.protocol}//${url.host}`;
              const videoUrl = `https://t.me/c/${chatId.toString().replace('-100', '')}/${messageId}`;
              const directLink = `${serverUrl}/video/${token}`;

              // ইউজারকে রেসপন্স দিই
              await ctx.reply(
                '✅ ভিডিও প্রসেস করা হয়েছে!\n\n' +
                `🔗 ভিডিও লিংক: ${videoUrl}\n\n` +
                `🎯 ইউজারকে দিন এই লিংক: ${directLink}\n\n` +
                '⚠️ এই লিংক ইউজার খুললে শুধু ভিডিও দেখতে পাবে, চ্যানেল দেখতে পাবে না।'
              );

            } catch (error) {
              console.error('Error saving token:', error);
              await ctx.reply('❌ ভিডিও প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
            }

          } else {
            // ভিডিও লিংক না হলে হেল্প মেসেজ
            await ctx.reply(
              '❌ আমি শুধু টেলিগ্রাম ভিডিও লিংক বুঝি।\n\n' +
              'একটি ভিডিও লিংক দিন (যেমন: https://t.me/c/123456/7) অথবা /start দেখুন।'
            );
          }
        });

        // অন্যান্য মেসেজ হ্যান্ডলার (ফটো, ভিডিও, ডকুমেন্ট ইত্যাদি)
        bot.on('message', async (ctx) => {
          await ctx.reply('📹 আমি শুধু টেক্সট লিংক বুঝি। দয়া করে একটি ভিডিও লিংক পাঠান।');
        });

        // এরর হ্যান্ডলার
        bot.catch((err) => {
          console.error('Bot error:', err);
        });

        // ওয়েবহুক কলব্যাক প্রসেস করি
        const callback = webhookCallback(bot, 'cloudflare');
        return await callback(request);

      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Webhook error', { status: 500 });
      }
    }

    // টোকেন জেনারেট করার এন্ডপয়েন্ট (API কলের জন্য)
    if (url.pathname === '/generate' && method === 'POST') {
      return await handleGenerateToken(request, env);
    }

    // টোকেন ভেরিফাই করে ভিডিও দেখানোর এন্ডপয়েন্ট
    if (url.pathname.startsWith('/video/')) {
      const token = url.pathname.split('/')[2];
      return await handleVideoAccess(token, env, url);
    }

    return new Response('Not Found', { status: 404 });
  },
};

// টোকেন জেনারেট করার ফাংশন
async function handleGenerateToken(request: Request, env: Env): Promise<Response> {
  try {
    const { messageId, chatId } = await request.json();

    if (chatId !== env.SOURCE_CHANNEL_ID) {
      return new Response(JSON.stringify({ error: 'Invalid chat ID' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = crypto.randomUUID();
    const tokenData: VideoToken = {
      messageId,
      chatId,
      views: 0,
      createdAt: Date.now()
    };

    await env.VIDEO_TOKENS.put(token, JSON.stringify(tokenData));
    await env.DB.prepare(
      `INSERT INTO video_tokens (token, message_id, chat_id, views, created_at) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(token, messageId, chatId, 0, Date.now()).run();

    const url = new URL(request.url);
    const serverUrl = `${url.protocol}//${url.host}`;

    return new Response(JSON.stringify({
      success: true,
      token: token,
      videoUrl: `https://t.me/c/${chatId.toString().replace('-100', '')}/${messageId}`,
      directLink: `${serverUrl}/video/${token}`
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
async function handleVideoAccess(token: string, env: Env, url: URL): Promise<Response> {
  try {
    const tokenData = await env.VIDEO_TOKENS.get(token);

    if (!tokenData) {
      return new Response('Invalid or expired token', { status: 404 });
    }

    const videoInfo: VideoToken = JSON.parse(tokenData);

    // ভিউ আপডেট
    videoInfo.views += 1;
    await env.VIDEO_TOKENS.put(token, JSON.stringify(videoInfo));
    await env.DB.prepare(
      `UPDATE video_tokens SET views = views + 1 WHERE token = ?`
    ).bind(token).run();

    const telegramUrl = `https://t.me/c/${videoInfo.chatId.toString().replace('-100', '')}/${videoInfo.messageId}`;
    const embedUrl = `https://t.me/${videoInfo.chatId}/${videoInfo.messageId}?embed=1`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Player</title>
        <style>
          body { margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial; color: #fff; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: #333; }
          .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 20px 0; border-radius: 12px; }
          .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
          .views { background: #f3f4f6; padding: 15px; border-radius: 10px; text-align: center; margin: 20px 0; }
          .views span { font-weight: bold; color: #667eea; font-size: 24px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; transition: transform 0.3s; border: none; cursor: pointer; width: 100%; text-align: center; box-sizing: border-box; }
          .button:hover { transform: translateY(-2px); }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="text-align: center; color: #333;">🎬 ভিডিও প্লেয়ার</h2>
          <div class="video-container">
            <iframe src="${embedUrl}" allowfullscreen></iframe>
          </div>
          <div class="views">
            👁️ মোট দেখা হয়েছে: <span>${videoInfo.views}</span>
          </div>
          <a href="${telegramUrl}" target="_blank" class="button">📱 টেলিগ্রামে খুলুন</a>
          <div class="footer">
            ⚠️ এই লিংক শুধু নির্দিষ্ট ভিডিওর জন্য
          </div>
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

// হেল্পার ফাংশন: টেলিগ্রাম লিংক থেকে মেসেজ আইডি বের করা
function extractMessageIdFromLink(link: string): number | null {
  try {
    // প্যাটার্ন: t.me/c/CHANNEL_ID/MESSAGE_ID
    const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
    if (match && match[2]) {
      return parseInt(match[2], 10);
    }
    return null;
  } catch {
    return null;
  }
}
