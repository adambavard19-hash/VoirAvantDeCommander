-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "facadeAssetId" TEXT,
ADD COLUMN     "interiorAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_facadeAssetId_fkey" FOREIGN KEY ("facadeAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_interiorAssetId_fkey" FOREIGN KEY ("interiorAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

