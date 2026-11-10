CREATE TABLE nexo_state (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE nexo_accounts (auth_id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE nexo_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, created_by TEXT NOT NULL, record TEXT NOT NULL, deleted_at TEXT, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX nexo_updates_task ON nexo_updates(task_id);
--> statement-breakpoint
CREATE TABLE nexo_clock (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE nexo_files (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE nexo_filechunks (file_id TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(file_id, seq));
