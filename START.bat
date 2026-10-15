@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =============================================
echo   УЧУСЬ.РФ - Демонстрационный экзамен - В5
echo =============================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ОШИБКА: Node.js не установлен.
  echo Установите Node.js 22.13 или новее с https://nodejs.org/
  pause
  exit /b 1
)
node -v
echo Сайт откроется по адресу: http://localhost:3000
echo Оставьте это окно открытым, пока работаете с сайтом.
echo Для остановки нажмите Ctrl+C.
echo.
node server.js
pause
