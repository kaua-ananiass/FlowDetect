"""Marcador de reconhecimento com transparência por pixel no Windows.

Não depende de Tk: o Python portátil do Studio já inclui Pillow. A janela é
passiva e desaparece antes que a automação faça outra captura de tela.
"""

import ctypes
import math
import os
import time
import threading
import queue
from functools import lru_cache
from ctypes import wintypes
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


PALETAS = {
    "variavel": {"acento": (251, 191, 36), "claro": (254, 243, 199), "fundo": (36, 27, 10)},
    "ocr": {"acento": (56, 189, 248), "claro": (186, 230, 253), "fundo": (7, 22, 37)},
    "visual": {"acento": (46, 204, 113), "claro": (187, 247, 208), "fundo": (7, 26, 22)},
}


class _Point(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]


class _Size(ctypes.Structure):
    _fields_ = [("cx", wintypes.LONG), ("cy", wintypes.LONG)]


class _Blend(ctypes.Structure):
    _fields_ = [
        ("BlendOp", wintypes.BYTE), ("BlendFlags", wintypes.BYTE),
        ("SourceConstantAlpha", wintypes.BYTE), ("AlphaFormat", wintypes.BYTE),
    ]


class _BitmapHeader(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG), ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG), ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class _BitmapInfo(ctypes.Structure):
    _fields_ = [("bmiHeader", _BitmapHeader), ("bmiColors", wintypes.DWORD * 1)]


_WNDPROC = getattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE)(
    ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM,
)


class _WindowClass(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT), ("lpfnWndProc", _WNDPROC),
        ("cbClsExtra", ctypes.c_int), ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE), ("hIcon", wintypes.HICON),
        ("hCursor", wintypes.HANDLE), ("hbrBackground", wintypes.HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR), ("lpszClassName", wintypes.LPCWSTR),
    ]


@lru_cache(maxsize=16)
def _fonte(tamanho):
    for nome in ("seguisb.ttf", "segoeui.ttf"):
        caminho = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / nome
        try:
            return ImageFont.truetype(str(caminho), tamanho)
        except OSError:
            pass
    return ImageFont.load_default()


def desenhar_marcador(largura, altura, etiqueta, tema="visual", progresso=1.0):
    """Gera um frame RGBA; também permite conferir o desenho sem abrir janela."""
    largura, altura = max(16, int(largura)), max(16, int(altura))
    cor = PALETAS["variavel" if tema == "variavel" else "ocr" if str(tema).startswith("ocr") else "visual"]
    acento, claro, fundo = cor["acento"], cor["claro"], cor["fundo"]
    escala = 2 if largura * altura <= 320_000 else 1
    fonte = _fonte(11 * escala)
    texto = str(etiqueta or "Reconhecido").upper()[:36]
    largura_rotulo = max(122, min(320, int(fonte.getlength(texto) / escala) + 53))
    largura_total = max(largura + 48, largura_rotulo + 48)
    altura_total = altura + 84
    tamanho = (largura_total * escala, altura_total * escala)
    caixa = (24, 62, 24 + largura, 62 + altura)
    x1, y1, x2, y2 = [valor * escala for valor in caixa]
    quadro = Image.new("RGBA", tamanho, (0, 0, 0, 0))

    # Halo suave em volta de uma borda mais definida, sem preencher o alvo.
    halo = Image.new("RGBA", tamanho, (0, 0, 0, 0))
    brilho = ImageDraw.Draw(halo)
    brilho.rounded_rectangle((x1, y1, x2, y2), radius=12 * escala,
                             outline=(*acento, 160), width=10 * escala)
    halo = halo.filter(ImageFilter.GaussianBlur(7 * escala))
    if largura > 28 and altura > 28:
        ImageDraw.Draw(halo).rounded_rectangle(
            (x1 + 10 * escala, y1 + 10 * escala, x2 - 10 * escala, y2 - 10 * escala),
            radius=5 * escala, fill=(0, 0, 0, 0),
        )
    quadro.alpha_composite(halo)
    desenho = ImageDraw.Draw(quadro)

    # Contorno mais firme, cantos técnicos e interior transparente.
    desenho.rounded_rectangle((x1, y1, x2, y2), radius=10 * escala,
                              outline=(*acento, 235), width=5 * escala)
    if largura > 28 and altura > 28:
        desenho.rounded_rectangle((x1 + 6 * escala, y1 + 6 * escala,
                                   x2 - 6 * escala, y2 - 6 * escala),
                                  radius=6 * escala, outline=(*acento, 45), width=1 * escala)
    canto = min(20, max(7, min(largura, altura) // 3)) * escala
    for a, b in (
        ((x1 + 10 * escala, y1), (x1 + canto, y1)),
        ((x1, y1 + 10 * escala), (x1, y1 + canto)),
        ((x2 - canto, y1), (x2 - 10 * escala, y1)),
        ((x2, y1 + 10 * escala), (x2, y1 + canto)),
        ((x1 + 10 * escala, y2), (x1 + canto, y2)),
        ((x1, y2 - canto), (x1, y2 - 10 * escala)),
        ((x2 - canto, y2), (x2 - 10 * escala, y2)),
        ((x2, y2 - canto), (x2, y2 - 10 * escala)),
    ):
        desenho.line((a, b), fill=(*claro, 245), width=3 * escala)

    # Etiqueta translúcida, com um pequeno indicador luminoso.
    rotulo = (24 * escala, 17 * escala, (24 + largura_rotulo) * escala, 46 * escala)
    desenho.rounded_rectangle(rotulo, radius=10 * escala,
                              fill=(*fundo, 236), outline=(*acento, 102), width=1 * escala)
    ponto = (39 * escala, 31 * escala)
    desenho.ellipse((ponto[0] - 7 * escala, ponto[1] - 7 * escala,
                     ponto[0] + 7 * escala, ponto[1] + 7 * escala), fill=(*acento, 25))
    desenho.ellipse((ponto[0] - 3 * escala, ponto[1] - 3 * escala,
                     ponto[0] + 3 * escala, ponto[1] + 3 * escala), fill=(*acento, 255))
    caixa_texto = desenho.textbbox((0, 0), texto, font=fonte)
    texto_y = 31 * escala - (caixa_texto[3] - caixa_texto[1]) // 2 - caixa_texto[1]
    desenho.text((54 * escala, texto_y), texto, font=fonte, fill=(*claro, 248))
    desenho.line((x1 + 11 * escala, 49 * escala, x1 + 11 * escala, y1 - 5 * escala),
                 fill=(*acento, 98), width=1 * escala)

    # Varredura breve na abertura; a confirmação permanece calma e estável.
    if progresso < 1 and altura > 20:
        posicao = y1 + (5 + (altura - 10) * progresso) * escala
        for deslocamento, transparencia in ((-3, 12), (-1, 30), (0, 80), (1, 30), (3, 12)):
            desenho.line((x1 + 9 * escala, int(posicao + deslocamento * escala),
                          x2 - 9 * escala, int(posicao + deslocamento * escala)),
                         fill=(*acento, transparencia), width=1 * escala)

    return quadro.resize((largura_total, altura_total), Image.Resampling.LANCZOS)


def aplicar_flip(imagem, abertura, tema="visual"):
    """Gira a etiqueta sem tirar o contorno do lugar do alvo."""
    abertura = max(0.0, min(1.0, float(abertura)))
    curva = abertura * abertura * (3 - 2 * abertura)
    largura, altura = imagem.size
    corte = min(58, altura)
    frame = imagem.copy()
    frame.paste((0, 0, 0, 0), (0, 0, largura, corte))
    # A borda permanece ancorada ao botão durante toda a transição.
    if curva < 1:
        alfa = frame.getchannel("A").point(lambda valor: round(valor * (0.65 + 0.35 * curva)))
        frame.putalpha(alfa)
    etiqueta = imagem.crop((0, 0, largura, corte))
    limites = etiqueta.getbbox()
    if limites:
        esquerda, topo, direita, baixo = limites
        etiqueta = etiqueta.crop(limites)
        fator = 0.10 + 0.90 * math.sin(curva * math.pi / 2)
        projetada = etiqueta.resize((max(2, round(etiqueta.width * fator)), etiqueta.height), Image.Resampling.BICUBIC)
        centro = (esquerda + direita) // 2
        frame.alpha_composite(projetada, (centro - projetada.width // 2, topo))
    return frame


def progresso_flip(tempo, duracao):
    """Entrada e saída acontecem dentro da duração original do marcador."""
    duracao = max(0.12, float(duracao))
    tempo = max(0.0, min(duracao, float(tempo)))
    entrada = min(0.24, duracao * 0.34)
    saida = min(0.19, duracao * 0.27)
    if tempo < entrada:
        return tempo / entrada
    if tempo > duracao - saida:
        return (duracao - tempo) / saida
    return 1.0


def _pixels_premultiplicados(imagem):
    vermelho, verde, azul, alfa = imagem.convert("RGBA").split()
    return Image.merge("RGBA", (
        ImageChops.multiply(azul, alfa), ImageChops.multiply(verde, alfa),
        ImageChops.multiply(vermelho, alfa), alfa,
    )).tobytes()


_cursores_retidos = {}
_servicos_cursor = {}
CURSOR_HOTSPOT = (10, 38)


class _ServicoCursor:
    """A janela e sua animação pertencem à mesma thread; entrada fica no executor."""
    def __init__(self):
        self.fila = queue.Queue()
        self.erro = None
        self.thread = threading.Thread(target=self._rodar, name='FlowDetectCursor', daemon=True)
        self.thread.start()

    def enviar(self, tipo, **dados):
        if not self.thread.is_alive():
            raise RuntimeError('Cursor visual indisponível.') from self.erro
        pedido = dict(dados, tipo=tipo, pronto=threading.Event(), fim=threading.Event())
        self.fila.put(pedido)
        return pedido

    def chamar(self, tipo, **dados):
        pedido = self.enviar(tipo, **dados)
        if not pedido['fim'].wait(3):
            raise RuntimeError('O cursor visual não respondeu.')
        if pedido.get('erro'):
            raise pedido['erro']
        return pedido.get('resultado')

    def _rodar(self):
        try:
            while True:
                try:
                    pedido = self.fila.get(timeout=1/60)
                except queue.Empty:
                    atualizar_cursor_windows()
                    continue
                try:
                    tipo = pedido['tipo']
                    if tipo == 'mover':
                        origem = posicao_cursor_windows() or pedido['origem']
                        pedido['resultado'] = exibir_marcador_windows(
                            pedido['x'], pedido['y'], 190, 96, .26, pedido['etiqueta'],
                            cursor=origem, acao=pedido['pronto'].set,
                            cancelar=pedido['cancelar'].is_set, persistir=True,
                        )
                    elif tipo == 'analise':
                        pedido['resultado'] = definir_analise_cursor_windows(pedido['ativo'])
                    elif tipo == 'suspender':
                        suspender_cursor_windows(pedido['ativo'])
                    elif tipo == 'posicao':
                        pedido['resultado'] = posicao_cursor_windows()
                    elif tipo == 'fechar':
                        return
                except Exception as erro:
                    pedido['erro'] = erro
                finally:
                    pedido['pronto'].set()
                    pedido['fim'].set()
                atualizar_cursor_windows()
        except Exception as erro:
            self.erro = erro
        finally:
            fechar_cursor_windows()


def executar_cursor_windows(x, y, etiqueta, origem, acao, cancelar):
    identidade = threading.get_ident()
    servico = _servicos_cursor.get(identidade)
    if servico is None:
        servico = _servicos_cursor[identidade] = _ServicoCursor()
    interrupcao = threading.Event()
    pedido = servico.enviar('mover', x=x, y=y, etiqueta=etiqueta, origem=origem, cancelar=interrupcao)
    while not pedido['pronto'].wait(.01):
        if cancelar():
            interrupcao.set()
            pedido['fim'].wait(1)
            raise RuntimeError('Execução interrompida antes da ação.')
        if not servico.thread.is_alive():
            raise RuntimeError('Cursor visual indisponível.') from servico.erro
    if pedido.get('erro'):
        raise pedido['erro']
    if cancelar() or not pedido.get('resultado', True) and pedido['fim'].is_set():
        raise RuntimeError('Execução interrompida antes da ação.')
    try:
        return acao()
    finally:
        pedido['fim'].wait(1)


def fechar_cursor_windows():
    servico = _servicos_cursor.pop(threading.get_ident(), None)
    if servico:
        try:
            servico.chamar('fechar')
        except Exception:
            pass
        finally:
            servico.thread.join(timeout=1)
    estado = _cursores_retidos.pop(threading.get_ident(), None)
    if estado:
        estado['limpar']()


def suspender_cursor_windows(suspenso=True):
    servico = _servicos_cursor.get(threading.get_ident())
    if servico:
        return servico.chamar('suspender', ativo=suspenso)
    estado = _cursores_retidos.get(threading.get_ident())
    if estado:
        estado['suspenso'] = suspenso
        if not suspenso and estado.get('analisando'):
            estado['origem_busca'] = estado['posicao']
            estado['inicio_busca'] = time.monotonic()
        estado['user32'].ShowWindow(estado['hwnd'], 0 if suspenso else 4)


def atualizar_cursor_windows():
    """Processa mensagens da janela passiva durante as esperas do executor."""
    if threading.get_ident() in _servicos_cursor:
        return
    estado = _cursores_retidos.get(threading.get_ident())
    if not estado:
        return
    user32 = estado['user32']
    if estado.get('analisando') and not estado.get('suspenso') and time.monotonic() - estado.get('ultimo_frame', 0) > 1/60:
        estado['ultimo_frame'] = time.monotonic()
        elapsed = time.monotonic() - estado['inicio_busca']
        fase = elapsed * math.pi / 3
        entrada = min(1, elapsed/.5)
        base_x, base_y = estado['origem_busca']
        left, top = user32.GetSystemMetrics(76), user32.GetSystemMetrics(77)
        right, bottom = left + user32.GetSystemMetrics(78), top + user32.GetSystemMetrics(79)
        x = max(left+24, min(right-24, base_x+math.sin(fase)*120*entrada))
        y = max(top+40, min(bottom-32, base_y+(1-math.cos(fase))*60*entrada))
        estado['posicao'] = (x, y)
        estado['desenhar']('Analisando', (time.monotonic() % 1.4) / 1.4, (x,y))
    user32.PeekMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT, wintypes.UINT]
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.DispatchMessageW.restype = ctypes.c_ssize_t
    user32.TranslateMessage.argtypes = [ctypes.POINTER(wintypes.MSG)]
    mensagem = wintypes.MSG()
    for _ in range(16):
        if not user32.PeekMessageW(ctypes.byref(mensagem), estado['hwnd'], 0, 0, 1):
            break
        user32.TranslateMessage(ctypes.byref(mensagem))
        user32.DispatchMessageW(ctypes.byref(mensagem))


def definir_analise_cursor_windows(ativo=True):
    servico = _servicos_cursor.get(threading.get_ident())
    if servico:
        return servico.chamar('analise', ativo=ativo)
    estado = _cursores_retidos.get(threading.get_ident())
    if not estado:
        return False
    if ativo and not estado.get('analisando'):
        estado['inicio_busca'] = time.monotonic()
        estado['origem_busca'] = estado['posicao']
    estado['analisando'] = ativo
    estado['desenhar']('Analisando' if ativo else 'Aguardando', 0)
    return True


def posicao_cursor_windows():
    servico = _servicos_cursor.get(threading.get_ident())
    if servico:
        return servico.chamar('posicao')
    estado = _cursores_retidos.get(threading.get_ident())
    return estado['posicao'] if estado else None


def exibir_marcador_windows(esquerda, topo, largura, altura, duracao, etiqueta, tema="visual", *, cursor=None, acao=None, cancelar=None, persistir=False):
    if os.name != "nt":
        return False
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.DefWindowProcW.restype = ctypes.c_ssize_t
    user32.RegisterClassW.argtypes = [ctypes.POINTER(_WindowClass)]
    user32.RegisterClassW.restype = wintypes.ATOM
    user32.CreateWindowExW.argtypes = [
        wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, ctypes.c_void_p,
    ]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.UpdateLayeredWindow.argtypes = [
        wintypes.HWND, wintypes.HDC, ctypes.POINTER(_Point), ctypes.POINTER(_Size),
        wintypes.HDC, ctypes.POINTER(_Point), wintypes.DWORD, ctypes.POINTER(_Blend), wintypes.DWORD,
    ]
    user32.UpdateLayeredWindow.restype = wintypes.BOOL
    user32.GetDC.argtypes = [wintypes.HWND]
    user32.GetDC.restype = wintypes.HDC
    user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
    user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    user32.UnregisterClassW.argtypes = [wintypes.LPCWSTR, wintypes.HINSTANCE]
    gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
    gdi32.CreateCompatibleDC.restype = wintypes.HDC
    gdi32.CreateDIBSection.argtypes = [
        wintypes.HDC, ctypes.POINTER(_BitmapInfo), wintypes.UINT,
        ctypes.POINTER(ctypes.c_void_p), wintypes.HANDLE, wintypes.DWORD,
    ]
    gdi32.CreateDIBSection.restype = wintypes.HBITMAP
    gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]
    gdi32.SelectObject.restype = wintypes.HANDLE
    gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
    gdi32.DeleteDC.argtypes = [wintypes.HDC]
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE

    @_WNDPROC
    def tratar_janela(hwnd, mensagem, wparam, lparam):
        if mensagem == 0x0084:  # WM_NCHITTEST
            return -1  # HTTRANSPARENT
        return user32.DefWindowProcW(hwnd, mensagem, wparam, lparam)

    primeira = desenhar_cursor(etiqueta) if cursor else desenhar_marcador(largura, altura, etiqueta, tema, 0)
    largura_total, altura_total = primeira.size
    nome_classe = f"FlowDetectMarkerAlpha_{os.getpid()}_{time.monotonic_ns()}"
    instancia = kernel32.GetModuleHandleW(None)
    classe = _WindowClass(0, tratar_janela, 0, 0, instancia, None, None, None, None, nome_classe)
    if not user32.RegisterClassW(ctypes.byref(classe)):
        raise OSError(f"RegisterClassW: {ctypes.get_last_error()}")
    hwnd = hdc_tela = hdc_memoria = bitmap = bitmap_anterior = None
    reter = False

    def limpar():
        # Keep the WNDPROC alive for the entire lifetime of a retained window.
        referencias = (tratar_janela, classe)
        if hwnd:
            user32.DestroyWindow(hwnd)
        if hdc_memoria and bitmap_anterior:
            gdi32.SelectObject(hdc_memoria, bitmap_anterior)
        if bitmap:
            gdi32.DeleteObject(bitmap)
        if hdc_memoria:
            gdi32.DeleteDC(hdc_memoria)
        if hdc_tela:
            user32.ReleaseDC(None, hdc_tela)
        user32.UnregisterClassW(nome_classe, instancia)

    try:
        estilos = 0x00080000 | 0x00000008 | 0x00000020 | 0x00000080 | 0x08000000
        hwnd = user32.CreateWindowExW(
            estilos, nome_classe, "", 0x80000000,
            int(esquerda) - 24, int(topo) - 62, largura_total, altura_total,
            None, None, instancia, None,
        )
        if not hwnd:
            raise OSError(f"CreateWindowExW: {ctypes.get_last_error()}")
        hdc_tela = user32.GetDC(None)
        hdc_memoria = gdi32.CreateCompatibleDC(hdc_tela)
        info = _BitmapInfo()
        info.bmiHeader = _BitmapHeader(
            ctypes.sizeof(_BitmapHeader), largura_total, -altura_total,
            1, 32, 0, largura_total * altura_total * 4, 0, 0, 0, 0,
        )
        bits = ctypes.c_void_p()
        bitmap = gdi32.CreateDIBSection(hdc_tela, ctypes.byref(info), 0, ctypes.byref(bits), None, 0)
        if not hdc_memoria or not bitmap or not bits.value:
            raise OSError(f"CreateDIBSection: {ctypes.get_last_error()}")
        bitmap_anterior = gdi32.SelectObject(hdc_memoria, bitmap)
        posicao = _Point(int(esquerda) - 24, int(topo) - 62)
        tamanho = _Size(largura_total, altura_total)
        origem = _Point(0, 0)
        blend = _Blend(0, 0, 255, 1)  # AC_SRC_OVER / AC_SRC_ALPHA
        tempo_movimento = min(.42, max(.18, .16 + math.hypot(esquerda-cursor[0], topo-cursor[1])*.0003)) if cursor else 0
        duracao_total = max(tempo_movimento + .10, float(duracao)) if cursor else max(0.12, float(duracao))
        inicio = time.monotonic()
        fim = inicio + duracao_total
        ultimo_frame = -1
        ultima_chave = None
        acao_executada = False
        animar_varredura = int(largura) * int(altura) <= 320_000
        quadros_por_segundo = 24 if animar_varredura else 12
        tempo_entrada = min(0.24, duracao_total * 0.34)
        tempo_varredura = min(0.55, max(0.1, duracao_total * 0.55))
        while True:
            if cancelar and cancelar():
                return False
            agora = time.monotonic()
            decorrido = min(duracao_total, agora - inicio)
            frame = int(decorrido * (60 if cursor else quadros_por_segundo))
            if frame != ultimo_frame:
                abertura = progresso_flip(decorrido, duracao_total)
                varredura = (min(1.0, max(0.0, (decorrido - tempo_entrada) / tempo_varredura))
                             if animar_varredura else 1.0)
                chave = (round(abertura, 2), round(varredura, 2))
                if cursor:
                    progresso = min(1.0, decorrido / tempo_movimento)
                    suavizado = progresso**3 * (10 + progresso * (-15 + 6*progresso))
                    px = cursor[0] + (esquerda-cursor[0])*suavizado
                    py = cursor[1] + (topo-cursor[1])*suavizado
                    posicao = _Point(round(px)-CURSOR_HOTSPOT[0], round(py)-CURSOR_HOTSPOT[1])
                    imagem = desenhar_cursor(etiqueta, progresso >= 1 and not acao_executada and etiqueta == 'Clique')
                    chave = frame
                if chave != ultima_chave:
                    base = primeira if frame == 0 or cursor else desenhar_marcador(
                        largura, altura, etiqueta, tema, varredura,
                    )
                    if not cursor:
                        imagem = aplicar_flip(base, abertura, tema)
                    pixels = _pixels_premultiplicados(imagem)
                    ctypes.memmove(bits.value, pixels, len(pixels))
                    if not user32.UpdateLayeredWindow(
                        hwnd, hdc_tela, ctypes.byref(posicao), ctypes.byref(tamanho),
                        hdc_memoria, ctypes.byref(origem), 0, ctypes.byref(blend), 2,
                    ):
                        raise OSError(f"UpdateLayeredWindow: {ctypes.get_last_error()}")
                    if ultimo_frame == -1:
                        user32.ShowWindow(hwnd, 4)  # SW_SHOWNOACTIVATE
                        if cursor and persistir:
                            fechar_cursor_windows()
                    ultima_chave = chave
                ultimo_frame = frame
            if cursor and decorrido >= tempo_movimento and not acao_executada:
                acao_executada = True
                if acao:
                    acao()
            if agora >= fim:
                break
            time.sleep(0.008)
        reter = bool(cursor and persistir)
        return True
    finally:
        if reter:
            fechar_cursor_windows()
            def redesenhar(rotulo, fase, ponto=None):
                if ponto:
                    posicao.x, posicao.y = round(ponto[0])-CURSOR_HOTSPOT[0], round(ponto[1])-CURSOR_HOTSPOT[1]
                pixels_cursor = _pixels_premultiplicados(desenhar_cursor(rotulo, fase=fase))
                ctypes.memmove(bits.value, pixels_cursor, len(pixels_cursor))
                user32.UpdateLayeredWindow(hwnd, hdc_tela, ctypes.byref(posicao), ctypes.byref(tamanho), hdc_memoria, ctypes.byref(origem), 0, ctypes.byref(blend), 2)
            _cursores_retidos[threading.get_ident()] = {'limpar': limpar, 'hwnd': hwnd, 'user32': user32, 'desenhar': redesenhar, 'analisando': etiqueta == 'Analisando', 'posicao': (esquerda,topo), 'origem_busca': (esquerda,topo), 'inicio_busca': time.monotonic()}
        else:
            limpar()


@lru_cache(maxsize=64)
def desenhar_cursor(etiqueta='Clique', clicando=False, fase=0):
    """Desenho em alta resolução, bordas suaves e um único selo compacto."""
    escala = 3
    imagem = Image.new('RGBA', (190*escala, 96*escala))
    desenho = ImageDraw.Draw(imagem)
    def box(coordenadas):
        return tuple(round(v*escala) for v in coordenadas)
    # Sombra leve fora da ponta; o hotspot continua exatamente em (10, 38).
    sombra = Image.new('RGBA', imagem.size)
    ds = ImageDraw.Draw(sombra)
    ds.rounded_rectangle(box((20, 5, 126, 33)), radius=12*escala, fill=(0, 8, 15, 65))
    ds.polygon([box(p) for p in [(11,40),(30,56),(22,59),(18,67)]], fill=(0,8,15,90))
    imagem.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(2*escala)))
    desenho = ImageDraw.Draw(imagem)
    desenho.rounded_rectangle(box((19, 3, 124, 31)), radius=11*escala, fill=(9,25,34,240), outline=(104,235,211,95), width=escala)
    desenho.ellipse(box((29,14,34,19)), fill='#65e4c6')
    desenho.text(box((40,9)), 'FlowDetect', font=_fonte(11*escala), fill='#e7fff9')
    pontos=[(10,38),(29,54),(20,57),(17,65),(14,53)]
    desenho.polygon([box(p) for p in pontos], fill='#aff6e3' if clicando else '#effffb')
    desenho.line([box(p) for p in pontos+[pontos[0]]], fill='#163c3b', width=escala+1, joint='curve')
    if clicando:
        # Halo pequeno junto à seta; nenhum painel ou retângulo sobre o botão.
        desenho.arc(box((2,30,28,56)), 30, 300, fill=(101,228,198,150), width=escala)
    elif etiqueta == 'Analisando':
        dx=math.sin(fase*math.tau)*1.5
        desenho.ellipse(box((36+dx,39,49+dx,52)), outline='#7ae9ce', width=escala+1)
        desenho.line([box((47+dx,50)),box((54+dx,57))], fill='#7ae9ce', width=2*escala)
    # Só operações em curso têm legenda. Clique é comunicado pela própria seta.
    rotulo = {'Analisando':'Analisando…','Digitando':'Digitando…','Teclado':'Teclado'}.get(etiqueta)
    if rotulo:
        desenho.text(box((31,66)), rotulo, font=_fonte(10*escala), fill='#92c3ba', stroke_width=escala, stroke_fill=(5,19,25,180))
    return imagem.resize((190,96), Image.Resampling.LANCZOS)
