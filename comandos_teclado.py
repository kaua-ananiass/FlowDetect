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
    time.sleep(0.3)
    abrir_url(url='https://fgtsdigital.sistema.gov.br/portal/login', navegador='chrome', modo_abertura='nova_janela', aguardar_segundos=20.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/botao-01', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/login', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/valida__o', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/primeiro-campo', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    executar_sequencia([51708970000187, '03943209000187', 23075323000140, 24811622000168, '02781318000182', '08652127000105', '07864058000122', 19502782801, 42723472000112, '03435683000106', '01325653000103', '07233515000180', '04176898000104', 95657754115, 10276992000138, 20024781000161, 35624938000167, 33130776000185, '09071300000136', '06741606149', '04225641000103', 34306882000130, 24786005000150, '01133119158', 52502068000172, 25122243000123, 30244560153, 26306114000158, 34362221000121, 26898163000127, '05566479000141', '07745154000151', 27859973000137, '06885083000120', 37401809000135, 24944681000104, 10539188000102], acao_apos_item=[], intervalo_entre_itens=0.5)
    time.sleep(0.3)
    executar_teclas(['down'], repeticoes=1)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/aqui', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    executar_teclas(['tab'], repeticoes=1)
    time.sleep(0.3)
    executar_teclas(['enter'], repeticoes=1)
    time.sleep(0.3)
    executar_teclas(['tab'], repeticoes=2)
    time.sleep(0.3)
    executar_teclas(['enter'], repeticoes=1)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/guiass', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/guiass2', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)
    time.sleep(0.3)
    clicar_por_imagem(imagem='imagens/imagem_capturada_008', timeout=10.0, confianca=0.8, perfil_busca='balanced', modo_area_busca='target_window', area_busca_x=0, area_busca_y=0, area_busca_largura=0, area_busca_altura=0, clicar=True, clicks=1, offset_x=0, offset_y=0, janela_alvo='', texto_ocr_esperado='', ao_nao_encontrar='parar', sequencia_nao_encontrar='', bloco_nao_encontrar='', quantidade_tentativas=3, intervalo_tentativas=1.0)


if __name__ == "__main__":
    executar()
