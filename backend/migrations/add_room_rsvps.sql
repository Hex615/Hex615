CREATE TABLE IF NOT EXISTS room_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_rsvps_room_id ON room_rsvps(room_id);
CREATE INDEX IF NOT EXISTS idx_room_rsvps_user_id ON room_rsvps(user_id);
