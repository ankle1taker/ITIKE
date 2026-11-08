-- DropIndex
DROP INDEX "BookingSeat_tripSeatId_key";

-- CreateIndex
CREATE INDEX "BookingSeat_tripSeatId_idx" ON "BookingSeat"("tripSeatId");
