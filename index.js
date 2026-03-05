addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'POST') {
    const body = await request.json()

    // যদি ইউজার /start পাঠায়
    if (body.message && body.message.text === "/start") {
      const chat_id = body.message.chat.id

      const token = "8046672368:AAHLTyEylZ9P-p2aabImCXhsl8X86HUC50"
      const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`

      await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat_id,
          text: "Welcome! This is your bot 🙂"
        })
      })
    }

    return new Response("OK", { status: 200 })
  } else {
    return new Response("Telegram bot is running!", { status: 200 })
  }
}
