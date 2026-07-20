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
- Exportar automacoes em `.zip` para rodar em outro computador.
- Controlar execucoes remotamente com Agent/Control.

## Blocos Disponiveis

- **Texto livre:** digita textos fixos ou dinamicos.
- **Tecla/Atalho:** executa teclas, atalhos e repeticoes.
- **Mouse:** realiza cliques configurados.
- **Reconhecimento visual:** procura uma imagem na tela e decide o fluxo.
- **Planilha:** usa uma coluna como loop de execucao.
- **Inicio/Fim do loop:** delimita trechos repetidos por linha da planilha.
- **Verificar estado:** valida imagens/estados antes de continuar.
- **Chrome/HTML:** automatiza elementos do navegador via seletor HTML.
- **Abrir URL:** abre sites no navegador escolhido.
- **Abrir Programa:** inicia executaveis antes da automacao principal.

## Utilidade

O FlowDetect ajuda a transformar processos manuais repetitivos em fluxos visuais reutilizaveis.

Exemplos de uso:

- preenchimento de sistemas com dados de planilha;
- rotinas fiscais e administrativas;
- navegacao em portais sem API;
- cliques condicionais por reconhecimento de imagem;
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

## Observacao

Automacoes desktop dependem da tela real do computador. Para melhor estabilidade, use janela alvo, imagens bem recortadas e tempos de espera adequados ao sistema automatizado.
