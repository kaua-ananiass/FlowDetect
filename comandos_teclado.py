import pyautogui
import time

INTERVALO_TEXTO = 0.01


def digitar_texto(texto):
    for caractere in texto:
        if caractere == "\r":
            continue
        if caractere == "\n":
            pyautogui.press("enter")
            continue
        if caractere == "\t":
            pyautogui.press("tab")
            continue
        pyautogui.write(caractere, interval=INTERVALO_TEXTO)


def eh_texto_simples(nome):
    return len(str(nome)) == 1 and str(nome) not in {"\r", "\n", "\t"}


def tecla_para_pyautogui(nome):
    nome = str(nome)
    if len(nome) == 1:
        return nome
    mapa = {
        "ctrl": "ctrl",
        "control": "ctrl",
        "shift": "shift",
        "alt": "alt",
        "altgr": "altright",
        "enter": "enter",
        "tab": "tab",
        "esc": "esc",
        "escape": "esc",
        "space": "space",
        "backspace": "backspace",
        "delete": "delete",
        "del": "delete",
        "insert": "insert",
        "home": "home",
        "end": "end",
        "pgup": "pageup",
        "pgdn": "pagedown",
        "up": "up",
        "down": "down",
        "left": "left",
        "right": "right",
    }
    return mapa.get(nome, nome)


def executar_acao(acao):
    if not acao:
        return
    if isinstance(acao, str):
        acao = [parte.strip() for parte in acao.split("+") if parte.strip()]
    if len(acao) == 1:
        pyautogui.press(str(acao[0]))
        return
    pyautogui.hotkey(*[str(parte) for parte in acao])


def executar_teclas(teclas, repeticoes=1):
    teclas = [str(tecla) for tecla in (teclas or []) if str(tecla)]
    if not teclas:
        return
    total = max(1, int(repeticoes))
    teclas_pyautogui = [tecla_para_pyautogui(tecla) for tecla in teclas]
    for _ in range(total):
        if len(teclas_pyautogui) > 1:
            pyautogui.hotkey(*teclas_pyautogui)
            continue
        tecla = teclas[0]
        tecla_pyautogui = teclas_pyautogui[0]
        if eh_texto_simples(tecla):
            pyautogui.write(tecla)
        else:
            pyautogui.press(tecla_pyautogui)


def executar_sequencia(valores, acao_apos_item=None, intervalo_entre_itens=0.5):
    total = len(valores)
    for indice, valor in enumerate(valores):
        digitar_texto(str(valor))
        if indice < total - 1 and acao_apos_item:
            executar_acao(acao_apos_item)
        if indice < total - 1 and intervalo_entre_itens > 0:
            time.sleep(intervalo_entre_itens)


def esperar_imagem(imagem, timeout=10, confianca=0.8):
    confianca = float(confianca)
    confiancas_busca = [confianca]
    if confianca > 0.72:
        confiancas_busca.append(round(max(0.55, confianca - 0.12), 2))
    fim = time.perf_counter() + max(0, float(timeout))
    while time.perf_counter() <= fim:
        for confianca_atual in confiancas_busca:
            for grayscale in (False, True):
                local = pyautogui.locateOnScreen(imagem, confidence=confianca_atual, grayscale=grayscale)
                if local:
                    return local
        time.sleep(0.25)
    return None


def clicar_por_imagem(
    imagem,
    timeout=10,
    confianca=0.8,
    clicar=True,
    offset_x=0,
    offset_y=0,
    ao_nao_encontrar="parar",
    sequencia_nao_encontrar="",
    bloco_nao_encontrar="",
    quantidade_tentativas=1,
    intervalo_tentativas=1,
):
    tentativas = max(1, int(quantidade_tentativas))
    for tentativa in range(tentativas):
        local = esperar_imagem(imagem, timeout=timeout, confianca=confianca)
        if local:
            centro_x, centro_y = pyautogui.center(local)
            destino_x = int(centro_x + int(offset_x))
            destino_y = int(centro_y + int(offset_y))
            if clicar:
                pyautogui.click(destino_x, destino_y)
            return True
        if ao_nao_encontrar != "tentar_novamente" or tentativa >= tentativas - 1:
            break
        time.sleep(max(0, float(intervalo_tentativas)))
    if ao_nao_encontrar == "parar":
        raise RuntimeError(f"Imagem nao encontrada: {imagem}")
    return False


def verificar_estado_botao(
    imagem_ativo,
    imagem_desativado,
    timeout=5,
    confianca=0.85,
    se_ativo=None,
    se_desativado=None,
    se_nao_encontrar=None,
):
    if esperar_imagem(imagem_ativo, timeout=timeout, confianca=confianca):
        return se_ativo or {"acao": "continuar"}
    if esperar_imagem(imagem_desativado, timeout=timeout, confianca=confianca):
        return se_desativado or {"acao": "continuar"}
    return se_nao_encontrar or {"acao": "parar"}


def executar():
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/Primeiro-Campo', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=2, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.6)
    executar_sequencia([330, 353, 355, 44, 289, 354, 199, 285, 228, 327, 214, 72, 227, 219, 42, 306, 301, 81, 11, 104, 226, 84, 94, 89, 70, 276, 233, 278, 298, 238, 37, 212, 217, 259, 46, 51, 275, 356, 261, 232, 106, 329, 88, 352, 337, 349, 253, 309, 220, 348, 255, 326, 273, 292, 282, 350, 269, 300, 27, 325, 35, 230, 67, 321, 183, 344, 31, 30, 86, 215, 34], acao_apos_item=['enter'], intervalo_entre_itens=0.5)
    time.sleep(0.6)
    executar_teclas(['tab'], repeticoes=3)
    time.sleep(0.6)
    digitar_texto('01052026')
    time.sleep(0.6)
    executar_teclas(['enter'], repeticoes=3)
    time.sleep(1.5)
    executar_teclas(['tab'], repeticoes=3)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/check1_001', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=False, clicks=0, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/imagem_capturada_0066', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=2, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='tentar_novamente', sequencia_nao_encontrar='', bloco_nao_encontrar=7, quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/imagem_capturada_006aaa', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/check22_001', timeout=10.0, confianca=0.8, perfil_busca='precise', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=False, clicks=0, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='ir_para_bloco', sequencia_nao_encontrar='', bloco_nao_encontrar=8, quantidade_tentativas=1, intervalo_tentativas=1.0)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/gravar', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/check222', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/aaaa.png', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='ir_para_bloco', sequencia_nao_encontrar='', bloco_nao_encontrar=19, quantidade_tentativas=1, intervalo_tentativas=1.0)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/ok', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.6)
    executar_teclas(['tab'], repeticoes=1)
    time.sleep(0.6)
    digitar_texto('425')
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/fim', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(2.0)
    clicar_por_imagem(imagem='imagens/adenizio-lima', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='ir_para_bloco', sequencia_nao_encontrar='', bloco_nao_encontrar=22, quantidade_tentativas=1, intervalo_tentativas=1.0)
    time.sleep(1.0)
    clicar_por_imagem(imagem='imagens/error', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(1.0)
    executar_teclas(['tab'], repeticoes=1)
    time.sleep(0.6)
    executar_teclas(['backspace'], repeticoes=1)
    time.sleep(0.6)
    clicar_por_imagem(imagem='imagens/inicio', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=2, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.6)
    digitar_texto('03943209/0001-87')
    time.sleep(0.6)
    executar_teclas(['enter'], repeticoes=6)
    time.sleep(1.2)
    clicar_por_imagem(imagem='imagens/okok', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=False, clicks=0, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='continuar', sequencia_nao_encontrar='', bloco_nao_encontrar=1, quantidade_tentativas=1, intervalo_tentativas=1.0)
    time.sleep(0.6)
    executar_teclas(['tab'], repeticoes=3)
    time.sleep(0.6)
    executar_teclas(['backspace'], repeticoes=1)
    time.sleep(0.3)
    executar_teclas(['tab'], repeticoes=7)
    time.sleep(0.3)
    executar_teclas(['backspace'], repeticoes=1)
    time.sleep(0.6)
    digitar_texto('50317977000105')
    time.sleep(0.6)
    executar_teclas(['enter'], repeticoes=6)
    time.sleep(1.2)
    clicar_por_imagem(imagem='imagens/check11', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=False, clicks=0, offset_x=0, offset_y=0, janela_alvo='', ao_nao_encontrar='ir_para_bloco', sequencia_nao_encontrar='', bloco_nao_encontrar=22, quantidade_tentativas=1, intervalo_tentativas=1.0)


if __name__ == "__main__":
    executar()
