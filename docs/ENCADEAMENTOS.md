# Encadeamentos no agente dedicado

A aba **Encadeamentos** do Studio organiza processos desktop e Chrome em uma
sequência executada no mesmo PC. Exemplo: gerar um documento no Alterdata,
concluir esse fluxo e iniciar uma conferência em um portal no Chrome.

## Preparar o computador

1. Atualize o Studio e o Agente com este código. Um Agente instalado anteriormente
   precisa ser recompilado/atualizado; atualizar apenas a extensão não adiciona este recurso.
2. No PC dedicado, mantenha uma sessão Windows interativa e desbloqueada, os
   programas instalados e as automações testadas na biblioteca do Agente.
3. Instale a extensão **0.2.72** nesse PC e recarregue as abas dos sites.
   Abra o Chrome no perfil que ficará disponível para a execução.
4. Cadastre e pareie o Agente no Studio, na rede local. Na aba Encadeamentos,
   selecione esse computador e clique em **Conectar e carregar fluxos**.
5. Informe o código de seis números da extensão aberta **no PC do Agente**
   e clique em **Parear Chrome do agente**. Depois, atualize o agente.
   A extensão se comunica com a ponte local do Agente na porta 18453;
   não é necessário abrir essa porta para outros computadores.
6. Vincule as páginas da extensão às abas corretas nesse Chrome.

O Studio fica no computador do operador, e o Agente no computador dedicado.
Nesta versão, evite abrir Studio e Agente simultaneamente no mesmo PC:
ambos usam a mesma porta local da ponte Chrome.

## Montar e executar

1. Dê um nome ao encadeamento e escolha uma automação da biblioteca do Agente.
2. Escolha **Desktop** ou **Chrome** e adicione o processo. Repita na ordem desejada.
3. Expanda cada processo para revisar seus blocos, rotas e ponto de entrada.
   A árvore mostra referências aos blocos salvos; não duplica nem edita esses blocos.
4. Nos processos Chrome, escolha a página vinculada. Opcionalmente informe
   a URL esperada: são conferidos o domínio, a porta e o caminho, ignorando
   os parâmetros de consulta e o fragmento.
5. Prepare as telas iniciais dos programas. Configure um limite de tempo para
   cada processo e, se necessário, os dados compartilhados.
6. Salve, marque a revisão e clique em **Executar no agente**.
   **Ver tela do agente** abre o acompanhamento remoto existente.

Os rascunhos ficam salvos neste Studio. Salvar um encadeamento não o executa.
Antes dos cliques, o Agente confere os arquivos JSON das automações revisadas
e a compatibilidade das exportações Chrome. Se o JSON mudar, remova e adicione
novamente o processo para revisar sua versão atual. Essa conferência não inclui
alterações isoladas nas imagens ou planilhas auxiliares.

## Como ocorre a passagem entre programas

O Agente inicia o executor desktop e aguarda sua conclusão com sucesso.
Em seguida, envia um comando à extensão pareada, ativa a aba vinculada e
inicia o fluxo Chrome pelo começo ou pelo bloco escolhido. Ele acompanha o
identificador dessa execução até ela concluir antes de seguir para o próximo processo.

Essa passagem não depende de localizar ou clicar no botão Executar da extensão
por OCR. Os reconhecimentos, cliques e verificações gravados dentro de cada
automação continuam necessários. O encadeamento não cria os fluxos visuais do
Alterdata e não chama funções internas do banco para gerar documentos.

Escolher um bloco intermediário exige que a tela e o contexto estejam preparados.
Fluxos com loops/planilhas devem começar pelo início, para preservar o contexto da linha.

## Compartilhar dados

Em **Dados compartilhados entre os processos**, informe um objeto JSON:

```json
{
  "empresa": "330",
  "funcionario": "27",
  "arquivo": "C:\\Saidas\\documento.pdf"
}
```

No desktop, use `{{empresa}}` e outros nomes em blocos **Texto livre** com
edição na execução habilitada. No Chrome, use as mesmas variáveis nos campos
do fluxo. Os valores precisam ser textos; são aceitas até 50 variáveis.

São dados configurados antes da execução. Esta versão não captura automaticamente
saídas de um processo para preencher o seguinte. Arquivos devem ter caminhos
conhecidos no Agente; passar um caminho não faz upload ou anexo automaticamente.

## Falhas, parada e recuperação

- Uma falha impede a execução dos processos seguintes.
- **Parar encadeamento** solicita a parada e aguarda a confirmação do executor.
- O Agente reserva a execução e impede alterações remotas nas automações durante
  o encadeamento. A extensão também impede inícios manuais e mudanças no vínculo.
- Fechar o Studio não cancela um encadeamento que já foi recebido pelo Agente.
  Reabra o Studio e consulte o mesmo Agente para acompanhar.
- Se houver perda da confirmação ou reinício do Agente/extensão, não há repetição
  automática. Confira a tela e os documentos gerados. Pare qualquer executor ainda
  ativo antes de usar **Conferi o agente · liberar reserva**.

O último estado fica em `automation_chain_last.json`, na pasta de trabalho do Agente.
A reserva controla os executores FlowDetect; ela não impede intervenção direta
de uma pessoa na sessão Windows.

## Validação desta implementação

Há testes de sequência/interrupção no núcleo Rust, comandos da extensão, entrada
do executor Python e interface em navegador com Agente simulado. A execução real
no Alterdata deve ser validada em uma rotina de teste no computador dedicado
antes do uso operacional.
