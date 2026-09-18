-- CreateTable
CREATE TABLE "public"."Reacao" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "videoTimeSec" INTEGER NOT NULL,
    "sessionId" TEXT,
    "registrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reacao_webinarId_videoTimeSec_idx" ON "public"."Reacao"("webinarId", "videoTimeSec");

-- CreateIndex
CREATE INDEX "Reacao_sessionId_videoTimeSec_idx" ON "public"."Reacao"("sessionId", "videoTimeSec");

-- AddForeignKey
ALTER TABLE "public"."Reacao" ADD CONSTRAINT "Reacao_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "public"."Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reacao" ADD CONSTRAINT "Reacao_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reacao" ADD CONSTRAINT "Reacao_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
