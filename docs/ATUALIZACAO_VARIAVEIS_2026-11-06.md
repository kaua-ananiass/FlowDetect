# Variáveis OCR e texto dinâmico

O reconhecimento pode capturar um valor desconhecido em uma área marcada na
imagem e disponibilizá-lo aos próximos blocos como `{{valor_nota}}`.

## Novidades

- Editor visual da variável no bloco OCR, com posição e tamanho ajustáveis.
- Leitura de dinheiro, número, data ou texto a partir da âncora confirmada.
- Teste conjunto com indicação do valor, sem clicar ou preencher o sistema alvo.
- Biblioteca **Inserir variável** no bloco de texto, com inserção no cursor.
- **Só confirmar** respeita a ausência de clique e oculta o marcador na imagem.
- Valores acompanham o fluxo entre Chrome e desktop e são limpos entre linhas.
- Destaques azul e amarelo usam o mesmo desenho e aparecem em sequência.
- Conferências OCR em paralelo com limite de dois processos.
- Correções do início e pareamento do Agent no computador dedicado.

## Versões e instalação

Studio: **3.1.1**, Windows x64, instalador NSIS recompilado com esta atualização.
Extensão Chrome: **0.2.75**. Atualize a extensão e recarregue as abas do navegador.
O instalador antigo com o mesmo número não contém estas mudanças.

O instalador usa os recursos de distribuição já presentes na `main`, incluindo
Python, wheels, Tesseract e automações iniciais. Capturas pessoais, planilhas,
sessões, credenciais e automações de teste deste computador não são publicadas.

## Validação

- Auditoria: 128 referências verificadas, sem arquivo ausente.
- Python: 108 testes passaram, incluindo OCR real da imagem de referência.
- Interface e extensão: 53 testes passaram, incluindo inserir no cursor,
  captura de variável, fluxo entre ambientes e pareamento do Agent.
- Compilação e informações do NSIS constam no manifesto que acompanha o artefato.

Os testes não substituem a homologação de instalação em um Windows limpo e a
conferência do fluxo nos sistemas de terceiros utilizados pelo escritório.
