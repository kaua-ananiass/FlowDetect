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
    vistos = set()

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

        chave = titulo.lower()
        if chave in vistos:
            return True

        vistos.add(chave)
        resultados.append(
            {
                "title": titulo,
                "hwnd": int(hwnd),
                "width": largura,
                "height": altura,
            }
        )
        return True

    enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(callback)
    user32.EnumWindows(enum_proc, 0)
    resultados.sort(key=lambda item: item["title"].lower())
    return {"items": resultados}


def main():
    payload = json.dumps(listar_janelas(), ensure_ascii=False)
    sys.stdout.buffer.write(payload.encode("utf-8"))


if __name__ == "__main__":
    main()
