# Compilação do FlowDetect

Execute os comandos a partir da raiz do repositório. O Studio e o Agent são projetos Tauri separados; os arquivos Python da raiz formam o runtime incluído nos pacotes.

## Desenvolvimento

```powershell
cd tauri_gerador
npm.cmd run tauri:dev
```

Em outro terminal, para o Agent:

```powershell
cd flowdetect_agent
npm.cmd run tauri:dev
```

## Instalador do Studio

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compilar_gerador_exe.ps1
```

O instalador NSIS fica em `saida_exe/FlowDetect_Instalador/`; o pacote portátil, em `saida_exe/FlowDetect_Portatil/`. O script copia os launchers de `scripts/runtime/` para a raiz do pacote instalado, onde o aplicativo os procura.

## Instalador do Agent

```powershell
cd flowdetect_agent
npm.cmd run tauri:build
```

## Limpeza dos caches

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\limpar_cache_build.ps1
```

Esse comando limpa somente os caches recompiláveis do Studio e do Agent. A próxima compilação demora mais porque o Rust recria os artefatos.

Para preparar a VM-base distribuída com o Studio, veja [Hyper-V](HYPERV_AGENTES.md) e `hyperv_setup/README.md`.
