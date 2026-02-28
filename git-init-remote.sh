#!/bin/bash

# 引数（リポジトリ名）のチェック
if [ -z "$1" ]; then
  echo "Usage: ./git-init-remote.sh <repository-name>"
  exit 1
fi

REPO_NAME=$1

# 1. GitHub上にリポジトリを作成
# --public を --private に変えれば非公開になります
# --source=. は「今のディレクトリをソースにする」
# --remote=origin は「git remote add origin を自動で行う」
gh repo create "$REPO_NAME" --public --source=. --remote=origin

# 2. メインブランチ名を main に変更（GitHubの推奨）
git branch -M main

# 3. 初回プッシュ
git push -u origin main

echo "------------------------------------------"
echo "Success! Repository '$REPO_NAME' is now on GitHub."
