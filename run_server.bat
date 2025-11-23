@echo off
:start
echo Starting Nicky AI Server...
call node --env-file=.env --import tsx server/index.ts
echo Server crashed or stopped. Restarting in 5 seconds...
timeout /t 5
goto start
