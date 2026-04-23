-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  author TEXT DEFAULT 'TryNex Team',
  author_bio TEXT,
  author_avatar_url TEXT,
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  reading_time_override INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Backfill columns added later
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS author_bio TEXT,
  ADD COLUMN IF NOT EXISTS author_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reading_time_override INTEGER;

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts (published);
CREATE INDEX IF NOT EXISTS blog_posts_created_at_idx ON blog_posts (created_at DESC);
