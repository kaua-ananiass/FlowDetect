use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
#[cfg(windows)]
mod native_rdp;
#[cfg(windows)]
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, ImageBuffer, Rgba};
use serde_json::Value;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{SocketAddr, TcpListener, TcpStream, ToSocketAddrs, UdpSocket},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
#[cfg(windows)]
use windows::Win32::{
    Foundation::{BOOL, HWND, LPARAM, POINT, RECT},
    Graphics::Gdi::{
        BitBlt, ClientToScreen, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        DIB_RGB_COLORS, HBITMAP, HGDIOBJ, RGBQUAD, SRCCOPY,
    },
    Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS},
    UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
        KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
        MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_MOVE,
        MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEINPUT, VIRTUAL_KEY,
        VK_CONTROL, VK_F12, VK_SHIFT,
    },
    UI::WindowsAndMessaging::{
        EnumWindows, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW, GetWindowRect,
        GetWindowThreadProcessId, IsWindow, IsWindowVisible, IsZoomed, SetWindowLongPtrW,
        SetWindowPos, ShowWindow, GWLP_HWNDPARENT, GWL_STYLE, SM_CXSCREEN, SM_CYSCREEN,
        SWP_FRAMECHANGED, SWP_NOZORDER, SWP_SHOWWINDOW, SW_HIDE, SW_MAXIMIZE, SW_RESTORE, WS_CAPTION,
        WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
    },
};

const BUNDLED_CAPTURAR_CLIQUES: &[u8] = include_bytes!("../../../capturar_cliques.py");
const BUNDLED_CAPTURAR_IMAGEM_TELA: &[u8] = include_bytes!("../../../capturar_imagem_tela.py");
const BUNDLED_CHROME_WEB_BRIDGE: &[u8] = include_bytes!("../../../chrome_web_bridge.py");
const BUNDLED_COMANDOS_TECLADO: &[u8] = include_bytes!("../../../comandos_teclado.py");
const BUNDLED_EXECUTAR_AUTOMACAO: &[u8] = include_bytes!("../../../executar_automacao.py");
const BUNDLED_GERENCIAR_DADOS_PLANILHA: &[u8] = include_bytes!("../../../gerenciar_dados_planilha.py");
const BUNDLED_GERENCIAR_ROTEIRO: &[u8] = include_bytes!("../../../gerenciar_roteiro.py");
const BUNDLED_LISTAR_JANELAS_ABERTAS: &[u8] = include_bytes!("../../../listar_janelas_abertas.py");
const BUNDLED_MAPEAR_ELEMENTOS_JANELA: &[u8] = include_bytes!("../../../mapear_elementos_janela.py");
const BUNDLED_OVERLAY_AUTOMACAO_TELA: &[u8] = include_bytes!("../../../overlay_automacao_tela.py");
const BUNDLED_OVERLAY_JANELA_ALVO: &[u8] = include_bytes!("../../../overlay_janela_alvo.py");
const BUNDLED_RECONHECIMENTO_WORKER: &[u8] = include_bytes!("../../../reconhecimento_worker.py");
const BUNDLED_VALIDAR_DEPENDENCIAS: &[u8] = include_bytes!("../../../validar_dependencias_instaladas.py");

#[derive(Serialize)]
struct ExportResult {
    build_dir: String,
    export_dir: String,
    copied: Vec<String>,
    missing: Vec<String>,
}

#[derive(Serialize, Clone)]
struct TestExecutionPayload {
    running: bool,
}

#[derive(Serialize, Clone)]
struct TestProgressPayload {
    current: i32,
    total: i32,
    percent: f64,
    description: String,
    company: String,
}

#[derive(Serialize, Clone)]
struct TestLogPayload {
    message: String,
}

#[derive(Serialize, Clone)]
struct TestFinishedPayload {
    success: bool,
    code: i32,
}

struct RuntimeState {
    child: Arc<Mutex<Option<Child>>>,
    running: Arc<Mutex<bool>>,
    pid: Arc<Mutex<Option<u32>>>,
}

struct RecognitionWorker {
    source_versions: Vec<Option<std::time::SystemTime>>,
    root: PathBuf,
    python_program: String,
    python_args: Vec<String>,
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

static REMOTE_AGENT_SNAPSHOT: OnceLock<Arc<Mutex<Value>>> = OnceLock::new();
static REMOTE_AGENT_LAST_CONTACT_MS: OnceLock<Arc<Mutex<u128>>> = OnceLock::new();
static PYTHON_COMMAND_CACHE: OnceLock<(String, Vec<String>)> = OnceLock::new();
static MESHCENTRAL_PROCESS: OnceLock<Arc<Mutex<Option<Child>>>> = OnceLock::new();
static MESHCENTRAL_STARTING: OnceLock<Arc<Mutex<bool>>> = OnceLock::new();
static MESHCENTRAL_LAST_MESSAGE: OnceLock<Arc<Mutex<String>>> = OnceLock::new();
static WEBRTC_SIGNAL_STATE: OnceLock<Arc<Mutex<Value>>> = OnceLock::new();
static NATIVE_REMOTE_STATUS: OnceLock<Arc<Mutex<Value>>> = OnceLock::new();
static AGENT_REMOTE_MOUSE_ENABLED: OnceLock<Arc<AtomicBool>> = OnceLock::new();
static PYTHON_BOOTSTRAP_ATTEMPTED: AtomicBool = AtomicBool::new(false);
static PYTHON_DEPS_READY: AtomicBool = AtomicBool::new(false);

static TARGET_OVERLAY_CHILD: Mutex<Option<Child>> = Mutex::new(None);
static SMART_RECORDER_CHILD: Mutex<Option<Child>> = Mutex::new(None);
static RECOGNITION_WORKER: Mutex<Option<RecognitionWorker>> = Mutex::new(None);
static EMBEDDED_HYPERV_CONSOLE: Mutex<Option<EmbeddedHypervConsole>> = Mutex::new(None);
static AGENT_WORK_AREA_GUARD_ENABLED: AtomicBool = AtomicBool::new(false);

const AGENT_SAFE_MARGIN_LEFT: i32 = 25;
const AGENT_SAFE_MARGIN_RIGHT: i32 = 25;
const AGENT_SAFE_MARGIN_TOP: i32 = 50;
const AGENT_SAFE_MARGIN_BOTTOM: i32 = 28;

struct EmbeddedHypervConsole {
    child: Child,
    hwnd: isize,
    owner_hwnd: isize,
    vm_name: String,
}

#[derive(Serialize)]
struct AutomationConfig {
    name: String,
}

fn append_launcher_log(root: &Path, message: impl AsRef<str>) {
    let log_path = root.join("ultimo_log_launcher.txt");
    let line = format!("{}\r\n", message.as_ref());
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .and_then(|mut file| std::io::Write::write_all(&mut file, line.as_bytes()));
}

fn runtime_markers_present(path: &PathBuf) -> bool {
    path.join("capturar_cliques.py").exists()
        && path.join("executar_automacao.py").exists()
        && path.join("mapeamento_teclado.json").exists()
}

fn candidate_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        roots.push(current_dir.clone());
        for ancestor in current_dir.ancestors().skip(1) {
            roots.push(ancestor.to_path_buf());
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_dir = exe_dir.to_path_buf();
            roots.push(exe_dir.clone());
            for ancestor in exe_dir.ancestors().skip(1) {
                roots.push(ancestor.to_path_buf());
            }
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.clone());
        for ancestor in resource_dir.ancestors().skip(1) {
            roots.push(ancestor.to_path_buf());
        }
    }

    roots
}

fn workspace_root(app: &AppHandle) -> PathBuf {
    for root in candidate_roots(app) {
        if runtime_markers_present(&root) {
            return root;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn is_flowdetect_agent_runtime(app: &AppHandle) -> bool {
    let exe_name = std::env::current_exe()
        .ok()
        .and_then(|path| {
            path.file_stem()
                .and_then(|name| name.to_str())
                .map(str::to_string)
        })
        .unwrap_or_default()
        .to_ascii_lowercase();
    if exe_name.contains("agent") {
        return true;
    }

    let current_dir = std::env::current_dir()
        .ok()
        .map(|path| path.display().to_string().to_ascii_lowercase())
        .unwrap_or_default();
    if current_dir.contains("flowdetect_agent") {
        return true;
    }

    app.path()
        .resource_dir()
        .ok()
        .map(|path| {
            path.display()
                .to_string()
                .to_ascii_lowercase()
                .contains("flowdetect_agent")
        })
        .unwrap_or(false)
}

fn sanitize_workbook_filename(file_name: &str) -> String {
    let raw_name = Path::new(file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("planilha.xlsx");

    let sanitized: String = raw_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.is_empty() {
        "planilha.xlsx".to_string()
    } else {
        sanitized
    }
}

fn sanitize_asset_filename(file_name: &str, fallback: &str) -> String {
    let raw_name = Path::new(file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(fallback);

    let sanitized: String = raw_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

fn image_mime_from_bytes(path: &Path, bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return "image/png";
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return "image/jpeg";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "image/gif";
    }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        return "image/webp";
    }

    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

fn normalize_automation_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        "Automacao".to_string()
    } else {
        trimmed.to_string()
    }
}

fn sanitize_export_folder_name(name: &str) -> String {
    let normalized = normalize_automation_name(name);
    let sanitized: String = normalized
        .chars()
        .map(|ch| {
            if matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                ch
            }
        })
        .collect();
    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim_matches(['.', ' ']).trim();
    if trimmed.is_empty() {
        "Automacao".to_string()
    } else {
        trimmed.to_string()
    }
}

fn configure_no_window(command: &mut Command) {
    #[cfg(windows)]
    {
        command.creation_flags(0x08000000);
    }
}

/* Hyper-V replaces the former VirtualBox integration. */
fn powershell_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn run_hyperv_powershell(script: &str) -> Result<String, String> {
    let wrapped =
        format!("$ErrorActionPreference='Stop'; Import-Module Hyper-V -ErrorAction Stop; {script}");
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &wrapped,
    ]);
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Nao foi possivel abrir o PowerShell do Hyper-V: {err}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        let log_dir = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join("FlowDetect Studio");
        let _ = fs::create_dir_all(&log_dir);
        if let Ok(mut log) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join("hyperv.log"))
        {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|value| value.as_secs())
                .unwrap_or_default();
            let _ = writeln!(log, "[{timestamp}] PowerShell: {detail}\n");
        }
        let normalized = detail.to_lowercase();
        if normalized.contains("permissão necessária")
            || normalized.contains("permissao necessaria")
            || normalized.contains("access is denied")
            || normalized.contains("acesso negado")
            || normalized.contains("unauthorizedaccess")
        {
            Err(format!("O Studio não recebeu permissão para controlar o Hyper-V. Feche-o e abra pelo atalho como administrador. Detalhe: {detail}"))
        } else if normalized.contains("não foi possível encontrar")
            || normalized.contains("nao foi possivel encontrar")
            || normalized.contains("cannot find a virtual machine")
            || normalized.contains("was not found")
        {
            Err(format!(
                "A VM configurada não foi encontrada no Hyper-V. Detalhe: {detail}"
            ))
        } else {
            Err(format!("Falha no Hyper-V: {detail}"))
        }
    }
}

fn hyperv_json(script: &str) -> Result<Value, String> {
    let output = run_hyperv_powershell(script)?;
    if output.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&output)
        .map_err(|err| format!("Resposta invalida do Hyper-V: {err}. Saida: {output}"))
}

#[tauri::command]
fn get_hyperv_status() -> Result<Value, String> {
    let script = "$principal=[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent(); $admin=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); $module=[bool](Get-Module -ListAvailable Hyper-V); $hypervisor=(Get-CimInstance Win32_ComputerSystem).HypervisorPresent; [pscustomobject]@{ok=$true;admin=$admin;module=$module;hypervisor=$hypervisor} | ConvertTo-Json -Compress";
    let mut command = Command::new("powershell.exe");
    command.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Falha ao verificar o Hyper-V: {err}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    serde_json::from_str(&stdout)
        .map_err(|err| format!("Falha ao interpretar o estado do Hyper-V: {err}"))
}

#[tauri::command]
fn list_hyperv_vms() -> Result<Value, String> {
    let items = hyperv_json("[array]$items=@(Get-VM | ForEach-Object { $vm=$_; $ips=@(Get-VMNetworkAdapter -VM $vm -ErrorAction SilentlyContinue | ForEach-Object IPAddresses | Where-Object { $_ -match '^\\d+\\.' -and $_ -notmatch '^169\\.254\\.' }); [pscustomobject]@{ name=$vm.Name; uuid=$vm.Id.Guid; state=$vm.State.ToString(); generation=$vm.Generation; path=$vm.Path; ip=($ips | Select-Object -First 1) } }); ConvertTo-Json -InputObject $items -Compress")?;
    Ok(
        serde_json::json!({ "ok": true, "provider": "hyper-v", "items": items.as_array().cloned().unwrap_or_default() }),
    )
}

#[tauri::command]
fn create_hyperv_base_vm(
    vm_name: String,
    iso_path: String,
    memory_mb: Option<u64>,
    processors: Option<u32>,
    disk_size_gb: Option<u64>,
) -> Result<Value, String> {
    let name = vm_name.trim();
    let iso = PathBuf::from(iso_path.trim());
    if name.is_empty() {
        return Err("Informe o nome da VM-base.".to_string());
    }
    if !iso.is_file()
        || iso
            .extension()
            .and_then(|v| v.to_str())
            .map(|v| !v.eq_ignore_ascii_case("iso"))
            .unwrap_or(true)
    {
        return Err("Selecione uma ISO valida do Windows 10.".to_string());
    }
    let memory = memory_mb.unwrap_or(4096).clamp(2048, 16384);
    let cpu = processors.unwrap_or(2).clamp(1, 8);
    let disk = disk_size_gb.unwrap_or(64).clamp(40, 512);
    let script = format!(
        r#"$name={name}; $iso={iso}; if (Get-VM -Name $name -ErrorAction SilentlyContinue) {{ throw 'Ja existe uma VM com esse nome.' }}; $switch=Get-VMSwitch -Name 'Default Switch' -ErrorAction SilentlyContinue; if (-not $switch) {{ throw 'O Default Switch do Hyper-V nao foi encontrado.' }}; $root=Join-Path $env:ProgramData 'FlowDetect\HyperV'; $vmPath=Join-Path $root $name; New-Item -ItemType Directory -Path $vmPath -Force | Out-Null; $vhd=Join-Path $vmPath ($name+'.vhdx'); New-VHD -Path $vhd -Dynamic -SizeBytes {disk}GB | Out-Null; $vm=New-VM -Name $name -Generation 2 -MemoryStartupBytes {memory}MB -VHDPath $vhd -Path $vmPath -SwitchName $switch.Name; Set-VMProcessor -VM $vm -Count {cpu}; Set-VMMemory -VM $vm -DynamicMemoryEnabled $true -MinimumBytes 2048MB -StartupBytes {memory}MB -MaximumBytes {max_memory}MB; Set-VM -VM $vm -AutomaticStartAction Nothing -AutomaticStopAction ShutDown; Set-VMFirmware -VM $vm -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows; $dvd=Add-VMDvdDrive -VM $vm -Path $iso -Passthru; Set-VMFirmware -VM $vm -FirstBootDevice $dvd; [pscustomobject]@{{ok=$true;name=$vm.Name;path=$vm.Path;vhd=$vhd;switch=$switch.Name}} | ConvertTo-Json -Compress"#,
        name = powershell_literal(name),
        iso = powershell_literal(&iso.to_string_lossy()),
        disk = disk,
        memory = memory,
        max_memory = (memory * 2).min(16384),
        cpu = cpu
    );
    hyperv_json(&script)
}

#[tauri::command]
fn clone_hyperv_vm(
    base_vm_name: String,
    vm_name: String,
    storage_path: Option<String>,
) -> Result<Value, String> {
    let base = base_vm_name.trim();
    let name = vm_name.trim();
    if base.is_empty() || name.is_empty() {
        return Err("Informe a VM-base e o nome da nova VM.".to_string());
    }
    let storage = storage_path.unwrap_or_default();
    let storage = storage.trim();
    let script = format!(
        r#"
$baseName={base};
$name={name};
$customRoot={storage};
$base=Get-VM -Name $baseName;
if ($base.State -ne 'Off') {{ throw 'Desligue a VM-base antes de clonar.' }}
if (Get-VM -Name $name -ErrorAction SilentlyContinue) {{ throw 'Ja existe uma VM com esse nome.' }}
if ($name -match '[\\/:*?"<>|]') {{ throw 'O nome da VM nao pode conter barras ou caracteres invalidos para pasta.' }}
$source=(Get-VMHardDiskDrive -VM $base | Select-Object -First 1).Path;
if (-not $source) {{ throw 'A VM-base nao possui disco virtual.' }}
if (-not (Test-Path -LiteralPath $source)) {{ throw 'O disco virtual da VM-base nao foi encontrado.' }}
$root=$(if ([string]::IsNullOrWhiteSpace($customRoot)) {{ Join-Path $env:ProgramData 'FlowDetect\HyperV' }} else {{ $customRoot }});
$root=[System.IO.Path]::GetFullPath($root);
$vmPath=Join-Path $root $name;
$resolvedRoot=[System.IO.Path]::GetFullPath($root);
$resolvedVmPath=[System.IO.Path]::GetFullPath($vmPath);
if (-not $resolvedVmPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {{ throw 'Caminho da nova VM invalido.' }}
New-Item -ItemType Directory -Path $resolvedRoot -Force | Out-Null;
if (Test-Path -LiteralPath $vmPath) {{
  Remove-Item -LiteralPath $vmPath -Recurse -Force -ErrorAction Stop;
}}
New-Item -ItemType Directory -Path $vmPath -Force | Out-Null;
$target=Join-Path $vmPath ($name+'.vhdx');
$targetRoot=[System.IO.Path]::GetPathRoot($target);
$drive=Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID = '" + $targetRoot.TrimEnd('\') + "'");
if (-not $drive) {{ throw 'Nao foi possivel verificar o espaco livre no disco de destino.' }}
$requiredBytes=[int64](2147483648);
if ([int64]$drive.FreeSpace -lt $requiredBytes) {{
  $requiredGb=[math]::Round($requiredBytes / 1GB, 2);
  $freeGb=[math]::Round(([int64]$drive.FreeSpace) / 1GB, 2);
  throw "Espaco insuficiente para criar o clone rapido. Livre em ${{targetRoot}}: $freeGb GB. Necessario aproximado: $requiredGb GB. Escolha outro destino ou libere espaco."
}}
try {{
  New-VHD -Path $target -ParentPath $source -Differencing -ErrorAction Stop | Out-Null;
  $adapter=Get-VMNetworkAdapter -VM $base | Select-Object -First 1;
  if (-not $adapter) {{ throw 'A VM-base nao possui adaptador de rede.' }}
  $vm=New-VM -Name $name -Generation $base.Generation -MemoryStartupBytes $base.MemoryStartup -VHDPath $target -Path $vmPath -SwitchName $adapter.SwitchName;
  Set-VMProcessor -VM $vm -Count $base.ProcessorCount;
  Set-VMMemory -VM $vm -DynamicMemoryEnabled $true -MinimumBytes 2048MB -StartupBytes $base.MemoryStartup -MaximumBytes ([Math]::Max($base.MemoryStartup, 4096MB));
  Set-VM -VM $vm -AutomaticStartAction Nothing -AutomaticStopAction ShutDown -EnhancedSessionTransportType VMBus;
  Set-VMFirmware -VM $vm -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows;
  [pscustomobject]@{{ok=$true;name=$vm.Name;base=$baseName;path=$vm.Path;vhd=$target;parentVhd=$source;cloneMode='differencing'}} | ConvertTo-Json -Compress
}} catch {{
  $createdVm=Get-VM -Name $name -ErrorAction SilentlyContinue;
  if ($createdVm) {{ Remove-VM -VM $createdVm -Force -ErrorAction SilentlyContinue }}
  if (Test-Path -LiteralPath $vmPath) {{ Remove-Item -LiteralPath $vmPath -Recurse -Force -ErrorAction SilentlyContinue }}
  $message=$_.Exception.Message;
  if ($message -match 'insuficiente|not enough space|There is not enough space') {{
    $freeGb=[math]::Round(([int64]$drive.FreeSpace) / 1GB, 2);
    throw "Espaco insuficiente para criar o clone rapido. Livre em ${{targetRoot}}: $freeGb GB. Escolha outro destino ou libere espaco."
  }}
  throw $message
}}
"#,
        base = powershell_literal(base),
        name = powershell_literal(name),
        storage = powershell_literal(storage)
    );
    hyperv_json(&script)
}

#[tauri::command]
fn start_hyperv_vm(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    hyperv_json(&format!(
        r#"
$vm=Get-VM -Name {name};
Set-VMHost -EnableEnhancedSessionMode $true;
Get-VMIntegrationService -VM $vm | Where-Object {{ $_.Name -match 'Guest|Convidado' }} | Enable-VMIntegrationService -ErrorAction SilentlyContinue;
Set-VM -VM $vm -EnhancedSessionTransportType VMBus -ErrorAction SilentlyContinue;
if ($vm.State -eq 'Off') {{
  if (-not $vm.DynamicMemoryEnabled -and [int64]$vm.MemoryStartup -gt 6GB) {{
    Set-VMMemory -VM $vm -DynamicMemoryEnabled $true -MinimumBytes 2048MB -StartupBytes 4096MB -MaximumBytes ([int64]$vm.MemoryStartup);
    $vm=Get-VM -Name $vm.Name;
  }}
  $targetDisks=@(Get-VMHardDiskDrive -VM $vm | ForEach-Object {{ $_.Path }} | Where-Object {{ $_ }});
  $targetKeys=@($targetDisks | ForEach-Object {{
    try {{ [System.IO.Path]::GetFullPath($_).ToLowerInvariant() }} catch {{ $_.ToString().ToLowerInvariant() }}
  }});
  $blockers=@();
  foreach ($other in @(Get-VM | Where-Object {{ $_.Name -ne $vm.Name -and $_.State -ne 'Off' }})) {{
    $blocked=$false;
    foreach ($drive in @(Get-VMHardDiskDrive -VM $other -ErrorAction SilentlyContinue)) {{
      $path=$drive.Path;
      $visited=@{{}};
      while ($path) {{
        $key=$(try {{ [System.IO.Path]::GetFullPath($path).ToLowerInvariant() }} catch {{ $path.ToString().ToLowerInvariant() }});
        if ($visited.ContainsKey($key)) {{ break }}
        $visited[$key]=$true;
        try {{ $vhd=Get-VHD -Path $path -ErrorAction Stop }} catch {{ break }}
        $parent=$vhd.ParentPath;
        if (-not $parent) {{ break }}
        $parentKey=$(try {{ [System.IO.Path]::GetFullPath($parent).ToLowerInvariant() }} catch {{ $parent.ToString().ToLowerInvariant() }});
        if ($targetKeys -contains $parentKey) {{
          $blockers += $other.Name;
          $blocked=$true;
          break;
        }}
        $path=$parent;
      }}
      if ($blocked) {{ break }}
    }}
  }}
  $blockers=@($blockers | Select-Object -Unique);
  if ($blockers.Count -gt 0) {{
    throw ('A VM "' + $vm.Name + '" e base de clone rapido em execucao: ' + ($blockers -join ', ') + '. Desligue esses clones antes de abrir a VM-base para evitar conflito/corrupcao do disco.')
  }}
  Start-VM -VM $vm | Out-Null;
}}
$fresh=Get-VM -Name $vm.Name;
[pscustomobject]@{{ok=$true;name=$fresh.Name;state=$fresh.State.ToString();enhancedSessionTransport=$fresh.EnhancedSessionTransportType.ToString();guestServiceEnabled=$true}} | ConvertTo-Json -Compress
"#,
        name = powershell_literal(name)
    ))
}

#[tauri::command]
fn stop_hyperv_vm(vm_name: String, timeout_seconds: Option<u64>) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    let timeout = timeout_seconds.unwrap_or(25).clamp(3, 120);
    hyperv_json(&format!(
        r#"$vm=Get-VM -Name {}; if ($vm.State -eq 'Off') {{ [pscustomobject]@{{ok=$true;name=$vm.Name;state='Off';requiresForce=$false}} | ConvertTo-Json -Compress; return }}; $job=Stop-VM -VM $vm -AsJob; $finished=Wait-Job -Job $job -Timeout {}; if (-not $finished) {{ Stop-Job -Job $job -ErrorAction SilentlyContinue; Remove-Job -Job $job -Force -ErrorAction SilentlyContinue; [pscustomobject]@{{ok=$false;name=$vm.Name;state=(Get-VM -Name $vm.Name).State.ToString();requiresForce=$true;message='O Windows da VM nao respondeu ao desligamento normal.'}} | ConvertTo-Json -Compress; return }}; Receive-Job -Job $job -ErrorAction SilentlyContinue | Out-Null; Remove-Job -Job $job -Force -ErrorAction SilentlyContinue; [pscustomobject]@{{ok=$true;name=$vm.Name;state=(Get-VM -Name $vm.Name).State.ToString();requiresForce=$false}} | ConvertTo-Json -Compress"#,
        powershell_literal(name),
        timeout
    ))
}

#[tauri::command]
fn turn_off_hyperv_vm(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    hyperv_json(&format!("$vm=Get-VM -Name {}; if ($vm.State -ne 'Off') {{ Stop-VM -VM $vm -TurnOff -Force }}; [pscustomobject]@{{ok=$true;name=$vm.Name;state=(Get-VM -Name $vm.Name).State.ToString();forced=$true}} | ConvertTo-Json -Compress", powershell_literal(name)))
}

#[tauri::command]
fn kill_hyperv_vm_process(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    hyperv_json(&format!(
        r#"$vm=Get-VM -Name {name}; $vmName=$vm.Name; $vmId=$vm.Id.Guid.ToString(); if ($vm.State -eq 'Off') {{ [pscustomobject]@{{ok=$true;name=$vmName;state='Off';forced=$true;method='vmwp';killed=0;workerIds=@()}} | ConvertTo-Json -Compress; return }}; $workers=@(Get-CimInstance Win32_Process -Filter "Name = 'vmwp.exe'" | Where-Object {{ $_.CommandLine -and ($_.CommandLine -like ('*'+$vmId+'*')) }}); $workerIds=@($workers | ForEach-Object {{ [int]$_.ProcessId }}); foreach ($workerProcessId in $workerIds) {{ Stop-Process -Id $workerProcessId -Force -ErrorAction SilentlyContinue }}; $deadline=(Get-Date).AddSeconds(5); do {{ Start-Sleep -Milliseconds 250; $vm=Get-VM -Name $vmName -ErrorAction SilentlyContinue; $alive=@(Get-CimInstance Win32_Process -Filter "Name = 'vmwp.exe'" | Where-Object {{ $_.CommandLine -and ($_.CommandLine -like ('*'+$vmId+'*')) }}).Count }} while ($vm -and $alive -gt 0 -and (Get-Date) -lt $deadline); $state=$(if ($vm) {{ $vm.State.ToString() }} else {{ 'Unknown' }}); [pscustomobject]@{{ok=$true;name=$vmName;state=$state;forced=$true;method='vmwp';killed=$workerIds.Count;workerIds=$workerIds;workerStillAlive=$alive}} | ConvertTo-Json -Compress"#,
        name = powershell_literal(name)
    ))
}

#[tauri::command]
fn get_hyperv_vm_connection(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    hyperv_json(&format!("$vm=Get-VM -Name {}; $ips=@(Get-VMNetworkAdapter -VM $vm | ForEach-Object IPAddresses | Where-Object {{ $_ -match '^\\d+\\.' -and $_ -notmatch '^169\\.254\\.' }} | Select-Object -Unique); [pscustomobject]@{{ok=$true;name=$vm.Name;uuid=$vm.Id.Guid;state=$vm.State.ToString();ips=$ips;ip=($ips | Select-Object -First 1);address=$(if($ips.Count -gt 0){{$ips[0]+':18452'}}else{{$null}})}} | ConvertTo-Json -Compress", powershell_literal(name)))
}

#[tauri::command]
fn get_hyperv_vm_boot_status(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    hyperv_json(&format!(
        r#"
$vm=Get-VM -Name {name};
$services=@(Get-VMIntegrationService -VM $vm -ErrorAction SilentlyContinue);
$heartbeat=$services | Where-Object {{ $_.Name -match 'Heartbeat|Pulsacao|Pulsa|Batimento' }} | Select-Object -First 1;
$guest=$services | Where-Object {{ $_.Name -match 'Guest|Convidado' }} | Select-Object -First 1;
$ips=@(Get-VMNetworkAdapter -VM $vm -ErrorAction SilentlyContinue | ForEach-Object IPAddresses | Where-Object {{ $_ -match '^\d+\.' -and $_ -notmatch '^169\.254\.' }} | Select-Object -Unique);
$heartbeatText=$(if($heartbeat) {{ [string]$heartbeat.PrimaryStatusDescription }} else {{ '' }});
$heartbeatOp=$(if($heartbeat) {{ [string]($heartbeat.PrimaryOperationalStatus -join ',') }} else {{ '' }});
$uptimeSeconds=$(try {{ [int][Math]::Round($vm.Uptime.TotalSeconds) }} catch {{ 0 }});
$heartbeatReady=$false;
if($heartbeat) {{
  $heartbeatReady=(($heartbeatText -match 'OK|Ok|operating normally|normal|corretamente|Tudo') -or ($heartbeatOp -match 'Ok|OK')) -and ($heartbeatText -notmatch 'No Contact|Sem contato|Lost|Error|Erro|Critical|Critico|Crítico');
}}
$guestReady=$false;
if($guest) {{
  $guestReady=([string]$guest.PrimaryStatusDescription -match 'OK|Ok|operating normally|normal|corretamente|Tudo') -or ([string]($guest.PrimaryOperationalStatus -join ',') -match 'Ok|OK');
}}
$stableHeartbeat=$heartbeatReady -and $uptimeSeconds -ge 75;
$networkReady=$heartbeatReady -and $ips.Count -gt 0 -and $uptimeSeconds -ge 55;
$guestServiceReady=$heartbeatReady -and $guestReady -and $uptimeSeconds -ge 55;
$ready=($vm.State.ToString() -eq 'Running') -and ($stableHeartbeat -or $networkReady -or $guestServiceReady);
[pscustomobject]@{{
  ok=$true;
  name=$vm.Name;
  state=$vm.State.ToString();
  ready=$ready;
  uptimeSeconds=$uptimeSeconds;
  heartbeatReady=$heartbeatReady;
  stableHeartbeat=$stableHeartbeat;
  networkReady=$networkReady;
  guestServiceReady=$guestServiceReady;
  heartbeatStatus=$heartbeatText;
  heartbeatOperational=$heartbeatOp;
  guestReady=$guestReady;
  ip=($ips | Select-Object -First 1);
  ips=$ips
}} | ConvertTo-Json -Compress
"#,
        name = powershell_literal(name)
    ))
}

#[tauri::command]
fn probe_native_hyperv_rdp() -> Result<Value, String> {
    native_rdp::probe()
}

#[tauri::command]
async fn open_native_hyperv_rdp(
    app: AppHandle,
    vm_name: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<Value, String> {
    let vm_name = vm_name.trim().to_string();
    let boot_status = get_hyperv_vm_boot_status(vm_name.clone())?;
    let guest_ready = boot_status
        .get("ready")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !guest_ready {
        let state = boot_status
            .get("state")
            .and_then(Value::as_str)
            .unwrap_or("desconhecido");
        let uptime = boot_status
            .get("uptimeSeconds")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        return Err(format!(
            "A VM ainda nao esta pronta para abrir a tela. Estado: {state}; boot: {uptime}s. Aguarde a tela inicial do Windows aparecer."
        ));
    }
    run_hyperv_powershell(&format!("$vm=Get-VM -Name {}; Set-VMHost -EnableEnhancedSessionMode $true; Set-VM -VM $vm -EnhancedSessionTransportType VMBus -ErrorAction SilentlyContinue; [pscustomobject]@{{ok=$true;name=$vm.Name;state=$vm.State.ToString();enhancedSessionTransport=(Get-VM -Name $vm.Name).EnhancedSessionTransportType.ToString()}} | ConvertTo-Json -Compress", powershell_literal(&vm_name)))?;
    let connection = get_hyperv_vm_connection(vm_name.clone())?;
    let vm_id = connection
        .get("uuid")
        .and_then(Value::as_str)
        .ok_or_else(|| "O Hyper-V nao informou o GUID da VM.".to_string())?
        .to_string();
    let owner = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal indisponivel.".to_string())?;
    let hwnd = owner.hwnd().map_err(|error| error.to_string())?;
    let owner_hwnd = hwnd.0 as isize;
    // Janelas Win32 pertencem a thread que as criou. Mantenha o painel host
    // na thread principal do Studio para ele continuar valido apos o comando.
    let (host_tx, host_rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = host_tx.send(native_rdp::create_host(owner_hwnd, x, y, width, height));
    })
    .map_err(|error| format!("Nao foi possivel preparar o painel da VM: {error}"))?;
    let native_host = host_rx
        .recv()
        .map_err(|_| "A thread principal nao criou o painel da VM.".to_string())??;
    tauri::async_runtime::spawn_blocking(move || {
        native_rdp::open(
            owner_hwnd,
            native_host,
            &vm_id,
            &vm_name,
            x,
            y,
            width,
            height,
        )
    })
    .await
    .map_err(|error| format!("A thread nativa do RDP falhou: {error}"))?
}

#[tauri::command]
fn resize_native_hyperv_rdp(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    visible: bool,
) -> Result<Value, String> {
    native_rdp::resize(x, y, width, height, visible)
}

#[tauri::command]
fn activate_native_hyperv_rdp(
    vm_name: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    visible: bool,
) -> Result<Value, String> {
    let vm_name = vm_name.trim().to_string();
    let connection = get_hyperv_vm_connection(vm_name)?;
    let vm_id = connection
        .get("uuid")
        .and_then(Value::as_str)
        .ok_or_else(|| "O Hyper-V nao informou o GUID da VM.".to_string())?;
    native_rdp::activate(vm_id, x, y, width, height, visible)
}

#[tauri::command]
fn close_native_hyperv_rdp() -> Result<Value, String> {
    native_rdp::close()
}

#[tauri::command]
fn set_native_hyperv_rdp_input_enabled(enabled: bool) -> Result<Value, String> {
    native_rdp::set_input_enabled(enabled)
}

#[tauri::command]
fn open_hyperv_vm_console(vm_name: String) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }
    Command::new("vmconnect.exe")
        .args(["localhost", name])
        .spawn()
        .map_err(|err| format!("Nao foi possivel abrir a tela da VM: {err}"))?;
    Ok(serde_json::json!({"ok":true,"name":name}))
}

#[cfg(windows)]
struct WindowSearchData {
    process_id: u32,
    hwnd: isize,
}

#[cfg(windows)]
unsafe extern "system" fn find_process_window(window: HWND, lparam: LPARAM) -> BOOL {
    let search = &mut *(lparam.0 as *mut WindowSearchData);
    let mut process_id = 0u32;
    GetWindowThreadProcessId(window, Some(&mut process_id));
    if process_id == search.process_id && IsWindowVisible(window).as_bool() {
        search.hwnd = window.0 as isize;
        return BOOL(0);
    }
    BOOL(1)
}

#[cfg(windows)]
fn close_embedded_hyperv_console_native() {
    if let Ok(mut guard) = EMBEDDED_HYPERV_CONSOLE.lock() {
        if let Some(mut console) = guard.take() {
            unsafe {
                let window = HWND(console.hwnd as *mut std::ffi::c_void);
                if IsWindow(window).as_bool() {
                    let _ = ShowWindow(window, SW_HIDE);
                }
            }
            let _ = console.child.kill();
            let _ = console.child.wait();
        }
    }
}

#[cfg(windows)]
fn dock_hyperv_console_window(
    window: HWND,
    owner: HWND,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    unsafe {
        if !IsWindow(window).as_bool() || !IsWindow(owner).as_bool() {
            return Err("A janela do Studio ou do console nao esta mais disponivel.".to_string());
        }
        let mut client_origin = POINT { x: 0, y: 0 };
        if !ClientToScreen(owner, &mut client_origin).as_bool() {
            return Err("Nao foi possivel alinhar o console ao Studio.".to_string());
        }
        let current_style = GetWindowLongPtrW(window, GWL_STYLE) as u32;
        let docked_style = (current_style
            & !(WS_CAPTION.0
                | WS_THICKFRAME.0
                | WS_SYSMENU.0
                | WS_MINIMIZEBOX.0
                | WS_MAXIMIZEBOX.0))
            | WS_POPUP.0;
        SetWindowLongPtrW(window, GWL_STYLE, docked_style as isize);
        SetWindowLongPtrW(window, GWLP_HWNDPARENT, owner.0 as isize);
        SetWindowPos(
            window,
            None,
            client_origin.x + x.max(0),
            client_origin.y + y.max(0),
            width.max(320),
            height.max(240),
            SWP_NOZORDER | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
        )
        .map_err(|err| format!("Nao foi possivel encaixar o console no Studio: {err}"))?;
        Ok(())
    }
}

#[cfg(windows)]
fn configure_vmconnect_zoom(zoom_level: u32) -> Result<u32, String> {
    let zoom = zoom_level.clamp(25, 100);
    let app_data = std::env::var_os("APPDATA")
        .ok_or_else(|| "A pasta de configuracao do usuario nao foi encontrada.".to_string())?;
    let config_path = PathBuf::from(app_data)
        .join("Microsoft")
        .join("Windows")
        .join("Hyper-V")
        .join("Client")
        .join("1.0")
        .join("vmconnect.config");
    let Some(parent) = config_path.parent() else {
        return Err("O caminho de configuracao do VMConnect e invalido.".to_string());
    };
    fs::create_dir_all(parent)
        .map_err(|err| format!("Nao foi possivel preparar a configuracao do VMConnect: {err}"))?;

    let zoom_setting = format!(
        "        <setting name=\"ZoomLevel\" type=\"System.UInt32\">\r\n            <value>{zoom}</value>\r\n        </setting>"
    );
    let updated = if config_path.exists() {
        let current = fs::read_to_string(&config_path)
            .map_err(|err| format!("Nao foi possivel ler a configuracao do VMConnect: {err}"))?;
        if let Some(setting_start) = current.find("<setting name=\"ZoomLevel\"") {
            let line_start = current[..setting_start]
                .rfind('\n')
                .map(|index| index + 1)
                .unwrap_or(setting_start);
            let setting_end = current[setting_start..]
                .find("</setting>")
                .map(|index| setting_start + index + "</setting>".len())
                .ok_or_else(|| {
                    "A configuracao de zoom do VMConnect esta incompleta.".to_string()
                })?;
            format!(
                "{}{}{}",
                &current[..line_start],
                zoom_setting,
                &current[setting_end..]
            )
        } else {
            current.replace(
                "<Microsoft.Virtualization.Client.InteractiveSession.InteractiveSessionConfigurationOptions>",
                &format!(
                    "<Microsoft.Virtualization.Client.InteractiveSession.InteractiveSessionConfigurationOptions>\r\n{zoom_setting}"
                ),
            )
        }
    } else {
        format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<configuration>\r\n    <Microsoft.Virtualization.Client.InteractiveSession.InteractiveSessionConfigurationOptions>\r\n{zoom_setting}\r\n    </Microsoft.Virtualization.Client.InteractiveSession.InteractiveSessionConfigurationOptions>\r\n</configuration>\r\n"
        )
    };
    fs::write(&config_path, updated)
        .map_err(|err| format!("Nao foi possivel ajustar o zoom do VMConnect: {err}"))?;
    Ok(zoom)
}

#[tauri::command]
fn open_embedded_hyperv_console(
    app: AppHandle,
    vm_name: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    zoom_level: u32,
) -> Result<Value, String> {
    let name = vm_name.trim();
    if name.is_empty() {
        return Err("Informe o nome da VM do Hyper-V.".to_string());
    }

    #[cfg(windows)]
    {
        close_embedded_hyperv_console_native();
        let applied_zoom = configure_vmconnect_zoom(zoom_level)?;
        let mut child = Command::new("vmconnect.exe")
            .args(["localhost", name])
            .spawn()
            .map_err(|err| format!("Nao foi possivel abrir o console local da VM: {err}"))?;
        let process_id = child.id();
        let mut embedded_hwnd = 0isize;
        for _ in 0..120 {
            let mut search = WindowSearchData {
                process_id,
                hwnd: 0,
            };
            unsafe {
                let _ = EnumWindows(
                    Some(find_process_window),
                    LPARAM((&mut search as *mut WindowSearchData) as isize),
                );
            }
            if search.hwnd != 0 {
                embedded_hwnd = search.hwnd;
                break;
            }
            if child.try_wait().map_err(|err| err.to_string())?.is_some() {
                return Err("O console do Hyper-V foi encerrado antes de abrir a tela.".to_string());
            }
            thread::sleep(Duration::from_millis(100));
        }
        if embedded_hwnd == 0 {
            let _ = child.kill();
            return Err("A janela do console do Hyper-V nao apareceu a tempo.".to_string());
        }

        let studio_window = app
            .get_webview_window("main")
            .ok_or_else(|| "Janela principal do Studio nao encontrada.".to_string())?;
        let tauri_owner = studio_window.hwnd().map_err(|err| err.to_string())?;
        let owner_hwnd = HWND(tauri_owner.0);
        let console_hwnd = HWND(embedded_hwnd as *mut std::ffi::c_void);
        dock_hyperv_console_window(console_hwnd, owner_hwnd, x, y, width, height)?;
        if let Ok(mut guard) = EMBEDDED_HYPERV_CONSOLE.lock() {
            *guard = Some(EmbeddedHypervConsole {
                child,
                hwnd: embedded_hwnd,
                owner_hwnd: owner_hwnd.0 as isize,
                vm_name: name.to_string(),
            });
        }
        return Ok(
            serde_json::json!({"ok":true,"embedded":true,"mode":"native_dock","vm_name":name,"hwnd":embedded_hwnd,"zoom":applied_zoom}),
        );
    }

    #[cfg(not(windows))]
    Err("Console local do Hyper-V disponivel apenas no Windows.".to_string())
}

#[tauri::command]
fn resize_embedded_hyperv_console(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    visible: bool,
) -> Result<Value, String> {
    #[cfg(windows)]
    {
        let guard = EMBEDDED_HYPERV_CONSOLE
            .lock()
            .map_err(|_| "Console local indisponivel.".to_string())?;
        let Some(console) = guard.as_ref() else {
            return Ok(serde_json::json!({"ok":true,"active":false}));
        };
        let window = HWND(console.hwnd as *mut std::ffi::c_void);
        let owner = HWND(console.owner_hwnd as *mut std::ffi::c_void);
        unsafe {
            if !IsWindow(window).as_bool() {
                return Ok(serde_json::json!({"ok":true,"active":false}));
            }
            if visible {
                dock_hyperv_console_window(window, owner, x, y, width, height)?;
            } else {
                let _ = ShowWindow(window, SW_HIDE);
            }
        }
        return Ok(
            serde_json::json!({"ok":true,"active":true,"visible":visible,"vm_name":console.vm_name}),
        );
    }
    #[cfg(not(windows))]
    Ok(serde_json::json!({"ok":true,"active":false}))
}

#[tauri::command]
fn get_embedded_hyperv_console_frame() -> Result<Value, String> {
    #[cfg(windows)]
    {
        let guard = EMBEDDED_HYPERV_CONSOLE
            .lock()
            .map_err(|_| "Console local indisponivel.".to_string())?;
        let Some(console) = guard.as_ref() else {
            return Err("Nenhum console local do Hyper-V esta ativo.".to_string());
        };
        let window = HWND(console.hwnd as *mut std::ffi::c_void);
        unsafe {
            if !IsWindow(window).as_bool() {
                return Err("A janela do console local foi encerrada.".to_string());
            }
            let mut rect = RECT::default();
            GetWindowRect(window, &mut rect)
                .map_err(|err| format!("Nao foi possivel medir o console: {err}"))?;
            let width = (rect.right - rect.left).max(1);
            let height = (rect.bottom - rect.top).max(1);
            let pixel_count = (width as usize)
                .checked_mul(height as usize)
                .ok_or_else(|| "Console grande demais para captura.".to_string())?;
            let mut bgra = vec![0u8; pixel_count * 4];

            let window_dc = GetDC(window);
            if window_dc.0.is_null() {
                return Err("Nao foi possivel acessar a imagem do console.".to_string());
            }
            let memory_dc = CreateCompatibleDC(window_dc);
            let bitmap = CreateCompatibleBitmap(window_dc, width, height);
            if memory_dc.0.is_null() || bitmap.0.is_null() {
                if !bitmap.0.is_null() {
                    let _ = DeleteObject(HGDIOBJ(bitmap.0));
                }
                if !memory_dc.0.is_null() {
                    let _ = DeleteDC(memory_dc);
                }
                let _ = ReleaseDC(window, window_dc);
                return Err("Nao foi possivel preparar a captura do console.".to_string());
            }
            let old_object = SelectObject(memory_dc, HGDIOBJ(bitmap.0));
            let printed = PrintWindow(window, memory_dc, PRINT_WINDOW_FLAGS(2)).as_bool();
            let mut bitmap_info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                bmiColors: [RGBQUAD::default(); 1],
            };
            let lines = if printed {
                GetDIBits(
                    memory_dc,
                    HBITMAP(bitmap.0),
                    0,
                    height as u32,
                    Some(bgra.as_mut_ptr() as *mut _),
                    &mut bitmap_info,
                    DIB_RGB_COLORS,
                )
            } else {
                0
            };
            let _ = SelectObject(memory_dc, old_object);
            let _ = DeleteObject(HGDIOBJ(bitmap.0));
            let _ = DeleteDC(memory_dc);
            let _ = ReleaseDC(window, window_dc);
            if !printed || lines == 0 {
                return Err("O Hyper-V ainda nao disponibilizou um quadro da VM.".to_string());
            }

            for pixel in bgra.chunks_exact_mut(4) {
                pixel.swap(0, 2);
                pixel[3] = 255;
            }
            let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, bgra)
                .ok_or_else(|| "Nao foi possivel montar o quadro do console.".to_string())?;
            let max_width = 1280u32;
            let scaled = if image.width() > max_width {
                let target_height = ((image.height() as f64)
                    * (max_width as f64 / image.width() as f64))
                    .round()
                    .max(1.0) as u32;
                image::imageops::resize(&image, max_width, target_height, FilterType::Triangle)
            } else {
                image
            };
            let mut bytes = Vec::new();
            JpegEncoder::new_with_quality(&mut bytes, 60)
                .encode_image(&scaled)
                .map_err(|err| format!("Nao foi possivel compactar o quadro do console: {err}"))?;
            return Ok(serde_json::json!({
                "ok": true,
                "mime": "image/jpeg",
                "data": general_purpose::STANDARD.encode(bytes),
                "width": scaled.width(),
                "height": scaled.height(),
                "vm_name": console.vm_name,
                "captured_at": now_millis()
            }));
        }
    }
    #[cfg(not(windows))]
    Err("Captura do console local disponivel apenas no Windows.".to_string())
}

#[tauri::command]
fn close_embedded_hyperv_console() -> Result<Value, String> {
    #[cfg(windows)]
    close_embedded_hyperv_console_native();
    Ok(serde_json::json!({"ok":true,"active":false}))
}

/* Legacy implementation kept out of the build while persisted agent data migrates. */
#[cfg(any())]
fn virtualbox_manage_program() -> PathBuf {
    let env_candidates = ["VBOX_MSI_INSTALL_PATH", "VBOX_INSTALL_PATH"]
        .iter()
        .filter_map(|key| std::env::var_os(key))
        .map(PathBuf::from)
        .map(|path| path.join("VBoxManage.exe"));
    let fixed_candidates = [
        PathBuf::from(r"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Oracle\VirtualBox\VBoxManage.exe"),
    ];

    env_candidates
        .chain(fixed_candidates)
        .find(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("VBoxManage"))
}

#[cfg(any())]
fn run_virtualbox_manage(args: &[String]) -> Result<(String, String), String> {
    let mut command = Command::new(virtualbox_manage_program());
    command.args(args);
    configure_no_window(&mut command);
    let output = command.output().map_err(|err| {
        format!("Nao foi possivel executar o VirtualBox. Verifique se ele esta instalado. Detalhe: {err}")
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok((stdout, stderr))
    } else {
        Err(if stderr.is_empty() {
            format!("O VirtualBox recusou o comando: {}", args.join(" "))
        } else {
            stderr
        })
    }
}

#[cfg(any())]
fn flowdetect_nat_port(machine_info: &str) -> Option<u16> {
    machine_info.lines().find_map(|line| {
        if !line.contains("flowdetect-agent") {
            return None;
        }
        let value = line.split_once('=')?.1.trim().trim_matches('"');
        let fields: Vec<&str> = value.split(',').collect();
        (fields.len() >= 4 && fields[0] == "flowdetect-agent")
            .then(|| fields[3].parse::<u16>().ok())
            .flatten()
    })
}

#[cfg(any())]
fn available_agent_host_port(preferred_port: Option<u16>) -> Result<u16, String> {
    let start = preferred_port.filter(|port| *port >= 1024).unwrap_or(18453);
    (start..=start.saturating_add(200))
        .find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
        .ok_or_else(|| "Nao encontrei uma porta local livre para conectar o Agent.".to_string())
}

#[cfg(any())]
#[tauri::command]
fn configure_virtualbox_agent_network(
    vm_name: String,
    preferred_port: Option<u16>,
) -> Result<Value, String> {
    let trimmed_name = vm_name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome da VM do VirtualBox.".to_string());
    }
    let (machine_info, _) = run_virtualbox_manage(&[
        "showvminfo".into(),
        trimmed_name.into(),
        "--machinereadable".into(),
    ])?;
    let existing_port = flowdetect_nat_port(&machine_info);
    let host_port = existing_port.unwrap_or(available_agent_host_port(preferred_port)?);
    if existing_port.is_none() {
        let rule = format!("flowdetect-agent,tcp,127.0.0.1,{host_port},,18452");
        let modify_result = run_virtualbox_manage(&[
            "modifyvm".into(),
            trimmed_name.into(),
            "--natpf1".into(),
            rule.clone(),
        ]);
        if modify_result.is_err() {
            run_virtualbox_manage(&[
                "controlvm".into(),
                trimmed_name.into(),
                "natpf1".into(),
                rule,
            ])?;
        }
    }
    Ok(serde_json::json!({
        "ok": true,
        "vm_name": trimmed_name,
        "host_port": host_port,
        "guest_port": 18452,
        "address": format!("127.0.0.1:{host_port}"),
        "reused": existing_port.is_some(),
    }))
}

#[cfg(any())]
#[tauri::command]
fn start_virtualbox_vm_headless(vm_name: String) -> Result<Value, String> {
    let trimmed_name = vm_name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome da VM do VirtualBox.".to_string());
    }

    let vbox_manage = virtualbox_manage_program();
    let mut command = Command::new(&vbox_manage);
    command
        .arg("startvm")
        .arg(trimmed_name)
        .arg("--type")
        .arg("headless");
    configure_no_window(&mut command);

    let output = command
        .output()
        .map_err(|err| {
            format!(
                "Nao foi possivel executar o VirtualBox. Verifique se ele esta instalado. Detalhe: {err}"
            )
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let already_running = stderr.to_lowercase().contains("already locked")
        || stderr.to_lowercase().contains("is already running")
        || stdout.to_lowercase().contains("already running");

    if output.status.success() || already_running {
        return Ok(serde_json::json!({
            "ok": true,
            "vm_name": trimmed_name,
            "mode": "headless",
            "already_running": already_running,
            "stdout": stdout,
            "stderr": stderr,
        }));
    }

    Err(if stderr.is_empty() {
        format!("Falha ao iniciar a VM {trimmed_name}.")
    } else {
        stderr
    })
}

#[cfg(any())]
#[tauri::command]
fn list_virtualbox_vms() -> Result<Value, String> {
    let vbox_manage = virtualbox_manage_program();
    let mut command = Command::new(&vbox_manage);
    command.arg("list").arg("vms");
    configure_no_window(&mut command);

    let output = command
        .output()
        .map_err(|err| {
            format!(
                "Nao foi possivel executar o VirtualBox. Verifique se ele esta instalado. Detalhe: {err}"
            )
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        return Err(if stderr.is_empty() {
            "Nao foi possivel listar as VMs do VirtualBox.".to_string()
        } else {
            stderr
        });
    }

    let items: Vec<Value> = stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let name = trimmed
                .strip_prefix('"')
                .and_then(|value| value.split('"').next())
                .unwrap_or(trimmed)
                .trim();
            let uuid = trimmed
                .rsplit_once('{')
                .and_then(|(_, tail)| tail.strip_suffix('}'))
                .unwrap_or("")
                .trim();
            if name.is_empty() {
                None
            } else {
                Some(serde_json::json!({
                    "name": name,
                    "uuid": uuid,
                }))
            }
        })
        .collect();

    Ok(serde_json::json!({
        "ok": true,
        "vbox_manage": vbox_manage.to_string_lossy(),
        "items": items,
    }))
}

fn local_python_candidates(root: &Path) -> Vec<PathBuf> {
    let mut local_candidates = Vec::<PathBuf>::new();
    // O Agent reutiliza este runtime do Studio. Em desenvolvimento, `root`
    // aponta para a raiz do repositorio, enquanto o Python portatil esta no
    // suporte do instalador (ou no target do Agent), nao ao lado dos scripts.
    // Inclua esses caminhos antes de procurar um Python global do Windows.
    local_candidates.push(
        root.join("tauri_gerador")
            .join("src-tauri")
            .join("installer_support")
            .join("python_runtime_prebuilt")
            .join("python.exe"),
    );
    for profile in ["debug", "release"] {
        local_candidates.push(
            root.join("flowdetect_agent")
                .join("target")
                .join(profile)
                .join("python_runtime")
                .join("python.exe"),
        );
        local_candidates.push(
            root.join("tauri_gerador")
                .join("target")
                .join(profile)
                .join("python_runtime")
                .join("python.exe"),
        );
    }
    local_candidates.push(root.join("python_runtime").join("python.exe"));
    local_candidates.push(
        root.join("resources")
            .join("python_runtime")
            .join("python.exe"),
    );
    if let Some(parent) = root.parent() {
        local_candidates.push(
            parent
                .join("resources")
                .join("python_runtime")
                .join("python.exe"),
        );
        local_candidates.push(parent.join("python_runtime").join("python.exe"));
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            local_candidates.push(
                exe_dir
                    .join("resources")
                    .join("python_runtime")
                    .join("python.exe"),
            );
            local_candidates.push(exe_dir.join("python_runtime").join("python.exe"));
            if let Some(parent) = exe_dir.parent() {
                local_candidates.push(
                    parent
                        .join("resources")
                        .join("python_runtime")
                        .join("python.exe"),
                );
                local_candidates.push(parent.join("python_runtime").join("python.exe"));
            }
        }
    }
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data);
        for product in ["FlowDetect Agent", "FlowDetect Studio", "FlowDetect"] {
            local_candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("resources")
                    .join("python_runtime")
                    .join("python.exe"),
            );
            local_candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("python_runtime")
                    .join("python.exe"),
            );
        }
    }
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data)
            .join("Programs")
            .join("Python");
        for version in ["Python312", "Python313", "Python311", "Python310"] {
            local_candidates.push(base.join(version).join("python.exe"));
        }
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        let base = PathBuf::from(program_files);
        for version in ["Python312", "Python313", "Python311", "Python310"] {
            local_candidates.push(base.join(version).join("python.exe"));
        }
    }
    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        let base = PathBuf::from(program_files_x86);
        for version in [
            "Python312-32",
            "Python313-32",
            "Python311-32",
            "Python310-32",
        ] {
            local_candidates.push(base.join(version).join("python.exe"));
        }
    }
    local_candidates
}

fn probe_local_python(root: &Path) -> Option<(String, Vec<String>)> {
    for python_path in local_python_candidates(root) {
        if !python_path.exists() {
            continue;
        }
        let mut command = Command::new(&python_path);
        command.arg("--version").current_dir(root);
        configure_no_window(&mut command);
        let probe = command.output();
        if probe.map(|out| out.status.success()).unwrap_or(false) {
            return Some((
                python_path.to_string_lossy().to_string(),
                Vec::<String>::new(),
            ));
        }
    }
    None
}

fn python_installer_candidates(root: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();
    candidates.push(root.join("python-installer.exe"));
    candidates.push(root.join("resources").join("python-installer.exe"));
    candidates.push(
        root.join("tauri_gerador")
            .join("src-tauri")
            .join("installer_support")
            .join("python-installer.exe"),
    );
    if let Some(parent) = root.parent() {
        candidates.push(parent.join("resources").join("python-installer.exe"));
        candidates.push(
            parent
                .join("tauri_gerador")
                .join("src-tauri")
                .join("installer_support")
                .join("python-installer.exe"),
        );
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("resources").join("python-installer.exe"));
            candidates.push(exe_dir.join("python-installer.exe"));
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.join("resources").join("python-installer.exe"));
                candidates.push(parent.join("python-installer.exe"));
            }
        }
    }
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data);
        for product in ["FlowDetect Agent", "FlowDetect Studio", "FlowDetect"] {
            candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("resources")
                    .join("python-installer.exe"),
            );
            candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("python-installer.exe"),
            );
        }
    }
    candidates
}

fn python_wheels_candidates(root: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();
    candidates.push(root.join("python-wheels"));
    candidates.push(root.join("resources").join("python-wheels"));
    candidates.push(
        root.join("tauri_gerador")
            .join("src-tauri")
            .join("installer_support")
            .join("python-wheels"),
    );
    if let Some(parent) = root.parent() {
        candidates.push(parent.join("resources").join("python-wheels"));
        candidates.push(
            parent
                .join("tauri_gerador")
                .join("src-tauri")
                .join("installer_support")
                .join("python-wheels"),
        );
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("resources").join("python-wheels"));
            candidates.push(exe_dir.join("python-wheels"));
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.join("resources").join("python-wheels"));
                candidates.push(parent.join("python-wheels"));
            }
        }
    }
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data);
        for product in ["FlowDetect Agent", "FlowDetect Studio", "FlowDetect"] {
            candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("resources")
                    .join("python-wheels"),
            );
            candidates.push(
                base.join("Programs")
                    .join(product)
                    .join("python-wheels"),
            );
        }
    }
    candidates
}

fn command_output_detail(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        stderr
    } else {
        stdout
    }
}

fn python_module_available(root: &Path, program: &str, args: &[String], module_name: &str) -> bool {
    let mut command = Command::new(program);
    command
        .current_dir(root)
        .args(args)
        .args(["-c", &format!("import {module_name}")]);
    configure_no_window(&mut command);
    command
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn run_pip_install(
    root: &Path,
    program: &str,
    args: &[String],
    requirements: &Path,
    wheels_dir: Option<&Path>,
) -> Result<(), String> {
    let mut pip = Command::new(program);
    pip.current_dir(root)
        .args(args)
        .args(["-m", "pip", "install", "-r"])
        .arg(requirements)
        .args(["--prefer-binary", "--disable-pip-version-check"]);
    if let Some(dir) = wheels_dir {
        pip.args(["--no-index", "--find-links"]).arg(dir);
    }
    configure_no_window(&mut pip);
    let output = pip
        .output()
        .map_err(|err| format!("Falha ao instalar dependencias Python: {err}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let detail = command_output_detail(&output);
        Err(if detail.is_empty() {
            "Falha ao instalar dependencias Python.".to_string()
        } else {
            format!("Falha ao instalar dependencias Python: {detail}")
        })
    }
}

fn install_requirements_with_command(
    root: &Path,
    program: &str,
    args: &[String],
) -> Result<(), String> {
    let requirements = root.join("requirements.txt");
    if !requirements.exists() {
        return Err(format!(
            "requirements.txt nao encontrado em {}.",
            root.display()
        ));
    }

    let wheels = python_wheels_candidates(root)
        .into_iter()
        .find(|path| path.exists());

    let mut ensurepip = Command::new(program);
    ensurepip
        .current_dir(root)
        .args(args)
        .args(["-m", "ensurepip", "--upgrade"]);
    configure_no_window(&mut ensurepip);
    let _ = ensurepip.output();

    if let Some(wheels_dir) = wheels.as_deref() {
        match run_pip_install(root, program, args, &requirements, Some(wheels_dir)) {
            Ok(()) => return Ok(()),
            Err(offline_err) => {
                if let Err(online_err) = run_pip_install(root, program, args, &requirements, None) {
                    return Err(format!(
                        "{online_err}\nTentativa offline tambem falhou: {offline_err}"
                    ));
                }
                return Ok(());
            }
        }
    }

    run_pip_install(root, program, args, &requirements, None)
}

fn install_requirements_with_python(root: &Path, python_path: &Path) -> Result<(), String> {
    install_requirements_with_command(root, &python_path.to_string_lossy(), &[])
}

fn ensure_python_dependencies(root: &Path, program: &str, args: &[String]) -> Result<(), String> {
    if PYTHON_DEPS_READY.load(Ordering::SeqCst) {
        return Ok(());
    }

    if python_module_available(root, program, args, "openpyxl") {
        PYTHON_DEPS_READY.store(true, Ordering::SeqCst);
        return Ok(());
    }

    install_requirements_with_command(root, program, args)?;

    if python_module_available(root, program, args, "openpyxl") {
        PYTHON_DEPS_READY.store(true, Ordering::SeqCst);
        Ok(())
    } else {
        Err("Python encontrado, mas o pacote openpyxl nao ficou disponivel apos instalar as dependencias.".to_string())
    }
}

fn try_bootstrap_local_python(root: &Path) -> Result<(), String> {
    if PYTHON_BOOTSTRAP_ATTEMPTED.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let installer_script = root.join("instalar_dependencias_silencioso.bat");
    if !installer_script.exists() {
        // Em builds instalados o .bat fica em resources. Em dev, caia no instalador direto abaixo.
    } else {
        let mut command = Command::new("cmd");
        command.current_dir(root).arg("/C").arg(&installer_script);
        configure_no_window(&mut command);
        if command.status().map(|status| status.success()).unwrap_or(false) {
            return Ok(());
        }
    }

    let installer = python_installer_candidates(root)
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| "Nenhum interpretador Python compativel foi encontrado.".to_string())?;
    let python_dir = root.join("python_runtime");
    fs::create_dir_all(&python_dir)
        .map_err(|err| format!("Falha ao criar runtime Python local: {err}"))?;

    let target_dir_arg = format!("TargetDir={}", python_dir.to_string_lossy());
    let installer_log_arg = format!(
        "{}",
        root.join("python_installer_runtime.log").to_string_lossy()
    );
    let mut command = Command::new(&installer);
    command
        .current_dir(root)
        .args([
            "/quiet",
            "/log",
            &installer_log_arg,
            "InstallAllUsers=0",
            "AssociateFiles=0",
            "PrependPath=0",
            "AppendPath=0",
            "Shortcuts=0",
            "Include_doc=0",
            "Include_test=0",
            "Include_tools=0",
            "Include_launcher=0",
            "InstallLauncherAllUsers=0",
            "Include_pip=1",
            "Include_tcltk=1",
        ])
        .arg(target_dir_arg);
    configure_no_window(&mut command);
    let status = command
        .status()
        .map_err(|err| format!("Falha ao instalar Python local do FlowDetect: {err}"))?;
    if !status.success() && status.code() != Some(3010) {
        return Err(format!(
            "Falha ao instalar Python local do FlowDetect. Codigo: {:?}. Log: {}",
            status.code(),
            installer_log_arg
        ));
    }

    let python_exe = python_dir.join("python.exe");
    let mut ready = false;
    for _ in 0..60 {
        if python_exe.exists() {
            let mut version_check = Command::new(&python_exe);
            version_check.arg("--version");
            configure_no_window(&mut version_check);
            if version_check.status().map(|status| status.success()).unwrap_or(false) {
                ready = true;
                break;
            }
        }
        thread::sleep(Duration::from_secs(1));
    }

    if !ready {
        return Err(format!(
            "Python local nao ficou pronto apos a instalacao. Log: {}",
            installer_log_arg
        ));
    }

    install_requirements_with_python(root, &python_exe)?;
    Ok(())
}

fn python_command(root: &PathBuf) -> Result<(String, Vec<String>), String> {
    if let Some((program, args)) = PYTHON_COMMAND_CACHE.get() {
        return Ok((program.clone(), args.clone()));
    }

    if let Some(detected) = probe_local_python(root) {
        let _ = PYTHON_COMMAND_CACHE.set(detected.clone());
        return Ok(detected);
    }

    if python_installer_candidates(root).into_iter().any(|path| path.exists()) {
        try_bootstrap_local_python(root)?;
        if let Some(detected) = probe_local_python(root) {
            let _ = PYTHON_COMMAND_CACHE.set(detected.clone());
            return Ok(detected);
        }
    }

    let candidates = [
        ("python", Vec::<String>::new()),
        ("py", vec!["-3".to_string()]),
    ];

    for (program, args) in candidates {
        let mut command = Command::new(program);
        command.args(&args).arg("--version").current_dir(root);
        configure_no_window(&mut command);
        let probe = command.output();
        if probe.map(|out| out.status.success()).unwrap_or(false) {
            let detected = (program.to_string(), args);
            let _ = PYTHON_COMMAND_CACHE.set(detected.clone());
            return Ok(detected);
        }
    }

    try_bootstrap_local_python(root)?;
    if let Some(detected) = probe_local_python(root) {
        let _ = PYTHON_COMMAND_CACHE.set(detected.clone());
        return Ok(detected);
    }

    Err("Nenhum interpretador Python compativel foi encontrado.".to_string())
}

fn python_command_for_visual_feedback(root: &PathBuf) -> Result<(String, Vec<String>), String> {
    fn supports_capture_ui(root: &Path, program: &str, args: &[String]) -> bool {
        python_module_available(root, program, args, "tkinter")
            && python_module_available(root, program, args, "PIL.ImageTk")
            && python_module_available(root, program, args, "pyautogui")
            && python_module_available(root, program, args, "openpyxl")
    }

    if let Ok((program, args)) = python_command(root) {
        if supports_capture_ui(root, &program, &args) {
            return Ok((program, args));
        }
    }

    let mut checked = std::collections::HashSet::<PathBuf>::new();
    let mut try_local_candidates = || -> Option<(String, Vec<String>)> {
        for candidate in local_python_candidates(root) {
            if !candidate.exists() || !checked.insert(candidate.clone()) {
                continue;
            }
            let program = candidate.to_string_lossy().to_string();
            if supports_capture_ui(root, &program, &[]) {
                return Some((program, Vec::new()));
            }
        }
        None
    };

    if let Some(command) = try_local_candidates() {
        return Ok(command);
    }

    for (program, args) in [
        ("python".to_string(), Vec::<String>::new()),
        ("py".to_string(), vec!["-3".to_string()]),
    ] {
        if supports_capture_ui(root, &program, &args) {
            return Ok((program, args));
        }
    }

    if python_installer_candidates(root).into_iter().any(|path| path.exists()) {
        try_bootstrap_local_python(root)?;
        if let Some(command) = try_local_candidates() {
            return Ok(command);
        }
    }

    Err(
        "O feedback visual precisa de um Python com suporte a interface grafica (Tk). \
         Instale ou repare o runtime Python do FlowDetect e tente novamente."
            .to_string(),
    )
}

fn bundled_python_script_bytes(script_name: &str) -> Option<&'static [u8]> {
    match script_name.replace('\\', "/").as_str() {
        "capturar_cliques.py" => Some(BUNDLED_CAPTURAR_CLIQUES),
        "capturar_imagem_tela.py" => Some(BUNDLED_CAPTURAR_IMAGEM_TELA),
        "chrome_web_bridge.py" => Some(BUNDLED_CHROME_WEB_BRIDGE),
        "comandos_teclado.py" => Some(BUNDLED_COMANDOS_TECLADO),
        "executar_automacao.py" => Some(BUNDLED_EXECUTAR_AUTOMACAO),
        "gerenciar_dados_planilha.py" => Some(BUNDLED_GERENCIAR_DADOS_PLANILHA),
        "gerenciar_roteiro.py" => Some(BUNDLED_GERENCIAR_ROTEIRO),
        "listar_janelas_abertas.py" => Some(BUNDLED_LISTAR_JANELAS_ABERTAS),
        "mapear_elementos_janela.py" => Some(BUNDLED_MAPEAR_ELEMENTOS_JANELA),
        "overlay_automacao_tela.py" => Some(BUNDLED_OVERLAY_AUTOMACAO_TELA),
        "overlay_janela_alvo.py" => Some(BUNDLED_OVERLAY_JANELA_ALVO),
        "reconhecimento_worker.py" => Some(BUNDLED_RECONHECIMENTO_WORKER),
        "validar_dependencias_instaladas.py" => Some(BUNDLED_VALIDAR_DEPENDENCIAS),
        _ => None,
    }
}

fn python_script_repair_reason(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(Some("arquivo ausente".to_string()));
    }
    let bytes = fs::read(path)
        .map_err(|err| format!("Falha ao ler script Python {}: {err}", path.display()))?;
    if bytes.is_empty() {
        return Ok(Some("arquivo vazio".to_string()));
    }
    if bytes.iter().any(|byte| *byte == 0) {
        return Ok(Some("arquivo contem bytes nulos".to_string()));
    }
    if bytes.starts_with(b"MZ") || bytes.starts_with(b"PK\x03\x04") {
        return Ok(Some("arquivo nao parece ser codigo Python".to_string()));
    }
    Ok(None)
}

fn ensure_python_script_integrity(root: &PathBuf, script_name: &str) -> Result<PathBuf, String> {
    let script_path = root.join(script_name);
    let Some(bundled_bytes) = bundled_python_script_bytes(script_name) else {
        if script_path.exists() {
            return Ok(script_path);
        }
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    };

    if let Some(reason) = python_script_repair_reason(&script_path)? {
        fs::create_dir_all(root)
            .map_err(|err| format!("Falha ao preparar pasta do runtime FlowDetect: {err}"))?;
        if script_path.exists() {
            let backup_name = format!(
                "{}.corrompido.{}",
                script_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("script.py"),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            );
            let backup_path = script_path.with_file_name(backup_name);
            let _ = fs::copy(&script_path, backup_path);
        }
        fs::write(&script_path, bundled_bytes).map_err(|err| {
            format!(
                "Falha ao reparar {} ({reason}) usando a copia embutida: {err}",
                script_path.display()
            )
        })?;
        append_launcher_log(
            root,
            format!(
                "[FlowDetect] Script reparado automaticamente: {} ({reason})",
                script_path.display()
            ),
        );
    }
    Ok(script_path)
}

fn run_python_script(
    root: &PathBuf,
    script_name: &str,
    extra_args: &[String],
) -> Result<String, String> {
    let script_path = ensure_python_script_integrity(root, script_name)?;

    let (mut python_program, mut python_args) = python_command(root)?;
    if let Err(first_error) = ensure_python_dependencies(root, &python_program, &python_args) {
        try_bootstrap_local_python(root)?;
        if let Some((fallback_program, fallback_args)) = probe_local_python(root) {
            ensure_python_dependencies(root, &fallback_program, &fallback_args).map_err(
                |fallback_error| {
                    format!(
                        "{fallback_error}\nFalha anterior usando o Python detectado: {first_error}"
                    )
                },
            )?;
            python_program = fallback_program;
            python_args = fallback_args;
        } else {
            return Err(first_error);
        }
    }
    let mut command = Command::new(&python_program);
    command
        .current_dir(root)
        .args(&python_args)
        .arg(&script_path)
        .args(extra_args);
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Falha ao executar {script_name}: {err}"))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if !stderr.is_empty() { stderr } else { stdout };
    Err(if message.is_empty() {
        format!("Falha ao executar {script_name}.")
    } else {
        message
    })
}

fn run_helper_json(root: &PathBuf, args: &[String]) -> Result<Value, String> {
    let raw = run_python_script(root, "gerenciar_roteiro.py", args)?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar retorno do gerador: {err}"))
}

fn run_chrome_bridge_json(root: &PathBuf, args: &[String]) -> Result<Value, String> {
    let raw = run_python_script(root, "chrome_web_bridge.py", args)?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar retorno do Chrome/Web: {err}"))
}

fn run_uia_mapper_json(root: &PathBuf, args: &[String]) -> Result<Value, String> {
    let raw = run_python_script(root, "mapear_elementos_janela.py", args)?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar retorno do mapeador de janela: {err}"))
}

fn launch_executor_for_current_root(
    app: &AppHandle,
    state: &State<'_, RuntimeState>,
    mode: &str,
    delay: f64,
    loop_start: i32,
    window_title: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(app);
    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        append_launcher_log(
            &root,
            format!("ERRO: executor nao encontrado em {}", script_path.display()),
        );
        return Err(format!(
            "Nenhum executor de automacao foi encontrado. Esperado: {}",
            script_path.display()
        ));
    }

    let (python_program, python_args) = python_command(&root)?;
    append_launcher_log(
        &root,
        format!(
            "Python detectado: {} {}",
            python_program,
            python_args.join(" ")
        ),
    );

    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg(mode)
        .arg("--atraso")
        .arg(delay.max(0.0).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));

    if let Some(title) = window_title
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--janela-alvo").arg(title);
    }

    if mode == "loop" {
        command
            .arg("--loop-start")
            .arg(loop_start.max(1).to_string());
    }

    let message = if mode == "loop" {
        format!(
            "Teste com loop iniciado no proprio launcher. O executor vai procurar a linha {} com atraso inicial de {}s.",
            loop_start.max(1),
            delay.max(0.0),
        )
    } else {
        format!(
            "Teste simples iniciado no proprio launcher. A automacao vai executar uma vez com atraso inicial de {}s.",
            delay.max(0.0),
        )
    };

    let label = if mode == "loop" {
        "o teste direto com loop"
    } else {
        "o teste simples"
    };

    spawn_test_process(app, state, command, message, label)
}

fn run_script_json(root: &PathBuf, script_name: &str, args: &[String]) -> Result<Value, String> {
    let raw = run_python_script(root, script_name, args)?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar retorno de {script_name}: {err}"))?;

    if let Some(message) = parsed.get("erro").and_then(Value::as_str) {
        return Err(message.to_string());
    }

    Ok(parsed)
}

fn run_screen_capture_script_json(root: &PathBuf, args: &[String]) -> Result<Value, String> {
    let script_name = "capturar_imagem_tela.py";
    let script_path = ensure_python_script_integrity(root, script_name)?;
    let (python_program, python_args) = python_command_for_visual_feedback(root)?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(root)
        .args(&python_args)
        .arg(&script_path)
        .args(args);
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Falha ao executar {script_name}: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if message.is_empty() {
            format!("Falha ao executar {script_name}.")
        } else {
            message
        });
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar retorno de {script_name}: {err}"))?;
    if let Some(message) = parsed.get("erro").and_then(Value::as_str) {
        return Err(message.to_string());
    }
    Ok(parsed)
}

fn read_remote_spreadsheet_preview(root: &PathBuf, limit: i64) -> Result<Value, String> {
    let (python_program, python_args) = python_command(root)?;
    let script = r#"
import json
import sys
from pathlib import Path
from openpyxl import load_workbook

root = Path(sys.argv[1])
limit = max(1, min(200, int(float(sys.argv[2])) if len(sys.argv) > 2 else 80))
mapping_path = root / "mapeamento_teclado.json"
if not mapping_path.exists():
    print(json.dumps({"available": False, "message": "Nenhuma automacao aberta no Agent."}, ensure_ascii=False))
    raise SystemExit(0)

payload = json.loads(mapping_path.read_text(encoding="utf-8"))
events = payload.get("eventos") or []
sheet_event = next((event for event in events if event.get("tipo") == "sequencia_planilha"), None)
write_events = [event for event in events if event.get("tipo") == "escrever_planilha"]

def normalize_workbook(value):
    text = str(value or "db.xlsx").replace("\\", "/").strip() or "db.xlsx"
    return text

def resolve_workbook(value):
    workbook_id = normalize_workbook(value)
    path = Path(workbook_id)
    if path.is_absolute():
        return path, workbook_id
    direct = root / workbook_id
    if direct.exists():
        return direct, workbook_id
    if "/" not in workbook_id and "\\" not in workbook_id and workbook_id != "db.xlsx":
        alternative = root / "planilhas" / workbook_id
        if alternative.exists():
            return alternative, f"planilhas/{workbook_id}"
    return direct, workbook_id

def workbook_is_usable(path):
    return path.exists() and path.suffix.lower() in {".xlsx", ".xlsm"} and not path.name.startswith("~$")

if sheet_event:
    details = sheet_event.get("detalhes") or {}
    workbook_path, workbook_id = resolve_workbook(details.get("arquivo"))
    sheet_name = str(details.get("aba") or "").strip()
else:
    workbook_candidates = [root / "db.xlsx"]
    if (root / "planilhas").exists():
        workbook_candidates.extend(sorted((root / "planilhas").glob("*.xlsx")))
        workbook_candidates.extend(sorted((root / "planilhas").glob("*.xlsm")))
    workbook_path = next((path for path in workbook_candidates if workbook_is_usable(path)), root / "db.xlsx")
    workbook_id = str(workbook_path.relative_to(root)).replace("\\", "/") if workbook_path.exists() and root in workbook_path.parents else workbook_path.name
    sheet_name = ""

if not workbook_is_usable(workbook_path):
    print(json.dumps({"available": False, "message": f"Planilha nao encontrada: {workbook_id}"}, ensure_ascii=False))
    raise SystemExit(0)

try:
    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
except Exception as exc:
    print(json.dumps({
        "available": False,
        "message": "Nao foi possivel ler a planilha. Feche o Excel, salve o arquivo novamente e clique em Atualizar planilha.",
        "detail": str(exc),
        "workbook_id": workbook_id,
    }, ensure_ascii=False))
    raise SystemExit(0)
try:
    if not sheet_name:
        sheet_name = workbook.sheetnames[0] if workbook.sheetnames else ""
    if sheet_name not in workbook.sheetnames:
        print(json.dumps({"available": False, "message": f"Aba nao encontrada: {sheet_name}"}, ensure_ascii=False))
        raise SystemExit(0)
    worksheet = workbook[sheet_name]
    if not hasattr(worksheet, "iter_rows"):
        print(json.dumps({"available": False, "message": f"Aba nao editavel: {sheet_name}"}, ensure_ascii=False))
        raise SystemExit(0)
    rows_iter = worksheet.iter_rows(values_only=True)
    headers = [str(value).strip() if value is not None and str(value).strip() else f"Coluna {index + 1}" for index, value in enumerate(next(rows_iter, []))]
    write_columns = []
    for event in write_events:
        details = event.get("detalhes") or {}
        if normalize_workbook(details.get("arquivo")) == normalize_workbook(workbook_id) and str(details.get("aba") or sheet_name).strip() == sheet_name:
            column = str(details.get("coluna") or "").strip()
            if column and column not in write_columns:
                write_columns.append(column)
    for column in write_columns:
        if column not in headers:
            headers.append(column)
    rows = []
    for row_number, values in enumerate(rows_iter, start=2):
        item = {"row_number": row_number, "values": []}
        has_content = False
        for index, header in enumerate(headers):
            value = values[index] if index < len(values) else None
            if value is not None and str(value).strip():
                has_content = True
            item["values"].append("" if value is None else str(value))
        if has_content:
            rows.append(item)
        if len(rows) >= limit:
            break
    print(json.dumps({
        "available": True,
        "workbook_id": workbook_id,
        "sheet": sheet_name,
        "headers": headers,
        "rows": rows,
        "row_count": len(rows),
        "limited": len(rows) >= limit,
        "write_columns": write_columns,
    }, ensure_ascii=False))
finally:
    workbook.close()
"#;
    let mut command = Command::new(&python_program);
    command
        .current_dir(root)
        .args(&python_args)
        .arg("-c")
        .arg(script)
        .arg(root)
        .arg(limit.max(1).min(200).to_string());
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Falha ao ler planilha remota: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Falha ao gerar previa da planilha remota.".to_string()
        } else {
            stderr
        });
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar previa da planilha remota: {err}"))
}

#[tauri::command]
fn get_login_session(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let path = root.join("login_session.json");
    if !path.exists() {
        return Ok(serde_json::json!({"exists": false, "session": null}));
    }
    let text =
        fs::read_to_string(&path).map_err(|err| format!("Falha ao ler sessao local: {err}"))?;
    let session: Value =
        serde_json::from_str(&text).map_err(|err| format!("Sessao local invalida: {err}"))?;
    Ok(serde_json::json!({"exists": true, "session": session}))
}

#[tauri::command]
fn save_login_session(
    app: AppHandle,
    nome: String,
    email: String,
    activation_key: Option<String>,
    activation_id: Option<String>,
    expires_at: Option<String>,
    screen_width: Option<i32>,
    screen_height: Option<i32>,
    viewport_width: Option<i32>,
    viewport_height: Option<i32>,
    device_pixel_ratio: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let path = root.join("login_session.json");
    let session = serde_json::json!({
        "nome": nome,
        "email": email,
        "activation_key": activation_key.unwrap_or_else(|| "LOCAL-WELCOME".to_string()),
        "activation_id": activation_id.unwrap_or_else(|| "local-welcome".to_string()),
        "expires_at": expires_at.unwrap_or_default(),
        "screen_width": screen_width.unwrap_or_default(),
        "screen_height": screen_height.unwrap_or_default(),
        "viewport_width": viewport_width.unwrap_or_default(),
        "viewport_height": viewport_height.unwrap_or_default(),
        "device_pixel_ratio": device_pixel_ratio.unwrap_or(1.0),
    });
    let text = serde_json::to_string_pretty(&session)
        .map_err(|err| format!("Falha ao preparar sessao local: {err}"))?;
    fs::write(&path, text).map_err(|err| format!("Falha ao salvar sessao local: {err}"))?;
    Ok(serde_json::json!({"exists": true, "session": session}))
}

#[tauri::command]
fn export_saved_automation_zip(
    app: AppHandle,
    id: String,
    destino: Option<String>,
    destination_path: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["automation-export-zip".into(), "--id".into(), id];
    let output_path = destination_path.or(destino);
    if let Some(value) = output_path {
        if !value.trim().is_empty() {
            args.push("--destino".into());
            args.push(value);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn remote_agent_send_saved_automation(
    app: AppHandle,
    address: String,
    id: String,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let transfer_dir = std::env::temp_dir()
        .join("FlowDetect")
        .join("agent-transfers");
    fs::create_dir_all(&transfer_dir)
        .map_err(|err| format!("Falha ao preparar transferencia da automacao: {err}"))?;
    let requested_path = transfer_dir.join(format!("automation-{stamp}.zip"));
    let export_result = run_helper_json(
        &root,
        &[
            "automation-export-zip".into(),
            "--id".into(),
            id,
            "--destino".into(),
            requested_path.to_string_lossy().to_string(),
        ],
    )
    .map_err(|err| format!("Falha ao preparar o pacote no Studio: {err}"))?;
    let zip_path = export_result
        .get("zip_path")
        .and_then(Value::as_str)
        .map(PathBuf::from)
        .unwrap_or(requested_path);
    let bytes =
        fs::read(&zip_path).map_err(|err| format!("Falha ao ler a automacao exportada: {err}"))?;
    let file_name = zip_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("flowdetect-automation.zip")
        .to_string();
    let result = remote_agent_import_automation_zip(address, file_name, bytes)
        .map_err(|err| format!("Falha ao importar no Agent remoto: {err}"));
    let _ = fs::remove_file(&zip_path);
    result
}

#[tauri::command]
fn import_saved_automation_zip(app: AppHandle, arquivo: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &["automation-import-zip".into(), "--arquivo".into(), arquivo],
    )
}

#[tauri::command]
fn import_saved_automation_zip_from_path(app: AppHandle, path: String) -> Result<Value, String> {
    import_saved_automation_zip(app, path)
}

#[tauri::command]
fn import_saved_automation_zip_from_file_path(
    app: AppHandle,
    file_path: String,
) -> Result<Value, String> {
    import_saved_automation_zip(app, file_path)
}

#[tauri::command]
fn export_runtime_update_zip(app: AppHandle, destino: Option<String>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["runtime-export-zip".into()];
    if let Some(value) = destino {
        if !value.trim().is_empty() {
            args.push("--destino".into());
            args.push(value);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn import_runtime_update_zip(app: AppHandle, arquivo: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &["runtime-import-zip".into(), "--arquivo".into(), arquivo],
    )
}

#[tauri::command]
fn import_runtime_update_zip_from_path(app: AppHandle, path: String) -> Result<Value, String> {
    import_runtime_update_zip(app, path)
}

#[tauri::command]
fn get_recognition_image_preview(app: AppHandle, image_id: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    let normalized = image_id.replace('\\', "/");
    let relative = normalized.strip_prefix("imagens/").unwrap_or(&normalized);
    let path = root.join("Imagens").join(relative);
    let fallback = root.join("imagens").join(relative);
    let final_path = if path.exists() { path } else { fallback };
    if !final_path.exists() {
        return Err(format!("Imagem nao encontrada: {image_id}"));
    }
    let bytes = fs::read(&final_path)
        .map_err(|err| format!("Falha ao abrir imagem de preview ({image_id}): {err}"))?;
    let mime = image_mime_from_bytes(&final_path, &bytes);
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(serde_json::json!({
        "src": format!("data:{mime};base64,{encoded}"),
        "mime": mime,
        "file_name": final_path.file_name().and_then(|name| name.to_str()).unwrap_or("referencia.png"),
        "image_id": image_id,
    }))
}

#[tauri::command]
fn capture_image_asset(app: AppHandle, base_name_hint: Option<String>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["--pasta-projeto".into(), root.display().to_string()];
    if let Some(value) = base_name_hint {
        if !value.trim().is_empty() {
            args.push("--nome-base".into());
            args.push(value);
        }
    }
    let main_window = app.get_webview_window("main");
    if let Some(window) = main_window.as_ref() {
        let _ = window.minimize();
        thread::sleep(Duration::from_millis(450));
    }

    let result = run_screen_capture_script_json(&root, &args);

    if let Some(window) = main_window.as_ref() {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    result
}

#[tauri::command]
fn rename_image_asset(app: AppHandle, image_id: String, new_name: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    let normalized = image_id.replace('\\', "/");
    let relative = normalized.strip_prefix("imagens/").unwrap_or(&normalized);
    let source = root.join("Imagens").join(relative);
    if !source.exists() {
        return Err(format!("Imagem nao encontrada: {image_id}"));
    }
    let sanitized = sanitize_asset_filename(&new_name, "referencia.png");
    let destination = source
        .parent()
        .unwrap_or(&root.join("Imagens"))
        .join(&sanitized);
    fs::rename(&source, &destination).map_err(|err| format!("Falha ao renomear imagem: {err}"))?;
    Ok(serde_json::json!({
        "image_id": format!("imagens/{}", sanitized),
        "file_name": sanitized,
    }))
}

#[tauri::command]
fn open_images_folder(app: AppHandle) -> Result<String, String> {
    let root = workspace_root(&app);
    let path = root.join("Imagens");
    fs::create_dir_all(&path).map_err(|err| format!("Falha ao criar pasta de imagens: {err}"))?;
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|err| format!("Falha ao abrir pasta: {err}"))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn open_recognition_diagnostics_folder(app: AppHandle) -> Result<String, String> {
    let root = workspace_root(&app);
    let path = root.join("diagnosticos_reconhecimento");
    fs::create_dir_all(&path)
        .map_err(|err| format!("Falha ao criar pasta de diagnosticos: {err}"))?;
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|err| format!("Falha ao abrir pasta: {err}"))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn remove_workbook_preview_row(
    app: AppHandle,
    workbook: Option<String>,
    sheet: String,
    row_number: i32,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let workbook_path = workbook.unwrap_or_else(|| "db.xlsx".to_string());
    let removal_result = run_script_json(
        &root,
        "gerenciar_dados_planilha.py",
        &[
            "remover_planilha".into(),
            "--planilha".into(),
            workbook_path,
            "--aba".into(),
            sheet,
            "--linha".into(),
            row_number.to_string(),
        ],
    )?;
    let roadmap_result = run_helper_json(&root, &["sync-spreadsheets".into()])?;
    Ok(serde_json::json!({
        "ok": true,
        "removed": removal_result,
        "roadmap": roadmap_result,
    }))
}

fn clear_workbook_column_in_root(
    root: &PathBuf,
    workbook: String,
    sheet: String,
    column: String,
) -> Result<Value, String> {
    let workbook_path = resolve_safe_workbook_path(root, &workbook)?;
    let (python_program, python_args) = python_command(root)?;
    let script = r#"
import json
import sys
from openpyxl import load_workbook

workbook_path, sheet_name, column_name = sys.argv[1], sys.argv[2], sys.argv[3]
workbook = load_workbook(workbook_path)
try:
    if sheet_name not in workbook.sheetnames:
        raise ValueError(f"Aba nao encontrada: {sheet_name}")
    worksheet = workbook[sheet_name]
    if not hasattr(worksheet, "iter_rows"):
        raise ValueError(f"Aba nao editavel: {sheet_name}")
    headers = [
        str(value).strip() if value is not None else f"Coluna {index + 1}"
        for index, value in enumerate(next(worksheet.iter_rows(min_row=1, max_row=1, values_only=True), []))
    ]
    target_index = None
    for index, header in enumerate(headers, start=1):
        if header == column_name:
            target_index = index
            break
    if target_index is None:
        raise ValueError(f"Coluna nao encontrada: {column_name}")
    cleared = 0
    for row in range(2, worksheet.max_row + 1):
        cell = worksheet.cell(row=row, column=target_index)
        if cell.value is not None:
            cleared += 1
        cell.value = None
    workbook.save(workbook_path)
    print(json.dumps({"ok": True, "cleared": cleared, "sheet": sheet_name, "column": column_name}, ensure_ascii=False))
finally:
    workbook.close()
"#;
    let mut command = Command::new(&python_program);
    command
        .current_dir(root)
        .args(&python_args)
        .arg("-c")
        .arg(script)
        .arg(workbook_path.display().to_string())
        .arg(sheet.trim())
        .arg(column.trim());
    configure_no_window(&mut command);
    let output = command
        .output()
        .map_err(|err| format!("Falha ao limpar coluna da planilha: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Err(if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            "Falha ao limpar coluna da planilha.".to_string()
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let cleared_result: Value = serde_json::from_str(&stdout)
        .map_err(|err| format!("Falha ao interpretar limpeza da planilha: {err}"))?;
    let roadmap_result = run_helper_json(root, &["sync-spreadsheets".into()])?;
    Ok(serde_json::json!({
        "ok": true,
        "cleared": cleared_result.get("cleared").and_then(Value::as_i64).unwrap_or(0),
        "sheet": sheet,
        "column": column,
        "roadmap": roadmap_result,
    }))
}

#[tauri::command]
fn clear_workbook_column(
    app: AppHandle,
    workbook: String,
    sheet: String,
    column: String,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    clear_workbook_column_in_root(&root, workbook, sheet, column)
}

fn http_json_response(status: &str, body: Value) -> Vec<u8> {
    let body_text = serde_json::to_string(&body).unwrap_or_else(|_| "{}".to_string());
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body_text.as_bytes().len(),
        body_text
    )
    .into_bytes()
}

fn url_decode_component(value: &str) -> String {
    let mut output = String::new();
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[index + 1..index + 3]) {
                if let Ok(decoded) = u8::from_str_radix(hex, 16) {
                    output.push(decoded as char);
                    index += 3;
                    continue;
                }
            }
        }
        output.push(if bytes[index] == b'+' {
            ' '
        } else {
            bytes[index] as char
        });
        index += 1;
    }
    output
}

fn url_encode_component(value: &str) -> String {
    let mut output = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            output.push(byte as char);
        } else {
            output.push_str(&format!("%{byte:02X}"));
        }
    }
    output
}

fn local_agent_address() -> String {
    let ip = UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            let _ = socket.connect("8.8.8.8:80");
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    format!("{ip}:18452")
}

fn local_meshcentral_url() -> String {
    let address = local_agent_address();
    let host = address
        .rsplit_once(':')
        .map(|(host, _)| host)
        .unwrap_or("127.0.0.1");
    format!("http://{host}:8080")
}

fn agent_identity_name(root: &PathBuf) -> String {
    fs::read_to_string(root.join("agent_identity.json"))
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| {
            value
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Agente principal".to_string())
}

#[tauri::command]
fn get_agent_connection_info(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    Ok(serde_json::json!({
        "port": 18452,
        "address": local_agent_address(),
        "local": "127.0.0.1:18452",
        "agent_name": agent_identity_name(&root),
    }))
}

#[tauri::command]
fn get_agent_remote_snapshot(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    Ok(get_remote_agent_snapshot(&root))
}

fn read_http_request(stream: &mut TcpStream) -> Result<(String, Vec<u8>), String> {
    let mut data = Vec::new();
    let mut buffer = [0_u8; 8192];
    let mut header_end = None;

    loop {
        let read = stream
            .read(&mut buffer)
            .map_err(|err| format!("Falha ao ler requisicao remota: {err}"))?;
        if read == 0 {
            break;
        }
        data.extend_from_slice(&buffer[..read]);
        if header_end.is_none() {
            header_end = data
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|index| index + 4);
        }
        if let Some(end) = header_end {
            let header_text = String::from_utf8_lossy(&data[..end]).to_string();
            let content_length = header_text
                .lines()
                .find_map(|line| {
                    let (key, value) = line.split_once(':')?;
                    if key.trim().eq_ignore_ascii_case("content-length") {
                        value.trim().parse::<usize>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0);
            if data.len() >= end + content_length {
                let body = data[end..end + content_length].to_vec();
                return Ok((header_text, body));
            }
        }
    }

    if let Some(end) = header_end {
        Ok((
            String::from_utf8_lossy(&data[..end]).to_string(),
            data[end..].to_vec(),
        ))
    } else {
        Ok((String::from_utf8_lossy(&data).to_string(), Vec::new()))
    }
}

fn read_recent_launcher_logs(root: &PathBuf) -> Vec<String> {
    fs::read_to_string(root.join("ultimo_log_launcher.txt"))
        .ok()
        .map(|text| {
            let mut lines = text
                .lines()
                .map(|line| line.trim().to_string())
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>();
            if lines.len() > 40 {
                lines = lines.split_off(lines.len() - 40);
            }
            lines
        })
        .unwrap_or_default()
}

fn remote_status_payload(
    root: &PathBuf,
    running: bool,
    automation_id: Option<String>,
    progress: Option<Value>,
) -> Value {
    let active_name = fs::read_to_string(root.join("automacoes").join("automacao_atual.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| {
            value
                .get("nome")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| "Automacao atual".to_string());

    serde_json::json!({
        "snapshot": {
            "running": running,
            "automation_id": automation_id.unwrap_or_default(),
            "automation_name": active_name,
            "remote_connection": remote_agent_connection_payload(),
            "target_title": "",
            "logs": read_recent_launcher_logs(root),
            "progress": progress.unwrap_or_else(|| serde_json::json!({
                "percent": if running { 1 } else { 0 },
                "description": if running { "Automacao remota iniciada no Agent." } else { "Agent pronto para executar." },
                "sequence": "principal",
                "order": 1,
                "company": ""
            }))
        }
    })
}

fn remote_agent_snapshot_store() -> Arc<Mutex<Value>> {
    REMOTE_AGENT_SNAPSHOT
        .get_or_init(|| Arc::new(Mutex::new(serde_json::json!({}))))
        .clone()
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn webrtc_signal_store() -> Arc<Mutex<Value>> {
    WEBRTC_SIGNAL_STATE
        .get_or_init(|| {
            Arc::new(Mutex::new(serde_json::json!({
                "session_id": "",
                "offer": null,
                "answer": null,
                "created_at": 0u128,
                "updated_at": 0u128
            })))
        })
        .clone()
}

fn agent_remote_mouse_enabled_store() -> Arc<AtomicBool> {
    AGENT_REMOTE_MOUSE_ENABLED
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

fn agent_remote_mouse_enabled_payload() -> Value {
    serde_json::json!({
        "mouse_enabled": agent_remote_mouse_enabled_store().load(Ordering::SeqCst)
    })
}

fn set_agent_remote_mouse_enabled_value(enabled: bool) -> Value {
    agent_remote_mouse_enabled_store().store(enabled, Ordering::SeqCst);
    agent_remote_mouse_enabled_payload()
}

fn native_remote_status_store() -> Arc<Mutex<Value>> {
    NATIVE_REMOTE_STATUS
        .get_or_init(|| {
            Arc::new(Mutex::new(serde_json::json!({
                "capture_frames": 0, "encoded_frames": 0, "sent_frames": 0,
                "capture_resolution": "", "stage": "idle", "last_error": ""
            })))
        })
        .clone()
}

pub(crate) fn update_native_remote_status(update: Value) {
    if let (Ok(mut status), Some(fields)) =
        (native_remote_status_store().lock(), update.as_object())
    {
        if let Some(target) = status.as_object_mut() {
            for (key, value) in fields {
                target.insert(key.clone(), value.clone());
            }
            target.insert("updated_at".into(), serde_json::json!(now_millis()));
        }
    }
}

fn get_native_remote_status() -> Value {
    native_remote_status_store()
        .lock()
        .map(|status| status.clone())
        .unwrap_or_else(|_| serde_json::json!({}))
}

fn set_webrtc_offer(offer: Value) -> Value {
    let session_id = format!("rtc-{}", now_millis());
    let payload = serde_json::json!({
        "session_id": session_id,
        "offer": offer,
        "answer": null,
        "created_at": now_millis(),
        "updated_at": now_millis()
    });
    if let Ok(mut guard) = webrtc_signal_store().lock() {
        *guard = payload.clone();
    }
    payload
}

pub(crate) fn set_webrtc_answer(session_id: String, answer: Value) -> Value {
    if let Ok(mut guard) = webrtc_signal_store().lock() {
        let current_session = guard
            .get("session_id")
            .and_then(Value::as_str)
            .unwrap_or("");
        if current_session == session_id {
            guard["answer"] = answer;
            guard["updated_at"] = serde_json::json!(now_millis());
        }
        return guard.clone();
    }
    serde_json::json!({})
}

pub(crate) fn get_webrtc_signal_payload() -> Value {
    webrtc_signal_store()
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| serde_json::json!({}))
}

fn clear_webrtc_signal() -> Value {
    let payload = serde_json::json!({
        "session_id": "",
        "offer": null,
        "answer": null,
        "created_at": 0u128,
        "updated_at": now_millis()
    });
    if let Ok(mut guard) = webrtc_signal_store().lock() {
        *guard = payload.clone();
    }
    payload
}

#[cfg(windows)]
fn browser_key_to_vk(key: &str) -> Option<u16> {
    match key {
        "Backspace" => Some(0x08),
        "Tab" => Some(0x09),
        "Shift" => Some(0x10),
        "Control" => Some(0x11),
        "Alt" => Some(0x12),
        "CapsLock" => Some(0x14),
        "Enter" => Some(0x0D),
        "Escape" => Some(0x1B),
        " " | "Space" | "Spacebar" => Some(0x20),
        "ArrowLeft" => Some(0x25),
        "ArrowUp" => Some(0x26),
        "ArrowRight" => Some(0x27),
        "ArrowDown" => Some(0x28),
        "Delete" => Some(0x2E),
        "Insert" => Some(0x2D),
        "Home" => Some(0x24),
        "End" => Some(0x23),
        "PageUp" => Some(0x21),
        "PageDown" => Some(0x22),
        "Meta" => Some(0x5B),
        _ => {
            let upper = key.to_uppercase();
            if upper.len() == 1 {
                let byte = upper.as_bytes()[0];
                if byte.is_ascii_alphanumeric() {
                    return Some(byte as u16);
                }
            }
            if let Some(number) = upper
                .strip_prefix('F')
                .and_then(|value| value.parse::<u16>().ok())
            {
                if (1..=24).contains(&number) {
                    return Some(0x70 + number - 1);
                }
            }
            None
        }
    }
}

#[cfg(windows)]
fn send_remote_mouse_event(event: &Value) -> Result<(), String> {
    let width = unsafe { GetSystemMetrics(SM_CXSCREEN) }.max(1) as f64;
    let height = unsafe { GetSystemMetrics(SM_CYSCREEN) }.max(1) as f64;
    let x = event
        .get("x")
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
        .clamp(0.0, 1.0);
    let y = event
        .get("y")
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
        .clamp(0.0, 1.0);
    let absolute_x = ((x * (width - 1.0)) * 65535.0 / (width - 1.0)).round() as i32;
    let absolute_y = ((y * (height - 1.0)) * 65535.0 / (height - 1.0)).round() as i32;
    let event_type = event.get("event").and_then(Value::as_str).unwrap_or("move");
    let button = event.get("button").and_then(Value::as_i64).unwrap_or(0);
    let mut flags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE;
    let mut mouse_data = 0u32;
    match event_type {
        "down" => {
            flags |= match button {
                1 => MOUSEEVENTF_MIDDLEDOWN,
                2 => MOUSEEVENTF_RIGHTDOWN,
                _ => MOUSEEVENTF_LEFTDOWN,
            };
        }
        "up" => {
            flags |= match button {
                1 => MOUSEEVENTF_MIDDLEUP,
                2 => MOUSEEVENTF_RIGHTUP,
                _ => MOUSEEVENTF_LEFTUP,
            };
        }
        "wheel" => {
            flags |= MOUSEEVENTF_WHEEL;
            mouse_data = event
                .get("delta")
                .and_then(Value::as_i64)
                .unwrap_or(0)
                .clamp(-120, 120) as u32;
        }
        _ => {}
    }
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: absolute_x,
                dy: absolute_y,
                mouseData: mouse_data,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let sent = unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
    if sent == 0 {
        Err("Windows recusou o evento de mouse remoto.".to_string())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn send_remote_key_event(event: &Value) -> Result<(), String> {
    let key = event.get("key").and_then(Value::as_str).unwrap_or("");
    let Some(vk) = browser_key_to_vk(key) else {
        return Ok(());
    };
    let is_up = event.get("event").and_then(Value::as_str).unwrap_or("down") == "up";
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: if is_up {
                    KEYEVENTF_KEYUP
                } else {
                    KEYBD_EVENT_FLAGS(0)
                },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let sent = unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
    if sent == 0 {
        Err("Windows recusou o evento de teclado remoto.".to_string())
    } else {
        Ok(())
    }
}

pub(crate) fn handle_agent_remote_control_event(event: Value) -> Result<Value, String> {
    #[cfg(not(windows))]
    {
        let _ = event;
        return Err(
            "Controle remoto por mouse/teclado esta disponivel apenas no Windows.".to_string(),
        );
    }
    #[cfg(windows)]
    {
        match event.get("kind").and_then(Value::as_str).unwrap_or("") {
            "mouse" => {
                if !agent_remote_mouse_enabled_store().load(Ordering::SeqCst) {
                    return Ok(serde_json::json!({
                        "ok": true,
                        "ignored": true,
                        "reason": "mouse_disabled"
                    }));
                }
                send_remote_mouse_event(&event)?;
            }
            "key" => send_remote_key_event(&event)?,
            _ => {}
        }
        Ok(serde_json::json!({ "ok": true }))
    }
}

fn remote_agent_last_contact_store() -> Arc<Mutex<u128>> {
    REMOTE_AGENT_LAST_CONTACT_MS
        .get_or_init(|| Arc::new(Mutex::new(0)))
        .clone()
}

fn mark_remote_agent_contact() {
    if let Ok(mut guard) = remote_agent_last_contact_store().lock() {
        *guard = now_millis();
    }
}

fn remote_agent_connection_payload() -> Value {
    let last_contact_ms = remote_agent_last_contact_store()
        .lock()
        .map(|guard| *guard)
        .unwrap_or(0);
    let current_ms = now_millis();
    let connected = last_contact_ms > 0 && current_ms.saturating_sub(last_contact_ms) <= 15_000;
    serde_json::json!({
        "connected": connected,
        "last_contact_ms": last_contact_ms,
        "age_ms": if last_contact_ms > 0 { current_ms.saturating_sub(last_contact_ms) } else { 0 }
    })
}

fn set_remote_agent_snapshot(value: Value) {
    if let Ok(mut guard) = remote_agent_snapshot_store().lock() {
        *guard = value;
    }
}

fn get_remote_agent_snapshot(root: &PathBuf) -> Value {
    let mut payload = remote_agent_snapshot_store()
        .lock()
        .ok()
        .and_then(|guard| {
            if guard
                .as_object()
                .map(|object| object.is_empty())
                .unwrap_or(true)
            {
                None
            } else {
                Some(guard.clone())
            }
        })
        .unwrap_or_else(|| remote_status_payload(root, false, None, None));
    if let Some(snapshot) = payload.get_mut("snapshot").and_then(Value::as_object_mut) {
        snapshot.insert(
            "remote_connection".to_string(),
            remote_agent_connection_payload(),
        );
    }
    payload
}

fn open_remote_automation(root: &PathBuf, automation_id: &str) -> Result<Value, String> {
    let result = run_helper_json(
        root,
        &[
            "automation-open".into(),
            "--id".into(),
            automation_id.to_string(),
        ],
    )?;
    set_remote_agent_snapshot(remote_status_payload(
        root,
        false,
        Some(automation_id.to_string()),
        Some(serde_json::json!({
            "percent": 0,
            "description": "Automacao aberta remotamente pelo Control.",
            "sequence": "principal",
            "order": 1,
            "company": ""
        })),
    ));
    Ok(result)
}

fn import_remote_automation_zip(
    root: &PathBuf,
    file_name: &str,
    body: &[u8],
) -> Result<Value, String> {
    let import_dir = root.join("automacoes").join("_imports_remotos");
    fs::create_dir_all(&import_dir)
        .map_err(|err| format!("Falha ao criar pasta de importacao remota: {err}"))?;
    let safe_name = sanitize_asset_filename(file_name, "automacao.zip");
    let zip_path = import_dir.join(safe_name);
    fs::write(&zip_path, body)
        .map_err(|err| format!("Falha ao salvar ZIP recebido pelo Agent: {err}"))?;
    let result = run_helper_json(
        root,
        &[
            "automation-import-zip".into(),
            "--arquivo".into(),
            zip_path.display().to_string(),
        ],
    )?;
    let imported_id = result
        .get("imported_id")
        .or_else(|| result.get("importedId"))
        .or_else(|| {
            result
                .get("active_automation")
                .and_then(|item| item.get("id"))
        })
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    set_remote_agent_snapshot(remote_status_payload(
        root,
        false,
        Some(imported_id),
        Some(serde_json::json!({
            "percent": 0,
            "description": format!("Automacao importada pelo Control: {file_name}"),
            "sequence": "principal",
            "order": 1,
            "company": ""
        })),
    ));
    Ok(result)
}

fn remote_recognition_preview(root: &PathBuf, image_id: &str) -> Result<Value, String> {
    let normalized = image_id.replace('\\', "/");
    let relative = normalized.strip_prefix("imagens/").unwrap_or(&normalized);
    let path = root.join("Imagens").join(relative);
    let fallback = root.join("imagens").join(relative);
    let final_path = if path.exists() { path } else { fallback };
    if !final_path.exists() {
        return Err(format!("Imagem nao encontrada: {image_id}"));
    }
    let bytes =
        fs::read(&final_path).map_err(|err| format!("Falha ao ler preview remoto: {err}"))?;
    let extension = final_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };
    Ok(serde_json::json!({
        "src": format!("data:{mime};base64,{}", general_purpose::STANDARD.encode(bytes)),
        "file_name": final_path.file_name().and_then(|name| name.to_str()).unwrap_or("referencia.png"),
        "image_id": image_id,
    }))
}

fn update_remote_progress_from_stdout(root: &PathBuf, automation_id: &str, raw_line: &str) {
    let line = raw_line.trim();
    let Some(json_text) = line.strip_prefix("PROGRESS_JSON|") else {
        return;
    };

    match serde_json::from_str::<Value>(json_text) {
        Ok(progress) => {
            set_remote_agent_snapshot(remote_status_payload(
                root,
                true,
                Some(automation_id.to_string()),
                Some(progress),
            ));
        }
        Err(err) => {
            append_launcher_log(
                root,
                format!("REMOTE PROGRESS_JSON invalido: {err} | {json_text}"),
            );
        }
    }
}

fn resolve_remote_loop_start(
    root: &PathBuf,
    requested_line: i32,
    start_company: Option<&str>,
) -> Result<i32, String> {
    let company_query = start_company
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let Some(query) = company_query else {
        return Ok(requested_line.max(1));
    };

    let loop_data = run_script_json(root, "gerenciar_dados_planilha.py", &["listar".into()])?;
    let normalized_query = query.to_ascii_lowercase();
    let rows = loop_data
        .get("rows")
        .and_then(Value::as_array)
        .ok_or_else(|| "Nao foi possivel ler as linhas da planilha no Agent.".to_string())?;

    for row in rows {
        let company = row.get("company").and_then(Value::as_str).unwrap_or("");
        if company.to_ascii_lowercase().contains(&normalized_query) {
            let row_number = row.get("row_number").and_then(Value::as_i64).unwrap_or(0) as i32;
            if row_number > 0 {
                return Ok(row_number);
            }
        }
    }

    Err(format!("Empresa nao encontrada no loop do Agent: {query}"))
}

fn execute_remote_automation(
    app: &AppHandle,
    root: &PathBuf,
    automation_id: &str,
    delay: f64,
    loop_start: i32,
    start_company: Option<String>,
    minimize_agent: bool,
    text_overrides: Option<String>,
) -> Result<Value, String> {
    let resolved_loop_start =
        resolve_remote_loop_start(root, loop_start, start_company.as_deref())?;
    append_launcher_log(
        root,
        format!(
            "Execucao remota solicitada pelo Control | id={automation_id} | delay={delay} | loop_start={resolved_loop_start} | empresa={}",
            start_company.as_deref().unwrap_or("")
        ),
    );
    let opened = open_remote_automation(root, automation_id)?;
    let _ = run_helper_json(
        root,
        &[
            "automation-mark-run".into(),
            "--id".into(),
            automation_id.to_string(),
        ],
    );
    let _ = fs::remove_file(root.join(".parar_automacao.flag"));
    if minimize_agent {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.minimize();
        }
    }

    let has_spreadsheet = opened
        .get("summary")
        .and_then(|summary| summary.get("spreadsheet_blocks"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
        > 0;

    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        append_launcher_log(
            root,
            format!(
                "ERRO remoto: executor nao encontrado em {}",
                script_path.display()
            ),
        );
        return Err(format!(
            "Executor nao encontrado no Agent: {}",
            script_path.display()
        ));
    }

    let (python_program, python_args) = python_command(root)?;
    append_launcher_log(
        root,
        format!(
            "Execucao remota usando Python: {} {}",
            python_program,
            python_args.join(" ")
        ),
    );
    let mut command = Command::new(&python_program);
    command
        .current_dir(root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg(if has_spreadsheet { "loop" } else { "normal" })
        .arg("--atraso")
        .arg(delay.max(0.0).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));
    if has_spreadsheet {
        command
            .arg("--loop-start")
            .arg(resolved_loop_start.max(1).to_string());
    }
    if let Some(value) = text_overrides
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--text-overrides").arg(value);
    }
    configure_no_window(&mut command);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar automacao remota no Agent: {err}"))?;
    append_launcher_log(root, "Processo remoto iniciado pelo Control.");
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let started_snapshot = remote_status_payload(
        root,
        true,
        Some(automation_id.to_string()),
        Some(serde_json::json!({
            "percent": 1,
            "description": "Automacao remota iniciada no Agent.",
            "sequence": "principal",
            "order": 1,
            "company": ""
        })),
    );
    set_remote_agent_snapshot(started_snapshot.clone());

    let root_clone = root.clone();
    let automation_id_clone = automation_id.to_string();
    thread::spawn(move || {
        let stdout_thread = stdout.map(|stdout_pipe| {
            let root = root_clone.clone();
            let automation_id = automation_id_clone.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout_pipe);
                for raw_line in reader.lines().flatten() {
                    if !raw_line.trim().is_empty() {
                        append_launcher_log(&root, format!("REMOTE STDOUT: {raw_line}"));
                        update_remote_progress_from_stdout(&root, &automation_id, &raw_line);
                    }
                }
            })
        });
        let stderr_thread = stderr.map(|stderr_pipe| {
            let root = root_clone.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr_pipe);
                for raw_line in reader.lines().flatten() {
                    if !raw_line.trim().is_empty() {
                        append_launcher_log(&root, format!("REMOTE STDERR: {raw_line}"));
                    }
                }
            })
        });
        let success = child.wait().map(|status| status.success()).unwrap_or(false);
        if let Some(handle) = stdout_thread {
            let _ = handle.join();
        }
        if let Some(handle) = stderr_thread {
            let _ = handle.join();
        }
        append_launcher_log(
            &root_clone,
            format!("Processo remoto finalizado | sucesso={success}"),
        );
        set_remote_agent_snapshot(remote_status_payload(
            &root_clone,
            false,
            Some(automation_id_clone),
            Some(serde_json::json!({
                "percent": if success { 100 } else { 0 },
                "description": if success { "Automacao remota concluida no Agent." } else { "Automacao remota finalizada com falha ou parada." },
                "sequence": "principal",
                "order": 1,
                "company": ""
            })),
        ));
    });

    Ok(started_snapshot)
}

fn normalize_internal_automation_name(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .replace(' ', "_")
        .replace('-', "_")
}

fn find_remote_automation_id_by_name(
    root: &PathBuf,
    automation_name: &str,
) -> Result<String, String> {
    let wanted = normalize_internal_automation_name(automation_name);
    let library = run_helper_json(root, &["automation-library-list".into()])?;
    let items = library
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| "Nao foi possivel ler a biblioteca do Agent.".to_string())?;
    for item in items {
        let name = item
            .get("nome")
            .or_else(|| item.get("name"))
            .and_then(Value::as_str)
            .unwrap_or("");
        if normalize_internal_automation_name(name) == wanted {
            return item
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| format!("Automacao interna sem ID: {automation_name}"));
        }
    }
    Err(format!(
        "Automacao fixa do botao Assistir nao encontrada no Agent: {automation_name}"
    ))
}

fn handle_agent_http_client(mut stream: TcpStream, app: AppHandle, root: PathBuf) {
    let (request, body) = match read_http_request(&mut stream) {
        Ok(value) => value,
        Err(error) => {
            let _ = stream.write_all(&http_json_response(
                "400 Bad Request",
                serde_json::json!({"error": error}),
            ));
            return;
        }
    };
    let first_line = request.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    let clean_path = path.split('?').next().unwrap_or(path);

    if method != "OPTIONS" {
        mark_remote_agent_contact();
    }

    let response = if method == "OPTIONS" {
        http_json_response("204 No Content", serde_json::json!({}))
    } else if method == "GET" && clean_path == "/api/ping" {
        http_json_response(
            "200 OK",
            serde_json::json!({
                "agent": agent_identity_name(&root),
                "port": 18452,
                "address": local_agent_address()
            }),
        )
    } else if method == "POST" && clean_path == "/api/identity" {
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let name = payload
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if name.is_empty() {
            http_json_response(
                "400 Bad Request",
                serde_json::json!({"error":"Informe o nome do Agent."}),
            )
        } else {
            let safe_name: String = name.chars().take(80).collect();
            match fs::write(
                root.join("agent_identity.json"),
                serde_json::json!({"name":safe_name}).to_string(),
            ) {
                Ok(()) => {
                    let _ = app.emit(
                        "agent-identity-updated",
                        serde_json::json!({"name":safe_name}),
                    );
                    http_json_response("200 OK", serde_json::json!({"ok":true,"name":safe_name}))
                }
                Err(error) => http_json_response(
                    "500 Internal Server Error",
                    serde_json::json!({"error":format!("Falha ao salvar o nome do Agent: {error}")}),
                ),
            }
        }
    } else if method == "GET" && clean_path == "/api/automations" {
        match run_helper_json(&root, &["automation-library-list".into()]) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "GET" && clean_path == "/api/status" {
        http_json_response("200 OK", get_remote_agent_snapshot(&root))
    } else if method == "GET" && clean_path == "/api/meshcentral/status" {
        http_json_response("200 OK", meshcentral_status_payload(&root))
    } else if method == "GET" && clean_path == "/api/screen/snapshot" {
        match capture_screen_snapshot(&root) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "GET" && clean_path == "/api/native-remote/status" {
        http_json_response("200 OK", get_native_remote_status())
    } else if method == "POST" && clean_path == "/api/control/event" {
        let event =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        match handle_agent_remote_control_event(event) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => {
                http_json_response("400 Bad Request", serde_json::json!({"error": error}))
            }
        }
    } else if method == "POST" && clean_path == "/api/webrtc/offer" {
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let offer = payload.get("offer").cloned().unwrap_or(payload);
        http_json_response("200 OK", set_webrtc_offer(offer))
    } else if method == "GET" && clean_path == "/api/webrtc/answer" {
        http_json_response("200 OK", get_webrtc_signal_payload())
    } else if method == "DELETE" && clean_path == "/api/webrtc" {
        http_json_response("200 OK", clear_webrtc_signal())
    } else if method == "POST" && clean_path == "/api/meshcentral/start" {
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let mesh_path = payload
            .get("mesh_path")
            .or_else(|| payload.get("meshPath"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let url = payload
            .get("url")
            .and_then(Value::as_str)
            .map(str::to_string);
        http_json_response(
            "200 OK",
            start_meshcentral_server_async(root.clone(), mesh_path.to_string(), url),
        )
    } else if method == "GET" && clean_path == "/api/spreadsheet-preview" {
        let limit = path
            .split_once('?')
            .and_then(|(_, query)| {
                query.split('&').find_map(|pair| {
                    let (key, value) = pair.split_once('=')?;
                    if key == "limit" {
                        value.parse::<i64>().ok()
                    } else {
                        None
                    }
                })
            })
            .unwrap_or(80);
        match read_remote_spreadsheet_preview(&root, limit) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "POST" && clean_path == "/api/spreadsheet-column/clear" {
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let workbook = payload
            .get("workbook")
            .or_else(|| payload.get("workbook_id"))
            .or_else(|| payload.get("workbookId"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let sheet = payload
            .get("sheet")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let column = payload
            .get("column")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        match clear_workbook_column_in_root(&root, workbook, sheet, column) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "POST" && clean_path == "/api/stop" {
        let _ = fs::write(root.join(".parar_automacao.flag"), b"stop");
        let snapshot = remote_status_payload(
            &root,
            false,
            None,
            Some(serde_json::json!({
                "percent": 0,
                "description": "Parada solicitada no Agent.",
                "sequence": "principal",
                "order": 1,
                "company": ""
            })),
        );
        set_remote_agent_snapshot(snapshot.clone());
        http_json_response("200 OK", snapshot)
    } else if method == "POST" && clean_path == "/api/automation-import-zip" {
        let file_name = path
            .split_once('?')
            .and_then(|(_, query)| {
                query.split('&').find_map(|pair| {
                    let (key, value) = pair.split_once('=')?;
                    if key == "file_name" {
                        Some(url_decode_component(value))
                    } else {
                        None
                    }
                })
            })
            .unwrap_or_else(|| "automacao.zip".to_string());
        match import_remote_automation_zip(&root, &file_name, &body) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "GET" && clean_path == "/api/recognition-preview" {
        let image_id = path
            .split_once('?')
            .and_then(|(_, query)| {
                query.split('&').find_map(|pair| {
                    let (key, value) = pair.split_once('=')?;
                    if key == "image_id" || key == "imageId" {
                        Some(url_decode_component(value))
                    } else {
                        None
                    }
                })
            })
            .unwrap_or_default();
        match remote_recognition_preview(&root, &image_id) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response("404 Not Found", serde_json::json!({"error": error})),
        }
    } else if method == "POST"
        && clean_path.starts_with("/api/automations/")
        && clean_path.ends_with("/open")
    {
        let encoded_id = clean_path
            .trim_start_matches("/api/automations/")
            .trim_end_matches("/open")
            .trim_end_matches('/');
        let automation_id = url_decode_component(encoded_id);
        match open_remote_automation(&root, &automation_id) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "POST" && clean_path == "/api/watch-automation/execute" {
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let automation_name = payload
            .get("automation_name")
            .or_else(|| payload.get("automationName"))
            .and_then(Value::as_str)
            .unwrap_or("Aceito_Compartilhamento");
        match find_remote_automation_id_by_name(&root, automation_name).and_then(|automation_id| {
            execute_remote_automation(&app, &root, &automation_id, 0.0, 1, None, false, None)
        }) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "POST"
        && clean_path.starts_with("/api/automations/")
        && clean_path.ends_with("/execute")
    {
        let encoded_id = clean_path
            .trim_start_matches("/api/automations/")
            .trim_end_matches("/execute")
            .trim_end_matches('/');
        let automation_id = url_decode_component(encoded_id);
        let payload =
            serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| serde_json::json!({}));
        let delay = payload.get("delay").and_then(Value::as_f64).unwrap_or(3.0);
        let loop_start = payload
            .get("loop_start")
            .or_else(|| payload.get("loopStart"))
            .and_then(Value::as_i64)
            .unwrap_or(1) as i32;
        let start_company = payload
            .get("start_company")
            .or_else(|| payload.get("startCompany"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let minimize_agent = payload
            .get("minimize_agent")
            .or_else(|| payload.get("minimizeAgent"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let text_overrides = payload
            .get("text_overrides")
            .or_else(|| payload.get("textOverrides"))
            .and_then(|value| {
                if value.is_string() {
                    value.as_str().map(str::to_string)
                } else if value.is_object() {
                    serde_json::to_string(value).ok()
                } else {
                    None
                }
            });
        match execute_remote_automation(
            &app,
            &root,
            &automation_id,
            delay,
            loop_start,
            start_company,
            minimize_agent,
            text_overrides,
        ) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else if method == "DELETE" && clean_path.starts_with("/api/automations/") {
        let encoded_id = clean_path.trim_start_matches("/api/automations/");
        let automation_id = url_decode_component(encoded_id);
        match run_helper_json(
            &root,
            &["automation-delete".into(), "--id".into(), automation_id],
        ) {
            Ok(value) => http_json_response("200 OK", value),
            Err(error) => http_json_response(
                "500 Internal Server Error",
                serde_json::json!({"error": error}),
            ),
        }
    } else {
        http_json_response(
            "404 Not Found",
            serde_json::json!({"error": "Endpoint nao encontrado"}),
        )
    };

    let _ = stream.write_all(&response);
    let _ = stream.flush();
}

fn start_agent_http_server(app: AppHandle, root: PathBuf) {
    thread::spawn(move || {
        let listener = match TcpListener::bind("0.0.0.0:18452") {
            Ok(listener) => listener,
            Err(_) => return,
        };
        for stream in listener.incoming().flatten() {
            let root_clone = root.clone();
            let app_clone = app.clone();
            thread::spawn(move || handle_agent_http_client(stream, app_clone, root_clone));
        }
    });
}

fn meshcentral_process_cell() -> Arc<Mutex<Option<Child>>> {
    MESHCENTRAL_PROCESS
        .get_or_init(|| Arc::new(Mutex::new(None)))
        .clone()
}

fn meshcentral_starting_cell() -> Arc<Mutex<bool>> {
    MESHCENTRAL_STARTING
        .get_or_init(|| Arc::new(Mutex::new(false)))
        .clone()
}

fn set_meshcentral_starting(value: bool) {
    if let Ok(mut guard) = meshcentral_starting_cell().lock() {
        *guard = value;
    }
}

fn is_meshcentral_starting() -> bool {
    meshcentral_starting_cell()
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false)
}

fn set_meshcentral_message(message: impl Into<String>) {
    if let Ok(mut guard) = MESHCENTRAL_LAST_MESSAGE
        .get_or_init(|| Arc::new(Mutex::new(String::new())))
        .lock()
    {
        *guard = message.into();
    }
}

fn meshcentral_message() -> String {
    MESHCENTRAL_LAST_MESSAGE
        .get_or_init(|| Arc::new(Mutex::new(String::new())))
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default()
}

fn meshcentral_status_payload(root: &Path) -> Value {
    if is_meshcentral_starting() {
        let message = meshcentral_message();
        let status_message = if message.is_empty() {
            "Preparando MeshCentral no Agent em segundo plano.".to_string()
        } else {
            message
        };
        return serde_json::json!({
            "running": false,
            "starting": true,
            "message": status_message,
            "url": meshcentral_default_url(root)
        });
    }

    let cell = meshcentral_process_cell();
    let mut guard = match cell.lock() {
        Ok(guard) => guard,
        Err(_) => {
            return serde_json::json!({
                "running": false,
                "message": "Nao foi possivel ler o status do MeshCentral.",
                "url": ""
            });
        }
    };

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(status)) => {
                *guard = None;
                serde_json::json!({
                    "running": false,
                    "message": format!("MeshCentral finalizado. Codigo: {:?}", status.code()),
                    "url": ""
                })
            }
            Ok(None) => serde_json::json!({
                "running": true,
                "message": "MeshCentral rodando no Agent.",
                "url": meshcentral_default_url(root)
            }),
            Err(error) => serde_json::json!({
                "running": false,
                "message": format!("Falha ao consultar MeshCentral: {error}"),
                "url": ""
            }),
        }
    } else {
        let last_message = meshcentral_message();
        serde_json::json!({
            "running": false,
            "starting": false,
            "message": if last_message.is_empty() { "MeshCentral parado.".to_string() } else { last_message },
            "url": ""
        })
    }
}

fn meshcentral_default_url(root: &Path) -> String {
    let configured = root.join("meshcentral_url.txt");
    if let Ok(value) = fs::read_to_string(configured) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    local_meshcentral_url()
}

fn capture_screen_snapshot(root: &Path) -> Result<Value, String> {
    #[cfg(not(windows))]
    {
        let _ = root;
        return Err(
            "A visualizacao remota por snapshot esta disponivel apenas no Windows.".to_string(),
        );
    }

    #[cfg(windows)]
    {
        let _ = root;
        let width = unsafe { GetSystemMetrics(SM_CXSCREEN) };
        let height = unsafe { GetSystemMetrics(SM_CYSCREEN) };
        if width <= 0 || height <= 0 {
            return Err("Nao foi possivel detectar o tamanho da tela do Agent.".to_string());
        }

        let pixel_count = (width as usize)
            .checked_mul(height as usize)
            .ok_or_else(|| "Resolucao da tela grande demais para captura.".to_string())?;
        let mut bgra = vec![0u8; pixel_count * 4];

        unsafe {
            let desktop_window = HWND(std::ptr::null_mut());
            let screen_dc = GetDC(desktop_window);
            if screen_dc.0.is_null() {
                return Err("Nao foi possivel acessar a tela do Agent.".to_string());
            }
            let memory_dc = CreateCompatibleDC(screen_dc);
            if memory_dc.0.is_null() {
                let _ = ReleaseDC(desktop_window, screen_dc);
                return Err("Nao foi possivel preparar a captura da tela.".to_string());
            }
            let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
            if bitmap.0.is_null() {
                let _ = DeleteDC(memory_dc);
                let _ = ReleaseDC(desktop_window, screen_dc);
                return Err("Nao foi possivel criar o bitmap da captura.".to_string());
            }
            let old_object = SelectObject(memory_dc, HGDIOBJ(bitmap.0));
            let copied = BitBlt(memory_dc, 0, 0, width, height, screen_dc, 0, 0, SRCCOPY);
            if copied.is_err() {
                let _ = SelectObject(memory_dc, old_object);
                let _ = DeleteObject(HGDIOBJ(bitmap.0));
                let _ = DeleteDC(memory_dc);
                let _ = ReleaseDC(desktop_window, screen_dc);
                return Err("Nao foi possivel copiar a tela do Agent.".to_string());
            }

            let mut bitmap_info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                bmiColors: [RGBQUAD::default(); 1],
            };
            let lines = GetDIBits(
                memory_dc,
                HBITMAP(bitmap.0),
                0,
                height as u32,
                Some(bgra.as_mut_ptr() as *mut _),
                &mut bitmap_info,
                DIB_RGB_COLORS,
            );
            let _ = SelectObject(memory_dc, old_object);
            let _ = DeleteObject(HGDIOBJ(bitmap.0));
            let _ = DeleteDC(memory_dc);
            let _ = ReleaseDC(desktop_window, screen_dc);
            if lines == 0 {
                return Err("Nao foi possivel converter a captura da tela.".to_string());
            }
        }

        for pixel in bgra.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 255;
        }
        let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, bgra)
            .ok_or_else(|| "Nao foi possivel montar a imagem da tela.".to_string())?;
        let max_width = 1600u32;
        let scaled = if image.width() > max_width {
            let target_height = ((image.height() as f64)
                * (max_width as f64 / image.width() as f64))
                .round()
                .max(1.0) as u32;
            image::imageops::resize(&image, max_width, target_height, FilterType::Nearest)
        } else {
            image
        };
        let mut bytes = Vec::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut bytes, 62);
        encoder
            .encode_image(&scaled)
            .map_err(|err| format!("Nao foi possivel compactar a tela do Agent: {err}"))?;
        let resolution = format!(
            "{}x{} -> {}x{}",
            width,
            height,
            scaled.width(),
            scaled.height()
        );
        Ok(serde_json::json!({
            "ok": true,
            "mime": "image/jpeg",
            "data": general_purpose::STANDARD.encode(bytes),
            "resolution": resolution,
            "captured_at": now_millis()
        }))
    }
}

fn find_meshcentral_entry(mesh_dir: &Path) -> Option<PathBuf> {
    [
        mesh_dir.join("meshcentral.js"),
        mesh_dir.join("meshcentral"),
        mesh_dir
            .join("node_modules")
            .join("meshcentral")
            .join("meshcentral.js"),
    ]
    .into_iter()
    .find(|path| path.exists() && path.is_file())
}

fn bundled_node_program(root: &Path) -> Option<PathBuf> {
    [
        root.join("nodejs"),
        root.join("flowdetect_agent")
            .join("src-tauri")
            .join("installer_support")
            .join("nodejs"),
    ]
    .into_iter()
    .map(|base| {
        base.join(if cfg!(windows) {
            "node.exe"
        } else {
            "bin/node"
        })
    })
    .find(|candidate| candidate.exists())
}

fn bundled_npm_program(root: &Path) -> Option<PathBuf> {
    [
        root.join("nodejs"),
        root.join("flowdetect_agent")
            .join("src-tauri")
            .join("installer_support")
            .join("nodejs"),
    ]
    .into_iter()
    .map(|base| base.join(if cfg!(windows) { "npm.cmd" } else { "bin/npm" }))
    .find(|candidate| candidate.exists())
}

fn bundled_npm_cli(root: &Path) -> Option<PathBuf> {
    [
        root.join("nodejs"),
        root.join("flowdetect_agent")
            .join("src-tauri")
            .join("installer_support")
            .join("nodejs"),
    ]
    .into_iter()
    .map(|base| {
        base.join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js")
    })
    .find(|candidate| candidate.exists())
}

fn system_npm_program() -> &'static str {
    #[cfg(windows)]
    {
        "npm.cmd"
    }
    #[cfg(not(windows))]
    {
        "npm"
    }
}

fn ensure_meshcentral_dependencies(root: &Path, mesh_dir: &Path) -> Result<(), String> {
    if mesh_dir.join("node_modules").exists() {
        return Ok(());
    }
    if !mesh_dir.join("package.json").exists() {
        return Ok(());
    }

    let bundled_node = bundled_node_program(root);
    let bundled_npm_cli = bundled_npm_cli(root);
    let mut command = if let (Some(node), Some(npm_cli)) = (bundled_node, bundled_npm_cli) {
        let mut command = Command::new(node);
        command.arg(npm_cli);
        command
    } else {
        Command::new(
            bundled_npm_program(root).unwrap_or_else(|| PathBuf::from(system_npm_program())),
        )
    };
    command
        .arg("install")
        .arg("--omit=dev")
        .current_dir(mesh_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    configure_no_window(&mut command);
    let status = command
        .status()
        .map_err(|err| format!("Nao foi possivel instalar dependencias do MeshCentral. O Agent tentou usar o Node embutido e depois o NPM do sistema. Erro: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "npm install do MeshCentral falhou com codigo {:?}.",
            status.code()
        ))
    }
}

fn default_meshcentral_dir(root: &Path) -> PathBuf {
    let installed = root.join("meshcentral");
    if installed.exists() {
        return installed;
    }
    let dev = root
        .join("flowdetect_agent")
        .join("src-tauri")
        .join("installer_support")
        .join("meshcentral");
    if dev.exists() {
        return dev;
    }
    installed
}

fn start_meshcentral_server(
    root: &Path,
    mesh_path: &str,
    url: Option<String>,
) -> Result<Value, String> {
    let trimmed_path = mesh_path.trim().trim_matches('"');
    let mesh_dir = if trimmed_path.is_empty() {
        default_meshcentral_dir(root)
    } else {
        PathBuf::from(trimmed_path)
    };
    if !mesh_dir.exists() || !mesh_dir.is_dir() {
        return Err(format!(
            "Pasta do MeshCentral nao encontrada: {}",
            mesh_dir.display()
        ));
    }

    let cell = meshcentral_process_cell();
    {
        let mut guard = cell
            .lock()
            .map_err(|_| "Falha ao acessar processo do MeshCentral.".to_string())?;
        if let Some(child) = guard.as_mut() {
            if child
                .try_wait()
                .map_err(|err| format!("Falha ao consultar MeshCentral: {err}"))?
                .is_none()
            {
                return Ok(meshcentral_status_payload(root));
            }
            *guard = None;
        }
    }

    let entry = find_meshcentral_entry(&mesh_dir)
        .ok_or_else(|| format!("Nao encontrei meshcentral.js dentro de {}. Rode npm install nessa pasta ou selecione a pasta correta.", mesh_dir.display()))?;

    ensure_meshcentral_dependencies(root, &mesh_dir)?;

    let mut command =
        Command::new(bundled_node_program(root).unwrap_or_else(|| PathBuf::from("node")));
    command
        .arg(&entry)
        .current_dir(&mesh_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    configure_no_window(&mut command);

    let child = command.spawn().map_err(|err| {
        format!("Nao foi possivel iniciar o MeshCentral com o Node embutido do Agent. Erro: {err}")
    })?;

    if let Some(url_value) = url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let _ = fs::write(root.join("meshcentral_url.txt"), url_value);
    } else {
        let _ = fs::write(root.join("meshcentral_url.txt"), local_meshcentral_url());
    }

    let mut guard = cell
        .lock()
        .map_err(|_| "Falha ao registrar processo do MeshCentral.".to_string())?;
    *guard = Some(child);
    Ok(meshcentral_status_payload(root))
}

fn start_meshcentral_server_async(root: PathBuf, mesh_path: String, url: Option<String>) -> Value {
    if is_meshcentral_starting() {
        return meshcentral_status_payload(&root);
    }

    let already_running = {
        let cell = meshcentral_process_cell();
        let mut running = false;
        if let Ok(mut guard) = cell.lock() {
            if let Some(child) = guard.as_mut() {
                if child.try_wait().ok().flatten().is_none() {
                    running = true;
                } else {
                    *guard = None;
                }
            }
        }
        running
    };
    if already_running {
        return meshcentral_status_payload(&root);
    }

    set_meshcentral_starting(true);
    set_meshcentral_message("Preparando MeshCentral no Agent em segundo plano. Isso pode levar alguns minutos na primeira vez.");
    let root_for_thread = root.clone();
    thread::spawn(move || {
        let result = start_meshcentral_server(&root_for_thread, &mesh_path, url);
        match result {
            Ok(_) => set_meshcentral_message("MeshCentral iniciado no Agent."),
            Err(error) => set_meshcentral_message(format!("Falha ao iniciar MeshCentral: {error}")),
        }
        set_meshcentral_starting(false);
    });

    meshcentral_status_payload(&root)
}

fn normalize_agent_address(address: &str) -> String {
    let trimmed = address.trim();
    if trimmed.is_empty() {
        "127.0.0.1:18452".to_string()
    } else if trimmed.starts_with("http://") {
        trimmed
            .trim_start_matches("http://")
            .trim_end_matches('/')
            .to_string()
    } else if trimmed.starts_with("https://") {
        trimmed
            .trim_start_matches("https://")
            .trim_end_matches('/')
            .to_string()
    } else {
        trimmed.trim_end_matches('/').to_string()
    }
}

fn remote_agent_request(
    address: &str,
    method: &str,
    path: &str,
    body: Option<&[u8]>,
) -> Result<Value, String> {
    let normalized = normalize_agent_address(address);
    let socket_addr: SocketAddr = normalized
        .to_socket_addrs()
        .map_err(|err| format!("Endereco do Agent invalido ({normalized}): {err}"))?
        .next()
        .ok_or_else(|| format!("Endereco do Agent invalido: {normalized}"))?;
    let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(3))
        .map_err(|err| format!("Nao foi possivel conectar ao Agent em {normalized}: {err}"))?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(8)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(8)));
    let body_bytes = body.unwrap_or(&[]);
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {normalized}\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body_bytes.len()
    );
    stream
        .write_all(request.as_bytes())
        .and_then(|_| stream.write_all(body_bytes))
        .map_err(|err| format!("Falha ao enviar requisicao ao Agent: {err}"))?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|err| format!("Falha ao ler resposta do Agent: {err}"))?;
    let status_ok = response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.1 204");
    let body_text = response.split("\r\n\r\n").nth(1).unwrap_or("{}");
    let parsed: Value =
        serde_json::from_str(body_text).unwrap_or_else(|_| serde_json::json!({ "raw": body_text }));
    if status_ok {
        Ok(parsed)
    } else {
        Err(parsed
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Falha remota no Agent.")
            .to_string())
    }
}

#[tauri::command]
fn remote_agent_ping(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/ping", None)
}

#[tauri::command]
fn remote_agent_set_identity(address: String, name: String) -> Result<Value, String> {
    let body =
        serde_json::to_vec(&serde_json::json!({"name":name})).map_err(|err| err.to_string())?;
    remote_agent_request(&address, "POST", "/api/identity", Some(&body))
}

#[tauri::command]
fn remote_agent_list_automations(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/automations", None)
}

#[tauri::command]
fn remote_agent_open_automation(address: String, id: String) -> Result<Value, String> {
    let encoded = url_encode_component(&id);
    remote_agent_request(
        &address,
        "POST",
        &format!("/api/automations/{encoded}/open"),
        None,
    )
}

#[tauri::command]
fn remote_agent_status(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/status", None)
}

#[tauri::command]
fn remote_agent_spreadsheet_preview(address: String, limit: Option<i64>) -> Result<Value, String> {
    remote_agent_request(
        &address,
        "GET",
        &format!(
            "/api/spreadsheet-preview?limit={}",
            limit.unwrap_or(80).max(1).min(200)
        ),
        None,
    )
}

#[tauri::command]
fn remote_agent_clear_spreadsheet_column(
    address: String,
    workbook: String,
    sheet: String,
    column: String,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&serde_json::json!({
        "workbook": workbook,
        "sheet": sheet,
        "column": column,
    }))
    .map_err(|err| format!("Falha ao preparar limpeza remota da planilha: {err}"))?;
    remote_agent_request(
        &address,
        "POST",
        "/api/spreadsheet-column/clear",
        Some(&body),
    )
}

#[tauri::command]
fn remote_agent_execute_watch_automation(
    address: String,
    automation_name: String,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&serde_json::json!({
        "automation_name": automation_name,
    }))
    .map_err(|err| format!("Falha ao preparar automacao fixa do botao Assistir: {err}"))?;
    remote_agent_request(
        &address,
        "POST",
        "/api/watch-automation/execute",
        Some(&body),
    )
}

#[tauri::command]
fn remote_agent_meshcentral_status(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/meshcentral/status", None)
}

#[tauri::command]
fn remote_agent_screen_snapshot(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/screen/snapshot", None)
}

#[tauri::command]
fn remote_agent_control_event(address: String, event: Value) -> Result<Value, String> {
    let body = serde_json::to_vec(&event)
        .map_err(|err| format!("Falha ao preparar evento remoto: {err}"))?;
    remote_agent_request(&address, "POST", "/api/control/event", Some(&body))
}

#[tauri::command]
fn remote_agent_webrtc_offer(address: String, offer: Value) -> Result<Value, String> {
    let body = serde_json::to_vec(&serde_json::json!({ "offer": offer }))
        .map_err(|err| format!("Falha ao preparar offer WebRTC: {err}"))?;
    remote_agent_request(&address, "POST", "/api/webrtc/offer", Some(&body))
}

#[tauri::command]
fn remote_agent_webrtc_answer(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "GET", "/api/webrtc/answer", None)
}

#[tauri::command]
fn remote_agent_webrtc_clear(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "DELETE", "/api/webrtc", None)
}

#[tauri::command]
fn remote_agent_meshcentral_start(
    address: String,
    mesh_path: String,
    url: Option<String>,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&serde_json::json!({
        "mesh_path": mesh_path,
        "url": url.unwrap_or_default(),
    }))
    .map_err(|err| format!("Falha ao preparar comando do MeshCentral: {err}"))?;
    remote_agent_request(&address, "POST", "/api/meshcentral/start", Some(&body))
}

#[tauri::command]
fn agent_meshcentral_status(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    Ok(meshcentral_status_payload(&root))
}

#[tauri::command]
fn agent_meshcentral_start(
    app: AppHandle,
    mesh_path: String,
    url: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    Ok(start_meshcentral_server_async(root, mesh_path, url))
}

#[tauri::command]
fn agent_webrtc_poll_offer() -> Result<Value, String> {
    Ok(get_webrtc_signal_payload())
}

#[tauri::command]
fn agent_webrtc_set_answer(session_id: String, answer: Value) -> Result<Value, String> {
    Ok(set_webrtc_answer(session_id, answer))
}

#[tauri::command]
fn agent_webrtc_clear() -> Result<Value, String> {
    Ok(clear_webrtc_signal())
}

#[tauri::command]
fn get_agent_mouse_control_state() -> Result<Value, String> {
    Ok(agent_remote_mouse_enabled_payload())
}

#[tauri::command]
fn set_agent_mouse_control_enabled(enabled: bool) -> Result<Value, String> {
    Ok(set_agent_remote_mouse_enabled_value(enabled))
}

#[tauri::command]
fn agent_remote_control_event(event: Value) -> Result<Value, String> {
    handle_agent_remote_control_event(event)
}

#[tauri::command]
fn remote_agent_execute(
    address: String,
    id: String,
    delay: f64,
    loop_start: i32,
    start_company: Option<String>,
    minimize_agent: Option<bool>,
    text_overrides: Option<String>,
) -> Result<Value, String> {
    let encoded = url_encode_component(&id);
    let body = serde_json::to_vec(&serde_json::json!({
        "delay": delay,
        "loop_start": loop_start,
        "start_company": start_company.unwrap_or_default(),
        "minimize_agent": minimize_agent.unwrap_or(false),
        "text_overrides": text_overrides.unwrap_or_default(),
    }))
    .map_err(|err| format!("Falha ao preparar execucao remota: {err}"))?;
    remote_agent_request(
        &address,
        "POST",
        &format!("/api/automations/{encoded}/execute"),
        Some(&body),
    )
}

#[tauri::command]
fn remote_agent_stop(address: String) -> Result<Value, String> {
    remote_agent_request(&address, "POST", "/api/stop", None)
}

#[tauri::command]
fn remote_agent_import_automation_zip(
    address: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<Value, String> {
    let encoded_name = url_encode_component(&file_name);
    remote_agent_request(
        &address,
        "POST",
        &format!("/api/automation-import-zip?file_name={encoded_name}"),
        Some(&bytes),
    )
}

#[tauri::command]
fn remote_agent_get_recognition_preview(
    address: String,
    image_id: String,
) -> Result<Value, String> {
    let encoded = url_encode_component(&image_id);
    remote_agent_request(
        &address,
        "GET",
        &format!("/api/recognition-preview?image_id={encoded}"),
        None,
    )
}

#[tauri::command]
fn remote_agent_delete_automation(address: String, id: String) -> Result<Value, String> {
    let encoded = url_encode_component(&id);
    remote_agent_request(
        &address,
        "DELETE",
        &format!("/api/automations/{encoded}"),
        None,
    )
}

#[tauri::command]
fn show_target_window_overlay(
    app: AppHandle,
    hwnd: i64,
    title: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    hide_target_window_overlay(app.clone(), false).ok();
    let script_path = root.join("overlay_janela_alvo.py");
    if !script_path.exists() {
        return Err(format!("Overlay nao encontrado: {}", script_path.display()));
    }
    let (python_program, python_args) = python_command(&root)?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--hwnd")
        .arg(hwnd.to_string());
    if let Some(value) = title
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--title").arg(value);
    }
    configure_no_window(&mut command);
    let child = command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar overlay: {err}"))?;
    if let Ok(mut guard) = TARGET_OVERLAY_CHILD.lock() {
        *guard = Some(child);
    }
    Ok(serde_json::json!({"visible": true, "hwnd": hwnd}))
}

#[tauri::command]
fn hide_target_window_overlay(_app: AppHandle, clear_target: bool) -> Result<Value, String> {
    if let Ok(mut guard) = TARGET_OVERLAY_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    Ok(serde_json::json!({"visible": false, "clear_target": clear_target}))
}

#[tauri::command]
fn fit_target_window_to_agent_area(_app: AppHandle, hwnd: i64) -> Result<Value, String> {
    if hwnd <= 0 {
        return Err("Janela alvo invalida.".to_string());
    }

    Ok(serde_json::json!({
        "ok": true,
        "adjusted": false,
        "hwnd": hwnd,
        "mode": "preserve_window"
    }))
}

#[tauri::command]
fn fit_active_window_to_agent_area(_app: AppHandle) -> Result<Value, String> {
    Ok(serde_json::json!({
        "ok": true,
        "adjusted": false,
        "mode": "preserve_window"
    }))
}

#[cfg(windows)]
fn fit_window_to_agent_safe_area(
    window: HWND,
    hwnd_value: i64,
    label: &str,
) -> Result<Value, String> {
    unsafe {
        if !IsWindow(window).as_bool() {
            return Err(format!("{label} nao existe mais."));
        }

        let screen_width = GetSystemMetrics(SM_CXSCREEN).max(1024);
        let screen_height = GetSystemMetrics(SM_CYSCREEN).max(768);
        let margin_left = AGENT_SAFE_MARGIN_LEFT;
        let margin_right = AGENT_SAFE_MARGIN_RIGHT;
        let margin_top = AGENT_SAFE_MARGIN_TOP;
        let margin_bottom = AGENT_SAFE_MARGIN_BOTTOM;
        let target_width = (screen_width - margin_left - margin_right).max(640);
        let target_height = (screen_height - margin_top - margin_bottom).max(420);

        let mut current_rect = RECT::default();
        if GetWindowRect(window, &mut current_rect).is_ok() {
            let tolerance = 12;
            let target_right = margin_left + target_width;
            let target_bottom = margin_top + target_height;
            let already_safe = current_rect.left >= margin_left - tolerance
                && current_rect.top >= margin_top - tolerance
                && current_rect.right <= target_right + tolerance
                && current_rect.bottom <= target_bottom + tolerance;
            if already_safe {
                return Ok(serde_json::json!({
                    "ok": true,
                    "adjusted": false,
                    "hwnd": hwnd_value,
                    "safe_area": {
                        "left": margin_left,
                        "top": margin_top,
                        "width": target_width,
                        "height": target_height,
                        "right_margin": margin_right,
                        "bottom_margin": margin_bottom
                    }
                }));
            }
        }

        let _ = ShowWindow(window, SW_RESTORE);
        SetWindowPos(
            window,
            None,
            margin_left,
            margin_top,
            target_width,
            target_height,
            SWP_NOZORDER | SWP_SHOWWINDOW,
        )
        .map_err(|err| format!("Nao foi possivel ajustar {label}: {err}"))?;

        Ok(serde_json::json!({
            "ok": true,
            "adjusted": true,
            "hwnd": hwnd_value,
            "safe_area": {
                "left": margin_left,
                "top": margin_top,
                "width": target_width,
                "height": target_height,
                "right_margin": margin_right,
                "bottom_margin": margin_bottom
            }
        }))
    }
}

#[cfg(windows)]
fn set_agent_windows_work_area(enabled: bool) -> Result<Value, String> {
    // O Agent nao deve mais reservar/forcar uma "area segura" na VM.
    // Esse guard deixava janelas maximizadas presas dentro do desenho do Agent,
    // causando capturas/OCR cortados quando a automacao rodava em tela cheia.
    AGENT_WORK_AREA_GUARD_ENABLED.store(false, Ordering::Relaxed);
    let screen_width = unsafe { GetSystemMetrics(SM_CXSCREEN).max(1024) };
    let screen_height = unsafe { GetSystemMetrics(SM_CYSCREEN).max(768) };
    Ok(serde_json::json!({
        "ok": true,
        "enabled": false,
        "requested": enabled,
        "mode": "overlay_only",
        "safe_area": {
            "left": 0,
            "top": 0,
            "width": screen_width,
            "height": screen_height
        }
    }))
}

#[cfg(not(windows))]
fn set_agent_windows_work_area(_enabled: bool) -> Result<Value, String> {
    Ok(serde_json::json!({"ok": true, "enabled": false}))
}

#[cfg(windows)]
fn protect_agent_fullscreen_area() {
    if !AGENT_WORK_AREA_GUARD_ENABLED.load(Ordering::Relaxed) {
        return;
    }
    unsafe {
        let _ = EnumWindows(Some(protect_maximized_window_callback), LPARAM(0));

        let window = GetForegroundWindow();
        if window.0.is_null() || !IsWindow(window).as_bool() {
            return;
        }

        let mut process_id = 0u32;
        GetWindowThreadProcessId(window, Some(&mut process_id));
        if process_id == std::process::id() {
            return;
        }

        let mut rect = RECT::default();
        if GetWindowRect(window, &mut rect).is_err() {
            return;
        }
        let screen_width = GetSystemMetrics(SM_CXSCREEN).max(1024);
        let screen_height = GetSystemMetrics(SM_CYSCREEN).max(768);
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        let nearly_fullscreen = width >= screen_width - 24 && height >= screen_height - 96;
        if !IsZoomed(window).as_bool() && !nearly_fullscreen {
            return;
        }

        let target_right = screen_width - AGENT_SAFE_MARGIN_RIGHT;
        let target_bottom = screen_height - AGENT_SAFE_MARGIN_BOTTOM;
        let outside_safe_area = rect.left < AGENT_SAFE_MARGIN_LEFT - 12
            || rect.top < AGENT_SAFE_MARGIN_TOP - 12
            || rect.right > target_right + 12
            || rect.bottom > target_bottom + 12;
        if outside_safe_area {
            let _ = fit_window_to_agent_safe_area(
                window,
                window.0 as isize as i64,
                "Janela em tela cheia",
            );
        }
    }
}

#[cfg(windows)]
unsafe extern "system" fn protect_maximized_window_callback(window: HWND, _lparam: LPARAM) -> BOOL {
    if window.0.is_null()
        || !IsWindow(window).as_bool()
        || !IsWindowVisible(window).as_bool()
        || !IsZoomed(window).as_bool()
    {
        return BOOL(1);
    }

    let mut process_id = 0u32;
    GetWindowThreadProcessId(window, Some(&mut process_id));
    if process_id == std::process::id() {
        return BOOL(1);
    }

    let mut rect = RECT::default();
    if GetWindowRect(window, &mut rect).is_err() {
        return BOOL(1);
    }
    let screen_width = GetSystemMetrics(SM_CXSCREEN).max(1024);
    let screen_height = GetSystemMetrics(SM_CYSCREEN).max(768);
    let target_right = screen_width - AGENT_SAFE_MARGIN_RIGHT;
    let target_bottom = screen_height - AGENT_SAFE_MARGIN_BOTTOM;
    let outside_safe_area = rect.left < AGENT_SAFE_MARGIN_LEFT - 12
        || rect.top < AGENT_SAFE_MARGIN_TOP - 12
        || rect.right > target_right + 12
        || rect.bottom > target_bottom + 12;
    if outside_safe_area {
        let _ =
            fit_window_to_agent_safe_area(window, window.0 as isize as i64, "Janela maximizada");
    }
    BOOL(1)
}

#[tauri::command]
fn update_sequence_settings(
    app: AppHandle,
    sequence: String,
    execution_mode: String,
    after_loop_sequence: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-sequence-settings".into(),
        "--sequencia".into(),
        sequence,
        "--modo-execucao".into(),
        execution_mode,
    ];
    if let Some(value) = after_loop_sequence {
        if !value.trim().is_empty() {
            args.push("--sequencia-apos-loop".into());
            args.push(value);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_initial_sequence(app: AppHandle, sequence: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "update-initial-sequence".into(),
            "--sequencia".into(),
            sequence,
        ],
    )
}

fn copy_if_exists(
    source: &Path,
    destination: &Path,
    copied: &mut Vec<String>,
    missing: &mut Vec<String>,
) {
    if source.exists() {
        if let Some(parent) = destination.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if fs::copy(source, destination).is_ok() {
            copied.push(
                destination
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
            );
        }
    } else {
        missing.push(
            source
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        );
    }
}

fn automation_launcher() -> String {
    [
        "@echo off",
        "setlocal",
        "cd /d \"%~dp0\"",
        "",
        "set \"PYTHON_CMD=python\"",
        "where py >nul 2>&1",
        "if not errorlevel 1 set \"PYTHON_CMD=py -3\"",
        "",
        "if not exist \"executar_automacao.py\" (",
        "    echo Arquivo executar_automacao.py nao encontrado nesta pasta.",
        "    pause",
        "    endlocal",
        "    exit /b 1",
        ")",
        "",
        "call %PYTHON_CMD% executar_automacao.py --modo normal",
        "endlocal",
        "",
    ]
    .join("\n")
}

fn build_guide() -> String {
    [
        "EXECUTOR SEPARADO DA AUTOMACAO",
        "==============================",
        "",
        "Arquivos desta pasta:",
        "- executar_automacao.bat: inicia a automacao pelo executor atual.",
        "- executar_automacao.py: executor separado do roteiro gravado.",
        "- gerenciar_dados_planilha.py: utilitario para listar e editar os itens do loop na planilha.",
        "- mapeamento_teclado.json: roteiro completo salvo pela interface.",
        "- db.xlsx: planilha usada para ler os dados mais recentes.",
        "- imagens/: referencias usadas pelos blocos de clicar por imagem.",
        "",
        "Como usar:",
        "1. Edite a planilha db.xlsx se precisar atualizar os dados.",
        "2. Clique duas vezes em executar_automacao.bat.",
        "3. Para editar visualmente, abra a automacao no FlowDetect Studio.",
        "4. Para rodar em outro computador, importe o ZIP no FlowDetect Agent.",
    ]
    .join("\n")
}

fn export_guide(automation_name: &str) -> String {
    [
        "AUTOMACAO EXPORTADA SEPARADA DO MAIN",
        "====================================",
        "",
        &format!("Nome da automacao: {automation_name}"),
        "",
        "Esta pasta contem apenas os arquivos necessarios para rodar a automacao gerada.",
        "A edicao visual continua no FlowDetect Studio.",
        "",
        "Arquivos principais desta pasta:",
        "- iniciar.bat: inicia a automacao pelo executor atual.",
        "- executar_automacao.py: executor do roteiro.",
        "- gerenciar_dados_planilha.py: edita dados do loop e textos livres.",
        "- mapeamento_teclado.json: roteiro atual salvo.",
        "- db.xlsx: base de dados usada na execucao.",
        "- imagens/: referencias visuais usadas pelos blocos de clicar por imagem.",
        "",
        "Como usar:",
        "1. Clique duas vezes em iniciar.bat.",
        "2. Ajuste o atraso inicial, se precisar.",
        "3. Use Dados do loop para adicionar, remover ou reordenar itens da planilha durante a execucao.",
        "4. Use Textos livres para alterar os textos digitados sem voltar ao gerador.",
        "5. Inicie a rotina pela propria interface da automacao exportada.",
        "",
        "Observacao:",
        "- Esta exportacao foi pensada para o executor atual do FlowDetect.",
        "- O Python precisa estar instalado no Windows para a parte de execucao funcionar.",
    ]
    .join("\n")
}

fn configure_background_process(command: &mut Command) {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    configure_no_window(command);
}

fn set_running_state(state: &State<'_, RuntimeState>, running: bool) {
    if let Ok(mut guard) = state.running.lock() {
        *guard = running;
    }
}

fn set_pid_state(state: &State<'_, RuntimeState>, pid: Option<u32>) {
    if let Ok(mut guard) = state.pid.lock() {
        *guard = pid;
    }
}

fn emit_running_state(app: &AppHandle, running: bool) {
    let _ = app.emit("test-execution-state", TestExecutionPayload { running });
}

fn emit_log(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit(
        "test-log",
        TestLogPayload {
            message: message.into(),
        },
    );
}

fn parse_progress_line(line: &str) -> Option<TestProgressPayload> {
    let mut parts = line.splitn(6, '|');
    let marker = parts.next()?;
    if marker != "PROGRESS" {
        return None;
    }

    Some(TestProgressPayload {
        current: parts
            .next()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        total: parts
            .next()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        percent: parts
            .next()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0.0),
        description: parts.next().unwrap_or_default().to_string(),
        company: parts.next().unwrap_or_default().to_string(),
    })
}

fn spawn_test_process(
    app: &AppHandle,
    state: &State<'_, RuntimeState>,
    mut command: Command,
    success_message: String,
    error_context: &str,
) -> Result<String, String> {
    let already_running = state
        .running
        .lock()
        .map_err(|_| "Falha ao consultar o estado da execucao.".to_string())?
        .to_owned();
    if already_running {
        return Err(
            "Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.".into(),
        );
    }

    let root = workspace_root(app);
    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));
    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(
        &root,
        format!("Iniciando processo de teste: {error_context}"),
    );

    configure_background_process(&mut command);

    let mut child = command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar {error_context}: {err}"))?;
    let child_pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "Falha ao registrar o processo de teste.".to_string())?;
        *guard = Some(child);
    }
    set_running_state(state, true);
    set_pid_state(state, Some(child_pid));
    emit_running_state(app, true);

    append_launcher_log(
        &root,
        format!("Processo iniciado com sucesso: {error_context}"),
    );
    emit_log(app, format!("Processo iniciado: {error_context}."));

    let app_handle = app.clone();
    let root_for_thread = root.clone();
    let child_state = state.child.clone();
    let running_state = state.running.clone();
    let pid_state = state.pid.clone();
    let error_context_owned = error_context.to_string();

    thread::spawn(move || {
        let stdout_thread = stdout.map(|stdout_pipe| {
            let app = app_handle.clone();
            let root = root_for_thread.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout_pipe);
                for raw_line in reader.lines() {
                    let Ok(line) = raw_line else {
                        continue;
                    };
                    if let Some(payload) = parse_progress_line(&line) {
                        let _ = app.emit("test-progress", payload);
                    } else if !line.trim().is_empty() {
                        append_launcher_log(&root, format!("STDOUT: {line}"));
                        emit_log(&app, line);
                    }
                }
            })
        });

        let stderr_thread = stderr.map(|stderr_pipe| {
            let app = app_handle.clone();
            let root = root_for_thread.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr_pipe);
                for raw_line in reader.lines() {
                    let Ok(line) = raw_line else {
                        continue;
                    };
                    if !line.trim().is_empty() {
                        append_launcher_log(&root, format!("STDERR: {line}"));
                        emit_log(&app, line);
                    }
                }
            })
        });

        let exit_code = {
            let mut guard = match child_state.lock() {
                Ok(guard) => guard,
                Err(_) => {
                    emit_log(&app_handle, "Falha ao acessar o processo em execucao.");
                    if let Ok(mut running_guard) = running_state.lock() {
                        *running_guard = false;
                    }
                    emit_running_state(&app_handle, false);
                    let _ = app_handle.emit(
                        "test-finished",
                        TestFinishedPayload {
                            success: false,
                            code: -1,
                        },
                    );
                    return;
                }
            };

            let Some(child) = guard.as_mut() else {
                if let Ok(mut running_guard) = running_state.lock() {
                    *running_guard = false;
                }
                emit_running_state(&app_handle, false);
                let _ = app_handle.emit(
                    "test-finished",
                    TestFinishedPayload {
                        success: false,
                        code: -1,
                    },
                );
                return;
            };

            child
                .wait()
                .ok()
                .and_then(|status| status.code())
                .unwrap_or(-1)
        };

        if let Some(handle) = stdout_thread {
            let _ = handle.join();
        }
        if let Some(handle) = stderr_thread {
            let _ = handle.join();
        }

        if let Ok(mut guard) = child_state.lock() {
            *guard = None;
        }
        if let Ok(mut running_guard) = running_state.lock() {
            *running_guard = false;
        }
        if let Ok(mut pid_guard) = pid_state.lock() {
            *pid_guard = None;
        }
        emit_running_state(&app_handle, false);
        let success = exit_code == 0;
        append_launcher_log(
            &root_for_thread,
            format!(
                "Processo finalizado: {} | code={exit_code}",
                error_context_owned
            ),
        );
        let _ = app_handle.emit(
            "test-finished",
            TestFinishedPayload {
                success,
                code: exit_code,
            },
        );
    });

    Ok(success_message)
}

#[tauri::command]
fn get_test_execution_state(
    state: State<'_, RuntimeState>,
) -> Result<TestExecutionPayload, String> {
    let running = state
        .running
        .lock()
        .map_err(|_| "Falha no estado interno da execucao.".to_string())?
        .to_owned();
    Ok(TestExecutionPayload { running })
}

#[tauri::command]
fn move_blocks_to_sequence(
    app: AppHandle,
    orders: Vec<i32>,
    sequence: String,
) -> Result<Value, String> {
    if orders.is_empty() {
        return Err("Selecione pelo menos um bloco para mover.".into());
    }
    let root = workspace_root(&app);
    let mut args = vec![
        "move-to-sequence".into(),
        "--sequencia".into(),
        sequence,
        "--orders".into(),
    ];
    args.extend(orders.into_iter().map(|order| order.to_string()));
    run_helper_json(&root, &args)
}

#[tauri::command]
fn get_roadmap(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &[String::from("list")])
}

#[tauri::command]
fn get_workbook_meta(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &[String::from("workbook-meta")])
}

#[tauri::command]
fn get_workbook_preview(
    app: AppHandle,
    workbook: Option<String>,
    sheet: Option<String>,
    limit: Option<i32>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![String::from("workbook-preview")];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    if let Some(sheet_name) = sheet {
        if !sheet_name.trim().is_empty() {
            args.push("--sheet".into());
            args.push(sheet_name);
        }
    }
    if let Some(limit_value) = limit {
        args.push("--limit".into());
        args.push(limit_value.max(1).to_string());
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn list_saved_automations(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &[String::from("automation-library-list")])
}

#[tauri::command]
fn list_open_windows(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_script_json(&root, "listar_janelas_abertas.py", &[])
}

#[tauri::command]
async fn map_window_elements(
    app: AppHandle,
    title: Option<String>,
    hwnd: Option<i64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "scan".into(),
        "--max-depth".into(),
        "8".into(),
        "--max-items".into(),
        "700".into(),
    ];
    if let Some(value) = hwnd {
        if value > 0 {
            args.push("--hwnd".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = title {
        if !value.trim().is_empty() {
            args.push("--title".into());
            args.push(value);
        }
    }
    tauri::async_runtime::spawn_blocking(move || run_uia_mapper_json(&root, &args))
        .await
        .map_err(|err| format!("Falha ao aguardar mapeamento da janela: {err}"))?
}

#[tauri::command]
async fn capture_uia_element_from_cursor(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    tauri::async_runtime::spawn_blocking(move || {
        run_uia_mapper_json(&root, &["capture-cursor".into()])
    })
    .await
    .map_err(|err| format!("Falha ao capturar elemento: {err}"))?
}

#[tauri::command]
async fn capture_uia_element_from_click(
    app: AppHandle,
    timeout: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let args = vec![
        "capture-click".into(),
        "--timeout".into(),
        timeout.unwrap_or(12.0).max(1.0).to_string(),
    ];
    tauri::async_runtime::spawn_blocking(move || run_uia_mapper_json(&root, &args))
        .await
        .map_err(|err| format!("Falha ao capturar clique: {err}"))?
}

#[tauri::command]
async fn select_uia_element_from_window(
    app: AppHandle,
    title: Option<String>,
    hwnd: Option<i64>,
    timeout: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "select-visual".into(),
        "--timeout".into(),
        timeout.unwrap_or(20.0).max(3.0).to_string(),
    ];
    if let Some(value) = hwnd {
        if value > 0 {
            args.push("--hwnd".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = title {
        if !value.trim().is_empty() {
            args.push("--title".into());
            args.push(value);
        }
    }
    tauri::async_runtime::spawn_blocking(move || run_uia_mapper_json(&root, &args))
        .await
        .map_err(|err| format!("Falha ao selecionar elemento na janela: {err}"))?
}

#[tauri::command]
async fn highlight_uia_element(app: AppHandle, element: Value) -> Result<Value, String> {
    let root = workspace_root(&app);
    let args = vec![
        "highlight".into(),
        "--element-json".into(),
        serde_json::to_string(&element)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--seconds".into(),
        "1.4".into(),
    ];
    tauri::async_runtime::spawn_blocking(move || run_uia_mapper_json(&root, &args))
        .await
        .map_err(|err| format!("Falha ao destacar elemento: {err}"))?
}

#[tauri::command]
fn create_saved_automation(
    app: AppHandle,
    nome: String,
    descricao: String,
    categoria: String,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "automation-create".into(),
            "--nome".into(),
            nome,
            "--descricao".into(),
            descricao,
            "--categoria".into(),
            categoria,
        ],
    )
}

#[tauri::command]
fn open_saved_automation(app: AppHandle, id: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &["automation-open".into(), "--id".into(), id])
}

#[tauri::command]
fn duplicate_saved_automation(app: AppHandle, id: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &["automation-duplicate".into(), "--id".into(), id])
}

#[tauri::command]
fn rename_saved_automation(
    app: AppHandle,
    id: String,
    nome: String,
    descricao: Option<String>,
    categoria: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "automation-rename".into(),
        "--id".into(),
        id,
        "--nome".into(),
        nome,
    ];
    if let Some(value) = descricao {
        args.push("--descricao".into());
        args.push(value);
    }
    if let Some(value) = categoria {
        args.push("--categoria".into());
        args.push(value);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn delete_saved_automation(app: AppHandle, id: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &["automation-delete".into(), "--id".into(), id])
}

#[tauri::command]
fn execute_saved_automation(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    id: String,
    delay: f64,
    loop_start: i32,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let opened = run_helper_json(
        &root,
        &["automation-open".into(), "--id".into(), id.clone()],
    )?;
    let _ = run_helper_json(&root, &["automation-mark-run".into(), "--id".into(), id]);

    let has_spreadsheet = opened
        .get("summary")
        .and_then(|summary| summary.get("spreadsheet_blocks"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
        > 0;

    launch_executor_for_current_root(
        &app,
        &state,
        if has_spreadsheet { "loop" } else { "normal" },
        delay,
        loop_start,
        None,
    )
}

#[tauri::command]
fn import_workbook(app: AppHandle, file_name: String, bytes: Vec<u8>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let planilhas_dir = root.join("planilhas");
    fs::create_dir_all(&planilhas_dir)
        .map_err(|err| format!("Falha ao criar pasta planilhas: {err}"))?;

    let sanitized_name = sanitize_workbook_filename(&file_name);
    let destino = planilhas_dir.join(&sanitized_name);
    fs::write(&destino, bytes)
        .map_err(|err| format!("Falha ao salvar planilha importada: {err}"))?;

    Ok(serde_json::json!({
        "saved": destino.display().to_string(),
        "workbook_id": format!("planilhas/{}", sanitized_name),
    }))
}

fn resolve_safe_workbook_path(root: &PathBuf, workbook: &str) -> Result<PathBuf, String> {
    let normalized = workbook.trim().replace('\\', "/");
    if normalized.is_empty() {
        return Err("Nenhuma planilha selecionada.".to_string());
    }

    let requested_path = Path::new(&normalized);
    if requested_path.is_absolute() || normalized.split('/').any(|part| part == "..") {
        return Err("Caminho da planilha invalido.".to_string());
    }

    let workbook_path = root.join(&normalized);
    if !workbook_path.exists() {
        return Err(format!("Planilha nao encontrada: {normalized}"));
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Falha ao validar pasta do projeto: {err}"))?;
    let canonical_workbook = workbook_path
        .canonicalize()
        .map_err(|err| format!("Falha ao validar planilha: {err}"))?;
    if !canonical_workbook.starts_with(&canonical_root) {
        return Err("A planilha selecionada esta fora da pasta do projeto.".to_string());
    }

    Ok(canonical_workbook)
}

#[tauri::command]
fn open_workbook(app: AppHandle, workbook: String) -> Result<String, String> {
    let root = workspace_root(&app);
    let workbook_path = resolve_safe_workbook_path(&root, &workbook)?;
    Command::new("explorer")
        .arg(&workbook_path)
        .spawn()
        .map_err(|err| format!("Falha ao abrir planilha: {err}"))?;
    Ok(workbook_path.display().to_string())
}

#[tauri::command]
fn delete_workbook(app: AppHandle, workbook: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    let normalized = workbook.trim().replace('\\', "/");
    let canonical_workbook = resolve_safe_workbook_path(&root, &workbook)?;

    fs::remove_file(&canonical_workbook)
        .map_err(|err| format!("Falha ao excluir planilha: {err}"))?;

    let meta = run_helper_json(&root, &[String::from("workbook-meta")])?;
    let next_workbook_id = meta
        .get("default_workbook")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    Ok(serde_json::json!({
        "deleted": normalized,
        "workbook": meta,
        "next_workbook_id": next_workbook_id,
    }))
}

#[tauri::command]
fn import_image_asset(app: AppHandle, file_name: String, bytes: Vec<u8>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let imagens_dir = root.join("imagens");
    fs::create_dir_all(&imagens_dir)
        .map_err(|err| format!("Falha ao criar pasta imagens: {err}"))?;

    let sanitized_name = sanitize_asset_filename(&file_name, "imagem.png");
    let destino = imagens_dir.join(&sanitized_name);
    fs::write(&destino, bytes).map_err(|err| format!("Falha ao salvar imagem importada: {err}"))?;

    Ok(serde_json::json!({
        "saved": destino.display().to_string(),
        "image_id": format!("imagens/{}", sanitized_name),
    }))
}

fn append_success_flow_args(
    args: &mut Vec<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) {
    if let Some(value) = ao_sucesso {
        if !value.trim().is_empty() {
            args.push("--ao-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
}

fn append_compare_diverge_args(
    args: &mut Vec<String>,
    ao_divergir: Option<String>,
    bloco_divergir: Option<i32>,
    sequencia_divergir: Option<String>,
    atraso_sequencia_divergir: Option<f64>,
) {
    if let Some(value) = ao_divergir {
        if !value.trim().is_empty() {
            args.push("--ao-divergir".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_divergir {
        if value > 0 {
            args.push("--bloco-divergir".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_divergir {
        if !value.trim().is_empty() {
            args.push("--sequencia-divergir".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_divergir {
        args.push("--atraso-sequencia-divergir".into());
        args.push(value.max(0.0).to_string());
    }
}

#[tauri::command]
fn capture_mouse_click(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_script_json(&root, "capturar_mouse_global.py", &[])
}

fn smart_recorder_dir(root: &Path) -> PathBuf {
    root.join(".flowdetect_recorder")
}

fn smart_recorder_events_path(root: &Path) -> PathBuf {
    smart_recorder_dir(root).join("eventos.jsonl")
}

fn smart_recorder_stop_path(root: &Path) -> PathBuf {
    smart_recorder_dir(root).join("parar.flag")
}

fn read_smart_recorder_events(path: &Path) -> Vec<Value> {
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    content
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .collect()
}

fn write_smart_recorder_events(path: &Path, events: &[Value]) -> Result<(), String> {
    let mut content = String::new();
    for event in events {
        content.push_str(
            &serde_json::to_string(event)
                .map_err(|err| format!("Falha ao serializar evento: {err}"))?,
        );
        content.push('\n');
    }
    fs::write(path, content).map_err(|err| format!("Falha ao atualizar eventos do gravador: {err}"))
}

#[tauri::command]
fn start_smart_recorder(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let script_path = root.join("gravador_inteligente.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }

    {
        let mut guard = SMART_RECORDER_CHILD
            .lock()
            .map_err(|_| "Falha ao acessar estado do gravador.".to_string())?;
        if let Some(child) = guard.as_mut() {
            if child
                .try_wait()
                .map_err(|err| format!("Falha ao verificar gravador: {err}"))?
                .is_none()
            {
                return Err("O Gravador inteligente ja esta em execucao.".to_string());
            }
        }
        *guard = None;
    }

    let recorder_dir = smart_recorder_dir(&root);
    let images_dir = root.join("Imagens").join("gravador");
    fs::create_dir_all(&recorder_dir)
        .map_err(|err| format!("Falha ao preparar gravador: {err}"))?;
    fs::create_dir_all(&images_dir)
        .map_err(|err| format!("Falha ao preparar imagens do gravador: {err}"))?;
    let events_path = smart_recorder_events_path(&root);
    let stop_path = smart_recorder_stop_path(&root);
    let _ = fs::remove_file(&events_path);
    let _ = fs::remove_file(&stop_path);

    let (python_program, python_args) = python_command(&root)?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--output")
        .arg(&events_path)
        .arg("--images-dir")
        .arg(&images_dir)
        .arg("--stop-flag")
        .arg(&stop_path);
    configure_no_window(&mut command);
    let child = command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar o Gravador inteligente: {err}"))?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }

    let mut guard = SMART_RECORDER_CHILD
        .lock()
        .map_err(|_| "Falha ao salvar estado do gravador.".to_string())?;
    *guard = Some(child);
    Ok(serde_json::json!({
        "running": true,
        "events": [],
        "message": "Gravador iniciado. Use ESC para finalizar."
    }))
}

#[tauri::command]
fn stop_smart_recorder(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    fs::create_dir_all(smart_recorder_dir(&root))
        .map_err(|err| format!("Falha ao parar gravador: {err}"))?;
    fs::write(smart_recorder_stop_path(&root), "stop")
        .map_err(|err| format!("Falha ao sinalizar parada: {err}"))?;
    thread::sleep(Duration::from_millis(250));
    {
        let mut guard = SMART_RECORDER_CHILD
            .lock()
            .map_err(|_| "Falha ao acessar estado do gravador.".to_string())?;
        if let Some(child) = guard.as_mut() {
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        *guard = None;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    get_smart_recorder_status(app)
}

#[tauri::command]
fn get_smart_recorder_status(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut finished_now = false;
    let running = {
        let mut guard = SMART_RECORDER_CHILD
            .lock()
            .map_err(|_| "Falha ao acessar estado do gravador.".to_string())?;
        if let Some(child) = guard.as_mut() {
            if child
                .try_wait()
                .map_err(|err| format!("Falha ao verificar gravador: {err}"))?
                .is_some()
            {
                *guard = None;
                finished_now = true;
                false
            } else {
                true
            }
        } else {
            false
        }
    };
    if finished_now {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    Ok(serde_json::json!({
        "running": running,
        "events": read_smart_recorder_events(&smart_recorder_events_path(&root)),
    }))
}

#[tauri::command]
fn update_smart_recorder_click_area(
    app: AppHandle,
    event_id: i32,
    width: i32,
    height: i32,
    clicks: i32,
    click_action: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let events_path = smart_recorder_events_path(&root);
    let mut events = read_smart_recorder_events(&events_path);
    let index = events
        .iter()
        .position(|event| {
            event.get("id").and_then(Value::as_i64).unwrap_or(0) == i64::from(event_id)
        })
        .ok_or_else(|| "Evento do clique nao encontrado.".to_string())?;
    let event_json = serde_json::to_string(&events[index])
        .map_err(|err| format!("Falha ao preparar evento do clique: {err}"))?;
    let script_path = root.join("gravador_inteligente.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }
    let images_dir = root.join("Imagens").join("gravador");
    fs::create_dir_all(&images_dir)
        .map_err(|err| format!("Falha ao preparar imagens do gravador: {err}"))?;
    let mut args = vec![
        "--recrop".into(),
        "--event-json".into(),
        event_json,
        "--output".into(),
        events_path.display().to_string(),
        "--images-dir".into(),
        images_dir.display().to_string(),
        "--stop-flag".into(),
        smart_recorder_stop_path(&root).display().to_string(),
        "--crop-width".into(),
        width.max(40).to_string(),
        "--crop-height".into(),
        height.max(40).to_string(),
        "--clicks".into(),
        clicks.max(1).min(2).to_string(),
    ];
    if let Some(value) = click_action {
        args.push("--click-action".into());
        args.push(value);
    }
    let updated = run_script_json(&root, "gravador_inteligente.py", &args)?;
    events[index] = updated.clone();
    write_smart_recorder_events(&events_path, &events)?;
    Ok(serde_json::json!({
        "event": updated,
        "events": events,
    }))
}

#[tauri::command]
fn delete_smart_recorder_event(app: AppHandle, event_id: i32) -> Result<Value, String> {
    let root = workspace_root(&app);
    let events_path = smart_recorder_events_path(&root);
    let mut events = read_smart_recorder_events(&events_path);
    let removed = events
        .iter()
        .position(|event| {
            event.get("id").and_then(Value::as_i64).unwrap_or(0) == i64::from(event_id)
        })
        .map(|index| events.remove(index))
        .ok_or_else(|| "Bloco gravado nao encontrado.".to_string())?;

    if let Some(image_id) = removed.get("image_id").and_then(Value::as_str) {
        let normalized = image_id.replace('\\', "/");
        if normalized.starts_with("imagens/gravador/") {
            let file_name = Path::new(&normalized)
                .file_name()
                .ok_or_else(|| "Nome da imagem do gravador invalido.".to_string())?;
            let image_path = root.join("Imagens").join("gravador").join(file_name);
            let _ = fs::remove_file(image_path);
        }
    }

    write_smart_recorder_events(&events_path, &events)?;
    Ok(serde_json::json!({
        "events": events,
    }))
}

#[tauri::command]
fn clear_smart_recorder_events(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let events_path = smart_recorder_events_path(&root);
    if events_path.exists() {
        fs::write(&events_path, "")
            .map_err(|err| format!("Falha ao limpar blocos do gravador: {err}"))?;
    }
    Ok(serde_json::json!({
        "events": [],
    }))
}

#[tauri::command]
fn update_smart_recorder_event_delay(
    app: AppHandle,
    event_id: i32,
    delay: f64,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let events_path = smart_recorder_events_path(&root);
    let mut events = read_smart_recorder_events(&events_path);
    let index = events
        .iter()
        .position(|event| {
            event.get("id").and_then(Value::as_i64).unwrap_or(0) == i64::from(event_id)
        })
        .ok_or_else(|| "Bloco gravado nao encontrado.".to_string())?;
    events[index]["delay"] = serde_json::json!(delay.max(0.0));
    let updated = events[index].clone();
    write_smart_recorder_events(&events_path, &events)?;
    Ok(serde_json::json!({
        "event": updated,
        "events": events,
    }))
}

#[tauri::command]
fn add_text_block(
    app: AppHandle,
    text: String,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    editavel_execucao: Option<bool>,
    rotulo_execucao: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-text".into(),
        "--text".into(),
        text,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    if let Some(value) = editavel_execucao {
        args.push("--editavel-execucao".into());
        args.push(if value { "true" } else { "false" }.into());
    }
    if let Some(value) = rotulo_execucao
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        args.push("--rotulo-execucao".into());
        args.push(value.to_string());
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_key_block(
    app: AppHandle,
    keys: String,
    repeat: i32,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-key".into(),
        "--keys".into(),
        keys,
        "--repeat".into(),
        repeat.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_loop_start_block(
    app: AppHandle,
    delay: f64,
    sequencia: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-loop-start".into(), "--delay".into(), delay.to_string()];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_loop_end_block(
    app: AppHandle,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-loop-end".into(), "--delay".into(), delay.to_string()];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_mouse_block(
    app: AppHandle,
    x: i32,
    y: i32,
    button: String,
    clicks: i32,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-mouse".into(),
        "--x".into(),
        x.to_string(),
        "--y".into(),
        y.to_string(),
        "--button".into(),
        button,
        "--clicks".into(),
        clicks.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

fn append_embedded_recognition_ocr_args(
    args: &mut Vec<String>,
    modo_reconhecimento: Option<String>,
    texto_ocr_busca: Option<String>,
    acao_ocr: Option<String>,
    salvar_ocr_em: Option<String>,
    varredura_scroll: Option<bool>,
    varredura_scroll_tentativas: Option<i32>,
    varredura_scroll_pixels: Option<i32>,
    varredura_scroll_direcao: Option<String>,
) {
    args.extend([
        "--modo-reconhecimento".into(),
        modo_reconhecimento.unwrap_or_else(|| "imagem".to_string()),
        "--texto-ocr-busca".into(),
        texto_ocr_busca.unwrap_or_default(),
        "--acao-ocr".into(),
        acao_ocr.unwrap_or_else(|| "clicar".to_string()),
        "--salvar-ocr-em".into(),
        salvar_ocr_em.unwrap_or_default(),
        "--varredura-scroll".into(),
        varredura_scroll.unwrap_or(true).to_string(),
        "--varredura-scroll-tentativas".into(),
        varredura_scroll_tentativas.unwrap_or(4).clamp(0, 8).to_string(),
        "--varredura-scroll-pixels".into(),
        varredura_scroll_pixels.unwrap_or(520).max(120).to_string(),
        "--varredura-scroll-direcao".into(),
        varredura_scroll_direcao.unwrap_or_else(|| "baixo".to_string()),
    ]);
}

#[tauri::command]
fn add_image_click_block(
    app: AppHandle,
    imagem: String,
    timeout: f64,
    confianca: f64,
    perfil_busca: Option<String>,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    texto_ocr_esperado: Option<String>,
    modo_reconhecimento: Option<String>,
    texto_ocr_busca: Option<String>,
    acao_ocr: Option<String>,
    salvar_ocr_em: Option<String>,
    varredura_scroll: Option<bool>,
    varredura_scroll_tentativas: Option<i32>,
    varredura_scroll_pixels: Option<i32>,
    varredura_scroll_direcao: Option<String>,
    leitura_relativa_ativa: Option<bool>,
    leitura_relativa_lado: Option<String>,
    leitura_relativa_largura: Option<i32>,
    leitura_relativa_altura: Option<i32>,
    leitura_relativa_offset_x: Option<i32>,
    leitura_relativa_offset_y: Option<i32>,
    leitura_relativa_salvar_em: Option<String>,
    ocr_target_layouts: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-image-click".into(),
        "--imagem".into(),
        imagem,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.to_string(),
        "--perfil-busca".into(),
        perfil_busca.unwrap_or_else(|| "balanced".to_string()),
        "--clicar".into(),
        clicar.to_string(),
        "--clicks".into(),
        clicks.max(0).to_string(),
        "--offset-x".into(),
        offset_x.to_string(),
        "--offset-y".into(),
        offset_y.to_string(),
        "--janela-alvo".into(),
        janela_alvo.unwrap_or_default(),
        "--texto-ocr-esperado".into(),
        texto_ocr_esperado.unwrap_or_default(),
    ];
    append_embedded_recognition_ocr_args(
        &mut args,
        modo_reconhecimento,
        texto_ocr_busca,
        acao_ocr,
        salvar_ocr_em,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend([
        "--leitura-relativa-ativa".into(),
        leitura_relativa_ativa.unwrap_or(false).to_string(),
        "--leitura-relativa-lado".into(),
        leitura_relativa_lado.unwrap_or_else(|| "direita".to_string()),
        "--leitura-relativa-largura".into(),
        leitura_relativa_largura.unwrap_or(140).max(16).to_string(),
        "--leitura-relativa-altura".into(),
        leitura_relativa_altura.unwrap_or(40).max(12).to_string(),
        "--leitura-relativa-offset-x".into(),
        leitura_relativa_offset_x.unwrap_or(0).to_string(),
        "--leitura-relativa-offset-y".into(),
        leitura_relativa_offset_y.unwrap_or(0).to_string(),
        "--leitura-relativa-salvar-em".into(),
        leitura_relativa_salvar_em.unwrap_or_default(),
        "--ocr-target-layouts".into(),
        ocr_target_layouts.unwrap_or_else(|| "[]".to_string()),
        "--ao-nao-encontrar".into(),
        ao_nao_encontrar,
    ]);
    if let Some(value) = sequencia_nao_encontrar {
        if !value.trim().is_empty() {
            args.push("--sequencia-nao-encontrar".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_nao_encontrar {
        if value > 0 {
            args.push("--bloco-nao-encontrar".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = atraso_sequencia_nao_encontrar {
        args.push("--atraso-sequencia-nao-encontrar".into());
        args.push(value.max(0.0).to_string());
    }
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

fn append_ocr_text_args(
    args: &mut Vec<String>,
    texto: String,
    acao: String,
    timeout: f64,
    confianca: f64,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    salvar_em: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    varredura_scroll: bool,
    varredura_scroll_tentativas: i32,
    varredura_scroll_pixels: i32,
    varredura_scroll_direcao: Option<String>,
) {
    args.extend([
        "--texto".into(),
        texto,
        "--acao".into(),
        acao,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.clamp(0.35, 1.0).to_string(),
        "--clicar".into(),
        clicar.to_string(),
        "--clicks".into(),
        clicks.max(0).to_string(),
        "--offset-x".into(),
        offset_x.to_string(),
        "--offset-y".into(),
        offset_y.to_string(),
        "--janela-alvo".into(),
        janela_alvo.unwrap_or_default(),
        "--salvar-em".into(),
        salvar_em.unwrap_or_default(),
        "--ao-nao-encontrar".into(),
        ao_nao_encontrar,
    ]);
    if let Some(value) = sequencia_nao_encontrar {
        if !value.trim().is_empty() {
            args.push("--sequencia-nao-encontrar".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_nao_encontrar {
        if value > 0 {
            args.push("--bloco-nao-encontrar".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = atraso_sequencia_nao_encontrar {
        args.push("--atraso-sequencia-nao-encontrar".into());
        args.push(value.max(0.0).to_string());
    }
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--varredura-scroll".into(),
        varredura_scroll.to_string(),
        "--varredura-scroll-tentativas".into(),
        varredura_scroll_tentativas.clamp(0, 8).to_string(),
        "--varredura-scroll-pixels".into(),
        varredura_scroll_pixels.max(120).to_string(),
        "--varredura-scroll-direcao".into(),
        varredura_scroll_direcao.unwrap_or_else(|| "baixo".to_string()),
    ]);
}

#[tauri::command]
fn add_ocr_text_block(
    app: AppHandle,
    texto: String,
    acao: String,
    timeout: f64,
    confianca: f64,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    salvar_em: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    varredura_scroll: bool,
    varredura_scroll_tentativas: i32,
    varredura_scroll_pixels: i32,
    varredura_scroll_direcao: Option<String>,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-ocr-text".into()];
    append_ocr_text_args(
        &mut args,
        texto,
        acao,
        timeout,
        confianca,
        clicar,
        clicks,
        offset_x,
        offset_y,
        janela_alvo,
        salvar_em,
        ao_nao_encontrar,
        sequencia_nao_encontrar,
        bloco_nao_encontrar,
        atraso_sequencia_nao_encontrar,
        quantidade_tentativas,
        intervalo_tentativas,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend(["--delay".into(), delay.to_string()]);
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_spreadsheet_block(
    app: AppHandle,
    workbook: Option<String>,
    sheet: String,
    column: String,
    delay: f64,
    after_action: String,
    interval_between: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-planilha".into()];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--delay".into(),
        delay.to_string(),
        "--after-action".into(),
        after_action,
        "--interval-between".into(),
        interval_between.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_write_spreadsheet_block(
    app: AppHandle,
    workbook: Option<String>,
    sheet: String,
    column: String,
    value: String,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-write-planilha".into()];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--value".into(),
        value,
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_compare_spreadsheet_block(
    app: AppHandle,
    workbook: Option<String>,
    sheet: String,
    expected_column: String,
    source: Option<String>,
    comparison_mode: Option<String>,
    status_column: Option<String>,
    note_column: Option<String>,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_divergir: Option<String>,
    bloco_divergir: Option<i32>,
    sequencia_divergir: Option<String>,
    atraso_sequencia_divergir: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-compare-planilha".into()];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--expected-column".into(),
        expected_column,
        "--source".into(),
        source.unwrap_or_else(|| "ultimo_ocr".into()),
        "--comparison-mode".into(),
        comparison_mode.unwrap_or_else(|| "texto".into()),
        "--status-column".into(),
        status_column.unwrap_or_default(),
        "--note-column".into(),
        note_column.unwrap_or_default(),
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    append_compare_diverge_args(
        &mut args,
        ao_divergir,
        bloco_divergir,
        sequencia_divergir,
        atraso_sequencia_divergir,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_verify_button_state_block(
    app: AppHandle,
    nome: String,
    imagem_ativo: String,
    imagem_desativado: String,
    timeout: f64,
    confianca: f64,
    acao_ativo: String,
    sequencia_ativo: Option<String>,
    acao_desativado: String,
    sequencia_desativado: Option<String>,
    acao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    delay: f64,
    sequencia: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-verify-button-state".into(),
        "--nome".into(),
        nome,
        "--imagem-ativo".into(),
        imagem_ativo,
        "--imagem-desativado".into(),
        imagem_desativado,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.to_string(),
        "--acao-ativo".into(),
        acao_ativo,
        "--acao-desativado".into(),
        acao_desativado,
        "--acao-nao-encontrar".into(),
        acao_nao_encontrar,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = sequencia_ativo {
        args.push("--sequencia-ativo".into());
        args.push(value);
    }
    if let Some(value) = sequencia_desativado {
        args.push("--sequencia-desativado".into());
        args.push(value);
    }
    if let Some(value) = sequencia_nao_encontrar {
        args.push("--sequencia-nao-encontrar".into());
        args.push(value);
    }
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_chrome_html_block(
    app: AppHandle,
    nome: String,
    html_original: String,
    elemento: Value,
    alvo: Value,
    acao: Value,
    timeout: i32,
    fallback_visual: bool,
    fallback_imagem: Option<String>,
    ao_sucesso: String,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: String,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    sequencia: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-chrome-html".into(),
        "--nome".into(),
        nome,
        "--html-original".into(),
        html_original,
        "--elemento-json".into(),
        serde_json::to_string(&elemento)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--alvo-json".into(),
        serde_json::to_string(&alvo).map_err(|err| format!("Falha ao serializar alvo: {err}"))?,
        "--acao-json".into(),
        serde_json::to_string(&acao).map_err(|err| format!("Falha ao serializar acao: {err}"))?,
        "--timeout".into(),
        timeout.max(500).to_string(),
        "--fallback-visual".into(),
        fallback_visual.to_string(),
        "--fallback-imagem".into(),
        fallback_imagem.unwrap_or_default(),
        "--ao-sucesso".into(),
        ao_sucesso,
        "--ao-falhar".into(),
        ao_falhar,
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_uia_element_block(
    app: AppHandle,
    element: Value,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: Option<String>,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-uia-element".into(),
        "--elemento-json".into(),
        serde_json::to_string(&element)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--ao-sucesso".into(),
        ao_sucesso.unwrap_or_else(|| "continuar".into()),
        "--ao-falhar".into(),
        ao_falhar.unwrap_or_else(|| "parar".into()),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_open_url_block(
    app: AppHandle,
    url: String,
    navegador: String,
    modo_abertura: String,
    tela_cheia: bool,
    aguardar_segundos: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-open-url".into(),
        "--url".into(),
        url,
        "--navegador".into(),
        navegador,
        "--modo-abertura".into(),
        modo_abertura,
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if tela_cheia {
        args.push("--tela-cheia".into());
    }
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_open_program_block(
    app: AppHandle,
    caminho: String,
    parametros: Option<String>,
    aguardar_segundos: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-open-program".into(),
        "--caminho".into(),
        caminho,
        "--parametros".into(),
        parametros.unwrap_or_default(),
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_save_download_block(
    app: AppHandle,
    pasta_origem: Option<String>,
    extensao: String,
    pasta_destino: String,
    nome_arquivo: String,
    timeout: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "add-save-download".into(),
        "--pasta-origem".into(),
        pasta_origem.unwrap_or_default(),
        "--extensao".into(),
        extensao,
        "--pasta-destino".into(),
        pasta_destino,
        "--nome-arquivo".into(),
        nome_arquivo,
        "--timeout".into(),
        timeout.max(1.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_text_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    text: String,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    editavel_execucao: Option<bool>,
    rotulo_execucao: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-text".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--text".into(),
        text,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    if let Some(value) = editavel_execucao {
        args.push("--editavel-execucao".into());
        args.push(if value { "true" } else { "false" }.into());
    }
    if let Some(value) = rotulo_execucao
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        args.push("--rotulo-execucao".into());
        args.push(value.to_string());
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_key_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    keys: String,
    repeat: i32,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-key".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--keys".into(),
        keys,
        "--repeat".into(),
        repeat.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_loop_start_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    delay: f64,
    sequencia: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-loop-start".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_loop_end_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-loop-end".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_mouse_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    x: i32,
    y: i32,
    button: String,
    clicks: i32,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-mouse".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--x".into(),
        x.to_string(),
        "--y".into(),
        y.to_string(),
        "--button".into(),
        button,
        "--clicks".into(),
        clicks.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_image_click_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    imagem: String,
    timeout: f64,
    confianca: f64,
    perfil_busca: Option<String>,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    texto_ocr_esperado: Option<String>,
    modo_reconhecimento: Option<String>,
    texto_ocr_busca: Option<String>,
    acao_ocr: Option<String>,
    salvar_ocr_em: Option<String>,
    varredura_scroll: Option<bool>,
    varredura_scroll_tentativas: Option<i32>,
    varredura_scroll_pixels: Option<i32>,
    varredura_scroll_direcao: Option<String>,
    leitura_relativa_ativa: Option<bool>,
    leitura_relativa_lado: Option<String>,
    leitura_relativa_largura: Option<i32>,
    leitura_relativa_altura: Option<i32>,
    leitura_relativa_offset_x: Option<i32>,
    leitura_relativa_offset_y: Option<i32>,
    leitura_relativa_salvar_em: Option<String>,
    ocr_target_layouts: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-image-click".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--imagem".into(),
        imagem,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.to_string(),
        "--perfil-busca".into(),
        perfil_busca.unwrap_or_else(|| "balanced".to_string()),
        "--clicar".into(),
        clicar.to_string(),
        "--clicks".into(),
        clicks.max(0).to_string(),
        "--offset-x".into(),
        offset_x.to_string(),
        "--offset-y".into(),
        offset_y.to_string(),
        "--janela-alvo".into(),
        janela_alvo.unwrap_or_default(),
        "--texto-ocr-esperado".into(),
        texto_ocr_esperado.unwrap_or_default(),
    ];
    append_embedded_recognition_ocr_args(
        &mut args,
        modo_reconhecimento,
        texto_ocr_busca,
        acao_ocr,
        salvar_ocr_em,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend([
        "--leitura-relativa-ativa".into(),
        leitura_relativa_ativa.unwrap_or(false).to_string(),
        "--leitura-relativa-lado".into(),
        leitura_relativa_lado.unwrap_or_else(|| "direita".to_string()),
        "--leitura-relativa-largura".into(),
        leitura_relativa_largura.unwrap_or(140).max(16).to_string(),
        "--leitura-relativa-altura".into(),
        leitura_relativa_altura.unwrap_or(40).max(12).to_string(),
        "--leitura-relativa-offset-x".into(),
        leitura_relativa_offset_x.unwrap_or(0).to_string(),
        "--leitura-relativa-offset-y".into(),
        leitura_relativa_offset_y.unwrap_or(0).to_string(),
        "--leitura-relativa-salvar-em".into(),
        leitura_relativa_salvar_em.unwrap_or_default(),
        "--ocr-target-layouts".into(),
        ocr_target_layouts.unwrap_or_else(|| "[]".to_string()),
        "--ao-nao-encontrar".into(),
        ao_nao_encontrar,
    ]);
    if let Some(value) = sequencia_nao_encontrar {
        if !value.trim().is_empty() {
            args.push("--sequencia-nao-encontrar".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_nao_encontrar {
        if value > 0 {
            args.push("--bloco-nao-encontrar".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = atraso_sequencia_nao_encontrar {
        args.push("--atraso-sequencia-nao-encontrar".into());
        args.push(value.max(0.0).to_string());
    }
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_ocr_text_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    texto: String,
    acao: String,
    timeout: f64,
    confianca: f64,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    salvar_em: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    varredura_scroll: bool,
    varredura_scroll_tentativas: i32,
    varredura_scroll_pixels: i32,
    varredura_scroll_direcao: Option<String>,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-ocr-text".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
    ];
    append_ocr_text_args(
        &mut args,
        texto,
        acao,
        timeout,
        confianca,
        clicar,
        clicks,
        offset_x,
        offset_y,
        janela_alvo,
        salvar_em,
        ao_nao_encontrar,
        sequencia_nao_encontrar,
        bloco_nao_encontrar,
        atraso_sequencia_nao_encontrar,
        quantidade_tentativas,
        intervalo_tentativas,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend(["--delay".into(), delay.to_string()]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_spreadsheet_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    workbook: Option<String>,
    sheet: String,
    column: String,
    delay: f64,
    after_action: String,
    interval_between: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-planilha".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--delay".into(),
        delay.to_string(),
        "--after-action".into(),
        after_action,
        "--interval-between".into(),
        interval_between.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_write_spreadsheet_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    workbook: Option<String>,
    sheet: String,
    column: String,
    value: String,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-write-planilha".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--value".into(),
        value,
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_compare_spreadsheet_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    workbook: Option<String>,
    sheet: String,
    expected_column: String,
    source: Option<String>,
    comparison_mode: Option<String>,
    status_column: Option<String>,
    note_column: Option<String>,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_divergir: Option<String>,
    bloco_divergir: Option<i32>,
    sequencia_divergir: Option<String>,
    atraso_sequencia_divergir: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-compare-planilha".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--expected-column".into(),
        expected_column,
        "--source".into(),
        source.unwrap_or_else(|| "ultimo_ocr".into()),
        "--comparison-mode".into(),
        comparison_mode.unwrap_or_else(|| "texto".into()),
        "--status-column".into(),
        status_column.unwrap_or_default(),
        "--note-column".into(),
        note_column.unwrap_or_default(),
        "--delay".into(),
        delay.to_string(),
    ]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    append_compare_diverge_args(
        &mut args,
        ao_divergir,
        bloco_divergir,
        sequencia_divergir,
        atraso_sequencia_divergir,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_chrome_html_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    nome: String,
    html_original: String,
    elemento: Value,
    alvo: Value,
    acao: Value,
    timeout: i32,
    fallback_visual: bool,
    fallback_imagem: Option<String>,
    ao_sucesso: String,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: String,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    sequencia: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-chrome-html".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--nome".into(),
        nome,
        "--html-original".into(),
        html_original,
        "--elemento-json".into(),
        serde_json::to_string(&elemento)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--alvo-json".into(),
        serde_json::to_string(&alvo).map_err(|err| format!("Falha ao serializar alvo: {err}"))?,
        "--acao-json".into(),
        serde_json::to_string(&acao).map_err(|err| format!("Falha ao serializar acao: {err}"))?,
        "--timeout".into(),
        timeout.max(500).to_string(),
        "--fallback-visual".into(),
        fallback_visual.to_string(),
        "--fallback-imagem".into(),
        fallback_imagem.unwrap_or_default(),
        "--ao-sucesso".into(),
        ao_sucesso,
        "--ao-falhar".into(),
        ao_falhar,
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_uia_element_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    element: Value,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: Option<String>,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-uia-element".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--elemento-json".into(),
        serde_json::to_string(&element)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--ao-sucesso".into(),
        ao_sucesso.unwrap_or_else(|| "continuar".into()),
        "--ao-falhar".into(),
        ao_falhar.unwrap_or_else(|| "parar".into()),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_open_url_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    url: String,
    navegador: String,
    modo_abertura: String,
    tela_cheia: bool,
    aguardar_segundos: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-open-url".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--url".into(),
        url,
        "--navegador".into(),
        navegador,
        "--modo-abertura".into(),
        modo_abertura,
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if tela_cheia {
        args.push("--tela-cheia".into());
    }
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_open_program_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    caminho: String,
    parametros: Option<String>,
    aguardar_segundos: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-open-program".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--caminho".into(),
        caminho,
        "--parametros".into(),
        parametros.unwrap_or_default(),
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_save_download_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    pasta_origem: Option<String>,
    extensao: String,
    pasta_destino: String,
    nome_arquivo: String,
    timeout: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "insert-save-download".into(),
        "--target-order".into(),
        target_order.to_string(),
        "--position".into(),
        position,
        "--pasta-origem".into(),
        pasta_origem.unwrap_or_default(),
        "--extensao".into(),
        extensao,
        "--pasta-destino".into(),
        pasta_destino,
        "--nome-arquivo".into(),
        nome_arquivo,
        "--timeout".into(),
        timeout.max(1.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_text_block(
    app: AppHandle,
    order: i32,
    text: String,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    editavel_execucao: Option<bool>,
    rotulo_execucao: Option<String>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-text".into(),
        "--order".into(),
        order.to_string(),
        "--text".into(),
        text,
        "--delay".into(),
        delay.to_string(),
    ];
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    if let Some(value) = editavel_execucao {
        args.push("--editavel-execucao".into());
        args.push(if value { "true" } else { "false" }.into());
    }
    if let Some(value) = rotulo_execucao
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        args.push("--rotulo-execucao".into());
        args.push(value.to_string());
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_key_block(
    app: AppHandle,
    order: i32,
    keys: String,
    repeat: i32,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-key".into(),
        "--order".into(),
        order.to_string(),
        "--keys".into(),
        keys,
        "--repeat".into(),
        repeat.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_mouse_block(
    app: AppHandle,
    order: i32,
    x: i32,
    y: i32,
    button: String,
    clicks: i32,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-mouse".into(),
        "--order".into(),
        order.to_string(),
        "--x".into(),
        x.to_string(),
        "--y".into(),
        y.to_string(),
        "--button".into(),
        button,
        "--clicks".into(),
        clicks.max(1).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_image_click_block(
    app: AppHandle,
    order: i32,
    imagem: String,
    timeout: f64,
    confianca: f64,
    perfil_busca: Option<String>,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    texto_ocr_esperado: Option<String>,
    modo_reconhecimento: Option<String>,
    texto_ocr_busca: Option<String>,
    acao_ocr: Option<String>,
    salvar_ocr_em: Option<String>,
    varredura_scroll: Option<bool>,
    varredura_scroll_tentativas: Option<i32>,
    varredura_scroll_pixels: Option<i32>,
    varredura_scroll_direcao: Option<String>,
    leitura_relativa_ativa: Option<bool>,
    leitura_relativa_lado: Option<String>,
    leitura_relativa_largura: Option<i32>,
    leitura_relativa_altura: Option<i32>,
    leitura_relativa_offset_x: Option<i32>,
    leitura_relativa_offset_y: Option<i32>,
    leitura_relativa_salvar_em: Option<String>,
    ocr_target_layouts: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-image-click".into(),
        "--order".into(),
        order.to_string(),
        "--imagem".into(),
        imagem,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.to_string(),
        "--perfil-busca".into(),
        perfil_busca.unwrap_or_else(|| "balanced".to_string()),
        "--clicar".into(),
        clicar.to_string(),
        "--clicks".into(),
        clicks.max(0).to_string(),
        "--offset-x".into(),
        offset_x.to_string(),
        "--offset-y".into(),
        offset_y.to_string(),
        "--janela-alvo".into(),
        janela_alvo.unwrap_or_default(),
        "--texto-ocr-esperado".into(),
        texto_ocr_esperado.unwrap_or_default(),
    ];
    append_embedded_recognition_ocr_args(
        &mut args,
        modo_reconhecimento,
        texto_ocr_busca,
        acao_ocr,
        salvar_ocr_em,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend([
        "--leitura-relativa-ativa".into(),
        leitura_relativa_ativa.unwrap_or(false).to_string(),
        "--leitura-relativa-lado".into(),
        leitura_relativa_lado.unwrap_or_else(|| "direita".to_string()),
        "--leitura-relativa-largura".into(),
        leitura_relativa_largura.unwrap_or(140).max(16).to_string(),
        "--leitura-relativa-altura".into(),
        leitura_relativa_altura.unwrap_or(40).max(12).to_string(),
        "--leitura-relativa-offset-x".into(),
        leitura_relativa_offset_x.unwrap_or(0).to_string(),
        "--leitura-relativa-offset-y".into(),
        leitura_relativa_offset_y.unwrap_or(0).to_string(),
        "--leitura-relativa-salvar-em".into(),
        leitura_relativa_salvar_em.unwrap_or_default(),
        "--ocr-target-layouts".into(),
        ocr_target_layouts.unwrap_or_else(|| "[]".to_string()),
        "--ao-nao-encontrar".into(),
        ao_nao_encontrar,
    ]);
    if let Some(value) = sequencia_nao_encontrar {
        if !value.trim().is_empty() {
            args.push("--sequencia-nao-encontrar".into());
            args.push(value);
        }
    }
    if let Some(value) = bloco_nao_encontrar {
        if value > 0 {
            args.push("--bloco-nao-encontrar".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = atraso_sequencia_nao_encontrar {
        args.push("--atraso-sequencia-nao-encontrar".into());
        args.push(value.max(0.0).to_string());
    }
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_ocr_text_block(
    app: AppHandle,
    order: i32,
    texto: String,
    acao: String,
    timeout: f64,
    confianca: f64,
    clicar: bool,
    clicks: i32,
    offset_x: i32,
    offset_y: i32,
    janela_alvo: Option<String>,
    salvar_em: Option<String>,
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    atraso_sequencia_nao_encontrar: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    varredura_scroll: bool,
    varredura_scroll_tentativas: i32,
    varredura_scroll_pixels: i32,
    varredura_scroll_direcao: Option<String>,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-ocr-text".into(),
        "--order".into(),
        order.to_string(),
    ];
    append_ocr_text_args(
        &mut args,
        texto,
        acao,
        timeout,
        confianca,
        clicar,
        clicks,
        offset_x,
        offset_y,
        janela_alvo,
        salvar_em,
        ao_nao_encontrar,
        sequencia_nao_encontrar,
        bloco_nao_encontrar,
        atraso_sequencia_nao_encontrar,
        quantidade_tentativas,
        intervalo_tentativas,
        varredura_scroll,
        varredura_scroll_tentativas,
        varredura_scroll_pixels,
        varredura_scroll_direcao,
    );
    args.extend(["--delay".into(), delay.to_string()]);
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_spreadsheet_block(
    app: AppHandle,
    order: i32,
    workbook: Option<String>,
    sheet: String,
    column: String,
    after_action: String,
    interval_between: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-planilha".into(),
        "--order".into(),
        order.to_string(),
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--after-action".into(),
        after_action,
        "--interval-between".into(),
        interval_between.to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_write_spreadsheet_block(
    app: AppHandle,
    order: i32,
    workbook: Option<String>,
    sheet: String,
    column: String,
    value: String,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-write-planilha".into(),
        "--order".into(),
        order.to_string(),
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--column".into(),
        column,
        "--value".into(),
        value,
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_compare_spreadsheet_block(
    app: AppHandle,
    order: i32,
    workbook: Option<String>,
    sheet: String,
    expected_column: String,
    source: Option<String>,
    comparison_mode: Option<String>,
    status_column: Option<String>,
    note_column: Option<String>,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_divergir: Option<String>,
    bloco_divergir: Option<i32>,
    sequencia_divergir: Option<String>,
    atraso_sequencia_divergir: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-compare-planilha".into(),
        "--order".into(),
        order.to_string(),
    ];
    if let Some(workbook_file) = workbook {
        if !workbook_file.trim().is_empty() {
            args.push("--workbook".into());
            args.push(workbook_file);
        }
    }
    args.extend([
        "--sheet".into(),
        sheet,
        "--expected-column".into(),
        expected_column,
        "--source".into(),
        source.unwrap_or_else(|| "ultimo_ocr".into()),
        "--comparison-mode".into(),
        comparison_mode.unwrap_or_else(|| "texto".into()),
        "--status-column".into(),
        status_column.unwrap_or_default(),
        "--note-column".into(),
        note_column.unwrap_or_default(),
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    append_compare_diverge_args(
        &mut args,
        ao_divergir,
        bloco_divergir,
        sequencia_divergir,
        atraso_sequencia_divergir,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_verify_button_state_block(
    app: AppHandle,
    order: i32,
    nome: String,
    imagem_ativo: String,
    imagem_desativado: String,
    timeout: f64,
    confianca: f64,
    acao_ativo: String,
    sequencia_ativo: Option<String>,
    acao_desativado: String,
    sequencia_desativado: Option<String>,
    acao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    delay: f64,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-verify-button-state".into(),
        "--order".into(),
        order.to_string(),
        "--nome".into(),
        nome,
        "--imagem-ativo".into(),
        imagem_ativo,
        "--imagem-desativado".into(),
        imagem_desativado,
        "--timeout".into(),
        timeout.max(0.1).to_string(),
        "--confianca".into(),
        confianca.to_string(),
        "--acao-ativo".into(),
        acao_ativo,
        "--acao-desativado".into(),
        acao_desativado,
        "--acao-nao-encontrar".into(),
        acao_nao_encontrar,
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = sequencia_ativo {
        args.push("--sequencia-ativo".into());
        args.push(value);
    }
    if let Some(value) = sequencia_desativado {
        args.push("--sequencia-desativado".into());
        args.push(value);
    }
    if let Some(value) = sequencia_nao_encontrar {
        args.push("--sequencia-nao-encontrar".into());
        args.push(value);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_chrome_html_block(
    app: AppHandle,
    order: i32,
    nome: String,
    html_original: String,
    elemento: Value,
    alvo: Value,
    acao: Value,
    timeout: i32,
    fallback_visual: bool,
    fallback_imagem: Option<String>,
    ao_sucesso: String,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: String,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-chrome-html".into(),
        "--order".into(),
        order.to_string(),
        "--nome".into(),
        nome,
        "--html-original".into(),
        html_original,
        "--elemento-json".into(),
        serde_json::to_string(&elemento)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--alvo-json".into(),
        serde_json::to_string(&alvo).map_err(|err| format!("Falha ao serializar alvo: {err}"))?,
        "--acao-json".into(),
        serde_json::to_string(&acao).map_err(|err| format!("Falha ao serializar acao: {err}"))?,
        "--timeout".into(),
        timeout.max(500).to_string(),
        "--fallback-visual".into(),
        fallback_visual.to_string(),
        "--fallback-imagem".into(),
        fallback_imagem.unwrap_or_default(),
        "--ao-sucesso".into(),
        ao_sucesso,
        "--ao-falhar".into(),
        ao_falhar,
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_uia_element_block(
    app: AppHandle,
    order: i32,
    element: Value,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
    ao_falhar: Option<String>,
    bloco_falha: Option<i32>,
    sequencia_falha: Option<String>,
    atraso_sequencia_falha: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-uia-element".into(),
        "--order".into(),
        order.to_string(),
        "--elemento-json".into(),
        serde_json::to_string(&element)
            .map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
        "--ao-sucesso".into(),
        ao_sucesso.unwrap_or_else(|| "continuar".into()),
        "--ao-falhar".into(),
        ao_falhar.unwrap_or_else(|| "parar".into()),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(value) = bloco_sucesso {
        if value > 0 {
            args.push("--bloco-sucesso".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_sucesso {
        if !value.trim().is_empty() {
            args.push("--sequencia-sucesso".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_sucesso {
        args.push("--atraso-sequencia-sucesso".into());
        args.push(value.max(0.0).to_string());
    }
    if let Some(value) = bloco_falha {
        if value > 0 {
            args.push("--bloco-falha".into());
            args.push(value.to_string());
        }
    }
    if let Some(value) = sequencia_falha {
        if !value.trim().is_empty() {
            args.push("--sequencia-falha".into());
            args.push(value);
        }
    }
    if let Some(value) = atraso_sequencia_falha {
        args.push("--atraso-sequencia-falha".into());
        args.push(value.max(0.0).to_string());
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_open_url_block(
    app: AppHandle,
    order: i32,
    url: String,
    navegador: String,
    modo_abertura: String,
    tela_cheia: bool,
    aguardar_segundos: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-open-url".into(),
        "--order".into(),
        order.to_string(),
        "--url".into(),
        url,
        "--navegador".into(),
        navegador,
        "--modo-abertura".into(),
        modo_abertura,
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if tela_cheia {
        args.push("--tela-cheia".into());
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_loop_marker_block(
    app: AppHandle,
    order: i32,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-loop-marker".into(),
        "--order".into(),
        order.to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    if let Some(sequence_name) = sequencia {
        if !sequence_name.trim().is_empty() {
            args.push("--sequencia".into());
            args.push(sequence_name);
        }
    }
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_open_program_block(
    app: AppHandle,
    order: i32,
    caminho: String,
    parametros: Option<String>,
    aguardar_segundos: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-open-program".into(),
        "--order".into(),
        order.to_string(),
        "--caminho".into(),
        caminho,
        "--parametros".into(),
        parametros.unwrap_or_default(),
        "--aguardar-segundos".into(),
        aguardar_segundos.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_save_download_block(
    app: AppHandle,
    order: i32,
    pasta_origem: Option<String>,
    extensao: String,
    pasta_destino: String,
    nome_arquivo: String,
    timeout: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
    sequencia_sucesso: Option<String>,
    atraso_sequencia_sucesso: Option<f64>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "update-save-download".into(),
        "--order".into(),
        order.to_string(),
        "--pasta-origem".into(),
        pasta_origem.unwrap_or_default(),
        "--extensao".into(),
        extensao,
        "--pasta-destino".into(),
        pasta_destino,
        "--nome-arquivo".into(),
        nome_arquivo,
        "--timeout".into(),
        timeout.max(1.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ];
    append_success_flow_args(
        &mut args,
        ao_sucesso,
        bloco_sucesso,
        sequencia_sucesso,
        atraso_sequencia_sucesso,
    );
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_block_delay(app: AppHandle, order: i32, delay: f64) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "update-delay".into(),
            "--order".into(),
            order.to_string(),
            "--delay".into(),
            delay.to_string(),
        ],
    )
}

#[tauri::command]
fn update_all_blocks_delay(app: AppHandle, delay: f64) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "update-delay-all".into(),
            "--delay".into(),
            delay.to_string(),
        ],
    )
}

#[tauri::command]
fn move_block(app: AppHandle, order: i32, direction: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "move".into(),
            "--order".into(),
            order.to_string(),
            "--direction".into(),
            direction,
        ],
    )
}

#[tauri::command]
fn reorder_block(app: AppHandle, order: i32, target_index: i32) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "reorder".into(),
            "--order".into(),
            order.to_string(),
            "--target-index".into(),
            target_index.to_string(),
        ],
    )
}

#[tauri::command]
fn remove_block(app: AppHandle, order: i32) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &["remove".into(), "--order".into(), order.to_string()],
    )
}

#[tauri::command]
fn clear_blocks(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(&root, &[String::from("clear")])
}

#[tauri::command]
fn launch_legacy_capture(app: AppHandle) -> Result<String, String> {
    let root = workspace_root(&app);
    let script_path = root.join("capturar_cliques.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }

    let (python_program, python_args) = python_command(&root)?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path);
    configure_no_window(&mut command);
    command
        .spawn()
        .map_err(|err| format!("Falha ao abrir a captura avancada: {err}"))?;

    Ok("Captura avancada aberta em uma nova janela.".into())
}

fn recognition_source_versions(root: &PathBuf) -> Vec<Option<std::time::SystemTime>> {
    ["executar_automacao.py", "reconhecimento_worker.py"].iter()
        .map(|name| std::fs::metadata(root.join(name)).and_then(|m| m.modified()).ok())
        .collect()
}

fn recognition_worker_matches(
    worker: &RecognitionWorker,
    root: &PathBuf,
    python_program: &str,
    python_args: &[String],
) -> bool {
    worker.source_versions == recognition_source_versions(root)
        && worker.root == *root
        && worker.python_program == python_program
        && worker.python_args == python_args
        && worker.child.id() > 0
}

fn start_recognition_worker(root: &PathBuf) -> Result<RecognitionWorker, String> {
    let script_path = root.join("reconhecimento_worker.py");
    if !script_path.exists() {
        return Err(format!(
            "Worker de reconhecimento nao encontrado: {}",
            script_path.display()
        ));
    }

    // O botao Procurar tambem mostra as bordas dos OCRs; portanto o worker
    // precisa de um Python com Tk, como a execucao assistida.
    let (python_program_path, python_args) = python_command_for_visual_feedback(root)?;
    let python_program = python_program_path.clone();
    let mut command = Command::new(&python_program_path);
    command
        .current_dir(root)
        .args(&python_args)
        .arg(&script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    configure_no_window(&mut command);

    let mut child = command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar worker de reconhecimento: {err}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Worker de reconhecimento iniciou sem stdin.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Worker de reconhecimento iniciou sem stdout.".to_string())?;

    Ok(RecognitionWorker {
        source_versions: recognition_source_versions(root),
        root: root.to_path_buf(),
        python_program,
        python_args,
        child,
        stdin,
        stdout: BufReader::new(stdout),
    })
}

fn test_image_recognition_worker(
    root: &PathBuf,
    payload: Value,
) -> Result<(bool, String, String), String> {
    let (python_program_path, python_args) = python_command_for_visual_feedback(root)?;
    let python_program = python_program_path.clone();
    let mut guard = RECOGNITION_WORKER
        .lock()
        .map_err(|_| "Worker de reconhecimento bloqueado.".to_string())?;

    let precisa_reiniciar = match guard.as_mut() {
        Some(worker) => {
            let saiu = matches!(worker.child.try_wait(), Ok(Some(_)) | Err(_));
            saiu || !recognition_worker_matches(worker, root, &python_program, &python_args)
        }
        None => true,
    };
    if precisa_reiniciar {
        if let Some(mut previous) = guard.take() {
            let _ = previous.child.kill();
            let _ = previous.child.wait();
        }
        *guard = Some(start_recognition_worker(root)?);
    }

    let worker = guard
        .as_mut()
        .ok_or_else(|| "Worker de reconhecimento indisponivel.".to_string())?;
    let request = serde_json::to_string(&payload)
        .map_err(|err| format!("Falha ao serializar teste de reconhecimento: {err}"))?;
    worker
        .stdin
        .write_all(request.as_bytes())
        .and_then(|_| worker.stdin.write_all(b"\n"))
        .and_then(|_| worker.stdin.flush())
        .map_err(|err| format!("Falha ao enviar teste para o worker: {err}"))?;

    let mut linha = String::new();
    worker
        .stdout
        .read_line(&mut linha)
        .map_err(|err| format!("Falha ao ler resposta do worker: {err}"))?;
    if linha.trim().is_empty() {
        *guard = None;
        return Err("Worker de reconhecimento nao respondeu.".into());
    }

    let resposta: Value = serde_json::from_str(linha.trim())
        .map_err(|err| format!("Resposta invalida do worker de reconhecimento: {err}"))?;
    if resposta
        .get("restart")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(mut worker_antigo) = guard.take() {
            let _ = worker_antigo.child.kill();
        }
        return Err(resposta
            .get("stderr")
            .and_then(Value::as_str)
            .unwrap_or("Worker de reconhecimento reiniciado.")
            .to_string());
    }
    Ok((
        resposta
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        resposta
            .get("stdout")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        resposta
            .get("stderr")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    ))
}

#[tauri::command]
fn test_image_recognition(
    app: AppHandle,
    imagem: String,
    timeout: f64,
    confianca: f64,
    perfil_busca: Option<String>,
    janela_alvo: Option<String>,
    modo_reconhecimento: Option<String>,
    texto_ocr_busca: Option<String>,
    texto_ocr_esperado: Option<String>,
    leitura_relativa_ativa: Option<bool>,
    leitura_relativa_lado: Option<String>,
    leitura_relativa_largura: Option<i64>,
    leitura_relativa_altura: Option<i64>,
    leitura_relativa_offset_x: Option<i64>,
    leitura_relativa_offset_y: Option<i64>,
    leitura_relativa_salvar_em: Option<String>,
    ocr_target_layouts: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }

    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(
        &root,
        format!(
            "Teste isolado de reconhecimento iniciado | imagem={} | timeout={} | confianca={} | ocr={}",
            imagem,
            timeout.max(0.1),
            confianca,
            texto_ocr_esperado.as_deref().unwrap_or("").trim()
        ),
    );
    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));

    let perfil_busca_resolvido = perfil_busca
        .clone()
        .unwrap_or_else(|| "balanced".to_string());
    let leitura_relativa_payload = serde_json::json!({
        "ativa": leitura_relativa_ativa.unwrap_or(false),
        "lado": leitura_relativa_lado.clone().unwrap_or_else(|| "livre".to_string()),
        "largura": leitura_relativa_largura.unwrap_or(140),
        "altura": leitura_relativa_altura.unwrap_or(40),
        "offset_x": leitura_relativa_offset_x.unwrap_or(0),
        "offset_y": leitura_relativa_offset_y.unwrap_or(0),
        "salvar_em": leitura_relativa_salvar_em.clone().unwrap_or_default(),
        "ocr_target_layouts": serde_json::from_str::<Value>(ocr_target_layouts.as_deref().unwrap_or("[]")).unwrap_or_else(|_| serde_json::json!([])),
    });
    let worker_payload = serde_json::json!({
        "imagem": imagem.clone(),
        "timeout": timeout.max(0.1),
        "confianca": confianca,
        "perfil_busca": perfil_busca_resolvido,
        "janela_alvo": janela_alvo.clone().unwrap_or_default(),
        "modo_reconhecimento": modo_reconhecimento.clone().unwrap_or_else(|| "imagem".to_string()),
        "texto_ocr_busca": texto_ocr_busca.clone().unwrap_or_default(),
        "texto_ocr_esperado": texto_ocr_esperado.clone().unwrap_or_default(),
        "leitura_relativa": leitura_relativa_payload,
        "modo_area_busca": "target_window",
        "area_personalizada": {},
        "bloco_id": "",
    });

    let main_window = app.get_webview_window("main");
    if let Some(window) = main_window.as_ref() {
        let _ = window.minimize();
    }
    thread::sleep(Duration::from_millis(380));

    match test_image_recognition_worker(&root, worker_payload) {
        Ok((success, stdout, stderr)) => {
            if let Some(window) = main_window.as_ref() {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            if !stdout.trim().is_empty() {
                append_launcher_log(
                    &root,
                    format!("RECONHECIMENTO WORKER STDOUT: {}", stdout.trim()),
                );
            }
            if !stderr.trim().is_empty() {
                append_launcher_log(
                    &root,
                    format!("RECONHECIMENTO WORKER STDERR: {}", stderr.trim()),
                );
            }
            append_launcher_log(
                &root,
                format!(
                    "Teste isolado de reconhecimento finalizado via worker | sucesso={}",
                    success
                ),
            );
            if success {
                return Ok(if stdout.trim().is_empty() {
                    "Reconhecimento concluido com sucesso.".into()
                } else {
                    stdout
                });
            }
            // Keep the per-OCR validation report even when Python also emits
            // an error on stderr. The Studio reads that report from stdout.
            let message = [stdout.trim(), stderr.trim()]
                .into_iter()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            return Err(if message.trim().is_empty() {
                "Falha ao testar o reconhecimento.".into()
            } else {
                message
            });
        }
        Err(err) => {
            append_launcher_log(
                &root,
                format!("Worker de reconhecimento indisponivel. Usando modo antigo: {err}"),
            );
        }
    }

    let (python_program, python_args) = python_command_for_visual_feedback(&root).map_err(|err| {
        if let Some(window) = main_window.as_ref() {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
        err
    })?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg("reconhecimento")
        .arg("--atraso")
        .arg("0")
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"))
        .arg("--imagem-teste")
        .arg(imagem)
        .arg("--timeout-imagem")
        .arg(timeout.max(0.1).to_string())
        .arg("--confianca-imagem")
        .arg(confianca.to_string())
        .arg("--perfil-busca-imagem")
        .arg(perfil_busca.unwrap_or_else(|| "balanced".to_string()));

    if let Some(title) = janela_alvo
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--janela-alvo").arg(title);
    }
    if let Some(text) = texto_ocr_esperado
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--texto-ocr-esperado").arg(text);
    }
    if let Some(mode) = modo_reconhecimento
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--modo-reconhecimento").arg(mode);
    }
    if let Some(text) = texto_ocr_busca
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--texto-ocr-busca").arg(text);
    }
    command
        .arg("--leitura-relativa-ativa")
        .arg(if leitura_relativa_ativa.unwrap_or(false) {
            "true"
        } else {
            "false"
        })
        .arg("--leitura-relativa-lado")
        .arg(leitura_relativa_lado.unwrap_or_else(|| "livre".to_string()))
        .arg("--leitura-relativa-largura")
        .arg(leitura_relativa_largura.unwrap_or(140).to_string())
        .arg("--leitura-relativa-altura")
        .arg(leitura_relativa_altura.unwrap_or(40).to_string())
        .arg("--leitura-relativa-offset-x")
        .arg(leitura_relativa_offset_x.unwrap_or(0).to_string())
        .arg("--leitura-relativa-offset-y")
        .arg(leitura_relativa_offset_y.unwrap_or(0).to_string());
    command.arg("--ocr-target-layouts").arg(ocr_target_layouts.unwrap_or_else(|| "[]".to_string()));
    if let Some(name) = leitura_relativa_salvar_em
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--leitura-relativa-salvar-em").arg(name);
    }
    configure_no_window(&mut command);

    let output = command.output();

    if let Some(window) = main_window.as_ref() {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    let output = output
        .map_err(|err| format!("Falha ao iniciar o teste de reconhecimento: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stdout.is_empty() {
        append_launcher_log(&root, format!("RECONHECIMENTO STDOUT: {stdout}"));
    }
    if !stderr.is_empty() {
        append_launcher_log(&root, format!("RECONHECIMENTO STDERR: {stderr}"));
    }
    append_launcher_log(
        &root,
        format!(
            "Teste isolado de reconhecimento finalizado | sucesso={} | code={}",
            output.status.success(),
            output.status.code().unwrap_or(-1)
        ),
    );
    if output.status.success() {
        return Ok(if stdout.is_empty() {
            "Reconhecimento concluido com sucesso.".into()
        } else {
            stdout
        });
    }

    let message = [stdout.as_str(), stderr.as_str()]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    Err(if message.is_empty() {
        "Falha ao testar o reconhecimento.".into()
    } else {
        message
    })
}

#[tauri::command]
fn test_ocr_recognition(
    app: AppHandle,
    texto: String,
    timeout: f64,
    confianca: f64,
    janela_alvo: Option<String>,
    varredura_scroll: Option<bool>,
    varredura_scroll_tentativas: Option<i32>,
    varredura_scroll_pixels: Option<i32>,
    varredura_scroll_direcao: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }
    let texto_limpo = texto.trim().to_string();
    if texto_limpo.is_empty() {
        return Err("Informe o texto para testar o OCR inteligente.".into());
    }

    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));
    append_launcher_log(
        &root,
        format!(
            "Teste isolado de OCR iniciado | texto={} | timeout={} | confianca={}",
            texto_limpo,
            timeout.max(0.1),
            confianca
        ),
    );

    let (python_program, python_args) = python_command(&root)?;
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg("reconhecimento")
        .arg("--modo-reconhecimento")
        .arg("texto_ocr")
        .arg("--texto-ocr-busca")
        .arg(texto_limpo.clone())
        .arg("--acao-ocr")
        .arg("localizar")
        .arg("--timeout-ocr")
        .arg(timeout.clamp(0.5, 4.0).to_string())
        .arg("--confianca-ocr")
        .arg(confianca.clamp(0.35, 1.0).to_string())
        .arg("--varredura-scroll")
        .arg(varredura_scroll.unwrap_or(false).to_string())
        .arg("--varredura-scroll-tentativas")
        .arg(varredura_scroll_tentativas.unwrap_or(4).clamp(0, 8).to_string())
        .arg("--varredura-scroll-pixels")
        .arg(varredura_scroll_pixels.unwrap_or(520).max(120).to_string())
        .arg("--varredura-scroll-direcao")
        .arg(varredura_scroll_direcao.unwrap_or_else(|| "baixo".to_string()))
        .arg("--atraso")
        .arg("0.35")
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));

    if let Some(title) = janela_alvo
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--janela-alvo").arg(title);
    }
    configure_no_window(&mut command);

    let main_window = app.get_webview_window("main");
    if let Some(window) = main_window.as_ref() {
        let _ = window.minimize();
    }
    thread::sleep(Duration::from_millis(380));

    let output = command
        .output()
        .map_err(|err| format!("Falha ao iniciar o teste de OCR: {err}"))?;

    if let Some(window) = main_window.as_ref() {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stdout.is_empty() {
        append_launcher_log(&root, format!("OCR TESTE STDOUT: {stdout}"));
    }
    if !stderr.is_empty() {
        append_launcher_log(&root, format!("OCR TESTE STDERR: {stderr}"));
    }
    if output.status.success() {
        return Ok(if stdout.is_empty() {
            "OCR inteligente encontrou e confirmou o texto.".into()
        } else {
            stdout
        });
    }
    let message = if !stderr.is_empty() { stderr } else { stdout };
    Err(if message.is_empty() {
        "OCR inteligente nao encontrou o texto.".into()
    } else {
        message
    })
}

#[tauri::command]
fn analyze_html_element(app: AppHandle, html: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &["analyze-html-element".into(), "--html".into(), html],
    )
}

#[tauri::command]
fn chrome_web_capture_element(
    app: AppHandle,
    url: Option<String>,
    timeout: Option<i32>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec![
        "capture-element".into(),
        "--timeout".into(),
        timeout.unwrap_or(60000).max(5000).to_string(),
    ];
    if let Some(value) = url {
        if !value.trim().is_empty() {
            args.push("--url".into());
            args.push(value);
        }
    }
    run_chrome_bridge_json(&root, &args)
}

#[tauri::command]
fn chrome_web_test_element(
    app: AppHandle,
    details: Value,
    timeout: Option<i32>,
) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_chrome_bridge_json(
        &root,
        &[
            "test-element".into(),
            "--details-json".into(),
            serde_json::to_string(&details)
                .map_err(|err| format!("Falha ao serializar ficha Chrome/Web: {err}"))?,
            "--timeout".into(),
            timeout.unwrap_or(10000).max(500).to_string(),
        ],
    )
}

#[tauri::command]
fn chrome_web_open_site(app: AppHandle, url: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_chrome_bridge_json(&root, &["open-site".into(), "--url".into(), url])
}

#[tauri::command]
fn get_test_loop_data(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let raw = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[String::from("listar")],
    )?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Falha ao interpretar os dados do loop: {err}"))
}

/// Hides only FlowDetect's own window before launching an on-screen automation.
///
/// The executor reads the pixels currently visible on the desktop.  Keeping the
/// full-screen launcher over the target application makes a valid target look
/// absent, so the default is to minimize it.  This deliberately does not focus,
/// raise, move, or reorder any target window.
fn minimize_flowdetect_for_execution(
    app: &AppHandle,
    root: &Path,
    minimize_window: Option<bool>,
) -> bool {
    if !minimize_window.unwrap_or(true) {
        append_launcher_log(
            root,
            "Janela do FlowDetect mantida aberta por configuracao da execucao.",
        );
        return false;
    }

    let Some(window) = app.get_webview_window("main") else {
        append_launcher_log(
            root,
            "Janela principal do FlowDetect nao encontrada; a execucao seguira sem minimiza-la.",
        );
        return false;
    };

    if window.is_minimized().unwrap_or(false) {
        append_launcher_log(
            root,
            "Janela do FlowDetect ja estava minimizada para a execucao.",
        );
        return false;
    }

    match window.minimize() {
        Ok(()) => {
            append_launcher_log(
                root,
                "Janela do FlowDetect minimizada para deixar a janela-alvo visivel.",
            );
            // Let Windows remove the launcher from the composited desktop before
            // the Python executor starts taking screenshots.
            thread::sleep(Duration::from_millis(350));
            true
        }
        Err(err) => {
            append_launcher_log(
                root,
                format!(
                    "Nao foi possivel minimizar a janela do FlowDetect; a execucao seguira sem alterar a janela-alvo: {err}"
                ),
            );
            false
        }
    }
}

/// Restores FlowDetect only when launching the executor itself failed.  No focus
/// call is made, so a target application is never activated or reordered here.
fn restore_flowdetect_after_launch_failure(app: &AppHandle, was_minimized_here: bool) {
    if !was_minimized_here {
        return;
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
    }
}

#[tauri::command]
fn launch_quick_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    window_title: Option<String>,
    target_context: Option<String>,
    minimize_window: Option<bool>,
    text_overrides: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(
        &root,
        format!("launch_quick_test chamado | delay={}", delay.max(0.0)),
    );

    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        append_launcher_log(
            &root,
            format!("ERRO: executor nao encontrado em {}", script_path.display()),
        );
        return Err(format!(
            "Nenhum executor de automacao foi encontrado. Esperado: {}",
            script_path.display()
        ));
    }

    // Mantem os marcadores de OCR visiveis no teste assistido simples.
    let (python_program, python_args) = python_command_for_visual_feedback(&root)?;
    append_launcher_log(
        &root,
        format!(
            "Python com feedback visual detectado: {} {}",
            python_program,
            python_args.join(" ")
        ),
    );
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg("normal")
        .arg("--atraso")
        .arg(delay.max(0.0).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));

    if let Some(title) = window_title
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--janela-alvo").arg(title);
    }
    if let Some(context) = target_context
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--target-context").arg(context);
    }
    if let Some(value) = text_overrides
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--text-overrides").arg(value);
    }

    let minimized_for_execution = minimize_flowdetect_for_execution(&app, &root, minimize_window);
    let result = spawn_test_process(
        &app,
        &state,
        command,
        format!(
            "Teste simples iniciado no proprio launcher. A automacao vai executar uma vez com atraso inicial de {}s.",
            delay.max(0.0),
        ),
        "o teste simples",
    );
    if result.is_err() {
        restore_flowdetect_after_launch_failure(&app, minimized_for_execution);
    }
    result
}

#[tauri::command]
fn launch_assisted_quick_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    window_title: Option<String>,
    target_context: Option<String>,
    minimize_window: Option<bool>,
    text_overrides: Option<String>,
) -> Result<String, String> {
    launch_quick_test(
        app,
        state,
        delay,
        window_title,
        target_context,
        minimize_window,
        text_overrides,
    )
}

#[tauri::command]
fn launch_test_automation(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    loop_start: i32,
    window_title: Option<String>,
    target_context: Option<String>,
    minimize_window: Option<bool>,
    text_overrides: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(
        &root,
        format!(
            "launch_test_automation chamado | delay={} | loop_start={}",
            delay.max(0.0),
            loop_start.max(1)
        ),
    );

    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        append_launcher_log(
            &root,
            format!("ERRO: executor nao encontrado em {}", script_path.display()),
        );
        return Err(format!(
            "Nenhum executor de automacao foi encontrado. Esperado: {}",
            script_path.display()
        ));
    }

    // A execucao assistida precisa do Tk para desenhar as bordas azul/verde
    // sobre os OCRs e reconhecimentos, inclusive durante o loop por planilha.
    let (python_program, python_args) = python_command_for_visual_feedback(&root)?;
    append_launcher_log(
        &root,
        format!(
            "Python com feedback visual detectado: {} {}",
            python_program,
            python_args.join(" ")
        ),
    );
    let mut command = Command::new(&python_program);
    command
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .arg("--modo")
        .arg("loop")
        .arg("--atraso")
        .arg(delay.max(0.0).to_string())
        .arg("--loop-start")
        .arg(loop_start.max(1).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));

    if let Some(title) = window_title
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--janela-alvo").arg(title);
    }
    if let Some(context) = target_context
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--target-context").arg(context);
    }
    if let Some(value) = text_overrides
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--text-overrides").arg(value);
    }

    let minimized_for_execution = minimize_flowdetect_for_execution(&app, &root, minimize_window);
    let result = spawn_test_process(
        &app,
        &state,
        command,
        format!(
            "Teste com loop iniciado no proprio launcher. O executor vai procurar a linha {} com atraso inicial de {}s.",
            loop_start.max(1),
            delay.max(0.0),
        ),
        "o teste direto com loop",
    );
    if result.is_err() {
        restore_flowdetect_after_launch_failure(&app, minimized_for_execution);
    }
    result
}

#[tauri::command]
fn launch_assisted_loop_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    loop_start: i32,
    window_title: Option<String>,
    target_context: Option<String>,
    minimize_window: Option<bool>,
    text_overrides: Option<String>,
) -> Result<String, String> {
    launch_test_automation(
        app,
        state,
        delay,
        loop_start,
        window_title,
        target_context,
        minimize_window,
        text_overrides,
    )
}

#[tauri::command]
fn stop_test_execution(app: AppHandle, state: State<'_, RuntimeState>) -> Result<String, String> {
    let root = workspace_root(&app);
    let flag_path = root.join(".parar_automacao.flag");
    fs::write(&flag_path, b"stop")
        .map_err(|err| format!("Falha ao solicitar parada da automacao: {err}"))?;

    let pid = state
        .pid
        .lock()
        .map_err(|_| "Falha ao acessar o PID da execucao.".to_string())?
        .to_owned();

    let mut forced_stop = false;
    if let Some(pid_value) = pid {
        #[cfg(windows)]
        {
            let status = Command::new("taskkill")
                .arg("/PID")
                .arg(pid_value.to_string())
                .arg("/T")
                .arg("/F")
                .status();
            forced_stop = status.map(|item| item.success()).unwrap_or(false);
        }
        #[cfg(not(windows))]
        {
            let status = Command::new("kill")
                .arg("-9")
                .arg(pid_value.to_string())
                .status();
            forced_stop = status.map(|item| item.success()).unwrap_or(false);
        }
    }

    if forced_stop {
        set_running_state(&state, false);
        set_pid_state(&state, None);
        emit_running_state(&app, false);
        let _ = app.emit(
            "test-finished",
            TestFinishedPayload {
                success: false,
                code: -9,
            },
        );
        append_launcher_log(
            &root,
            "Parada solicitada pelo launcher com encerramento forcado do processo.",
        );
        return Ok("Parada forcada enviada. A automacao foi interrompida imediatamente.".into());
    }

    append_launcher_log(&root, "Parada solicitada pelo launcher.");
    Ok("Parada solicitada. A automacao vai encerrar no proximo ponto seguro.".into())
}

#[tauri::command]
fn export_automation_bundle(
    app: AppHandle,
    automation_name: String,
) -> Result<ExportResult, String> {
    let root = workspace_root(&app);
    let normalized_name = normalize_automation_name(&automation_name);
    let export_folder_name = sanitize_export_folder_name(&normalized_name);
    let build_dir = root.join("build_automacao");
    let export_dir = root.join(&export_folder_name);
    fs::create_dir_all(&build_dir)
        .map_err(|err| format!("Falha ao criar build_automacao: {err}"))?;
    fs::create_dir_all(&export_dir)
        .map_err(|err| format!("Falha ao criar pasta da automacao {export_folder_name}: {err}"))?;

    let files = [
        "mapeamento_teclado.json",
        "resumo_teclado.txt",
        "comandos_teclado.py",
        "db.xlsx",
        "executar_automacao.py",
        "executar_automacao.bat",
        "gerenciar_dados_planilha.py",
        "requirements.txt",
    ];

    let mut copied = Vec::new();
    let mut missing = Vec::new();

    for file in files {
        let source = root.join(file);
        let build_target = build_dir.join(file);
        let export_target = export_dir.join(file);
        copy_if_exists(&source, &build_target, &mut copied, &mut missing);
        copy_if_exists(&source, &export_target, &mut copied, &mut missing);
    }

    let planilhas_dir = root.join("planilhas");
    if planilhas_dir.exists() {
        for entry in fs::read_dir(&planilhas_dir)
            .map_err(|err| format!("Falha ao ler pasta planilhas: {err}"))?
        {
            let entry =
                entry.map_err(|err| format!("Falha ao ler item da pasta planilhas: {err}"))?;
            let source = entry.path();
            if source.is_file() {
                let file_name = source.file_name().unwrap_or_default();
                copy_if_exists(
                    &source,
                    &build_dir.join("planilhas").join(file_name),
                    &mut copied,
                    &mut missing,
                );
                copy_if_exists(
                    &source,
                    &export_dir.join("planilhas").join(file_name),
                    &mut copied,
                    &mut missing,
                );
            }
        }
    }

    let imagens_dir = root.join("imagens");
    if imagens_dir.exists() {
        for entry in fs::read_dir(&imagens_dir)
            .map_err(|err| format!("Falha ao ler pasta imagens: {err}"))?
        {
            let entry =
                entry.map_err(|err| format!("Falha ao ler item da pasta imagens: {err}"))?;
            let source = entry.path();
            if source.is_file() {
                let file_name = source.file_name().unwrap_or_default();
                copy_if_exists(
                    &source,
                    &build_dir.join("imagens").join(file_name),
                    &mut copied,
                    &mut missing,
                );
                copy_if_exists(
                    &source,
                    &export_dir.join("imagens").join(file_name),
                    &mut copied,
                    &mut missing,
                );
            }
        }
    }

    let config = AutomationConfig {
        name: normalized_name.clone(),
    };
    let config_text = serde_json::to_string_pretty(&config)
        .map_err(|err| format!("Falha ao serializar configuracao da automacao: {err}"))?;
    fs::write(build_dir.join("automacao_config.json"), &config_text)
        .map_err(|err| format!("Falha ao gravar configuracao da build: {err}"))?;
    fs::write(export_dir.join("automacao_config.json"), &config_text)
        .map_err(|err| format!("Falha ao gravar configuracao da exportacao: {err}"))?;
    copied.push("automacao_config.json".into());

    fs::write(build_dir.join("COMO_EXECUTAR_BUILD.txt"), build_guide())
        .map_err(|err| format!("Falha ao gravar guia da build: {err}"))?;
    fs::write(export_dir.join("iniciar.bat"), automation_launcher())
        .map_err(|err| format!("Falha ao gravar iniciar.bat: {err}"))?;
    fs::write(
        export_dir.join("COMO_EXECUTAR.txt"),
        export_guide(&normalized_name),
    )
    .map_err(|err| format!("Falha ao gravar guia da exportacao: {err}"))?;

    Ok(ExportResult {
        build_dir: build_dir.display().to_string(),
        export_dir: export_dir.display().to_string(),
        copied,
        missing,
    })
}

#[tauri::command]
fn set_agent_compact_mode(app: AppHandle, compact: bool) -> Result<Value, String> {
    if !is_flowdetect_agent_runtime(&app) {
        return Err("Este modo esta disponivel apenas no FlowDetect Agent.".to_string());
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal do Agent nao encontrada.".to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|err| err.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "Monitor atual nao encontrado.".to_string())?;
    let screen = monitor.size();
    let monitor_position = monitor.position();
    let (width, height, x, y) = if compact {
        (
            screen.width,
            screen.height,
            monitor_position.x,
            monitor_position.y,
        )
    } else {
        let width = screen.width.saturating_sub(48).min(1240);
        let height = screen.height.saturating_sub(96).min(820);
        (
            width,
            height,
            monitor_position.x + (screen.width.saturating_sub(width) / 2) as i32,
            monitor_position.y + 24,
        )
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    window.set_resizable(true).map_err(|err| err.to_string())?;
    window
        .set_decorations(!compact)
        .map_err(|err| err.to_string())?;
    window
        .set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|err| err.to_string())?;
    window
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|err| err.to_string())?;
    if compact {
        let _ = window.maximize();
    } else {
        let _ = window.unmaximize();
    }
    window
        .set_always_on_top(false)
        .map_err(|err| err.to_string())?;
    window
        .set_resizable(true)
        .map_err(|err| err.to_string())?;
    window
        .set_ignore_cursor_events(compact)
        .map_err(|err| err.to_string())?;
    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|err| err.to_string())?;
        unsafe {
            if compact {
                let _ = ShowWindow(HWND(hwnd.0), SW_MAXIMIZE);
            } else {
                let _ = ShowWindow(HWND(hwnd.0), SW_RESTORE);
                SetWindowPos(
                    HWND(hwnd.0),
                    None,
                    x,
                    y,
                    width as i32,
                    height as i32,
                    SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
                )
                .map_err(|err| format!("Falha ao alinhar janela do Agent: {err}"))?;
            }
        }
    }
    let work_area = set_agent_windows_work_area(compact)?;
    Ok(
        serde_json::json!({"ok":true,"compact":compact,"width":width,"height":height,"work_area":work_area}),
    )
}

fn set_agent_service_window_hidden(app: &AppHandle, hidden: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(false);
        let _ = window.set_skip_taskbar(hidden);
        if hidden {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn toggle_agent_service_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let _ = window.set_always_on_top(false);
        if visible {
            let _ = window.set_skip_taskbar(true);
            let _ = window.hide();
        } else {
            let _ = window.set_skip_taskbar(false);
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RuntimeState {
            child: Arc::new(Mutex::new(None)),
            running: Arc::new(Mutex::new(false)),
            pid: Arc::new(Mutex::new(None)),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            if is_flowdetect_agent_runtime(&app_handle) {
                let root = workspace_root(&app_handle);
                start_agent_http_server(app_handle.clone(), root);
                set_agent_service_window_hidden(&app_handle, true);
                let hotkey_app = app_handle.clone();
                thread::spawn(move || {
                    let mut pressed = false;
                    loop {
                        let active = unsafe {
                            GetAsyncKeyState(VK_CONTROL.0 as i32) < 0
                                && GetAsyncKeyState(VK_SHIFT.0 as i32) < 0
                                && GetAsyncKeyState(VK_F12.0 as i32) < 0
                        };
                        if active && !pressed {
                            toggle_agent_service_window(&hotkey_app);
                            let _ = hotkey_app.emit("agent-overlay-toggle-request", ());
                        }
                        pressed = active;
                        thread::sleep(Duration::from_millis(90));
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_agent_compact_mode,
            get_roadmap,
            get_workbook_meta,
            get_workbook_preview,
            remove_workbook_preview_row,
            clear_workbook_column,
            list_saved_automations,
            list_open_windows,
            map_window_elements,
            capture_uia_element_from_cursor,
            capture_uia_element_from_click,
            select_uia_element_from_window,
            highlight_uia_element,
            show_target_window_overlay,
            hide_target_window_overlay,
            fit_target_window_to_agent_area,
            fit_active_window_to_agent_area,
            get_agent_connection_info,
            get_agent_remote_snapshot,
            list_hyperv_vms,
            get_hyperv_status,
            create_hyperv_base_vm,
            clone_hyperv_vm,
            start_hyperv_vm,
            stop_hyperv_vm,
            turn_off_hyperv_vm,
            kill_hyperv_vm_process,
            get_hyperv_vm_connection,
            get_hyperv_vm_boot_status,
            probe_native_hyperv_rdp,
            open_native_hyperv_rdp,
            resize_native_hyperv_rdp,
            activate_native_hyperv_rdp,
            close_native_hyperv_rdp,
            set_native_hyperv_rdp_input_enabled,
            open_hyperv_vm_console,
            open_embedded_hyperv_console,
            resize_embedded_hyperv_console,
            get_embedded_hyperv_console_frame,
            close_embedded_hyperv_console,
            get_login_session,
            save_login_session,
            create_saved_automation,
            open_saved_automation,
            duplicate_saved_automation,
            rename_saved_automation,
            delete_saved_automation,
            export_saved_automation_zip,
            import_saved_automation_zip,
            import_saved_automation_zip_from_path,
            import_saved_automation_zip_from_file_path,
            execute_saved_automation,
            export_runtime_update_zip,
            import_runtime_update_zip,
            import_runtime_update_zip_from_path,
            import_workbook,
            open_workbook,
            delete_workbook,
            import_image_asset,
            rename_image_asset,
            get_recognition_image_preview,
            capture_image_asset,
            open_images_folder,
            open_recognition_diagnostics_folder,
            capture_mouse_click,
            start_smart_recorder,
            stop_smart_recorder,
            get_smart_recorder_status,
            update_smart_recorder_click_area,
            delete_smart_recorder_event,
            clear_smart_recorder_events,
            update_smart_recorder_event_delay,
            add_text_block,
            add_key_block,
            add_loop_start_block,
            add_loop_end_block,
            add_mouse_block,
            add_image_click_block,
            add_ocr_text_block,
            add_verify_button_state_block,
            add_chrome_html_block,
            add_uia_element_block,
            add_open_url_block,
            add_open_program_block,
            add_save_download_block,
            add_spreadsheet_block,
            add_write_spreadsheet_block,
            add_compare_spreadsheet_block,
            insert_text_block,
            insert_key_block,
            insert_loop_start_block,
            insert_loop_end_block,
            insert_mouse_block,
            insert_image_click_block,
            insert_ocr_text_block,
            insert_chrome_html_block,
            insert_uia_element_block,
            insert_open_url_block,
            insert_open_program_block,
            insert_save_download_block,
            insert_spreadsheet_block,
            insert_write_spreadsheet_block,
            insert_compare_spreadsheet_block,
            update_text_block,
            update_key_block,
            update_loop_marker_block,
            update_mouse_block,
            update_image_click_block,
            update_ocr_text_block,
            update_verify_button_state_block,
            update_chrome_html_block,
            update_uia_element_block,
            update_open_url_block,
            update_open_program_block,
            update_save_download_block,
            update_spreadsheet_block,
            update_write_spreadsheet_block,
            update_compare_spreadsheet_block,
            update_sequence_settings,
            update_initial_sequence,
            move_blocks_to_sequence,
            update_block_delay,
            update_all_blocks_delay,
            move_block,
            reorder_block,
            remove_block,
            clear_blocks,
            launch_legacy_capture,
            analyze_html_element,
            chrome_web_capture_element,
            chrome_web_test_element,
            chrome_web_open_site,
            test_image_recognition,
            test_ocr_recognition,
            get_test_loop_data,
            get_test_execution_state,
            launch_quick_test,
            launch_assisted_quick_test,
            launch_test_automation,
            launch_assisted_loop_test,
            stop_test_execution,
            remote_agent_ping,
            remote_agent_set_identity,
            remote_agent_list_automations,
            remote_agent_open_automation,
            remote_agent_status,
            remote_agent_spreadsheet_preview,
            remote_agent_clear_spreadsheet_column,
            remote_agent_execute_watch_automation,
            remote_agent_meshcentral_status,
            remote_agent_screen_snapshot,
            remote_agent_control_event,
            remote_agent_webrtc_offer,
            remote_agent_webrtc_answer,
            remote_agent_webrtc_clear,
            remote_agent_meshcentral_start,
            agent_meshcentral_status,
            agent_meshcentral_start,
            agent_webrtc_poll_offer,
            agent_webrtc_set_answer,
            agent_webrtc_clear,
            get_agent_mouse_control_state,
            set_agent_mouse_control_enabled,
            agent_remote_control_event,
            remote_agent_execute,
            remote_agent_stop,
            remote_agent_import_automation_zip,
            remote_agent_send_saved_automation,
            remote_agent_get_recognition_preview,
            remote_agent_delete_automation,
            export_automation_bundle,
        ])
        .build(tauri::generate_context!())
        .expect("erro ao preparar o gerador")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if is_flowdetect_agent_runtime(app) {
                    let _ = set_agent_windows_work_area(false);
                } else {
                    #[cfg(windows)]
                    {
                        close_embedded_hyperv_console_native();
                        let _ = native_rdp::close();
                    }
                }
            }
        });
}
