Set oWS = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

desktop = oWS.SpecialFolders("Desktop")
shortcutPath = desktop & "\Distribuidora Lunova (POS).lnk"

chrome1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
chrome2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
chrome3 = oWS.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"

targetChrome = chrome1
If fso.FileExists(chrome1) Then
    targetChrome = chrome1
ElseIf fso.FileExists(chrome2) Then
    targetChrome = chrome2
ElseIf fso.FileExists(chrome3) Then
    targetChrome = chrome3
End If

Set oLink = oWS.CreateShortcut(shortcutPath)
oLink.TargetPath = targetChrome
oLink.Arguments = "--kiosk-printing --app=http://178.105.45.6/admin/orders"
oLink.Description = "Sistema Distribuidora Lunova con impresion automatica"
oLink.Save

MsgBox "¡Acceso directo creado con éxito en tu Escritorio!" & vbCrLf & vbCrLf & "Nombre: Distribuidora Lunova (POS)" & vbCrLf & vbCrLf & "Al abrirlo desde tu Escritorio, las boletas se imprimirán de inmediato sin ventanas emergentes.", vbInformation, "Distribuidora Lunova - Impresión Directa"
