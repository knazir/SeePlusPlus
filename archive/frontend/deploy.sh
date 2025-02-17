#!/bin/bash
set -e
cd "`dirname "$0"`"
npm run build
cp -r build/* /var/www/html
