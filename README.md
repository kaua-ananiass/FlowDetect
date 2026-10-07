<p align="center">
  <img src="tauri_gerador/web/assets/flowdetect-welcome.png" alt="FlowDetect" width="620">
</p>

# FlowDetect

FlowDetect e uma plataforma visual para criar, testar e executar automacoes desktop em blocos, sem depender de API do sistema automatizado.

Ele foi pensado para automatizar tarefas em programas Windows, ERPs, portais web, sistemas fiscais e telas repetitivas usando teclado, mouse, reconhecimento visual, planilhas e fluxos condicionais.

## Principais Funcoes

- Criar automacoes por blocos em um mapa visual.
- Testar a automacao com execucao assistida em tempo real.
- Usar planilhas para executar loops por linha.
- Reconhecer imagens na tela e tomar decisoes de sucesso ou falha.
- Definir janela alvo para evitar cliques fora do sistema correto.
- Pular entre blocos ou paginas conforme o resultado de cada etapa.
- Criar blocos rapidamente com preview no proprio mapa de comandos.
- Gravar cliques e teclas com o Gravador Inteligente.
- Automatizar elementos do Chrome sem o usuario precisar entender HTML.
- Escrever resultados de volta na planilha durante o loop.
- Mover e renomear downloads automaticamente depois que o arquivo baixar.
- Exportar automacoes em `.zip` para rodar em outro computador.
- Controlar execucoes remotamente com FlowDetect Agent.
- Assistir a tela do Agent pelo Studio com transmissao remota integrada.

## Blocos Disponiveis

- **Texto livre:** digita textos fixos ou dinamicos.
- **Tecla/Atalho:** executa teclas, atalhos e repeticoes.
- **Reconhecimento visual:** procura uma imagem na tela e decide o fluxo.
- **Planilha:** usa uma coluna como loop de execucao.
- **Escrever celula:** grava status, observacoes ou resultados na linha atual da planilha.
- **Resultado do relatorio:** define o status, a mensagem e a evidencia da linha atual no PDF final do loop.
- **Inicio/Fim do loop:** delimita trechos repetidos por linha da planilha.
- **Verificar estado:** valida imagens/estados antes de continuar.
- **Abrir URL:** abre sites no navegador escolhido.
- **Abrir Programa:** inicia executaveis antes da automacao principal.
- **Salvar download:** monitora uma pasta, encontra o arquivo baixado e move para o destino escolhido.

## Recursos Recentes

- **Capturar fluxo:** fotografa o mapa original, mantendo cards, botões, posições, marcadores OCR e curvas das conexões. Inclui blocos fora da tela e salva em PNG de alta resolução (3×, com limite de memória para fluxos grandes). Captura a página atual por padrão; também pode incluir todas as páginas. O SVG opcional deve ser aberto no Chrome ou Edge.
- **Mapa mais fluido:** criacao, exclusao e movimentacao de blocos com animacoes suaves.
- **Cards compactos e detalhados:** o bloco mostra o essencial no mapa e abre detalhes quando necessario.
- **Gravador Inteligente:** cria blocos automaticamente a partir de cliques, textos e teclas gravadas.
- **OCR por elemento:** pode capturar e validar um elemento da pagina como fonte de reconhecimento.
- **Extensão Chrome:** exporta automações web para executar diretamente na aba atual do navegador.
- **Planilha em tempo real:** permite usar linhas como loop e atualizar celulas durante a execucao.
- **Relatorio PDF compacto:** ao finalizar um loop de planilha, gera um resumo visual com cada linha, resultado, horario e status configurado no fluxo.
- **Agent remoto:** o Studio pode enviar automacoes para outro PC, iniciar execucoes e acompanhar o andamento.
- **Tela remota:** visualizacao da tela do Agent dentro do Studio para acompanhar a automacao.

## Utilidade

O FlowDetect ajuda a transformar processos manuais repetitivos em fluxos visuais reutilizaveis.

Exemplos de uso:

- preenchimento de sistemas com dados de planilha;
- rotinas fiscais e administrativas;
- navegacao em portais sem API;
- cliques condicionais por reconhecimento de imagem;
- organizacao automatica de arquivos baixados;
- registro de status diretamente em planilhas;
- execucao de varias empresas, clientes ou codigos em sequencia.

## Tecnologias

- Python
- Tauri
- HTML/CSS/JavaScript
- PyAutoGUI
- OpenCV
- OpenPyXL
- Playwright

## Organizacao do projeto

| Pasta | Conteudo |
| --- | --- |
| `tauri_gerador/` | Interface e backend do Studio. |
| `flowdetect_agent/` | Aplicativo do Agent. |
| `flowdetect_chrome/` | Codigo-fonte da extensao Chrome. |
| `flowdetect_runner/` | Runner desktop. |
| `scripts/` | Compilacao, limpeza e launchers usados no empacotamento. |
| `docs/` | Guias de compilacao, Agent e Hyper-V. |
| `tests/` | Testes automatizados. |

Os arquivos Python da raiz sao o runtime compartilhado pelos aplicativos. Os dados de automacoes, planilhas e imagens ficam nas pastas proprias. Consulte os guias de [compilacao](docs/COMPILACAO.md), [Agent](docs/README_AGENTE.md) e [Hyper-V](docs/HYPERV_AGENTES.md).

## Rodar em Desenvolvimento

```powershell
cd tauri_gerador
npm.cmd run tauri:dev
```

## Instalar Dependencias Python

```powershell
python -m pip install -r requirements.txt
python -m playwright install
```

## Compilar

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compilar_gerador_exe.ps1
```

## Extensão para Chrome

A primeira versão da extensão fica em `flowdetect_chrome/`.

1. No Chrome, abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione `flowdetect_chrome`.
3. Para conectar diretamente, abra a extensão e copie o código de seis dígitos exibido no topo.
4. No Launcher do Studio, clique em **Conectar Chrome**, digite o código e aguarde **Conectado ao Studio**. O pareamento é lembrado nos próximos reinícios.
5. Na Biblioteca, use **Enviar à extensão** para importar uma nova cópia sem arquivo intermediário. A opção **Exportar para Chrome** continua disponível para gerar um JSON e importá-lo manualmente.

O Studio e o Chrome precisam estar no mesmo computador. Se a extensão mostrar **Studio não encontrado**, confirme que o Studio atualizado está aberto; o código não substitui a comunicação local. Para testar OCR no Chrome, abra a página HTTP/HTTPS desejada e escolha **No Chrome** no teste do bloco.

Para ajustar um OCR ao iniciar uma automação, marque **Editável na extensão** no texto alvo do bloco, salve o mapa e envie/exporte novamente. A extensão mostrará **Textos OCR editáveis** no card da automação. A troca altera só a validação daquela execução; o clique e as rotas permanecem os mesmos.

Para retirar empresas antes de rodar um loop de planilha, abra **Empresas do loop** no card da extensão. Busque pelo nome ou CNPJ e desmarque as linhas a ignorar; a contagem de empresas ativas e a opção **Começar em** se ajustam automaticamente. A extensão pede confirmação antes de executar com exclusões. Por padrão, a seleção vale só para a execução atual; marque **Salvar exclusões nesta automação** para reutilizá-la depois. O arquivo original e o mapa não são alterados. O PDF final lista as linhas ignoradas separadamente das processadas.

Ela executa URL, texto, teclas, loops de planilha, OCR de texto ou elemento da página e reconhecimento visual por imagem. As referências visuais são incluídas no JSON exportado para a extensão funcionar sem depender da pasta de imagens do Studio.

## Observacao

Automacoes desktop dependem da tela real do computador. Para melhor estabilidade, use janela alvo, imagens bem recortadas e tempos de espera adequados ao sistema automatizado.
