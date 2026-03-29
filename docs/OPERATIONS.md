# Обслуживание и эксплуатация

## Резервное копирование (Backups)
Ваши данные хранятся в Docker-томе или папке `postgres_data`.

### Ручной бэкап:
```bash
docker exec -t contador-db pg_dump -U user contador > backup_$(date +%Y%m%d).sql
```

### Восстановление:
```bash
cat backup_file.sql | docker exec -i contador-db psql -U user contador
```

## Обновление системы
1. Сделайте бэкап.
2. Подтяните новые изменения из Git.
3. Примените изменения схемы БД:
   ```bash
   npx prisma db push
   ```
4. Пересоберите образ:
   ```bash
   docker-compose up -d --build
   ```

## Разблокировка остатков (Admin only)
Если по ошибке была нажата кнопка «Зафиксировать остатки», и вам нужно снова внести изменения:
1. Подключитесь к базе данных.
2. Выполните SQL:
   ```sql
   UPDATE "SystemSettings" SET is_initial_balance_fixed = false WHERE organization_id = 'YOUR_ORG_ID';
   ```
   *Примечание: Это действие требует прав администратора базы данных.*

## Очистка логов и места
Docker может занимать много места. Используйте:
```bash
docker system prune -f
```

## Устранение неполадок
- **Контейнер не стартует:** Проверьте логи `docker logs contador-app`.
- **Ошибка базы данных:** Убедитесь, что `contador-db` запущен и доступен.
- **Порт занят:** Если порт 3030 занят другим приложением, измените его в `docker-compose.yml` и `.env`.
