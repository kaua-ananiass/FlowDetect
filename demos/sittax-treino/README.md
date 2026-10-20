# Painel do Contador — simulação local

Página de treino inspirada na organização pública do Painel do Contador do Sittax
e na captura de tela fornecida para esta simulação. Inclui 40 empresas fictícias:
30 na aba **Transmitidas** e 10 na aba **Não transmitidas**.
Não é o site oficial, não exige login, não transmite dados e contém apenas
empresas e CNPJs fictícios (filial `0000`). Os PDFs baixados são marcados como
documentos de treino sem validade fiscal.

## Abrir para gravar a automação

No PowerShell, a partir da raiz do repositório:

```powershell
cd .\demos\sittax-treino
python -m http.server 8765 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8765/painel-contador/` no Chrome. Use HTTP local, não
`file://`, para a extensão FlowDetect atuar na página. Mantenha o terminal aberto
durante a gravação; `Ctrl+C` encerra o servidor.

O painel permite pesquisar empresa/CNPJ, filtrar por situação, auditoria, regime
e forma de transmissão, ordenar, expandir detalhes, selecionar empresas, usar
ações individuais/em lote e baixar PDFs fictícios.
No campo do cabeçalho, digite um CNPJ ou nome e clique em **Pesquisar** (ou Enter).
O campo não abre uma lista; o **×** fixo limpa o valor para a próxima pesquisa.
A ficha abre em **Dados da Empresa**. Clique em **Sugestão Tipo Nota** para abrir
**Geral**; depois clique em **Sugestão** ou **Ver sugestões** para ver as notas.
Selecione uma ou mais notas fictícias e clique em **Salvar sugestões** para abrir
a confirmação. A escolha fica armazenada somente neste navegador; o botão
**Restaurar dados de treino** limpa as escolhas e retorna ao estado inicial.

Para testar os dois estados: `00.000.101/0000-00` (três sugestões) e
`00.000.102/0000-00` ("Nenhum registro encontrado"). Outros CNPJs de treino:

| Empresa fictícia | CNPJ fictício |
| --- | --- |
| Jardim Solar Comércio | `00.000.103/0000-00` |
| Maré Clara Café | `00.000.104/0000-00` |
| Ponto Norte Consultoria | `00.000.105/0000-00` |
| Flor de Cedro Ateliê | `00.000.106/0000-00` |
| Estação Azul Tecnologia | `00.000.107/0000-00` |
| Raiz do Vale Mercado | `00.000.108/0000-00` |
| Brisa Urbana Design | `00.000.109/0000-00` |
| Lume Educação Corporativa | `00.000.110/0000-00` |

Os seletores
e CNPJs desta simulação não são os mesmos do Sittax real; uma automação gravada
aqui não deve ser executada contra o serviço oficial sem adaptação e validação.
