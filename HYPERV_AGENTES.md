# Hyper-V no FlowDetect

O Studio agora usa somente o Hyper-V para criar e controlar as maquinas dos Agents.

## Primeiro uso

1. Abra o FlowDetect Studio como administrador. O Hyper-V bloqueia `Get-VM`, `New-VM` e `Start-VM` para uma conta sem permissao elevada.
2. Entre em **Agentes** e clique em **Preparar VM-base**.
3. Selecione a ISO do Windows 10 e crie a VM. O FlowDetect usa uma VM de geracao 2, disco dinamico de 64 GB, 4 GB de RAM, 2 processadores e o `Default Switch` nativo.
4. A tela da VM abre automaticamente. Instale o Windows, o FlowDetect Agent e os aplicativos desejados.
5. Configure o Agent para iniciar com o Windows e execute o Sysprep antes de transformar essa maquina em modelo.
6. Desligue completamente a VM-base. Nao deixe em estado salvo.

## Criar um Agent

Em **Adicionar agente**, informe um novo nome de VM e escolha a VM-base no campo de clonagem. O Studio copia o VHDX, cria uma VM independente, inicia o Windows, descobre o IP pelo Hyper-V e tenta conectar na porta `18452`.

O botao **Abrir tela da VM** abre o console nativo do Hyper-V. Depois que o FlowDetect Agent responder, **Assistir tela** usa a conexao remota integrada ao Studio.

## Pastas

As VMs e os discos criados pelo Studio ficam em `C:\ProgramData\FlowDetect\HyperV`.

## Observacao sobre clones

Antes de clonar a base, use o Sysprep (`OOBE`, `Generalize` e `Shutdown`). Isso evita que todas as copias mantenham a mesma identidade do Windows. Cada clone possui seu proprio VHDX; alteracoes em um Agent nao modificam os demais.
