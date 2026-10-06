@echo off
echo === Fixora API Server ===
cd /d "%~dp0artifacts\api-server"
node --env-file=../../.env ./build.mjs
node --env-file=../../.env --enable-source-maps ./dist/index.mjs
