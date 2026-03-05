const BOT_TOKEN = "8046672368:AAHLTyEylZ9P-rP2aabImCXhsl8X86HUC50"
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

// Admin (optional, link generation ke control korbe)
const ADMIN_ID = 7383046042

// Source channels (message forward hobe)
const SOURCE_CHANNEL_ID = -1003657533852

// Force join channels
const FORCE_JOIN_CHANNELS = [
  { username: "@movieshub6452", name: "Movies Hub" },
  { username: "@KCHindiDrama", name: "K&C Drama Hindi" }
]

// Auto delete time in milliseconds (20 minutes)
const AUTO_DELETE_TIME = 20 * 60 * 1000

export default {
  async fetch(req, env) {
    if (req.method === "POST") {
      const update = await req.json()

      // ---------------------------
      // Message from user
      // ---------------------------
      if (update.message) {
        const msg = update.message
        const text = msg.text
        const user_id = msg.from.id

        // ---------------------------
        // Link generation (Admin only)
        // ---------------------------
        if (user_id == ADMIN_ID && text && text.includes("t.me/c/")) {
          const parts = text.split("/")
          const message_id = parts[parts.length - 1]

          const token = crypto.randomUUID().slice(0, 8)
          await env.VIDEO_TOKENS.put(token, JSON.stringify({ message_id, clicks: 0, users: [] }))

          const link = `https://t.me/${(await getBot()).username}?start=${token}`
          await sendMessage(user_id, `Your Link:\n${link}`)
          return new Response("ok")
        }

        // ---------------------------
        // User clicked /start token
        // ---------------------------
        if (text && text.startsWith("/start")) {
          const token = text.split(" ")[1]
          if (!token) return new Response("ok")

          // Get token data
          const tokenDataRaw = await env.VIDEO_TOKENS.get(token)
          if (!tokenDataRaw) {
            await sendMessage(user_id, "❌ Invalid link")
            return new Response("ok")
          }

          let tokenData = JSON.parse(tokenDataRaw)

          // ---------------------------
          // Force join check
          // ---------------------------
          for (let ch of FORCE_JOIN_CHANNELS) {
            const member = await getChatMember(ch.username, user_id)
            if (!member || (member.status !== "member" && member.status !== "creator" && member.status !== "administrator")) {
              let join_msg = `⚠️ You must join these channels first:\n`
              FORCE_JOIN_CHANNELS.forEach(c => join_msg += `${c.name}: ${c.username}\n`)
              await sendMessage(user_id, join_msg)
              return new Response("ok")
            }
          }

          // ---------------------------
          // Forward video
          // ---------------------------
          const sentMessage = await copyMessage(user_id, SOURCE_CHANNEL_ID, tokenData.message_id)

          // ---------------------------
          // Update token analytics
          // ---------------------------
          tokenData.clicks += 1
          if (!tokenData.users.includes(user_id)) tokenData.users.push(user_id)
          await env.VIDEO_TOKENS.put(token, JSON.stringify(tokenData))

          // ---------------------------
          // Send info + auto delete notice
          // ---------------------------
          const infoMsg = "ভিডিওটি ফরওয়ার্ড করা হলো। ২০ মিনিট পরে অটো ডিলিট হয়ে যাবে.\nVideo forwarded. It will auto-delete after 20 minutes."
          await sendMessage(user_id, infoMsg)

          // ---------------------------
          // Schedule auto-delete
          // ---------------------------
          if (sentMessage && sentMessage.result && sentMessage.result.message_id) {
            const message_id = sentMessage.result.message_id
            setTimeout(async () => {
              await deleteMessage(user_id, message_id)
            }, AUTO_DELETE_TIME)
          }
        }
      }

      return new Response("ok")
    }

    return new Response("Bot running")
  }
}

// ---------------------------
// Telegram API helper functions
// ---------------------------
async function sendMessage(chat_id, text) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text })
  })
}

async function copyMessage(chat_id, from_chat_id, message_id) {
  const res = await fetch(`${API}/copyMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, from_chat_id, message_id })
  })
  return await res.json()
}

async function deleteMessage(chat_id, message_id) {
  await fetch(`${API}/deleteMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, message_id })
  })
}

async function getBot() {
  const res = await fetch(`${API}/getMe`)
  return (await res.json()).result
}

async function getChatMember(chat_username, user_id) {
  try {
    const res = await fetch(`${API}/getChatMember?chat_id=${chat_username}&user_id=${user_id}`)
    const data = await res.json()
    if (data.ok) return data.result
    else return null
  } catch (e) {
    return null
  }
        }
