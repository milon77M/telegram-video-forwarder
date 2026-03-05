/**
 * D1 ডাটাবেজে টোকেন সংরক্ষণ, খোঁজা, আপডেট করার ফাংশন
 */

interface Env {
  DB: D1Database;
}

export interface VideoToken {
  token: string;
  message_id: number;
  chat_id: string;
  views: number;
  created_at: number;
  last_accessed?: number;
}

/**
 * নতুন টোকেন ডাটাবেজে সেভ করে
 */
export async function saveToken(
  env: Env,
  token: string,
  messageId: number,
  chatId: string
): Promise<boolean> {
  try {
    const now = Date.now();
    
    await env.DB.prepare(
      `INSERT INTO video_tokens (token, message_id, chat_id, views, created_at) 
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(token, messageId, chatId, 0, now)
      .run();
    
    console.log(`Token saved: ${token} for message ${messageId}`);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
}

/**
 * টোকেন দিয়ে ভিডিও ইনফো খুঁজে বের করে
 */
export async function getTokenInfo(
  env: Env,
  token: string
): Promise<VideoToken | null> {
  try {
    const result = await env.DB.prepare(
      `SELECT token, message_id, chat_id, views, created_at 
       FROM video_tokens 
       WHERE token = ?`
    )
      .bind(token)
      .first();
    
    if (!result) {
      return null;
    }
    
    return {
      token: result.token as string,
      message_id: result.message_id as number,
      chat_id: result.chat_id as string,
      views: result.views as number,
      created_at: result.created_at as number,
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    return null;
  }
}

/**
 * টোকেনের ভিউ কাউন্ট আপডেট করে (একবার দেখা হলে)
 */
export async function incrementViewCount(
  env: Env,
  token: string
): Promise<boolean> {
  try {
    const now = Date.now();
    
    await env.DB.prepare(
      `UPDATE video_tokens 
       SET views = views + 1, last_accessed = ? 
       WHERE token = ?`
    )
      .bind(now, token)
      .run();
    
    // ভিউ লগেও এন্ট্রি যোগ করি (ঐচ্ছিক)
    await env.DB.prepare(
      `INSERT INTO view_logs (token, viewed_at) VALUES (?, ?)`
    )
      .bind(token, now)
      .run();
    
    return true;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return false;
  }
}

/**
 * নির্দিষ্ট টোকেনের জন্য ভিউ লগ দেখায় (কবে কতবার দেখা হয়েছে)
 */
export async function getViewLogs(
  env: Env,
  token: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT viewed_at, ip_address, user_agent 
       FROM view_logs 
       WHERE token = ? 
       ORDER BY viewed_at DESC 
       LIMIT ?`
    )
      .bind(token, limit)
      .all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting view logs:', error);
    return [];
  }
}

/**
 * সবচেয়ে বেশি দেখা ভিডিওর তালিকা
 */
export async function getPopularVideos(
  env: Env,
  limit: number = 10
): Promise<any[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT token, message_id, chat_id, views, created_at 
       FROM video_tokens 
       ORDER BY views DESC 
       LIMIT ?`
    )
      .bind(limit)
      .all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting popular videos:', error);
    return [];
  }
}

/**
 * একটি নির্দিষ্ট ইউজারের জন্য তৈরি টোকেনগুলোর তালিকা (আপনার জন্য)
 * (যদি একাধিক অ্যাডমিন থাকে, তাহলে কাজে লাগবে)
 */
export async function getTokensByAdmin(
  env: Env,
  adminId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT token, message_id, chat_id, views, created_at 
       FROM video_tokens 
       WHERE created_by = ? 
       ORDER BY created_at DESC 
       LIMIT ?`
    )
      .bind(adminId, limit)
      .all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting admin tokens:', error);
    return [];
  }
}

/**
 * ৩০ দিনের বেশি পুরনো টোকেন মুছে ফেলা (যদি চান)
 */
export async function cleanupOldTokens(env: Env): Promise<number> {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const result = await env.DB.prepare(
      `DELETE FROM video_tokens WHERE created_at < ?`
    )
      .bind(thirtyDaysAgo)
      .run();
    
    return result.meta.changes || 0;
  } catch (error) {
    console.error('Error cleaning up old tokens:', error);
    return 0;
  }
}

/**
 * মোট টোকেন ও ভিউ কাউন্ট পরিসংখ্যান
 */
export async function getStats(env: Env): Promise<any> {
  try {
    const totalTokens = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM video_tokens`
    ).first();
    
    const totalViews = await env.DB.prepare(
      `SELECT SUM(views) as total FROM video_tokens`
    ).first();
    
    const todayViews = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM view_logs 
       WHERE viewed_at > ?`
    )
      .bind(Date.now() - 24 * 60 * 60 * 1000)
      .first();
    
    return {
      totalTokens: totalTokens?.count || 0,
      totalViews: totalViews?.total || 0,
      todayViews: todayViews?.count || 0,
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      totalTokens: 0,
      totalViews: 0,
      todayViews: 0,
    };
  }
}
