-- CreateEnum
CREATE TYPE "BusLayoutType" AS ENUM ('TWO_PLUS_TWO', 'TWO_PLUS_ONE', 'THREE_PLUS_TWO', 'THREE_PLUS_ONE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('REGULAR', 'PREMIUM', 'VIP', 'ACCESSIBLE');

-- AlterTable
ALTER TABLE "Bus" ADD COLUMN     "layoutId" TEXT;

-- AlterTable
ALTER TABLE "Seat" ADD COLUMN     "floorNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isBookable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seatType" "SeatType" NOT NULL DEFAULT 'REGULAR';

-- CreateTable
CREATE TABLE "BusLayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "layoutType" "BusLayoutType" NOT NULL DEFAULT 'CUSTOM',
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "configuration" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusLayout_companyId_idx" ON "BusLayout"("companyId");

-- CreateIndex
CREATE INDEX "BusLayout_companyId_isActive_idx" ON "BusLayout"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusLayout_companyId_code_key" ON "BusLayout"("companyId", "code");

-- CreateIndex
CREATE INDEX "Bus_companyId_layoutId_idx" ON "Bus"("companyId", "layoutId");

-- CreateIndex
CREATE INDEX "Seat_busId_status_idx" ON "Seat"("busId", "status");

-- AddForeignKey
ALTER TABLE "BusLayout" ADD CONSTRAINT "BusLayout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "BusLayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
