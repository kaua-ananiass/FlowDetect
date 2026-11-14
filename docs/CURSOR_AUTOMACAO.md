# Cursor FlowDetect na execução

As automações mostram uma seta com o nome FlowDetect, no mesmo estilo do
cursor do assistente do Studio. Não usa modelos, tokens ou chamadas de IA.

Durante a busca por texto OCR, imagem ou elemento, o cursor mostra **Analisando**
com uma lupa discreta em movimento. Faz um percurso suave de busca próximo
da última posição conhecida, sem enviar eventos de mouse. Ao encontrar o alvo,
passa ao movimento e à ação configurada; confirmar continua sem clicar.

No Chrome, a posição fica vinculada à execução e à aba no processo da extensão.
Recarregar a página ou navegar para outro domínio na mesma aba recupera o ponto,
sem voltar ao canto. Uma execução nova começa sem herdar o cursor de outra aba.
O cursor parado não se movimenta; somente o estado Analisando faz o percurso.

- Chrome: movimento curto até o elemento antes de clicar, preencher ou enviar
  teclas; indicação de clique; suporte aos botões e à paginação das tabelas.
- Windows: seta transparente acompanha o destino dos cliques por reconhecimento,
  da digitação e dos blocos de teclas. A janela não recebe foco nem intercepta o
  mouse. Os comandos nativos continuam usando mouse/teclado do sistema.
- No desktop, a animação tem uma thread própria de desenho e processamento de
  mensagens Win32. Continua atualizando durante a leitura OCR; entrada, cliques
  e chamadas UIA permanecem na thread original do executor.
- O desenho nativo usa renderização em alta resolução e redução com antialiasing.
  O clique aparece como um halo discreto na seta, sem caixa de texto adicional.
  Retângulos de reconhecimento/clique ficam restritos ao teste Procurar;
  o destaque específico de variável continua disponível.
- Somente confirmar, ler texto e procurar sem clicar não geram clique do cursor.
- O texto digitado nunca aparece na etiqueta do cursor.
- A apresentação não muda a quantidade de cliques. Não há repetição de ações
  quando a renderização falha. Uma interrupção durante o movimento impede o clique.
- O cursor permanece na última posição entre as ações. A transição usa aceleração
  e desaceleração suaves, com duração proporcional à distância (180 a 420 ms).
  No Chrome a preferência de movimento reduzido remove o deslocamento animado.
- Capturas de reconhecimento ocultam o desenho temporariamente e o restauram
  na mesma posição. O cursor é removido ao terminar, interromper ou sair da página.
- No Windows a janela transparente é mantida entre ações e liberada ao encerrar
  o executor. Durante a captura ela é ocultada sem perder a posição. Há mais
  100 ms de indicação após o movimento, além do tempo da ação.

O cursor é uma visualização do alvo calculado pelo executor. Não decide onde
clicar e não permite executar programas Windows em uma sessão independente.
O fechamento nativo das tabelas pelo depurador mantém a validação existente do
ponto e mostra a indicação de clique, sem acrescentar movimento entre a validação
e o envio do evento nativo.

Para testar a extensão atualizada: recarregue o FlowDetect em
chrome://extensions e recarregue a página da automação. Execute uma sequência
com clique, texto e tecla. O cursor acompanha as ações; um bloco configurado
apenas para confirmar não clica. No Studio, reinicie o modo de desenvolvimento
para carregar o executor Python atualizado. O instalador ainda precisa ser
recompilado para distribuir esta atualização.

Validação: testes de navegador com os blocos reais, interrupção e diálogo nativo;
regressões de tabelas; testes de execução única e cancelamento no Windows;
teste do marcador Win32 sem enviar entrada, preservando a janela em foco.
