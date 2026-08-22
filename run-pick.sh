#!/bin/bash
export PATH="/home/edge/.local/bin:/home/edge/.nvm/versions/node/v20.20.0/bin:$PATH"
cd /home/edge/thepick
npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/fetch-data.ts >> /home/edge/thepick/cron.log 2>&1
