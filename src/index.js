export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // ওয়েবহুক সেটআপের জন্য
    if (url.pathname === '/set-webhook') {
      return await setupWebhook(env);
    }
    
    // টেলিগ্রাম আপডেট হ্যান্ডলার
    if (url.pathname === `/webhook/${env.BOT_TOKEN}`) {
      if (request.method === 'POST') {
        const update = await request.json();
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      }
    }
    
    return new Response('Telegram Bot is running!', { status: 200 });
  }
};

// ওয়েবহুক সেটআপ ফাংশন
async function setupWebhook(env) {
  const webhookUrl = `https://${env.CLOUDFLARE_WORKER_URL}/webhook/${env.BOT_TOKEN}`;
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok) {
      return new Response('Webhook set successfully!', { status: 200 });
    } else {
      return new Response(`Failed to set webhook: ${data.description}`, { status: 500 });
    }
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// আপডেট হ্যান্ডলার
async function handleUpdate(update, env) {
  // মেসেজ চেক করা
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    
    // /start কমান্ড চেক করা
    if (text === '/start') {
      await sendWelcomeMessage(chatId, env);
    }
  }
}

// ওয়েলকাম মেসেজ পাঠানোর ফাংশন
async function sendWelcomeMessage(chatId, env) {
  const welcomeMessage = `👋 **স্বাগতম!**

আপনি বটটি সফলভাবে স্টার্ট করেছেন। 

🔹 আপনার চ্যাট আইডি: \`${chatId}\`
🔹 বটটি সক্রিয় আছে

আপনার জন্য শুভকামনা! 🎉`;

  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: welcomeMessage,
    parse_mode: 'Markdown'
  };
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}
