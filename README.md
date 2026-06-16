# Java 面试进阶平台

面向 3-5 年 Java 后端工程师的进阶面试准备平台。

## Applications

- `apps/api`: Spring Boot backend.
- `apps/web`: Next.js public site.
- `apps/admin`: Vue admin console.

## V1 Scope

V1 focuses on four topics: 并发、JVM、MySQL、Redis.

## Local Test Environment

The backend default profile is `local`.

```bash
mysql -uroot -p123456 -e "create database if not exists interview_platform character set utf8mb4 collate utf8mb4_unicode_ci;"
cd apps/api
mvn spring-boot:run
```

Default local database config:

- `DB_URL`: `jdbc:mysql://localhost:3306/interview_platform?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`
- `DB_USERNAME`: `root`
- `DB_PASSWORD`: `123456`

## Production Environment

Production config is in `apps/api/src/main/resources/application-prod.yml`.
Do not put production secrets into Git. Start the backend with `SPRING_PROFILES_ACTIVE=prod` and provide these environment variables:

```bash
export SPRING_PROFILES_ACTIVE=prod
export DB_URL='jdbc:mysql://<host>:3306/interview_platform?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai'
export DB_USERNAME='<prod-user>'
export DB_PASSWORD='<prod-password>'
export JWT_SECRET='<at-least-32-characters-secret>'
export ADMIN_USERNAME='<admin-user>'
export ADMIN_PASSWORD='<strong-admin-password>'
export BOOTSTRAP_ADMIN_ENABLED=false

cd apps/api
mvn spring-boot:run
```
