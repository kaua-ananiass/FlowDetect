# Chat do FlowDetect

A interface está em `tauri_gerador/components/flow-chat.tsx`. Ela funciona como uma área React dentro do Studio existente, sem migrar as demais telas de JavaScript. A entrada é `chatgpt-entry.tsx`; o adaptador usado pelo Studio continua em `web/chatgpt.js`.

## Componentes recebidos

- `components/ui/thinking-orbs.tsx`: wrapper do componente `thinking-orbs`, usado no avatar e nos estados de atividade reais da resposta.
- `components/ui/halftone-orb.tsx`: componente do arquivo fornecido pelo usuário, usado na apresentação do chat.
- Os dois exemplos estão em `components/ui/*-demo.tsx` para desenvolvimento, sem painéis de demonstração ou simulação de voz na interface do produto.

O diretório `components/ui` centraliza componentes reutilizáveis e é reconhecido pelo `components.json` do shadcn. O alias `@/components/ui` aponta para essa pasta. Componentes específicos do produto, como a conversa, ficam em `components/`, fora do catálogo de componentes básicos.

## Desenvolvimento

O projeto agora inclui React, TypeScript, Tailwind v4, estrutura shadcn, Lucide e os componentes solicitados. Na pasta `tauri_gerador`:

```powershell
npm ci
npm run chat:check
npm run chat:build
npm run tauri:dev
```

`chat:build` compila o TypeScript/React com esbuild para `web/chatgpt-react.js` e gera as utilidades Tailwind em `web/chatgpt-react.css`. Os scripts Tauri de desenvolvimento e build executam essa etapa automaticamente. Os arquivos compilados são recursos locais, sem CDN e sem necessidade de conexão para renderizar os componentes.

Para adicionar componentes shadcn compatíveis, o projeto já está configurado:

```powershell
npx shadcn@latest add button
```

Não é necessário executar novamente `shadcn init`. Em um projeto novo, `npx shadcn@latest init` cria a configuração; neste Studio, isso já foi feito para a área React. O Tailwind é carregado sem Preflight/reset global, preservando as demais telas. Os estilos do produto estão limitados a `.fdchat` em `web/chatgpt.css`.

## Comportamento

- **Conversar** responde perguntas e mantém o contexto dos últimos turnos bem-sucedidos. Não altera blocos.
- **Criar fluxo** inicia a criação guiada: perguntas, cartões editáveis, criação de blocos reais e navegação para seus editores.
- **Gerar proposta** mantém a geração direta anterior, com uma prévia separada antes de adicionar o conjunto ao mapa.
- **Adicionar ao mapa** passa pela validação local e cria uma seção sem executá-la.
- O texto chega por eventos do backend. A animação muda de pensar para compor quando os primeiros trechos são recebidos.
- Enter envia; Shift+Enter insere uma linha. **Nova conversa** abre outro trabalho e preserva os anteriores na lateral. Cada conversa mantém mensagens, rascunho, modo, proposta e automação vinculada.
- `components/chat-threads.ts` controla as conversas; `src-tauri/src/chat_history.rs` salva o histórico no diretório local do Studio em `chatgpt/conversations.dat`, protegido por DPAPI no Windows. Não usa armazenamento do navegador. O salvamento é serializado, com revisão para impedir que outra janela substitua conversas mais recentes.
- É possível alternar de conversa e preparar outra mensagem enquanto uma resposta chega. A resposta continua na conversa original. Só uma solicitação ao modelo é executada por vez.
- Conversas vinculadas a outra automação exibem **Abrir automação** antes de enviar ou aplicar propostas. Ao reabrir o Studio, respostas que estavam pendentes aparecem como interrompidas, sem repetir a solicitação automaticamente.
- O movimento respeita a preferência de movimento reduzido. Os estados ativos são pausados quando a área fica oculta.
- Falhas não entram no histórico enviado ao modelo e preservam o texto para uma nova tentativa manual. Não há repetição automática em caso de limite.

As credenciais continuam protegidas no backend Windows. A interface recebe somente mensagens, estados da conexão e propostas validadas. Não há captura automática de tela, envio de prints ou execução de cliques pelo chat.

## Criação guiada

`components/guided-flow.tsx` renderiza o plano validado. `chatgpt_guided.py` valida os tipos e constrói blocos usando os construtores existentes. As ações `ai_guide_context`, `ai_guide_validate`, `ai_guide_create` e `ai_guide_update` passam pelo helper nativo. Os novos blocos ficam numa seção separada por conversa e têm identidade estável para evitar duplicações. Uma revisão impede criar ou editar com base em um mapa que mudou.

Textos, URLs e teclas podem ser editados nos cartões e salvos explicitamente. Imagens/OCR e tabelas abrem os editores completos do mapa; reconhecimento novo começa sem imagem e sem clicar. O estado "Campos configurados" verifica campos básicos e nunca equivale a um teste de execução.

`web/chat-guidance.js` permite somente mapa, planilhas, chat e gravador. A navegação resolve a identidade real do bloco, não executa seletores ou JavaScript recebidos do modelo e recusa destinos removidos ou navegação durante execução. Um painel de orientação acompanha o editor e retorna à conversa de origem. A volta salva os rascunhos do mapa e confere os campos atuais. Com perguntas abertas, a conversa permanece no chat; sem perguntas, um destino validado pode abrir automaticamente.

A inferência recebe a estrutura e o plano editado. A leitura local para os cartões pode incluir texto/URL/teclas configurados; linhas de planilhas, imagens e resultados de execução continuam fora da captura automática. Não há controle autônomo do Chrome nesta integração.

## Conhecimento dos blocos e tutorial visual

`block_knowledge.json` centraliza os campos reais, o significado dos controles e os alvos do tutorial. O backend envia ao modelo somente a documentação e os identificadores dos alvos, sem seletores DOM. O build gera `web/block-knowledge.js` para a interface a partir da mesma fonte. O catálogo é incluído no runtime e nos recursos do instalador.

`chat-guidance-tour.js` resolve `focus` para um controle local registrado dentro do bloco real. Abre apenas as abas internas necessárias, mostra um halo animado, explica o controle e oferece Anterior/Próximo passo. O halo acompanha mudanças de posição, rolagem e tamanho; não intercepta os cliques do usuário e respeita movimento reduzido. Se o campo não existir naquele modo, informa a ausência e não destaca outro campo por aproximação.

Procurar/Testar somente identifica e destaca. A ação de 1 clique/2 cliques/Só confirmar é aplicada na execução, e Salvar apenas grava. Esses fatos constam no contexto e nas instruções dos modos Conversar e Criar fluxo. O tutorial nunca aciona captura, testes, campos de configuração ou salvamento automaticamente.

Thinking Orbs: https://github.com/Jakubantalik/thinking-orbs (MIT). Halftone Orb: código fornecido pelo usuário, com atribuição ao chatcn no próprio componente. As animações usam canvas e não precisam de fotos ou imagens externas.
