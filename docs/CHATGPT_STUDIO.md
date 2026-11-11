# Criar com ChatGPT no Studio (uso local, beta)

Em **Chat IA → FlowDetect Chat**, clique em **Continue with ChatGPT**. O login abre o navegador oficial, solicita autorização de uso do plano e retorna para o Studio. O ícone de configurações permite selecionar um modelo, gerenciar uso e desconectar.

No campo de mensagem, **Conversar** responde dúvidas. **Criar fluxo** conduz a construção por etapas: o assistente pergunta o que falta, mostra os blocos e explica como configurar. **Gerar proposta** prepara um conjunto de blocos para adicionar de uma vez. Envie pela seta ou por Enter; Shift+Enter insere uma nova linha.

Na criação guiada, use **Criar bloco no Studio** para salvar cada etapa na seção do trabalho. Texto, URL e teclas podem ser alterados no cartão e salvos no bloco real. Para imagens/OCR e tabelas, **Configurar bloco no Studio** abre o editor completo e mantém uma orientação visível, por exemplo: abrir a tela da guia no Chrome, capturar o botão e escolher a ação desejada.

Depois de configurar, clique em **Voltar ao chat e conferir**. O assistente lê a configuração salva e aponta campos ausentes. **Campos configurados** não significa que a automação foi testada. O início da execução continua sendo uma ação sua. O assistente navega entre as áreas permitidas do Studio, mas não enxerga ou controla o Chrome automaticamente.

Thinking Orb indica a atividade e a chegada do texto; o Halftone Orb fornecido compõe a apresentação. As respostas são exibidas como mensagens com formatação e opção de copiar. **Nova conversa** abre um trabalho separado, preservando os anteriores no histórico lateral. Você pode buscar, renomear, excluir e desfazer a exclusão de uma conversa.

Mensagens, rascunhos e propostas ficam salvos neste computador, inclusive depois de fechar o Studio. Cada conversa mantém seu próprio contexto. Ao retomar um chat ligado a outra automação, use **Abrir automação** para continuar no mapa correspondente. A interface ocupa toda a área disponível e o histórico pode ser recolhido pelo ícone lateral. Os detalhes técnicos e caminhos dos componentes estão em `CHATGPT_COMPONENTES.md`.

A seção criada fica separada das etapas existentes. No mapa, revise e conecte sua entrada ao fluxo ou defina essa seção como início antes de executar. O botão **Criar com ChatGPT** no mapa também abre a integração.

Contas Plus/Pro elegíveis podem usar a autorização de plano sem cadastrar uma chave de API. Limites e acesso dependem da conta. Esta integração é destinada ao aplicativo local; distribuição comercial ou serviço hospedado exige verificar a modalidade oficial apropriada.

Se aparecer `subscription_sharing_usage_limit_exceeded`, a OpenAI confirmou um limite de uso do plano compartilhado com aplicativos. Use **Gerenciar uso no ChatGPT** para conferir o limite do FlowDetect e a disponibilidade do plano. O código pode indicar um limite específico do aplicativo; não confirma que toda a assinatura acabou e não informa, sozinho, quando o uso será liberado. A integração não repete a solicitação automaticamente nem muda para cobrança por chave de API. Uma tarefa curta também pode ser recusada se o limite já foi alcançado.

Falhas agora mostram o evento, código, parâmetro, motivo de interrupção e identificador da solicitação, quando fornecidos pela OpenAI. Uma resposta interrompida por tamanho (`max_output_tokens`) é distinguida de uma restrição de uso do plano.

## O que esta versão gera

- Reaproveita blocos mapeados na automação aberta, incluindo tabelas, reconhecimento e botões.
- Cria blocos de texto, teclas, navegação HTTP(S) e loops de tabelas.
- Mostra perguntas quando faltar um alvo ou informação necessária. Responda na descrição ou mapeie no Studio e gere novamente.
- Adiciona os blocos em uma seção separada. As rotas da proposta são lineares; não copia desvios dos blocos originais.
- Recusa propostas se o mapa tiver mudado desde a geração, referências inexistentes, código arbitrário, URLs com credenciais e loops incompletos.

O contexto enviado contém tipos/títulos dos blocos, nomes de colunas, variáveis de tabela e âncoras OCR. Na criação guiada, o plano editado também acompanha a mensagem, incluindo textos, endereços e teclas dos cartões. Não envia linhas de planilha, valores capturados ou imagens automaticamente. O texto que você escrever e os nomes/âncoras dos mapeamentos são enviados à OpenAI. Não coloque senhas na descrição.

## Demonstração no Chrome

É possível evoluir para **Gravar demonstração → revisar ações → gerar fluxo**. A extensão registrará explicitamente cliques, navegações, alvos DOM e estruturas de tabelas; a IA poderá propor loops e variáveis. O usuário precisará indicar os trechos que devem repetir, e diferenças de empresa serão verificadas antes de executar. O login não acompanha o navegador sozinho. A gravação de demonstração para esta integração ainda não está implementada nesta versão.

## Implementação e validação

O backend Rust implementa OAuth com PKCE/S256, state/nonce por tentativa, callback somente em 127.0.0.1, verificação de assinatura/issuer/audience/expiração do ID token, renovação serializada e revogação ao sair. No Windows, credenciais ficam no app_data do Studio em arquivo protegido por DPAPI, fora do projeto e da interface. O ID desta instalação persiste ao desconectar. Não lê cookies ou tokens de outros aplicativos.

Requests usam Responses com `store:false` e `stream:true`; só respostas com `response.completed` podem virar propostas. A UI nunca recebe credenciais. O Python compila os dados da proposta usando os construtores existentes e valida novamente antes de salvar.

Testes locais não substituem a validação real do login/limites de uma conta. Nenhum login real é considerado validado até concluir autorização e uma geração na conta do usuário.

Fontes oficiais:

- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
