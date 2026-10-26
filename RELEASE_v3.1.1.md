# FlowDetect 3.1.1

O FlowDetect é uma plataforma visual para criar, testar e executar automações desktop e web usando blocos. Esta atualização reúne o **FlowDetect Studio 3.1.1** e o **FlowDetect para Chrome 0.2.67**, com melhorias na organização das automações e no acompanhamento visual das execuções.

## Novidades desta versão

### Execuções assistidas com mais espaço para as imagens

- Referências visuais de botões e campos aparecem inteiras, centralizadas e proporcionais, sem o corte que escondia a parte inferior da imagem.
- Número, nome e estado do bloco ficam em uma linha compacta, liberando espaço para a prévia.
- Removidos os cabeçalhos extras de execução/página e o atalho “Histórico e detalhes” que abria outra guia.
- Botão **Mapear** reposicionado ao lado de **Importar**.
- Controles de acompanhamento, progresso e etapas recentes permanecem acessíveis no painel.

### Páginas e configurações no Chrome

- Organize automações por páginas vinculadas às abas do navegador, com acompanhamento independente das execuções.
- Configure empresas e textos OCR dentro do próprio card, com busca, seleção e paginação.
- Cards e controles reorganizados para aproveitar melhor o espaço do popup.
- Retirada a configuração legada de “Tela inicial”; fluxos antigos deixam de ser bloqueados por esse filtro. As verificações definidas nos blocos continuam valendo.
- **Configurar pasta de downloads** abre as configurações nativas de downloads do Chrome.

### Studio atualizado

- Instalador Windows x64 recompilado com a versão interna **3.1.1**.
- Mantidos os recursos de OCR, reconhecimento visual, planilhas, loops, relatórios e mapa dos comandos.

## Recursos do FlowDetect

As imagens abaixo foram preservadas da release anterior e ilustram recursos já disponíveis; não são capturas do novo painel Chrome.

### Mapa dos comandos

Visualize os blocos e suas conexões em um mapa. As linhas mostram os caminhos que a automação pode seguir, incluindo os resultados de cada OCR. Navegue pelo fluxo, salve a organização dos cards e use **Reorganizar mapa** quando precisar ajustar o layout.

<img width="1451" height="801" alt="Mapa dos comandos do FlowDetect" src="https://github.com/user-attachments/assets/14bcb185-d6bf-4642-845f-87fecd29b37b" />

### Múltiplos OCRs no mesmo bloco

Configure mais de um OCR em um único bloco de reconhecimento. Cada texto é avaliado separadamente, permitindo confirmar diferentes elementos da tela sem criar um bloco para cada verificação.

<img width="1103" height="861" alt="Configuração de múltiplos OCRs" src="https://github.com/user-attachments/assets/e78d83e3-fc76-4990-9a4a-4e7affa7875b" />

### Ações específicas para cada OCR

Defina o que acontece quando cada OCR é encontrado ou não encontrado. Configure o clique e escolha entre continuar, parar ou seguir para um bloco específico.

<table>
  <tr>
    <td><img width="490" height="668" alt="Ações para OCR encontrado" src="https://github.com/user-attachments/assets/b2b6c45e-1e18-4c6b-a054-7ec779228576" /></td>
    <td><img width="454" height="648" alt="Ações para OCR não encontrado" src="https://github.com/user-attachments/assets/c4e813db-3726-44f9-949a-20a563aad6f1" /></td>
  </tr>
</table>

### Outros recursos

- **Relatórios PDF:** registre os resultados da execução por linha da planilha.
- **OCR + imagem:** combine leitura de texto e referência visual para identificar a tela antes da ação.
- **FlowDetect Agent:** execute automações desktop em outro computador ou VM. Esta release não inclui um novo instalador do Agent; o [Agent 3.0.1 permanece disponível na release anterior](https://github.com/kaua-ananiass/FlowDetect/releases/tag/v3.0.0).

## Downloads

| Pacote | Versão | Plataforma |
| --- | --- | --- |
| `FlowDetect Studio_3.1.1_x64-setup.exe` | 3.1.1 | Windows x64 — instalador NSIS |
| `FlowDetect-para-Chrome-v0.2.67.zip` | 0.2.67 | Chrome — extensão descompactada |

## Como instalar

1. Baixe e execute o instalador do **FlowDetect Studio 3.1.1** no computador principal.
2. Extraia o ZIP da extensão em uma pasta permanente.
3. Abra `chrome://extensions`, ative **Modo do desenvolvedor** e use **Carregar sem compactação** para selecionar a pasta extraída. Se já usa a extensão por pasta, atualize os arquivos dessa pasta e clique em **Recarregar**.
4. Abra o FlowDetect no navegador e conecte ao Studio pelo código exibido, quando necessário.
5. Crie ou importe a automação, vincule a página à aba de destino e acompanhe a execução em **Execuções assistidas**.

## Validação

Verificações automatizadas do painel cobrem troca de páginas, execuções independentes, encaixe das referências visuais e layout compacto. O instalador foi compilado para Windows x64; a compilação não substitui testes de instalação em cada computador de destino.
