from __future__ import annotations

import importlib
import json
import os
import re
import shutil
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parent


def localizar_tesseract_local() -> Path | None:
    candidatos = [
        ROOT / "Tesseract-OCR" / "tesseract.exe",
        ROOT / "tesseract" / "tesseract.exe",
        ROOT / "ocr" / "tesseract.exe",
        ROOT / "tesseract.exe",
    ]
    for candidato in candidatos:
        if candidato.exists():
            return candidato
    return None


def configurar_saida_utf8() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


@dataclass
class DiagnosticItem:
    name: str
    status: str
    details: str
    required: bool = True
    fix_hint: str = ""


@dataclass
class DiagnosticGroup:
    id: str
    title: str
    summary: str
    status: str = "ok"
    items: list[DiagnosticItem] = field(default_factory=list)


def status_rank(status: str) -> int:
    return {"ok": 0, "warning": 1, "error": 2}.get(str(status or "").strip().lower(), 2)


def combine_status(current: str, incoming: str) -> str:
    return incoming if status_rank(incoming) > status_rank(current) else current


def item_ok(name: str, details: str, required: bool = True) -> DiagnosticItem:
    return DiagnosticItem(name=name, status="ok", details=details, required=required)


def item_warning(name: str, details: str, fix_hint: str = "", required: bool = False) -> DiagnosticItem:
    return DiagnosticItem(name=name, status="warning", details=details, required=required, fix_hint=fix_hint)


def item_error(name: str, details: str, fix_hint: str = "") -> DiagnosticItem:
    return DiagnosticItem(name=name, status="error", details=details, required=True, fix_hint=fix_hint)


def build_group(group_id: str, title: str, summary: str, items: list[DiagnosticItem]) -> DiagnosticGroup:
    status = "ok"
    for item in items:
        status = combine_status(status, item.status)
    return DiagnosticGroup(id=group_id, title=title, summary=summary, status=status, items=items)


def safe_check(callback: Callable[[], DiagnosticItem], fallback_name: str) -> DiagnosticItem:
    try:
        return callback()
    except Exception as error:
        return item_error(
            fallback_name,
            f"Falha ao validar componente: {error}",
            "Abra o componente manualmente ou reinstale a dependência correspondente.",
        )


def python_runtime_item() -> DiagnosticItem:
    return item_ok("Python", f"{sys.executable} | versao {sys.version.split()[0]}")


def import_module_item(name: str, module_name: str, fix_hint: str, required: bool = True) -> DiagnosticItem:
    try:
        module = importlib.import_module(module_name)
        version = getattr(module, "__version__", None)
        version_text = f" | versao {version}" if version else ""
        return item_ok(name, f"Modulo {module_name} carregado com sucesso{version_text}.", required=required)
    except Exception as error:
        if required:
            return item_error(name, f"Nao foi possivel importar {module_name}: {error}", fix_hint)
        return item_warning(name, f"Modulo opcional {module_name} indisponivel: {error}", fix_hint)


def playwright_browser_item() -> DiagnosticItem:
    try:
        import playwright  # noqa: F401
    except Exception as error:
        return item_error(
            "Playwright browser",
            f"Playwright nao esta importavel: {error}",
            "Instale a biblioteca Playwright antes de usar os blocos de Chrome.",
        )

    chromium_cache_dirs = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright",
        Path(os.environ.get("USERPROFILE", "")) / "AppData/Local/ms-playwright",
    ]
    for cache_dir in chromium_cache_dirs:
        if not cache_dir.exists():
            continue
        executables = list(cache_dir.glob("chromium-*/chrome-win/chrome.exe"))
        if executables:
            return item_ok("Playwright browser", f"Chromium localizado em {executables[0]}.", required=False)

    chrome_candidates = [
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for candidate in chrome_candidates:
        if candidate.exists():
            return item_warning(
                "Playwright browser",
                f"Chromium do Playwright nao foi encontrado, mas o Chrome existe em {candidate}.",
                "Se os blocos Chrome falharem, execute 'python -m playwright install chromium'.",
                required=False,
            )

    return item_warning(
        "Playwright browser",
        "Nenhum navegador controlavel pelo Playwright foi encontrado.",
        "Execute 'python -m playwright install chromium' ou instale o Google Chrome.",
        required=False,
    )


def tesseract_item() -> DiagnosticItem:
    local_executable = localizar_tesseract_local()
    if local_executable:
        return item_ok("Tesseract OCR", f"Executavel local encontrado em {local_executable}.", required=False)

    executable = shutil.which("tesseract")
    if executable:
        return item_ok("Tesseract OCR", f"Executavel encontrado em {executable}.", required=False)
    return item_warning(
        "Tesseract OCR",
        "Executavel do Tesseract nao foi encontrado no PATH.",
        "Instale o Tesseract OCR se quiser reforco por leitura de texto.",
        required=False,
    )


def small_capture_item() -> DiagnosticItem:
    try:
        from PIL import ImageGrab
    except Exception as error:
        return item_error(
            "Captura de tela",
            f"ImageGrab indisponivel: {error}",
            "Instale Pillow corretamente para habilitar captura e recorte de imagem.",
        )

    try:
        screenshot = ImageGrab.grab(bbox=(0, 0, 8, 8), all_screens=True)
        return item_ok(
            "Captura de tela",
            f"Captura teste concluida com sucesso ({screenshot.width}x{screenshot.height}).",
        )
    except Exception as error:
        return item_error(
            "Captura de tela",
            f"A captura de tela falhou neste computador: {error}",
            "Verifique permissao de captura do Windows, antivírus ou instalação do Pillow.",
        )


def tkinter_item() -> DiagnosticItem:
    try:
        import tkinter  # noqa: F401

        return item_ok("Interface de selecao", "Tkinter disponivel para selecao de area e janelas.")
    except Exception as error:
        return item_error(
            "Interface de selecao",
            f"Tkinter nao esta disponivel: {error}",
            "Reinstale o Python com suporte ao Tkinter para usar selecao visual e janelas auxiliares.",
        )


def script_file_item(path: Path, label: str) -> DiagnosticItem:
    if path.exists():
        return item_ok(label, f"Arquivo localizado em {path}.")
    return item_error(label, f"Arquivo ausente: {path}.", "Copie novamente os arquivos principais do FlowDetect.")


def writable_dir_item(path: Path, label: str) -> DiagnosticItem:
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / ".diagnostic_write_test.tmp"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        return item_ok(label, f"Pasta pronta para uso: {path}.")
    except Exception as error:
        return item_error(
            label,
            f"Nao foi possivel gravar na pasta {path}: {error}",
            "Verifique permissoes da pasta ou execute o programa em um diretorio gravavel.",
        )


def workbook_seed_item() -> DiagnosticItem:
    workbook = ROOT / "db.xlsx"
    planilhas_dir = ROOT / "planilhas"
    if workbook.exists():
        return item_ok("Planilha padrao", f"Arquivo principal localizado em {workbook}.")
    if any(planilhas_dir.glob("*.xls*")):
        return item_warning(
            "Planilha padrao",
            "Nao existe db.xlsx na raiz, mas ha planilhas na pasta planilhas.",
            "Importe ou selecione a planilha desejada antes de rodar loops.",
            required=False,
        )
    return item_warning(
        "Planilha padrao",
        "Nenhuma planilha padrao foi encontrada.",
        "Adicione uma planilha para usar loops e preenchimento por colunas.",
        required=False,
    )


def candidate_auth_config_paths() -> list[Path]:
    return [
        ROOT / "auth-config.js",
        ROOT / "tauri_gerador" / "web" / "auth-config.js",
        ROOT / "web" / "auth-config.js",
    ]


def login_config_item() -> DiagnosticItem:
    config_path = next((path for path in candidate_auth_config_paths() if path.exists()), None)
    if config_path is None:
        return item_error(
            "Configuracao de login",
            "Arquivo auth-config.js nao foi encontrado.",
            "Garanta que o auth-config.js esteja junto do pacote do programa.",
        )

    content = config_path.read_text(encoding="utf-8", errors="ignore")
    url_match = re.search(r'supabaseUrl:\s*"([^"]+)"', content)
    key_match = re.search(r'supabaseAnonKey:\s*"([^"]+)"', content)
    rpc_match = re.search(r'rpcFunction:\s*"([^"]+)"', content)

    url_value = url_match.group(1).strip() if url_match else ""
    key_value = key_match.group(1).strip() if key_match else ""
    rpc_value = rpc_match.group(1).strip() if rpc_match else ""

    if not url_value or "YOUR_SUPABASE" in url_value.upper():
        return item_error(
            "Configuracao de login",
            "URL do Supabase nao configurada.",
            "Preencha o auth-config.js com a URL real do projeto Supabase.",
        )
    if not key_value or "YOUR_SUPABASE" in key_value.upper():
        return item_error(
            "Configuracao de login",
            "Chave anon do Supabase nao configurada.",
            "Preencha o auth-config.js com a chave publica correta.",
        )
    if not rpc_value:
        return item_warning(
            "Configuracao de login",
            "A funcao RPC principal nao foi identificada no auth-config.js.",
            "Revise o arquivo auth-config.js para garantir o login.",
            required=False,
        )

    return item_ok(
        "Configuracao de login",
        f"Supabase configurado com RPC {rpc_value} em {url_value}. Arquivo: {config_path}.",
    )


def build_groups() -> list[DiagnosticGroup]:
    return [
        build_group(
            "runtime",
            "Base do programa",
            "Motor principal, scripts e pastas obrigatorias.",
            [
                safe_check(python_runtime_item, "Python"),
                safe_check(lambda: script_file_item(ROOT / "executar_automacao.py", "Executor principal"), "Executor principal"),
                safe_check(lambda: script_file_item(ROOT / "gerenciar_roteiro.py", "Gerenciador de roteiro"), "Gerenciador de roteiro"),
                safe_check(lambda: script_file_item(ROOT / "capturar_cliques.py", "Captura avancada"), "Captura avancada"),
                safe_check(lambda: writable_dir_item(ROOT / "automacoes", "Biblioteca de automacoes"), "Biblioteca de automacoes"),
                safe_check(lambda: writable_dir_item(ROOT / "imagens", "Pasta de imagens"), "Pasta de imagens"),
            ],
        ),
        build_group(
            "visual",
            "Captura e reconhecimento",
            "Tudo que o fluxo visual precisa para localizar itens na tela.",
            [
                safe_check(lambda: import_module_item("PyAutoGUI", "pyautogui", "Instale pyautogui para automacao de mouse e teclado."), "PyAutoGUI"),
                safe_check(lambda: import_module_item("OpenCV", "cv2", "Instale opencv-python para confidence e reconhecimento visual."), "OpenCV"),
                safe_check(lambda: import_module_item("NumPy", "numpy", "Instale numpy para processamento de reconhecimento."), "NumPy"),
                safe_check(lambda: import_module_item("Pillow", "PIL", "Instale pillow para captura e recorte de tela."), "Pillow"),
                safe_check(tkinter_item, "Interface de selecao"),
                safe_check(small_capture_item, "Captura de tela"),
                safe_check(lambda: script_file_item(ROOT / "capturar_imagem_tela.py", "Capturador integrado"), "Capturador integrado"),
            ],
        ),
        build_group(
            "ocr",
            "OCR e leitura de texto",
            "Reforco para reconhecer textos dentro da tela quando necessario.",
            [
                safe_check(lambda: import_module_item("PyTesseract", "pytesseract", "Instale pytesseract para leitura OCR.", required=False), "PyTesseract"),
                safe_check(tesseract_item, "Tesseract OCR"),
            ],
        ),
        build_group(
            "data",
            "Planilhas e relatorios",
            "Recursos para loop por colunas, importacao de dados e PDF final.",
            [
                safe_check(lambda: import_module_item("OpenPyXL", "openpyxl", "Instale openpyxl para usar planilhas."), "OpenPyXL"),
                safe_check(lambda: import_module_item("ReportLab", "reportlab", "Instale reportlab para gerar relatorios PDF.", required=False), "ReportLab"),
                safe_check(lambda: writable_dir_item(ROOT / "planilhas", "Pasta de planilhas"), "Pasta de planilhas"),
                safe_check(workbook_seed_item, "Planilha padrao"),
                safe_check(lambda: writable_dir_item(ROOT / "diagnosticos_reconhecimento", "Pasta de diagnosticos"), "Pasta de diagnosticos"),
            ],
        ),
        build_group(
            "login",
            "Login e ativacao",
            "Configuracao da tela de acesso e validacao via Supabase.",
            [
                safe_check(login_config_item, "Configuracao de login"),
                safe_check(lambda: writable_dir_item(ROOT, "Sessao local"), "Sessao local"),
            ],
        ),
    ]


def build_summary(groups: list[DiagnosticGroup]) -> dict:
    items = [item for group in groups for item in group.items]
    error_count = sum(1 for item in items if item.status == "error")
    warning_count = sum(1 for item in items if item.status == "warning")
    ok_count = sum(1 for item in items if item.status == "ok")

    overall_status = "ok"
    for group in groups:
        overall_status = combine_status(overall_status, group.status)

    if overall_status == "ok":
        summary = "Ambiente pronto. Todas as funcoes principais estao disponiveis."
    elif overall_status == "warning":
        summary = "Ambiente utilizavel, mas existem pontos de atencao antes de usar todos os recursos."
    else:
        summary = "Ambiente incompleto. Algumas funcoes do programa nao vao funcionar ate corrigir os erros."

    return {
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "root": str(ROOT),
        "overall_status": overall_status,
        "summary": summary,
        "counts": {
            "ok": ok_count,
            "warning": warning_count,
            "error": error_count,
            "total": len(items),
        },
        "groups": [asdict(group) for group in groups],
    }


def main() -> None:
    configurar_saida_utf8()
    groups = build_groups()
    response = build_summary(groups)
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
