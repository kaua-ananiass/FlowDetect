# Atualização do Studio — 4 de novembro de 2026

## Biblioteca de automações

- Cards verticais de 280 × 390 px, com cores da paleta do Flow por categoria.
- Indicadores de comandos, sequências, seções com blocos e execuções.
- Formulário compacto, botões alinhados e realce suave de foco; respeita movimento reduzido.

## Mapa dos comandos

- Visualização em árvore e menu transparente, com navegação pelo espaço vazio entre os controles.
- Criação de seção com opções mais claras para programas do computador e Chrome.
- Exclusão de seção com confirmação, animação breve, histórico e encerramento de referências removidas.
- Espaçamento calculado pela altura dos cards, preservando o posicionamento manual inicial durante a captura.
- Conexões simples pela lateral, ramificações com pontos separados e desvios ao redor dos cards e dos títulos das seções.
- Rótulos compactos, com texto e tempo na mesma linha e trajeto alinhado ao centro.
- Reorganização automática das ligações. Arraste de seção e controles manuais de curvas não fazem parte desta versão; layouts antigos do arraste de seção são limpos ao abrir.

## Importação do Chrome

O mapa aceita também JSONs `flowdetect_chrome_automation`, além dos projetos originais do Studio. Recupera os tipos compatíveis como blocos editáveis, ajusta referências, copia imagens incorporadas e cria uma planilha própria para os valores e linhas exportados. A seção recuperada usa o motor Chrome.

Tipos não suportados são recusados sem importar parte do fluxo. Configurações que não foram incluídas no JSON da extensão continuam exigindo o projeto original do Studio. A recuperação preserva a opção de reconhecer sem clicar.

## Validação

- Suíte Node completa: 193 testes.
- Suíte Python selecionada: 35 testes de mapa, exportação Chrome, identidade de blocos, importação no Python incorporado e recursos do runtime.
- Auditoria estática: 125 referências de recursos, sem itens obrigatórios faltando.
- Verificações no navegador de arraste, redimensionamento, captura, alinhamento de ligações, exclusão e formulário responsivo.
- Importação e reexportação de um JSON Chrome com 15 blocos, em pasta temporária, sem diferenças nos campos de execução comparados.

Esta validação não executou uma rotina real no Alterdata nem em um site de produção. Não foram gerados instaladores ou uma nova release nesta atualização.
