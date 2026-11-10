@echo off
echo Installing Node dependencies...
call npm install
echo Building the React app and compiling to .exe...
call npm run dist
echo Done! Your standalone .exe is in the "release" folder.
pause