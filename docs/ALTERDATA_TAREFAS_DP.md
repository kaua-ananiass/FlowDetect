# Alterdata no Studio — tarefas de DP

A aba Alterdata permite preparar pedidos de Férias, Admissão, Rescisão e Contrato de experiência. Os formulários são modelos de entrada; não incluem uma sequência de cliques já validada no Alterdata.

## Usar

1. Cadastre/conecte o PC dedicado na aba Agentes.
2. Crie, salve e teste no editor o fluxo visual correspondente à rotina.
3. Em cada bloco de Texto livre destinado a um campo do formulário, habilite a edição na execução e use a variável exibida em “Como preparar o fluxo”. Por exemplo: `{{empresa.codigo}}`, `{{funcionario.codigo}}`, `{{ferias.inicio}}`, `{{ferias.dias}}`.
4. Abra Alterdata no Studio, escolha o modelo e preencha os dados. Empresa e funcionário são informados manualmente nesta etapa.
5. Selecione o fluxo salvo e o agente. Confirme a revisão antes de “Enviar e executar no agente”.
6. O Studio envia o fluxo pelo mecanismo existente, substitui os textos editáveis por valores daquele pedido e inicia a execução remota. Datas são enviadas no formato dd/mm/aaaa. O fluxo salvo não é regravado com esses valores.
7. Use “Acompanhar agente” para abrir a tela remota. A conclusão e os documentos dependem do fluxo visual configurado.

Salvar pedido apenas cria um registro local neste Studio. Não agenda nem inicia uma execução. Os pedidos salvos podem ser reabertos para revisão e novo envio. Não existe fila automática ou indicação de conclusão sincronizada nesta primeira etapa; “Iniciado no agente” significa apenas que o comando de início foi aceito.

## Verificações

O envio exige um agente e fluxo cadastrados. Todos os campos obrigatórios precisam estar presentes nos textos editáveis do fluxo. Campos opcionais preenchidos também precisam ser utilizados. Variáveis desconhecidas, incompletas ou ordens duplicadas são recusadas antes de iniciar a automação.

Uma execução já em andamento no controle remoto impede iniciar outro pedido pela aba. Em caso de falha de comunicação, confira o agente antes de tentar novamente: a perda da resposta não prova que a execução deixou de iniciar.

## Limites

- Não há conector PostgreSQL autenticado implementado nesta aba; nenhuma senha é solicitada ou armazenada pelo formulário.
- O mapeamento de metadados existente é documentação, não uma conexão ativa.
- Férias e rescisão não são calculadas pelo FlowDetect; o Alterdata executa essas funções através do fluxo visual.
- Campos adicionais e revisões dentro da rotina precisam ser definidos no fluxo antes de usá-lo em produção.
- A implementação não foi validada com um agente ou uma rotina real de DP neste desenvolvimento; a integração de interface e parâmetros foi testada com execução simulada.
