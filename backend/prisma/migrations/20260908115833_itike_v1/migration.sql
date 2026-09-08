/*
  Warnings:

  - The values [PENDING] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `agentId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Booking` table. All the data in the column will be lost.
  - You are about to alter the column `totalAmount` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to drop the column `passengerIdNum` on the `BookingSeat` table. All the data in the column will be lost.
  - You are about to drop the column `passengerIdType` on the `BookingSeat` table. All the data in the column will be lost.
  - You are about to drop the column `passengerName` on the `BookingSeat` table. All the data in the column will be lost.
  - You are about to drop the column `passengerPhone` on the `BookingSeat` table. All the data in the column will be lost.
  - You are about to drop the column `seatNumber` on the `BookingSeat` table. All the data in the column will be lost.
  - You are about to drop the column `amenities` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `operatorId` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `plateNumber` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `seatLayout` on the `Bus` table. All the data in the column will be lost.
  - The `status` column on the `Bus` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `providerRef` on the `Payment` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to drop the column `distanceKm` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `durationMin` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `driverId` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `operatorId` on the `Trip` table. All the data in the column will be lost.
  - You are about to alter the column `basePrice` on the `Trip` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Operator` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[bookingNumber]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tripSeatId]` on the table `BookingSeat` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,registrationNumber]` on the table `Bus` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerReference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookingNumber` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `BookingSeat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passengerId` to the `BookingSeat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tripSeatId` to the `BookingSeat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Bus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registrationNumber` to the `Bus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Bus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Route` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'COMPANY_ADMIN', 'COMPANY_OPERATOR', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BusStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TripSeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'CONFIRMED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'CARD');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('HELD', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "Bus" DROP CONSTRAINT "Bus_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_operatorId_fkey";

-- DropIndex
DROP INDEX "Bus_plateNumber_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "agentId",
DROP COLUMN "userId",
ADD COLUMN     "bookingNumber" TEXT NOT NULL,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "dropoffStopId" TEXT,
ADD COLUMN     "termsSnapshot" JSONB,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "BookingSeat" DROP COLUMN "passengerIdNum",
DROP COLUMN "passengerIdType",
DROP COLUMN "passengerName",
DROP COLUMN "passengerPhone",
DROP COLUMN "seatNumber",
ADD COLUMN     "amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "passengerId" TEXT NOT NULL,
ADD COLUMN     "tripSeatId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Bus" DROP COLUMN "amenities",
DROP COLUMN "operatorId",
DROP COLUMN "plateNumber",
DROP COLUMN "seatLayout",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "registrationNumber" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "BusStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "providerRef",
ADD COLUMN     "method" "PaymentMethod" NOT NULL,
ADD COLUMN     "providerReference" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Route" DROP COLUMN "distanceKm",
DROP COLUMN "durationMin",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "driverId",
DROP COLUMN "operatorId",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "arrivalTime" DROP NOT NULL,
ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
DROP COLUMN "password",
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "Operator";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "columnNumber" INTEGER,
    "status" "SeatStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripSeat" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "TripSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPassenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "idType" TEXT,
    "idNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingHold" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tripSeatId" TEXT NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "qrCodeValue" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moreThan24HoursPct" DECIMAL(5,2) NOT NULL,
    "twelveTo24HoursPct" DECIMAL(5,2) NOT NULL,
    "lessThan12HoursPct" DECIMAL(5,2) NOT NULL,
    "afterDeparturePct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancellation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "CancellationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_registrationNumber_key" ON "Company"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Company_email_key" ON "Company"("email");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Seat_busId_idx" ON "Seat"("busId");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_busId_seatNumber_key" ON "Seat"("busId", "seatNumber");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop"("routeId", "sequence");

-- CreateIndex
CREATE INDEX "TripSeat_tripId_status_idx" ON "TripSeat"("tripId", "status");

-- CreateIndex
CREATE INDEX "TripSeat_seatId_idx" ON "TripSeat"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "TripSeat_tripId_seatId_key" ON "TripSeat"("tripId", "seatId");

-- CreateIndex
CREATE INDEX "BookingPassenger_bookingId_idx" ON "BookingPassenger"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHold_bookingId_idx" ON "BookingHold"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHold_tripSeatId_status_idx" ON "BookingHold"("tripSeatId", "status");

-- CreateIndex
CREATE INDEX "BookingHold_expiresAt_idx" ON "BookingHold"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_bookingId_key" ON "Ticket"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrCodeValue_key" ON "Ticket"("qrCodeValue");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_companyId_key" ON "CancellationPolicy"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Cancellation_bookingId_key" ON "Cancellation"("bookingId");

-- CreateIndex
CREATE INDEX "Cancellation_status_idx" ON "Cancellation"("status");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_tripId_status_idx" ON "Booking"("tripId", "status");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_expiresAt_idx" ON "Booking"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_tripSeatId_key" ON "BookingSeat"("tripSeatId");

-- CreateIndex
CREATE INDEX "BookingSeat_bookingId_idx" ON "BookingSeat"("bookingId");

-- CreateIndex
CREATE INDEX "BookingSeat_passengerId_idx" ON "BookingSeat"("passengerId");

-- CreateIndex
CREATE INDEX "Bus_companyId_idx" ON "Bus"("companyId");

-- CreateIndex
CREATE INDEX "Bus_status_idx" ON "Bus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_companyId_registrationNumber_key" ON "Bus"("companyId", "registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Route_origin_destination_idx" ON "Route"("origin", "destination");

-- CreateIndex
CREATE INDEX "Route_isActive_idx" ON "Route"("isActive");

-- CreateIndex
CREATE INDEX "Trip_companyId_idx" ON "Trip"("companyId");

-- CreateIndex
CREATE INDEX "Trip_routeId_idx" ON "Trip"("routeId");

-- CreateIndex
CREATE INDEX "Trip_busId_idx" ON "Trip"("busId");

-- CreateIndex
CREATE INDEX "Trip_departureTime_idx" ON "Trip"("departureTime");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSeat" ADD CONSTRAINT "TripSeat_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSeat" ADD CONSTRAINT "TripSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dropoffStopId_fkey" FOREIGN KEY ("dropoffStopId") REFERENCES "RouteStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_tripSeatId_fkey" FOREIGN KEY ("tripSeatId") REFERENCES "TripSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_tripSeatId_fkey" FOREIGN KEY ("tripSeatId") REFERENCES "TripSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
