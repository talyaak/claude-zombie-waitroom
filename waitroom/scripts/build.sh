#!/usr/bin/env sh
# Builds the mirror child. Dependencies come from the committed lockfile, and
# install scripts are skipped, so no browser is downloaded.
set -eu
cd "$(dirname "$0")/../mirror"
npm ci --ignore-scripts
npm run build
