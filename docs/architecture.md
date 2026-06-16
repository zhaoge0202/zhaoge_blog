# Architecture

The platform uses one Spring Boot backend and two frontends.

- The public Next.js site reads published topics, questions, and notes.
- The Vue admin console creates and publishes content.
- MySQL stores structured interview content.
- The backend separates public APIs under `/api/public/**` and `/api/admin/**`.

## Local Runtime Topology

Local development starts three applications independently:

- `apps/api`: Spring Boot API on `http://localhost:8080`. It owns database access, Flyway migrations, admin bootstrap, JWT signing, and public/admin API boundaries.
- `apps/web`: Next.js public site on `http://localhost:3000`. It reads the backend URL from `NEXT_PUBLIC_API_BASE` and defaults to `http://localhost:8080`.
- `apps/admin`: Vue/Vite admin console on `http://localhost:5173`. It reads the backend URL from `VITE_API_BASE` and defaults to `http://localhost:8080`.

Use separate terminals for long-running development servers:

```bash
# Terminal 1
bash scripts/init-db.sh
bash scripts/run-api-local.sh

# Terminal 2
cd apps/web && npm run dev

# Terminal 3
cd apps/admin && npm run dev
```

## Environment Profiles

- Local profile is the default profile. It uses MySQL database `interview_platform` with `root / 123456` unless overridden by `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`.
- `scripts/init-db.sh` creates the local database with `DB_USERNAME`, `DB_PASSWORD`, and `DB_NAME`. Defaults are `root`, `123456`, and `interview_platform`.
- Backend local admin bootstrap is enabled by default. Override `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME` when a different seeded admin account is needed.
- Backend JWT settings come from `JWT_SECRET` and `JWT_TTL_MINUTES`. The local default secret is for development only.
- Production profile uses `SPRING_PROFILES_ACTIVE=prod` and reads database credentials, JWT secret, and optional bootstrap admin credentials from environment variables only.

## Environment Variable Reference

| Variable | Owner | Default | Purpose |
| --- | --- | --- | --- |
| `DB_URL` | API | `jdbc:mysql://localhost:3306/interview_platform?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai` | JDBC connection URL. |
| `DB_USERNAME` | API, `scripts/init-db.sh` | `root` | MySQL username. |
| `DB_PASSWORD` | API, `scripts/init-db.sh` | `123456` | MySQL password. |
| `DB_NAME` | `scripts/init-db.sh` | `interview_platform` | Database created by the init script. |
| `ADMIN_USERNAME` | API | `admin` | Bootstrapped local admin username. |
| `ADMIN_PASSWORD` | API | `admin123456` | Bootstrapped local admin password. |
| `ADMIN_DISPLAY_NAME` | API | `管理员` | Bootstrapped local admin display name. |
| `JWT_SECRET` | API | development-only secret | JWT signing secret. Must be strong in production. |
| `JWT_TTL_MINUTES` | API | `720` | JWT lifetime in minutes. |
| `NEXT_PUBLIC_API_BASE` | Web | `http://localhost:8080` | Public site API base URL. |
| `VITE_API_BASE` | Admin | `http://localhost:8080` | Admin console API base URL. |
