# FlowDetect para Chrome

Versao 0.2.58: pareamento com o Studio, teste de reconhecimento na aba ativa e
edicao opcional de textos OCR por execucao.

Extensão que executa automações web exportadas pelo FlowDetect Studio na aba atual do Chrome.

## O que ela executa

- abrir URL na aba atual;
- preencher texto no campo com foco, enviar teclas e clicar por coordenada da aba;
- executar loops simples com os valores já carregados pelo bloco de planilha;
- localizar elementos por CSS, id, name, placeholder, aria-label, texto ou XPath;
- clicar, preencher campos, limpar campos, selecionar opcoes e marcar checkbox;
- localizar OCR pelo texto visível e acessível da página, com destaque azul e clique opcional;
- reconhecer uma imagem de referência na captura da aba, com destaque roxo e clique opcional;
- verificar o estado visual ativo ou desativado de um botão;
- usar uma referência visual quando o seletor de um bloco Chrome não responder;
- mostrar o elemento usado, o resultado de OCR/visual e o andamento de cada bloco.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactacao**.
4. Escolha esta pasta: `flowdetect_chrome`.
5. Fixe o icone do FlowDetect e clique nele para abrir o popup compacto.

Ao atualizar de uma versão anterior, aceite as novas permissões de captura de aba solicitadas pelo Chrome e recarregue a extensão. A captura vinculada à aba usa os recursos disponíveis a partir do Chrome 116; em versões mais antigas, o reconhecimento visual fica restrito à aba ativa.

Depois de atualizar a extensao, recarregue tambem a pagina da automacao para que o
destaque visual do OCR apareca sobre janelas modais ja abertas.

Para trocar um texto OCR antes da execucao, marque **Editavel na extensao** no alvo
correspondente no Studio, salve o mapa e envie/exporte a automacao novamente.
Abra **Textos OCR editaveis** no card da extensao e informe o novo texto. Apenas a
validacao dessa execucao muda; o ponto de clique e as rotas continuam configurados.
A imagem de referencia permanece como previa do texto original.

## Mapear um elemento da pagina

Abra a pagina desejada e clique no icone da extensao. Selecione **Mapear elemento da pagina**,
passe o mouse sobre o elemento e clique nele. O clique de selecao nao executa a acao do site.
Uma janela na propria pagina mostra um seletor CSS unico; clique em **Copiar seletor**.
No FlowDetect Studio, abra um bloco OCR, escolha **Chrome · elemento da pagina** e cole o
seletor no campo do elemento. Use **Escolher outro** para repetir ou Esc para cancelar.

O mapeador funciona em paginas HTTP/HTTPS e nao copia valores digitados nem o HTML inteiro.
Elementos dentro de Shadow DOM ou frames internos podem exigir outro alvo acessivel na pagina.

## Acompanhar a execucao

Durante a execucao, o popup mostra apenas o card compacto do bloco e a barra de
progresso. O carrossel faz uma transicao em flip quando o fluxo avanca. Se um
bloco falhar e tiver outro destino configurado, ele treme em vermelho antes de
mostrar o proximo bloco, sem atrasar a execucao. Ao parar ou terminar, o card
compacto permanece; **Automacoes** retorna a uma lista limpa, sem repetir o
card da execucao. As tres etapas mais recentes aparecem discretamente em
**Ao vivo**, logo abaixo do card. As setas
permitem revisar outros blocos; **Seguir execucao** volta
ao bloco atual. Referencias visuais e previews de OCR exportadas pelo Studio
aparecem no card. Blocos sem imagem mostram o texto ou a acao configurada.
Enquanto o popup estiver fechado, a porcentagem continua visivel no icone da
extensao, inclusive em outra aba. Ao concluir ou falhar, o Chrome mostra uma
notificacao. No card finalizado, **Gerar relatorio PDF** salva o resultado;
depois de abrir **Automacoes**, use **Ver ultima execucao** para voltar ao card
sem reiniciar o fluxo.
Para incluir novas previews em automacoes ja importadas, exporte o JSON novamente no Studio e
importe o novo arquivo na extensao.

## Enviar uma automacao do Studio

1. Abra a Biblioteca de automacoes no FlowDetect Studio.
2. Vire o card da automacao.
3. Clique em **Exportar para Chrome**.
4. No popup da extensao, clique em **+ Adicionar automacao** e selecione o arquivo `.json` criado.
5. Abra o site de destino e clique em **Executar**.

Para remover uma automacao armazenada na extensao, clique no botao **×** ao lado da quantidade de blocos e confirme a exclusao.
Quando a automacao possuir uma planilha, escolha no card o elemento que deve iniciar o loop. A extensao mostra os valores da coluna e pula os itens anteriores.

O Studio exporta os blocos web de URL, texto, tecla, OCR, reconhecimento visual, verificação de estado, planilha e marcadores de loop. As imagens de referência seguem dentro do próprio `.json`, portanto a extensão não depende da pasta `imagens` do computador que gerou a automação.

O OCR da extensão lê o texto que a página disponibiliza para o navegador, inclusive rótulos e conteúdos dinâmicos. O reconhecimento visual compara a imagem de referência com a aba escolhida ao iniciar a automação. A captura permanece vinculada a essa aba enquanto a execução estiver ativa, mesmo que outra aba receba o foco. Se o Chrome encerrar essa captura, a extensão aguarda a aba da automação ficar ativa antes de usar uma captura visível. Depois de dois minutos sem imagem da aba correta, ela encerra com um erro específico, sem tratar a captura de outra aba como resultado do bloco. Blocos que controlam programas Windows continuam no Studio, pois uma extensão não tem permissão para controlar outros aplicativos.

## Aguardar a tela correta antes de iniciar

No card da automacao, abra **Tela da automacao** e ative **Liberar somente na tela correta**.
Informe a URL da pagina e um texto visivel que identifique a tela inicial. O botao
**Usar aba atual** preenche a URL; clique em **Salvar** para guardar a configuracao.

A extensao identifica a aba atual e deixa **Executar automacao** desativado ate
confirmar a URL e o texto esperado. Trocar para uma aba incorreta bloqueia o
botao; voltar para a tela correta libera a execucao automaticamente. Nenhuma
execucao ou captura e iniciada enquanto o botao esta bloqueado. As condicoes
sao conferidas novamente ao clicar. Depois de iniciar, o fluxo pode mudar de tela.

A URL deve ter o mesmo dominio, caminho e rota apos `#`. Parametros apos `?`
sao ignorados. O texto e procurado no conteudo visivel da pagina. A configuracao
e individual por automacao e fica desativada por padrao nos fluxos existentes.

## Tempo entre destinos do OCR

No mapa do Studio, a indicacao de destino de cada OCR tem um campo em segundos,
inclusive para outro bloco em outra pagina. O caminho de encontrado e o de nao
encontrado podem ter tempos diferentes. Zero segue imediatamente. O intervalo
ocorre depois do reconhecimento/clique e antes do bloco de destino; pode ser
cancelado em **Parar execucao**. Salve o mapa e exporte novamente para o Chrome
para enviar esses tempos para a extensao.

## Formato do arquivo

Os arquivos novos usam o schema `flowdetect_chrome_automation`, versão `2`. A extensão também aceita os arquivos da versão `1` já exportados.
