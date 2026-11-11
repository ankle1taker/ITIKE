-- DropIndex
DROP INDEX "Payment_bookingId_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "Payment_bookingId_attemptNumber_idx" ON "Payment"("bookingId", "attemptNumber");
