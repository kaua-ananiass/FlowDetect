import json
import sys

try:
    from pynput import mouse as pynput_mouse
except Exception as erro:  # pragma: no cover - depende do ambiente
    print(json.dumps({"erro": f"Falha ao importar pynput.mouse: {erro}"}), flush=True)
    sys.exit(1)


def normalizar_botao(button):
    nome = getattr(button, "name", None)
    if nome:
        return str(nome).lower()

    texto = str(button).replace("Button.", "").strip().lower()
    if texto in {"left", "right", "middle"}:
        return texto
    return "left"


def main():
    resultado = {}

    def ao_clicar(x, y, button, pressed):
        nonlocal resultado
        if not pressed:
            return True

        resultado = {
            "x": int(x),
            "y": int(y),
            "button": normalizar_botao(button),
        }
        return False

    listener = pynput_mouse.Listener(on_click=ao_clicar)
    listener.start()
    listener.join()

    if not resultado:
        raise RuntimeError("Nenhum clique do mouse foi capturado.")

    print(json.dumps(resultado), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:  # pragma: no cover - depende do ambiente
        print(json.dumps({"erro": str(erro)}), flush=True)
        sys.exit(1)
