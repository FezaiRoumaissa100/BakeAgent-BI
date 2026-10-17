# Lance les trois parties du projet en même temps, chacune dans sa propre fenêtre :
#   1) backend (données)  -> http://localhost:8000
#   2) agent IA (chat du tableau de bord) -> http://127.0.0.1:8001
#   3) tableau de bord    -> http://localhost:3000
# Utilisation (dans le dossier du projet) :  powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Relancer = refaire la même commande : les anciennes fenêtres sont arrêtées d'abord.
# Pour tout arrêter : fermer les trois fenêtres (ou Ctrl + C dans chacune).

$root = $PSScriptRoot

# Arrête d'abord tout ce qui occupe déjà les ports du projet (anciennes fenêtres oubliées),
# pour pouvoir relancer proprement à tout moment.
foreach ($port in 8000, 8001, 3000) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        if ($p -and $p -ne 0) {
            Write-Host "Port $port occupe par le processus $p : arret."
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Backend :8000'; cd '$root\backend'; python -m uvicorn main:app --reload --port 8000"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Agent IA :8001'; cd '$root\agent'; python start_agent.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Tableau de bord :3000'; cd '$root\frontend'; npm run dev"

Write-Host "Trois fenetres ouvertes. Le tableau de bord s'ouvre dans quelques secondes..."
Start-Sleep -Seconds 12
Start-Process "http://localhost:3000"
