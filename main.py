import subprocess
from pathlib import Path

from capturar_cliques import iniciar_atalhos_texto


def abrir_gerador_tauri():
    base = Path(__file__).resolve().parent
    candidatos = [
        base / "GeradorAutomacao.exe",
        base / "tauri_gerador" / "src-tauri" / "target" / "release" / "gerador_automacao.exe",
        base / "tauri_gerador" / "src-tauri" / "target" / "release" / "Gerador de Automacoes.exe",
    ]

    for executavel in candidatos:
        if executavel.exists():
            subprocess.Popen([str(executavel)], cwd=str(executavel.parent))
            return True

    return False


if __name__ == "__main__":
    if not abrir_gerador_tauri():
        iniciar_atalhos_texto()
