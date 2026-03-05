const BOT_TOKEN = "8046672368:AAHLTyEylZ9P-rP2aabImCXhsl8X86HUC50"
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

const ADMIN_ID = 7383046042
const SOURCE_CHANNEL_ID = -1003657533852

export default {
  async fetch(req, env) {

    if (req.method === "POST") {
      const update = await req.json()

      if (update.message) {
        const msg = update.message
        const text = msg.text
        const user = msg.from.id

        if (user != ADMIN_ID) return new Response("ok")

        if (text && text.includes("t.me/c/")) {

          const parts = text.split("/")
          const message_id = parts[parts.length - 1]

          const token = crypto.randomUUID().slice(0,8)

          await env.VIDEO_TOKENS.put(token, message_id)

          const link = `https://t.me/${(await getBot()).username}?start=${token}`

          await sendMessage(user, `Your Link:\n${link}`)
        }

        if (text && text.startsWith("/start")) {

          const token = text.split(" ")[1]

          if (!token) return new Response("ok")

          const message_id = await env.VIDEO_TOKENS.get(token)

          if (!message_id) {
            await sendMessage(user, "❌ Invalid link")
            return new Response("ok")
          }

          await copyMessage(user, SOURCE_CHANNEL_ID, message_id)
        }
      }

      return new Response("ok")
    }

    return new Response("Bot running")
  }
}

async function sendMessage(chat_id,text){
  await fetch(`${API}/sendMessage`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      chat_id,
      text
    })
  })
}

async function copyMessage(chat_id,from_chat_id,message_id){
  await fetch(`${API}/copyMessage`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      chat_id,
      from_chat_id,
      message_id
    })
  })
}

async function getBot(){
  const res = await fetch(`${API}/getMe`)
  return (await res.json()).result
  }
