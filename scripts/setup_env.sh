#!/usr/bin/env bash
# scripts/setup_env.sh
# 環境構築の再現性を維持するためのセットアップスクリプト

echo "=== KinamonKB: Setting up Python environment ==="

# 仮想環境の作成とライブラリのインストール
echo "Creating virtual environment and installing dependencies..."
python3 -m venv venv
./venv/bin/pip install feedparser trafilatura

echo "=== Setup Complete ==="
echo "Dependencies installed in ./venv:"
echo "- feedparser: RSS feed parsing"
echo "- trafilatura: Web scraping and main content extraction"
echo ""
echo "Use './venv/bin/python' to run scripts."
