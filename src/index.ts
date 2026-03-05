async function tg(token, method, data) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  return res.json();
}

function extractMessageId(link) {
  const m = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
  return m ? Number(m[2]) : null;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 10);
}

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    // ===== USER CLICK LINK =====
    if (url.pathname.startsWith("/v/")) {

      const code = url.pathname.split("/v/")[1];

      const data = await env.VIDEO_KV.get(code);

      if (!data) {
        return new Response("Invalid link");
      }

      const info = JSON.parse(data);

      const startLink = `https://t.me/${env.BOT_USERNAME}?start=${code}`;

      return Response.redirect(startLink);
    }


    // ===== TELEGRAM WEBHOOK =====
    if (url.pathname === "/webhook" && request.method === "POST") {

      const update = await request.json();

      if (!update.message) return new Response("ok");

      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      // ===== /start command =====
      if (text.startsWith("/start")) {

        const parts = text.split(" ");

        if (parts.length === 1) {

          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
`👋 Welcome!

Send me a private channel video link.

Example:
https://t.me/c/123456/7`
          });

          return new Response("ok");
        }

        const code = parts[1];

        const data = await env.VIDEO_KV.get(code);

        if (!data) {

          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "❌ Link expired"
          });

          return new Response("ok");
        }

        const info = JSON.parse(data);

        await tg(env.BOT_TOKEN, "forwardMessage", {
          chat_id: chatId,
          from_chat_id: env.SOURCE_CHANNEL_ID,
          message_id: info.message_id
        });

        return new Response("ok");
      }


      // ===== ADMIN SEND VIDEO LINK =====
      if (String(chatId) === env.ADMIN_ID) {

        if (text.includes("t.me/")) {

          const messageId = extractMessageId(text);

          if (!messageId) {

            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: "❌ Invalid link"
            });

            return new Response("ok");
          }

          const code = generateCode();

          await env.VIDEO_KV.put(
            code,
            JSON.stringify({
              message_id: messageId
            })
          );

          const link = `${url.origin}/v/${code}`;

          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
`✅ Link generated

${link}

Share this link with users`
          });

        }

      }

      return new Response("ok");
    }

    return new Response("Bot running");
  }

};
