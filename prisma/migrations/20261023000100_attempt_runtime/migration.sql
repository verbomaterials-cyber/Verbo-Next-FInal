-- Nullable for existing attempts; initialized on the next authorized visit.
ALTER TABLE "Attempt" ADD COLUMN "runtimeState" JSONB;
