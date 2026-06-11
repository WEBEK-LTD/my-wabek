-- Status page subscribers
CREATE TABLE IF NOT EXISTS status_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email','phone')),
  value TEXT NOT NULL,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(value)
);

-- Status incidents (admin-managed)
CREATE TABLE IF NOT EXISTS status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'resolved' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  duration TEXT,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status contact messages
CREATE TABLE IF NOT EXISTS status_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: public can insert, service_role can read all
ALTER TABLE status_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_subscribe" ON status_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "service_role_subscribers" ON status_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_incidents" ON status_incidents FOR SELECT USING (true);
CREATE POLICY "service_role_incidents" ON status_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_insert_messages" ON status_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "service_role_messages" ON status_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
