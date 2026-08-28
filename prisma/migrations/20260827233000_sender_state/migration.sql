ALTER TABLE "SenderAccount"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Make the oldest sender the initial default for existing users.
UPDATE "SenderAccount" AS sender
SET "isDefault" = true
WHERE sender.id IN (
  SELECT DISTINCT ON ("userId") id
  FROM "SenderAccount"
  ORDER BY "userId", "createdAt" ASC
);
