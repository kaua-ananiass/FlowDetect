from __future__ import annotations

import argparse
import ctypes
import sys
import tkinter as tk
from ctypes import wintypes


MAIN_COLOR = "#12B5CB"
GLOW_COLOR = "#5EEAD4"
OUTER_GAP = 6
GLOW_THICKNESS = 8
MAIN_THICKNESS = 4
MAIN_INSET = 2
POLL_MS = 40

DWMWA_EXTENDED_FRAME_BOUNDS = 9

GWL_EXSTYLE = -20
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_NOACTIVATE = 0x08000000
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
HWND_TOPMOST = -1
SW_SHOWNOACTIVATE = 4


def configurar_dpi() -> None:
    if sys.platform != "win32" or not hasattr(ctypes, "windll"):
        return

    try:
        ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
        return
    except Exception:
        pass

    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def safe_window_text(user32, hwnd: int) -> str:
    try:
        tamanho = int(user32.GetWindowTextLengthW(hwnd) or 0)
        if tamanho <= 0:
            return ""
        buffer = ctypes.create_unicode_buffer(tamanho + 1)
        user32.GetWindowTextW(hwnd, buffer, tamanho + 1)
        return str(buffer.value or "").strip()
    except Exception:
        return ""


def obter_info_janela(hwnd: int) -> dict | None:
    if sys.platform != "win32" or not hasattr(ctypes, "windll"):
        return None

    user32 = ctypes.windll.user32
    dwmapi = getattr(ctypes.windll, "dwmapi", None)
    hwnd = int(hwnd or 0)
    if hwnd <= 0 or not user32.IsWindow(wintypes.HWND(hwnd)):
        return None

    rect = wintypes.RECT()
    conseguiu_rect = False
    if dwmapi is not None:
        try:
            resultado = dwmapi.DwmGetWindowAttribute(
                wintypes.HWND(hwnd),
                wintypes.DWORD(DWMWA_EXTENDED_FRAME_BOUNDS),
                ctypes.byref(rect),
                ctypes.sizeof(rect),
            )
            conseguiu_rect = int(resultado or 0) == 0
        except Exception:
            conseguiu_rect = False
    if not conseguiu_rect:
        if not user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect)):
            return None

    largura = int(rect.right - rect.left)
    altura = int(rect.bottom - rect.top)
    if largura <= 0 or altura <= 0:
        return None

    return {
        "hwnd": hwnd,
        "title": safe_window_text(user32, hwnd),
        "left": int(rect.left),
        "top": int(rect.top),
        "width": largura,
        "height": altura,
        "visible": bool(user32.IsWindowVisible(wintypes.HWND(hwnd))),
        "minimized": bool(user32.IsIconic(wintypes.HWND(hwnd))),
    }


def aplicar_estilo_click_through(janela: tk.Toplevel) -> None:
    if sys.platform != "win32" or not hasattr(ctypes, "windll"):
        return

    user32 = ctypes.windll.user32
    hwnd = int(janela.winfo_id() or 0)
    if hwnd <= 0:
        return

    estilo_atual = int(user32.GetWindowLongW(wintypes.HWND(hwnd), GWL_EXSTYLE) or 0)
    novo_estilo = estilo_atual | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE
    user32.SetWindowLongW(wintypes.HWND(hwnd), GWL_EXSTYLE, novo_estilo)
    user32.SetWindowPos(
        wintypes.HWND(hwnd),
        wintypes.HWND(HWND_TOPMOST),
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    user32.ShowWindow(wintypes.HWND(hwnd), SW_SHOWNOACTIVATE)


def criar_faixa(root: tk.Tk, color: str) -> tk.Toplevel:
    janela = tk.Toplevel(root)
    janela.overrideredirect(True)
    janela.attributes("-topmost", True)
    janela.configure(bg=color)
    janela.update_idletasks()
    aplicar_estilo_click_through(janela)
    return janela


def definir_geometria(janela: tk.Toplevel, left: int, top: int, width: int, height: int) -> None:
    largura = max(1, int(width))
    altura = max(1, int(height))
    geometria = f"{largura}x{altura}{int(left):+d}{int(top):+d}"
    janela.geometry(geometria)
    janela.deiconify()
    janela.lift()


def esconder_janelas(janelas: list[tk.Toplevel]) -> None:
    for janela in janelas:
        try:
            janela.withdraw()
        except Exception:
            pass


def mostrar_overlay(janelas: dict[str, tk.Toplevel], info: dict) -> None:
    left = int(info.get("left", 0) or 0)
    top = int(info.get("top", 0) or 0)
    width = max(1, int(info.get("width", 0) or 1))
    height = max(1, int(info.get("height", 0) or 1))
    right = left + width
    bottom = top + height

    outer_left = left - OUTER_GAP
    outer_top = top - OUTER_GAP
    outer_width = width + OUTER_GAP * 2
    outer_height = height + OUTER_GAP * 2

    definir_geometria(janelas["glow_top"], outer_left, outer_top, outer_width, GLOW_THICKNESS)
    definir_geometria(janelas["glow_bottom"], outer_left, bottom + OUTER_GAP - GLOW_THICKNESS, outer_width, GLOW_THICKNESS)
    definir_geometria(janelas["glow_left"], outer_left, outer_top, GLOW_THICKNESS, outer_height)
    definir_geometria(janelas["glow_right"], right + OUTER_GAP - GLOW_THICKNESS, outer_top, GLOW_THICKNESS, outer_height)

    inner_left = outer_left + MAIN_INSET
    inner_top = outer_top + MAIN_INSET
    inner_width = max(1, outer_width - MAIN_INSET * 2)
    inner_height = max(1, outer_height - MAIN_INSET * 2)

    definir_geometria(janelas["main_top"], inner_left, inner_top, inner_width, MAIN_THICKNESS)
    definir_geometria(janelas["main_bottom"], inner_left, inner_top + inner_height - MAIN_THICKNESS, inner_width, MAIN_THICKNESS)
    definir_geometria(janelas["main_left"], inner_left, inner_top, MAIN_THICKNESS, inner_height)
    definir_geometria(janelas["main_right"], inner_left + inner_width - MAIN_THICKNESS, inner_top, MAIN_THICKNESS, inner_height)


def iniciar_overlay(hwnd: int, titulo: str) -> int:
    alvo = obter_info_janela(hwnd)
    if not alvo:
        return 2

    root = tk.Tk()
    root.withdraw()
    try:
        root.tk.call("tk", "scaling", 1.0)
    except Exception:
        pass

    janelas = {
        "glow_top": criar_faixa(root, GLOW_COLOR),
        "glow_bottom": criar_faixa(root, GLOW_COLOR),
        "glow_left": criar_faixa(root, GLOW_COLOR),
        "glow_right": criar_faixa(root, GLOW_COLOR),
        "main_top": criar_faixa(root, MAIN_COLOR),
        "main_bottom": criar_faixa(root, MAIN_COLOR),
        "main_left": criar_faixa(root, MAIN_COLOR),
        "main_right": criar_faixa(root, MAIN_COLOR),
    }
    todas = list(janelas.values())

    def atualizar() -> None:
        info = obter_info_janela(hwnd)
        if not info:
            try:
                root.destroy()
            except Exception:
                pass
            return

        if not info.get("visible") or info.get("minimized"):
            esconder_janelas(todas)
            root.after(POLL_MS, atualizar)
            return

        mostrar_overlay(janelas, info)
        root.after(POLL_MS, atualizar)

    atualizar()
    try:
        root.mainloop()
    except KeyboardInterrupt:
        pass
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Exibe um contorno click-through para a janela alvo.")
    parser.add_argument("--hwnd", type=int, required=True)
    parser.add_argument("--title", default="")
    args = parser.parse_args()

    if sys.platform != "win32":
        return 0

    configurar_dpi()
    return iniciar_overlay(args.hwnd, args.title)


if __name__ == "__main__":
    raise SystemExit(main())
