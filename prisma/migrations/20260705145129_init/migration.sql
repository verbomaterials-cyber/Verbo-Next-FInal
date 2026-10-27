-- CreateEnum
CREATE TYPE "SectionOrderMode" AS ENUM ('FIXED', 'MIXED');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('READING', 'WRITING', 'LISTENING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "InputMedia" AS ENUM ('TEXT', 'AUDIO', 'IMAGE', 'VIDEO', 'CONVERSATION');

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('MULTIPLE_CHOICE', 'DRAG_SELECT', 'FILL_BLANK', 'TYPE_TEXT', 'AUDIO_RECORDING', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "TimingMode" AS ENUM ('PER_QUESTION', 'PER_SECTION');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ATTEMPT_PENDING_REVIEW');

-- CreateTable
CREATE TABLE "ExamType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "totalDurationMinutes" INTEGER NOT NULL,
    "sectionOrderMode" "SectionOrderMode" NOT NULL,
    "hasAdaptiveLogic" BOOLEAN NOT NULL DEFAULT false,
    "subscoreDefinitions" JSONB NOT NULL,
    "scoreScale" JSONB NOT NULL,
    "themeConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER,
    "durationMinutes" INTEGER NOT NULL,
    "skillsMeasured" "Skill"[],

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionType" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputMedia" "InputMedia" NOT NULL,
    "responseType" "ResponseType" NOT NULL,
    "timingMode" "TimingMode" NOT NULL,
    "timePerItemSeconds" INTEGER,
    "prepTimeSeconds" INTEGER,
    "replaysAllowed" INTEGER,
    "isScored" BOOLEAN NOT NULL DEFAULT true,
    "subscoreMapping" TEXT[],
    "adminFieldSchema" JSONB NOT NULL,

    CONSTRAINT "QuestionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamVersion" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hasFeedback" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExamVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionTypeId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "promptContent" JSONB NOT NULL,
    "correctAnswer" JSONB,
    "feedbackText" TEXT,
    "difficultyLevel" INTEGER,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedVersions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "overallScore" JSONB,
    "subscores" JSONB,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerContent" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "attemptId" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamType_slug_key" ON "ExamType"("slug");

-- CreateIndex
CREATE INDEX "Section_examTypeId_idx" ON "Section"("examTypeId");

-- CreateIndex
CREATE INDEX "QuestionType_sectionId_idx" ON "QuestionType"("sectionId");

-- CreateIndex
CREATE INDEX "ExamVersion_examTypeId_idx" ON "ExamVersion"("examTypeId");

-- CreateIndex
CREATE INDEX "Question_examVersionId_order_idx" ON "Question"("examVersionId", "order");

-- CreateIndex
CREATE INDEX "Question_questionTypeId_idx" ON "Question"("questionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_accessCode_key" ON "Enrollment"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_examTypeId_key" ON "Enrollment"("studentId", "examTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Attempt_studentId_idx" ON "Attempt"("studentId");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- CreateIndex
CREATE INDEX "Response_questionId_isFlagged_idx" ON "Response"("questionId", "isFlagged");

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_questionId_key" ON "Response"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionType" ADD CONSTRAINT "QuestionType_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamVersion" ADD CONSTRAINT "ExamVersion_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionTypeId_fkey" FOREIGN KEY ("questionTypeId") REFERENCES "QuestionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
