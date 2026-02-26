#!/bin/bash
# Usage: update-changelog.sh "Short title" "Long description paragraph"
#
# Prepends a new entry to CHANGELOG.md, stages all changes, and commits
# with the short title as the first line, long description as body,
# and Co-Authored-By trailer.

set -e

TITLE="$1"
DESCRIPTION="$2"
CHANGELOG_FILE="CHANGELOG.md"

# Generate formatted timestamp like "Friday, February 7th at 2pm"
get_formatted_date() {
  local day_name=$(date "+%A")
  local month=$(date "+%B")
  local day_num=$(date "+%-d")
  local hour=$(date "+%-I")
  local ampm=$(date "+%p" | tr '[:upper:]' '[:lower:]')

  # Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  case $day_num in
    1|21|31) suffix="st" ;;
    2|22) suffix="nd" ;;
    3|23) suffix="rd" ;;
    *) suffix="th" ;;
  esac

  echo "${day_name}, ${month} ${day_num}${suffix} at ${hour}${ampm}"
}

# Wrap text at 80 characters
wrap_text() {
  echo "$1" | fold -s -w 80
}

TIMESTAMP=$(get_formatted_date)
WRAPPED_DESC=$(wrap_text "$DESCRIPTION")

# Create new entry
NEW_ENTRY="## ${TITLE}
*${TIMESTAMP}*
${WRAPPED_DESC}

---

"

# Prepend to existing changelog or create new one
if [ -f "$CHANGELOG_FILE" ]; then
  EXISTING=$(cat "$CHANGELOG_FILE")
  echo -e "${NEW_ENTRY}${EXISTING}" > "$CHANGELOG_FILE"
else
  echo -e "${NEW_ENTRY}" > "$CHANGELOG_FILE"
fi

echo "Updated $CHANGELOG_FILE"

# Stage CHANGELOG.md and commit everything
git add CHANGELOG.md
git commit -m "$(cat <<EOF
${TITLE}

${DESCRIPTION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

echo "Committed: $(git rev-parse --short HEAD)"
