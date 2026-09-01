# Implantacao global da VM-base FlowDetect

A VM-base e distribuida como uma **golden image versionada**, separada do instalador do Studio. Cada computador importa uma copia com GUID e VHDX proprios.

## Publicar uma nova golden image

1. Clone a VM configurada para uma VM de publicacao. Isso preserva sua base de desenvolvimento.
2. Remova contas, arquivos, cookies e credenciais que nao podem ser distribuidos.
3. Copie `Selar-FlowDetectGoldenVM.ps1` para a VM de publicacao e execute nela como administrador:

```powershell
.\Selar-FlowDetectGoldenVM.ps1 -ConfirmSeal
```

O script remove o token de pareamento do Agent e executa o Sysprep em modo de VM. Cada clone criara uma identidade propria no primeiro boot.

4. Com a VM desligada, execute no host como administrador:

```powershell
.\Exportar-FlowDetectGoldenVM.ps1 -VmName "BASE - VM - PUBLICACAO"
```

O comando gera em `dist`:

- `FlowDetect-VM-Base-<versao>.zip`;
- `golden-vm.json` com o SHA-256 do pacote.

Publique os dois arquivos no mesmo release ou servidor. Para download automatico, preencha `downloadUrl` no manifesto publicado antes de compilar o Studio.

## Instalar em um computador novo

O setup do Studio chama `Preparar-FlowDetectHyperV.ps1`. O assistente:

- solicita elevacao;
- habilita o Hyper-V;
- orienta o reinicio quando necessario;
- adiciona o usuario ao grupo Hyper-V Administrators pelo SID;
- habilita a sessao aprimorada;
- baixa ou solicita o pacote da golden image;
- valida o SHA-256;
- importa a VM com `Copy` e `GenerateNewId`;
- conecta a VM ao `Default Switch`;
- ativa VMBus e os servicos de integracao.

O pacote do Windows precisa respeitar o licenciamento da Microsoft. A importacao cria independencia tecnica, mas nao transfere automaticamente uma licenca do Windows para varios computadores.
