# FlowDetect

**Automacao visual com reconhecimento inteligente para qualquer software**

Uma plataforma visual para criar, testar, organizar e exportar automacoes para desktop e web sem depender de API do sistema.

Este projeto nasceu para resolver um problema muito comum em operacoes reais: muitos sistemas importantes ainda exigem trabalho manual, repetitivo e dependente de interface. Em vez de limitar a automacao a um unico tipo de integracao, o FlowDetect combina fluxo visual, reconhecimento de imagem, planilha, teclado, mouse e Chrome para permitir automar praticamente qualquer rotina.

## O que e este projeto

O **FlowDetect** e um produto focado em criacao de automacoes por blocos.

Com ele, voce pode:

- montar fluxos visuais sem escrever toda a logica do zero
- testar uma etapa isolada antes de rodar a rotina inteira
- executar automacoes em loop usando planilhas
- criar desvios de fluxo entre blocos
- exportar uma automacao pronta com interface propria

O objetivo nao e apenas "clicar automaticamente". O foco aqui e transformar uma rotina operacional em um fluxo controlavel, editavel e reaproveitavel.

## Proposta do produto

Este projeto foi pensado para funcionar bem em cenarios como:

- ERPs
- sistemas fiscais
- paineis internos
- programas Windows legados
- navegadores
- portais web sem API
- processos operacionais com alto volume de repeticao

O diferencial esta em permitir dois caminhos ao mesmo tempo:

1. Automacao visual, quando o sistema nao oferece integracao tecnica
2. Automacao estrutural no navegador, quando existe HTML acessivel

Isso torna o produto util tanto para sistemas modernos quanto para ambientes antigos e engessados.

## Principais capacidades

### Reconhecimento de imagem

O sistema consegue localizar elementos na tela usando uma imagem de referencia.

Isso permite:

- encontrar botoes
- validar se uma tela apareceu
- detectar mensagens ou paineis
- clicar em pontos dinamicos sem depender de coordenada fixa
- decidir para qual bloco a automacao deve ir quando algo e encontrado ou nao encontrado

Esse recurso e o que permite automatizar programas que normalmente nao teriam integracao automatica.

### Fluxo visual por blocos

As automacoes sao montadas com blocos editaveis, como:

- texto livre
- tecla ou atalho
- clique de mouse
- reconhecimento visual
- verificacao de estado
- loop de planilha
- bloco Chrome por elemento HTML

### Planilha como fonte de dados

O projeto permite usar colunas de planilha para repetir a automacao em massa.

Exemplos:

- um CNPJ por linha
- uma empresa por linha
- um codigo por linha
- um texto dinamico por linha

### Automacao de Chrome por elemento HTML

Quando a rotina for no navegador, o sistema tambem consegue trabalhar com elementos HTML.

Voce pode colar um trecho do elemento e deixar o sistema:

- identificar o tipo de elemento
- sugerir o melhor metodo de busca
- configurar a acao adequada

Isso complementa o reconhecimento visual com um caminho mais preciso para paginas web.

## O que voce encontra hoje no projeto

### Interface principal do gerador

Na pasta [tauri_gerador](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/tauri_gerador) fica a aplicacao principal usada para criar e editar as automacoes.

As areas centrais do produto hoje sao:

- `Launcher de Automacoes`
- `Mapa dos comandos`
- `Execucao assistida`
- `Planilha e dados`

### Interface final exportada

Na pasta [tauri_ui](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/tauri_ui) fica a interface usada nas automacoes exportadas para entrega final.

### Motor de execucao

O executor principal esta em [executar_automacao.py](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/executar_automacao.py).

Ele e responsavel por:

- rodar o fluxo dos blocos
- executar loop
- fazer reconhecimento de imagem
- aplicar desvios
- integrar Chrome quando necessario

### Persistencia do roteiro

O gerenciamento do fluxo fica em [gerenciar_roteiro.py](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/gerenciar_roteiro.py).

### Biblioteca local de automacoes

As automacoes salvas ficam em [automacoes](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/automacoes).

### Recursos auxiliares

- [imagens](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/Imagens) e [imagens](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/imagens) para referencias visuais
- [planilhas](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/planilhas) para bases auxiliares
- [compilar_gerador_exe.ps1](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/compilar_gerador_exe.ps1) para build do produto

## Fluxo de uso

1. Abra ou crie uma automacao nova no launcher.
2. Monte os blocos no mapa.
3. Ajuste tempos, reconhecimentos e desvios.
4. Salve o mapa.
5. Rode um teste simples ou em loop.
6. Acompanhe pela execucao assistida.
7. Exporte a automacao final quando estiver pronta.

## Diferenciais do produto

- Funciona em sistemas que nao possuem API
- Permite automacao visual baseada na tela real
- Permite automacao web por HTML quando disponivel
- Suporta fluxo condicional entre blocos
- Usa planilha como fonte de execucao em massa
- Exporta a automacao em pacote final separado
- Foi pensado para uso operacional real, nao apenas para demo

## Tecnologias usadas

- `Python`
- `PyAutoGUI`
- `OpenCV`
- `Pillow`
- `OpenPyXL`
- `PyTesseract`
- `Playwright`
- `Tauri`
- `HTML`
- `CSS`
- `JavaScript`

## Requisitos

Para desenvolvimento e execucao local:

- Windows
- Python 3
- Node.js
- npm

Dependencias Python atuais do projeto:

- `pynput`
- `pyautogui`
- `openpyxl`
- `opencv-python`
- `pillow`
- `pytesseract`
- `playwright`

Arquivo de referencia:

- [requirements.txt](c:/Users/kaua/Desktop/Capturar_atalhos_hotkeys/requirements.txt)

Se voce quiser usar OCR com mais confianca, tambem e recomendado instalar o **Tesseract OCR** no Windows.

## Como rodar em desenvolvimento

### Aplicacao principal do FlowDetect

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

## Como compilar o executavel

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
```

O pacote compilado e montado em:

```text
saida_exe\Gerador_de_Automacoes
```

## Estrutura resumida da raiz

- `tauri_gerador/`  
  app principal do criador

- `tauri_ui/`  
  interface final da automacao exportada

- `automacoes/`  
  biblioteca local das automacoes criadas

- `planilhas/`  
  bases auxiliares

- `executar_automacao.py`  
  motor de execucao

- `gerenciar_roteiro.py`  
  estrutura e persistencia do fluxo

- `compilar_gerador_exe.ps1`  
  script oficial de compilacao

## Casos de uso

- rotinas fiscais
- automacao de ERP
- preenchimento repetitivo em sistemas
- navegacao guiada por imagens
- digitacao em massa por planilha
- operacoes em navegador com ou sem seletor HTML

## Quando usar cada abordagem

### Use reconhecimento visual quando:

- o sistema nao tiver API
- o elemento nao puder ser acessado por HTML
- a rotina depender do que aparece na tela
- voce estiver automatizando um programa desktop

### Use o bloco de Chrome / Elemento HTML quando:

- a rotina for no navegador
- o elemento puder ser obtido pelo inspetor
- voce quiser uma automacao mais estrutural e previsivel

## Observacoes importantes

Automacao desktop depende do contexto visual real. Alguns cenarios exigem:

- janela alvo correta
- resolucao consistente
- imagens de referencia bem recortadas
- tempos de espera ajustados ao sistema

O projeto foi construido justamente para dar controle sobre esses pontos sem exigir que o usuario tenha que reconstruir toda a automacao manualmente em codigo.

## Posicionamento

Este repositorio representa mais do que um script de clique. Ele e a base do **FlowDetect**, um produto novo de automacao visual com foco em transformar tarefas operacionais repetitivas em fluxos reutilizaveis, controlados e exportaveis.

Se a ideia for publicar no GitHub como vitrine de produto, este projeto pode ser apresentado como:

**uma plataforma de automacao visual para qualquer software, com reconhecimento de imagem, execucao por planilha e suporte a navegador.**
