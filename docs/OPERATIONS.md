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
3. Пересоберите образ:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

## Очистка логов и места
Docker может занимать много места. Используйте:
```bash
docker system prune -f
```

## Устранение неполадок
- **Контейнер не стартует:** Проверьте логи `docker logs contador-app`.
- **Ошибка базы данных:** Убедитесь, что `contador-db` запущен и доступен.
- **Порт занят:** Если порт 3030 занят другим приложением, измените его в `docker-compose.yml` и `.env`.
