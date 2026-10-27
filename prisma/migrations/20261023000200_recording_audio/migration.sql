CREATE TABLE "Recording" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Recording_attemptId_questionId_key" ON "Recording"("attemptId", "questionId");
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
