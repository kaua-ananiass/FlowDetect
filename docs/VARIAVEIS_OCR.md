# Capturar variáveis no OCR

No Mapa dos comandos, abra um bloco de reconhecimento OCR, entre na aba
**Variável** e ative **Salvar uma informação**.

1. Na aba Busca, configure o texto conhecido que aparece antes do valor, por
   exemplo **Valor total da nota**. Não informe o valor desconhecido como texto alvo.
   A imagem de referência deve mostrar o texto estável e a região do valor.
   Posicione o primeiro marcador OCR sobre o texto estável.
2. Em Variável, dê um nome, como `valor_nota`, escolha **Dinheiro**, **Número**,
   **Data** ou **Texto**.
3. Arraste o retângulo dourado **Variável** sobre o valor na imagem. Use os quatro
   cantos para redimensionar. Não é necessário escolher direção nem digitar pixels.
   A posição salva é relativa à imagem e ao primeiro OCR de referência; a região
   acompanha a referência na execução, incluindo mudanças de escala.
4. Para OCR local, deixe a tela desejada aberta e use **Testar na tela**. O Studio
   minimiza durante o teste, localiza a referência por OCR e retorna o valor da
   área marcada. Não precisa da extensão nem do Chrome. Para texto HTML, use
   **Testar no Chrome**, com a extensão conectada e a aba desejada ativa.
   Os testes só leem e destacam a região; não clicam, não preenchem campos e
   não gravam valores na automação. O resultado aparece como
   `Encontrado: 84,67 → {{Valor_DOC}}`. Uma leitura inválida mostra também o texto
   bruto, quando disponível, para ajudar a reposicionar a área.
5. Salve o bloco. A seção **Variáveis**, no canto do mapa, lista as definições de
   todas as páginas da automação. Clique em um card para copiar `{{valor_nota}}`.
6. Cole esse token no bloco Texto livre ou em um campo que já aceita variáveis,
   como o preenchimento UI Automation. Durante a execução, o token vira o valor lido.

## Validação e execução

- Dinheiro usa o padrão brasileiro: `R$ 1.250,90` vira `1250,90`, sem separador de
  milhar. A região deve conter um único valor monetário com duas casas decimais.
- Data exige uma data válida no formato `DD/MM/AAAA`.
- Número exige um único número; Texto guarda o conteúdo não vazio da região.
- Uma leitura vazia, inválida ou ambígua segue a saída de falha configurada no OCR.
  O valor anterior da variável é removido antes da nova captura.
- A captura ocorre antes do clique do alvo. Ela não exige conhecer o valor antes.
- Cada linha/empresa do loop começa sem as capturas anteriores. Se um preenchimento
  tentar usar uma variável declarada que ainda não foi capturada, a execução falha
  em vez de inserir um valor antigo.
- O modo Atual usa OCR de uma região da tela. O modo Chrome lê texto e valores de
  elementos HTML na região. Conteúdo desenhado em canvas ou somente em imagem deve
  usar o modo Atual. Esta primeira versão não captura por seletor CSS ou modo Visual.

## Chrome e agente

A extensão necessária para esta implementação é **0.2.75**. Recarregue a extensão
e a página do site após atualizar. Reinicie também o Studio/Agent com o código
atualizado; o instalador 3.1.1 gerado anteriormente não inclui esta implementação.

Em seções Chrome do mapa executadas no agente, as variáveis capturadas retornam ao
executor desktop depois da conclusão bem-sucedida da seção. Assim, um bloco do
Alterdata pode usar o valor obtido no portal. Isso não transforma automaticamente
processos independentes em uma única execução: os blocos precisam pertencer ao
mesmo fluxo do mapa. Valide primeiro com uma automação de teste, sem gravar operações
reais no Alterdata.


## Teste conjunto

O teste geral do reconhecimento inclui a variável ativada. O OCR 1 confirma a
referência uma vez; essa mesma caixa determina a posição da região amarela,
sem uma segunda busca independente pela âncora. O painel mostra os OCRs e
“Variável encontrada” em amarelo com o valor lido. Os atalhos de teste na
configuração da variável abrem esse mesmo teste conjunto. Se a região contiver
mais de um valor, ajuste o retângulo amarelo; o OCR pode continuar confirmado.


## Confirmação e desempenho

- **Só confirmar** valida o OCR sem clicar. O marcador de clique fica oculto
  na imagem dessa configuração; a captura da variável continua funcionando.
- No teste local, OCR e variável usam o mesmo desenho e aparecem em sequência:
  primeiro azul, depois amarelo. As marcações só começam após terminar as leituras.
- A referência é calibrada pelo texto na imagem salva para não confundir a margem
  do retângulo do editor com a caixa real das letras.
- As quatro leituras de conferência são mantidas, com até dois processos OCR
  simultâneos. O ganho medido depende do processador e do conteúdo da tela.

No bloco **Texto livre**, a biblioteca **Inserir variável** insere `{{valor_nota}}`
na posição do cursor e substitui o trecho selecionado. Salve o bloco após editar.
