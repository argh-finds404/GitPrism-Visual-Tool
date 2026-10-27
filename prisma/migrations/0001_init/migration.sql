-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ObjectType" AS ENUM ('BLOB', 'TREE', 'COMMIT');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "head" TEXT NOT NULL DEFAULT 'refs/heads/main',

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitObject" (
    "workspaceId" TEXT NOT NULL,
    "oid" CHAR(40) NOT NULL,
    "type" "ObjectType" NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitObject_pkey" PRIMARY KEY ("workspaceId","oid")
);

-- CreateTable
CREATE TABLE "Ref" (
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" CHAR(40) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ref_pkey" PRIMARY KEY ("workspaceId","name")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "files" JSONB NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitObject_workspaceId_type_idx" ON "GitObject"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "Project_expiresAt_idx" ON "Project"("expiresAt");

-- AddForeignKey
ALTER TABLE "GitObject" ADD CONSTRAINT "GitObject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ref" ADD CONSTRAINT "Ref_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

