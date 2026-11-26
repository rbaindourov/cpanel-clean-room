-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Subsystem: cPanel Clean-Room Appliance Core Relational Schema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Schema Version Tracker
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 1. Users & RBAC Tenancy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'reseller', 'customer')),
  reseller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  quota_bytes INTEGER NOT NULL DEFAULT 10737418240,       -- 10 GB
  bandwidth_limit_bytes INTEGER NOT NULL DEFAULT 107374182400, -- 100 GB
  plan_name TEXT NOT NULL DEFAULT 'Standard',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending')),
  uid INTEGER NOT NULL DEFAULT 1001,
  gid INTEGER NOT NULL DEFAULT 1001,
  home_dir TEXT NOT NULL DEFAULT '/home/user',
  shell TEXT NOT NULL DEFAULT '/bin/bash',
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  two_factor_secret TEXT,
  two_factor_recovery_codes TEXT,
  last_totp_step INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reseller ON users(reseller_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ----------------------------------------------------------------------------
-- 2. Domains & Virtual Hosts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('primary', 'addon', 'subdomain', 'alias')),
  parent_domain_id TEXT REFERENCES domains(id) ON DELETE CASCADE,
  docroot TEXT NOT NULL,
  php_version TEXT NOT NULL DEFAULT '8.2',
  ssl_enabled INTEGER NOT NULL DEFAULT 0,
  ssl_status TEXT NOT NULL DEFAULT 'none' CHECK(ssl_status IN ('none', 'pending', 'active', 'expired', 'error')),
  ssl_provider TEXT DEFAULT 'letsencrypt',
  ssl_expires_at TEXT,
  force_https INTEGER NOT NULL DEFAULT 0,
  use_apache_backend INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(domain_name);
CREATE INDEX IF NOT EXISTS idx_domains_parent ON domains(parent_domain_id);
CREATE INDEX IF NOT EXISTS idx_domains_type ON domains(type);

CREATE TABLE IF NOT EXISTS domain_redirects (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK(status_code IN (301, 302)),
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK(match_type IN ('exact', 'regex')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domain_redirects_dom ON domain_redirects(domain_id);

-- ----------------------------------------------------------------------------
-- 3. DNS Zones & RFC 1035 Resource Records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dns_zones (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL UNIQUE REFERENCES domains(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  primary_ns TEXT NOT NULL DEFAULT 'ns1.cleanpanel.local.',
  admin_email TEXT NOT NULL DEFAULT 'hostmaster.cleanpanel.local.',
  serial INTEGER NOT NULL,
  refresh INTEGER NOT NULL DEFAULT 10800,
  retry INTEGER NOT NULL DEFAULT 3600,
  expire INTEGER NOT NULL DEFAULT 604800,
  minimum_ttl INTEGER NOT NULL DEFAULT 300,
  synced_cloudflare INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dns_zones_domain_name ON dns_zones(domain_name);

CREATE TABLE IF NOT EXISTS dns_records (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS', 'SOA', 'PTR')),
  value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 300,
  priority INTEGER,
  weight INTEGER,
  port INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dns_records_zone ON dns_records(zone_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_domain ON dns_records(domain_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_lookup ON dns_records(name, type);

-- ----------------------------------------------------------------------------
-- 4. Email Suite (Mailboxes, Forwarders & Autoresponders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  local_part TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  quota_bytes INTEGER NOT NULL DEFAULT 1073741824,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  suspended_login INTEGER NOT NULL DEFAULT 0,
  suspended_incoming INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_domain ON mailboxes(domain_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON mailboxes(email);

CREATE TABLE IF NOT EXISTS mail_forwarders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  is_catch_all INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, source_address, destination_address)
);

CREATE INDEX IF NOT EXISTS idx_forwarders_user ON mail_forwarders(user_id);
CREATE INDEX IF NOT EXISTS idx_forwarders_domain ON mail_forwarders(domain_id);
CREATE INDEX IF NOT EXISTS idx_forwarders_source ON mail_forwarders(source_address);

CREATE TABLE IF NOT EXISTS email_autoresponders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  local_part TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  interval_hours INTEGER NOT NULL DEFAULT 8,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_autoresponders_user ON email_autoresponders(user_id);

-- ----------------------------------------------------------------------------
-- 5. MySQL / MariaDB Databases & Users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mysql_databases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  db_name TEXT NOT NULL UNIQUE,
  charset TEXT NOT NULL DEFAULT 'utf8mb4',
  collation TEXT NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mysql_dbs_user ON mysql_databases(user_id);
CREATE INDEX IF NOT EXISTS idx_mysql_dbs_name ON mysql_databases(db_name);

CREATE TABLE IF NOT EXISTS mysql_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  db_user TEXT NOT NULL UNIQUE,
  remote_host TEXT NOT NULL DEFAULT 'localhost',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mysql_users_user ON mysql_users(user_id);
CREATE INDEX IF NOT EXISTS idx_mysql_users_dbuser ON mysql_users(db_user);

CREATE TABLE IF NOT EXISTS mysql_database_grants (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES mysql_databases(id) ON DELETE CASCADE,
  database_user_id TEXT NOT NULL REFERENCES mysql_users(id) ON DELETE CASCADE,
  privileges TEXT NOT NULL DEFAULT 'ALL PRIVILEGES',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(database_id, database_user_id)
);

CREATE INDEX IF NOT EXISTS idx_grants_db ON mysql_database_grants(database_id);
CREATE INDEX IF NOT EXISTS idx_grants_user ON mysql_database_grants(database_user_id);

CREATE TABLE IF NOT EXISTS remote_mysql_ips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_or_cidr TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, ip_or_cidr)
);

CREATE INDEX IF NOT EXISTS idx_remote_mysql_ips_user ON remote_mysql_ips(user_id);

-- ----------------------------------------------------------------------------
-- 6. Cron Jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minute TEXT NOT NULL DEFAULT '*',
  hour TEXT NOT NULL DEFAULT '*',
  day TEXT NOT NULL DEFAULT '*',
  month TEXT NOT NULL DEFAULT '*',
  weekday TEXT NOT NULL DEFAULT '*',
  command TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_user ON cron_jobs(user_id);

-- ----------------------------------------------------------------------------
-- 7. API Tokens & Revocation (Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT '*',
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);

CREATE TABLE IF NOT EXISTS sessions_revoked (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_revoked_exp ON sessions_revoked(expires_at);

-- ----------------------------------------------------------------------------
-- 8. Subusers & Contact Preferences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subusers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '["ftp","email"]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subusers_user ON subusers(user_id);

CREATE TABLE IF NOT EXISTS contact_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  notify_at_80 INTEGER NOT NULL DEFAULT 1,
  notify_at_90 INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 9. Audit Logs & Impersonation Audit Trail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  impersonator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'failure')),
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_impersonator ON audit_logs(impersonator_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
