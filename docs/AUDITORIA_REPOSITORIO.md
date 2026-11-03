# Auditoria do repositório — 03/11/2026

Revisão preparada sobre a `main` do GitHub (`7d573ed`), preservando o README e a
galeria mais recentes. Os fontes atualizados foram consolidados em cinco commits.

## Cobertura

| Componente | Verificação |
| --- | --- |
| Studio, Agent e Runner | Fontes Rust, frontends, manifests e lockfiles de dependências |
| Extensão Chrome | Módulos locais e versões da ponte alinhados em 0.2.72 |
| Python | Executor, gerenciador de roteiro, imports locais e auxiliares de execução |
| Instaladores | Caminhos declarados de recursos, ícones, hooks NSIS e runtime |
| OCR | Executável Tesseract e dados de reconhecimento presentes e versionados |
| Navegador | Imports JS, referências HTML e recursos CSS locais |

O comando `python scripts/auditar_repositorio.py --json` verifica os arquivos
do índice Git, e não apenas sua existência no PC. Nesta revisão, verificou
125 referências sem apontar arquivo necessário ausente ou não versionado.

## Lacunas corrigidas

- `Tesseract-OCR/tesseract.exe` estava disponível localmente, mas a regra geral
  de ignorar executáveis impedia sua inclusão no Git. Agora tem exceção explícita.
- O Runner não tinha `package-lock.json`; o lockfile foi acrescentado, usando
  as mesmas versões resolvidas das dependências compartilhadas do Agent.
- Os recursos do Agent/Runner agora declaram o auxiliar de marcação visual.
  O Agent também declara a ponte Chrome. O Runner usa o script inicial limpo do
  pacote, em vez da automação aberta no computador de desenvolvimento.
- A conversão do caminho Chrome carregava o gerenciador como um import comum.
  O Python portátil não inclui a pasta dos scripts no `sys.path`; o carregamento
  agora resolve o módulo vizinho explicitamente e tem teste em processo isolado.
- Caches do Python, relatórios locais e caixas temporárias de execução foram
  excluídos do conjunto candidato a publicação pelas regras do Git.
- Os testes de navegador tinham dependência local externa ao projeto. A raiz
  agora declara Playwright 1.63.0 e seu lockfile, com `npm test` para executar a
  bateria Node sem depender de outro projeto do computador.

## Preparar uma cópia nova no Windows

```powershell
.\scripts\preparar_build_windows.ps1
python scripts/auditar_repositorio.py
cd tauri_gerador
npm ci
npm run tauri:build
```

O instalador oficial do Python 3.12.10 é um pré-requisito gerado, não código
fonte faltante: o script de preparo baixa o arquivo e verifica seu SHA256.
Para conferir um ambiente já preparado, use `-CheckOnly`. Não é preciso
recriar ou substituir o Python portátil para essa conferência.

Node.js/npm, Rust e as ferramentas de compilação Windows são instalados no
ambiente. `node_modules`, `target`, instaladores exportados e perfis privados
não pertencem ao código versionado. As skills de assistência ao desenvolvimento
são opcionais e não fazem parte do runtime do aplicativo.

## Validação e limites

- Runtime portátil de uma cópia limpa: imports das bibliotecas principais passaram.
- Tesseract da cópia preparada: `--version` executado com sucesso.
- Testes de importação, seções, roteamento, relatórios e carga isolada do Python.
- Verificação dos recursos declarados pelos três pacotes Tauri.
- Bateria Node: 188 testes passaram com as dependências da própria raiz.
- Bateria Python selecionada: 14 testes passaram, incluindo o processo portátil isolado.
- `cargo check --locked` do Studio e do Agent passou; restaram avisos de código
  não utilizado já presentes, sem erros de compilação.

Esta auditoria cobre as referências estáticas e os testes executados. Ela não
afirma validação de cada integração em sistemas de terceiros, nem substitui o
teste de instalação final em uma máquina limpa. Esta publicação da branch não
gera nem publica uma nova release ou um instalador NSIS.

Automações locais, CSVs de clientes, diagnósticos do banco Alterdata e artefatos
de teste deste computador não foram incluídos na atualização pública.
