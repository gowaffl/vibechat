-- Create system user for system messages
INSERT OR IGNORE INTO user (id, name, bio, image, hasCompletedOnboarding, createdAt, updatedAt)
VALUES ('system', 'System', NULL, NULL, true, datetime('now'), datetime('now'));
