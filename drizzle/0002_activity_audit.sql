CREATE TABLE taskextreme_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL, section TEXT NOT NULL, concept TEXT NOT NULL, entity_id TEXT NOT NULL, company_id TEXT NOT NULL, company_name TEXT NOT NULL, workspace_id TEXT NOT NULL, workspace_name TEXT NOT NULL, occurred_at TEXT NOT NULL, changes TEXT NOT NULL, search_text TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX taskextreme_audit_actor_date ON taskextreme_audit(actor_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX taskextreme_audit_action_date ON taskextreme_audit(action, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX taskextreme_audit_section_date ON taskextreme_audit(section, occurred_at DESC);
--> statement-breakpoint
CREATE VIRTUAL TABLE taskextreme_audit_search USING fts5(search_text, content='taskextreme_audit', content_rowid='id');
--> statement-breakpoint
CREATE TRIGGER taskextreme_audit_search_insert AFTER INSERT ON taskextreme_audit BEGIN INSERT INTO taskextreme_audit_search(rowid, search_text) VALUES (new.id,new.search_text); END;
--> statement-breakpoint
CREATE TRIGGER taskextreme_audit_no_update BEFORE UPDATE ON taskextreme_audit BEGIN SELECT RAISE(ABORT,'El log de actividades no puede modificarse'); END;
--> statement-breakpoint
CREATE TRIGGER taskextreme_audit_no_delete BEFORE DELETE ON taskextreme_audit BEGIN SELECT RAISE(ABORT,'El log de actividades no puede eliminarse'); END;
