CREATE TABLE vps_credentials (
 user_id TEXT PRIMARY KEY,
 password_hash TEXT NOT NULL,
 must_change INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL
);
CREATE TABLE vps_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES vps_credentials(user_id) ON DELETE CASCADE
);
CREATE INDEX vps_sessions_expiry ON vps_sessions(expires_at);
CREATE TABLE vps_login_limits (key TEXT PRIMARY KEY,failures INTEGER NOT NULL,reset_at INTEGER NOT NULL);
