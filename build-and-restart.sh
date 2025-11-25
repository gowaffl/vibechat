#!/bin/bash
cd /home/user/workspace/backend
bun run build
pkill -9 -f "bun.*dist/index"
sleep 2
NODE_ENV=production nohup bun run dist/index.js > server.log 2>&1 &
echo "Server restarted"

