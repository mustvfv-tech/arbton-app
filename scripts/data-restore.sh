#!/usr/bin/env bash
# ينزّل آخر نسخة من فرع data (لو موجود) إلى المجلد _out
set -e
REMOTE="${DATA_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
mkdir -p _out
T="$(mktemp -d)"; git -C "$T" init -q
if git -C "$T" ls-remote --exit-code --heads "$REMOTE" data >/dev/null 2>&1; then
  git -C "$T" fetch -q --depth=1 "$REMOTE" data
  git -C "$T" archive FETCH_HEAD | tar -x -C _out
  echo "restored data branch"
else
  echo "no data branch yet"
fi
