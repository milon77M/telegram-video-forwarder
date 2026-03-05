async function callTelegramAPI(token, method, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return res.json();
}

async function sendMessage(token, chatId, text) {
  return callTelegramAPI(token, "sendMessage", {
    chat_id: chatId,
    text: text
  });
}

function extractMessageIdFromLink(link) {
  const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
  return match ? parseInt(match[2]) : null;
}

function generateToken() {
  return crypto.randomUUID();
}

function createVideoPage(messageId, channelId, views) {
  const clean = channelId.toString().replace("-100", "");

  const embedUrl = `https://t.me/c/${clean}/${messageId}?embed=1`;

  return `
  <html>
  <head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Video</title>
  <style>
  body{font-family:Arial;text-align:center;background:#111;color:white;padding:20px}
  iframe{width:100%;max-width:700px;height:400px;border:none;border-radius:10px}
  </style>
  </head>

  <body>
  <h2>Video Player</h2>

  <iframe src="${embedUrl}" allowfullscreen></iframe>

  <p>Views: ${views}</p>

  </body>
  </html>
  `;
}

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    if (url.pathname === "/ping") {
      return new Response("OK");
    }

    // ===== TELEGRAM WEBHOOK =====
    if (url.pathname === "/webhook" && request.method === "POST") {

      const update = await request.json();

      if (!update.message) {
        return new Response("ok");
      }

      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      // ADMIN CHECK
      if (String(chatId) !== env.ADMIN_ID) {
        return new Response("ok");
      }

      if (text === "/start") {
        await sendMessage(env.BOT_TOKEN, chatId,
          "Send Telegram private channel video link.\nExample:\nhttps://t.me/c/123456/7"
        );
        return new Response("ok");
      }

      if (text.includes("t.me/")) {

        const messageId = extractMessageIdFromLink(text);

        if (!messageId) {
          await sendMessage(env.BOT_TOKEN, chatId, "Invalid link");
          return new Response("ok");
        }

        const token = generateToken();

        const data = {
          messageId,
          channelId: env.SOURCE_CHANNEL_ID,
          views: 0
        };

        await env.VIDEO_TOKENS.put(token, JSON.stringify(data));

        const link = `${env.SERVER_URL}/video/${token}`;

        await sendMessage(env.BOT_TOKEN, chatId,
          `Video link ready:\n${link}`
        );
      }

      return new Response("ok");
    }

    // ===== USER VIDEO PAGE =====
    if (url.pathname.startsWith("/video/")) {

      const token = url.pathname.split("/")[2];

      const data = await env.VIDEO_TOKENS.get(token);

      if (!data) {
        return new Response("Invalid link", { status: 404 });
      }

      const video = JSON.parse(data);

      video.views++;

      await env.VIDEO_TOKENS.put(token, JSON.stringify(video));

      const html = createVideoPage(
        video.messageId,
        video.channelId,
        video.views
      );

      return new Response(html, {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    return new Response("Running");
  }

};
