-- Migration: enable_replica_identity
-- Description: Enable REPLICA IDENTITY FULL to get full row data on DELETE events

ALTER TABLE "reaction" REPLICA IDENTITY FULL;
ALTER TABLE "message" REPLICA IDENTITY FULL;

