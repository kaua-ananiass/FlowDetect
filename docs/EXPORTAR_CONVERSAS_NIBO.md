# Exportar conversas do Nibo Contador

## Execução semanal com confirmação (Windows)

O modo semanal é **local e opt-in**: uma tarefa do Windows mostra a pergunta “Deseja baixar as conversas do Nibo atualizadas nesta semana?”. Se você escolher **Não**, nada é aberto. Se escolher **Sim**, o Chrome roda sem janela e salva o CSV, o controle e as conversas na pasta escolhida. O computador precisa estar ligado e a sua sessão do Windows precisa estar conectada para a pergunta aparecer. A tarefa pode despertar o PC suspenso, mas não ligar um PC desligado.

Requisitos: Windows, Chrome instalado e Node.js 20 ou mais recente. Antes de agendar, abra PowerShell na pasta deste projeto e execute:

```powershell
.\scripts\nibo_configurar.ps1
node .\scripts\nibo_automatico.mjs rodar
.\scripts\nibo_agendar.ps1 -Dia Monday -Hora '09:00'
```

Na configuração, escolha uma pasta **privada**. Se quiser aproveitar arquivos já baixados, escolha a pasta que contém diretamente as subpastas `Nibo_Conversas_*`. Faça login na janela do Chrome aberta para a automação e, na etapa de calibração, clique uma vez no comando que exporta o CSV da lista de Atendimento. Se houver um submenu, clique também na opção CSV. O programa registra esses cliques para repeti-los nas semanas seguintes; não guarda senha. O perfil do Chrome e a configuração ficam em `%LOCALAPPDATA%\FlowDetect\Nibo`, separados do seu Chrome normal. Não compartilhe essa pasta: a sessão autenticada é sensível.

O teste `rodar` deve ser feito **antes** de registrar o agendamento. Confira `relatorios_nibo/execucao_*.json`, o CSV em `relatorios_nibo/`, e o `controle.csv` da pasta `Nibo_Conversas_*`. O modo semanal usa a coluna **Atualizado em** do CSV: na primeira vez considera os últimos sete dias, arredondados para o início do dia; nas próximas, considera desde a última execução concluída. Assim, uma semana sem execução não se perde. IDs sem data válida ficam fora e são contados no relatório. Para não repetir downloads, ele só pula um ID se a versão com a mesma data de atualização já tiver `complete: true` e os arquivos JSON/HTML existirem. Uma conversa atualizada depois volta à fila. Execuções com pendências não avançam o início do período. Cada execução mantém seu próprio checkpoint do Snippet, permitindo retomada mesmo se o processo for interrompido.

Se a sessão do Nibo expirar, rode `node .\scripts\nibo_automatico.mjs login` novamente. Se o Nibo mudar o botão de exportação, rode `node .\scripts\nibo_automatico.mjs calibrar` novamente. O relatório de falha inclui uma captura de tela na pasta escolhida para diagnóstico. O caminho de exportação depende da interface real do Nibo e **precisa ser validado em uma execução assistida**; não considere o agendamento confiável antes desse teste. A tarefa agendada é chamada `FlowDetect - Nibo conversas semanal` no Agendador do Windows.

O CSV reflete os filtros que o Nibo aplicar à lista no momento da exportação. Na calibração e no primeiro teste, confira se os responsáveis e status desejados aparecem e compare o total de IDs do CSV com o esperado. O programa não consegue detectar uma conversa que o Nibo omitiu do relatório. Capturas de erro e arquivos exportados podem conter dados de clientes; mantenha a pasta de destino com acesso restrito.

Ao atualizar o Snippet, recarregue a aba do Nibo antes de executar o código novo. O painel antigo permanece ativo até a recarga.

Se um ID falhar, confira a coluna **Erro** em `controle.csv`; `resultado.json` reúne o estado ao final da execução. Os erros de calendário e notificações no console podem ser independentes da exportação.

O checkpoint agora tem `controle.json`, `controle.reserva.json` e `controle.csv`. A cada gravação, o Snippet confere o JSON salvo. Ao retomar, escolhe a cópia válida mais recente; se os JSONs estiverem danificados, reconstrói o controle pelo CSV sem reiniciar os IDs já marcados como `OK`. Se nenhuma cópia for válida, ele para e preserva os arquivos existentes para revisão.

Para conversas longas, o exportador continua carregando mensagens antigas até encontrar o evento **Atendimento criado**. Confira `historyComplete: true` no JSON antes de considerar o histórico integral. Se o Nibo parar de carregar novas mensagens por 30 segundos ou a execução ultrapassar 30 minutos, o arquivo parcial é salvo com `historyComplete: false` e `ok: false` no `resultado.json`. `mediaComplete` indica separadamente se todos os anexos acessíveis foram baixados.

Para retestar apenas um atendimento longo, preencha **Somente estes IDs** com o número do CSV, por exemplo `260526-007`. Nesse caso o campo de máximo é ignorado.

O script `scripts/nibo_exportar_conversas.js` roda **na aba autenticada do Nibo Contador**. Ele lê um CSV com coluna `ID`, pesquisa cada atendimento pela própria interface, abre o detalhe, percorre o histórico visível e salva JSON e HTML em uma pasta escolhida pelo usuário. Os nomes seguem `AAAA-MM-DD__Cliente__Responsavel__ID`, e os mesmos dados aparecem no cabeçalho do HTML e em `metadata` no JSON. A data vem do evento de abertura; se ele não estiver disponível, usa a última atualização do CSV e identifica essa origem. Áudios, imagens e links de arquivo acessíveis pelo navegador são tentados em `midias/`. Um `resultado.json` registra sucessos, falhas, nomes dos arquivos e itens que precisam de revisão.

## Como executar

1. Abra `https://contador.nibo.com.br/spa/Relationship/ServiceDeskRequest` e deixe a lista de Atendimento visível. Faça login normalmente; o script não pede nem armazena senha ou token.
2. No Chrome, abra DevTools (`F12`) → **Sources** → **Snippets** → **New snippet**.
3. Copie todo o conteúdo de `scripts/nibo_exportar_conversas.js` para o Snippet e execute-o (`Ctrl+Enter`). Um painel aparecerá no canto superior direito da página.
4. Selecione o CSV exportado do Nibo. O arquivo é lido somente no navegador; não é copiado para o repositório.
5. Escolha uma pasta local de destino. Deixe **Máximo nesta execução = 1** e clique em **Iniciar exportação** para validar o primeiro atendimento. O script cria uma subpasta estável `Nibo_Conversas_<quantidade>_<identificador do CSV>`.
6. Acompanhe o resumo e os últimos atendimentos no painel do Snippet. A lista mostra cada `OK`, `INCOMPLETO` ou `ERRO` assim que o ID termina. Na subpasta, `controle.csv` continua sendo atualizado após cada atendimento, com uma linha por ID: `PENDENTE`, `EM_ANDAMENTO`, `OK`, `INCOMPLETO` ou `ERRO`. `OK` confirma o histórico desde a abertura; a coluna **Mídias completas** é independente.
7. Para continuar, use **o mesmo CSV e a mesma pasta de destino** e ajuste o máximo para o total de IDs. O script reencontra a subpasta, pula os `OK` cujos arquivos ainda existem e tenta novamente os demais. Cada nova tentativa conserva os arquivos anteriores com um sufixo `tentativa_N`.

## Limites e conferência

- A navegação foi conferida em uma sessão real do Nibo; um lote com milhares de atendimentos ainda precisa ser validado na prática. Mantenha a aba aberta e confira periodicamente `controle.csv`.
- Se o Nibo alterar o layout, algum ID pode falhar. O exportador confirma o número do atendimento no detalhe antes de gravar, para não associar a conversa errada ao ID.
- `historyComplete: false` significa que a abertura não foi encontrada. `mediaComplete: false` indica mídias pendentes; `complete` só é verdadeiro quando ambos são verdadeiros. Não use um arquivo parcial como cópia integral sem revisão.
- Links externos, mídias sem URL utilizável e comentários ocultos pela permissão da conta não podem ser reconstruídos pelo HTML. O exportador só acessa dados que a sessão autenticada apresenta.
- Os arquivos podem conter nomes, contatos e mensagens de clientes. Guarde a pasta em local com acesso restrito; não a inclua em commits ou em pastas públicas.
- `controle.xlsx`, quando gerado a partir do CSV, é uma cópia do momento da conversão. Se estiver aberto no Excel, ele não recebe automaticamente as alterações posteriores de `controle.csv`. Para ver os novos OK sem atualizar a planilha, use o painel do Snippet; para uma nova cópia em Excel, converta novamente o CSV atualizado.
