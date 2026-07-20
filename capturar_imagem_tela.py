from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import tkinter as tk
from PIL import ImageGrab, ImageTk


SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79


def configurar_dpi_windows() -> None:
    """Ativa DPI awareness no Windows para evitar coordenadas erradas em outros PCs."""
    if sys.platform != "win32":
        return

    try:
        import ctypes

        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass


def configurar_saida_utf8() -> None:
    """Garante que a saida JSON nao quebre por causa da codificacao do terminal."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


@dataclass
class AreaSelecionada:
    esquerda: int
    topo: int
    largura: int
    altura: int

    @property
    def direita(self) -> int:
        return self.esquerda + self.largura

    @property
    def inferior(self) -> int:
        return self.topo + self.altura


def obter_limites_tela_virtual() -> tuple[int, int, int, int]:
    """Retorna os limites da area virtual de trabalho, incluindo varios monitores."""
    if sys.platform == "win32":
        import ctypes

        user32 = ctypes.windll.user32
        esquerda = int(user32.GetSystemMetrics(SM_XVIRTUALSCREEN))
        topo = int(user32.GetSystemMetrics(SM_YVIRTUALSCREEN))
        largura = int(user32.GetSystemMetrics(SM_CXVIRTUALSCREEN))
        altura = int(user32.GetSystemMetrics(SM_CYVIRTUALSCREEN))
        return esquerda, topo, largura, altura

    janela = tk.Tk()
    janela.withdraw()
    esquerda = int(janela.winfo_vrootx())
    topo = int(janela.winfo_vrooty())
    largura = int(janela.winfo_vrootwidth())
    altura = int(janela.winfo_vrootheight())
    janela.destroy()
    return esquerda, topo, largura, altura


def capturar_tela_base() -> tuple[object, tuple[int, int, int, int]]:
    """
    Faz uma captura unica da tela virtual para ser usada como base da selecao.
    Isso reduz atrasos e evita uma segunda captura pesada depois da escolha.
    """
    esquerda, topo, largura, altura = obter_limites_tela_virtual()
    bbox = (esquerda, topo, esquerda + largura, topo + altura)

    erros: list[str] = []

    try:
        imagem = ImageGrab.grab(bbox=bbox, all_screens=True)
        return imagem, (esquerda, topo, largura, altura)
    except Exception as erro:
        erros.append(f"ImageGrab bbox: {erro}")

    try:
        imagem = ImageGrab.grab(all_screens=True)
        return imagem, (esquerda, topo, largura, altura)
    except Exception as erro:
        erros.append(f"ImageGrab all_screens: {erro}")

    try:
        import pyautogui

        imagem = pyautogui.screenshot(region=(esquerda, topo, largura, altura))
        return imagem, (esquerda, topo, largura, altura)
    except Exception as erro:
        erros.append(f"PyAutoGUI screenshot: {erro}")

    raise RuntimeError(
        "Nao foi possivel capturar a tela neste computador. "
        + " | ".join(erros)
    )


def normalizar_nome_base_imagem(nome_base: str) -> str:
    """Transforma um texto livre em um nome de arquivo simples e estavel."""
    texto = Path(str(nome_base or "").strip()).stem
    if not texto:
        texto = "imagem_capturada"

    texto = unicodedata.normalize("NFKD", texto)
    texto = texto.encode("ascii", "ignore").decode("ascii")
    texto = texto.lower()
    texto = re.sub(r"[_-]\d{3,4}$", "", texto)
    texto = re.sub(r"[^a-z0-9]+", "_", texto)
    texto = texto.strip("._")
    return texto or "imagem_capturada"


def gerar_nome_automatico_imagem(pasta_imagens: Path, nome_base: str = "imagem_capturada") -> Path:
    """Gera um novo nome PNG sem sobrescrever imagens anteriores."""
    pasta_imagens.mkdir(parents=True, exist_ok=True)
    base_normalizada = normalizar_nome_base_imagem(nome_base)

    for indice in range(1, 10000):
        nome_arquivo = f"{base_normalizada}_{indice:03d}.png"
        caminho = pasta_imagens / nome_arquivo
        if not caminho.exists():
            return caminho

    raise RuntimeError("Nao foi possivel gerar um novo nome automatico para a imagem.")


def selecionar_area_da_tela(
    imagem_base,
    limites_tela_virtual: tuple[int, int, int, int],
) -> Optional[AreaSelecionada]:
    """
    Abre uma camada transparente sobre a tela para o usuario selecionar a regiao.
    Retorna None quando a captura for cancelada.
    """
    esquerda_virtual, topo_virtual, largura_virtual, altura_virtual = limites_tela_virtual
    resultado: dict[str, Optional[AreaSelecionada]] = {"area": None}

    janela = tk.Tk()
    janela.withdraw()
    janela.overrideredirect(True)
    janela.attributes("-topmost", True)

    geometria = f"{largura_virtual}x{altura_virtual}{esquerda_virtual:+d}{topo_virtual:+d}"
    janela.geometry(geometria)
    janela.configure(bg="black")
    janela.deiconify()
    janela.lift()
    janela.focus_force()

    area_desenho = tk.Canvas(janela, bg="#05070d", highlightthickness=0, cursor="crosshair")
    area_desenho.pack(fill="both", expand=True)
    imagem_tk = ImageTk.PhotoImage(imagem_base)
    area_desenho.create_image(0, 0, anchor="nw", image=imagem_tk)
    area_desenho.imagem_base = imagem_tk

    area_desenho.create_text(
        28,
        24,
        anchor="nw",
        text="Clique e arraste para capturar a imagem. Pressione Esc para cancelar.",
        fill="#E6F7FF",
        font=("Segoe UI", 11, "bold"),
    )

    estado = {
        "inicio_x": 0,
        "inicio_y": 0,
        "retangulo": None,
        "retangulo_brilho": None,
        "legenda": None,
        "legenda_fundo": None,
        "arrastando": False,
    }

    def cancelar_captura(_event=None) -> None:
        resultado["area"] = None
        janela.destroy()

    def iniciar_selecao(evento) -> None:
        estado["inicio_x"] = int(evento.x)
        estado["inicio_y"] = int(evento.y)
        estado["arrastando"] = True
        if estado["retangulo"] is not None:
            area_desenho.delete(estado["retangulo"])
        if estado["retangulo_brilho"] is not None:
            area_desenho.delete(estado["retangulo_brilho"])
        if estado["legenda"] is not None:
            area_desenho.delete(estado["legenda"])
        if estado["legenda_fundo"] is not None:
            area_desenho.delete(estado["legenda_fundo"])
        estado["retangulo_brilho"] = area_desenho.create_rectangle(
            evento.x,
            evento.y,
            evento.x,
            evento.y,
            outline="#5EEAD4",
            width=5,
            fill="",
        )
        estado["retangulo"] = area_desenho.create_rectangle(
            evento.x,
            evento.y,
            evento.x,
            evento.y,
            outline="#12B5CB",
            width=2,
            fill="",
        )

    def atualizar_selecao(evento) -> None:
        if not estado["arrastando"] or estado["retangulo"] is None:
            return

        if estado["retangulo_brilho"] is not None:
            area_desenho.coords(
                estado["retangulo_brilho"],
                estado["inicio_x"],
                estado["inicio_y"],
                evento.x,
                evento.y,
            )
        area_desenho.coords(
            estado["retangulo"],
            estado["inicio_x"],
            estado["inicio_y"],
            evento.x,
            evento.y,
        )

        largura_atual = abs(int(evento.x) - int(estado["inicio_x"]))
        altura_atual = abs(int(evento.y) - int(estado["inicio_y"]))
        texto_legenda = f"{largura_atual} x {altura_atual}"
        posicao_x = min(int(estado["inicio_x"]), int(evento.x)) + 8
        posicao_y = min(int(estado["inicio_y"]), int(evento.y)) - 10

        if estado["legenda"] is None:
            estado["legenda"] = area_desenho.create_text(
                posicao_x,
                posicao_y,
                anchor="sw",
                text=texto_legenda,
                fill="#E6F7FF",
                font=("Segoe UI", 10, "bold"),
            )
            caixa = area_desenho.bbox(estado["legenda"])
            if caixa is not None:
                estado["legenda_fundo"] = area_desenho.create_rectangle(
                    caixa[0] - 6,
                    caixa[1] - 4,
                    caixa[2] + 6,
                    caixa[3] + 4,
                    fill="#07111F",
                    outline="#12B5CB",
                    width=1,
                )
                area_desenho.tag_lower(estado["legenda_fundo"], estado["legenda"])
        else:
            area_desenho.coords(estado["legenda"], posicao_x, posicao_y)
            area_desenho.itemconfigure(estado["legenda"], text=texto_legenda)
            caixa = area_desenho.bbox(estado["legenda"])
            if caixa is not None and estado["legenda_fundo"] is not None:
                area_desenho.coords(
                    estado["legenda_fundo"],
                    caixa[0] - 6,
                    caixa[1] - 4,
                    caixa[2] + 6,
                    caixa[3] + 4,
                )

    def concluir_selecao(evento) -> None:
        if not estado["arrastando"]:
            return
        estado["arrastando"] = False

        x_inicial = int(estado["inicio_x"])
        y_inicial = int(estado["inicio_y"])
        x_final = int(evento.x)
        y_final = int(evento.y)

        esquerda = min(x_inicial, x_final)
        topo = min(y_inicial, y_final)
        largura = abs(x_final - x_inicial)
        altura = abs(y_final - y_inicial)

        if largura < 4 or altura < 4:
            resultado["area"] = None
        else:
            resultado["area"] = AreaSelecionada(
                esquerda=esquerda_virtual + esquerda,
                topo=topo_virtual + topo,
                largura=largura,
                altura=altura,
            )
        janela.destroy()

    area_desenho.bind("<ButtonPress-1>", iniciar_selecao)
    area_desenho.bind("<B1-Motion>", atualizar_selecao)
    area_desenho.bind("<ButtonRelease-1>", concluir_selecao)
    area_desenho.bind("<ButtonPress-3>", cancelar_captura)
    janela.bind("<Escape>", cancelar_captura)
    janela.mainloop()
    return resultado["area"]


def recortar_imagem_base(
    imagem_base,
    area_selecionada: AreaSelecionada,
    limites_tela_virtual: tuple[int, int, int, int],
):
    """Recorta a imagem base ja capturada usando a area escolhida."""
    esquerda_virtual, topo_virtual, _, _ = limites_tela_virtual
    esquerda_relativa = max(0, area_selecionada.esquerda - esquerda_virtual)
    topo_relativo = max(0, area_selecionada.topo - topo_virtual)
    direita_relativa = esquerda_relativa + area_selecionada.largura
    inferior_relativa = topo_relativo + area_selecionada.altura

    return imagem_base.crop(
        (esquerda_relativa, topo_relativo, direita_relativa, inferior_relativa)
    )


def salvar_imagem_capturada(
    imagem_recortada,
    pasta_imagens: Path,
    nome_base: str = "imagem_capturada",
) -> Path:
    """Salva o recorte em PNG e retorna o caminho final."""
    destino = gerar_nome_automatico_imagem(pasta_imagens, nome_base=nome_base)
    imagem_recortada.save(destino, format="PNG")
    return destino


def vincular_imagem_ao_bloco(caminho_da_imagem: Path, pasta_projeto: Path) -> str:
    """Transforma o caminho absoluto salvo em um id relativo usado pelo projeto."""
    try:
        return caminho_da_imagem.relative_to(pasta_projeto).as_posix()
    except ValueError:
        return caminho_da_imagem.as_posix()


def testar_reconhecimento_da_imagem(caminho_da_imagem: Path, confianca: float = 0.8) -> dict:
    """
    Pequena funcao utilitaria para testes futuros.
    A interface principal ja usa o executor oficial para validar o reconhecimento.
    """
    try:
        import pyautogui
    except Exception as erro:
        return {"sucesso": False, "mensagem": f"PyAutoGUI indisponivel: {erro}"}

    try:
        local = pyautogui.locateOnScreen(str(caminho_da_imagem), confidence=confianca)
    except Exception as erro:
        return {"sucesso": False, "mensagem": f"Falha ao localizar a imagem: {erro}"}

    if not local:
        return {"sucesso": False, "mensagem": "Imagem nao localizada na tela."}

    return {
        "sucesso": True,
        "mensagem": "Imagem localizada na tela.",
        "x": int(local.left),
        "y": int(local.top),
        "largura": int(local.width),
        "altura": int(local.height),
    }


def iniciar_captura_de_imagem(pasta_projeto: Path, nome_base: str = "imagem_capturada") -> dict:
    """Executa o fluxo completo de captura, recorte, salvamento e retorno do caminho."""
    configurar_dpi_windows()
    time.sleep(0.08)
    imagem_base, limites_tela_virtual = capturar_tela_base()
    area_selecionada = selecionar_area_da_tela(imagem_base, limites_tela_virtual)
    if area_selecionada is None:
        return {
            "cancelled": True,
            "message": "Captura cancelada pelo usuario.",
        }

    imagem_recortada = recortar_imagem_base(imagem_base, area_selecionada, limites_tela_virtual)
    pasta_imagens = pasta_projeto / "imagens"
    caminho_salvo = salvar_imagem_capturada(imagem_recortada, pasta_imagens, nome_base=nome_base)
    identificador_imagem = vincular_imagem_ao_bloco(caminho_salvo, pasta_projeto)

    return {
        "cancelled": False,
        "image_id": identificador_imagem,
        "file_name": caminho_salvo.name,
        "absolute_path": str(caminho_salvo.resolve()),
        "width": int(area_selecionada.largura),
        "height": int(area_selecionada.altura),
        "left": int(area_selecionada.esquerda),
        "top": int(area_selecionada.topo),
    }


def criar_argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Captura um recorte da tela e salva dentro da pasta imagens.")
    parser.add_argument("--pasta-projeto", default=".")
    parser.add_argument("--nome-base", default="imagem_capturada")
    return parser.parse_args()


def main() -> int:
    configurar_saida_utf8()
    argumentos = criar_argumentos()
    pasta_projeto = Path(argumentos.pasta_projeto).resolve()

    try:
        resultado = iniciar_captura_de_imagem(pasta_projeto, nome_base=argumentos.nome_base)
        print(json.dumps(resultado, ensure_ascii=False))
        return 0
    except Exception as erro:
        print(str(erro), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
