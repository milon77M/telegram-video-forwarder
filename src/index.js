const BOT_TOKEN = "8046672368:AAHLTyEylZ9P-rP2aabImCXhsl8X86HUC50"
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

const ADMIN_ID = 7383046042
const SOURCE_CHANNEL_ID = -1003657533852

export default {
  async fetch(request, env, ctx) {
    // Only handle POST requests from Telegram
    if (request.method === "POST") {
      try {
        const update = await request.json()
        console.log("Received update:", JSON.stringify(update))
        
        // Handle message
        if (update.message) {
          await handleMessage(update.message, env)
        }
        // Handle callback query (button clicks)
        else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query, env)
        }
        
        return new Response("OK")
      } catch (error) {
        console.error("Error processing update:", error)
        return new Response("Error", { status: 500 })
      }
    }
    
    // GET request - just show status
    return new Response("🤖 Bot is running!\nUse POST for webhook updates.")
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id
  const userId = message.from.id
  const text = message.text
  
  console.log(`Message from ${userId}: ${text}`)
  
  // Handle /start command (for ALL users)
  if (text && text.startsWith("/start")) {
    const token = text.split(" ")[1] // Get token if exists
    
    if (!token) {
      // Welcome message for new users
      await sendMessage(chatId, 
        "👋 Welcome to Video Forwarder Bot!\n\n" +
        "Please use a valid video link to watch content."
      )
      return
    }
    
    // Get message_id from token
    const messageId = await env.VIDEO_TOKENS.get(token)
    
    if (!messageId) {
      await sendMessage(chatId, "❌ Invalid or expired link. Please request a new one.")
      return
    }
    
    try {
      // Forward video to user (like a forwarded message)
      await forwardMessage(chatId, SOURCE_CHANNEL_ID, parseInt(messageId))
      
      // Send confirmation with delete button
      await sendMessageWithKeyboard(chatId, 
        "✅ Video forwarded successfully!\n\n" +
        "This message will appear as a forwarded message from the channel.",
        {
          inline_keyboard: [
            [{ text: "🗑 Delete this message", callback_data: "delete" }]
          ]
        }
      )
      
      // Optional: Delete token after single use
      // await env.VIDEO_TOKENS.delete(token)
      
    } catch (error) {
      console.error("Forward error:", error)
      await sendMessage(chatId, "❌ Failed to forward video. Please try again.")
    }
    
    return
  }
  
  // Handle admin commands
  if (userId === ADMIN_ID) {
    // Admin: Create link from channel post
    if (text && text.includes("t.me/c/")) {
      await handleAdminLink(chatId, text, env)
    }
    // Admin: Help command
    else if (text === "/help") {
      await sendMessage(chatId,
        "🔧 Admin Commands:\n\n" +
        "• Send channel post link to generate shareable link\n" +
        "• Link format: https://t.me/c/CHANNEL_ID/MESSAGE_ID\n\n" +
        "Example: https://t.me/c/3657533852/4"
      )
    }
  }
}

async function handleCallbackQuery(query, env) {
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const data = query.data
  
  // Answer callback query to remove loading state
  await answerCallbackQuery(query.id)
  
  if (data === "delete") {
    await deleteMessage(chatId, messageId)
  }
}

async function handleAdminLink(chatId, link, env) {
  try {
    // Parse channel and message ID from link
    // Format: https://t.me/c/123456789/123
    const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/)
    
    if (!match) {
      await sendMessage(chatId, "❌ Invalid link format. Please use: https://t.me/c/CHANNEL_ID/MESSAGE_ID")
      return
    }
    
    const channelId = `-100${match[1]}`
    const messageId = parseInt(match[2])
    
    // Verify it's from source channel
    if (parseInt(channelId) !== SOURCE_CHANNEL_ID) {
      await sendMessage(chatId, "❌ This channel is not authorized. Only source channel videos can be shared.")
      return
    }
    
    // Generate unique token
    const token = generateToken()
    
    // Store in KV with 24 hour expiry
    await env.VIDEO_TOKENS.put(token, messageId.toString(), { expirationTtl: 86400 })
    
    // Get bot info for link
    const botInfo = await getMe()
    const shareableLink = `https://t.me/${botInfo.username}?start=${token}`
    
    // Send link to admin
    await sendMessageWithKeyboard(chatId,
      `✅ Video link created!\n\n` +
      `🔗 Share this link:\n${shareableLink}\n\n` +
      `📊 Stats:\n` +
      `• Message ID: ${messageId}\n` +
      `• Token: ${token}\n` +
      `• Expires: 24 hours`,
      {
        inline_keyboard: [
          [{ text: "📋 Copy Link", callback_data: `copy_${token}` }]
        ]
      }
    )
    
  } catch (error) {
    console.error("Admin link error:", error)
    await sendMessage(chatId, "❌ Error creating link. Please try again.")
  }
}

// Telegram API Functions

async function sendMessage(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    })
  })
}

async function sendMessageWithKeyboard(chatId, text, keyboard) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: keyboard
    })
  })
}

async function forwardMessage(chatId, fromChatId, messageId) {
  const response = await fetch(`${API}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId
    })
  })
  
  const result = await response.json()
  console.log("Forward result:", result)
  return result
}

async function deleteMessage(chatId, messageId) {
  await fetch(`${API}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId
    })
  })
}

async function answerCallbackQuery(callbackQueryId) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId
    })
  })
}

async function getMe() {
  const response = await fetch(`${API}/getMe`)
  const data = await response.json()
  return data.result
}

function generateToken() {
  return Math.random().toString(36).substring(2, 10) + 
         Math.random().toString(36).substring(2, 10)
}
