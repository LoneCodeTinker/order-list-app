#!/usr/bin/env bash
# build_backend.sh: Setup Python venv and install backend requirements
set -e

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

# Activate venv and install requirements
. venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "Backend ready."
