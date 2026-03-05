/**
 * টেলিগ্রাম API-র সাথে যোগাযোগ করার জন্য ফাংশন
 * এই ফাইলটি টেলিগ্রাম বট API-তে রিকোয়েস্ট পাঠায়
 */

interface Env {
  BOT_TOKEN: string;
}

interface SendMessageOptions {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
}

interface ForwardMessageOptions {
  chat_id: number | string;      // যে চ্যাটে ফরওয়ার্ড করবেন (ইউজারের আইডি)
  from_chat_id: number | string; // যে চ্যাট থেকে ফরওয়ার্ড করবেন (আপনার চ্যানেল)
  message_id: number;            // ভিডিওর মেসেজ আইডি
}

/**
 * টেলিগ্রাম API-তে জেনেরিক রিকোয়েস্ট পাঠানোর ফাংশন
 */
export async function callTelegramAPI(
  env: Env,
  method: string,
  payload: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error(`Telegram API Error (${method}):`, data.description);
      throw new Error(`Telegram API Error: ${data.description}`);
    }
    
    return data.result;
  } catch (error) {
    console.error('Telegram API call failed:', error);
    throw error;
  }
}

/**
 * মেসেজ পাঠানোর ফাংশন
 */
export async function sendMessage(env: Env, options: SendMessageOptions): Promise<any> {
  return callTelegramAPI(env, 'sendMessage', options);
}

/**
 * ভিডিও ফরওয়ার্ড করার ফাংশন (মূল ফাংশন - ইউজারকে ভিডিও পাঠাবে)
 */
export async function forwardMessage(env: Env, options: ForwardMessageOptions): Promise<any> {
  return callTelegramAPI(env, 'forwardMessage', options);
}

/**
 * ইউজারকে ইনলাইন বাটনসহ মেসেজ পাঠানোর ফাংশন
 */
export async function sendMessageWithButtons(
  env: Env,
  chatId: number | string,
  text: string,
  buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>>
): Promise<any> {
  const inlineKeyboard = {
    inline_keyboard: buttons.map(row => 
      row.map(btn => ({
        text: btn.text,
        ...(btn.url ? { url: btn.url } : {}),
        ...(btn.callback_data ? { callback_data: btn.callback_data } : {}),
      }))
    ),
  };

  return callTelegramAPI(env, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
}

/**
 * ভিডিও লিংক থেকে মেসেজ আইডি বের করার ফাংশন
 * যেমন: "https://t.me/c/3657533852/3" থেকে message_id = 3
 */
export function extractMessageIdFromLink(link: string): number | null {
  try {
    // প্যাটার্ন: t.me/c/CHANNEL_ID/MESSAGE_ID
    const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
    if (match && match[2]) {
      return parseInt(match[2], 10);
    }
    
    // প্যাটার্ন: t.me/CHANNEL_USERNAME/MESSAGE_ID
    const match2 = link.match(/t\.me\/[a-zA-Z0-9_]+\/(\d+)/);
    if (match2 && match2[1]) {
      return parseInt(match2[1], 10);
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting message ID:', error);
    return null;
  }
}

/**
 * ভিডিও লিংক থেকে চ্যানেল আইডি বের করার ফাংশন
 */
export function extractChannelIdFromLink(link: string): string | null {
  try {
    // প্যাটার্ন: t.me/c/CHANNEL_ID/MESSAGE_ID
    const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
    if (match && match[1]) {
      return `-100${match[1]}`; // টেলিগ্রামের চ্যানেল আইডি ফরম্যাট
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting channel ID:', error);
    return null;
  }
}

/**
 * টেলিগ্রাম API-র রেসপন্স চেক করার ফাংশন
 */
export function isTelegramSuccess(response: any): boolean {
  return response && response.ok === true;
    }
