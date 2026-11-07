-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "BookingPassenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
