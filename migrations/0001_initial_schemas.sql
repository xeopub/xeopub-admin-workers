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

CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    slogan TEXT NOT NULL,
    custom_url TEXT NOT NULL,
    default_episode_background_bucket_key TEXT NOT NULL,
    default_episode_thumbnail_bucket_key TEXT NOT NULL,
    default_episode_background_music_bucket_key TEXT NOT NULL,
    default_episode_intro_music_bucket_key TEXT NOT NULL,
    first_comment_template TEXT NOT NULL,
    prompt_template_to_gen_evergreen_titles TEXT NOT NULL,
    prompt_template_to_gen_news_titles TEXT NOT NULL,
    prompt_template_to_gen_series_titles TEXT NOT NULL,
    prompt_template_to_gen_article_content TEXT NOT NULL,
    prompt_template_to_gen_article_metadata TEXT NOT NULL,
    prompt_template_to_gen_episode_script TEXT NOT NULL,
    prompt_template_to_gen_episode_background TEXT NOT NULL,
    prompt_template_to_gen_episode_audio TEXT NOT NULL,
    prompt_template_to_gen_episode_background_music TEXT NOT NULL,
    prompt_template_to_gen_episode_intro_music TEXT NOT NULL,
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
    show_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id)
);

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL,
    series_id INTEGER,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
    tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
    type TEXT NOT NULL CHECK (type IN ('evergreen', 'news')),
    first_comment TEXT,
    script TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(script)),
    audio_bucket_key TEXT,
    background_bucket_key TEXT,
    background_music_bucket_key TEXT,
    intro_music_bucket_key TEXT,
    video_bucket_key TEXT,
    thumbnail_bucket_key TEXT,
    article_image_bucket_key TEXT,
    thumbnail_gen_prompt TEXT,
    article_image_gen_prompt TEXT,
    scheduled_publish_at DATETIME,
    status_on_youtube TEXT CHECK (status_on_youtube IN ('none', 'scheduled', 'public', 'private', 'deleted')),
    status_on_website TEXT CHECK (status_on_website IN ('none', 'scheduled', 'public', 'private', 'deleted')),
    status_on_x TEXT CHECK (status_on_x IN ('none', 'scheduled', 'public', 'private', 'deleted')),
    freezeStatus BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'researching', 'researched', 'generatingMaterial', 'materialGenerated', 'generatingVideo', 'videoGenerated'
    )),
    last_status_change_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id),
    FOREIGN KEY (series_id) REFERENCES series(id)
);

-- Indexes for episodes table
CREATE INDEX IF NOT EXISTS idx_episodes_status_freeze_sched_created ON episodes (status, freezeStatus, scheduled_publish_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_episodes_category_id ON episodes (show_id);

CREATE TABLE IF NOT EXISTS episode_cron_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    data TEXT NOT NULL CHECK (json_valid(data)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE INDEX IF NOT EXISTS idx_episode_cron_log_episode_id ON episode_cron_logs (episode_id);

CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL,
    youtube_platform_id TEXT NOT NULL UNIQUE,
    youtube_platform_category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    video_description_template TEXT NOT NULL,
    first_comment_template TEXT NOT NULL,
    language_code TEXT CHECK (LENGTH(language_code) = 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_show_id ON youtube_channels (show_id);

CREATE TABLE IF NOT EXISTS youtube_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_platform_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES youtube_channels(id),
    FOREIGN KEY (series_id) REFERENCES series(id)
);

CREATE TABLE IF NOT EXISTS youtube_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    youtube_channel_id INTEGER NOT NULL,
    youtube_platform_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (youtube_channel_id) REFERENCES youtube_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_episode_id ON youtube_videos (episode_id);

CREATE TABLE IF NOT EXISTS external_service_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_task_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT CHECK (json_valid(data)) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for external_service_tasks table
CREATE INDEX IF NOT EXISTS idx_external_service_tasks_external_task_id ON external_service_tasks (external_task_id);

-- Triggers
-- On episode insert: if episode is in a series, its episode must match the series' show
CREATE TRIGGER IF NOT EXISTS episode_show_match_series_insert
BEFORE INSERT ON episodes
FOR EACH ROW
WHEN NEW.series_id IS NOT NULL AND NEW.show_id != (SELECT show_id FROM series WHERE id = NEW.series_id)
BEGIN
    SELECT RAISE(ABORT, 'episode show_id must match the show_id of the series.');
END;

-- On episode update: if episode is in a series, its show must match the series' show
CREATE TRIGGER IF NOT EXISTS episode_show_match_series_update
BEFORE UPDATE ON episodes
FOR EACH ROW
WHEN NEW.series_id IS NOT NULL AND NEW.show_id != (SELECT show_id FROM series WHERE id = NEW.series_id)
BEGIN
    SELECT RAISE(ABORT, 'episode show_id must match the show_id of the series.');
END;

-- On series show update: prevent if series has any episodes
CREATE TRIGGER IF NOT EXISTS prevent_series_show_change_if_has_episodes
BEFORE UPDATE OF show_id ON series
FOR EACH ROW
WHEN OLD.show_id != NEW.show_id AND EXISTS (SELECT 1 FROM episodes WHERE series_id = NEW.id)
BEGIN
    SELECT RAISE(ABORT, 'Cannot change show of a series with episodes. Update or move episodes first.');
END;
