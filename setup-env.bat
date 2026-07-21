@echo off
REM Quick setup script for Windows

echo.
echo 🚀 Wimp-Drop Environment Setup
echo ================================
echo.

REM Check if .env.local exists
if exist .env.local (
    echo ✓ .env.local already exists
    echo.
    echo Current environment:
    type .env.local | findstr "^VITE_" | for /l %%i in (1,1,5) do (
        if %%i leq 5 (
            for /f "delims=" %%a in ('type .env.local ^| findstr "^VITE_" ^| more +%%a') do (
                echo %%a
            )
        )
    )
    echo.
    set /p response="Do you want to reset it? (y/n) "
    if /i "%response%"=="n" (
        echo Keeping existing .env.local
        goto end
    )
)

REM Copy template
if exist .env.example (
    copy .env.example .env.local
    echo ✓ Created .env.local from .env.example
) else (
    echo ✗ .env.example not found!
    exit /b 1
)

echo.
echo 📝 Environment setup complete!
echo.
echo Next steps:
echo 1. Edit .env.local with your actual API keys
echo 2. Get credentials from:
echo    - Supabase: https://supabase.com
echo    - Flutterwave: https://flutterwave.com
echo 3. Reload your app in browser
echo.
echo Check browser console:
echo   env.printStatus()    - Show environment status
echo   env.getMissing()     - Show missing variables
echo.

:end
pause
