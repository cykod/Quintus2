#!/bin/bash
# Usage: log_ask.sh CONVID "Summary sentence"
# Appends a timestamped ask entry to ASKS.md in the current directory.

set -e

if [ $# -lt 2 ]; then
  echo "Usage: log_ask.sh CONVID \"Summary sentence\"" >&2
  exit 1
fi

CODE="$1"
SUMMARY="$2"
FILE="ASKS.md"
TIMESTAMP=$(date "+%a %-m/%-d %-I%p" | tr '[:upper:]' '[:lower:]')

ENTRY="[${CODE}] ${TIMESTAMP} - ${SUMMARY}"

if [ ! -f "$FILE" ]; then
  printf "# Asks\n\n%s\n" "$ENTRY" > "$FILE"
else
  printf "\n%s\n" "$ENTRY" >> "$FILE"
fi

echo "Logged: $ENTRY"

# Rename terminal title: [CODE] short description
printf '\033]0;[%s] %s\033\\' "$CODE" "$SUMMARY"
echo "Terminal title set: [$CODE] $SUMMARY"
