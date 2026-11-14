# Google Sheets e Google Drive no Studio

A conexão fica em **Planilha e dados → Google Sheets e Drive**. O login é feito no navegador padrão. Senhas não são digitadas no FlowDetect; as credenciais da conexão ficam criptografadas pelo Windows no perfil local do usuário, fora dos roteiros exportados.

## Configuração inicial do Google Cloud

1. Abra [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto chamado **FlowDetect**.
2. Em **APIs e serviços → Biblioteca**, habilite **Google Sheets API** e **Google Drive API**.
3. Abra **Google Auth Platform**. Configure o nome do aplicativo, o e-mail de suporte e o contato do desenvolvedor.
4. Em **Público-alvo**, escolha **Externo** se for usar contas pessoais. Enquanto estiver em teste, adicione seu e-mail em **Usuários de teste**. Para usar outra conta, adicione-a também.
5. Em **Acesso a dados**, adicione estes escopos:
   - `https://www.googleapis.com/auth/spreadsheets` — ler e editar planilhas, inclusive as existentes informadas por link.
   - `https://www.googleapis.com/auth/drive.file` — criar e usar os arquivos do aplicativo, sem acesso geral ao Drive.
6. Em **Clientes → Criar cliente**, escolha **App para computador**. Baixe o JSON. Não escolha Aplicativo da Web; não precisa cadastrar URL de redirecionamento manualmente para esse cliente desktop.
7. No Studio, abra **Primeira conexão?**, clique em **Importar JSON do Google Cloud** e selecione o arquivo baixado.
8. Clique em **Conectar Google**, escolha a conta no navegador e conceda as duas permissões solicitadas. Volte ao Studio quando concluir.

O cliente usa OAuth com PKCE e retorno em `127.0.0.1`, numa porta temporária. A configuração é feita uma vez por instalação; a autorização pertence à conta conectada. **Trocar conta Google** abre uma nova autorização; não mistura os tokens da conta anterior com a nova.

O modo de teste do Google pode expirar o refresh token após sete dias para estes escopos. Para distribuir o FlowDetect a outras pessoas, publique o consentimento e siga a verificação exigida pelo Google para o escopo de Sheets. Não distribua a sua conexão pessoal nem o arquivo `connection.dat`.

## Usar uma planilha

1. Cole o link do Google Sheets no campo do Studio.
2. Clique em **Trazer planilha**. As abas e valores são importados para `planilhas/Google-<id>.xlsx`.
3. Use essa planilha nos blocos existentes de leitura, loop e escrita em célula.
4. Após a execução, clique em **Enviar resultados** usando o mesmo link.

Os blocos trabalham na cópia local. Trazer novamente substitui essa cópia; envie primeiro as alterações que quiser preservar.

### Sincronização automática

Depois de trazer a planilha, clique em **Ativar sincronização automática**. Enquanto o Studio estiver aberto, ele verifica a planilha a cada cinco segundos após o término da consulta anterior. O botão **Pausar sincronização automática** interrompe as próximas consultas; uma operação que já começou pode terminar.

- Alterações do Google entram na cópia local e na prévia. Resultados locais são enviados ao Google.
- Mudanças em células diferentes são combinadas. Mudanças diferentes na mesma célula pausam a sincronização, com a célula indicada na mensagem.
- Durante uma execução detectada pelo Studio, a sincronização espera. Ela retoma depois do término e envia os resultados, preservando os itens do loop em andamento.
- A aba e a posição de rolagem da prévia são preservadas. Se você estiver olhando outra planilha, ela continua selecionada.
- Alterar o link, trocar a conta, usar uma operação manual ou fechar o Studio desativa a sincronização. Ao reabrir, ative-a novamente.
- Falhas de rede, arquivos bloqueados e alterações na estrutura das abas pausam a sincronização para você conferir antes de reativar.

Execuções iniciadas por outros programas, Excel, Chrome ou Agents que não informem seu estado ao Studio não têm pausa de execução garantida. Evite editar a cópia local por fora durante uma sincronização. A verificação de alterações locais reduz o risco de sobrescrita, mas não constitui um bloqueio compartilhado entre processos.

O envio altera somente as células modificadas em relação à importação. Se outra pessoa modificou a mesma célula no Google, o Studio interrompe o envio e informa o conflito. A verificação não é um bloqueio colaborativo: uma edição simultânea entre a leitura e o envio ainda pode concorrer com a operação. Formatação, gráficos, validações, linhas e colunas da planilha Google não são reconstruídos. Abas locais novas não são enviadas. Valores e fórmulas são suportados; outros tipos complexos podem exigir ajuste. Limite de importação: dois milhões de células alocadas.

## Salvar arquivos no Drive

Clique em **Escolher arquivo e enviar** e selecione um PDF, relatório, planilha ou outro arquivo. O Studio cria uma pasta **FlowDetect** na conta conectada e envia o arquivo para ela. Cada envio cria um novo arquivo, sem apagar a cópia local. O link de acesso aparece após concluir.

O envio é iniciado pelo usuário, não por um bloco automático. A pasta é própria do aplicativo; esta versão não navega por todas as pastas do Drive nem permite informar uma pasta arbitrária.

## Desconectar e erros

**Desconectar** remove a sessão salva neste computador. Para revogar o acesso também no Google, use [Conexões da Conta Google](https://myaccount.google.com/connections). Arquivos enviados são preservados.

- Acesso recusado: confira as APIs habilitadas, os usuários de teste, as permissões concedidas e se a conta tem acesso à planilha.
- Sessão expirada: conecte novamente.
- Conflito: preserve a cópia local, confira a célula indicada e concilie as alterações antes de trazer novamente.
- Falha de envio: confira no Drive antes de tentar novamente, pois uma interrupção de rede após a gravação pode ter concluído o arquivo sem retornar a confirmação ao Studio.

Referências oficiais: [OAuth desktop](https://developers.google.com/identity/protocols/oauth2/native-app), [expiração em modo de teste](https://developers.google.com/identity/protocols/oauth2), [escopos Sheets](https://developers.google.com/workspace/sheets/api/scopes), [uploads Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
