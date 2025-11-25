-- Step 1: Add messageHistory column to group_settings table
ALTER TABLE `group_settings` ADD COLUMN `messageHistory` TEXT NOT NULL DEFAULT '[]';

-- Step 2: Copy the first user's messageHistory to group_settings (they should all be the same)
UPDATE `group_settings`
SET `messageHistory` = (
  SELECT `messageHistory` FROM `user` LIMIT 1
)
WHERE `id` = 'global-chat';

-- Step 3: Drop messageHistory column from user table
-- Create a new table without the messageHistory column
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Anonymous',
    "bio" TEXT,
    "image" TEXT,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table to new table
INSERT INTO "new_user" ("id", "name", "bio", "image", "hasCompletedOnboarding", "createdAt", "updatedAt")
SELECT "id", "name", "bio", "image", "hasCompletedOnboarding", "createdAt", "updatedAt"
FROM "user";

-- Drop the old table
DROP TABLE "user";

-- Rename the new table to the original name
ALTER TABLE "new_user" RENAME TO "user";
