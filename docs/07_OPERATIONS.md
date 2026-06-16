# 07 — Эксплуатация

**Документ:** Operations Guide  
**Версия:** 2.0  
**Дата:** 2026-06-16

---

## 1. Инфраструктура

| Компонент | Тип | Порт | Процесс |
|-----------|-----|------|---------|
| Contador v2 (основное приложение) | Next.js | 3032 | PM2 `contador-v2` |
| Admin Panel | Express.js | 3031 | Docker `contador-admin` |
| PostgreSQL 16 | Database | 5432 | Docker `db` |
| Nginx | Reverse Proxy | 80/443 | systemd |

**Расположение:** Azure VM, `/home/admin1/contador/`

---

## 2. PM2 — Contador v2

### Основные команды

```bash
# Статус
pm2 status

# Перезапуск (после обновления кода)
pm2 restart contador-v2

# Логи (реальное время)
pm2 logs contador-v2

# Логи (последние N строк)
pm2 logs contador-v2 --lines 100

# Остановить
pm2 stop contador-v2

# Запустить
pm2 start contador-v2
```

### Деплой обновлений

```bash
cd /home/admin1/contador/v2

# 1. Сборка (занимает 1–2 мин)
npm run build

# 2. Перезапуск
pm2 restart contador-v2

# 3. Проверка статуса
pm2 status contador-v2
```

### Настройка автозапуска PM2 после перезагрузки сервера

```bash
pm2 startup
pm2 save
```

### ecosystem.config.js (если нужен)

```javascript
module.exports = {
  apps: [{
    name: "contador-v2",
    cwd: "/home/admin1/contador/v2",
    script: "node_modules/.bin/next",
    args: "start -p 3032",
    env: { NODE_ENV: "production" }
  }]
};
```

---

## 3. Docker — Admin Panel

### Управление контейнером

```bash
# Статус
docker ps | grep contador-admin

# Логи
docker logs contador-admin

# Логи в реальном времени
docker logs -f contador-admin

# Перезапуск
docker restart contador-admin

# Остановить
docker stop contador-admin

# Запустить (уже существующий)
docker start contador-admin
```

### Пересборка и запуск admin

```bash
cd /home/admin1/contador

# Собрать образ
docker build -t contador-admin:new -f Dockerfile.admin .

# Остановить старый
docker stop contador-admin && docker rm contador-admin

# Запустить новый
docker run -d \
  --name contador-admin \
  --restart always \
  -p 3031:3031 \
  -e DATABASE_URL="postgresql://user:password@172.26.0.2:5432/contador" \
  -e V2_DATABASE_URL="postgresql://user:password@172.26.0.2:5432/contador_v2" \
  -e ADMIN_PORT=3031 \
  -e ADMIN_PASSWORD="supersecretadmin" \
  contador-admin:new
```

---

## 4. База данных PostgreSQL

### Подключение

```bash
# Прямое подключение к v2 БД
psql "postgresql://user:password@172.26.0.2:5432/contador_v2"

# Через docker exec (если db в Docker)
docker exec -it <postgres_container> psql -U user -d contador_v2
```

### Prisma миграции

```bash
cd /home/admin1/contador/v2

# Создать новую миграцию
npx prisma migrate dev --name <название_миграции>

# Применить на production (без интерактивного режима)
npx prisma migrate deploy

# Просмотр текущего состояния миграций
npx prisma migrate status

# Студия (GUI браузер для БД — только для разработки)
npx prisma studio
```

### Полезные SQL запросы

```sql
-- Количество записей по основным таблицам
SELECT
  (SELECT COUNT(*) FROM "Account") as accounts,
  (SELECT COUNT(*) FROM "Organization") as orgs,
  (SELECT COUNT(*) FROM "StagedTransaction") as transactions,
  (SELECT COUNT(*) FROM "Document") as documents,
  (SELECT COUNT(*) FROM "JournalEntry") as journal_entries;

-- Транзакции, требующие классификации
SELECT COUNT(*) FROM "StagedTransaction"
WHERE status = 'NEEDS_CLARIFICATION';

-- Размеры таблиц
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Активные периоды
SELECT o.name, p.year, p.month, p.status
FROM "Period" p
JOIN "Organization" o ON o.id = p."orgId"
WHERE p.status = 'OPEN'
ORDER BY o.name, p.year DESC, p.month DESC;

-- Проверка счёта 0200 (амортизация)
SELECT code, name, type FROM "Account" WHERE code = '0200';
```

---

## 5. Переменные окружения

### v2 приложение (`/home/admin1/contador/v2/.env`)

| Переменная | Обязательна | Описание |
|-----------|------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string для contador_v2 |
| `JWT_SECRET` | ✅ | Секрет для подписи JWT (минимум 32 байта) |
| `OPENAI_API_KEY` | ✅ | Ключ OpenAI для AI-классификатора |
| `PORT` | ✅ | Порт приложения (3032) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Публичный URL (https://contador.uz) |
| `SMTP_HOST` | ⬜ | SMTP хост для email |
| `SMTP_PORT` | ⬜ | SMTP порт (587) |
| `SMTP_USER` | ⬜ | SMTP логин |
| `SMTP_PASS` | ⬜ | SMTP пароль |
| `SMTP_FROM` | ⬜ | Email отправителя |

### Admin panel (`/home/admin1/contador/.env`)

| Переменная | Описание |
|-----------|---------|
| `ADMIN_PASSWORD` | Пароль от панели администратора |
| `ADMIN_PORT` | Порт admin (3031) |
| `V2_DATABASE_URL` | PostgreSQL для contador_v2 |
| `DATABASE_URL` | PostgreSQL для contador (legacy) |

---

## 6. Nginx

### Базовая конфигурация

```nginx
server {
    server_name contador.uz www.contador.uz;
    
    # v2 приложение
    location /v2/ {
        proxy_pass http://127.0.0.1:3032/v2/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Admin panel
    location /admin {
        proxy_pass http://127.0.0.1:3031;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Редирект корня
    location = / {
        return 301 /v2/dashboard;
    }
    
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/contador.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/contador.uz/privkey.pem;
}

server {
    listen 80;
    server_name contador.uz www.contador.uz;
    return 301 https://$host$request_uri;
}
```

### Управление nginx

```bash
# Проверить конфигурацию
nginx -t

# Перезагрузить конфигурацию без остановки
systemctl reload nginx

# Статус
systemctl status nginx
```

---

## 7. Резервное копирование

### БД PostgreSQL

```bash
# Дамп базы contador_v2
pg_dump "postgresql://user:password@172.26.0.2:5432/contador_v2" \
  -Fc -f /backups/contador_v2_$(date +%Y%m%d_%H%M%S).dump

# Восстановление
pg_restore -d "postgresql://user:password@172.26.0.2:5432/contador_v2" \
  -c /backups/contador_v2_20260616_120000.dump
```

### Скрипт автоматического бэкапа (cron)

```bash
# /etc/cron.d/contador-backup
0 3 * * * azureuser pg_dump "postgresql://user:password@172.26.0.2:5432/contador_v2" \
  -Fc -f /backups/contador_v2_$(date +%Y%m%d).dump && \
  find /backups -name "contador_v2_*.dump" -mtime +30 -delete
```

---

## 8. Мониторинг

### Проверка здоровья приложения

```bash
# HTTP healthcheck
curl -s -o /dev/null -w "%{http_code}" https://contador.uz/v2/api/health

# PM2 monitoring
pm2 monit

# Метрики приложения
pm2 show contador-v2
```

### Логи

```bash
# v2 приложение
pm2 logs contador-v2 --lines 200

# Admin panel
docker logs contador-admin --tail 100

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL (если в Docker)
docker logs <postgres_container> --tail 50
```

### Мониторинг долгих запросов PostgreSQL

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';
```

---

## 9. Решение типичных проблем

### v2 не отвечает

```bash
# Проверить статус PM2
pm2 status contador-v2

# Перезапустить
pm2 restart contador-v2

# Смотреть логи ошибок
pm2 logs contador-v2 --err --lines 50
```

### Ошибки подключения к БД

```bash
# Проверить доступность PostgreSQL
pg_isready -h 172.26.0.2 -p 5432

# Проверить DATABASE_URL в .env
grep DATABASE_URL /home/admin1/contador/v2/.env
```

### AI-классификатор не работает

```bash
# Проверить валидность ключа
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else d.get('error',{}).get('message'))"
```

### Ошибки Prisma после изменений схемы

```bash
cd /home/admin1/contador/v2
npx prisma generate
npm run build
pm2 restart contador-v2
```

### Счёт не найден при проводке

```sql
-- Проверить наличие счёта
SELECT code, name, type FROM "Account" WHERE code = '0200';

-- Количество счетов в БД
SELECT COUNT(*) FROM "Account";
-- Должно быть ≥ 214
```

---

## 10. Процедура деплоя

```bash
# 1. Обновить код (git pull или ручные правки)
cd /home/admin1/contador/v2

# 2. Установить зависимости (если менялся package.json)
npm install

# 3. Применить миграции (если менялась schema.prisma)
npx prisma migrate deploy

# 4. Пересобрать приложение
npm run build

# 5. Перезапустить
pm2 restart contador-v2

# 6. Проверить статус и логи
pm2 status && pm2 logs contador-v2 --lines 20
```

---

*Дата: 2026-06-16*
