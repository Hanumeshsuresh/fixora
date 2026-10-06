@echo off
echo === Fixora Frontend ===
cd /d "%~dp0"
pnpm --filter @workspace/fixora run dev
