@echo off
REM Virtual Phone Farm - Windows helper
REM Shart: Docker Desktop installed + WSL2 enabled + BIOS Virtualization ON
echo Checking Docker...
docker --version >nul 2>&1 || (echo Docker Desktop nahi mila. Pehle install karein: https://www.docker.com/products/docker-desktop/ & pause & exit /b 1)
echo Docker OK. Ab WSL Ubuntu terminal kholen aur is folder mein ye chalain:
echo     bash setup.sh
echo.
echo Ya Android Studio emulator chahte hain to woh bhi ADB se hub mein jud jayega.
pause
