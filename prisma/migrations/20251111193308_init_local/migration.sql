/*
  Warnings:

  - You are about to drop the column `paymentProof` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "paymentProof",
ADD COLUMN     "paymentUrl" TEXT;
