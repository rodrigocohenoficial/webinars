-- AlterTable
ALTER TABLE "public"."Webinar" ADD COLUMN     "audienciaMinima" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "mostrarAudiencia" BOOLEAN NOT NULL DEFAULT true;
