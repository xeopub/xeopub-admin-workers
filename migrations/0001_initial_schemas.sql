-- Migration: Initial schema

CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config (key);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    permissions TEXT DEFAULT '[]' CHECK (json_valid(permissions)) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs (user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions (session_token);

CREATE TABLE IF NOT EXISTS user_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_config_user_id_key ON user_config (user_id, key);

CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    slogan TEXT NOT NULL,
    domain TEXT NOT NULL,
    prompt_template_to_gen_evergreen_titles TEXT NOT NULL,
    prompt_template_to_gen_news_titles TEXT NOT NULL,
    prompt_template_to_gen_series_titles TEXT NOT NULL,
    prompt_template_to_gen_post_content TEXT NOT NULL,
    prompt_template_to_enrich_post_content TEXT NOT NULL,
    prompt_template_to_gen_post_metadata TEXT NOT NULL,
    builder TEXT NOT NULL,
    git_repo_owner TEXT NOT NULL,
    git_repo_name TEXT NOT NULL,
    git_repo_branch TEXT NOT NULL,
    git_api_token TEXT NOT NULL,
    config TEXT CHECK (json_valid(config)) NOT NULL,
    language_code TEXT CHECK (LENGTH(language_code) = 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    website_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id)
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
    tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
    type TEXT NOT NULL CHECK (type IN ('evergreen', 'news')),
    featured_image_bucket_key TEXT,
    featured_image_gen_prompt TEXT,
    scheduled_publish_at DATETIME,
    status_on_x TEXT CHECK (status_on_x IN ('none', 'scheduled', 'public', 'private', 'deleted')),
    freeze_status BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'researching', 'researched', 'generatingAssets', 'assetsGenerated'
    )),
    last_status_change_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id),
    FOREIGN KEY (series_id) REFERENCES series(id)
);

-- Indexes for posts table
CREATE INDEX IF NOT EXISTS idx_posts_status_freeze_sched_created ON posts (status, freeze_status, scheduled_publish_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts (website_id);

CREATE TABLE IF NOT EXISTS post_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    bucket_key TEXT NOT NULL,
    prompt TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_assets_post_id ON post_assets (post_id);
CREATE INDEX IF NOT EXISTS idx_post_assets_bucket_key ON post_assets (bucket_key);

CREATE TABLE IF NOT EXISTS post_cron_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    data TEXT NOT NULL CHECK (json_valid(data)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_post_cron_log_post_id ON post_cron_logs (post_id);

-- Triggers
-- On post insert: if post is in a series, its post must match the series' website
CREATE TRIGGER IF NOT EXISTS post_website_match_series_insert
BEFORE INSERT ON posts
FOR EACH ROW
WHEN NEW.website_id != (SELECT website_id FROM series WHERE id = NEW.series_id)
BEGIN
    SELECT RAISE(ABORT, 'post website_id must match the website_id of the series.');
END;

-- On post update: if post is in a series, its website must match the series' website
CREATE TRIGGER IF NOT EXISTS post_website_match_series_update
BEFORE UPDATE ON posts
FOR EACH ROW
WHEN NEW.website_id != (SELECT website_id FROM series WHERE id = NEW.series_id)
BEGIN
    SELECT RAISE(ABORT, 'post website_id must match the website_id of the series.');
END;

-- On series website update: prevent if series has any posts
CREATE TRIGGER IF NOT EXISTS prevent_series_website_change_if_has_posts
BEFORE UPDATE OF website_id ON series
FOR EACH ROW
WHEN OLD.website_id != NEW.website_id AND EXISTS (SELECT 1 FROM posts WHERE series_id = NEW.id)
BEGIN
    SELECT RAISE(ABORT, 'Cannot change website of a series with posts. Update or move posts first.');
END;
