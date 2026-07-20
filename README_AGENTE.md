# FlowDetect - Handoff rapido

Este arquivo resume apenas o necessario para outro agente continuar o projeto sem depender do historico completo da conversa.

## Objetivo do produto

FlowDetect e um gerador visual de automacoes desktop.

O usuario monta fluxos em blocos para:

- teclado e atalhos
- texto livre
- mouse
- reconhecimento de imagem
- loop por planilha
- execucao assistida em tempo real

Stack principal:

- frontend: `tauri_gerador/web/index.html`, `main.js`, `style.css`
- shell desktop: Tauri
- ponte nativa: `tauri_gerador/src-tauri/src/lib.rs`
- backend da automacao: Python

## Como rodar

### Primeiro setup em maquina nova

```powershell
cd C:\caminho\do\projeto\tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" install
```

```powershell
cd C:\caminho\do\projeto
python -m pip install -r requirements.txt
```

### Desenvolvimento

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador
& "C:\Program Files\nodejs\npm.cmd" run tauri:dev
```

### Compilar

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
powershell -ExecutionPolicy Bypass -File .\compilar_gerador_exe.ps1
```

Saidas atuais:

- instalador principal Windows:
  - `saida_exe/FlowDetect_Instalador/FlowDetect_1.0.0_x64-setup.exe`
- pacote portatil:
  - `saida_exe/FlowDetect_Portatil`

## Fonte principal do projeto

Edite sempre a raiz principal:

- `C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys`

Arquivos centrais:

- `tauri_gerador/web/main.js`
- `tauri_gerador/web/style.css`
- `tauri_gerador/src-tauri/src/lib.rs`
- `gerenciar_roteiro.py`
- `executar_automacao.py`
- `capturar_imagem_tela.py`
- `diagnostico_ambiente.py`
- `instalador_flowdetect.py`

Arquivos de dados importantes:

- `mapeamento_teclado.json`
- `automacoes/biblioteca.json`
- `automacoes/automacao_atual.json`
- `login_session.json`

## Estado atual do sistema

### 1. Login

Hoje o acesso ativo e local, sem Supabase em uso na interface atual.

Credenciais de admin local em `tauri_gerador/web/main.js`:

- e-mail: `admin@flowdetect.local`
- senha: `flow123`

Bloco atual do login:

- salva sessao local
- salva resolucao da tela ao entrar
- usa overlay simples de acesso

Observacao:

- ainda existe `supabase_secure_activation.sql` no projeto, mas nao e o fluxo principal atual

### 2. Launcher de Automacoes

Existe uma aba de biblioteca para:

- listar automacoes
- criar nova
- abrir para edicao
- duplicar
- renomear
- excluir
- executar

### 3. Mapa dos comandos

E o editor principal.

Recursos relevantes ja ativos:

- cards editaveis
- reordenacao de cards
- paginas de fluxo
- navegacao visual por bolinhas no topo
- 4 paginas atualmente:
  - pagina 1: tema original
  - pagina 2: roxo
  - pagina 3: verde
  - pagina 4: laranja

Transicoes entre paginas/blocos:

- um bloco pode, ao concluir ou ao falhar, ir para:
  - continuar
  - ir para bloco
  - ir para pagina
  - parar
- quando a acao for `ir para pagina`, existe o campo:
  - `Esperar antes da troca`

Esse atraso ja foi integrado em:

- UI `main.js`
- persistencia `gerenciar_roteiro.py`
- ponte Tauri `lib.rs`
- executor `executar_automacao.py`

### 4. Reconhecimento visual

Os blocos de reconhecimento ja possuem:

- captura de imagem dentro do proprio sistema
- selecao manual de referencia
- teste de reconhecimento
- fluxo de sucesso/falha
- opcao de ir para pagina ou bloco

Arquivos principais dessa area:

- `capturar_imagem_tela.py`
- `executar_automacao.py`
- `gerenciar_roteiro.py`
- `tauri_gerador/web/main.js`

### 5. Execucao assistida

Mostra:

- status
- progresso
- logs
- trilha visual dos blocos

Area sensivel de UI:

- o usuario liga muito para alinhamento, centralizacao, carrossel e responsividade
- o primeiro bloco precisa aparecer de forma clara e central no fluxo visual

### 6. Planilha e dados

Permite:

- abrir planilhas
- escolher aba
- escolher coluna
- usar coluna como loop
- mandar celula/coluna para o mapa

### 7. Diagnostico de ambiente

Existe um diagnostico do ambiente para validar dependencias e estrutura basica:

- `diagnostico_ambiente.py`

## Preferencias do usuario

O usuario costuma pedir:

- implementacao direta
- pouca teoria
- layout compacto
- pouco espaco vazio
- UX simples para usuario leigo
- animacoes suaves
- feedback visual claro

Ele testa em Windows e usa automacoes reais no PC.

Nao rode testes que mexam em mouse/teclado sem cuidado.

## Pontos quentes atuais

Se outro agente continuar o projeto, os lugares mais importantes sao:

1. `tauri_gerador/web/main.js`
2. `tauri_gerador/web/style.css`
3. `executar_automacao.py`
4. `gerenciar_roteiro.py`
5. `tauri_gerador/src-tauri/src/lib.rs`

Temas recentes que ja foram bastante mexidos:

- layout do `Mapa dos comandos`
- layout da `Execucao assistida`
- paginas do fluxo
- atraso antes da troca de pagina
- drag and drop / troca de posicao dos cards
- reconhecimento visual

## O que evitar

- nao trate copias/exportacoes como fonte principal
- nao quebre compatibilidade com automacoes salvas
- nao introduza UI com muito espaco morto
- nao execute loops reais sem necessidade

## Validacao minima antes de entregar

Se mexer em `main.js`:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
node --check tauri_gerador/web/main.js
```

Se mexer em Python:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys
python -m py_compile executar_automacao.py gerenciar_roteiro.py
```

Se mexer em Rust/Tauri:

```powershell
cd C:\Users\kaua\Desktop\Capturar_atalhos_hotkeys\tauri_gerador\src-tauri
cargo check
```
