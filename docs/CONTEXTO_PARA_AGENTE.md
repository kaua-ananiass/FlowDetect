# FlowDetect — contexto para continuar o projeto

Atualizado em 28/09/2026. Este documento descreve o checkout local e as decisões
recentes. Não significa que todas as alterações já foram commitadas ou publicadas.

## Objetivo e público

FlowDetect é uma plataforma Windows para criar, testar e executar automações
desktop e web por blocos. O público inclui usuários sem conhecimento de código.
Aplicações frequentes: ERPs, portais fiscais, rotinas de empresas/CNPJs,
preenchimento por planilha, downloads de guias e relatórios por linha.

O usuário deve configurar visualmente a automação. Não exigir que ele use o
Inspecionar do Chrome, escreva seletores CSS ou entenda HTML para realizar tarefas
comuns. Recursos técnicos podem existir, mas a captura e o fluxo principal devem
ser acessíveis.

## Localização e versões

- Workspace: `C:\Users\KauaCalaça\Documents\FlowDetect`.
- Raiz dos comandos deste documento: subpasta `Capturar_atalhos_hotkeys`.
- Studio e Agent: versão `3.0.0` nas configurações Tauri e package.json.
- Extensão Chrome: versão `0.2.46` no checkout atual.
- A extensão tem versionamento próprio; não igualar automaticamente a 3.0.0.
- Pacote recente: `saida_exe/FlowDetect-para-Chrome-v0.2.46.zip`.

## Componentes e estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `tauri_gerador/` | FlowDetect Studio: interface visual e comandos Rust/Tauri. |
| `flowdetect_agent/` | Aplicativo para execução remota e acompanhamento pelo Studio. |
| `flowdetect_runner/` | Projeto do runner desktop. |
| `flowdetect_chrome/` | Extensão Manifest V3, independente do aplicativo desktop para executar fluxos web exportados. |
| Python na raiz | Runtime compartilhado, captura, execução, edição de automações e dados. |
| `scripts/` | Compilação, preparação/limpeza de runtime e launchers. |
| `scripts/runtime/` | Launchers copiados para os pacotes instalados. |
| `docs/` | Compilação, contexto anterior do projeto e Hyper-V. |
| `tests/` | Testes Python, Node e cenários executados em Chrome/Edge headless. |
| `hyperv_setup/` | Preparação da VM-base para agentes. |
| `automacoes/`, `planilhas/`, `imagens/` | Dados e recursos das automações locais. |
| `automacoes_exportadas/`, `relatorios_loop/`, `output/`, `saida_exe/` | Exportações, relatórios e artefatos de distribuição. Inspecionar antes de excluir. |

Stack: Tauri 2/Rust, HTML/CSS/JavaScript puro, Python, PyAutoGUI, OpenCV,
Pillow, pytesseract, OpenPyXL, ReportLab, UI Automation Windows e integração
Chrome/Playwright. Consulte `requirements.txt` para as dependências fixadas;
não suponha que todas as dependências opcionais estejam nessa lista.

### Arquivos centrais

- `tauri_gerador/web/main.js`: lógica do editor, mapa, cards, drafts e interface.
- `tauri_gerador/web/index.html` e `style.css`: estrutura e estilos do Studio.
- `tauri_gerador/web/design-system.html`: referência visual do FlowDetect.
- `tauri_gerador/src-tauri/src/lib.rs`: ponte nativa do Studio.
- `flowdetect_agent/web/` e `src-tauri/`: interface e backend do Agent.
- `gerenciar_roteiro.py`: CRUD dos blocos, persistência, importação/exportação e conversão para a extensão Chrome.
- `executar_automacao.py`: motor desktop, reconhecimento, ações e controle do fluxo.
- `chrome_web_bridge.py`: ponte local usada pelo OCR para capturar/validar elementos da página.
- `gerenciar_dados_planilha.py`: leitura, preview e alteração de planilhas.
- `gravador_inteligente.py`: gravação de eventos para gerar blocos.
- `capturar_imagem_tela.py`, `reconhecimento_worker.py`: captura/reconhecimento.
- `mapear_elementos_janela.py`, `listar_janelas_abertas.py`: elementos e janelas Windows.
- `overlay_automacao_tela.py`, `overlay_janela_alvo.py`: feedback visual.
- `diagnostico_ambiente.py`, `validar_dependencias_instaladas.py`: diagnóstico.

## Funcionamento do produto

O Studio possui biblioteca de automações, mapa de comandos, execução assistida,
planilha/dados e controle do Agent. O mapa tem páginas de fluxo, cards compactos
ou expandidos, rotas de sucesso/falha, zoom, posições manuais e reorganização.

Blocos incluem texto, atalhos, reconhecimento visual/OCR, mapear janela,
abrir URL/programa, planilha, início/fim de loop, escrever célula, resultado do
relatório, verificar estado e salvar download. Os blocos independentes Mouse e
Chrome/Web foram removidos; cliques continuam dentro de OCR/reconhecimento e
automações web novas usam a extensão Chrome.

Uma página do mapa é uma sequência de blocos; não é necessariamente uma URL.
Um salto pode apontar para um bloco de outra página do mapa. Ao inserir, remover
ou reordenar blocos, preservar a identidade, os destinos e as posições dos demais.

Dados de planilha alimentam variáveis e loops. O usuário pode escolher a linha
inicial e a coluna que aparece durante a execução. Resultados e status do PDF
devem respeitar o que foi configurado nos blocos.

O Studio exporta fluxos web para JSON da extensão, incluindo imagens de referência.
O schema é `flowdetect_chrome_automation`; a extensão aceita versões 1, 2 e 3.
O fluxo desktop e o fluxo da extensão têm motores diferentes: validar ambos
quando alterar configuração compartilhada ou conversão de blocos.

## Extensão Chrome

- `service_worker.js`: execução, rotas, loops, estado, captura e logs.
- `content.js`: reconhecimento de texto/elementos e ações no documento da aba.
- `capture-offscreen.js` e `.html`: captura vinculada à aba para trabalho em segundo plano.
- `sidepanel.html`, `.js`, `.css`: card de execução/configuração; atualmente aberto como popup pelo manifest.
- `report-generator.js`: geração de relatório PDF.
- `manifest.json`: versão, permissões e entry points.

Armazenamento local: `flowdetectChromeAutomations` e `flowdetectChromeLastRun`.
O estado de execução não deve ser perdido ao abrir/fechar o popup. Também não
deve bloquear permanentemente o botão quando uma execução antiga deixou de
existir após reiniciar a extensão.

Atualizar juntos `manifest.json`, `RUNTIME_VERSION` no worker e
`REQUIRED_RUNTIME_VERSION` no painel ao gerar uma versão. `content.js` tem sua
própria versão de runtime para reinjeção/canal de mensagens; verificar essa
compatibilidade se mudar seu comportamento.

### Comportamentos que precisam ser preservados

1. **Segundo plano:** captura e execução permanecem vinculadas à aba de início,
   mesmo quando outra aba ganha foco. Nunca usar a imagem da outra aba. Se a
   captura vinculada falhar, o fallback espera a aba correta ficar ativa.
2. **OCR com clique deslocado:** o texto reconhecido pode ser uma âncora para
   clicar em outro ponto da imagem. O marcador escolhido pelo usuário deve ser
   respeitado; não substituir esse fluxo por um seletor HTML fixo.
3. **Checkbox:** selecionar o alvo correto, respeitar o número configurado de
   cliques e confirmar a mudança de estado. Não marcar todos e depois outra
   caixa como tentativa de correção. A resolução de alvo não deve saltar para
   uma caixa de outra linha.
4. **Dois cliques:** permitidos por decisão explícita do usuário, inclusive para
   desmarcar e remarcar uma caixa. Não reintroduzir a restrição de apenas um clique.
5. **Confirmação:** não registrar sucesso somente porque um evento foi enviado.
   Esperar o resultado quando a interface atualiza de forma assíncrona.
6. **Múltiplos OCRs:** cada alvo tem ação e destino de encontrado/não encontrado.
   “Continuar” num alvo intermediário pode significar procurar o próximo OCR.
7. **Compatibilidade:** automações antigas sem os novos campos continuam válidas,
   exceto os tipos de bloco Mouse e Chrome/Web, que foram removidos por decisão do usuário.

## Mudanças mais recentes

### Botão liberado apenas na tela correta — corrigido na 0.2.45

Configuração individual `automation.screen_guard`:

```json
{"enabled": true, "url": "https://site.exemplo/pagina", "text": "Texto esperado"}
```

O painel verifica a aba atual e só habilita **Executar automação** quando URL e
texto visível correspondem. Na aba errada, nenhuma execução/captura é iniciada.
Trocar de aba bloqueia imediatamente; voltar à tela correta libera após validar.
Há atualização por eventos de abas/janelas e polling enquanto o popup está aberto.

URL: mesmo origin, pathname e hash; query string depois de `?` é ignorada.
Texto: leitura do conteúdo renderizado pelo content script. Revalidar no clique
e no worker antes de criar a execução, incluindo mudança de foco durante a leitura.
Depois de iniciar, não continuar exigindo a tela inicial: o fluxo pode navegar
e executar em segundo plano.

**Decisão corrigida:** a primeira implementação iniciava uma execução em
`waiting_screen` na aba errada. O usuário rejeitou isso. Não restaurar esse
comportamento. Referências ao estado antigo ainda podem existir para recuperação.

### Tempo no destino individual do OCR — adicionado na 0.2.46

O conector que mostra `OCR 1 → P2/B7` agora tem campo em segundos. Funciona também
entre páginas e tem valores independentes por OCR e resultado:

```json
{"action": "confirmar_ir_para_bloco", "block": "7", "successDelay": 1.5,
 "failureAction": "ir_para_bloco", "failureBlock": "9", "failureDelay": 2.4}
```

Esses campos pertencem a `details.ocr_target_layouts` no editor / `detalhes` no
runtime. Preservá-los tanto nos inputs dos cards expandidos quanto no JSON oculto
dos cards compactos. Não confundir com o atraso anterior do bloco de destino.

- Editor: `getCommandMapOcrActionBranches`, `renderCommandMapTreeDelayControl`,
  `setCommandCardOcrRouteDelay`, `saveCommandJumpDelayFromInput` em `main.js`.
- Exportação: `fluxo_alvo_ocr_para_chrome` converte segundos em `flow.delay_ms`.
- Extensão: `waitForRouteDelay` espera depois do reconhecimento/clique, antes do destino;
  a espera pode ser cancelada.
- Desktop: o fluxo individual propaga `atraso` para o motor já existente.
- Zero mantém transição imediata e compatibilidade com os fluxos anteriores.

Para levar alterações de configuração para a extensão: salvar mapa, exportar
novamente do Studio e importar o JSON atualizado.

## Preferências de interface

- Design minimalista, mantendo o estilo escuro/verde/ciano do FlowDetect.
- Cards compactos; reduzir informações repetidas e evitar scroll externo desnecessário.
- Progresso e percentual precisam ser bem visíveis e fiéis à execução.
- O indicador **ao vivo** da atividade foi aprovado pelo usuário.
- PDF compacto: não restaurar o resumo numérico geral nem os títulos repetidos
  que foram removidos das páginas seguintes.
- Configurações técnicas discretas; priorizar linguagem simples e captura visual.

## Desenvolvimento e build

Pré-requisitos: Windows, Python, Node/npm, Rust/Tauri e ferramentas de build
compatíveis com os projetos. Use os arquivos de lock e guias existentes.

Studio, a partir da raiz:

```powershell
cd tauri_gerador
npm.cmd install
npm.cmd run tauri:dev
```

Agent em outro terminal, a partir da raiz:

```powershell
cd flowdetect_agent
npm.cmd install
npm.cmd run tauri:dev
```

Python, a partir da raiz:

```powershell
python -m pip install -r requirements.txt
```

Instalador Studio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compilar_gerador_exe.ps1
```

Agent: `npm.cmd run tauri:build` dentro de `flowdetect_agent`.
Studio NSIS: `saida_exe/FlowDetect_Instalador/`; portátil:
`saida_exe/FlowDetect_Portatil/`. Consulte `docs/COMPILACAO.md` para o processo.
Builds já existentes não garantem conter as últimas alterações locais.

Extensão: carregar a pasta `flowdetect_chrome` sem compactação em
`chrome://extensions`. Após atualizar, recarregar a extensão e as páginas abertas.
O ZIP de distribuição deve conter `manifest.json` na raiz.

## Verificação

Executar testes adequados à mudança; os testes de navegador usam Chrome/Edge
headless instalado, sem exigir Playwright para os cenários recentes.

```powershell
python -m unittest tests.test_chrome_extension_export tests.test_ocr_anchor tests.test_ocr_source_modes
python -m unittest tests.test_chrome_checkbox_browser tests.test_chrome_screen_guard_browser
node --test tests/test_chrome_extension_flow.cjs tests/test_command_map_failure_routes.cjs
node --test tests/test_chrome_screen_guard.cjs tests/test_chrome_extension_click.cjs
node --check tauri_gerador/web/main.js
node --check flowdetect_chrome/service_worker.js
git diff --check
```

As verificações recentes passaram para os conjuntos de exportação/OCR (59 testes
Python), para as rotas/espera/renderização (25 testes Node) e para o conjunto
Chrome/rotas anterior à última adição de teste de renderização (59 testes Node).
Isso não equivale a testar todos os sites reais ou recompilar Studio/Agent.

Outros testes cobrem reorganização, inserção, zoom, colunas, PDF, diagnósticos e
estrutura de runtime. Ao alterar o mapa, validar salvar/reabrir, cards fechados
e abertos, inserção/exclusão/reordenação, destinos entre páginas e loops.

## Git e dados locais — atenção

Na inspeção deste documento:

- Branch: `feature/ocr-clique-preciso`.
- HEAD: `554ca07` — `build(extensao): prepara pacote Chrome 0.2.38`.
- Commit anterior: `2332c9c` — `feat(ocr): melhora captura e clique preciso no Chrome`.
- Existem alterações locais posteriores, incluindo 0.2.46, ainda sem commit.
- Confirmar status, remotos e divergência antes de afirmar que uma branch foi enviada/mesclada.

`comandos_teclado.py`, `mapeamento_teclado.json` e `resumo_teclado.txt` já tinham
alterações locais de dados/configuração do usuário. Não sobrescrever, descartar
ou incluir automaticamente em commits de código.

Há também artefatos, pacotes antigos, outputs, temporários e caches não rastreados.
Não executar `git clean`, resets ou remoção em massa para “limpar” o checkout.
Os JSONs de automação em `F:\` ou no compartilhamento de rede vistos no IDE
podem ser dados de produção; sua presença no contexto não autoriza alterá-los.

Organização de pastas foi uma solicitação anterior: documentos em `docs/`,
scripts de build/launchers em `scripts/`. Python compartilhado ainda está na
raiz e é referenciado pelo empacotamento; não mover sem atualizar dependências,
imports, comandos e runtime dos aplicativos.

## Atualizacao funcional sem redesign (28/09/2026)

- Branch preparada: `feature/atualizacoes-funcionais-0.2.46`.
- O usuario decidiu manter o design antigo. `style.css` e `design-system.html`
  permanecem inalterados; os arquivos experimentais de design ficam fora do commit.
- O editor voltou a salvar `successDelay` e `failureDelay` dos alvos OCR nos
  cards abertos e fechados. Caminhos de alvos diferentes conservam esperas
  independentes mesmo quando chegam ao mesmo bloco.
- Os compositores, botoes de insercao e chamadas nativas dos blocos independentes
  Mouse e Chrome/Web foram retirados. A captura/validacao Chrome do OCR e o
  controle remoto de mouse continuam disponiveis.
- Verificacao: 94 testes Node passaram, incluindo inicializacao do Studio e
  persistencia dos tempos em navegador real; `cargo check --locked` passou.
- A suite Python completa executou 81 testes: 74 passaram e 7 falharam em
  `test_ocr_diagnostics.py`. As mesmas 7 falhas foram reproduzidas carregando
  `executar_automacao.py` do HEAD anterior (`554ca07`), sem modificar o checkout.
  Elas tratam de repeticao de leitura OCR no diagnostico e continuam pendentes.
- Gravacoes locais, caches, pacotes e temporarios nao fazem parte desta branch.

## Como continuar

Leia este arquivo, `README.md`, `docs/COMPILACAO.md`, `docs/README_AGENTE.md` e
`flowdetect_chrome/README.md`; o documento atual atualiza decisões que podem estar
desatualizadas nos textos anteriores. Inspecione o código e o diff local antes
de editar. Não refaça funcionalidades já prontas nem descarte mudanças locais.
Implemente a próxima tarefa preservando as decisões acima, valide os caminhos
afetados e informe claramente código alterado, testes e artefatos gerados.
