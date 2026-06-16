#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
MAIN_CLASS="cn.zhaoge.interview.InterviewPlatformApplication"
CLASSPATH_FILE="$API_DIR/target/classpath.txt"

if ! command -v mvn >/dev/null 2>&1; then
  echo "未找到 mvn 命令，请先安装 Maven 并确认 PATH。" >&2
  exit 1
fi

echo "Starting API from $API_DIR"
echo "默认连接 MySQL interview_platform(root/123456)，可通过 DB_URL/DB_USERNAME/DB_PASSWORD 覆盖。"

cd "$API_DIR"

set +e
mvn spring-boot:run
mvn_status=$?
set -e

if [ "$mvn_status" -eq 0 ]; then
  exit 0
fi

if [ "$mvn_status" -eq 130 ] || [ "$mvn_status" -eq 143 ]; then
  exit "$mvn_status"
fi

echo
echo "mvn spring-boot:run 启动失败。"
echo "如果错误中包含阿里云 Maven 502、transfer failed 或 plugin dependency 下载失败："
echo "1. 稍后重试；或"
echo "2. 临时移除 ~/.m2/settings.xml 中的 aliyun mirror；或"
echo "3. 使用 Maven Central/公司内网可用 mirror 后重新执行 scripts/run-api-local.sh。"
echo
echo "尝试使用 java -cp fallback 启动..."

if mvn -DskipTests compile dependency:build-classpath -Dmdep.outputFile="$CLASSPATH_FILE"; then
  if [ ! -s "$CLASSPATH_FILE" ]; then
    echo "classpath 文件为空，无法使用 java -cp fallback。" >&2
    exit 1
  fi

  exec java -cp "target/classes:$(cat "$CLASSPATH_FILE")" "$MAIN_CLASS"
fi

echo
echo "java -cp fallback 准备失败，通常仍是 Maven 依赖下载不可用导致。"
echo "请先修复 Maven 仓库/mirror 后重试。"
exit 1
