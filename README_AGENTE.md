# FlowDetect - Guia para outro agente

Este arquivo e o handoff principal do projeto. Leia antes de alterar qualquer codigo.

## Resumo do produto

FlowDetect e uma plataforma visual para criar, testar e executar automacoes desktop em blocos.

O projeto hoje tem dois usos principais:

- **FlowDetect Studio:** programa principal usado para criar, editar, testar, exportar e controlar automacoes.
- **FlowDetect Agent:** programa separado para instalar em outro computador e executar automacoes criadas no Studio.

O usuario final nao deve precisar entender codigo, HTML, XPath, terminal ou estrutura de arquivos. A UX deve ser simples, visual e didatica.

## Stack

- Frontend desktop: Tauri + HTML/CSS/JavaScript puro.
- Backend nativo Tauri: Rust.
- Motor de automacao: Python.
- Reconhecimento visual: OpenCV/Pillow/PyAutoGUI.
- Planilhas: OpenPyXL.
- Chrome/Web: ponte local com Chrome DevTools/Playwright quando necessario.
- Controle remoto/tela do Agent: integracao interna via rede local/WebRTC/snapshots conforme implementado no projeto.

## Raiz correta

Edite sempre a raiz principal:

```powershell
C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
```

Evite trabalhar em copias, exports ou pastas de build.

## Estrutura principal

- `tauri_gerador/web/index.html`: estrutura do FlowDetect Studio.
- `tauri_gerador/web/main.js`: maior parte da regra de UI do Studio.
- `tauri_gerador/web/style.css`: visual do Studio.
- `tauri_gerador/src-tauri/src/lib.rs`: comandos Tauri do Studio.
- `executar_automacao.py`: executor real das automacoes.
- `gerenciar_roteiro.py`: persistencia, criacao e edicao dos blocos.
- `capturar_imagem_tela.py`: captura de imagens/referencias visuais.
- `gravador_inteligente.py`: apoio ao gravador de cliques/teclas.
- `chrome_web_bridge.py`: ponte para recursos Chrome/Web.
- `gerenciar_dados_planilha.py`: leitura/alteracao de planilhas.
- `overlay_janela_alvo.py`: contorno da janela alvo.
- `overlay_automacao_tela.py`: overlay de execucao/gravadacao na tela.
- `flowdetect_agent/`: projeto separado do FlowDetect Agent.

## Como rodar o Studio em dev

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

Se o PowerShell bloquear `npm`, use:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

## Como rodar o Agent em dev

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

## Dependencias Python

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
python -m pip install -r requirements.txt
python -m playwright install
```

## Build

Build do Studio:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
```

Build do Agent:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" run tauri:build
```

## Abas principais do Studio

- **Launcher de Automacoes:** biblioteca local de automacoes, criar, editar, duplicar, excluir, exportar/importar ZIP e executar.
- **Execucao assistida:** acompanha a execucao em tempo real com status, progresso, logs e trilha dos blocos.
- **Mapa dos comandos:** editor visual principal dos blocos e das paginas do fluxo.
- **Planilha e dados:** importa, visualiza, abre e edita planilhas usadas no loop.
- **Controle remoto:** conecta no FlowDetect Agent, envia automacoes, executa remotamente e acompanha progresso/tela.
- **Tela do Agent:** visualizacao remota do computador onde o Agent esta rodando.
- **Gravador Inteligente:** grava cliques, teclas e textos para gerar blocos automaticamente.

## Blocos atuais importantes

- **Texto livre:** escreve texto fixo ou dado dinamico. Pode ser marcado como bloco editavel na execucao.
- **Tecla/Atalho:** pressiona teclas e atalhos, com repeticoes.
- **Mouse:** cliques por coordenada quando necessario.
- **Reconhecimento visual:** procura uma imagem na tela/janela, valida OCR opcional e decide o fluxo.
- **Chrome/Web:** automatiza elementos do Chrome por captura de elemento, sem expor seletores tecnicos para usuario leigo.
- **Abrir URL:** abre site no navegador escolhido, com opcao de tela cheia.
- **Abrir Programa:** abre um executavel com parametros opcionais.
- **Planilha:** define loop por coluna/linha.
- **Escrever celula:** escreve status ou resultado na linha atual do loop.
- **Inicio loop / Fim loop:** delimita trechos repetidos.
- **Salvar download:** monitora pasta de origem, espera arquivo baixar, renomeia e move para destino.

## Mapa dos comandos

O Mapa dos comandos e uma area sensivel do projeto. O usuario se importa muito com:

- layout compacto;
- alinhamento dos cards;
- animacoes suaves;
- blocos visualmente claros;
- pouco espaco morto;
- navegacao fluida entre blocos;
- caminhos/linhas entre blocos bem posicionados;
- compatibilidade com automacoes antigas.

Recursos atuais:

- paginas de fluxo;
- tema por pagina;
- criacao de bloco diretamente no espaco onde ele vai entrar;
- preview do novo bloco antes de criar;
- animacao de abertura/fechamento do painel de novo bloco;
- animacao de criacao, exclusao e movimentacao de blocos;
- cards compactos com botao de detalhes;
- detalhes expandidos com layout mais completo;
- linhas entre blocos com tempo de espera editavel;
- fluxo de sucesso/falha para pular blocos.

Ao mexer no mapa, valide especialmente:

- adicionar bloco depois de outro bloco;
- excluir bloco no meio da sequencia;
- mover bloco com setas;
- arrastar bloco;
- abrir e fechar detalhes;
- mudar de pagina;
- salvar e recarregar automacao.

## Reconhecimento visual

O reconhecimento visual foi bastante trabalhado. Nao simplifique sem entender.

Pontos atuais:

- usa janela alvo quando configurada;
- pode procurar por imagem;
- pode validar texto OCR obrigatorio;
- possui modos de precisao;
- usa cache/ultima posicao para acelerar;
- faz fallback quando a posicao antiga falha;
- evita OCR em tela inteira por padrao;
- tem preview da imagem no card.

O modo preciso deve evitar confundir textos parecidos, especialmente datas como `09/2023` e `09/2025`.

Arquivos importantes:

- `executar_automacao.py`
- `capturar_imagem_tela.py`
- `gerenciar_roteiro.py`
- `tauri_gerador/web/main.js`

## Chrome/Web

Existe uma integracao para automatizar sites sem exigir HTML do usuario.

Ideia:

- usuario clica em Capturar elemento;
- o Chrome entra em modo captura;
- usuario clica no elemento;
- o app salva uma ficha amigavel do elemento;
- na execucao, tenta encontrar por id, name, placeholder, aria-label, texto, CSS selector e XPath.

Blocos relacionados:

- Chrome/Web
- Abrir URL

Importante:

- sites com certificado, GOV.BR, CAPTCHA ou politicas anti-bot podem limitar automacao por browser controlado.
- para casos sensiveis, o fluxo visual/OCR pode ser mais confiavel que HTML.

## Planilhas

O projeto usa planilhas para loop e dados dinamicos.

Funcoes atuais:

- importar planilha;
- abrir planilha atual no Excel;
- deletar linha para nao rodar no loop;
- limpar coluna/status;
- escrever na linha atual durante a execucao;
- escolher linha inicial do loop;
- executar a partir de uma empresa/linha especifica no controle remoto.

Cuidados:

- algumas planilhas podem ter `Chartsheet`; nao assuma que toda aba tem `iter_rows`.
- quando deletar linha na aba de planilha, blocos que usam essa planilha devem refletir a mudanca.
- a empresa exibida na execucao assistida deve bater com a linha atual real.

## Gravador Inteligente

Aba para criar automacoes gravando acoes.

Comportamento esperado:

- ao clicar na tela, abre menu de confirmacao no ponto do clique;
- permite ajustar area capturada;
- permite escolher 1 clique, 2 cliques ou somente identificar;
- botao direito abre menu para adicionar texto ou tecla;
- F10 pausa/retoma a gravacao;
- blocos gerados aparecem visualmente;
- ao enviar para o mapa, o bloco some da area de gravacao;
- cada bloco pode escolher para qual pagina sera enviado.

Cuidados:

- o menu de gravacao nao pode aparecer dentro do print capturado;
- clicar em opcoes do menu nao deve encerrar a gravacao;
- nao execute testes que cliquem/teclem no PC real sem avisar.

## FlowDetect Agent

O Agent e instalado no computador alvo.

Responsabilidades:

- receber automacoes enviadas pelo Studio;
- listar automacoes disponiveis;
- executar automacoes localmente no PC alvo;
- expor IP/porta para conexao;
- mostrar status simples;
- permitir acompanhar tempo real/biblioteca;
- minimizar/maximizar conforme pedido pelo Studio;
- mostrar overlay discreto quando estiver executando.

O usuario quer que o Agent seja mais simples que o Studio. Ele nao e editor.

## Controle remoto no Studio

O Studio controla o Agent por IP/porta.

Funcoes esperadas:

- conectar ao Agent;
- importar ZIP para o Agent;
- listar biblioteca remota;
- executar/parar automacao remota;
- escolher se o Agent minimiza ao executar;
- acompanhar progresso;
- ver planilha do projeto remoto;
- limpar coluna/status;
- assistir tela do Agent;
- ativar/desativar controle de mouse/teclado remoto.

Cuidados:

- conexao nao pode travar a UI;
- comandos de rede devem ser assicronos;
- se nao houver janela alvo, considere tela inteira;
- ao clicar em assistir, o Agent deve maximizar se estiver minimizado.

## Dados e arquivos que nao devem ir para GitHub

Nao subir dados reais do usuario:

- `automacoes/`
- `imagens/`
- `planilhas/`
- `relatorios_loop/`
- `diagnosticos_reconhecimento/`
- logs grandes;
- builds;
- instaladores;
- node_modules;
- target;
- arquivos `.xlsx`, `.pdf`, `.png` gerados por uso real.

Confira `.gitignore` antes de commitar.

## Preferencias do usuario

O usuario prefere:

- implementacao direta;
- pouca teoria;
- UX simples para usuario leigo;
- cards compactos;
- textos curtos e didaticos;
- botoes arredondados no padrao do FlowDetect;
- azul principal `#12B5CB`;
- verde de sucesso igual botao Salvar;
- fundo escuro do programa;
- animacoes suaves e fluidas;
- alinhamento preciso;
- pouca area vazia.

Evite:

- campos muito tecnicos na tela principal;
- textos longos dentro de cards;
- inputs enormes;
- modais desalinhados;
- efeitos exagerados;
- salvar automaticamente a cada troca de pagina;
- quebrar automacoes antigas.

## Validacao minima

Se mexer em `tauri_gerador/web/main.js`:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
node --check tauri_gerador/web/main.js
```

Se mexer em Python:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
python -m py_compile executar_automacao.py gerenciar_roteiro.py gravador_inteligente.py chrome_web_bridge.py gerenciar_dados_planilha.py
```

Se mexer em Rust/Tauri Studio:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador\src-tauri
cargo check
```

Se mexer no Agent:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\flowdetect_agent
& "C:\Program Files\nodejs\npm.cmd" run tauri:build
```

## Comandos uteis de Git

Criar uma rama nova:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
git checkout -b nome-da-atualizacao
```

Ver o que mudou:

```powershell
git status
git diff --stat
```

Commit e push:

```powershell
git add README.md README_AGENTE.md tauri_gerador/web/main.js tauri_gerador/web/style.css gerenciar_roteiro.py executar_automacao.py
git commit -m "Descrever atualizacao"
git push -u origin nome-da-atualizacao
```

## Observacoes importantes

- Nao rode automacoes reais que mexem mouse/teclado sem necessidade.
- Nao use `git reset --hard` ou comandos destrutivos sem pedido claro.
- O projeto pode estar com worktree suja; preserve alteracoes existentes.
- Ao alterar estrutura de bloco, mantenha valores padrao para automacoes antigas.
- Ao alterar executor, garanta que Studio e Agent continuem entendendo os mesmos tipos de bloco.
- Antes de entregar, diga exatamente quais arquivos foram alterados e quais validacoes passaram.
