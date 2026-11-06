# Agente no computador dedicado

O Studio fica no seu computador. O FlowDetect Agent, o Alterdata e o Chrome
ficam no computador que executará os processos. A conexão atual é pela rede
local privada, com código de pareamento; não há servidor de acesso pela internet.

## Preparar o PC

1. Instale o FlowDetect Agent 3.1.1 e abra pelo atalho. O painel mostra o código
   temporário para parear o Studio. Abrir novamente o atalho restaura o painel
   existente. Ctrl + Shift + F12 também abre ou oculta o painel.
2. No seu Studio, vá a **Agentes → Físico**, adicione o agente pelo código e
   conecte. Ative **Mouse** no Agent quando quiser controlá-lo remotamente.
3. Permita o aplicativo no firewall da rede privada: TCP 18452 para o canal
   autenticado e UDP 18453 para descoberta. Não abra essas portas no roteador.
4. Para processos web, instale a extensão FlowDetect 0.2.72 ou posterior no
   Chrome do próprio agente. Copie os seis dígitos da extensão para **Chrome do
   agente → Conectar**. Esse código é diferente do código de pareamento do Studio.
5. Vincule as páginas da extensão às abas que serão usadas. Confira a empresa,
   usuário e tela inicial do Alterdata antes de executar o primeiro teste.

## Executar

Envie a automação pelo Studio ao agente selecionado. Os cliques, teclas, OCR
e arquivos pertencem ao PC do agente. Nos encadeamentos, selecione esse agente
e as páginas Chrome correspondentes; a troca para Chrome usa a ponte da extensão.

Mantenha a sessão Windows aberta e desbloqueada. O PC não deve suspender durante
uma execução visual. Minimizar o painel preserva o acesso pela barra de tarefas;
**Ocultar** esconde o painel, mas o processo continua disponível pelo atalho.

## Diagnóstico

- **Servidor TCP indisponível:** o painel mostra o erro real de abertura da porta.
  Verifique outra instância ou outro processo usando TCP 18452.
- **Ponte Chrome indisponível:** feche o Studio no PC dedicado e reinicie o Agent.
  Os dois aplicativos usam a mesma porta local da ponte; o Studio controlador deve
  estar no outro computador.
- **Pareado, aguardando Chrome:** abra o Chrome e confirme que a extensão está
  ativada. O código aceito não significa que o navegador já está conectado.
- Uma falha inicial da biblioteca não interrompe a atualização remota. Use
  **Atualizar** para tentar carregar a biblioteca novamente e confira os logs.

O instalador inclui Python portátil, bibliotecas e Tesseract. Não depende do Python
global para executar os fluxos. A captura/edição que exige Tk continua dependendo
de um Python com interface gráfica; o agente é destinado a executar os fluxos
preparados no Studio.

Os hooks específicos do instalador do Agent não apagam diretórios compartilhados
do Studio, credenciais ou máquinas virtuais. Mantenha backup dos seus projetos
antes de desinstalar qualquer versão antiga.
