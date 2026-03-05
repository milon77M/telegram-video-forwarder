const BOT_TOKEN = "8046672368:AAHLTyEylZ9P-rP2aabImCXhsl8X86HUC50"
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

const ADMIN_ID = 7383046042
const SOURCE_CHANNEL_ID = -1003657533852

export default {
  async fetch(req, env) {
    // Handle webhook POST requests
    if (req.method === "POST") {
      const update = await req.json()
      
      // Handle callback queries (for button clicks)
      if (update.callback_query) {
        const query = update.callback_query
        const user = query.from.id
        const data = query.data
        const messageId = query.message.message_id
        const chatId = query.message.chat.id
        
        if (data === "delete") {
          await deleteMessage(chatId, messageId)
          await answerCallbackQuery(query.id, "Message deleted")
        }
        
        return new Response("ok")
      }
      
      // Handle messages
      if (update.message) {
        const msg = update.message
        const text = msg.text
        const user = msg.from.id
        const chatId = msg.chat.id
        
        // Admin commands
        if (user === ADMIN_ID) {
          // Handle video link from admin
          if (text && text.includes("t.me/c/")) {
            try {
              // Parse channel message ID from link
              // Format: https://t.me/c/123456789/123
              const parts = text.split("/")
              const message_id = parseInt(parts[parts.length - 1])
              
              // Generate unique token
              const token = crypto.randomUUID().slice(0, 8)
              
              // Store in KV with expiry (24 hours)
              await env.VIDEO_TOKENS.put(token, message_id.toString(), { expirationTtl: 86400 })
              
              // Create shareable link using bot username
              const botInfo = await getBot()
              const link = `https://t.me/${botInfo.username}?start=${token}`
              
              await sendMessage(chatId, 
                `✅ Your video link is ready!\n\n${link}\n\n` +
                `⚠️ This link will expire in 24 hours`
              )
            } catch (error) {
              await sendMessage(chatId, "❌ Error processing link. Please check the format.")
            }
          }
        }
        
        // Handle /start command for ALL users (this is the key part)
        if (text && text.startsWith("/start")) {
          const token = text.split(" ")[1]
          
          if (!token) {
            // Welcome message for new users
            await sendMessage(chatId, 
              "👋 Welcome! This bot shares videos.\n\n" +
              "Please use a valid video link to watch."
            )
            return new Response("ok")
          }
          
          // Get message_id from token
          const message_id = await env.VIDEO_TOKENS.get(token)
          
          if (!message_id) {
            await sendMessage(chatId, "❌ Invalid or expired link. Please request a new one.")
            return new Response("ok")
          }
          
          try {
            // Forward video to user
            await copyMessage(chatId, SOURCE_CHANNEL_ID, parseInt(message_id))
            
            // Send success message with delete button
            await sendMessageWithButton(chatId, 
              "✅ Video sent successfully!\n\nClick the button below to delete this message.",
              [[{ text: "🗑 Delete", callback_data: "delete" }]]
            )
            
            // Optionally delete the token after use (for single-use links)
            // await env.VIDEO_TOKENS.delete(token)
            
          } catch (error) {
            console.error("Error forwarding video:", error)
            await sendMessage(chatId, "❌ Error sending video. Please try again later.")
          }
        }
      }
      
      return new Response("ok")
    }
    
    // Handle GET requests (for webhook verification)
    return new Response("Telegram Video Forwarder Bot is Running!")
  }
}

// Helper function to send regular message
async function sendMessage(chat_id, text) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: "HTML"
    })
  })
}

// Helper function to send message with inline keyboard
async function sendMessageWithButton(chat_id, text, buttons) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text,
      reply_markup: {
        inline_keyboard: buttons
      }
    })
  })
}

// Helper function to copy message (forward without sender info)
async function copyMessage(chat_id, from_chat_id, message_id) {
  await fetch(`${API}/copyMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id,
      from_chat_id,
      message_id
    })
  })
}

// Helper function to delete message
async function deleteMessage(chat_id, message_id) {
  await fetch(`${API}/deleteMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id,
      message_id
    })
  })
}

// Helper function to answer callback query
async function answerCallbackQuery(callback_query_id, text) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id,
      text
    })
  })
}

// Helper function to get bot info
async function getBot() {
  const res = await fetch(`${API}/getMe`)
  return (await res.json()).result
}
