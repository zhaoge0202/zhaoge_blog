# Architecture

The platform uses one Spring Boot backend and two frontends.

- The public Next.js site reads published topics, questions, and notes.
- The Vue admin console creates and publishes content.
- MySQL stores structured interview content.
- The backend separates public APIs under `/api/public/**` and `/api/admin/**`.

## Environment Profiles

- Local test profile is the default profile. It uses MySQL database `interview_platform` with `root / 123456` unless overridden by `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`.
- Production profile uses `SPRING_PROFILES_ACTIVE=prod` and reads database credentials, JWT secret, and optional bootstrap admin credentials from environment variables only.
