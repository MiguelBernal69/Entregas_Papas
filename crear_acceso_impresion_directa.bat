@echo off
echo ========================================================
echo   CONFIGURADOR DE ACCESO DIRECTO - IMPRESION DIRECTA
echo ========================================================
echo.
echo Creando acceso directo en el Escritorio...

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Distribuidora Lunova (POS).lnk')); $c = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; if (-not (Test-Path $c)) { $c = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }; if (-not (Test-Path $c)) { $c = [IO.Path]::Combine($env:LOCALAPPDATA, 'Google\Chrome\Application\chrome.exe') }; $s.TargetPath = $c; $s.Arguments = '--kiosk-printing --user-data-dir=""C:\ChromePOS"" --app=http://178.105.45.6/admin/orders'; $s.Save()"

echo.
echo Listo! Se creo el acceso directo en el Escritorio:
echo 'Distribuidora Lunova (POS)'
echo.
echo Al abrirlo, imprimira de inmediato sin ventanas emergentes.
echo ========================================================
pause
