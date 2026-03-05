export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // রুট পেজ চেক
    if (url.pathname === '/') {
      return new Response('Telegram Bot is running!', { status: 200 });
    }
    
    // ওয়েবহুক সেটআপের জন্য
    if (url.pathname === '/set-webhook') {
      return await setupWebhook(env, url);
    }
    
    // টেলিগ্রাম আপডেট হ্যান্ডলার
    if (url.pathname === `/webhook/${env.BOT_TOKEN}`) {
      console.log('Webhook hit!', request.method);
      
      if (request.method === 'POST') {
        try {
          const update = await request.json();
          console.log('Update received:', JSON.stringify(update));
          
          await handleUpdate(update, env);
          
          return new Response('OK', { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error processing update:', error);
          return new Response('Error', { status: 500 });
        }
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};

// ওয়েবহুক সেটআপ ফাংশন
async function setupWebhook(env, url) {
  // ওয়ার্কারের ইউআরএল বের করা
  const workerUrl = `${url.protocol}//${url.host}`;
  const webhookUrl = `${workerUrl}/webhook/${env.BOT_TOKEN}`;
  
  const apiUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
  
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    const html = `
      <html>
        <body>
          <h1>Webhook Setup</h1>
          <p>Worker URL: ${workerUrl}</p>
          <p>Webhook URL: ${webhookUrl}</p>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <p><a href="${apiUrl}" target="_blank">Direct API Link</a></p>
        </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// আপডেট হ্যান্ডলার
async function handleUpdate(update, env) {
  console.log('Handling update:', update);
  
  // মেসেজ চেক করা
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    
    console.log(`Message from ${chatId}: ${text}`);
    
    // /start কমান্ড চেক করা
    if (text === '/start') {
      await sendWelcomeMessage(chatId, env);
    } else {
      // অন্য কোনো মেসেজ পাঠালে রিপ্লাই
      await sendMessage(chatId, `আপনি পাঠিয়েছেন: "${text}"\n\nআমি শুধু /start কমান্ড বুঝি।`, env);
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

  await sendMessage(chatId, welcomeMessage, env);
}

// মেসেজ পাঠানোর জেনেরিক ফাংশন
async function sendMessage(chatId, text, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };
  
  try {
    console.log('Sending message:', payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log('Send message result:', result);
    
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
  }
}
