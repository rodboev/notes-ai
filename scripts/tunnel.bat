@echo off
setlocal enabledelayedexpansion

echo Tunnel script started

REM Define the path to the .env file
set "filename=..\.env"

REM Read the .env file and set environment variables
if exist %filename% (
    for /F "delims== tokens=1,* eol=#" %%i in (%filename%) do (
        set %%i=%%~j
    )
) else (
    echo Error: .env file not found
    exit /b 1
)

REM Process PRIVATE_SSH_KEY and replace \n with real newlines
set key=%PRIVATE_SSH_KEY%
set key=!key:\n=^

!

REM Write PRIVATE_SSH_KEY to id_rsa file
if not exist "%USERPROFILE%\.ssh" mkdir "%USERPROFILE%\.ssh"
(
echo !key!
) > "%USERPROFILE%\.ssh\id_rsa" 2>nul
if errorlevel 1 (
    echo Error: Failed to write SSH key
    exit /b 2
)

REM Check if required variables are set
if not defined PRIVATE_SSH_KEY (
    echo Error: PRIVATE_SSH_KEY is not set
    exit /b 3
)

echo Attempting to establish SSH tunnel...

ssh -N -L 1433:172.19.1.71:1433 -i "%USERPROFILE%\.ssh\id_rsa" -o StrictHostKeyChecking=no -p 1022 alex@70.19.53.6

if errorlevel 1 (
    echo Error: SSH tunnel failed to establish
    exit /b 4
)

echo Tunnel established successfully
exit /b 0
