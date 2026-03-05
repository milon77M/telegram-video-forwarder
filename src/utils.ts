/**
 * বিভিন্ন ছোট ছোট হেল্পার ফাংশন
 */

/**
 * ইউনিক টোকেন জেনারেট করার ফাংশন (UUID v4 স্টাইল)
 */
export function generateToken(): string {
  // 16 বাইট র‍্যান্ডম ডাটা জেনারেট করি
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // UUID v4 ফরম্যাটে সাজাই: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // ভার্সন 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // ভ্যারিয়েন্ট
  
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/**
 * শর্ট টোকেন জেনারেট করার ফাংশন (ছোট ও সিম্পল)
 */
export function generateShortToken(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * টেলিগ্রাম চ্যানেল আইডি ভেরিফাই করার ফাংশন
 */
export function isValidChannelId(chatId: string): boolean {
  // চ্যানেল আইডি সাধারণত -100 দিয়ে শুরু হয়
  return chatId.startsWith('-100') && /^-100\d+$/.test(chatId);
}

/**
 * টেলিগ্রাম মেসেজ আইডি ভ্যালিড কিনা চেক করে
 */
export function isValidMessageId(messageId: number): boolean {
  return Number.isInteger(messageId) && messageId > 0;
}

/**
 * ইউজারকে দেওয়ার জন্য HTML পেজ তৈরি করে
 */
export function createVideoPage(
  token: string,
  channelId: string,
  messageId: number,
  views: number
): string {
  const telegramUrl = `https://t.me/c/${channelId.replace('-100', '')}/${messageId}`;
  const embedUrl = `https://t.me/${channelId}/${messageId}?embed=1`;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🎬 ভিডিও প্লেয়ার</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .container {
          max-width: 800px;
          width: 100%;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 30px;
        }
        
        h1 {
          color: #2c3e50;
          font-size: 28px;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .video-wrapper {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          margin-bottom: 20px;
        }
        
        .video-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        
        .stats {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 10px;
        }
        
        .stat-box {
          text-align: center;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
        }
        
        .stat-label {
          color: #666;
          font-size: 14px;
          margin-top: 5px;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          padding: 12px 30px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.3s;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: center;
        }
        
        .button:hover {
          transform: translateY(-2px);
        }
        
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #888;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎬 ভিডিও প্লেয়ার</h1>
        
        <div class="video-wrapper">
          <iframe src="${embedUrl}" allowfullscreen></iframe>
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <div class="stat-value">${views.toLocaleString()}</div>
            <div class="stat-label">মোট ভিউ</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">⚡</div>
            <div class="stat-label">লাইভ স্ট্রিম</div>
          </div>
        </div>
        
        <a href="${telegramUrl}" target="_blank" class="button">
          📱 টেলিগ্রামে খুলুন
        </a>
        
        <div class="footer">
          ⚠️ এই লিংক শুধু নির্দিষ্ট ভিডিওর জন্য
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * JSON রেসপন্স তৈরি করার ফাংশন
 */
export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * এরর রেসপন্স তৈরি করার ফাংশন
 */
export function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * সফল রেসপন্স তৈরি করার ফাংশন
 */
export function successResponse(data: any, status: number = 200): Response {
  return jsonResponse({ success: true, ...data }, status);
}

/**
 * ইমেইল বা ফোন নম্বর ভ্যালিডেট করার ফাংশন (ঐচ্ছিক)
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * লিংক থেকে ডোমেইন বের করার ফাংশন
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * ক্যাশ কন্ট্রোল হেডারসহ রেসপন্স তৈরি (ক্যাশিং অপ্টিমাইজেশনের জন্য)
 */
export function cachedResponse(body: string, ttl: number = 3600): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': `public, max-age=${ttl}`,
    },
  });
}
