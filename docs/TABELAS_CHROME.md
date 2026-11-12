# Ler tabelas do Chrome

O bloco **Ler tabela** captura as células do HTML e mapeia botões por linha, sem reconhecer cada campo por OCR. Disponível no Studio em desenvolvimento e na extensão **0.2.82**.

## Configuração visual em quatro passos

O Studio mostra somente a estrutura: os nomes das colunas, os botões fixos e linhas desenhadas com traços. Números de guias, nomes de trabalhadores e valores não aparecem na configuração. O mapeamento enviado ao Studio também não contém os valores das linhas. Eles só são capturados durante a execução.

1. **Tabela principal:** deixe a lista aberta no Chrome e clique **Selecionar tabela no Chrome**. O desenho passa a mostrar as colunas encontradas. A coluna que identifica cada linha fica destacada; clique em outro cabeçalho se precisar trocar.
2. **Botão e detalhe:** clique no ícone do olho no desenho. Depois abra uma linha manualmente no Chrome e use **Selecionar tabela do detalhe**. O Studio mostra o desenho das colunas internas, sem dados de exemplo reais.
3. **Como voltar:** ainda no detalhe, use **Selecionar botão de fechar / voltar**. A ilustração mostra o detalhe fechando e a próxima linha na lista. Para telas com histórico de navegação, há a alternativa **Usar Voltar do navegador**.
4. **Revisar:** confira o percurso desenhado — abrir uma linha, capturar a tabela, voltar e repetir. Clique **Criar automação com essas etapas**. As opções de empresa/CNPJ e nome do resultado ficam recolhidas em **Opções do resultado**.

As seleções são salvas como rascunho durante a configuração. Um rascunho incompleto não pode ser exportado para executar como se fosse a automação completa. Ao abrir um percurso já criado, o Studio recupera as escolhas dos blocos existentes; **Salvar alterações do percurso** atualiza as etapas relacionadas sem criar outro loop.

O botão **Avançado** mantém as opções de leitura de uma coluna, variáveis, CSV e cliques específicos. A configuração visual é o caminho padrão para percorrer todas as linhas.

## Identificar uma falha na execução

O painel informa o nome da etapa (Ler lista, Abrir detalhe, Capturar detalhe, Voltar ou Gerar planilha) e a guia atual. Uma falha aparece no cartão em **Motivo da falha**, com bloco, guia e mensagem original. Em **Ao vivo**, use **Ver motivo da falha** para revisar uma etapa anterior.

Erros no percurso de tabelas interrompem a execução. Se abrir uma guia falhar, o programa não tenta ler nem fechar um detalhe que não abriu. Essa proteção também se aplica às exportações antigas do percurso que tinham “continuar” como ação implícita de falha. O progresso considera as repetições do loop, em vez de dividir a quantidade de passos executados apenas pelos sete blocos do mapa.

## Percorrer guias e acumular todos os detalhes

Não é necessário cadastrar os números das guias. A lista é lida novamente para cada empresa durante a execução.

Siga os quatro passos acima. Para várias empresas, informe a variável de empresa/CNPJ em **Opções do resultado**, na revisão; o programa não deduz a empresa pelo número da guia. Volte manualmente à lista no Chrome antes de iniciar a automação.

O mapa recebe estes blocos na mesma seção/página:

**Ler lista → Início do loop → Abrir detalhe da linha → Ler tabela interna → Voltar para a lista → Fim do loop → Consolidar dados.**

A leitura espera a tabela carregar. A volta espera a lista reaparecer antes da próxima guia. Cada linha é identificada pelos números obtidos na própria execução. Identificadores vazios ou repetidos interrompem o percurso antes dos cliques. Uma lista sem guias, quando o portal informa total zero, encerra sem erro e gera um resultado vazio.

O bloco **Consolidar dados** gera um `.xlsx` com duas abas: **Guias**, com os dados da lista e a quantidade de linhas de detalhe capturadas; e **Detalhamento**, com empresa, número da guia e todas as colunas da tabela interna. Cabeçalhos ficam congelados, há filtros e linhas alternadas. Os valores são preservados como texto, incluindo zeros à esquerda e valores no formato brasileiro. CSVs são opcionais nesse bloco.

Os detalhes são acumulados durante a execução. Reler a mesma guia da mesma empresa substitui aquele grupo de detalhes, sem duplicar a captura anterior. Guias com o mesmo número em empresas diferentes permanecem separadas. Os dados de uma execução anterior não são importados automaticamente.

Se houver um loop externo de empresas, deixe **Consolidar dados** depois desse loop para baixar somente a planilha final. Dentro dele, o resultado é baixado a cada passagem, com tudo o que já foi capturado; o Chrome preserva os arquivos existentes.

Os blocos gerados podem ser editados individualmente. O assistente impede gerar o mesmo percurso duas vezes no mesmo bloco. Não há novas tentativas automáticas de clicar em uma guia que falhou. A planilha é gerada quando o fluxo chega ao bloco Consolidar dados; uma interrupção antes dele não representa uma coleta completa.

O leitor coleta linhas e células presentes no HTML, com a paginação verificável suportada. Conteúdos adicionais de botões Expandir, tooltips ou abas ainda não carregadas exigem etapas próprias. A estrutura de teste inclui carregamento atrasado, várias guias, retorno à lista e empresas diferentes; o primeiro uso no portal autenticado deve ser conferido.

## Prévia e botões por linha

Depois de mapear, a prévia fica no bloco, inclusive ao salvar e reabrir durante a mesma sessão do Studio. **Atualizar prévia** relê a página aberta no Chrome, sem precisar selecionar a tabela novamente. Ao reiniciar o Studio, atualize a prévia; os valores das linhas não ficam gravados no projeto.

Na coluna Ações da prévia, clique em **Ver detalhes**, **Mais opções** ou no botão identificado pelo portal. Isso apenas configura a ação. O clique real ocorre somente quando a automação executa o bloco em **Clicar no botão de uma linha**.

Informe a coluna identificadora e o valor, por exemplo **Número da Guia** e `{{Número da Guia}}`. O bloco verifica que há uma única linha com esse número e encontra o botão pelo conteúdo, rótulo ou ícone, sem usar coordenadas da tela. Mudança ou ambiguidade no botão, linha duplicada e botão desabilitado interrompem a ação. Se não houver informação suficiente para distinguir botões iguais, é necessário ajustar o portal/alvo; não escolhemos um por posição.

### Clicar em todas as linhas

1. Primeiro bloco **Ler tabela**: modo lista, inclua a coluna Número da Guia e marque **Ler todas as páginas** e **Usar as linhas no próximo Início do loop**.
2. Adicione **Início do loop**.
3. Adicione outro bloco **Ler tabela**, mapeie a mesma tabela e escolha o botão na prévia. Use modo **Clicar no botão de uma linha**, coluna Número da Guia e valor `{{Número da Guia}}`.
4. Adicione os blocos que aguardam o detalhe abrir, leem a tabela interna, baixam um documento ou realizam a tarefa desejada.
5. Volte à lista e aguarde ela reaparecer, antes de **Fim do loop**.

Cada execução do bloco de ação faz um clique. A automação controla o que acontece depois; o bloco não fecha detalhes automaticamente. O menu dos três pontos é aberto pelo clique, mas a opção dentro dele ainda precisa de um próximo bloco. Não há um clique em massa que ignore o carregamento de cada detalhe.

As ações percorrem a paginação verificável e voltam à primeira página para localizar a guia, mesmo quando a leitura anterior terminou na última. Isso privilegia a identificação correta; listas grandes exigem mais tempo. Não há novas tentativas automáticas de clique em caso de erro. Uma parada solicitada antes da autorização final impede o clique; um clique já enviado ao portal não pode ser desfeito.

## Configurar

1. Reinicie o Studio depois da atualização. Recarregue a extensão em `chrome://extensions` e atualize a página do portal. Conecte a extensão ao Studio.
2. No mapa dos comandos, adicione um bloco **Ler tabela** e abra os detalhes.
3. Abra a tabela desejada no Chrome. Se ela fica dentro do detalhe de uma guia, abra esse detalhe primeiro.
4. Clique em **Mapear tabela no Chrome** e depois na tabela. O clique de mapeamento seleciona a estrutura, sem acionar os botões da linha. Esc cancela.
5. Confira a prévia e marque as colunas desejadas. Defina o nome da variável e salve.

O projeto guarda os cabeçalhos e a página de referência. As linhas mostradas na prévia não são gravadas no projeto; os valores são lidos novamente na execução.

## Usar os dados

- **Lista de linhas (JSON):** salva as colunas escolhidas em uma lista, por exemplo `{{trabalhadores_fgts}}`.
- **Um valor de uma linha:** escolha uma única coluna de saída e informe a coluna e o texto exato usados para localizar a linha. A busca precisa encontrar uma única linha. O texto pode conter uma variável, como `{{nome_funcionario}}`.
- **Usar as linhas no próximo Início do loop:** coloque um bloco Início do loop depois da leitura. Em cada linha, use o cabeçalho como variável, por exemplo `{{Nome Trabalhador}}` ou `{{Total}}`.
- **Baixar resultado em CSV:** gera um CSV com as colunas selecionadas, na pasta de downloads configurada no Chrome.

O valor capturado também aparece na biblioteca de variáveis dos blocos de texto, para ser digitado nas próximas etapas da automação.

## Paginação e limites

Comece na primeira página e ative **Ler todas as páginas** para listas paginadas. Nesta versão, o leitor reconhece a paginação do componente usado pelo FGTS, com contagem como `1-10 de 16 itens`, e valida a continuidade e o total. A leitura termina na última página.

O leitor funciona com tabelas HTML, `ngx-datatable` e estruturas ARIA de tabela/grid, no documento principal. Ainda não lê tabelas dentro de iframes ou Shadow DOM. Linhas fora do HTML de tabelas virtualizadas não são recuperadas; quando há uma contagem verificável, a captura incompleta é rejeitada. Sem contagem ou paginação reconhecível, apenas as linhas presentes no HTML podem ser verificadas.

Limites: 100 colunas, 100 páginas, 10 mil linhas e resultado de até 2 milhões de caracteres. Cabeçalhos repetidos ou várias tabelas iguais abertas exigem ajustar a seleção. Não há consulta a APIs internas nem acesso a detalhes que o portal ainda não carregou. A automação deve abrir o botão de detalhe antes do bloco Ler tabela.

Validado com páginas locais de teste, incluindo estrutura Angular e paginação semelhantes às do FGTS. A execução no portal autenticado deve ser conferida no primeiro uso.
