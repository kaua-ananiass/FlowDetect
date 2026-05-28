import argparse
import ctypes
import difflib
import json
import re
import threading
import time
import unicodedata
from ctypes import wintypes
from pathlib import Path

import pyautogui
from openpyxl import load_workbook

try:
    from PIL import Image, ImageDraw, ImageGrab

    PIL_DISPONIVEL = True
except Exception:
    Image = None
    ImageDraw = None
    ImageGrab = None
    PIL_DISPONIVEL = False

try:
    import cv2  # noqa: F401
    import numpy as np

    OPENCV_DISPONIVEL = True
except Exception:
    np = None
    OPENCV_DISPONIVEL = False

try:
    import pytesseract

    OCR_DISPONIVEL = PIL_DISPONIVEL
except Exception:
    OCR_DISPONIVEL = False

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright

    PLAYWRIGHT_DISPONIVEL = True
except Exception:
    sync_playwright = None

    class PlaywrightTimeoutError(Exception):
        pass

    PLAYWRIGHT_DISPONIVEL = False

try:
    import tkinter as tk

    TK_DISPONIVEL = True
except Exception:
    tk = None
    TK_DISPONIVEL = False


ARQUIVO_MAPEAMENTO = Path("mapeamento_teclado.json")
ARQUIVO_PLANILHA = Path("db.xlsx")
PASTA_PLANILHAS = Path("planilhas")
PASTA_IMAGENS = Path("imagens")
PASTA_DIAGNOSTICOS_RECONHECIMENTO = Path("diagnosticos_reconhecimento")
PASTA_DIAGNOSTICOS_CHROME = Path("diagnosticos_chrome")
ARQUIVO_CANCELAMENTO = Path(".parar_automacao.flag")
INTERVALO_TEXTO = 0.01
INTERVALO_ENTRE_ITENS_PLANILHA = 0.5
TIPOS_SEQUENCIA_PLANILHA = {"sequencia_planilha"}
TIPOS_MOUSE = {"mouse_click"}
TIPOS_IMAGEM = {"clicar_imagem"}
TIPOS_VERIFICACAO = {"verificar_estado_botao"}
TIPOS_CHROME = {"chrome_elemento_html"}
MAPA_PYAUTOGUI = {
    "space": "space",
    "enter": "enter",
    "tab": "tab",
    "backspace": "backspace",
    "esc": "esc",
    "shift": "shift",
    "shift_r": "shift",
    "ctrl": "ctrl",
    "ctrl_r": "ctrl",
    "alt": "alt",
    "alt_r": "alt",
    "cmd": "win",
    "cmd_r": "win",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "delete": "delete",
    "insert": "insert",
    "home": "home",
    "end": "end",
    "page_up": "pageup",
    "page_down": "pagedown",
    "f8": "f8",
    "f9": "f9",
}


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except (OSError, ValueError, BrokenPipeError):
        pass


class ExecutorAutomacao:
    def __init__(
        self,
        arquivo_mapeamento=ARQUIVO_MAPEAMENTO,
        arquivo_planilha=ARQUIVO_PLANILHA,
        arquivo_cancelamento=None,
        janela_alvo=None,
    ):
        self.arquivo_mapeamento = Path(arquivo_mapeamento)
        self.arquivo_planilha = Path(arquivo_planilha)
        self.arquivo_cancelamento = Path(arquivo_cancelamento) if arquivo_cancelamento else None
        self.janela_alvo = str(janela_alvo or "").strip()
        self._janela_alvo_logada = ""
        self._janela_alvo_ativada_logada = ""
        self._ocr_indisponivel_logado = False
        self._janela_pendente_logada = False
        self._needle_maior_logada = False
        self._janela_contexto = ""
        self._janela_fixada = None
        self._ultima_regiao_reconhecimento = None
        self._ultimo_template_debug = None
        self._ultimo_diagnostico_reconhecimento = None
        self._cache_template_imagem = {}
        self._historico_reconhecimento = {}
        self.contexto_variaveis = {}
        self._playwright_runtime = None
        self._chrome_browser = None
        self._chrome_context = None
        self._chrome_page = None
        self._chrome_source = ""
        self._chrome_launched_by_executor = False
        self.cancelar = threading.Event()
        self.eventos = self.carregar_eventos()
        self.sequencias = self.agrupar_eventos_por_sequencia()
        self.planilha_cache = self.carregar_planilha()

    def normalizar_nome_sequencia(self, nome):
        texto = str(nome or "").strip()
        return texto or "principal"

    def agrupar_eventos_por_sequencia(self):
        sequencias = {}
        for evento in self.eventos:
            nome = self.normalizar_nome_sequencia(evento.get("sequencia"))
            evento["sequencia"] = nome
            sequencias.setdefault(nome, []).append(evento)
        return sequencias

    def normalizar_id_planilha(self, arquivo):
        texto = str(arquivo or ARQUIVO_PLANILHA.name).strip().replace("\\", "/")
        return texto or ARQUIVO_PLANILHA.name

    def resolver_planilha(self, arquivo):
        workbook_id = self.normalizar_id_planilha(arquivo)
        caminho = Path(workbook_id)
        if caminho.is_absolute():
            return caminho, workbook_id
        if caminho.exists():
            return caminho, workbook_id
        if "/" not in workbook_id and "\\" not in workbook_id and workbook_id != ARQUIVO_PLANILHA.name:
            alternativa = PASTA_PLANILHAS / workbook_id
            if alternativa.exists():
                return alternativa, alternativa.as_posix()
        return caminho, workbook_id

    def resolver_imagem(self, imagem):
        imagem_id = str(imagem or "").strip().replace("\\", "/")
        if not imagem_id:
            return Path(""), ""
        caminho = Path(imagem_id)
        if caminho.is_absolute():
            return caminho, imagem_id
        if caminho.exists():
            return caminho, imagem_id
        if "/" not in imagem_id and "\\" not in imagem_id:
            alternativa = PASTA_IMAGENS / imagem_id
            if alternativa.exists():
                return alternativa, alternativa.as_posix()
        return caminho, imagem_id

    def limpar_saida_status(self, valor):
        return str(valor).replace("|", "/").replace("\n", " ").replace("\r", " ").strip()

    def corrigir_texto_corrompido(self, texto):
        bruto = str(texto or "")
        if not bruto:
            return ""
        candidatos = [bruto]
        for origem in ("latin-1", "cp1252"):
            try:
                convertido = bruto.encode(origem, errors="strict").decode("utf-8", errors="strict")
            except Exception:
                continue
            if convertido and convertido not in candidatos:
                candidatos.append(convertido)

        melhor = candidatos[0]
        for candidato in candidatos[1:]:
            if any(marcador in melhor for marcador in ("Ã", "Â", "â")) and not any(
                marcador in candidato for marcador in ("Ã", "Â", "â")
            ):
                melhor = candidato
        return melhor

    def normalizar_texto_busca(self, texto):
        texto_corrigido = self.corrigir_texto_corrompido(texto)
        base = unicodedata.normalize("NFKD", str(texto_corrigido or ""))
        sem_acento = "".join(caractere for caractere in base if not unicodedata.combining(caractere))
        somente_validos = "".join(
            caractere.lower() if caractere.isalnum() else " "
            for caractere in sem_acento
        )
        return " ".join(somente_validos.split())

    def normalizar_texto_ocr(self, texto):
        return self.normalizar_texto_busca(texto)

    def descrever_janela(self, hwnd):
        if not hasattr(ctypes, "windll"):
            return None

        user32 = ctypes.windll.user32
        if not user32.IsWindowVisible(hwnd):
            return None

        tamanho = user32.GetWindowTextLengthW(hwnd)
        if tamanho <= 0:
            return None

        buffer = ctypes.create_unicode_buffer(tamanho + 1)
        user32.GetWindowTextW(hwnd, buffer, tamanho + 1)
        titulo = buffer.value.strip()
        if not titulo:
            return None

        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return None

        largura = int(rect.right - rect.left)
        altura = int(rect.bottom - rect.top)
        if largura <= 0 or altura <= 0:
            return None

        pid = wintypes.DWORD(0)
        try:
            user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(pid))
        except Exception:
            pid = wintypes.DWORD(0)

        return {
            "hwnd": int(hwnd),
            "title": titulo,
            "left": int(rect.left),
            "top": int(rect.top),
            "width": largura,
            "height": altura,
            "pid": int(pid.value or 0),
        }

    def listar_janelas_visiveis(self):
        if not hasattr(ctypes, "windll"):
            return []

        user32 = ctypes.windll.user32
        janelas = []

        def callback(hwnd, _lparam):
            dados = self.descrever_janela(hwnd)
            if dados:
                janelas.append(dados)
            return True

        enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(callback)
        user32.EnumWindows(enum_proc, 0)
        return janelas

    def obter_janela_ativa(self):
        if not hasattr(ctypes, "windll"):
            return None
        user32 = ctypes.windll.user32
        hwnd = int(user32.GetForegroundWindow() or 0)
        if not hwnd:
            return None
        return self.descrever_janela(hwnd)

    def obter_janela_fixada(self):
        dados = self._janela_fixada or {}
        hwnd = int(dados.get("hwnd", 0) or 0)
        if not hwnd:
            return None
        janela = self.descrever_janela(hwnd)
        if janela:
            self._janela_fixada = janela
        return janela

    def localizar_janela_alvo(self, titulo_janela=None):
        titulo_consulta = str(titulo_janela or self._janela_contexto or self.janela_alvo or "").strip()
        termo = self.normalizar_texto_busca(titulo_consulta) if titulo_consulta else ""

        janela_fixada = self.obter_janela_fixada()
        if janela_fixada:
            titulo_fixado_normalizado = self.normalizar_texto_busca(janela_fixada.get("title", ""))
            if not termo:
                self._janela_contexto = str(janela_fixada.get("title") or "").strip()
                return janela_fixada
            if (
                termo == titulo_fixado_normalizado
                or termo in titulo_fixado_normalizado
                or difflib.SequenceMatcher(None, termo, titulo_fixado_normalizado).ratio() >= 0.52
            ):
                self._janela_contexto = str(janela_fixada.get("title") or "").strip()
                return janela_fixada

        if not termo:
            return None

        melhor = None
        melhor_pontuacao = 0.0
        for janela in self.listar_janelas_visiveis():
            titulo_normalizado = self.normalizar_texto_busca(janela["title"])
            if not titulo_normalizado:
                continue

            if termo == titulo_normalizado:
                pontuacao = 1.0
            elif termo in titulo_normalizado:
                pontuacao = 0.96
            else:
                pontuacao = difflib.SequenceMatcher(None, termo, titulo_normalizado).ratio()

            if pontuacao > melhor_pontuacao:
                melhor = janela
                melhor_pontuacao = pontuacao

        if melhor and melhor_pontuacao >= 0.52:
            janela_ativa = self.obter_janela_ativa()
            if (
                janela_ativa
                and int(janela_ativa.get("pid", 0) or 0) > 0
                and int(janela_ativa.get("pid", 0) or 0) == int(melhor.get("pid", 0) or -1)
                and int(janela_ativa.get("hwnd", 0) or 0) != int(melhor.get("hwnd", 0) or 0)
            ):
                melhor = janela_ativa
            chave_log = f"{titulo_consulta}|{melhor['title']}"
            if self._janela_alvo_logada != chave_log:
                safe_print(f"Janela alvo capturada: {melhor['title']}", flush=True)
                self._janela_alvo_logada = chave_log
            self._janela_contexto = str(melhor.get("title") or "").strip()
            self._janela_fixada = melhor
            self._janela_pendente_logada = False
            return melhor

        if not self._janela_pendente_logada:
            safe_print(f"Aguardando janela alvo: {titulo_consulta}", flush=True)
            self._janela_pendente_logada = True
        return None

    def obter_regiao_busca(self, titulo_janela=None, margem=0):
        janela = self.localizar_janela_alvo(titulo_janela)
        if not janela:
            return None
        margem = max(0, int(margem or 0))
        return (
            int(janela["left"]) - margem,
            int(janela["top"]) - margem,
            int(janela["width"]) + margem * 2,
            int(janela["height"]) + margem * 2,
        )

    def ativar_janela_alvo(self, titulo_janela=None):
        if not hasattr(ctypes, "windll"):
            return None

        janela = self.localizar_janela_alvo(titulo_janela)
        if not janela:
            return None

        hwnd = int(janela.get("hwnd") or 0)
        if not hwnd:
            return janela

        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        SW_RESTORE = 9
        janela_ativa = self.obter_janela_ativa()

        if (
            janela_ativa
            and int(janela_ativa.get("pid", 0) or 0) > 0
            and int(janela_ativa.get("pid", 0) or 0) == int(janela.get("pid", 0) or -1)
        ):
            return janela_ativa

        try:
            if user32.IsIconic(wintypes.HWND(hwnd)):
                user32.ShowWindow(wintypes.HWND(hwnd), SW_RESTORE)
            try:
                foreground_hwnd = int(user32.GetForegroundWindow() or 0)
                foreground_thread = int(user32.GetWindowThreadProcessId(wintypes.HWND(foreground_hwnd), None) or 0)
                target_thread = int(user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), None) or 0)
                current_thread = int(kernel32.GetCurrentThreadId() or 0)
                if foreground_thread and current_thread and foreground_thread != current_thread:
                    user32.AttachThreadInput(current_thread, foreground_thread, True)
                if target_thread and foreground_thread and target_thread != foreground_thread:
                    user32.AttachThreadInput(target_thread, foreground_thread, True)
            except Exception:
                foreground_thread = 0
                target_thread = 0
                current_thread = 0
            user32.SetForegroundWindow(wintypes.HWND(hwnd))
            user32.SetActiveWindow(wintypes.HWND(hwnd))
            user32.SetFocus(wintypes.HWND(hwnd))
            user32.BringWindowToTop(wintypes.HWND(hwnd))
            try:
                if foreground_thread and current_thread and foreground_thread != current_thread:
                    user32.AttachThreadInput(current_thread, foreground_thread, False)
                if target_thread and foreground_thread and target_thread != foreground_thread:
                    user32.AttachThreadInput(target_thread, foreground_thread, False)
            except Exception:
                pass
        except Exception:
            return janela

        chave_log = f"{titulo_janela or self.janela_alvo}|{janela['title']}"
        if self._janela_alvo_ativada_logada != chave_log:
            safe_print(f"Janela alvo ativada: {janela['title']}", flush=True)
            self._janela_alvo_ativada_logada = chave_log
        self._janela_fixada = janela
        return janela

    def preparar_janela_para_acao(self, titulo_janela=None):
        titulo = str(titulo_janela or self._janela_contexto or self.janela_alvo or "").strip()
        if not titulo:
            return None
        janela = self.ativar_janela_alvo(titulo)
        if janela and str(janela.get("title") or "").strip():
            self._janela_contexto = str(janela.get("title") or "").strip()
        return janela

    def bounds_reconhecimento(self, local):
        if isinstance(local, dict):
            esquerda = int(local.get("left", local.get("x", 0)))
            topo = int(local.get("top", local.get("y", 0)))
            largura = max(24, int(local.get("width", 48)))
            altura = max(24, int(local.get("height", 32)))
            return esquerda, topo, largura, altura

        esquerda = int(getattr(local, "left", 0))
        topo = int(getattr(local, "top", 0))
        largura = max(24, int(getattr(local, "width", 48)))
        altura = max(24, int(getattr(local, "height", 32)))
        return esquerda, topo, largura, altura

    def chave_historico_reconhecimento(self, imagem_id, janela_alvo=None):
        imagem_norm = str(imagem_id or "").strip().replace("\\", "/").lower()
        janela_norm = self.normalizar_texto_busca(janela_alvo or self._janela_contexto or self.janela_alvo or "")
        return f"{imagem_norm}::{janela_norm}"

    def registrar_reconhecimento_bem_sucedido(self, imagem_id, local, janela_alvo=None):
        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        chave = self.chave_historico_reconhecimento(imagem_id, janela_alvo=janela_alvo)
        self._historico_reconhecimento[chave] = {
            "left": esquerda,
            "top": topo,
            "width": largura,
            "height": altura,
            "updated_at": time.time(),
        }

    def obter_regiao_historica_reconhecimento(self, imagem_id, janela_alvo=None):
        chave = self.chave_historico_reconhecimento(imagem_id, janela_alvo=janela_alvo)
        dados = self._historico_reconhecimento.get(chave)
        if not dados:
            return None
        esquerda = int(dados.get("left", 0))
        topo = int(dados.get("top", 0))
        largura = max(24, int(dados.get("width", 0) or 24))
        altura = max(24, int(dados.get("height", 0) or 24))
        margem_x = max(40, int(largura * 1.8))
        margem_y = max(28, int(altura * 1.8))
        return (
            max(0, esquerda - margem_x),
            max(0, topo - margem_y),
            largura + margem_x * 2,
            altura + margem_y * 2,
        )

    def marcar_area_reconhecida(self, local, duracao=1.1, bloqueante=False):
        if not TK_DISPONIVEL:
            return

        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        margem = 8
        esquerda -= margem
        topo -= margem
        largura += margem * 2
        altura += margem * 2

        def exibir():
            try:
                cor_borda = "#2ecc71"
                cor_texto = "#7dffac"
                espessura = 6
                raiz = tk.Tk()
                raiz.withdraw()
                raiz.attributes("-topmost", True)
                janelas = []

                def criar_barra(x, y, w, h):
                    barra = tk.Toplevel(raiz)
                    barra.overrideredirect(True)
                    barra.attributes("-topmost", True)
                    barra.configure(bg=cor_borda)
                    barra.geometry(f"{int(max(2, w))}x{int(max(2, h))}+{int(x)}+{int(y)}")
                    janelas.append(barra)
                    return barra

                criar_barra(esquerda, topo, largura, espessura)
                criar_barra(esquerda, topo + altura - espessura, largura, espessura)
                criar_barra(esquerda, topo, espessura, altura)
                criar_barra(esquerda + largura - espessura, topo, espessura, altura)

                texto = tk.Toplevel(raiz)
                texto.overrideredirect(True)
                texto.attributes("-topmost", True)
                texto.configure(bg="#0d1117")
                texto.geometry(f"180x34+{int(esquerda + max(0, largura / 2 - 90))}+{int(max(0, topo - 40))}")
                label = tk.Label(
                    texto,
                    text="Reconhecido",
                    bg="#0d1117",
                    fg=cor_texto,
                    font=("Segoe UI", 12, "bold"),
                    padx=10,
                    pady=4,
                )
                label.pack(fill="both", expand=True)
                janelas.append(texto)

                for janela in janelas:
                    try:
                        janela.lift()
                        janela.update_idletasks()
                    except Exception:
                        pass

                fim = time.perf_counter() + max(0.2, float(duracao))
                while time.perf_counter() < fim:
                    try:
                        raiz.update_idletasks()
                        raiz.update()
                    except Exception:
                        pass
                    for janela in list(janelas):
                        try:
                            janela.update()
                        except Exception:
                            pass
                    time.sleep(0.02)

                for janela in janelas:
                    try:
                        janela.destroy()
                    except Exception:
                        pass
                try:
                    raiz.destroy()
                except Exception:
                    pass
            except Exception as erro:
                safe_print(f"Falha ao exibir marcador visual: {erro}", flush=True)
                return

        if bloqueante:
            exibir()
            return

        threading.Thread(target=exibir, daemon=True).start()

    def centro_area_reconhecida(self, local, offset_x=0, offset_y=0):
        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        centro_x = esquerda + int(largura / 2)
        centro_y = topo + int(altura / 2)
        return int(centro_x + int(offset_x or 0)), int(centro_y + int(offset_y or 0))

    def confirmar_localizacao_imagem(self, caminho_imagem, local, confianca=0.8, perfil_busca="balanced"):
        perfil_busca = str(perfil_busca or "balanced").strip().lower()
        if perfil_busca not in {"fast", "balanced", "precise"}:
            perfil_busca = "balanced"
        modo_estrito = float(confianca or 0.8) >= 0.99

        if perfil_busca == "fast" and isinstance(local, dict):
            score_local = float(local.get("score", 0.0) or 0.0)
            if score_local >= max(0.9, float(confianca or 0.8) - 0.04):
                return local

        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        margem = 6 if modo_estrito else (12 if perfil_busca == "fast" else 24)
        regiao = (
            int(esquerda - margem),
            int(topo - margem),
            int(largura + margem * 2),
            int(altura + margem * 2),
        )
        confianca_confirmacao = max(0.88, float(confianca or 0.8))

        try:
            local_template = self.procurar_imagem_por_template(
                caminho_imagem,
                confianca=confianca_confirmacao,
                region=regiao,
                perfil_busca=perfil_busca,
            )
            if local_template and self.validar_correspondencia_visual(caminho_imagem, local_template, confianca_confirmacao):
                return local_template
        except Exception:
            pass

        if perfil_busca == "fast" or modo_estrito:
            return None

        try:
            if OPENCV_DISPONIVEL:
                local_confirmado = pyautogui.locateOnScreen(
                    str(caminho_imagem),
                    confidence=confianca_confirmacao,
                    grayscale=False,
                    region=regiao,
                )
            else:
                local_confirmado = pyautogui.locateOnScreen(
                    str(caminho_imagem),
                    grayscale=False,
                    region=regiao,
                )
            if local_confirmado and self.validar_correspondencia_visual(caminho_imagem, local_confirmado, confianca_confirmacao):
                return local_confirmado
        except Exception:
            return None
        return None

    def clicar_area_reconhecida(self, local, offset_x=0, offset_y=0, button="left", clicks=1, janela_alvo=None):
        destino_x, destino_y = self.centro_area_reconhecida(local, offset_x=offset_x, offset_y=offset_y)
        safe_print(f"Clicando em X/Y: {destino_x}/{destino_y}", flush=True)
        janela_preparada = self.preparar_janela_para_acao(janela_alvo)
        if janela_preparada:
            time.sleep(0.08)
        total_clicks = max(1, int(clicks or 1))
        if hasattr(ctypes, "windll"):
            user32 = ctypes.windll.user32
            eventos = {
                "left": (0x0002, 0x0004),
                "right": (0x0008, 0x0010),
                "middle": (0x0020, 0x0040),
            }
            down_flag, up_flag = eventos.get(str(button or "left").lower(), (0x0002, 0x0004))
            user32.SetCursorPos(int(destino_x), int(destino_y))
            time.sleep(0.06)
            for indice in range(total_clicks):
                user32.mouse_event(down_flag, 0, 0, 0, 0)
                time.sleep(0.05)
                user32.mouse_event(up_flag, 0, 0, 0, 0)
                if indice < total_clicks - 1:
                    time.sleep(0.09)
        else:
            pyautogui.moveTo(destino_x, destino_y, duration=0.12)
            time.sleep(0.06)
            for indice in range(total_clicks):
                pyautogui.mouseDown(x=destino_x, y=destino_y, button=button)
                time.sleep(0.04)
                pyautogui.mouseUp(x=destino_x, y=destino_y, button=button)
                if indice < total_clicks - 1:
                    time.sleep(0.09)
        safe_print(f"Clique executado em X/Y: {destino_x}/{destino_y} | clicks={total_clicks}", flush=True)
        return {"x": destino_x, "y": destino_y}

    def extrair_texto_referencia(self, caminho_imagem):
        if not OCR_DISPONIVEL:
            return ""

        try:
            with Image.open(caminho_imagem) as imagem:
                texto = pytesseract.image_to_string(imagem, config="--psm 6")
        except Exception:
            return ""

        return self.normalizar_texto_ocr(texto)

    def obter_dimensoes_imagem(self, caminho_imagem):
        if not PIL_DISPONIVEL:
            return None
        try:
            with Image.open(caminho_imagem) as imagem:
                return int(imagem.width), int(imagem.height)
        except Exception:
            return None

    def carregar_template_imagem(self, caminho_imagem):
        if not OPENCV_DISPONIVEL or np is None:
            return None

        caminho = str(caminho_imagem)
        try:
            mtime = Path(caminho_imagem).stat().st_mtime
        except Exception:
            mtime = None

        cache = self._cache_template_imagem.get(caminho)
        if cache and cache.get("mtime") == mtime:
            return cache

        try:
            referencia_bgr = cv2.imread(caminho, cv2.IMREAD_COLOR)
            if referencia_bgr is None:
                return None
            referencia_gray = cv2.cvtColor(referencia_bgr, cv2.COLOR_BGR2GRAY)
            referencia_edges = cv2.Canny(referencia_gray, 60, 160)
            cache = {
                "mtime": mtime,
                "bgr": referencia_bgr,
                "gray": referencia_gray,
                "edges": referencia_edges,
                "width": int(referencia_gray.shape[1]),
                "height": int(referencia_gray.shape[0]),
            }
            self._cache_template_imagem[caminho] = cache
            return cache
        except Exception:
            return None

    def avaliar_patch_template(self, patch_bgr, patch_gray, template):
        if not OPENCV_DISPONIVEL or np is None or not template:
            return None

        referencia_bgr = template["bgr"]
        referencia_gray = template["gray"]
        referencia_edges = template["edges"]

        if patch_bgr is None or patch_gray is None:
            return None

        try:
            if patch_bgr.shape[:2] != referencia_bgr.shape[:2]:
                patch_bgr = cv2.resize(
                    patch_bgr,
                    (referencia_bgr.shape[1], referencia_bgr.shape[0]),
                    interpolation=cv2.INTER_LINEAR,
                )
                patch_gray = cv2.resize(
                    patch_gray,
                    (referencia_gray.shape[1], referencia_gray.shape[0]),
                    interpolation=cv2.INTER_LINEAR,
                )

            diferenca = cv2.absdiff(patch_bgr, referencia_bgr)
            similaridade_cor = 1.0 - (float(diferenca.mean()) / 255.0)

            diferenca_gray = cv2.absdiff(patch_gray, referencia_gray)
            similaridade_tons = 1.0 - (float(diferenca_gray.mean()) / 255.0)

            edges_patch = cv2.Canny(patch_gray, 60, 160)
            intersecao_edges = cv2.bitwise_and(edges_patch, referencia_edges)
            uniao_edges = cv2.bitwise_or(edges_patch, referencia_edges)
            total_uniao = max(1, int(np.count_nonzero(uniao_edges)))
            similaridade_bordas = float(np.count_nonzero(intersecao_edges)) / float(total_uniao)

            correlacao_exata = float(
                cv2.matchTemplate(patch_gray, referencia_gray, cv2.TM_CCOEFF_NORMED)[0][0]
            )

            hist_patch = cv2.calcHist([patch_gray], [0], None, [32], [0, 256])
            hist_ref = cv2.calcHist([referencia_gray], [0], None, [32], [0, 256])
            cv2.normalize(hist_patch, hist_patch)
            cv2.normalize(hist_ref, hist_ref)
            similaridade_hist = float(cv2.compareHist(hist_patch, hist_ref, cv2.HISTCMP_CORREL))
        except Exception:
            return None

        score_composto = (
            (similaridade_cor * 0.22)
            + (similaridade_tons * 0.22)
            + (similaridade_bordas * 0.20)
            + (correlacao_exata * 0.26)
            + (similaridade_hist * 0.10)
        )

        return {
            "color": float(similaridade_cor),
            "gray": float(similaridade_tons),
            "edges": float(similaridade_bordas),
            "corr": float(correlacao_exata),
            "hist": float(similaridade_hist),
            "composite": float(score_composto),
        }

    def obter_metricas_tela_virtual(self):
        if not hasattr(ctypes, "windll"):
            return 0, 0, 0, 0
        user32 = ctypes.windll.user32
        SM_XVIRTUALSCREEN = 76
        SM_YVIRTUALSCREEN = 77
        SM_CXVIRTUALSCREEN = 78
        SM_CYVIRTUALSCREEN = 79
        esquerda = int(user32.GetSystemMetrics(SM_XVIRTUALSCREEN))
        topo = int(user32.GetSystemMetrics(SM_YVIRTUALSCREEN))
        largura = int(user32.GetSystemMetrics(SM_CXVIRTUALSCREEN))
        altura = int(user32.GetSystemMetrics(SM_CYVIRTUALSCREEN))
        return esquerda, topo, largura, altura

    def capturar_tela_pil(self, region=None):
        if not PIL_DISPONIVEL:
            raise RuntimeError("Pillow indisponivel para captura visual.")

        if ImageGrab is None:
            captura = pyautogui.screenshot(region=region) if region else pyautogui.screenshot()
            base_left = int(region[0]) if region else 0
            base_top = int(region[1]) if region else 0
            return captura, base_left, base_top

        try:
            if region:
                left = int(region[0])
                top = int(region[1])
                right = int(region[0] + region[2])
                bottom = int(region[1] + region[3])
                captura = ImageGrab.grab(bbox=(left, top, right, bottom), all_screens=True)
                return captura, left, top

            esquerda_virtual, topo_virtual, largura_virtual, altura_virtual = self.obter_metricas_tela_virtual()
            captura = ImageGrab.grab(all_screens=True)
        except Exception:
            captura = pyautogui.screenshot(region=region) if region else pyautogui.screenshot()
            base_left = int(region[0]) if region else 0
            base_top = int(region[1]) if region else 0
            return captura, base_left, base_top

        if not region:
            return captura, esquerda_virtual, topo_virtual

        rel_left = int(region[0] - esquerda_virtual)
        rel_top = int(region[1] - topo_virtual)
        rel_right = int(rel_left + region[2])
        rel_bottom = int(rel_top + region[3])

        rel_left_clamped = max(0, min(captura.width, rel_left))
        rel_top_clamped = max(0, min(captura.height, rel_top))
        rel_right_clamped = max(rel_left_clamped, min(captura.width, rel_right))
        rel_bottom_clamped = max(rel_top_clamped, min(captura.height, rel_bottom))

        cortada = captura.crop((rel_left_clamped, rel_top_clamped, rel_right_clamped, rel_bottom_clamped))
        base_left = int(esquerda_virtual + rel_left_clamped)
        base_top = int(topo_virtual + rel_top_clamped)
        return cortada, base_left, base_top

    def validar_correspondencia_visual(self, caminho_imagem, local, confianca=0.8):
        if not OPENCV_DISPONIVEL or not PIL_DISPONIVEL or np is None:
            return True

        template = self.carregar_template_imagem(caminho_imagem)
        if not template:
            return True

        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        try:
            captura, _base_left, _base_top = self.capturar_tela_pil(region=(esquerda, topo, largura, altura))
            captura_bgr = cv2.cvtColor(np.array(captura), cv2.COLOR_RGB2BGR)
            captura_gray = cv2.cvtColor(captura_bgr, cv2.COLOR_BGR2GRAY)
        except Exception:
            return True

        metricas = self.avaliar_patch_template(captura_bgr, captura_gray, template)
        if not metricas:
            return True

        similaridade_cor = metricas["color"]
        similaridade_tons = metricas["gray"]
        similaridade_bordas = metricas["edges"]
        correlacao_exata = metricas["corr"]
        similaridade_hist = metricas["hist"]
        score_composto = metricas["composite"]

        confianca = float(confianca or 0.8)
        if confianca >= 0.99:
            limite_cor = 0.96
            limite_tons = 0.96
            limite_bordas = 0.58
            limite_correlacao = 0.92
            limite_composto = 0.89
        elif confianca >= 0.9:
            limite_cor = 0.90
            limite_tons = 0.92
            limite_bordas = 0.46
            limite_correlacao = 0.85
            limite_composto = 0.81
        else:
            limite_cor = 0.84
            limite_tons = 0.86
            limite_bordas = 0.34
            limite_correlacao = 0.78
            limite_composto = 0.74

        passou_regra_principal = (
            similaridade_cor >= limite_cor
            and similaridade_tons >= limite_tons
            and similaridade_bordas >= limite_bordas
            and correlacao_exata >= limite_correlacao
        )

        passou_regra_texto_compacto = (
            similaridade_cor >= max(limite_cor, 0.94)
            and similaridade_tons >= max(limite_tons, 0.94)
            and similaridade_hist >= 0.92
            and correlacao_exata >= 0.62
        )

        passou_regra_visual_forte = (
            similaridade_cor >= 0.97
            and similaridade_tons >= 0.97
            and similaridade_hist >= 0.94
            and (similaridade_bordas >= 0.22 or correlacao_exata >= 0.60)
        )

        passou_regra_composta = (
            score_composto >= limite_composto
            and similaridade_hist >= 0.88
            and similaridade_cor >= max(0.90, limite_cor)
            and similaridade_tons >= max(0.90, limite_tons)
            and correlacao_exata >= max(0.58, limite_correlacao - 0.12)
        )

        if not (
            passou_regra_principal
            or passou_regra_texto_compacto
            or passou_regra_visual_forte
            or passou_regra_composta
        ):
            safe_print(
                "Correspondencia visual rejeitada "
                f"(cor={similaridade_cor:.2f}, tons={similaridade_tons:.2f}, "
                f"bordas={similaridade_bordas:.2f}, corr={correlacao_exata:.2f}, "
                f"hist={similaridade_hist:.2f}, comp={score_composto:.2f}).",
                flush=True,
            )
            return False
        return True

    def procurar_texto_por_ocr(self, texto_referencia, region=None):
        if not OCR_DISPONIVEL:
            if not self._ocr_indisponivel_logado:
                safe_print("OCR indisponivel para reforco de reconhecimento.", flush=True)
                self._ocr_indisponivel_logado = True
            return None

        texto_alvo = self.normalizar_texto_ocr(texto_referencia)
        if len(texto_alvo.replace(" ", "")) < 3:
            return None

        try:
            captura, base_left, base_top = self.capturar_tela_pil(region=region)
        except OSError as erro:
            raise RuntimeError(f"PyAutoGUI nao conseguiu capturar a tela para OCR: {erro}") from erro

        try:
            dados = pytesseract.image_to_data(
                captura,
                output_type=pytesseract.Output.DICT,
                config="--psm 6",
            )
        except Exception:
            return None

        palavras = []
        total_itens = len(dados.get("text", []))
        for indice in range(total_itens):
            texto = self.normalizar_texto_ocr(dados["text"][indice])
            if not texto:
                continue
            palavras.append(
                {
                    "texto": texto,
                    "left": int(dados["left"][indice]),
                    "top": int(dados["top"][indice]),
                    "width": int(dados["width"][indice]),
                    "height": int(dados["height"][indice]),
                }
            )

        if not palavras:
            return None

        alvo_palavras = texto_alvo.split()
        minimo_palavras = max(1, len(alvo_palavras) - 2)
        maximo_palavras = min(len(palavras), len(alvo_palavras) + 2)
        melhor = None
        melhor_pontuacao = 0.0

        for tamanho in range(minimo_palavras, maximo_palavras + 1):
            for inicio in range(0, len(palavras) - tamanho + 1):
                trecho = palavras[inicio : inicio + tamanho]
                candidato = " ".join(item["texto"] for item in trecho)
                pontuacao = difflib.SequenceMatcher(None, texto_alvo, candidato).ratio()
                if pontuacao <= melhor_pontuacao:
                    continue

                esquerda = min(item["left"] for item in trecho)
                topo = min(item["top"] for item in trecho)
                direita = max(item["left"] + item["width"] for item in trecho)
                base = max(item["top"] + item["height"] for item in trecho)
                centro_x = esquerda + ((direita - esquerda) / 2)
                centro_y = topo + ((base - topo) / 2)

                centro_x += base_left
                centro_y += base_top

                melhor = {
                    "x": int(centro_x),
                    "y": int(centro_y),
                    "left": int(esquerda + base_left),
                    "top": int(topo + base_top),
                    "width": int(direita - esquerda),
                    "height": int(base - topo),
                    "score": pontuacao,
                    "texto": candidato,
                }
                melhor_pontuacao = pontuacao

        limite = 0.68 if len(alvo_palavras) > 1 else 0.8
        if melhor and melhor_pontuacao >= limite:
            safe_print(f"Texto da referencia encontrado por OCR (score={melhor_pontuacao:.2f})", flush=True)
            return melhor
        return None

    def procurar_imagem_por_template(self, caminho_imagem, confianca=0.8, region=None, perfil_busca="balanced"):
        if not OPENCV_DISPONIVEL or not PIL_DISPONIVEL or np is None:
            return None

        perfil_busca = str(perfil_busca or "balanced").strip().lower()
        if perfil_busca not in {"fast", "balanced", "precise"}:
            perfil_busca = "balanced"
        modo_estrito = float(confianca or 0.8) >= 0.99

        try:
            captura, base_left, base_top = self.capturar_tela_pil(region=region)
        except OSError as erro:
            raise RuntimeError(f"PyAutoGUI nao conseguiu capturar a tela para template matching: {erro}") from erro

        try:
            tela_bgr = cv2.cvtColor(np.array(captura), cv2.COLOR_RGB2BGR)
            tela_gray = cv2.cvtColor(tela_bgr, cv2.COLOR_BGR2GRAY)
            template = self.carregar_template_imagem(caminho_imagem)
            if not template:
                return None
            referencia_gray = template["gray"]
        except Exception:
            return None

        altura_tela, largura_tela = tela_gray.shape[:2]
        candidatos = []
        melhor = None
        melhor_score = -1.0
        segundo_melhor_score = -1.0
        if modo_estrito:
            escalas = (1.0,)
            metodos = (
                ("sqdiff", cv2.TM_SQDIFF_NORMED),
                ("ccoeff", cv2.TM_CCOEFF_NORMED),
            )
        elif perfil_busca == "fast":
            escalas = (1.0, 0.97, 1.03)
            metodos = (
                ("ccoeff", cv2.TM_CCOEFF_NORMED),
                ("sqdiff", cv2.TM_SQDIFF_NORMED),
            )
        elif perfil_busca == "precise":
            escalas = (1.0, 0.97, 1.03, 0.94, 1.06)
            metodos = (
                ("ccoeff", cv2.TM_CCOEFF_NORMED),
                ("ccorr", cv2.TM_CCORR_NORMED),
                ("sqdiff", cv2.TM_SQDIFF_NORMED),
            )
        else:
            escalas = (1.0, 0.97, 1.03, 0.94, 1.06)
            metodos = (
                ("ccorr", cv2.TM_CCORR_NORMED),
                ("sqdiff", cv2.TM_SQDIFF_NORMED),
                ("ccoeff", cv2.TM_CCOEFF_NORMED),
            )

        for escala in escalas:
            try:
                if escala == 1.0:
                    ref_gray = referencia_gray
                else:
                    largura_ref = max(8, int(referencia_gray.shape[1] * escala))
                    altura_ref = max(8, int(referencia_gray.shape[0] * escala))
                    ref_gray = cv2.resize(referencia_gray, (largura_ref, altura_ref), interpolation=cv2.INTER_AREA if escala < 1 else cv2.INTER_LINEAR)
            except Exception:
                continue

            altura_ref, largura_ref = ref_gray.shape[:2]
            if largura_ref >= largura_tela or altura_ref >= altura_tela:
                continue

            for nome_metodo, metodo_cv in metodos:
                try:
                    resultado = cv2.matchTemplate(tela_gray, ref_gray, metodo_cv)
                except Exception:
                    continue

                try:
                    resultado_norm = (1.0 - resultado) if metodo_cv == cv2.TM_SQDIFF_NORMED else resultado
                    total_valores = int(resultado_norm.size or 0)
                    if total_valores <= 0:
                        continue
                    top_k = 2 if modo_estrito else (3 if perfil_busca == "fast" else (6 if perfil_busca == "precise" else 4))
                    top_k = min(top_k, total_valores)
                    flat = resultado_norm.reshape(-1)
                    indices = np.argpartition(flat, -top_k)[-top_k:]
                    indices = indices[np.argsort(flat[indices])[::-1]]
                except Exception:
                    continue

                template_redimensionado = {
                    **template,
                    "bgr": cv2.resize(template["bgr"], (largura_ref, altura_ref), interpolation=cv2.INTER_LINEAR)
                    if (template["width"] != largura_ref or template["height"] != altura_ref)
                    else template["bgr"],
                    "gray": ref_gray,
                    "edges": cv2.Canny(ref_gray, 60, 160),
                }

                for indice_flat in indices:
                    top, left = np.unravel_index(int(indice_flat), resultado_norm.shape)
                    left = int(left)
                    top = int(top)
                    score_atual = float(resultado_norm[top, left])
                    if score_atual < max(0.62, float(confianca) - 0.18):
                        continue

                    patch_bgr = tela_bgr[top : top + altura_ref, left : left + largura_ref]
                    patch_gray = tela_gray[top : top + altura_ref, left : left + largura_ref]
                    metricas = self.avaliar_patch_template(
                        patch_bgr,
                        patch_gray,
                        template_redimensionado,
                    )
                    score_composto = float(metricas["composite"]) if metricas else float(score_atual)
                    score_ranqueado = (score_atual * 0.58) + (score_composto * 0.42)

                    candidato = {
                        "left": int(left + base_left),
                        "top": int(top + base_top),
                        "width": int(largura_ref),
                        "height": int(altura_ref),
                        "x": int(left + (largura_ref / 2) + base_left),
                        "y": int(top + (altura_ref / 2) + base_top),
                        "score": float(score_atual),
                        "rank_score": float(score_ranqueado),
                        "quality_score": float(score_composto),
                        "scale": float(escala),
                        "method": nome_metodo,
                        "metrics": metricas or {},
                    }
                    candidatos.append(candidato)

        if candidatos:
            candidatos.sort(key=lambda item: float(item.get("rank_score", 0.0)), reverse=True)
            filtrados = []
            for candidato in candidatos:
                if any(
                    abs(int(candidato["left"]) - int(existente["left"])) < 10
                    and abs(int(candidato["top"]) - int(existente["top"])) < 10
                    and abs(int(candidato["width"]) - int(existente["width"])) < 12
                    and abs(int(candidato["height"]) - int(existente["height"])) < 12
                    for existente in filtrados
                ):
                    continue
                filtrados.append(candidato)
                if len(filtrados) >= 12:
                    break
            candidatos = filtrados
            melhor = candidatos[0]
            melhor_score = float(melhor.get("rank_score", 0.0))
            segundo_melhor_score = float(candidatos[1].get("rank_score", 0.0)) if len(candidatos) > 1 else -1.0

        self._ultimo_template_debug = melhor

        if modo_estrito:
            limite = 0.88
        elif perfil_busca == "precise":
            limite = max(0.78, float(confianca) - 0.04)
        elif perfil_busca == "balanced":
            limite = max(0.75, float(confianca) - 0.05)
        else:
            limite = max(0.73, float(confianca) - 0.06)

        ambiguidade = (
            melhor
            and segundo_melhor_score > 0
            and (
                (modo_estrito and abs(float(melhor.get("rank_score", 0.0)) - float(segundo_melhor_score)) < 0.004)
                or (
                    perfil_busca == "precise"
                    and abs(float(melhor.get("rank_score", 0.0)) - float(segundo_melhor_score)) < 0.003
                )
            )
        )

        metricas_melhor = (melhor or {}).get("metrics") or {}
        aceite_por_score_bruto = (
            melhor
            and float(melhor.get("score", 0.0)) >= max(0.84, float(confianca))
            and float(melhor.get("quality_score", 0.0)) >= 0.72
            and float(metricas_melhor.get("corr", 0.0)) >= 0.58
            and float(metricas_melhor.get("gray", 0.0)) >= 0.88
        )

        if candidatos:
            for candidato in candidatos:
                metricas_candidato = candidato.get("metrics") or {}
                aceite_por_score_bruto_candidato = (
                    float(candidato.get("score", 0.0)) >= max(0.84, float(confianca))
                    and float(candidato.get("quality_score", 0.0)) >= 0.72
                    and float(metricas_candidato.get("corr", 0.0)) >= 0.58
                    and float(metricas_candidato.get("gray", 0.0)) >= 0.88
                )
                if float(candidato.get("rank_score", 0.0)) < limite and not aceite_por_score_bruto_candidato:
                    continue
                safe_print(
                    "Imagem encontrada por template "
                    f"(score={float(candidato.get('score', 0.0)):.2f}, rank={float(candidato.get('rank_score', 0.0)):.2f}, "
                    f"qualidade={float(candidato.get('quality_score', 0.0)):.2f}, escala={candidato['scale']:.2f}, "
                    f"metodo={candidato.get('method', 'desconhecido')}, corr={float((metricas_candidato or {}).get('corr', 0.0)):.2f})",
                    flush=True,
                )
                return candidato
        if ambiguidade:
            safe_print(
                "Correspondencia visual rejeitada por ambiguidade entre candidatos proximos.",
                flush=True,
            )
        elif melhor:
            metricas = melhor.get("metrics") or {}
            safe_print(
                "Template rejeitado por rigidez "
                f"(score={float(melhor.get('score', 0.0)):.2f}, rank={float(melhor.get('rank_score', 0.0)):.2f}, "
                f"qualidade={float(melhor.get('quality_score', 0.0)):.2f}, cor={float(metricas.get('color', 0.0)):.2f}, "
                f"tons={float(metricas.get('gray', 0.0)):.2f}, bordas={float(metricas.get('edges', 0.0)):.2f}, "
                f"corr={float(metricas.get('corr', 0.0)):.2f}).",
                flush=True,
            )
        return None

    def salvar_diagnostico_reconhecimento(self, caminho_imagem, region=None, titulo_janela=""):
        if not PIL_DISPONIVEL:
            return None

        try:
            captura, base_left, base_top = self.capturar_tela_pil(region=region)
        except Exception:
            return None

    def salvar_captura_bruta_reconhecimento(self, region=None, titulo_janela=""):
        if not PIL_DISPONIVEL:
            return None

        try:
            captura, base_left, base_top = self.capturar_tela_pil(region=region)
            PASTA_DIAGNOSTICOS_RECONHECIMENTO.mkdir(parents=True, exist_ok=True)
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            imagem_saida = PASTA_DIAGNOSTICOS_RECONHECIMENTO / f"captura_bruta_{timestamp}.png"
            captura.save(imagem_saida)
            metadata_saida = PASTA_DIAGNOSTICOS_RECONHECIMENTO / f"captura_bruta_{timestamp}.json"
            metadata_saida.write_text(
                json.dumps(
                    {
                        "janela_alvo": str(titulo_janela or self.janela_alvo or ""),
                        "regiao_busca": list(region) if region else None,
                        "base_left": int(base_left),
                        "base_top": int(base_top),
                        "width": int(captura.width),
                        "height": int(captura.height),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            return str(imagem_saida)
        except Exception:
            return None

        try:
            PASTA_DIAGNOSTICOS_RECONHECIMENTO.mkdir(parents=True, exist_ok=True)
            draw = ImageDraw.Draw(captura) if ImageDraw is not None else None
            melhor = self._ultimo_template_debug or {}
            score = float(melhor.get("score", 0.0) or 0.0)
            if draw and melhor:
                left = int(melhor.get("left", 0) - base_left)
                top = int(melhor.get("top", 0) - base_top)
                width = int(melhor.get("width", 0))
                height = int(melhor.get("height", 0))
                if width > 0 and height > 0:
                    draw.rectangle((left, top, left + width, top + height), outline="#ff9f43", width=3)
                    legenda = f"Melhor score: {score:.2f}"
                    draw.rectangle((max(0, left), max(0, top - 24), max(120, left + 180), max(20, top)), fill="#111827")
                    draw.text((max(4, left + 4), max(2, top - 20)), legenda, fill="#ff9f43")

            timestamp = time.strftime("%Y%m%d_%H%M%S")
            arquivo_base = f"diagnostico_{timestamp}"
            imagem_saida = PASTA_DIAGNOSTICOS_RECONHECIMENTO / f"{arquivo_base}.png"
            captura.save(imagem_saida)

            metadados = {
                "imagem_referencia": str(caminho_imagem),
                "janela_alvo": str(titulo_janela or self.janela_alvo or ""),
                "regiao_busca": list(region) if region else None,
                "base_left": int(base_left),
                "base_top": int(base_top),
                "melhor_template": melhor or None,
            }
            metadata_saida = PASTA_DIAGNOSTICOS_RECONHECIMENTO / f"{arquivo_base}.json"
            metadata_saida.write_text(json.dumps(metadados, ensure_ascii=False, indent=2), encoding="utf-8")
            self._ultimo_diagnostico_reconhecimento = str(imagem_saida)
            return str(imagem_saida)
        except Exception:
            return None

    def emitir_progresso(self, atual, total, descricao, empresa=""):
        total_seguro = max(1, int(total or 1))
        percentual = round((max(0, atual) / total_seguro) * 100, 1)
        safe_print(
            "PROGRESS|"
            f"{int(max(0, atual))}|{total_seguro}|{percentual}|"
            f"{self.limpar_saida_status(descricao)}|{self.limpar_saida_status(empresa)}",
            flush=True,
        )

    def identificar_coluna_empresa(self, colunas):
        candidatos_exatos = {
            "empresa",
            "razao social",
            "nome empresa",
            "cliente",
            "nome",
        }
        candidatos_parciais = ("empresa", "razao", "cliente")
        for coluna in colunas:
            nome = str(coluna).strip().lower()
            if nome in candidatos_exatos:
                return coluna
        for coluna in colunas:
            nome = str(coluna).strip().lower()
            if any(parte in nome for parte in candidatos_parciais):
                return coluna
        return None

    def obter_registros_planilha(self, arquivo, aba):
        return self.planilha_cache.get(self.normalizar_id_planilha(arquivo), {}).get(aba, {}).get("linhas", [])

    def obter_valores_evento_planilha(self, evento):
        detalhes = evento.get("detalhes", {})
        arquivo = self.normalizar_id_planilha(detalhes.get("arquivo"))
        aba = detalhes.get("aba")
        coluna = detalhes.get("coluna")
        if not aba or not coluna:
            return [valor for valor in detalhes.get("valores", [])]

        registros = self.planilha_cache.get(arquivo, {}).get(aba, {}).get("linhas", [])
        if not registros:
            return [valor for valor in detalhes.get("valores", [])]

        linhas_selecionadas = [int(linha) for linha in (detalhes.get("linhas_selecionadas") or [])]
        registros_por_linha = {int(registro.get("__linha__", 0)): registro for registro in registros}

        if linhas_selecionadas:
            valores = []
            for numero_linha in linhas_selecionadas:
                registro = registros_por_linha.get(numero_linha)
                if not registro:
                    continue
                valor = registro.get(coluna)
                if valor is None or str(valor).strip() == "":
                    continue
                valores.append(valor)
            return valores

        valores = []
        for registro in registros:
            valor = registro.get(coluna)
            if valor is None or str(valor).strip() == "":
                continue
            valores.append(valor)
        return valores if valores else [valor for valor in detalhes.get("valores", [])]

    def obter_linhas_evento_planilha(self, detalhes):
        linhas_selecionadas = detalhes.get("linhas_selecionadas") or []
        if linhas_selecionadas:
            return [int(linha) for linha in linhas_selecionadas]

        arquivo = self.normalizar_id_planilha(detalhes.get("arquivo"))
        aba = detalhes.get("aba")
        coluna = detalhes.get("coluna")
        if not aba or not coluna:
            return []

        linhas = []
        for registro in self.obter_registros_planilha(arquivo, aba):
            valor = registro.get(coluna)
            if valor is None or str(valor).strip() == "":
                continue
            linhas.append(int(registro.get("__linha__", 0)))
        return linhas

    def resolver_inicio_loop(self, evento_planilha, loop_start):
        detalhes = evento_planilha.get("detalhes", {})
        valores = self.obter_valores_evento_planilha(evento_planilha)
        total_iteracoes = len(valores)
        if total_iteracoes == 0:
            raise ValueError("A sequencia de planilha nao possui valores para o loop.")

        linha_solicitada = max(1, int(loop_start or 1))
        linhas = self.obter_linhas_evento_planilha(detalhes)

        if not linhas:
            indice_inicial = linha_solicitada - 1
            if indice_inicial >= total_iteracoes:
                raise ValueError(
                    f"O item inicial {linha_solicitada} esta fora do intervalo do loop (1 a {total_iteracoes})."
                )
            return indice_inicial, linha_solicitada, total_iteracoes, linhas

        for indice, numero_linha in enumerate(linhas):
            if numero_linha >= linha_solicitada:
                return indice, numero_linha, total_iteracoes, linhas

        raise ValueError(
            f"A linha inicial {linha_solicitada} esta fora do intervalo do loop. "
            f"Ultima linha disponivel: {linhas[-1]}."
        )

    def obter_valor_evento_planilha_no_loop(self, evento, linha_referencia, indice_fallback):
        detalhes = evento.get("detalhes", {})
        coluna = detalhes.get("coluna")
        arquivo = self.normalizar_id_planilha(detalhes.get("arquivo"))
        aba = detalhes.get("aba")

        if linha_referencia is not None and aba and coluna:
            for registro in self.obter_registros_planilha(arquivo, aba):
                if int(registro.get("__linha__", 0)) != int(linha_referencia):
                    continue
                valor = registro.get(coluna)
                if valor is None or str(valor).strip() == "":
                    break
                return valor

        valores = self.obter_valores_evento_planilha(evento)
        if 0 <= indice_fallback < len(valores):
            return valores[indice_fallback]
        return None

    def obter_contexto_linha_loop(self, contexto_loop=None):
        if not contexto_loop:
            return {}
        linha_referencia = contexto_loop.get("linha_referencia")
        if linha_referencia in (None, ""):
            return {}

        for workbook_id, abas in self.planilha_cache.items():
            for nome_aba, cache_aba in (abas or {}).items():
                for registro in (cache_aba or {}).get("linhas", []):
                    if int(registro.get("__linha__", 0) or 0) != int(linha_referencia):
                        continue
                    contexto_linha = {
                        chave: valor
                        for chave, valor in registro.items()
                        if chave != "__linha__"
                    }
                    contexto_linha["__arquivo__"] = workbook_id
                    contexto_linha["__aba__"] = nome_aba
                    contexto_linha["__linha__"] = int(linha_referencia)
                    return contexto_linha
        return {}

    def salvar_variavel_contexto(self, nome, valor):
        chave = str(nome or "").strip()
        if not chave:
            return
        self.contexto_variaveis[chave] = value = "" if valor is None else str(valor)
        safe_print(f"Variavel de contexto atualizada: {chave}={value}", flush=True)

    def montar_contexto_substituicao(self, contexto_loop=None):
        contexto = {}
        for chave, valor in (self.contexto_variaveis or {}).items():
            contexto[str(chave)] = valor

        linha = self.obter_contexto_linha_loop(contexto_loop)
        contexto["linha"] = linha

        for chave, valor in linha.items():
            if str(chave).startswith("__"):
                continue
            contexto.setdefault(str(chave), valor)

        if contexto_loop:
            for chave, valor in contexto_loop.items():
                if isinstance(valor, (str, int, float, bool)) or valor is None:
                    contexto[str(chave)] = valor

        return contexto

    def resolver_variavel_contexto(self, token, contexto):
        chave = str(token or "").strip()
        if not chave:
            return ""

        if chave in contexto:
            return contexto[chave]

        atual = contexto
        for parte in chave.split("."):
            if isinstance(atual, dict) and parte in atual:
                atual = atual[parte]
                continue
            atual = None
            break
        if atual is not None:
            return atual

        linha = contexto.get("linha") if isinstance(contexto, dict) else None
        if isinstance(linha, dict):
            if chave in linha:
                return linha[chave]
            if chave.startswith("linha."):
                ultimo = chave.split(".", 1)[1]
                return linha.get(ultimo, "")

        return ""

    def substituir_variaveis_texto(self, texto, contexto_loop=None):
        if texto is None:
            return ""

        contexto = self.montar_contexto_substituicao(contexto_loop)
        bruto = str(texto)
        if "{{" not in bruto or "}}" not in bruto:
            return bruto

        def substituir(match):
            token = str(match.group(1) or "").strip()
            valor = self.resolver_variavel_contexto(token, contexto)
            return "" if valor is None else str(valor)

        return re.sub(r"\{\{\s*([^{}]+?)\s*\}\}", substituir, bruto)

    def resumir_html(self, html, limite=140):
        texto = re.sub(r"\s+", " ", str(html or "")).strip()
        if len(texto) <= limite:
            return texto
        return texto[: max(0, limite - 3)] + "..."

    def slug_texto(self, texto):
        texto = self.normalizar_texto_busca(texto).replace(" ", "_")
        return texto or "bloco"

    def garantir_playwright(self):
        if not PLAYWRIGHT_DISPONIVEL or sync_playwright is None:
            raise RuntimeError(
                "Playwright nao esta disponivel neste ambiente. "
                "Instale com: pip install playwright"
            )
        if self._playwright_runtime is None:
            self._playwright_runtime = sync_playwright().start()
        return self._playwright_runtime

    def selecionar_pagina_chrome(self, browser):
        contextos = list(getattr(browser, "contexts", []) or [])
        if contextos:
            for contexto in contextos:
                paginas = list(getattr(contexto, "pages", []) or [])
                for pagina in reversed(paginas):
                    try:
                        if not pagina.is_closed():
                            return contexto, pagina
                    except Exception:
                        continue
            try:
                return contextos[0], contextos[0].new_page()
            except Exception:
                pass

        contexto = browser.new_context(no_viewport=True, accept_downloads=True)
        return contexto, contexto.new_page()

    def garantir_sessao_chrome(self):
        if self._chrome_page is not None:
            try:
                if not self._chrome_page.is_closed():
                    return self._chrome_page
            except Exception:
                self._chrome_page = None

        runtime = self.garantir_playwright()
        chromium = runtime.chromium
        ultimo_erro = None

        for cdp_url in ("http://127.0.0.1:9222", "http://localhost:9222"):
            try:
                browser = chromium.connect_over_cdp(cdp_url)
                contexto, pagina = self.selecionar_pagina_chrome(browser)
                self._chrome_browser = browser
                self._chrome_context = contexto
                self._chrome_page = pagina
                self._chrome_source = f"cdp:{cdp_url}"
                self._chrome_launched_by_executor = False
                safe_print(f"Sessao Chrome conectada via CDP: {cdp_url}", flush=True)
                return pagina
            except Exception as erro:
                ultimo_erro = erro

        candidatos_launch = [
            {
                "channel": "chrome",
                "headless": False,
                "args": ["--start-maximized"],
            },
            {
                "headless": False,
                "args": ["--start-maximized"],
            },
        ]
        for parametros in candidatos_launch:
            try:
                browser = chromium.launch(**parametros)
                contexto = browser.new_context(no_viewport=True, accept_downloads=True)
                pagina = contexto.new_page()
                self._chrome_browser = browser
                self._chrome_context = contexto
                self._chrome_page = pagina
                self._chrome_source = "launch:chrome" if parametros.get("channel") == "chrome" else "launch:chromium"
                self._chrome_launched_by_executor = True
                safe_print(
                    "Sessao Chrome iniciada em modo controlado. "
                    "Se voce queria usar uma aba ja aberta, abra o Chrome com --remote-debugging-port=9222.",
                    flush=True,
                )
                return pagina
            except Exception as erro:
                ultimo_erro = erro

        raise RuntimeError(
            "Nao foi possivel conectar ou iniciar uma sessao Playwright/Chrome. "
            f"Ultimo erro: {ultimo_erro}"
        )

    def obter_pagina_chrome(self):
        pagina = self.garantir_sessao_chrome()
        if self._chrome_context is None and self._chrome_browser is not None:
            try:
                self._chrome_context, self._chrome_page = self.selecionar_pagina_chrome(self._chrome_browser)
                pagina = self._chrome_page
            except Exception:
                pass
        return pagina

    def criar_locator_playwright(self, page, alvo):
        alvo = alvo or {}
        metodo = str(alvo.get("metodo", "css") or "css").strip().lower()
        valor = str(alvo.get("valor", "") or "").strip()
        seletor_css = str(alvo.get("seletor_css", "") or "").strip()
        role = str(alvo.get("role", "") or "").strip()

        if not valor and not seletor_css:
            raise ValueError("O bloco Chrome nao possui alvo suficiente para localizar o elemento.")

        if metodo == "placeholder":
            return page.get_by_placeholder(valor)
        if metodo == "name":
            seletor = seletor_css or f'[name="{valor.replace("\\", "\\\\").replace("\"", "\\\"")}"]'
            return page.locator(seletor)
        if metodo == "aria-label":
            return page.get_by_label(valor)
        if metodo == "labelledby":
            seletor = seletor_css or f'[aria-labelledby="{valor.replace("\\", "\\\\").replace("\"", "\\\"")}"]'
            return page.locator(seletor)
        if metodo == "text":
            return page.get_by_text(valor, exact=True)
        if metodo == "role":
            if not role:
                raise ValueError("O metodo Role exige que o bloco tenha um role salvo.")
            return page.get_by_role(role, name=valor, exact=True)
        if metodo == "xpath":
            xpath = valor if valor.startswith("xpath=") else f"xpath={valor}"
            return page.locator(xpath)
        if metodo == "id":
            seletor = seletor_css or f'[id="{valor.replace("\\", "\\\\").replace("\"", "\\\"")}"]'
            return page.locator(seletor)
        if metodo == "css":
            return page.locator(valor or seletor_css)

        if seletor_css:
            return page.locator(seletor_css)
        return page.locator(valor)

    def salvar_captura_erro_chrome(self, nome_bloco, page=None):
        PASTA_DIAGNOSTICOS_CHROME.mkdir(parents=True, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        arquivo = PASTA_DIAGNOSTICOS_CHROME / f"{self.slug_texto(nome_bloco)}_{timestamp}.png"
        pagina = page or self._chrome_page
        try:
            if pagina is not None:
                pagina.screenshot(path=str(arquivo), full_page=True)
            else:
                pyautogui.screenshot(str(arquivo))
            return str(arquivo)
        except Exception:
            try:
                pyautogui.screenshot(str(arquivo))
                return str(arquivo)
            except Exception:
                return ""

    def executar_fallback_visual_chrome(self, evento, contexto_loop=None):
        detalhes = evento.get("detalhes", {}) or {}
        if not detalhes.get("fallback_visual"):
            return False

        imagem_fallback = str(detalhes.get("fallback_imagem", "") or "").strip()
        if not imagem_fallback:
            safe_print("Fallback visual habilitado, mas nenhuma imagem foi vinculada ao bloco Chrome.", flush=True)
            return False

        nome_bloco = str(detalhes.get("nome") or "Chrome / Elemento HTML")
        acao = dict(detalhes.get("acao") or {})
        tipo_acao = str(acao.get("tipo") or "clicar").strip().lower()
        timeout = max(0.5, float(detalhes.get("timeout", 10000) or 10000) / 1000.0)

        safe_print(f"[Chrome: {nome_bloco}] Tentando fallback visual com {imagem_fallback}.", flush=True)

        if tipo_acao in {"esperar", "verificar_existe"}:
            return bool(
                self.clicar_imagem(
                    imagem=imagem_fallback,
                    timeout=timeout,
                    confianca=0.8,
                    clicar=False,
                    perfil_busca="balanced",
                )
            )

        local = self.clicar_imagem(
            imagem=imagem_fallback,
            timeout=timeout,
            confianca=0.8,
            clicar=True,
            clicks=1,
            perfil_busca="balanced",
        )
        if not local:
            return False

        if tipo_acao == "limpar":
            pyautogui.hotkey("ctrl", "a")
            pyautogui.press("backspace")
            return True

        if tipo_acao == "preencher":
            valor = self.substituir_variaveis_texto(acao.get("valor", ""), contexto_loop)
            if acao.get("limpar_antes", True):
                pyautogui.hotkey("ctrl", "a")
                time.sleep(0.05)
                pyautogui.press("backspace")
            if valor:
                self.escrever_texto(valor)
            tecla_depois = str(acao.get("pressionar_depois", "") or "").strip()
            if tecla_depois:
                self.executar_acao(tecla_depois.lower())
            return True

        if tipo_acao in {"selecionar_texto", "selecionar_valor", "selecionar_indice"}:
            valor = self.substituir_variaveis_texto(acao.get("valor", ""), contexto_loop)
            if valor:
                self.escrever_texto(valor)
                pyautogui.press("enter")
            return True

        if tipo_acao in {"clicar", "clicar_aguardar_carregamento", "clicar_aguardar_download", "pegar_texto"}:
            return True

        return False

    def executar_bloco_chrome_elemento_html(self, evento, contexto_loop=None):
        detalhes = evento.get("detalhes", {}) or {}
        nome_bloco = str(detalhes.get("nome") or "Chrome / Elemento HTML").strip() or "Chrome / Elemento HTML"
        html_resumido = self.resumir_html(detalhes.get("html_original", ""))
        alvo = dict(detalhes.get("alvo") or {})
        acao = dict(detalhes.get("acao") or {})
        metodo = str(alvo.get("metodo") or "css").strip()
        valor_alvo = str(alvo.get("valor") or "").strip()
        tipo_acao = str(acao.get("tipo") or "clicar").strip().lower()
        timeout = max(500, int(detalhes.get("timeout", 10000) or 10000))
        tentativas = max(1, int(detalhes.get("quantidade_tentativas", 1) or 1))
        intervalo_tentativas = max(0.0, float(detalhes.get("intervalo_tentativas", 0.5) or 0.0))
        ao_sucesso = str(detalhes.get("ao_sucesso", "continuar") or "continuar").strip().lower()
        bloco_sucesso = detalhes.get("bloco_sucesso", "")
        ao_falhar = str(detalhes.get("ao_falhar", "parar") or "parar").strip().lower()
        bloco_falha = detalhes.get("bloco_falha", "")
        ultima_falha = None

        def finalizar_sucesso():
            if ao_sucesso == "ir_para_bloco" and str(bloco_sucesso or "").strip():
                safe_print(f"[Chrome: {nome_bloco}] Sucesso. Redirecionando para bloco {bloco_sucesso}.", flush=True)
                return self.resultado_fluxo("ir_para_bloco", bloco=bloco_sucesso)
            return self.resultado_fluxo("continuar")

        for tentativa in range(1, tentativas + 1):
            if self.cancelamento_solicitado():
                return self.resultado_fluxo("parar")

            safe_print(f"[Chrome: {nome_bloco}] Reconhecendo... tentativa {tentativa}/{tentativas}", flush=True)
            safe_print(f"[Chrome: {nome_bloco}] HTML: {html_resumido}", flush=True)
            safe_print(
                f"[Chrome: {nome_bloco}] Metodo: {metodo} | Alvo: {valor_alvo} | Acao: {tipo_acao}",
                flush=True,
            )

            try:
                page = self.obter_pagina_chrome()
                try:
                    page.bring_to_front()
                except Exception:
                    pass
                locator = self.criar_locator_playwright(page, alvo).first

                valor_acao = self.substituir_variaveis_texto(acao.get("valor", ""), contexto_loop)
                tecla_depois = str(acao.get("pressionar_depois", "") or "").strip()
                salvar_em = str(acao.get("salvar_em", "") or "").strip()

                if tipo_acao == "preencher":
                    locator.wait_for(state="visible", timeout=timeout)
                    if acao.get("limpar_antes", True):
                        locator.fill("", timeout=timeout)
                    locator.fill(valor_acao, timeout=timeout)
                    if tecla_depois:
                        locator.press(tecla_depois, timeout=timeout)
                    safe_print(f"[Chrome: {nome_bloco}] Valor usado: {valor_acao}", flush=True)

                elif tipo_acao == "limpar":
                    locator.wait_for(state="visible", timeout=timeout)
                    locator.fill("", timeout=timeout)

                elif tipo_acao == "clicar":
                    locator.wait_for(state="visible", timeout=timeout)
                    locator.click(timeout=timeout)

                elif tipo_acao == "esperar":
                    locator.wait_for(state="visible", timeout=timeout)

                elif tipo_acao == "verificar_existe":
                    locator.wait_for(state="attached", timeout=timeout)

                elif tipo_acao == "pegar_texto":
                    locator.wait_for(state="visible", timeout=timeout)
                    texto_capturado = locator.inner_text(timeout=timeout)
                    if salvar_em:
                        self.salvar_variavel_contexto(salvar_em, texto_capturado)
                    safe_print(f"[Chrome: {nome_bloco}] Texto capturado: {texto_capturado}", flush=True)

                elif tipo_acao == "clicar_aguardar_carregamento":
                    locator.wait_for(state="visible", timeout=timeout)
                    locator.click(timeout=timeout)
                    page.wait_for_load_state("load", timeout=timeout)

                elif tipo_acao == "clicar_aguardar_download":
                    locator.wait_for(state="visible", timeout=timeout)
                    with page.expect_download(timeout=timeout) as download_info:
                        locator.click(timeout=timeout)
                    download = download_info.value
                    if salvar_em:
                        self.salvar_variavel_contexto(salvar_em, download.suggested_filename)
                    safe_print(
                        f"[Chrome: {nome_bloco}] Download detectado: {download.suggested_filename}",
                        flush=True,
                    )

                elif tipo_acao == "selecionar_texto":
                    locator.wait_for(state="visible", timeout=timeout)
                    locator.select_option(label=valor_acao, timeout=timeout)

                elif tipo_acao == "selecionar_valor":
                    locator.wait_for(state="visible", timeout=timeout)
                    locator.select_option(value=valor_acao, timeout=timeout)

                elif tipo_acao == "selecionar_indice":
                    locator.wait_for(state="visible", timeout=timeout)
                    indice = max(0, int(valor_acao or 0))
                    locator.select_option(index=indice, timeout=timeout)

                else:
                    raise ValueError(f"A acao Chrome nao eh suportada: {tipo_acao}")

                safe_print(f"[Chrome: {nome_bloco}] Resultado: sucesso", flush=True)
                return finalizar_sucesso()

            except Exception as erro:
                ultima_falha = erro
                caminho_print = self.salvar_captura_erro_chrome(nome_bloco)
                safe_print(f"[Chrome: {nome_bloco}] Resultado: erro | {erro}", flush=True)
                if caminho_print:
                    safe_print(f"[Chrome: {nome_bloco}] Print salvo em: {caminho_print}", flush=True)

                if detalhes.get("fallback_visual") and detalhes.get("fallback_imagem"):
                    try:
                        if self.executar_fallback_visual_chrome(evento, contexto_loop=contexto_loop):
                            safe_print(f"[Chrome: {nome_bloco}] Fallback visual executado com sucesso.", flush=True)
                            return finalizar_sucesso()
                    except Exception as erro_fallback:
                        safe_print(f"[Chrome: {nome_bloco}] Falha no fallback visual: {erro_fallback}", flush=True)

                if tentativa < tentativas and intervalo_tentativas > 0:
                    if not self.esperar(intervalo_tentativas):
                        return self.resultado_fluxo("parar")

        if ao_falhar == "continuar":
            safe_print(f"[Chrome: {nome_bloco}] Falha final. Acao configurada: continuar.", flush=True)
            return self.resultado_fluxo("continuar")
        if ao_falhar == "ir_para_bloco" and str(bloco_falha or "").strip():
            safe_print(f"[Chrome: {nome_bloco}] Falha final. Redirecionando para bloco {bloco_falha}.", flush=True)
            return self.resultado_fluxo("ir_para_bloco", bloco=bloco_falha)

        if ao_falhar == "tentar_novamente":
            raise RuntimeError(
                f"Falha ao executar bloco Chrome apos {tentativas} tentativa(s): {nome_bloco} | erro: {ultima_falha}"
            ) from ultima_falha

        raise RuntimeError(
            f"Falha ao executar bloco Chrome: {nome_bloco} | metodo={metodo} | alvo={valor_alvo} | erro: {ultima_falha}"
        ) from ultima_falha

    def obter_empresa_evento_planilha(self, evento, indice_item):
        detalhes = evento.get("detalhes", {})
        aba = detalhes.get("aba")
        arquivo = self.normalizar_id_planilha(detalhes.get("arquivo"))
        if not aba:
            return ""

        cache_aba = self.planilha_cache.get(arquivo, {}).get(aba, {})
        coluna_empresa = self.identificar_coluna_empresa(cache_aba.get("colunas", []))
        if not coluna_empresa:
            return ""

        registros = self.planilha_cache.get(arquivo, {}).get(aba, {}).get("linhas", [])
        registros_por_linha = {int(registro.get("__linha__", 0)): registro for registro in registros}
        linhas_evento = self.obter_linhas_evento_planilha(detalhes)

        if indice_item < len(linhas_evento):
            registro = registros_por_linha.get(int(linhas_evento[indice_item]))
            if registro:
                empresa = registro.get(coluna_empresa)
                if empresa is not None and str(empresa).strip():
                    return str(empresa).strip()

        valores = detalhes.get("valores", [])
        if detalhes.get("coluna") == coluna_empresa and indice_item < len(valores):
            return str(valores[indice_item]).strip()
        return ""

    def descrever_evento(self, evento, indice_item=None, total_itens=None):
        tipo = evento.get("tipo")
        ordem = evento.get("ordem", "?")

        if tipo == "texto_livre":
            texto = self.limpar_saida_status(evento.get("texto", ""))
            return f"Evento #{ordem}: texto {texto[:40]}"

        if tipo in TIPOS_SEQUENCIA_PLANILHA:
            detalhes = evento.get("detalhes", {})
            coluna = detalhes.get("coluna", "coluna")
            valores = self.obter_valores_evento_planilha(evento)
            total = total_itens if total_itens is not None else len(valores)
            if indice_item is not None and indice_item < len(valores):
                valor = self.limpar_saida_status(valores[indice_item])
                return f"Evento #{ordem}: {coluna} {indice_item + 1}/{total} ({valor})"
            return f"Evento #{ordem}: sequencia da coluna {coluna}"

        if tipo in TIPOS_MOUSE:
            detalhes = evento.get("detalhes", {})
            cliques = max(1, int(detalhes.get("cliques", 1) or 1))
            return (
                f"Evento #{ordem}: mouse "
                f"{str(detalhes.get('botao', 'left')).upper()} "
                f"{'duplo ' if cliques == 2 else ''}"
                f"X={int(detalhes.get('x', 0))} Y={int(detalhes.get('y', 0))}"
            )

        if tipo in TIPOS_IMAGEM:
            detalhes = evento.get("detalhes", {})
            nome_imagem = Path(str(detalhes.get("imagem", ""))).name or "imagem"
            return f"Evento #{ordem}: imagem {nome_imagem}"

        if tipo in TIPOS_VERIFICACAO:
            detalhes = evento.get("detalhes", {})
            return f"Evento #{ordem}: {detalhes.get('nome', 'verificar estado do botao')}"

        if tipo in TIPOS_CHROME:
            detalhes = evento.get("detalhes", {})
            alvo = detalhes.get("alvo", {}) or {}
            acao = detalhes.get("acao", {}) or {}
            return (
                f"Evento #{ordem}: chrome "
                f"{self.limpar_saida_status(detalhes.get('nome', 'elemento html'))} "
                f"[{self.limpar_saida_status(alvo.get('metodo', 'css'))} -> "
                f"{self.limpar_saida_status(acao.get('tipo', 'clicar'))}]"
            )

        return f"Evento #{ordem}: {self.limpar_saida_status(evento.get('texto', 'acao'))}"

    def calcular_total_passos_normal(self):
        total = 0
        for evento in self.eventos:
            if evento.get("tipo") in TIPOS_SEQUENCIA_PLANILHA:
                total += len(self.obter_valores_evento_planilha(evento))
            else:
                total += 1
        return max(1, total)

    def resultado_fluxo(self, acao="continuar", sequencia="", bloco=""):
        return {
            "acao": str(acao or "continuar"),
            "sequencia": self.normalizar_nome_sequencia(sequencia) if sequencia else "",
            "bloco": int(bloco) if str(bloco or "").strip() else "",
        }

    def interpretar_config_acao(self, config, padrao="continuar"):
        if isinstance(config, str):
            return self.resultado_fluxo(config)
        if isinstance(config, dict):
            return self.resultado_fluxo(
                config.get("acao", padrao),
                config.get("sequencia", ""),
                config.get("bloco", ""),
            )
        return self.resultado_fluxo(padrao)

    def resultado_sucesso_evento(self, evento, prefixo_log=""):
        if self.cancelamento_solicitado():
            return self.resultado_fluxo("parar")
        detalhes = evento.get("detalhes") or {}
        acao = str(detalhes.get("ao_sucesso", "continuar") or "continuar").strip().lower()
        bloco = detalhes.get("bloco_sucesso", "")
        if acao == "ir_para_bloco" and str(bloco or "").strip():
            if prefixo_log:
                safe_print(f"{prefixo_log} Sucesso. Redirecionando para bloco {bloco}.", flush=True)
            else:
                ordem = int(evento.get("ordem", 0) or 0)
                safe_print(f"Bloco {ordem}: concluido com sucesso. Redirecionando para bloco {bloco}.", flush=True)
            return self.resultado_fluxo("ir_para_bloco", bloco=bloco)
        return self.resultado_fluxo("continuar")

    def localizar_bloco(self, ordem_destino):
        for nome_sequencia, eventos in self.sequencias.items():
            for indice, evento in enumerate(eventos):
                if int(evento.get("ordem", 0) or 0) == int(ordem_destino):
                    return nome_sequencia, indice
        raise ValueError(f"Bloco nao encontrado: {ordem_destino}")

    def cancelamento_solicitado(self):
        if self.cancelar.is_set():
            return True
        if self.arquivo_cancelamento is None:
            return False
        return self.arquivo_cancelamento.exists()

    def carregar_eventos(self):
        if not self.arquivo_mapeamento.exists():
            raise FileNotFoundError(f"Arquivo nao encontrado: {self.arquivo_mapeamento.resolve()}")

        dados = json.loads(self.arquivo_mapeamento.read_text(encoding="utf-8"))
        eventos = dados.get("eventos")
        if not isinstance(eventos, list) or not eventos:
            raise ValueError("Nenhum evento valido foi encontrado no roteiro salvo.")
        return eventos

    def carregar_planilha(self):
        arquivos = {self.normalizar_id_planilha(None)}
        for evento in self.eventos:
            if evento.get("tipo") == "sequencia_planilha":
                arquivos.add(self.normalizar_id_planilha((evento.get("detalhes") or {}).get("arquivo")))

        cache = {}
        for arquivo in arquivos:
            caminho_planilha, workbook_id = self.resolver_planilha(arquivo)
            if not caminho_planilha.exists():
                continue

            workbook = load_workbook(caminho_planilha, read_only=True, data_only=True)
            cache_workbook = {}
            for nome_aba in workbook.sheetnames:
                worksheet = workbook[nome_aba]
                linhas = list(worksheet.iter_rows(values_only=True))
                if not linhas:
                    cache_workbook[nome_aba] = {"colunas": [], "linhas": []}
                    continue

                cabecalhos = [
                    str(valor).strip() if valor is not None else f"Coluna {indice + 1}"
                    for indice, valor in enumerate(linhas[0])
                ]
                registros = []
                for numero_linha, linha in enumerate(linhas[1:], start=2):
                    registro = {"__linha__": numero_linha}
                    for indice, coluna in enumerate(cabecalhos):
                        registro[coluna] = linha[indice] if indice < len(linha) else None
                    registros.append(registro)
                cache_workbook[nome_aba] = {"colunas": cabecalhos, "linhas": registros}

            workbook.close()
            cache[workbook_id] = cache_workbook

        return cache

    def normalizar_acao(self, acao):
        if not acao:
            return []
        if isinstance(acao, str):
            texto = acao.strip().lower()
            if not texto or texto == "nenhuma":
                return []
            return [parte.strip() for parte in texto.replace(" ", "").split("+") if parte.strip()]
        return [str(parte).strip() for parte in acao if str(parte).strip()]

    def tecla_para_pyautogui(self, nome):
        if len(nome) == 1:
            return nome
        return MAPA_PYAUTOGUI.get(nome, nome)

    def eh_texto_simples(self, nome):
        return len(nome) == 1 and nome not in {"\r", "\n", "\t"}

    def escrever_texto(self, texto):
        for caractere in str(texto):
            if self.cancelamento_solicitado():
                return False
            if caractere == "\r":
                continue
            if caractere == "\n":
                pyautogui.press("enter")
                continue
            if caractere == "\t":
                pyautogui.press("tab")
                continue
            pyautogui.write(caractere, interval=INTERVALO_TEXTO)
        return True

    def esperar_imagem(self, imagem, timeout=10, confianca=0.8, janela_alvo=None, perfil_busca="balanced"):
        caminho_imagem, imagem_id = self.resolver_imagem(imagem)
        if not imagem_id:
            raise FileNotFoundError("Nenhuma imagem foi informada para o bloco clicar por imagem.")
        if not caminho_imagem.exists():
            raise FileNotFoundError(f"Imagem nao encontrada no caminho informado: {caminho_imagem}")

        janela_alvo_explicita = str(janela_alvo or "").strip()
        titulo_busca = str(janela_alvo_explicita or self._janela_contexto or self.janela_alvo or "").strip()
        janela_info_cache = None
        usando_contexto_herdado = False
        if not titulo_busca:
            janela_fixada = self.obter_janela_fixada()
            if janela_fixada and str(janela_fixada.get("title") or "").strip():
                titulo_busca = str(janela_fixada.get("title") or "").strip()
                self._janela_contexto = titulo_busca
                janela_info_cache = janela_fixada
                usando_contexto_herdado = True
                safe_print(f"Usando janela de contexto para reconhecimento: {titulo_busca}", flush=True)
        if titulo_busca:
            if usando_contexto_herdado:
                janela_resolvida = self.obter_janela_fixada()
            else:
                janela_resolvida = self.localizar_janela_alvo(titulo_busca)
            if janela_resolvida and str(janela_resolvida.get("title") or "").strip():
                titulo_busca = str(janela_resolvida.get("title") or "").strip()
                self._janela_contexto = titulo_busca
                janela_info_cache = janela_resolvida
        janela_alvo = titulo_busca or None
        reativar_janela_durante_busca = not usando_contexto_herdado and bool(janela_alvo or self.janela_alvo)

        confianca = float(confianca)
        perfil_busca = str(perfil_busca or "balanced").strip().lower()
        if perfil_busca not in {"fast", "balanced", "precise"}:
            perfil_busca = "balanced"
        modo_estrito = confianca >= 0.99

        safe_print(f"Procurando imagem: {imagem_id}", flush=True)
        safe_print(
            f"Reconhecendo... perfil={perfil_busca} | timeout={max(0.1, float(timeout))}s | confianca={confianca:.2f}",
            flush=True,
        )
        timeout_total = max(0.1, float(timeout))
        inicio_busca = time.perf_counter()
        fim = inicio_busca + timeout_total
        ultima_falha = None
        ultima_tentativa_ocr = 0.0
        ultima_ativacao_janela = 0.0
        self._ultima_regiao_reconhecimento = None
        self._ultimo_template_debug = None
        self._ultimo_diagnostico_reconhecimento = None
        texto_referencia = self.extrair_texto_referencia(caminho_imagem)
        dimensoes_referencia = self.obter_dimensoes_imagem(caminho_imagem)
        regiao_historica = self.obter_regiao_historica_reconhecimento(imagem_id, janela_alvo=janela_alvo)
        if regiao_historica:
            safe_print("Tentando reconhecimento pela ultima area valida da mesma imagem.", flush=True)
            local_historico = self.procurar_imagem_por_template(
                caminho_imagem,
                confianca=confianca,
                region=regiao_historica,
                perfil_busca="precise" if perfil_busca != "fast" else "balanced",
            )
            if local_historico and self.validar_correspondencia_visual(caminho_imagem, local_historico, confianca):
                local_confirmado = self.confirmar_localizacao_imagem(
                    caminho_imagem,
                    local_historico,
                    confianca,
                    perfil_busca="precise" if perfil_busca != "fast" else perfil_busca,
                )
                if local_confirmado:
                    self.registrar_reconhecimento_bem_sucedido(imagem_id, local_confirmado, janela_alvo=janela_alvo)
                    safe_print("Imagem encontrada usando o historico da mesma referencia.", flush=True)
                    return local_confirmado

        usa_confianca = OPENCV_DISPONIVEL
        if confianca != 1.0 and not OPENCV_DISPONIVEL:
            safe_print(
                "OpenCV indisponivel. Continuando o reconhecimento sem confidence e com reforco por OCR quando possivel.",
                flush=True,
            )

        confiancas_busca = [1.0 if modo_estrito else (confianca if usa_confianca else 1.0)]
        if usa_confianca and perfil_busca == "precise" and not modo_estrito and confianca > 0.72:
            confiancas_busca.append(round(max(0.55, confianca - 0.12), 2))

        while time.perf_counter() <= fim:
            if self.cancelamento_solicitado():
                return None
            agora = time.perf_counter()
            tempo_decorrido = max(0.0, agora - inicio_busca)
            intervalo_reativacao = 2.4 if perfil_busca == "fast" else (1.8 if perfil_busca == "balanced" else 1.0)
            if reativar_janela_durante_busca and time.perf_counter() - ultima_ativacao_janela >= intervalo_reativacao:
                janela_ativada = self.ativar_janela_alvo(janela_alvo)
                if janela_ativada:
                    janela_info_cache = janela_ativada
                ultima_ativacao_janela = time.perf_counter()
            elif reativar_janela_durante_busca and janela_info_cache is None:
                janela_info_cache = self.localizar_janela_alvo(janela_alvo)
            elif usando_contexto_herdado:
                janela_info_cache = self.obter_janela_fixada() or janela_info_cache
            margens_busca = [0]
            if janela_alvo or self.janela_alvo:
                if modo_estrito:
                    margens_busca = [0] if tempo_decorrido < timeout_total * 0.92 else [0, 6]
                elif perfil_busca == "fast":
                    margens_busca = [0] if tempo_decorrido < timeout_total * 0.9 else [0, 12]
                elif perfil_busca == "precise":
                    margens_busca = [0, 16] if tempo_decorrido < timeout_total * 0.45 else [0, 16, 32]
                else:
                    margens_busca = [0] if tempo_decorrido < timeout_total * 0.65 else [0, 24]
            regioes_busca = []
            for margem in margens_busca:
                if janela_info_cache:
                    margem = max(0, int(margem or 0))
                    regiao_candidata = (
                        int(janela_info_cache["left"]) - margem,
                        int(janela_info_cache["top"]) - margem,
                        int(janela_info_cache["width"]) + margem * 2,
                        int(janela_info_cache["height"]) + margem * 2,
                    )
                else:
                    regiao_candidata = self.obter_regiao_busca(janela_alvo, margem=margem)
                if regiao_candidata and regiao_candidata not in regioes_busca:
                    regioes_busca.append(regiao_candidata)

            self._ultima_regiao_reconhecimento = regioes_busca[-1] if regioes_busca else None
            if (janela_alvo or self.janela_alvo) and not regioes_busca:
                time.sleep(0.12)
                continue
            for regiao in regioes_busca or [None]:
                if regiao and dimensoes_referencia:
                    ref_largura, ref_altura = dimensoes_referencia
                    if ref_largura > regiao[2] or ref_altura > regiao[3]:
                        if not self._needle_maior_logada:
                            safe_print(
                                "A referencia visual eh maior que a janela alvo selecionada. "
                                "Ajuste a imagem ou escolha uma janela/regiao maior.",
                                flush=True,
                            )
                            self._needle_maior_logada = True
                        continue

                local_template_preferencial = self.procurar_imagem_por_template(
                    caminho_imagem,
                    confianca=confianca,
                    region=regiao,
                    perfil_busca=perfil_busca,
                )
                if local_template_preferencial and self.validar_correspondencia_visual(caminho_imagem, local_template_preferencial, confianca):
                    local_confirmado = self.confirmar_localizacao_imagem(
                        caminho_imagem,
                        local_template_preferencial,
                        confianca,
                        perfil_busca=perfil_busca,
                    )
                    if local_confirmado:
                        self.registrar_reconhecimento_bem_sucedido(imagem_id, local_confirmado, janela_alvo=janela_alvo)
                        safe_print("Imagem encontrada por confirmacao visual.", flush=True)
                        return local_confirmado
                    safe_print("Correspondencia visual descartada apos confirmacao.", flush=True)

                if modo_estrito:
                    grayscale_modes = (False,)
                elif perfil_busca == "fast":
                    grayscale_modes = (False,)
                elif perfil_busca == "precise":
                    grayscale_modes = (False,) if tempo_decorrido < timeout_total * 0.72 else (False, True)
                else:
                    grayscale_modes = (False,) if tempo_decorrido < timeout_total * 0.4 else (False, True)
                permitir_locate = (
                    perfil_busca == "precise"
                    and not modo_estrito
                    and tempo_decorrido >= timeout_total * 0.72
                )
                if permitir_locate:
                    for confianca_atual in confiancas_busca:
                        for grayscale in grayscale_modes:
                            try:
                                if usa_confianca:
                                    local = pyautogui.locateOnScreen(
                                        str(caminho_imagem),
                                        confidence=confianca_atual,
                                        grayscale=grayscale,
                                        region=regiao,
                                    )
                                else:
                                    local = pyautogui.locateOnScreen(
                                        str(caminho_imagem),
                                        grayscale=grayscale,
                                        region=regiao,
                                    )
                            except TypeError as erro:
                                raise RuntimeError(
                                    "Falha ao usar confidence na busca da imagem. Verifique se opencv-python esta instalado corretamente."
                                ) from erro
                            except OSError as erro:
                                raise RuntimeError(f"PyAutoGUI nao conseguiu capturar a tela para localizar a imagem: {erro}") from erro
                            except Exception as erro:
                                if "needle dimension" in str(erro).lower() or "haystack" in str(erro).lower():
                                    if not self._needle_maior_logada:
                                        safe_print(
                                            "A referencia visual eh maior que a area de busca atual. "
                                            "Verifique a janela alvo ou reduza o recorte da imagem.",
                                            flush=True,
                                        )
                                        self._needle_maior_logada = True
                                    ultima_falha = None
                                    local = None
                                    continue
                                ultima_falha = erro
                                local = None

                            if local and self.validar_correspondencia_visual(caminho_imagem, local, confianca_atual):
                                local_confirmado = self.confirmar_localizacao_imagem(
                                    caminho_imagem,
                                    local,
                                    confianca_atual,
                                    perfil_busca=perfil_busca,
                                )
                                if local_confirmado:
                                    self.registrar_reconhecimento_bem_sucedido(imagem_id, local_confirmado, janela_alvo=janela_alvo)
                                    if grayscale:
                                        safe_print(
                                            f"Imagem encontrada em modo tons de cinza (conf={confianca_atual:g})",
                                            flush=True,
                                        )
                                    else:
                                        safe_print(f"Imagem encontrada (conf={confianca_atual:g})", flush=True)
                                    return local_confirmado
                                safe_print("Correspondencia visual descartada apos confirmacao.", flush=True)

                        if (
                            perfil_busca == "precise"
                            or confianca_atual != confianca
                            or (perfil_busca == "balanced" and tempo_decorrido >= timeout_total * 0.82)
                        ):
                            local_template = self.procurar_imagem_por_template(
                                caminho_imagem,
                                confianca=confianca_atual,
                                region=regiao,
                                perfil_busca=perfil_busca,
                            )
                            if local_template and self.validar_correspondencia_visual(caminho_imagem, local_template, confianca_atual):
                                local_confirmado = self.confirmar_localizacao_imagem(
                                    caminho_imagem,
                                    local_template,
                                    confianca_atual,
                                    perfil_busca=perfil_busca,
                                )
                                if local_confirmado:
                                    self.registrar_reconhecimento_bem_sucedido(imagem_id, local_confirmado, janela_alvo=janela_alvo)
                                    safe_print("Imagem encontrada por template confirmado.", flush=True)
                                    return local_confirmado
                                safe_print("Correspondencia por template descartada apos confirmacao.", flush=True)

            intervalo_ocr = max(1.8, min(3.2, timeout_total * 0.45))
            permitir_ocr = (
                perfil_busca == "precise"
                and not modo_estrito
                and len(str(texto_referencia or "").strip()) >= 6
                and timeout_total >= 4.0
            )
            limite_inicio_ocr = timeout_total * 0.82
            if permitir_ocr and texto_referencia and tempo_decorrido >= limite_inicio_ocr and time.perf_counter() - ultima_tentativa_ocr >= intervalo_ocr:
                ultima_tentativa_ocr = time.perf_counter()
                safe_print(f"Tentando reconhecimento por texto (OCR): {texto_referencia}", flush=True)
                local_ocr = self.procurar_texto_por_ocr(texto_referencia, region=regiao)
                if local_ocr:
                    self.registrar_reconhecimento_bem_sucedido(imagem_id, local_ocr, janela_alvo=janela_alvo)
                    return local_ocr

            if perfil_busca == "fast":
                time.sleep(0.05)
            elif perfil_busca == "balanced":
                time.sleep(0.08)
            else:
                time.sleep(0.06)

        safe_print("Imagem nao encontrada", flush=True)
        safe_print("Reconhecimento finalizado sem encontrar correspondencia.", flush=True)
        if self._ultimo_template_debug:
            safe_print(
                "Melhor aproximacao por template: "
                f"score={float(self._ultimo_template_debug.get('score', 0.0)):.2f} "
                f"escala={float(self._ultimo_template_debug.get('scale', 1.0)):.2f}",
                flush=True,
            )
        diagnostico = self.salvar_diagnostico_reconhecimento(
            caminho_imagem,
            region=self._ultima_regiao_reconhecimento,
            titulo_janela=str(janela_alvo or self.janela_alvo or ""),
        )
        if diagnostico:
            safe_print(f"Diagnostico salvo em: {diagnostico}", flush=True)
        if ultima_falha is not None:
            raise RuntimeError(f"Falha ao procurar imagem na tela: {ultima_falha}") from ultima_falha
        return None

    def clicar_imagem(self, imagem, timeout=10, confianca=0.8, offset_x=0, offset_y=0, clicar=True, clicks=1, janela_alvo=None, perfil_busca="balanced"):
        local = self.esperar_imagem(
            imagem=imagem,
            timeout=timeout,
            confianca=confianca,
            janela_alvo=janela_alvo,
            perfil_busca=perfil_busca,
        )
        if not local:
            return None
        duracao_marcacao = 0.95 if clicar else 1.35
        self.marcar_area_reconhecida(local, duracao=duracao_marcacao)
        if clicar:
            time.sleep(duracao_marcacao + 0.12)
            return self.clicar_area_reconhecida(
                local,
                offset_x=offset_x,
                offset_y=offset_y,
                button="left",
                clicks=max(1, int(clicks or 1)),
                janela_alvo=janela_alvo,
            )
        destino_x, destino_y = self.centro_area_reconhecida(local, offset_x=offset_x, offset_y=offset_y)
        return {"x": destino_x, "y": destino_y}

    def testar_reconhecimento(self, imagem, timeout=10, confianca=0.8, janela_alvo=None, clicar=False, perfil_busca="balanced"):
        titulo_janela = str(janela_alvo or self.janela_alvo or "").strip()
        if titulo_janela:
            safe_print(f"Janela alvo configurada para teste: {titulo_janela}", flush=True)
        # No teste isolado, nao forcamos foco da janela alvo.
        # Isso evita fechar popups, menus ou estados transitivos
        # que a sequencia real deixa abertos antes do reconhecimento.
        time.sleep(0.28)

        regiao_teste = self.obter_regiao_busca(titulo_janela) if titulo_janela else None
        captura_bruta = self.salvar_captura_bruta_reconhecimento(region=regiao_teste, titulo_janela=titulo_janela)
        if captura_bruta:
            safe_print(f"Captura bruta do teste salva em: {captura_bruta}", flush=True)

        local = self.esperar_imagem(
            imagem=imagem,
            timeout=timeout,
            confianca=confianca,
            janela_alvo=titulo_janela,
            perfil_busca=perfil_busca,
        )
        if not local:
            safe_print("Teste de reconhecimento: nenhuma correspondencia encontrada.", flush=True)
            return False

        esquerda, topo, largura, altura = self.bounds_reconhecimento(local)
        safe_print(
            f"Teste de reconhecimento localizou a referencia em x={esquerda}, y={topo}, largura={largura}, altura={altura}.",
            flush=True,
        )
        self.marcar_area_reconhecida(local, duracao=2.4, bloqueante=True)
        if clicar:
            self.clicar_area_reconhecida(local, button="left")

        safe_print("Teste de reconhecimento concluido com sucesso.", flush=True)
        return True

    def verificar_estado_botao(
        self,
        imagem_ativo,
        imagem_desativado,
        timeout=5,
        confianca=0.85,
        se_ativo=None,
        se_desativado=None,
        se_nao_encontrar=None,
    ):
        safe_print(f"Procurando botao ativo: {imagem_ativo}", flush=True)
        ativo = self.esperar_imagem(imagem_ativo, timeout=timeout, confianca=confianca)
        if ativo:
            safe_print("Botao ativo encontrado", flush=True)
            self.marcar_area_reconhecida(ativo, duracao=1.35)
            time.sleep(0.18)
            return self.interpretar_config_acao(se_ativo, "continuar")

        safe_print(f"Procurando botao desativado: {imagem_desativado}", flush=True)
        desativado = self.esperar_imagem(imagem_desativado, timeout=timeout, confianca=confianca)
        if desativado:
            safe_print("Botao desativado encontrado", flush=True)
            self.marcar_area_reconhecida(desativado, duracao=1.35)
            time.sleep(0.18)
            return self.interpretar_config_acao(se_desativado, "continuar")

        safe_print("Nenhum estado encontrado", flush=True)
        return self.interpretar_config_acao(se_nao_encontrar, "parar")

    def esperar(self, segundos):
        fim = time.perf_counter() + max(0, float(segundos))
        while time.perf_counter() < fim:
            if self.cancelamento_solicitado():
                return False
            time.sleep(0.05)
        return True

    def executar_acao(self, acao):
        if self.cancelamento_solicitado():
            return False
        partes = self.normalizar_acao(acao)
        if not partes:
            return True
        if len(partes) == 1:
            pyautogui.press(partes[0])
            return not self.cancelamento_solicitado()
        pyautogui.hotkey(*partes)
        return not self.cancelamento_solicitado()

    def executar_evento(self, evento, contexto_loop=None):
        tipo = evento.get("tipo")

        if tipo == "texto_livre":
            self.preparar_janela_para_acao()
            return self.resultado_sucesso_evento(evento) if self.escrever_texto(evento.get("texto", "")) else self.resultado_fluxo("parar")

        if tipo in TIPOS_SEQUENCIA_PLANILHA:
            detalhes = evento.get("detalhes", {})
            self.preparar_janela_para_acao()
            acao_apos_item = detalhes.get("acao_apos_item")
            if acao_apos_item is None and detalhes.get("pressionar_enter"):
                acao_apos_item = ["enter"]

            if contexto_loop is not None:
                valor_loop = self.obter_valor_evento_planilha_no_loop(
                    evento,
                    contexto_loop.get("linha_referencia"),
                    contexto_loop.get("indice", 0),
                )
                if valor_loop is not None:
                    if not self.escrever_texto(str(valor_loop)):
                        return self.resultado_fluxo("parar")
                    if acao_apos_item and not self.executar_acao(acao_apos_item):
                        return self.resultado_fluxo("parar")
                return self.resultado_sucesso_evento(evento)

            valores = self.obter_valores_evento_planilha(evento)
            intervalo_entre_itens = detalhes.get(
                "intervalo_entre_itens",
                INTERVALO_ENTRE_ITENS_PLANILHA,
            )
            for indice, valor in enumerate(valores):
                if self.cancelamento_solicitado():
                    return self.resultado_fluxo("parar")
                if not self.escrever_texto(valor):
                    return self.resultado_fluxo("parar")
                if indice < len(valores) - 1 and acao_apos_item:
                    if not self.executar_acao(acao_apos_item):
                        return self.resultado_fluxo("parar")
                if indice < len(valores) - 1 and intervalo_entre_itens > 0:
                    if not self.esperar(intervalo_entre_itens):
                        return self.resultado_fluxo("parar")
            return self.resultado_sucesso_evento(evento)

        if tipo in TIPOS_MOUSE:
            if self.cancelamento_solicitado():
                return self.resultado_fluxo("parar")
            self.preparar_janela_para_acao()
            detalhes = evento.get("detalhes", {})
            pyautogui.click(
                x=int(detalhes.get("x", 0)),
                y=int(detalhes.get("y", 0)),
                button=str(detalhes.get("botao", "left")),
                clicks=max(1, int(detalhes.get("cliques", 1) or 1)),
            )
            return self.resultado_sucesso_evento(evento)

        if tipo in TIPOS_IMAGEM:
            detalhes = evento.get("detalhes", {})
            ordem_evento = int(evento.get("ordem", 0) or 0)
            nome_imagem = str(detalhes.get("imagem") or "")
            tentativas = max(1, int(detalhes.get("quantidade_tentativas", 1) or 1))
            intervalo_tentativas = max(0.0, float(detalhes.get("intervalo_tentativas", 1) or 1))
            timeout_reconhecimento = max(0.1, float(detalhes.get("timeout", 10) or 10))
            ao_nao_encontrar = str(detalhes.get("ao_nao_encontrar", "parar") or "parar")
            ultima_falha_reconhecimento = None
            for tentativa in range(tentativas):
                if self.cancelamento_solicitado():
                    return False
                inicio_tentativa = time.perf_counter()
                janela_reconhecimento = str(
                    detalhes.get("janela_alvo")
                    or self._janela_contexto
                    or self.janela_alvo
                    or ""
                ).strip()
                safe_print(
                    f"Bloco {ordem_evento}: reconhecendo {nome_imagem} | tentativa {tentativa + 1}/{tentativas}"
                    + (f" | janela={janela_reconhecimento}" if janela_reconhecimento else ""),
                    flush=True,
                )
                try:
                    resultado = self.clicar_imagem(
                        imagem=nome_imagem,
                        timeout=timeout_reconhecimento,
                        confianca=detalhes.get("confianca", 0.8),
                        perfil_busca=detalhes.get("perfil_busca", "balanced"),
                        offset_x=detalhes.get("offset_x", 0),
                        offset_y=detalhes.get("offset_y", 0),
                        clicar=detalhes.get("clicar", True),
                        clicks=detalhes.get("cliques", 1 if detalhes.get("clicar", True) else 0),
                        janela_alvo=detalhes.get("janela_alvo"),
                    )
                    ultima_falha_reconhecimento = None
                except Exception as erro:
                    ultima_falha_reconhecimento = erro
                    resultado = None
                    duracao_tentativa = time.perf_counter() - inicio_tentativa
                    restante = max(0.0, timeout_reconhecimento - duracao_tentativa)
                    if restante > 0 and not self.esperar(restante):
                        return self.resultado_fluxo("parar")
                    safe_print(
                        f"Falha no reconhecimento visual: {erro}",
                        flush=True,
                    )

                if resultado:
                    safe_print(
                        f"Bloco {ordem_evento}: reconhecimento confirmou {nome_imagem}.",
                        flush=True,
                    )
                    return self.resultado_sucesso_evento(evento)

                if tentativa < tentativas - 1:
                    safe_print(
                        f"Bloco {ordem_evento}: reconhecimento nao encontrou {nome_imagem}. Tentativa {tentativa + 1}/{tentativas}.",
                        flush=True,
                    )
                    if intervalo_tentativas > 0 and not self.esperar(intervalo_tentativas):
                        return self.resultado_fluxo("parar")
                    continue

            if ao_nao_encontrar in {"pular", "continuar"}:
                safe_print(
                    f"Bloco {ordem_evento}: reconhecimento nao encontrou {nome_imagem} apos {tentativas} tentativa(s). Acao: continuar.",
                    flush=True,
                )
                self.preparar_janela_para_acao(detalhes.get("janela_alvo"))
                safe_print("Reconhecimento nao encontrado. Continuando a sequencia.", flush=True)
                return self.resultado_fluxo("continuar")

            if ao_nao_encontrar == "ir_para_sequencia":
                sequencia_destino = str(detalhes.get("sequencia_nao_encontrar", "") or "").strip()
                if sequencia_destino:
                    safe_print(
                        f"Bloco {ordem_evento}: reconhecimento nao encontrou {nome_imagem} apos {tentativas} tentativa(s). Acao: ir para sequencia {sequencia_destino}.",
                        flush=True,
                    )
                    self.preparar_janela_para_acao(detalhes.get("janela_alvo"))
                    safe_print(f"Redirecionando para sequencia {sequencia_destino}", flush=True)
                    return self.resultado_fluxo("ir_para_sequencia", sequencia_destino)
                return self.resultado_fluxo("continuar")

            if ao_nao_encontrar == "ir_para_bloco":
                bloco_destino = detalhes.get("bloco_nao_encontrar", "")
                if str(bloco_destino or "").strip():
                    safe_print(
                        f"Bloco {ordem_evento}: reconhecimento nao encontrou {nome_imagem} apos {tentativas} tentativa(s). Acao: ir para bloco {bloco_destino}.",
                        flush=True,
                    )
                    self.preparar_janela_para_acao(detalhes.get("janela_alvo"))
                    safe_print(f"Redirecionando para bloco {bloco_destino}", flush=True)
                    return self.resultado_fluxo("ir_para_bloco", bloco=bloco_destino)
                return self.resultado_fluxo("continuar")

            complemento = ""
            if self._ultimo_diagnostico_reconhecimento:
                complemento = f" | diagnostico: {self._ultimo_diagnostico_reconhecimento}"
            if ultima_falha_reconhecimento is not None:
                raise RuntimeError(
                    f"Falha ao reconhecer imagem: {detalhes.get('imagem')} | erro: {ultima_falha_reconhecimento}{complemento}"
                ) from ultima_falha_reconhecimento
            raise RuntimeError(f"Imagem nao encontrada: {detalhes.get('imagem')}{complemento}")

            return self.resultado_fluxo("parar")

        if tipo in TIPOS_VERIFICACAO:
            detalhes = evento.get("detalhes", {})
            resultado = self.verificar_estado_botao(
                imagem_ativo=detalhes.get("imagem_ativo"),
                imagem_desativado=detalhes.get("imagem_desativado"),
                timeout=detalhes.get("timeout", 5),
                confianca=detalhes.get("confianca", 0.85),
                se_ativo=detalhes.get("se_ativo"),
                se_desativado=detalhes.get("se_desativado"),
                se_nao_encontrar=detalhes.get("se_nao_encontrar"),
            )
            if resultado.get("acao") == "ir_para_sequencia" and resultado.get("sequencia"):
                safe_print(f"Redirecionando para sequencia {resultado['sequencia']}", flush=True)
            return resultado

        if tipo in TIPOS_CHROME:
            return self.executar_bloco_chrome_elemento_html(evento, contexto_loop=contexto_loop)

        teclas = evento.get("teclas", [])
        if not teclas:
            return self.resultado_fluxo("continuar")

        self.preparar_janela_para_acao()

        if len(teclas) > 1:
            repeticoes = max(1, int((evento.get("detalhes") or {}).get("repeticoes", 1) or 1))
            for _ in range(repeticoes):
                if self.cancelamento_solicitado():
                    return self.resultado_fluxo("parar")
                pyautogui.hotkey(*[self.tecla_para_pyautogui(tecla) for tecla in teclas])
            return self.resultado_sucesso_evento(evento)

        tecla = teclas[0]
        repeticoes = max(1, int((evento.get("detalhes") or {}).get("repeticoes", 1) or 1))
        if self.eh_texto_simples(tecla):
            pyautogui.write(tecla * repeticoes, interval=INTERVALO_TEXTO)
            return self.resultado_sucesso_evento(evento)

        for _ in range(repeticoes):
            if self.cancelamento_solicitado():
                return self.resultado_fluxo("parar")
            pyautogui.press(self.tecla_para_pyautogui(tecla))
        return self.resultado_sucesso_evento(evento)

    def executar_fluxo(self, contexto_loop=None):
        total_passos = self.calcular_total_passos_normal()
        passo_atual = 0
        sequencia_atual = "principal" if "principal" in self.sequencias else next(iter(self.sequencias.keys()))
        pilha_retorno = []
        indice = 0

        self.emitir_progresso(0, total_passos, f"Iniciando sequencia {sequencia_atual}")

        while True:
            eventos_sequencia = self.sequencias.get(sequencia_atual, [])
            if indice >= len(eventos_sequencia):
                if pilha_retorno:
                    sequencia_atual, indice = pilha_retorno.pop()
                    continue
                return True

            evento = eventos_sequencia[indice]
            if self.cancelamento_solicitado():
                return False

            intervalo_antes = evento.get("intervalo_antes", 0)
            if intervalo_antes > 0 and not self.esperar(intervalo_antes):
                return False

            passo_atual += 1
            descricao = self.descrever_evento(evento)
            empresa = ""
            if contexto_loop is not None:
                empresa = contexto_loop.get("empresa", "")
                descricao = (
                    f"Iteracao {contexto_loop.get('indice', 0) + 1}/{contexto_loop.get('total', 1)} - "
                    f"{descricao}"
                )
            self.emitir_progresso(passo_atual, total_passos, descricao, empresa)

            resultado = self.executar_evento(evento, contexto_loop=contexto_loop)
            acao = str((resultado or {}).get("acao", "continuar"))
            destino = str((resultado or {}).get("sequencia", "")).strip()
            destino_bloco = (resultado or {}).get("bloco", "")

            if acao == "parar":
                return False
            if acao == "pular_card":
                indice += 2
                continue
            if acao == "ir_para_sequencia":
                if not destino:
                    raise ValueError("A acao ir_para_sequencia exige um nome de sequencia.")
                if destino not in self.sequencias:
                    raise ValueError(f"Sequencia nao encontrada: {destino}")
                pilha_retorno.append((sequencia_atual, indice + 1))
                sequencia_atual = destino
                indice = 0
                continue

            if acao == "ir_para_bloco":
                if not str(destino_bloco or "").strip():
                    raise ValueError("A acao ir_para_bloco exige um numero de bloco.")
                sequencia_atual, indice = self.localizar_bloco(destino_bloco)
                continue

            indice += 1

    def executar_normal(self):
        safe_print("Executando roteiro completo...", flush=True)
        self._janela_contexto = ""
        return self.executar_fluxo()

    def executar_loop(self, loop_start=1):
        evento_planilha = next(
            (evento for evento in self.eventos if evento.get("tipo") in TIPOS_SEQUENCIA_PLANILHA),
            None,
        )
        if evento_planilha is None:
            raise ValueError("Nao existe nenhuma sequencia de planilha no roteiro gravado.")
        indice_inicial, linha_inicial_real, total_iteracoes, linhas_loop = self.resolver_inicio_loop(
            evento_planilha,
            loop_start,
        )

        iteracoes_restantes = total_iteracoes - indice_inicial
        safe_print(
            f"Executando loop: {iteracoes_restantes} iteracoes a partir da linha {linha_inicial_real}.",
            flush=True,
        )

        for indice in range(indice_inicial, total_iteracoes):
            if self.cancelamento_solicitado():
                return False

            self._janela_contexto = ""

            linha_referencia = linhas_loop[indice] if indice < len(linhas_loop) else None
            empresa_atual = self.obter_empresa_evento_planilha(evento_planilha, indice)
            safe_print(f"Iteracao {indice + 1}/{total_iteracoes}", flush=True)
            if not self.executar_fluxo(
                contexto_loop={
                    "indice": indice,
                    "total": total_iteracoes,
                    "linha_referencia": linha_referencia,
                    "empresa": empresa_atual,
                }
            ):
                return False
        return True

    def fechar_sessao_chrome(self):
        try:
            if self._playwright_runtime is not None:
                self._playwright_runtime.stop()
        except Exception:
            pass
        finally:
            self._playwright_runtime = None
            self._chrome_browser = None
            self._chrome_context = None
            self._chrome_page = None
            self._chrome_source = ""
            self._chrome_launched_by_executor = False


def criar_parser():
    parser = argparse.ArgumentParser(description="Executor separado da automacao gravada.")
    parser.add_argument("--modo", choices=("normal", "loop", "reconhecimento"), default="normal")
    parser.add_argument("--atraso", type=float, default=3.0)
    parser.add_argument("--loop-start", type=int, default=1)
    parser.add_argument("--arquivo", default=str(ARQUIVO_MAPEAMENTO))
    parser.add_argument("--planilha", default=str(ARQUIVO_PLANILHA))
    parser.add_argument("--cancelamento-arquivo", default=str(ARQUIVO_CANCELAMENTO))
    parser.add_argument("--janela-alvo", default="")
    parser.add_argument("--imagem-teste", default="")
    parser.add_argument("--timeout-imagem", type=float, default=10.0)
    parser.add_argument("--confianca-imagem", type=float, default=0.8)
    parser.add_argument("--perfil-busca-imagem", default="balanced")
    return parser


def main():
    parser = criar_parser()
    args = parser.parse_args()

    if args.modo == "reconhecimento" and args.cancelamento_arquivo:
        try:
            Path(args.cancelamento_arquivo).unlink(missing_ok=True)
        except Exception:
            pass

    executor = ExecutorAutomacao(
        arquivo_mapeamento=args.arquivo,
        arquivo_planilha=args.planilha,
        arquivo_cancelamento=args.cancelamento_arquivo,
        janela_alvo=args.janela_alvo,
    )

    atraso = max(0, round(float(args.atraso), 2))
    safe_print(f"Automacao pronta. Atraso inicial: {atraso}s", flush=True)
    if executor.janela_alvo:
        safe_print(f"Janela alvo configurada: {executor.janela_alvo}", flush=True)
    if atraso > 0:
        time.sleep(atraso)

    if not executor.janela_alvo:
        janela_ativa = executor.obter_janela_ativa()
        titulo_capturado = str((janela_ativa or {}).get("title") or "").strip()
        if titulo_capturado:
            executor.janela_alvo = titulo_capturado
            executor._janela_contexto = titulo_capturado
            executor._janela_fixada = janela_ativa
            safe_print(f"Janela alvo capturada automaticamente: {titulo_capturado}", flush=True)

    try:
        try:
            if args.modo == "reconhecimento":
                sucesso = executor.testar_reconhecimento(
                    imagem=args.imagem_teste,
                    timeout=args.timeout_imagem,
                    confianca=args.confianca_imagem,
                    janela_alvo=args.janela_alvo,
                    clicar=False,
                    perfil_busca=args.perfil_busca_imagem,
                )
            elif args.modo == "loop":
                sucesso = executor.executar_loop(loop_start=args.loop_start)
            else:
                sucesso = executor.executar_normal()
        except KeyboardInterrupt:
            executor.cancelar.set()
            safe_print("Execucao interrompida pelo teclado.", flush=True)
            return 1
    finally:
        executor.fechar_sessao_chrome()

    if sucesso:
        safe_print("Automacao concluida com sucesso.", flush=True)
        return 0

    safe_print("Automacao interrompida.", flush=True)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
