# Lance les trois parties du projet en même temps, chacune dans sa propre fenêtre :
#   1) backend (données)  -> http://localhost:8000
#   2) agent IA           -> http://localhost:8080
#   3) tableau de bord    -> http://localhost:3000
# Utilisation (dans le dossier du projet) :  .\start-all.ps1
# Pour tout arrêter : fermer les trois fenêtres (ou Ctrl + C dans chacune).

$root = $PSScriptRoot
$adk  = Join-Path $env:APPDATA "Python\Python314\Scripts\adk.exe"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Backend :8000'; cd '$root\backend'; python -m uvicorn main:app --reload --port 8000"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Agent IA :8080'; cd '$root'; & '$adk' web --port 8080"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Tableau de bord :3000'; cd '$root\frontend'; npm run dev"

Write-Host "Trois fenetres ouvertes. Le tableau de bord s'ouvre dans quelques secondes..."
Start-Sleep -Seconds 12
Start-Process "http://localhost:3000"
