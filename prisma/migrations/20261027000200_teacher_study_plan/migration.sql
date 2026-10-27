-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "focusSkills" "Skill"[] DEFAULT ARRAY[]::"Skill"[],
ADD COLUMN     "targetDate" TEXT,
ADD COLUMN     "targetScore" DOUBLE PRECISION,
ADD COLUMN     "teacherNote" TEXT,
ADD COLUMN     "weeklyGoal" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "teacherId" TEXT;

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE INDEX "Student_teacherId_idx" ON "Student"("teacherId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_weeklyGoal_check" CHECK ("weeklyGoal" BETWEEN 1 AND 7);
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "Teacher" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "Teacher" FROM authenticated; END IF;
END $$;
