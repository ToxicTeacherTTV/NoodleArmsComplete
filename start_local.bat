@echo off
echo Starting Nicky AI Server...
node --env-file=.env --import tsx server/index.ts
pause
