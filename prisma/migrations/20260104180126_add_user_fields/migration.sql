-- CreateTable
CREATE TABLE "Story" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "illustrationb64" TEXT NOT NULL,
    "mainCharacter" TEXT NOT NULL,
    "plot" TEXT NOT NULL,
    "ending" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "literature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);
