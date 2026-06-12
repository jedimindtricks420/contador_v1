-- Шаг 1: Исправление типов счетов
-- Миграция применяется через prisma db execute (не через migrate dev, чтобы не ресетить БД)

-- 1. Добавляем новые значения в enum AccountType
--    PostgreSQL позволяет добавлять значения к enum, но не удалять.
--    TRANSIT будет оставлен в enum (удалить нельзя без полного ресоздания).
--    Мы заменим все использования TRANSIT через скрипт migrate-account-types.ts

ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'INCOME';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'CONTRA_INCOME';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'EXPENSE';

-- 2. Добавляем поле is_postable в MasterAccount
ALTER TABLE "MasterAccount" ADD COLUMN IF NOT EXISTS "is_postable" BOOLEAN NOT NULL DEFAULT true;

-- 3. Добавляем поле is_postable в Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "is_postable" BOOLEAN NOT NULL DEFAULT true;
