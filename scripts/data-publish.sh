#!/usr/bin/env bash
# ينشر محتوى _out كفرع data بـ commit واحد (force) — عشان الريبو ما يكبرش مع الوقت
set -e
REMOTE="${DATA_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
cd _out
rm -rf .git
git init -q -b data
git config user.name "arbton-bot"; git config user.email "arbton-bot@users.noreply.github.com"
git add -A
git commit -qm "data $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" data
echo "published"
