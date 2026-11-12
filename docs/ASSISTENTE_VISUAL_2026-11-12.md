# Assistente visual do Studio — 12/11/2026

O Chat IA passa a trabalhar ao lado do mapa real. Em **Chat IA → Mapa + conversa**, escolha **Ensinar** para receber orientações ou **Fazer comigo** para o assistente criar e configurar os blocos solicitados. A criação no editor não inicia a automação.

## Pedidos completos e criação em lote

Exemplo:

> Depois do bloco 8, crie um bloco de texto com “começo”, outro de reconhecimento sem nada por enquanto e outro com a tecla P uma vez.

O assistente cria os três blocos na ordem pedida, na seção do bloco 8, usando os valores informados. Um reconhecimento intencionalmente vazio não bloqueia os blocos seguintes. Se faltar a posição inicial ou outro dado essencial, o assistente pergunta antes de começar. Não abre um tutorial pedindo para digitar novamente um valor que já foi salvo.

As etapas seguintes podem referenciar a identidade da etapa anterior do pedido (`placement.anchor_step`). Cada gravação usa a revisão retornada pelo editor. Tipos de bloco, referências, campos de ação e valores continuam sendo validados; uma explicação ausente ou vazia recebe um texto padrão e não bloqueia uma ação válida.

## Cursor e navegação

O cursor identificado como **Assistente** acompanha os controles reais para abrir o painel, selecionar o tipo do bloco e configurar opções compatíveis. Não aceita coordenadas ou seletores arbitrários enviados pelo modelo.

- Arrastar, rolar ou dar zoom no mapa não cancela a criação.
- O cursor acompanha a posição atual do controle e aguarda o fim do arraste antes de continuar.
- Ao sair da página de trabalho, a operação visual aguarda o retorno ao mapa correspondente.
- O retorno de uma gravação mantém a seção do bloco de referência e preserva a página visualizada.
- **Esc** interrompe a ação visual. Blocos já salvos permanecem no mapa.
- **Desfazer edição** restaura a última alteração do assistente enquanto a revisão do mapa ainda corresponde ao registro local. Não desfaz automaticamente um lote inteiro.

O controle fica limitado às ações tipadas do editor. Capturar uma referência exige o recorte do usuário; procurar/testar apenas identifica e destaca. A execução completa continua sendo iniciada pelo usuário.

## Contexto e organização

O chat recebe a identidade do bloco em que o usuário interagiu, inclusive após renumeração. A seleção atual tem prioridade sobre referências antigas da conversa. O modo dividido usa o mesmo editor do mapa original, sem uma segunda cópia dos blocos.

As explicações ficam junto do controle destacado. A barra do mapa fica compacta no canto, a aba **Variáveis** reúne blocos mínimos para copiar os nomes e as ligações acompanham os blocos ao movê-los. Abrir **Novo bloco** reserva espaço na seção correta.

## Contas e conexão Chrome

É possível adicionar contas ChatGPT e alternar entre registros separados. Reconectar mantém a identidade do registro selecionado; adicionar conta usa um novo registro. O identificador do dispositivo é preservado e os dados de autenticação continuam no armazenamento protegido do Windows. Tokens não aparecem na interface nem são publicados no repositório.

Quando outra instância do Studio ocupa a ponte Chrome, o mapa informa **Chrome em outro Studio**. A conexão tenta se recuperar quando a porta é liberada.

## Validação desta atualização

- 31 testes Node/Playwright de chat, cursor, mapa, variáveis e ponte Chrome.
- 17 testes Python de criação guiada, com um teste ignorado na cópia isolada por depender do runtime embutido. Esse teste já havia passado no ambiente de desenvolvimento.
- Verificação TypeScript e geração do bundle do chat.
- Nove testes Rust locais da integração ChatGPT passaram; os dois testes que dependem de uma conta real permanecem ignorados.

Nenhum login de usuário real, instalador NSIS ou ZIP de extensão é gerado por esta atualização de código.
