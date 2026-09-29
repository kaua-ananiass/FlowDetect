# FlowDetect - Handoff completo para outro agente

Este arquivo resume o contexto tecnico e de produto para outro agente continuar o FlowDetect sem depender do historico da conversa.

## 1. Visao geral

FlowDetect e uma plataforma Windows de automacao visual por blocos.

O usuario cria fluxos no **FlowDetect Studio**, testa no proprio PC e pode enviar para um **FlowDetect Agent** instalado em outro computador. O foco do produto e permitir automacoes desktop e web para usuario leigo, sem exigir codigo, XPath, CSS selector, terminal ou conhecimento tecnico.

O produto atual possui:

- criacao visual de automacoes em blocos;
- mapa de comandos com paginas;
- execucao assistida em tempo real;
- loop por planilha;
- reconhecimento visual por imagem/OCR;
- OCR por elemento da pagina e extensao Chrome;
- captura de elementos de janela via UI Automation;
- gravador inteligente de cliques/teclas/textos;
- controle remoto do Agent pelo Studio;
- visualizacao da tela do Agent;
- instaladores separados para Studio e Agent.

## 2. Raiz do projeto

Use a pasta do checkout que contem `tauri_gerador/`, `flowdetect_agent/` e `gerenciar_roteiro.py`. Os comandos abaixo sao relativos a essa pasta.

## 3. Stack principal

- Interface desktop: Tauri + HTML/CSS/JavaScript puro.
- Backend nativo: Rust/Tauri commands.
- Motor de automacao: Python.
- Reconhecimento visual: OpenCV, Pillow, PyAutoGUI/MSS.
- OCR: mecanismo Python usado no executor, com otimizacoes por area.
- Planilhas: OpenPyXL.
- UI Automation Windows: `uiautomation` + Win32 fallback.
- Integracao Chrome: ponte local usada pelo OCR por elemento e pela extensao.
- Controle remoto/tela do Agent: fluxo interno via rede local/WebRTC/snapshots conforme implementacao atual.

## 4. Projetos dentro da raiz

### FlowDetect Studio

Projeto principal:

```text
tauri_gerador/
```

Arquivos mais importantes:

- `tauri_gerador/web/index.html`
- `tauri_gerador/web/main.js`
- `tauri_gerador/web/style.css`
- `tauri_gerador/src-tauri/src/lib.rs`
- `tauri_gerador/src-tauri/tauri.conf.json`

### FlowDetect Agent

Projeto do executador remoto:

```text
flowdetect_agent/
```

Arquivos mais importantes:

- `flowdetect_agent/web/index.html`
- `flowdetect_agent/web/main.js`
- `flowdetect_agent/web/style.css`
- `flowdetect_agent/src-tauri/src/lib.rs`
- `flowdetect_agent/src-tauri/tauri.conf.json`

### Motor Python compartilhado

Arquivos centrais na raiz:

- `executar_automacao.py`: executor real das automacoes.
- `gerenciar_roteiro.py`: cria, atualiza, move, remove, importa/exporta e salva blocos.
- `capturar_imagem_tela.py`: captura de referencias visuais.
- `mapear_elementos_janela.py`: mapeamento UI Automation/Win32 de janelas.
- `chrome_web_bridge.py`: ponte local usada pela captura/validação de elementos do OCR.
- `gerenciar_dados_planilha.py`: leitura/preview/limpeza/alteracao de planilhas.
- `gravador_inteligente.py`: apoio ao gravador de cliques/teclas/textos.
- `listar_janelas_abertas.py`: lista janelas para janela alvo.
- `overlay_janela_alvo.py`: contorno da janela alvo.
- `overlay_automacao_tela.py`: overlay de execucao/gravacao.
- `diagnostico_ambiente.py`: diagnostico de dependencias.
- `validar_dependencias_instaladas.py`: validacao pos-instalacao.

## 5. Como rodar em desenvolvimento

### Studio

```powershell
cd tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

### Agent

```powershell
cd flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

Se o PowerShell bloquear `npm`, use sempre o caminho completo.

## 6. Build e instaladores

### Studio

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compilar_gerador_exe.ps1
```

### Agent

```powershell
cd flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" run tauri:build
```

### Visual dos instaladores

Os instaladores usam NSIS via Tauri.

Assets:

```text
tauri_gerador/src-tauri/installer_assets/
```

Arquivos recentes:

- `flowdetect_studio_header.bmp`
- `flowdetect_studio_sidebar.bmp`
- `flowdetect_agent_header.bmp`
- `flowdetect_agent_sidebar.bmp`
- `flowdetect_header.bmp`
- `flowdetect_sidebar.bmp`
- `flowdetect_hooks.nsh`
- `gerar_assets_instalador.py`

O Studio deve usar assets com `studio`.
O Agent deve usar assets com `agent`.

Para regenerar:

```powershell
# Execute na raiz do repositorio
python tauri_gerador/src-tauri/installer_assets/gerar_assets_instalador.py
```

## 7. Abas do Studio

### Launcher de Automacoes

Biblioteca local de automacoes:

- criar;
- editar;
- duplicar;
- excluir;
- executar;
- importar/exportar ZIP;
- cards com flip para detalhes.

### Execucao assistida

Mostra a automacao rodando:

- status;
- progresso;
- empresa/linha atual;
- pagina atual;
- bloco atual;
- logs;
- trilha visual dos blocos.

O foco visual deve ser a trilha dos blocos. Janela alvo e configuracoes devem ficar discretas.

### Mapa dos comandos

Editor visual principal e area mais sensivel do projeto.

Recursos:

- cards compactos;
- cards expandidos em "Ver detalhes";
- paginas de fluxo;
- linhas/conectores entre blocos;
- tempo entre blocos editavel;
- criacao de bloco no local onde ele entrara;
- animacao de abertura/fechamento do painel "Novo bloco";
- animacao ao criar/excluir/mover blocos;
- reordenacao por arrastar;
- reordenacao por setas do teclado;
- blocos podem apontar para outros blocos/paginas.

Ao mexer no mapa, validar:

- adicionar bloco antes/depois;
- adicionar no comeco e no fim;
- excluir bloco no meio;
- mover por arrastar;
- mover por setas;
- abrir/fechar detalhes;
- conectores/tempos alinhados;
- salvar e recarregar automacao.

### Planilha e dados

Funcoes:

- importar planilha;
- abrir planilha atual no Excel;
- deletar linha para nao rodar no loop;
- limpar coluna/status;
- preview da planilha;
- escolher coluna de loop;
- sincronizar planilha com blocos.

### Controle remoto

Controla o Agent pelo Studio:

- conectar por IP/porta;
- importar ZIP para o Agent;
- listar biblioteca remota;
- executar/parar;
- escolher linha inicial/empresa;
- ver progresso;
- ver planilha remota;
- limpar coluna remota;
- assistir tela do Agent;
- ativar/desativar controle de mouse/teclado remoto.

### Tela do Agent

Mostra a tela do computador remoto.

Cuidados:

- nao travar a UI do Studio;
- ao clicar em assistir, Agent deve maximizar se estiver minimizado;
- controle de mouse/teclado deve ser opcional.

### Agentes

Gerenciamento conceitual de agentes/maquinas:

- cards no estilo launcher;
- status online/offline/aguardando maquina;
- dados tecnicos atras do card com flip;
- possivel vinculacao futura com VM.

### Gravador Inteligente

Grava acoes e gera blocos:

- clique visual com menu no ponto clicado;
- ajustar area capturada;
- escolher 1 clique, 2 cliques ou so identificar;
- botao direito para adicionar texto ou tecla;
- F10 pausa/retoma;
- escolher pagina de destino;
- enviar blocos para o mapa.

## 8. Tipos de bloco importantes

### Texto livre

Escreve texto fixo ou dinamico.

Pode ser marcado como editavel na execucao. O controle remoto e o Agent tambem devem respeitar esses valores.

### Tecla

Pressiona tecla/atalho com repeticoes.

### Mouse

Clique por coordenada. Usar com cuidado.

### Reconhecimento visual

Procura imagem e pode validar OCR.

Pontos atuais:

- preview da imagem;
- marcador do ponto de clique;
- area "ler aqui" para OCR relativo;
- modo rapido deve ser bem rapido;
- OCR deve ser limitado a area pequena;
- pode clicar, confirmar ou seguir fluxo;
- se falhar, pode parar, continuar, tentar de novo ou ir para bloco.

### OCR por elemento / extensao Chrome

O bloco Chrome/Web foi removido. Automacoes web novas usam a extensao Chrome, enquanto o OCR pode continuar usando um elemento da pagina como fonte de reconhecimento. A ponte local do Chrome permanece somente para essa captura/validacao compartilhada.

### Mapear janela / Elemento da janela

Recurso de UI Automation.

Objetivo:

- mapear elementos da janela atual;
- selecionar por arvore ou hover;
- criar bloco pronto baseado em elemento real;
- nao usar OCR nem imagem como identidade principal.

Arquivos:

- `mapear_elementos_janela.py`
- `gerenciar_roteiro.py`
- `executar_automacao.py`
- `tauri_gerador/web/main.js`
- `tauri_gerador/src-tauri/src/lib.rs`

Regras:

- UI Automation como principal;
- Win32 como fallback;
- coordenadas apenas para highlight/captura;
- nao clicar durante scan;
- scanner nao pode congelar UI;
- tratar erro por elemento individual.

### Abrir URL

Abre site no navegador:

- navegador padrao/Chrome/Edge;
- nova janela/nova aba;
- aguardar apos abrir;
- tela cheia.

### Abrir Programa

Abre executavel com parametros opcionais.

### Planilha / Loop de dados

Controla loop por linha/coluna.

Importante:

- loop deve avancar mesmo quando o fluxo volta para pagina anterior;
- empresa exibida deve bater com a linha atual real;
- loop pode existir sem digitar a coluna em campo.

### Escrever celula

Escreve valor em coluna da linha atual.

### Conferir valor

Compara valor esperado da planilha com OCR capturado por um bloco de reconhecimento especifico.

Fluxo desejado:

- escolher qual bloco fornece OCR;
- escolher valor esperado da linha/coluna;
- se bater, escolher acao/bloco;
- se nao bater, escolher acao/bloco.

### Salvar download

Monitora downloads, espera arquivo chegar e move/renomeia para destino.

Deve ser simples:

- pasta monitorada;
- pasta destino;
- tipo de arquivo;
- nome final com modelos/botoes;
- poucos termos tecnicos.

## 9. Reconhecimento visual e OCR

Historico importante:

- reconhecimento foi otimizado para tentar ser quase instantaneo;
- cache da ultima posicao ajuda, mas precisa fallback quando elemento muda;
- OCR ja gerou problemas com datas parecidas;
- OCR deve validar exatamente quando necessario;
- OCR nao deve rodar em tela inteira por padrao;
- area "ler aqui" deve ser relativa a referencia encontrada.

Problemas ja vistos:

- OCR confirmou `09/2025` quando o correto era `09/2023`;
- OCR nao confirmava texto visivel;
- marcador azul do OCR aparecia longe da referencia;
- "Procurar agora" apenas minimizava e voltava;
- cache procurava apenas local antigo.

Ao mexer:

- testar imagem sem OCR;
- testar imagem com OCR;
- testar texto parecido;
- testar mudanca de posicao;
- validar marcador verde e marcador azul.

### Padrao base atual: OCR hibrido rapido e confirmado

Este e o comportamento aprovado para reconhecimento de imagem com OCR. Deve ser a base para alteracoes futuras.

- Capturar somente a janela alvo ou o modal visivel do mesmo programa; tela inteira fica como ultimo recurso.
- Em execucao assistida, priorizar o modal externo que estiver em primeiro plano sem ativar, mover ou trazer janelas para frente.
- Primeiro rodar OCR em escala nativa no dialogo. Uma captura deve servir a todos os textos OCR do mesmo bloco.
- Se um rotulo pequeno nao for lido ou vier apenas parcialmente confirmado, fazer uma unica releitura do mesmo dialogo em escala ampliada (`1.35`). Nao executar varreduras em varias regioes como fallback do fluxo hibrido.
- Confirmar todos os alvos OCR configurados e so entao confirmar a imagem na regiao estimada pelos OCRs. OCR isolado nunca libera clique ou avancar no fluxo.
- A busca visual deve comecar na regiao exata estimada pelos OCRs e depois ampliar somente ao redor dela.
- Limitar a frequencia de novas leituras OCR para evitar uso continuo de CPU e travamento do mouse. O log deve registrar `OCR screenshot concluido em ...ms`.
- No botao **Procurar**, usar a janela externa que ficou visivel depois que o Studio minimiza, mesmo se o titulo gravado no bloco for da janela principal.
- Preservar os marcadores: OCR em azul e imagem confirmada em verde. Eles devem ser curtos para nao adicionar atraso perceptivel.

Validacao minima: executar `python -m unittest discover -s tests -v`, testar **Procurar** e testar a mesma sequencia pela **Execucao assistida** em um modal real.

## 10. Regras de UX/design

Preferencias do usuario:

- layout compacto;
- poucos textos;
- nada tecnico na tela principal;
- botoes arredondados;
- azul `#12B5CB`;
- verde igual botao Salvar;
- fundo `#07111F`;
- cards `#0E1B2E`;
- feedback visual claro;
- animacoes suaves;
- alinhamento preciso.

Evitar:

- campos enormes;
- texto para fora do botao;
- cards muito compridos;
- modais deslocados;
- brilho exagerado;
- delay em navegacao;
- scroll involuntario junto com animacao;
- salvar automaticamente a cada troca de pagina.

## 11. Compatibilidade

Nao quebrar automacoes existentes.

Sempre que adicionar campo novo:

- dar valor padrao;
- aceitar ausencia do campo no executor;
- atualizar persistencia em `gerenciar_roteiro.py`;
- atualizar Studio;
- atualizar Agent quando o tipo precisar executar remotamente.

Se o Studio cria um bloco novo, o Agent precisa saber executar esse bloco.

## 12. Dados que nao devem ir para GitHub

Nao subir dados reais:

- `automacoes/`
- `imagens/`
- `planilhas/`
- `relatorios_loop/`
- `diagnosticos_reconhecimento/`
- `saida_exe/`
- `target/`
- `node_modules/`
- logs temporarios;
- arquivos `.xlsx`, `.pdf`, `.png` de uso real;
- instaladores e builds.

Antes de commit:

```powershell
# Execute na raiz do repositorio
git status
git diff --stat
```

## 13. Validacao minima

JavaScript:

```powershell
# Execute na raiz do repositorio
node --check tauri_gerador/web/main.js
```

Python:

```powershell
# Execute na raiz do repositorio
python -m py_compile executar_automacao.py gerenciar_roteiro.py mapear_elementos_janela.py chrome_web_bridge.py gerenciar_dados_planilha.py gravador_inteligente.py
```

Rust/Tauri Studio:

```powershell
cd tauri_gerador/src-tauri
cargo check
```

Agent:

```powershell
cd flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" run tauri:build
```

## 14. Git

Criar rama nova:

```powershell
# Execute na raiz do repositorio
git checkout main
git pull origin main
git checkout -b nome-da-rama
```

Commit:

```powershell
git add -A
git commit -m "Descricao objetiva da atualizacao"
```

Push:

```powershell
git push -u origin nome-da-rama
```

## 15. Ultimas areas sensiveis

Areas mexidas recentemente:

- mapa dos comandos;
- card "Novo bloco";
- conectores/tempos entre blocos;
- criacao de blocos;
- bloco de reconhecimento visual;
- OCR relativo "ler aqui";
- bloco Mapear janela/UI Automation;
- captura visual de elementos por hover;
- instalador Studio/Agent;
- Agent remoto e tela remota.

## 16. Erros recentes e contexto

### GetCursorPos / UIA hover

Erro:

```text
ctypes.ArgumentError: expected LP_POINT instance instead
```

Causa:

- conflito de `ctypes` quando `GetCursorPos.argtypes` usava classe `POINT` diferente.

Correcao:

- em `mapear_elementos_janela.py`, o fallback `pick_element_from_hover_pynput` reaplica `GetCursorPos.argtypes` com o `POINT` local.

### Criar bloco eterno

Sintoma:

- botao fica em `Criando...`.

Causas comuns:

- argumento novo no JS nao aceito pelo `gerenciar_roteiro.py`;
- tipo sem comando `add-*` ou `insert-*`;
- excecao silenciosa em Tauri command.

### Tempos/conectores desalinhados

Sintoma:

- tempos entre blocos sobem, encostam ou sobrepoem cards ao abrir/fechar novo bloco ou detalhes.

Regra desejada:

- conectores alinhados ao centro visual entre blocos;
- ao inserir no meio, tempos vao para o lado, nao sobem;
- ao fechar novo bloco, conectores retornam suave, sem sumir seco.

## 17. Como entregar

Ao finalizar uma tarefa:

- diga arquivos alterados em alto nivel;
- diga validacoes executadas;
- se nao rodou algo, explique;
- seja curto e objetivo.

O usuario prefere implementacao direta, pouca teoria e resultado visual refinado.
