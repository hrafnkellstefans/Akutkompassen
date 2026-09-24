CREATE TABLE counts (document_id TEXT PRIMARY KEY, opens INTEGER NOT NULL DEFAULT 0 CHECK(opens >= 0));
CREATE TABLE events (event_id TEXT PRIMARY KEY, document_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX events_expiry ON events(created_at);
CREATE TRIGGER count_open AFTER INSERT ON events BEGIN
 INSERT INTO counts(document_id, opens) VALUES (NEW.document_id, 1)
 ON CONFLICT(document_id) DO UPDATE SET opens = opens + 1;
END;
