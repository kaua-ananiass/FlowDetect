import ctypes
import json
import sys
import unicodedata
from ctypes import wintypes


def limpar_titulo(texto):
    bruto = str(texto or "")
    sem_controle = "".join(
        caractere
        for caractere in bruto
        if unicodedata.category(caractere) not in {"Cc", "Cf"}
    )
    return " ".join(sem_controle.split()).strip()


def listar_janelas():
    if not hasattr(ctypes, "windll"):
        return {"items": []}

    user32 = ctypes.windll.user32
    resultados = []

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True

        tamanho = user32.GetWindowTextLengthW(hwnd)
        if tamanho <= 0:
            return True

        buffer = ctypes.create_unicode_buffer(tamanho + 1)
        user32.GetWindowTextW(hwnd, buffer, tamanho + 1)
        titulo = limpar_titulo(buffer.value)
        if not titulo:
            return True

        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return True

        largura = int(rect.right - rect.left)
        altura = int(rect.bottom - rect.top)
        if largura <= 0 or altura <= 0:
            return True

        classe_buffer = ctypes.create_unicode_buffer(256)
        try:
            user32.GetClassNameW(hwnd, classe_buffer, 255)
            classe = limpar_titulo(classe_buffer.value)
        except Exception:
            classe = ""

        pid = wintypes.DWORD(0)
        try:
            user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(pid))
        except Exception:
            pid = wintypes.DWORD(0)

        resultados.append(
            {
                "title": titulo,
                "hwnd": int(hwnd),
                "class_name": classe,
                "pid": int(pid.value or 0),
                "left": int(rect.left),
                "top": int(rect.top),
                "width": largura,
                "height": altura,
            }
        )
        return True

    enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(callback)
    user32.EnumWindows(enum_proc, 0)
    resultados.sort(key=lambda item: (item["title"].lower(), int(item.get("hwnd", 0) or 0)))
    return {"items": resultados}


def main():
    payload = json.dumps(listar_janelas(), ensure_ascii=False)
    sys.stdout.buffer.write(payload.encode("utf-8"))


if __name__ == "__main__":
    main()
