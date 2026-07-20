from __future__ import annotations

import ctypes
import argparse
import sys
import tkinter as tk
from ctypes import wintypes


MAIN_COLOR = "#12B5CB"
GLOW_COLOR = "#5EEAD4"
SOFT_ALPHA = 0.18
GLOW_ALPHA = 0.34
MAIN_ALPHA = 0.96
SOFT_THICKNESS = 24
GLOW_THICKNESS = 14
MAIN_THICKNESS = 4
GLOW_INSET = 4
MAIN_INSET = 9
POLL_MS = 160
LABEL_HEIGHT = 42
LABEL_WIDTH = 360

SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79

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
SYNCHRONIZE = 0x00100000
WAIT_TIMEOUT = 0x00000102


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


def criar_faixa(root: tk.Tk, color: str, alpha: float) -> tk.Toplevel:
    janela = tk.Toplevel(root)
    janela.overrideredirect(True)
    janela.attributes("-topmost", True)
    janela.attributes("-alpha", max(0.0, min(1.0, float(alpha))))
    janela.configure(bg=color)
    janela.update_idletasks()
    aplicar_estilo_click_through(janela)
    return janela


def definir_geometria(janela: tk.Toplevel, left: int, top: int, width: int, height: int) -> None:
    largura = max(1, int(width))
    altura = max(1, int(height))
    janela.geometry(f"{largura}x{altura}{int(left):+d}{int(top):+d}")
    janela.deiconify()
    janela.lift()


def obter_area_virtual(root: tk.Tk) -> dict[str, int]:
    if sys.platform == "win32" and hasattr(ctypes, "windll"):
        user32 = ctypes.windll.user32
        left = int(user32.GetSystemMetrics(SM_XVIRTUALSCREEN))
        top = int(user32.GetSystemMetrics(SM_YVIRTUALSCREEN))
        width = int(user32.GetSystemMetrics(SM_CXVIRTUALSCREEN))
        height = int(user32.GetSystemMetrics(SM_CYVIRTUALSCREEN))
        if width > 0 and height > 0:
            return {
                "left": left,
                "top": top,
                "width": width,
                "height": height,
            }

    return {
        "left": 0,
        "top": 0,
        "width": int(root.winfo_screenwidth() or 1),
        "height": int(root.winfo_screenheight() or 1),
    }


def processo_ativo(pid: int | None) -> bool:
    if not pid:
        return True
    if sys.platform != "win32" or not hasattr(ctypes, "windll"):
        return True
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(SYNCHRONIZE, False, int(pid))
    if not handle:
        return False
    try:
        return int(kernel32.WaitForSingleObject(handle, 0)) == WAIT_TIMEOUT
    finally:
        kernel32.CloseHandle(handle)


def mostrar_overlay(janelas: dict[str, tk.Toplevel], area: dict[str, int]) -> None:
    left = int(area.get("left", 0) or 0)
    top = int(area.get("top", 0) or 0)
    width = max(1, int(area.get("width", 1) or 1))
    height = max(1, int(area.get("height", 1) or 1))
    right = left + width
    bottom = top + height

    definir_geometria(janelas["soft_top"], left, top, width, SOFT_THICKNESS)
    definir_geometria(janelas["soft_bottom"], left, bottom - SOFT_THICKNESS, width, SOFT_THICKNESS)
    definir_geometria(janelas["soft_left"], left, top, SOFT_THICKNESS, height)
    definir_geometria(janelas["soft_right"], right - SOFT_THICKNESS, top, SOFT_THICKNESS, height)

    glow_left = left + GLOW_INSET
    glow_top = top + GLOW_INSET
    glow_width = max(1, width - GLOW_INSET * 2)
    glow_height = max(1, height - GLOW_INSET * 2)
    glow_right = glow_left + glow_width
    glow_bottom = glow_top + glow_height

    definir_geometria(janelas["glow_top"], glow_left, glow_top, glow_width, GLOW_THICKNESS)
    definir_geometria(janelas["glow_bottom"], glow_left, glow_bottom - GLOW_THICKNESS, glow_width, GLOW_THICKNESS)
    definir_geometria(janelas["glow_left"], glow_left, glow_top, GLOW_THICKNESS, glow_height)
    definir_geometria(janelas["glow_right"], glow_right - GLOW_THICKNESS, glow_top, GLOW_THICKNESS, glow_height)

    main_left = left + MAIN_INSET
    main_top = top + MAIN_INSET
    main_width = max(1, width - MAIN_INSET * 2)
    main_height = max(1, height - MAIN_INSET * 2)
    main_right = main_left + main_width
    main_bottom = main_top + main_height

    definir_geometria(janelas["main_top"], main_left, main_top, main_width, MAIN_THICKNESS)
    definir_geometria(janelas["main_bottom"], main_left, main_bottom - MAIN_THICKNESS, main_width, MAIN_THICKNESS)
    definir_geometria(janelas["main_left"], main_left, main_top, MAIN_THICKNESS, main_height)
    definir_geometria(janelas["main_right"], main_right - MAIN_THICKNESS, main_top, MAIN_THICKNESS, main_height)

    label_width = min(LABEL_WIDTH, max(220, width - 48))
    label_left = left + max(0, (width - label_width) // 2)
    definir_geometria(janelas["label"], label_left, top + 14, label_width, LABEL_HEIGHT)


def criar_label(root: tk.Tk, texto: str) -> tk.Toplevel:
    janela = tk.Toplevel(root)
    janela.overrideredirect(True)
    janela.attributes("-topmost", True)
    janela.attributes("-alpha", 0.94)
    janela.configure(bg="#07111F")
    frame = tk.Frame(
        janela,
        bg="#07111F",
        highlightbackground=MAIN_COLOR,
        highlightthickness=2,
        bd=0,
    )
    frame.pack(fill="both", expand=True)
    label = tk.Label(
        frame,
        text=texto,
        bg="#07111F",
        fg="#E6F7FF",
        font=("Segoe UI Semibold", 12),
        padx=18,
        pady=8,
    )
    label.pack(fill="both", expand=True)
    janela.update_idletasks()
    aplicar_estilo_click_through(janela)
    return janela


def iniciar_overlay(texto: str = "Executando automacao...", seguir_pid: int | None = None) -> int:
    root = tk.Tk()
    root.withdraw()
    try:
        root.tk.call("tk", "scaling", 1.0)
    except Exception:
        pass

    janelas = {
        "soft_top": criar_faixa(root, GLOW_COLOR, SOFT_ALPHA),
        "soft_bottom": criar_faixa(root, GLOW_COLOR, SOFT_ALPHA),
        "soft_left": criar_faixa(root, GLOW_COLOR, SOFT_ALPHA),
        "soft_right": criar_faixa(root, GLOW_COLOR, SOFT_ALPHA),
        "glow_top": criar_faixa(root, GLOW_COLOR, GLOW_ALPHA),
        "glow_bottom": criar_faixa(root, GLOW_COLOR, GLOW_ALPHA),
        "glow_left": criar_faixa(root, GLOW_COLOR, GLOW_ALPHA),
        "glow_right": criar_faixa(root, GLOW_COLOR, GLOW_ALPHA),
        "main_top": criar_faixa(root, MAIN_COLOR, MAIN_ALPHA),
        "main_bottom": criar_faixa(root, MAIN_COLOR, MAIN_ALPHA),
        "main_left": criar_faixa(root, MAIN_COLOR, MAIN_ALPHA),
        "main_right": criar_faixa(root, MAIN_COLOR, MAIN_ALPHA),
        "label": criar_label(root, texto),
    }

    def atualizar() -> None:
        if not processo_ativo(seguir_pid):
            root.destroy()
            return
        mostrar_overlay(janelas, obter_area_virtual(root))
        root.after(POLL_MS, atualizar)

    atualizar()
    try:
        root.mainloop()
    except KeyboardInterrupt:
        pass
    return 0


def main() -> int:
    if sys.platform != "win32":
        return 0
    parser = argparse.ArgumentParser()
    parser.add_argument("--texto", default="Executando automacao...")
    parser.add_argument("--seguir-pid", type=int, default=0)
    args = parser.parse_args()
    configurar_dpi()
    return iniciar_overlay(args.texto, args.seguir_pid or None)


if __name__ == "__main__":
    raise SystemExit(main())
