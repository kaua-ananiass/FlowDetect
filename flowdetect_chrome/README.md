# FlowDetect para Chrome

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

## Enviar uma automacao do Studio

1. Abra a Biblioteca de automacoes no FlowDetect Studio.
2. Vire o card da automacao.
3. Clique em **Exportar para Chrome**.
4. No popup da extensao, clique em **+ Adicionar automacao** e selecione o arquivo `.json` criado.
5. Abra o site de destino e clique em **Executar**.

Para remover uma automacao armazenada na extensao, clique no botao **×** ao lado da quantidade de blocos e confirme a exclusao.
Quando a automacao possuir uma planilha, escolha no card o elemento que deve iniciar o loop. A extensao mostra os valores da coluna e pula os itens anteriores.

O Studio exporta os blocos web de URL, Chrome/Web, texto, tecla, clique, OCR, reconhecimento visual, verificação de estado e marcadores de loop. As imagens de referência seguem dentro do próprio `.json`, portanto a extensão não depende da pasta `imagens` do computador que gerou a automação.

O OCR da extensão lê o texto que a página disponibiliza para o navegador, inclusive rótulos e conteúdos dinâmicos. O reconhecimento visual compara a imagem de referência com a aba escolhida ao iniciar a automação. A captura permanece vinculada a essa aba enquanto a execução estiver ativa, mesmo que outra aba receba o foco. Se o Chrome encerrar essa captura, a extensão aguarda a aba da automação ficar ativa antes de usar uma captura visível. Depois de dois minutos sem imagem da aba correta, ela encerra com um erro específico, sem tratar a captura de outra aba como resultado do bloco. Blocos que controlam programas Windows continuam no Studio, pois uma extensão não tem permissão para controlar outros aplicativos.

## Formato do arquivo

Os arquivos novos usam o schema `flowdetect_chrome_automation`, versão `2`. A extensão também aceita os arquivos da versão `1` já exportados.
