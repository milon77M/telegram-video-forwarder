-- ভিডিও টোকেন সংরক্ষণের টেবিল
CREATE TABLE IF NOT EXISTS video_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    message_id INTEGER NOT NULL,
    chat_id TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER
);

-- টোকেন দিয়ে দ্রুত সার্চের জন্য ইনডেক্স
CREATE INDEX idx_token ON video_tokens(token);

-- ভিউ কাউন্ট দেখার জন্য ইনডেক্স
CREATE INDEX idx_views ON video_tokens(views DESC);

-- তারিখ অনুযায়ী সার্চের জন্য ইনডেক্স
CREATE INDEX idx_created ON video_tokens(created_at DESC);

-- অ্যানালিটিক্সের জন্য ভিউ লগ টেবিল (ঐচ্ছিক)
CREATE TABLE IF NOT EXISTS view_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    viewed_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (token) REFERENCES video_tokens(token)
);

-- টোকেনের ভিউ হিস্টোরি দেখার জন্য ইনডেক্স
CREATE INDEX idx_view_logs_token ON view_logs(token);
CREATE INDEX idx_view_logs_date ON view_logs(viewed_at DESC);
