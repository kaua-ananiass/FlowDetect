# Caminhos na árvore do mapa

No **Mapa dos comandos**, selecione **Árvore**. Os blocos ficam agrupados em
seções no próprio cenário, com título e tipo de execução.

Uma seção pertence à sua página: criar seções ou blocos dentro delas não cria
outra página numerada. As sequências internas continuam disponíveis como
destinos de ligação, mas não aparecem como páginas extras na navegação.

1. Clique em **Adicionar seção abaixo**, ao final das seções existentes,
   informe um nome e escolha Desktop ou Chrome.
2. Crie um caminho vazio, copie uma automação da biblioteca ou importe um
   projeto JSON/ZIP do Studio. Para Chrome, informe o número da página na
   extensão do Agente, por exemplo `1`.
3. No cabeçalho da seção de origem, clique em **Conectar blocos**. Escolha o
   bloco, sua saída de sucesso/falha e a seção ou bloco de destino.
4. O painel fecha após salvar. As seções aparecem separadas na mesma árvore,
   com os blocos editáveis e as ligações entre elas. Use **Enquadrar seções**
   para ver o conjunto ou aproxime o mapa para editar.

Exemplo: OCR não encontrou → caminho Chrome de recuperação → bloco 8 do
caminho principal. Para configurar a volta, selecione o último bloco do caminho
alternativo como origem e o bloco 8 como destino de sucesso.

Um caminho sem ligação de entrada não executa só por estar desenhado no mapa.
Ao terminar um caminho sem uma saída configurada, a execução termina; não há
retorno automático ao ponto que o chamou. Conectar substitui a rota escolhida
daquele bloco. O editor individual continua disponível para rotas específicas,
inclusive de cada alvo OCR. A saída de falha do painel é a regra geral do bloco;
regras individuais de OCR já configuradas têm precedência.

As importações copiam os blocos e recursos para o projeto atual, com novos IDs,
sequências isoladas e referências de destino ajustadas. A automação da biblioteca
permanece independente. Aceita projetos originais do Studio (`eventos`) e JSONs
exportados para a extensão (`flowdetect_chrome_automation`, com `steps`). O JSON
Chrome é recuperado como seção Chrome: OCR, imagem, seletor CSS de clique/verificação,
teclado, texto, URL, dados, marcadores de loop e relatório. As imagens incorporadas
são copiadas e os valores/linhas viram uma planilha própria. Tipos não suportados
são recusados sem importar parte da automação. Configurações que não existem no
JSON Chrome exigem o projeto original do Studio.
Referências externas ou recursos ausentes são recusados para evitar caminhos quebrados.

Para caminhos Chrome, execute o mapa pelo **Agente atualizado**, com a extensão
**0.2.72** pareada e a página vinculada no Chrome daquele computador. Prepare
a aba e a sessão do site antes de executar. O Agente envia os blocos compatíveis
à extensão, aguarda sua conclusão e retoma o destino desktop declarado. Não usa
OCR para clicar em Executar na extensão. Blocos incompatíveis são recusados;
falhas de comunicação não repetem a rotina automaticamente. A execução local
direta pelo Python, sem o Agente, não oferece essa ponte.

Rotas entre caminhos mudam o fluxo; elas não criam duas execuções simultâneas.
Loops existentes conservam seu comportamento. Entradas intermediárias em loops
Chrome são recusadas quando não há contexto suficiente para a planilha.

Validação: testes de importação, remapeamento, interface no navegador, separação
das faixas, roteamento Chrome/desktop e checagem Rust. Ainda é necessário testar
o fluxo real de trabalho na máquina dedicada antes de uso operacional.
