# Обслуживание и эксплуатация Contador

## Архитектура развёртывания

```
Internet → nginx (contador.uz) → localhost:3030 → Docker: contador-app
                                                 → Docker: contador-db (PostgreSQL 16)
```

Оба контейнера в сети `contador_contador-net`. База данных не публикует порты наружу — доступна только внутри сети.

---

## Docker: сборка и запуск

> Внимание: `docker-compose up --build` не работает из-за legacy Docker Compose 1.29.2 и прав доступа к `postgres_data`. Используйте ручные команды.

### Пересборка и перезапуск приложения

```bash
# 1. Скопировать исходники во временную директорию (без postgres_data)
rsync -av --exclude=postgres_data --exclude=.next --exclude=node_modules \
  /home/admin1/contador/ /tmp/contador-build/

# 2. Собрать образ
docker build -t contador-app -f /tmp/contador-build/Dockerfile /tmp/contador-build/

# 3. Остановить и удалить старый контейнер
docker stop contador-app 2>/dev/null || true
docker rm contador-app 2>/dev/null || true

# 4. Запустить новый контейнер
docker run -d \
  --name contador-app \
  --network contador_contador-net \
  -p 3030:3030 \
  --env-file /home/admin1/contador/.env \
  contador-app
```

### Проверка статуса

```bash
# Убедиться, что оба контейнера запущены
docker ps

# Проверить, что приложение отвечает
curl -s -o /dev/null -w "%{http_code}" http://localhost:3030/api/templates

# Логи приложения
docker logs contador-app --tail 50 -f

# Логи БД
docker logs 319b5e2913a4_contador-db --tail 20
```

### Перезапуск без пересборки (если образ не менялся)

```bash
docker stop contador-app && docker rm contador-app
docker run -d \
  --name contador-app \
  --network contador_contador-net \
  -p 3030:3030 \
  --env-file /home/admin1/contador/.env \
  contador-app
```

---

## База данных

### Прямой доступ к PostgreSQL

```bash
docker exec -it 319b5e2913a4_contador-db psql -U user -d contador
```

### Применение миграций Prisma

```bash
# Из директории проекта
npx prisma migrate deploy

# Пересгенерировать клиент после изменения схемы
npx prisma generate
```

### Сидинг мастер-данных (340 счетов + 22 шаблона)

```bash
npx prisma db seed
```

> Сидинг безопасен — использует `upsert`, не удаляет существующие организации и транзакции.

---

## Резервное копирование

### Создать дамп базы данных

```bash
docker exec -t 319b5e2913a4_contador-db \
  pg_dump -U user -d contador -F c -f /tmp/backup.dump

# Скопировать дамп на хост
docker cp 319b5e2913a4_contador-db:/tmp/backup.dump \
  /home/admin1/backups/contador_$(date +%F).dump
```

### Восстановление из дампа

```bash
# Скопировать файл в контейнер
docker cp /home/admin1/backups/contador_2026-01-01.dump \
  319b5e2913a4_contador-db:/tmp/restore.dump

# Восстановить
docker exec -it 319b5e2913a4_contador-db \
  pg_restore -U user -d contador -c /tmp/restore.dump
```

---

## Разработка (без Docker)

```bash
cd /home/admin1/contador

# Установить зависимости
npm install

# Сгенерировать Prisma клиент
npx prisma generate

# Запустить dev-сервер (порт 3030)
npm run dev

# Сборка production
npm run build
npm run start
```

Переменные среды — в файле `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/contador"
JWT_SECRET="..."
OPENAI_API_KEY="..."
```

---

## Nginx (производственный сервер)

Конфигурация nginx проксирует `contador.uz` на `localhost:3030`. Перезагрузка nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Мониторинг

```bash
# Использование ресурсов контейнерами
docker stats contador-app 319b5e2913a4_contador-db

# Размер базы данных
docker exec 319b5e2913a4_contador-db \
  psql -U user -d contador -c "SELECT pg_size_pretty(pg_database_size('contador'));"

# Количество транзакций по организациям
docker exec 319b5e2913a4_contador-db \
  psql -U user -d contador -c \
  "SELECT o.name, COUNT(t.id) FROM transactions t JOIN organizations o ON t.organization_id = o.id GROUP BY o.name;"
```

---

*Contador v2.0 — Production Ops*
