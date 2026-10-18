
-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "entranceVideoAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_entranceVideoAssetId_fkey" FOREIGN KEY ("entranceVideoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

