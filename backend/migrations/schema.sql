CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Voltage rank reference
CREATE TABLE voltage_ranks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(20) NOT NULL,
  min_voltage INTEGER NOT NULL,
  badge_color VARCHAR(20),
  perk        TEXT
);
INSERT INTO voltage_ranks (title,min_voltage,badge_color,perk) VALUES
  ('Static',   0,       'Gray',          'Basic access'),
  ('Spark',    500,     'White',         'Custom username color'),
  ('Buzz',     1500,    'Green',         'Animated profile border'),
  ('Shock',    3000,    'Blue',          'Exclusive Splat gifts unlocked'),
  ('Surge',    6000,    'Purple',        'Room theme early access'),
  ('Bolt',     12000,   'ElectricPurple','Verified badge'),
  ('Thunder',  25000,   'Gold',          'Priority mic slot in rooms'),
  ('Storm',    50000,   'Orange',        'Custom room entrance animation'),
  ('Overload', 100000,  'Red',           'Exclusive Overload-only rooms'),
  ('LOUD',     250000,  'NeonYellow',    'Full gold profile, neon yellow name everywhere');

-- 15 hardcoded room themes (owner only)
CREATE TABLE room_themes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50) NOT NULL,
  primary_color   VARCHAR(10),
  secondary_color VARCHAR(10),
  accent_color    VARCHAR(10),
  bg_color        VARCHAR(10)
);
INSERT INTO room_themes (name,primary_color,secondary_color,accent_color,bg_color) VALUES
  ('Chatsplat Default','#8B00FF','#FFE500','#8B00FF','#0A0A0A'),
  ('Midnight',         '#4A90D9','#C0C0C0','#4A90D9','#050520'),
  ('Inferno',          '#FF2200','#FF6600','#FF4400','#0A0000'),
  ('Cosmic',           '#9B59B6','#3498DB','#E74C3C','#020215'),
  ('Neon City',        '#00FF41','#FF007F','#00FF41','#060606'),
  ('Gold Rush',        '#FFD700','#B8860B','#FFD700','#0A0A00'),
  ('Icy',              '#ADD8E6','#87CEEB','#FFFFFF','#E8F4F8'),
  ('Sakura',           '#FFB7C5','#FFC0CB','#FF69B4','#FFF0F5'),
  ('Jungle',           '#228B22','#556B2F','#8FBC8F','#0A1A0A'),
  ('Sunset',           '#FF6B35','#A855F7','#FF6B35','#1A0A1A'),
  ('Ocean Deep',       '#006994','#008080','#20B2AA','#001A2E'),
  ('Lava',             '#8B0000','#CC4400','#FF4500','#0A0000'),
  ('Glitch',           '#00FFFF','#FF00FF','#FFFF00','#000000'),
  ('Royal',            '#4B0082','#722F37','#FFD700','#0D0020'),
  ('Void',             '#FFFFFF','#888888','#FFFFFF','#000000');

-- Users
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone            VARCHAR(20)   UNIQUE NOT NULL,
  username         VARCHAR(30)   UNIQUE,
  avatar_url       TEXT,
  bio              VARCHAR(160),
  age              SMALLINT      CHECK (age >= 18),
  interests        TEXT[],
  spota_balance    INTEGER       NOT NULL DEFAULT 0 CHECK (spota_balance >= 0),
  spota_earnings   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  monthly_voltage  INTEGER       NOT NULL DEFAULT 0,
  lifetime_voltage INTEGER       NOT NULL DEFAULT 0,
  monthly_rank     VARCHAR(20)   NOT NULL DEFAULT 'Static',
  lifetime_rank    VARCHAR(20)   NOT NULL DEFAULT 'Static',
  is_verified      BOOLEAN       NOT NULL DEFAULT false,
  is_banned        BOOLEAN       NOT NULL DEFAULT false,
  fcm_token        TEXT,
  last_seen        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_monthly_vol  ON users (monthly_voltage  DESC);
CREATE INDEX idx_users_lifetime_vol ON users (lifetime_voltage DESC);

-- Auth
CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      VARCHAR(20) NOT NULL,
  code       VARCHAR(6)  NOT NULL,
  attempts   SMALLINT    NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_codes (phone, used, expires_at);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_hash ON refresh_tokens (token_hash);

-- Social
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE TABLE blocks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Rooms
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(200) NOT NULL,
  category     VARCHAR(50)  NOT NULL DEFAULT 'Casual',
  mode         VARCHAR(10)  NOT NULL DEFAULT 'audio' CHECK (mode IN ('audio','video','both')),
  host_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_id     INTEGER      NOT NULL REFERENCES room_themes(id) DEFAULT 1,
  is_live      BOOLEAN      NOT NULL DEFAULT true,
  is_locked    BOOLEAN      NOT NULL DEFAULT false,
  pin          VARCHAR(4),
  invite_token VARCHAR(64)  UNIQUE,
  capacity     SMALLINT     NOT NULL DEFAULT 200 CHECK (capacity BETWEEN 150 AND 200),
  boost_count  INTEGER      NOT NULL DEFAULT 0,
  viewer_count INTEGER      NOT NULL DEFAULT 0,
  description  TEXT,
  is_scheduled BOOLEAN      NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rooms_live ON rooms (is_live, ended_at) WHERE is_live = true;

CREATE TABLE room_participants (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id   UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','manager','speaker','viewer')),
  mic_slot  SMALLINT    CHECK (mic_slot BETWEEN 1 AND 20),
  mic_on    BOOLEAN     NOT NULL DEFAULT false,
  cam_on    BOOLEAN     NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at   TIMESTAMPTZ,
  UNIQUE (room_id, user_id),
  -- DB-level cam+mic rule — cam ON requires mic ON
  CHECK (NOT (cam_on = true AND mic_on = false))
);
CREATE INDEX idx_rp_room ON room_participants (room_id, left_at) WHERE left_at IS NULL;

CREATE TABLE room_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  is_moderated      BOOLEAN NOT NULL DEFAULT false,
  moderation_reason TEXT,
  is_pinned         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_room_msg ON room_messages (room_id, created_at DESC);

-- Gifts
CREATE TABLE gift_catalog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  emoji         VARCHAR(10),
  animation_key VARCHAR(50),
  spota_cost    INTEGER NOT NULL CHECK (spota_cost > 0),
  min_rank      VARCHAR(20) NOT NULL DEFAULT 'Static',
  is_active     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO gift_catalog (name,emoji,animation_key,spota_cost) VALUES
  ('Purple Bomb','💜','purple_bomb',50),
  ('Shock Wave', '⚡','shock_wave', 100),
  ('Nova',       '🌟','nova',       250),
  ('Loud Crown', '👑','loud_crown', 500),
  ('Chatsplat',  '💥','chatsplat',  1000);

CREATE TABLE gift_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id          UUID REFERENCES rooms(id) ON DELETE SET NULL,
  gift_id          UUID NOT NULL REFERENCES gift_catalog(id),
  quantity         SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  spota_amount     INTEGER  NOT NULL CHECK (spota_amount > 0),
  voltage_sender   INTEGER  NOT NULL DEFAULT 0,
  voltage_receiver INTEGER  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gift_tx_room ON gift_transactions (room_id, created_at DESC);

-- Swipe / Match
CREATE TABLE swipes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  swiped_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction  VARCHAR(5) NOT NULL CHECK (direction IN ('left','right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (swiper_id, swiped_id),
  CHECK (swiper_id <> swiped_id)
);
CREATE TABLE matches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT,
  type       VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (type IN ('text','emoji','gif','voice','gift')),
  media_url  TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_match ON messages (match_id, created_at DESC);

-- Feed
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(10) NOT NULL CHECK (type IN ('text','image','poll','qa','hmu')),
  content       TEXT,
  media_url     TEXT,
  poll_options  JSONB,
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_feed ON posts (created_at DESC);

CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE post_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10),
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spota
CREATE TABLE spota_packages (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      VARCHAR(100) NOT NULL,
  amount    INTEGER      NOT NULL CHECK (amount > 0),
  price_usd DECIMAL(8,2) NOT NULL CHECK (price_usd > 0),
  is_active BOOLEAN      NOT NULL DEFAULT true
);
INSERT INTO spota_packages (name,amount,price_usd) VALUES
  ('Starter',    100,  0.99),
  ('Vibe Pack',  500,  3.99),
  ('Loud Pack',  1500, 9.99),
  ('Legend Pack',5000, 24.99);

CREATE TABLE spota_purchases (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id     UUID NOT NULL REFERENCES spota_packages(id),
  transaction_id TEXT UNIQUE NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_spota_tx ON spota_purchases (transaction_id);

CREATE TABLE spota_earnings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id    UUID REFERENCES rooms(id) ON DELETE SET NULL,
  amount     DECIMAL(10,2) NOT NULL,
  type       VARCHAR(20)   NOT NULL CHECK (type IN ('gift_cut','withdrawal')),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Voltage
CREATE TABLE voltage_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR(50) NOT NULL,
  monthly_earned  INTEGER     NOT NULL,
  lifetime_earned INTEGER     NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE monthly_leaderboard (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month         VARCHAR(7) NOT NULL,
  total_voltage INTEGER    NOT NULL DEFAULT 0,
  rank          INTEGER,
  reward_issued BOOLEAN    NOT NULL DEFAULT false,
  UNIQUE (user_id, month)
);
CREATE INDEX idx_monthly_lb ON monthly_leaderboard (month, total_voltage DESC);

-- Notifications & reports
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      TEXT,
  body       TEXT,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifs ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason           VARCHAR(100),
  description      TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
