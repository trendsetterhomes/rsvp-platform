CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  party_label TEXT,
  max_party_size INTEGER NOT NULL DEFAULT 1,
  email TEXT,
  phone TEXT,
  notes TEXT,
  rsvp_status TEXT NOT NULL DEFAULT 'pending',
  attending_count INTEGER,
  guest_notes TEXT,
  responded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_search_name ON guests(search_name);

CREATE TABLE IF NOT EXISTS event_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  event_name TEXT NOT NULL DEFAULT 'Our Event',
  event_date TEXT NOT NULL DEFAULT '',
  event_time TEXT NOT NULL DEFAULT '',
  event_location TEXT NOT NULL DEFAULT '',
  event_description TEXT NOT NULL DEFAULT '',
  rsvp_deadline TEXT NOT NULL DEFAULT '',
  header_image_url TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT '#8a6d3b'
);

INSERT OR IGNORE INTO event_settings (id, event_name, event_description)
VALUES (1, 'Trendsetter Homes Charity Dinner', 'We would be honored to have you join us for an evening celebrating our community.');
