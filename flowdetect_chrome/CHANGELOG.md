# Histórico de versões

## 0.2.96 — pacote da release FlowDetect 4.0.0

- Versões da extensão e da ponte local alinhadas para o Studio 4.0.0.
- Inclui os recursos de tabelas, execução assistida, OCR e transferência do Studio consolidados na versão anterior.
- ZIP preparado diretamente dos arquivos de distribuição, sem dados de execução ou automações pessoais.

## 0.2.76–0.2.95 — consolidação de 11/11/2026

- Mapeamento de tabelas e botões por estrutura, com percurso por todas as linhas e páginas.
- Captura da tabela interna, retorno à lista e consolidação dos resultados em planilha.
- Diagnósticos de falhas por etapa e guia; integração com variáveis OCR.
- Correções de localização de botões, tabelas repetidas e retorno de detalhes.
- As alterações do período estão consolidadas nesta branch; nenhum ZIP é gerado por esta publicação.

## 0.2.75 — 06/11/2026

- Teste geral confirma os OCRs e lê a variável usando a mesma âncora do OCR 1.
- Resultado e destaque de variável em amarelo, com o valor encontrado.
- Removida a busca duplicada que rejeitava uma referência já confirmada pelo OCR.


## 0.2.74 — 06/11/2026

- Área Variável posicionada e redimensionada diretamente na imagem do bloco OCR.
- Leitura da região acompanha a referência e sua escala na execução.
- Compatibilidade com as variáveis configuradas antes do editor visual.

## 0.2.73 — 06/11/2026

- Captura de valores ao lado de uma referência OCR, com variáveis de texto, número, dinheiro ou data.
- Teste de captura sem cliques e rejeição de leituras vazias ou ambíguas.
- Valores disponíveis para os próximos blocos e para o desktop ao retornar de uma seção Chrome do mapa.
- Limpeza das capturas entre linhas do loop para evitar reutilizar dados de outra empresa.

## 0.2.72 — 03/11/2026

- Caminhos Chrome podem ser chamados pela árvore do mapa no Agente e devolver o fluxo ao bloco desktop indicado.
- Confirmação da execução antes de retomar o mapa, com parada em caso de perda de comunicação.
- As rotas internas continuam no Chrome; somente destinos externos declarados retornam ao executor desktop.

## 0.2.71 — 03/11/2026

- Comandos de encadeamento permitem iniciar, acompanhar e parar um fluxo Chrome pelo agente dedicado.
- Reserva das páginas durante o encadeamento para impedir outra execução ou troca de vínculo.
- Validação da aba, URL esperada e ponto de entrada antes de iniciar a etapa web.
- Variáveis compartilhadas com o processo desktop e confirmação pelo identificador de execução.
- Perda de confirmação exige conferência; a rotina não é repetida automaticamente.

## 0.2.70 — 27/10/2026

- Botão Desvincular libera a página sem fechar a aba ou excluir automações.
- Destaques de OCR acompanham a cor da página em execução, inclusive em paralelo.
- Bloqueio opcional de interação manual por página, com liberação automática e atalho Ctrl+Alt+Shift+L.
- Versões da ponte do Studio, popup e scripts alinhadas para corrigir a conexão por código.
- Inclui testes de navegador para bloqueio, cores, vínculo e inicialização da extensão.

## 0.2.69 — 26/10/2026

- Tema do painel acompanha a cor da página selecionada.
- Seção Páginas simplificada, sem moldura e com espaçamentos reduzidos.
- Inclui a correção de execução assistida antiga da versão 0.2.68.

## 0.2.68 — 26/10/2026

- Execuções assistidas deixam de exibir execuções encerradas de automações removidas da página.
- Relatórios salvos são preservados; execuções ativas continuam com monitoramento e controle de parada.

## 0.2.67 — 26/10/2026

- Imagens de referência exibidas inteiras e proporcionais na execução assistida.
- Cabeçalho do bloco compacto para dar mais espaço à imagem.
- Retiradas as linhas extras de título/página e o atalho que abria o histórico em outra guia.
- Botão Mapear ao lado de Importar, liberando a linha superior.
- Etapas recentes e controles de execução mantidos no painel compacto.

## 0.2.66 — 26/10/2026

- Removida a configuração legada de “Tela inicial”.
- Fluxos importados com essa configuração deixam de ser bloqueados por ela.
- Downloads passam a usar a pasta configurada nativamente no Chrome.
- Painel de configuração reorganizado para leitura e interação em popup compacto.
