-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_taskId_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
