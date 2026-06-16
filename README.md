# Java 面试进阶平台

面向 3-5 年 Java 后端工程师的进阶面试准备平台。

## Applications

- `apps/api`: Spring Boot backend.
- `apps/web`: Next.js public site.
- `apps/admin`: Vue admin console.

## V1 Scope

V1 focuses on four topics: 并发、JVM、MySQL、Redis.

## Local Development

The backend default profile is `local`. Run commands from the repository root unless noted otherwise.

### 1. Prerequisites

- Java 17+
- Maven 3.9+
- MySQL 8+
- Node.js 20+ and npm

### 2. Initialize MySQL

```bash
bash scripts/init-db.sh
```

`scripts/init-db.sh` uses `root / 123456` and creates `interview_platform` by default. Override with environment variables when needed:

```bash
DB_USERNAME=root DB_PASSWORD=123456 DB_NAME=interview_platform bash scripts/init-db.sh
```

- `DB_URL`: `jdbc:mysql://localhost:3306/interview_platform?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`
- `DB_USERNAME`: `root`
- `DB_PASSWORD`: `123456`
- `DB_NAME`: `interview_platform` (used by `scripts/init-db.sh`)

Flyway migrations run automatically when the backend starts.

### 3. Start Backend API

```bash
bash scripts/run-api-local.sh
```

Default API endpoint: `http://localhost:8080`.
Keep this process running and use another terminal for the frontend apps.

The script first tries `mvn spring-boot:run`. If Maven plugin or dependency download fails, it prints mirror troubleshooting guidance and then attempts a `java -cp` fallback after compiling and generating the runtime classpath.

### 4. Start Public Site

```bash
cd apps/web
npm ci
npm run dev
```

Default public site endpoint: `http://localhost:3000`.
Run this in a separate terminal while the backend is running.

Override backend API endpoint when needed:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev
```

### 5. Start Admin Console

```bash
cd apps/admin
npm ci
npm run dev
```

Default admin endpoint: `http://localhost:5173`.
Run this in a separate terminal while the backend is running.

Override backend API endpoint when needed:

```bash
VITE_API_BASE=http://localhost:8080 npm run dev
```

### 6. Default Admin Account

The local profile bootstraps an admin account when the backend starts:

- username: `admin`
- password: `admin123456`

Override with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME`.

### 7. Local Acceptance Check

```bash
bash scripts/check-local.sh
```

This runs backend tests, then builds `apps/web` and `apps/admin`.

### FAQ

**Maven fails with Aliyun 502 or dependency transfer errors**

This is usually a Maven mirror problem rather than a code problem. Retry later, temporarily remove the Aliyun mirror from `~/.m2/settings.xml`, or switch to Maven Central / an available internal mirror. Then rerun:

```bash
bash scripts/run-api-local.sh
```

**MySQL connection fails**

Start local MySQL first and confirm the credentials match the local environment variables. To recreate the database:

```bash
bash scripts/init-db.sh
```

**Frontend cannot reach backend**

Ensure the backend is listening on `http://localhost:8080`, then set `NEXT_PUBLIC_API_BASE` for `apps/web` or `VITE_API_BASE` for `apps/admin` if using a different backend URL.

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
