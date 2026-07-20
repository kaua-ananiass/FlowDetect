<p align="center">
  <img src="tauri_gerador/web/assets/flowdetect-welcome.png" alt="FlowDetect" width="820">
</p>

# FlowDetect

Plataforma visual para criar, editar, testar e exportar automacoes desktop com blocos reutilizaveis.

O projeto foi pensado para automatizar **qualquer tipo de programa**, inclusive sistemas legados, ERPs, navegadores, paineis internos e aplicativos sem API. Para isso, ele combina:

- automacao por teclado e mouse
- reconhecimento de imagem na tela
- loops com planilha
- variaveis e textos dinamicos
- desvios de fluxo entre blocos
- execucao assistida com acompanhamento visual

## O que este produto faz

Com o Gerador de Automacoes, voce monta uma rotina como se estivesse desenhando um fluxo:

- blocos de texto
- blocos de tecla ou atalho
- blocos de clique de mouse
- blocos de reconhecimento visual
- blocos de loop com planilha
- blocos de verificacao de estado
- blocos para Chrome via HTML/Playwright

Depois disso, voce pode:

- editar tudo pelo `Mapa dos comandos`
- testar uma vez
- testar em loop
- acompanhar a execucao em tempo real
- exportar a automacao pronta com interface propria

## Diferencial principal

### 1. Reconhecimento visual

O sistema consegue localizar elementos pela tela usando imagem de referencia, mesmo quando nao existe integracao oficial com o programa.

Exemplos de uso:

- localizar um botao `Salvar`
- reconhecer um painel de erro
- clicar em um campo especifico
- validar se uma tela apareceu
- pular para outro bloco se algo nao for encontrado

Isso permite automatizar programas desktop, navegadores, sistemas antigos e telas que normalmente nao teriam API.

### 2. Automacao para qualquer software

Nem todo sistema oferece integracao. Este projeto resolve isso com uma abordagem hibrida:

- quando existe elemento HTML: usa Playwright
- quando nao existe: usa PyAutoGUI, teclado, mouse e reconhecimento visual

Na pratica, isso torna possivel automatizar:

- ERPs
- sistemas fiscais
- portais web
- paineis internos
- aplicativos Windows
- programas com janelas e modais complexos

### 3. Fluxo com planilha

Voce pode usar colunas da planilha para repetir a automacao em massa.

Exemplos:

- um CNPJ por linha
- uma empresa por linha
- um codigo por linha
- um texto dinamico por linha

## Principais recursos

- `Launcher de Automacoes` para organizar automacoes salvas
- `Mapa dos comandos` como editor principal do fluxo
- `Execucao assistida` com progresso por bloco
- exportacao da automacao pronta para pasta separada
- reconhecimento de imagem com janela alvo
- testes isolados de reconhecimento
- salto entre blocos em caso de sucesso ou falha
- blocos Chrome por colagem de elemento HTML
- fallback visual para cenarios onde o seletor HTML falhar

## Como funciona o fluxo

1. Crie ou abra uma automacao no launcher.
2. Monte os blocos no mapa.
3. Ajuste tempos, desvios e reconhecimentos.
4. Salve o mapa.
5. Rode um teste simples ou em loop.
6. Exporte a automacao final com interface propria.

## Tecnologias usadas

- `Python`
- `PyAutoGUI`
- `OpenCV`
- `Pillow`
- `OpenPyXL`
- `Playwright`
- `Tauri`
- `HTML/CSS/JavaScript`

## Estrutura do projeto

- `tauri_gerador/`  
  Interface principal do criador de automacoes

- `tauri_ui/`  '
  Interface final usada nas automacoes exportadas

- `executar_automacao.py`  
  Motor de execucao dos blocos

- `gerenciar_roteiro.py`  
  Manipulacao e persistencia do roteiro

- `automacoes/`  
  Biblioteca local de automacoes salvas

- `imagens/`  
  Referencias usadas nos blocos de reconhecimento visual

- `planilhas/`  
  Arquivos auxiliares de dados

## Requisitos

Windows e Python 3.

Dependencias Python do projeto:

- `pynput`
- `pyautogui`
- `openpyxl`
- `opencv-python`
- `pillow`
- `pytesseract`
- `playwright`

Arquivo de referencia:

- `requirements.txt`

## Como rodar em desenvolvimento

### Interface principal do gerador

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

### Dependencias Python

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
python -m pip install -r requirements.txt
python -m playwright install
```

Se voce quiser usar OCR, tambem e recomendado instalar o **Tesseract OCR** no Windows.

## Como compilar o .exe

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
```

O pacote final e gerado em:

```text
saida_exe\Gerador_de_Automacoes
```

## Como gerar uma versao final em pasta separada

Exemplo usado no projeto:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
if (Test-Path .\projeto_v1_final) { Remove-Item .\projeto_v1_final -Recurse -Force }
Copy-Item .\saida_exe\Gerador_de_Automacoes .\projeto_v1_final -Recurse -Force
```

## Casos de uso

- rotinas fiscais
- automacao de ERP
- preenchimento repetitivo em sistemas
- navegacao guiada por imagens
- busca e digitacao por planilha
- automacao de tarefas operacionais no navegador

## Quando usar reconhecimento de imagem

Use reconhecimento visual quando:

- o sistema nao tiver API
- o elemento nao for acessivel por HTML
- o botao estiver dentro de um software desktop
- o fluxo depender do que aparece na tela

Use o bloco de `Chrome / Elemento HTML` quando:

- a automacao for no navegador
- o elemento puder ser copiado do inspetor
- voce quiser mais estabilidade com seletores

## Status do projeto

Produto em evolucao, ja com fluxo real de criacao, teste, execucao em loop, exportacao e automacao visual/HTML funcionando.

## Observacao importante

Automacao desktop depende de contexto real de tela. Por isso, alguns cenarios exigem:

- janela alvo correta
- resolucao consistente
- imagens de referencia bem recortadas
- tempos de espera ajustados ao sistema

Esse projeto foi construido justamente para dar ao usuario controle sobre esses pontos sem precisar programar tudo do zero.
