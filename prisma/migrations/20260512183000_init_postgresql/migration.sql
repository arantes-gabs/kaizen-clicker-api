-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Score" (
    "id" SERIAL NOT NULL,
    "playerName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "improvementsJson" TEXT NOT NULL,
    "elapsedSeconds" INTEGER NOT NULL,
    "lastSaveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaveRequest" (
    "id" SERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Score_playerName_key" ON "Score"("playerName");

-- CreateIndex
CREATE UNIQUE INDEX "SaveRequest_requestId_key" ON "SaveRequest"("requestId");
