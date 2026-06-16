#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-123456}"
DB_NAME="${DB_NAME:-interview_platform}"

case "$DB_NAME" in
  ""|*[!A-Za-z0-9_]*)
    echo "DB_NAME 只能包含字母、数字和下划线，当前值: $DB_NAME" >&2
    exit 1
    ;;
esac

if ! command -v mysql >/dev/null 2>&1; then
  echo "未找到 mysql 命令，请先安装 MySQL client 或确认 PATH。" >&2
  exit 1
fi

echo "Repo: $REPO_ROOT"
echo "Initializing database '$DB_NAME' on $DB_HOST:$DB_PORT with user '$DB_USERNAME'."
echo "可通过 DB_USERNAME/DB_PASSWORD/DB_NAME 覆盖默认值。"

mysql_args=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME")
if [ -n "$DB_PASSWORD" ]; then
  mysql_args+=("-p${DB_PASSWORD}")
fi

mysql "${mysql_args[@]}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "Database '$DB_NAME' is ready."
