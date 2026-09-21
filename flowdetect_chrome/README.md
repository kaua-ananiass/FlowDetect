# FlowDetect para Chrome

Primeira versao da extensao que executa automacoes web exportadas pelo FlowDetect Studio na aba atual do Chrome.

## O que ela executa

- abrir URL na aba atual;
- esperar texto presente na pagina;
- localizar elementos por CSS, id, name, placeholder, aria-label, texto ou XPath;
- clicar, preencher campos, limpar campos, selecionar opcoes e marcar checkbox;
- mostrar o elemento usado em cada etapa;
- registrar o andamento e mostrar um preview da aba.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactacao**.
4. Escolha esta pasta: `flowdetect_chrome`.
5. Fixe o icone do FlowDetect e clique nele para abrir o painel lateral.

## Enviar uma automacao do Studio

1. Abra a Biblioteca de automacoes no FlowDetect Studio.
2. Vire o card da automacao.
3. Clique em **Enviar ao Chrome**.
4. No painel da extensao, clique em **Importar do Studio** e selecione o arquivo `.json` criado.
5. Abra o site de destino e clique em **Executar nesta aba**.

O Studio exporta os blocos `Abrir URL`, `Chrome/Web` e `OCR` que possuem texto. Nesta primeira versao, o OCR e convertido em espera pelo texto do DOM da pagina. OCR de imagem e reconhecimento visual serao adicionados como fallback visual em uma proxima versao.

## Formato do arquivo

Os arquivos exportados usam o schema `flowdetect_chrome_automation`, versao `1`. A extensao importa somente esse formato para evitar executar arquivos desconhecidos.
