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
- **Mouse:** realiza cliques configurados.
- **Reconhecimento visual:** procura uma imagem na tela e decide o fluxo.
- **Planilha:** usa uma coluna como loop de execucao.
- **Escrever celula:** grava status, observacoes ou resultados na linha atual da planilha.
- **Inicio/Fim do loop:** delimita trechos repetidos por linha da planilha.
- **Verificar estado:** valida imagens/estados antes de continuar.
- **Chrome/Web:** captura campos, botoes e textos do Chrome para automatizar sites.
- **Abrir URL:** abre sites no navegador escolhido.
- **Abrir Programa:** inicia executaveis antes da automacao principal.
- **Salvar download:** monitora uma pasta, encontra o arquivo baixado e move para o destino escolhido.

## Recursos Recentes

- **Mapa mais fluido:** criacao, exclusao e movimentacao de blocos com animacoes suaves.
- **Cards compactos e detalhados:** o bloco mostra o essencial no mapa e abre detalhes quando necessario.
- **Gravador Inteligente:** cria blocos automaticamente a partir de cliques, textos e teclas gravadas.
- **Captura Chrome/Web:** seleciona elementos direto no navegador e salva uma ficha amigavel do elemento.
- **Extensão Chrome:** exporta automações web para executar diretamente na aba atual do navegador.
- **Planilha em tempo real:** permite usar linhas como loop e atualizar celulas durante a execucao.
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

## Rodar em Desenvolvimento

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

## Instalar Dependencias Python

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
python -m pip install -r requirements.txt
python -m playwright install
```

## Compilar

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
```

## Extensão para Chrome

A primeira versão da extensão fica em `flowdetect_chrome/`.

1. No Chrome, abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione `flowdetect_chrome`.
3. No Studio, abra a Biblioteca, vire o card de uma automação e clique em **Exportar para Chrome**.
4. No painel lateral da extensão, importe o arquivo JSON e execute a automação na aba atual.

Ela executa URL, ações Chrome/Web, texto, teclas, clique na aba, loops de planilha, OCR de texto da página e reconhecimento visual por imagem. As referências visuais são incluídas no JSON exportado para a extensão funcionar sem depender da pasta de imagens do Studio.

## Observacao

Automacoes desktop dependem da tela real do computador. Para melhor estabilidade, use janela alvo, imagens bem recortadas e tempos de espera adequados ao sistema automatizado.
