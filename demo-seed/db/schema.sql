-- Guarded file: the referee asks a human before any edit under db/.
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE tasks (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
