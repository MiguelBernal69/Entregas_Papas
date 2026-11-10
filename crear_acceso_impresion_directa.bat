@echo off
chcp 65001 > nul
echo ========================================================
echo   CONFIGURADOR DE ACCESO DIRECTO - IMPRESIÓN DIRECTA
echo ========================================================
echo.
echo Creando acceso directo en el Escritorio con impresión automática...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$shortcut = $ws.CreateShortcut([System.IO.Path]::Combine($desktop, 'Distribuidora Lunova (POS).lnk'));" ^
  "$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe';" ^
  "if (-not (Test-Path $chromePath)) { $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' };" ^
  "if (-not (Test-Path $chromePath)) { $chromePath = [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Google\Chrome\Application\chrome.exe') };" ^
  "$shortcut.TargetPath = $chromePath;" ^
  "$shortcut.Arguments = '--kiosk-printing --app=http://178.105.45.6/admin/orders';" ^
  "$shortcut.Description = 'Acceso al sistema con impresion termica automatica';" ^
  "$shortcut.Save();" ^
  "Write-Host 'Acceso directo creado exitosamente en tu Escritorio.' -ForegroundColor Green;"

echo.
echo ¡Listo! Ahora abre el acceso directo 'Distribuidora Lunova (POS)' desde tu escritorio.
echo Toda boleta se imprimirá al instante sin ventanas emergentes.
echo.
pause
