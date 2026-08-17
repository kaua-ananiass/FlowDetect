from __future__ import annotations

import importlib
import json
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def configurar_saida_utf8() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def registrar(checks: list[dict], nome: str, status: str, detalhes: str, required: bool = True) -> None:
    checks.append(
        {
            "name": nome,
            "status": status,
            "details": detalhes,
            "required": required,
        }
    )


def localizar_tesseract() -> Path | None:
    candidatos = [
        ROOT / "Tesseract-OCR" / "tesseract.exe",
        ROOT / "tesseract" / "tesseract.exe",
        ROOT / "ocr" / "tesseract.exe",
        ROOT / "tesseract.exe",
    ]
    for candidato in candidatos:
        if candidato.exists():
            return candidato

    encontrado = shutil.which("tesseract")
    return Path(encontrado) if encontrado else None


def validar_importacao(checks: list[dict], nome: str, modulo: str, required: bool = True) -> bool:
    try:
        importlib.import_module(modulo)
        registrar(checks, nome, "ok", f"Modulo {modulo} carregado com sucesso.", required=required)
        return True
    except Exception as erro:
        registrar(
            checks,
            nome,
            "error" if required else "warning",
            f"Falha ao importar {modulo}: {erro}",
            required=required,
        )
        return False


def validar_captura_tela(checks: list[dict]) -> bool:
    try:
        from PIL import ImageGrab
    except Exception as erro:
        registrar(checks, "Captura de tela", "error", f"ImageGrab indisponivel: {erro}")
        return False

    try:
        imagem = ImageGrab.grab(bbox=(0, 0, 8, 8), all_screens=True)
        registrar(
            checks,
            "Captura de tela",
            "ok",
            f"Captura de teste concluida com sucesso ({imagem.width}x{imagem.height}).",
        )
        return True
    except Exception as erro:
        registrar(checks, "Captura de tela", "error", f"Falha ao capturar a tela: {erro}")
        return False


def main() -> None:
    configurar_saida_utf8()
    checks: list[dict] = []

    validar_importacao(checks, "PyAutoGUI", "pyautogui")
    validar_importacao(checks, "Pillow", "PIL")
    validar_importacao(checks, "Pillow.ImageTk", "PIL.ImageTk")
    validar_importacao(checks, "OpenCV", "cv2")
    validar_importacao(checks, "NumPy", "numpy")
    validar_importacao(checks, "OpenPyXL", "openpyxl")
    validar_importacao(checks, "Tkinter", "tkinter")
    validar_importacao(checks, "Pynput", "pynput")
    validar_importacao(checks, "PyTesseract", "pytesseract", required=False)
    validar_importacao(checks, "ReportLab", "reportlab", required=False)
    validar_captura_tela(checks)

    tesseract = localizar_tesseract()
    if tesseract:
        registrar(checks, "Tesseract OCR", "ok", f"Executavel localizado em {tesseract}.", required=False)
    else:
        registrar(
            checks,
            "Tesseract OCR",
            "warning",
            "Executavel nao encontrado. O OCR fica indisponivel, mas o reconhecimento visual principal continua funcionando.",
            required=False,
        )

    erros = [item for item in checks if item["status"] == "error" and item.get("required", True)]
    avisos = [item for item in checks if item["status"] == "warning"]

    payload = {
        "ok": not erros,
        "summary": (
            "Dependencias principais prontas para captura e reconhecimento."
            if not erros
            else "Ainda faltam dependencias criticas para captura ou reconhecimento."
        ),
        "error_count": len(erros),
        "warning_count": len(avisos),
        "checks": checks,
    }

    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(0 if payload["ok"] else 1)


if __name__ == "__main__":
    main()
