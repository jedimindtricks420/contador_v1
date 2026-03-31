# Обслуживание и Техническая эксплуатация Contador v2.0

## 1. Контейнеризация (Docker)
Система работает в изолированных контейнерах:
- **`contador-app`**: Next.js приложение (Node.js 20+).
- **`contador-db`**: PostgreSQL 16 (порт 5433 снаружи).

### Основные команды
- **Пересборка и запуск:**
  ```bash
  docker compose up -d --build
  ```
- **Проверка логов:**
  ```bash
  docker compose logs -f app
  ```

## 2. База данных и Миграции (Prisma)
Все изменения схемы БД управляются через Prisma.

### Команды обслуживания
- **Применение миграций:**
  ```bash
  npx prisma migrate deploy
  ```
- **Первоначальный сединг (Master Data):**
  *Важно:* Эта команда загружает 22 отраслевых шаблона и ~800 мастер-счетов.
  ```bash
  npx prisma db seed
  ```
- **Обновление схемы:**
  ```bash
  npx prisma generate
  ```

## 3. Бэкап и Восстановление
Для создания дампа базы данных PostgreSQL:
```bash
docker exec -t contador-db pg_dumpall -c -U admin > backup_$(date +%F).sql
```
Восстановление из дампа:
```bash
cat backup_file.sql | docker exec -i contador-db psql -U admin
```

## 4. Отраслевые шаблоны (Seeding Logic)
Логика наполнения находится в `prisma/seed.ts`. При выполнении сединга:
1. Очищаются старые мастер-данные.
2. Загружается `MasterAccount` из JSON-данных (~840 позиций).
3. Создаются `IndustryTemplate` (22 отрасли).
4. Связываются счета с отраслями через `IndustryTemplateItem`.

---
*Status: Production Ops v2.0*
