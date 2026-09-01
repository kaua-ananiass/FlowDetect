# Hyper-V no FlowDetect

O Studio agora usa somente o Hyper-V para criar e controlar as maquinas dos Agents.

## Primeiro uso

1. Abra o FlowDetect Studio como administrador. O Hyper-V bloqueia `Get-VM`, `New-VM` e `Start-VM` para uma conta sem permissao elevada.
2. Entre em **Agentes** e clique em **Preparar VM-base**.
3. Selecione a ISO do Windows 10 e crie a VM. O FlowDetect usa uma VM de geracao 2, disco dinamico de 64 GB, 4 GB de RAM, 2 processadores e o `Default Switch` nativo.
4. A tela da VM abre automaticamente. Instale o Windows, o FlowDetect Agent e os aplicativos desejados.
5. Configure o Agent para iniciar com o Windows e execute o Sysprep antes de transformar essa maquina em modelo.
6. Desligue completamente a VM-base. Nao deixe em estado salvo.

## Instalacao em outro computador

O pacote distribuivel usa uma golden image versionada da `BASE - VM`. O setup
do Studio abre o assistente `hyperv_setup\Preparar-FlowDetectHyperV.ps1`, que
habilita o Hyper-V, configura as permissoes e importa uma copia independente da
VM com GUID e VHDX novos.

Para publicar uma nova base, execute o Sysprep dentro da VM e use, como
administrador, `hyperv_setup\Exportar-FlowDetectGoldenVM.ps1`. O ZIP da VM deve
ser publicado separadamente do instalador do Studio. Consulte
`hyperv_setup\README.md` para o fluxo completo e o manifesto de versao.

## Criar um Agent

Em **Adicionar agente**, informe um novo nome de VM e escolha a VM-base no campo de clonagem. O Studio copia o VHDX, cria uma VM independente, inicia o Windows, descobre o IP pelo Hyper-V e tenta conectar na porta `18452`.

O botao **Abrir tela da VM** abre o console nativo do Hyper-V. Depois que o FlowDetect Agent responder, **Assistir tela** usa a conexao remota integrada ao Studio.

## Controle remoto local

O modo local usa o Agent instalado dentro de cada VM e a porta `18452`; nao exige servidor externo. A tela e os comandos ficam associados ao card da VM selecionada no Studio, permitindo manter varias VMs cadastradas sem incorporar a janela do `vmconnect.exe`.

A base nativa do Agent esta separada nestes componentes:

- `Authentication`: token local persistente por instalacao;
- `DeviceManager`: identidade da maquina e inicializacao automatica no usuario do Windows;
- `SessionManager`: ciclo de vida de uma sessao por Agent;
- `ScreenCapture`: perfil 1080p/60 FPS, Windows Graphics Capture e fallback DXGI;
- `WebRtcClient`: canais separados para ponteiro, controle, clipboard, arquivos e comandos;
- `InputController`: validacao dos eventos antes da injecao nativa;
- `ClipboardManager` e `FileTransfer`: limites, revisoes e protecao de caminhos.

O Agent continua sendo uma aplicacao da sessao interativa do usuario, e nao um servico isolado na sessao 0. Isso e necessario para capturar a area de trabalho e aplicar mouse/teclado no Windows. A inicializacao automatica e registrada em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

### Estado da transmissao

O streaming JPEG por polling foi desativado por nao oferecer a fluidez exigida. O fluxo definitivo deve usar captura continua WGC/DXGI, H.264 Annex-B e WebRTC nativo, sem `getDisplayMedia` e sem confirmacao dentro da VM. Mouse, cliques, rolagem e teclado usam transporte separado do video.

O build de teste atual ja conecta WGC ao encoder OpenH264 em modo `ScreenContentRealTime` e envia Annex-B por uma track WebRTC nativa. O WebView do Agent nao consulta mais ofertas e nunca chama `getDisplayMedia`. O perfil alvo e 1920x1080, 60 FPS e 12 Mbps; o resultado efetivo deve ser medido dentro da VM. NVENC, Quick Sync e AMF ainda dependem da exposicao de GPU ao convidado e da implementacao do backend Media Foundation correspondente.

## Pastas

As VMs e os discos criados pelo Studio ficam em `C:\ProgramData\FlowDetect\HyperV`.

## Observacao sobre clones

Antes de clonar a base, use o Sysprep (`OOBE`, `Generalize` e `Shutdown`). Isso evita que todas as copias mantenham a mesma identidade do Windows. Cada clone possui seu proprio VHDX; alteracoes em um Agent nao modificam os demais.
