-- CreateEnum
CREATE TYPE "public"."SessionKind" AS ENUM ('SCHEDULED', 'JIT', 'REPLAY');

-- CreateEnum
CREATE TYPE "public"."ChatKind" AS ENUM ('FAKE', 'REAL', 'HOST');

-- CreateEnum
CREATE TYPE "public"."ChatStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateTable
CREATE TABLE "public"."Webinar" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "hostName" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "videoUrl" TEXT,
    "durationSec" INTEGER,
    "aspectRatio" TEXT NOT NULL DEFAULT '16/9',
    "waitingVideoUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "jitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jitDelayMin" INTEGER NOT NULL DEFAULT 10,
    "joinWindowMin" INTEGER NOT NULL DEFAULT 0,
    "visibleSlots" INTEGER NOT NULL DEFAULT 4,
    "chatAoVivo" BOOLEAN NOT NULL DEFAULT false,
    "legendas" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "ctaDescription" TEXT,
    "ctaAtSec" INTEGER,
    "ctaUntilSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleRule" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "kind" "public"."SessionKind" NOT NULL DEFAULT 'SCHEDULED',
    "ruleKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Registration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "watchedUntilSec" INTEGER NOT NULL DEFAULT 0,
    "ctaClickedAt" TIMESTAMP(3),
    "ctaClickedAtSec" INTEGER,
    "confirmationSentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "startNoticeSentAt" TIMESTAMP(3),
    "replaySentAt" TIMESTAMP(3),
    "whatsappSentAt" TIMESTAMP(3),
    "whatsappSentId" TEXT,
    "whatsappReminderAt" TIMESTAMP(3),
    "whatsappReminderId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrer" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "replayOfId" TEXT,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "videoTimeSec" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "public"."ChatKind" NOT NULL,
    "status" "public"."ChatStatus" NOT NULL DEFAULT 'PENDING',
    "sessionId" TEXT,
    "registrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Poll" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "atSec" INTEGER NOT NULL,
    "untilSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Webinar_slug_key" ON "public"."Webinar"("slug");

-- CreateIndex
CREATE INDEX "ScheduleRule_webinarId_idx" ON "public"."ScheduleRule"("webinarId");

-- CreateIndex
CREATE INDEX "Session_webinarId_startsAt_idx" ON "public"."Session"("webinarId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_webinarId_startsAt_ruleKey_key" ON "public"."Session"("webinarId", "startsAt", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_token_key" ON "public"."Registration"("token");

-- CreateIndex
CREATE INDEX "Registration_sessionId_idx" ON "public"."Registration"("sessionId");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "public"."Registration"("email");

-- CreateIndex
CREATE INDEX "Registration_replayOfId_idx" ON "public"."Registration"("replayOfId");

-- CreateIndex
CREATE INDEX "ChatMessage_webinarId_status_videoTimeSec_idx" ON "public"."ChatMessage"("webinarId", "status", "videoTimeSec");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_videoTimeSec_idx" ON "public"."ChatMessage"("sessionId", "videoTimeSec");

-- CreateIndex
CREATE INDEX "ChatMessage_webinarId_status_createdAt_idx" ON "public"."ChatMessage"("webinarId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_webinarId_atSec_idx" ON "public"."Poll"("webinarId", "atSec");

-- CreateIndex
CREATE INDEX "PollOption_pollId_order_idx" ON "public"."PollOption"("pollId", "order");

-- CreateIndex
CREATE INDEX "PollVote_pollId_optionId_idx" ON "public"."PollVote"("pollId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_registrationId_key" ON "public"."PollVote"("pollId", "registrationId");

-- AddForeignKey
ALTER TABLE "public"."ScheduleRule" ADD CONSTRAINT "ScheduleRule_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "public"."Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "public"."Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Registration" ADD CONSTRAINT "Registration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Registration" ADD CONSTRAINT "Registration_replayOfId_fkey" FOREIGN KEY ("replayOfId") REFERENCES "public"."Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "public"."Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Poll" ADD CONSTRAINT "Poll_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "public"."Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
