CREATE TABLE IF NOT EXISTS game_questions (
    id SERIAL PRIMARY KEY,
    question_number INTEGER NOT NULL,
    content_url TEXT NOT NULL DEFAULT '',
    content_type VARCHAR(32) NOT NULL DEFAULT 'image',
    answer VARCHAR(255) NOT NULL,
    timer_seconds INTEGER NOT NULL DEFAULT 60 CHECK (timer_seconds > 0),
    points INTEGER NOT NULL DEFAULT 10 CHECK (points >= 0),
    break_after_win_seconds INTEGER NOT NULL DEFAULT 5 CHECK (break_after_win_seconds >= 0),
    hint TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS phonebook_entries (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(32) NOT NULL UNIQUE,
    player_name VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS game_rounds (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES game_questions(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    winner_phone VARCHAR(32) NULL,
    winner_name VARCHAR(128) NULL,
    awarded_points INTEGER NULL CHECK (awarded_points >= 0)
);

CREATE TABLE IF NOT EXISTS sms_submissions (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    phone VARCHAR(32) NOT NULL,
    player_name VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sms_submissions_round_phone_created_at
    ON sms_submissions (round_id, phone, created_at);
