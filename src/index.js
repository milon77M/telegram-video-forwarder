export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // হোম পেজ
    if (url.pathname === '/') {
      return new Response('🤖 Telegram Bot is running!', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // ওয়েবহুক এন্ডপয়েন্ট - এই ফরম্যাটে হবে
    if (url.pathname === '/webhook') {
      // BOT_TOKEN চেক করা
      if (request.method === 'POST') {
        try {
          const update = await request.json();
          console.log('Update received:', update);
          
          // মেসেজ হ্যান্ডল করা
          if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            
            if (text === '/start') {
              await sendWelcomeMessage(chatId, env.BOT_TOKEN);
            }
          }
          
          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('Error:', error);
          return new Response('Error', { status: 500 });
        }
      }
    }
    
    // ওয়েবহুক সেটআপ হেল্পার
    if (url.pathname === '/setup-webhook') {
      const workerUrl = `${url.protocol}//${url.host}`;
      const webhookUrl = `${workerUrl}/webhook`;
      
      const apiUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
      
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        return new Response(JSON.stringify(data, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function sendWelcomeMessage(chatId, botToken) {
  const message = '👋 স্বাগতম! আপনি বটটি সফলভাবে স্টার্ট করেছেন।';
  
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: message
  };
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}
