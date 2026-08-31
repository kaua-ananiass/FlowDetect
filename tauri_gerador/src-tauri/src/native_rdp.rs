use serde_json::Value;
use std::{ffi::{c_void, CString}, fs, mem, ptr, process::Command, sync::Mutex, thread, time::Duration};
use windows::{
    core::{BSTR, Interface, PCSTR, PCWSTR, PWSTR, VARIANT},
    Win32::{
        Foundation::{BOOL, HWND, LPARAM, WPARAM},
        Security::Credentials::{CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_DOMAIN_PASSWORD, CRED_TYPE_GENERIC},
        System::{
            Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, DISPATCH_METHOD, DISPATCH_PROPERTYGET, DISPATCH_PROPERTYPUT, DISPPARAMS, IDispatch},
            LibraryLoader::{GetProcAddress, LoadLibraryW},
        },
        UI::{
            Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT, KEYEVENTF_KEYUP, VK_RETURN},
            WindowsAndMessaging::{CreateWindowExW, DestroyWindow, DispatchMessageW, EnumChildWindows, EnumWindows, GetClassNameW, GetMessageW, GetWindowLongPtrW, GetWindowTextW, GetWindowThreadProcessId, IsWindow, IsWindowVisible, PostMessageW, SendMessageW, SetForegroundWindow, SetParent, SetWindowLongPtrW, SetWindowPos, ShowWindow, TranslateMessage, BM_CLICK, GWL_STYLE, MSG, SW_HIDE, SW_SHOW, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_SHOWWINDOW, WINDOW_EX_STYLE, WM_CLOSE, WS_CAPTION, WS_CHILD, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME, WS_VISIBLE},
        },
    },
};

windows::core::imp::define_interface!(IMsRdpExtendedSettings, IMsRdpExtendedSettings_Vtbl, 0x302d8188_0052_4807_806a_362b628f9ac5);
windows::core::imp::interface_hierarchy!(IMsRdpExtendedSettings, windows::core::IUnknown);
#[repr(C)]
pub struct IMsRdpExtendedSettings_Vtbl {
    pub base__: windows::core::IUnknown_Vtbl,
    pub put_property: unsafe extern "system" fn(*mut c_void, *mut u16, *const VARIANT) -> windows::core::HRESULT,
    pub get_property: unsafe extern "system" fn(*mut c_void, *mut u16, *mut VARIANT) -> windows::core::HRESULT,
}

impl IMsRdpExtendedSettings {
    unsafe fn set(&self, name: &str, value: &VARIANT) -> windows::core::Result<()> {
        let name = BSTR::from(name);
        (Interface::vtable(self).put_property)(Interface::as_raw(self), name.as_ptr() as *mut u16, value).ok()
    }
}

windows::core::imp::define_interface!(IMsTscNonScriptable, IMsTscNonScriptable_Vtbl, 0xc1e6743a_41c1_4a74_832a_0dd06c1c7a0e);
windows::core::imp::interface_hierarchy!(IMsTscNonScriptable, windows::core::IUnknown);
#[repr(C)]
pub struct IMsTscNonScriptable_Vtbl {
    pub base__: windows::core::IUnknown_Vtbl,
    pub put_clear_text_password: unsafe extern "system" fn(*mut c_void, *mut u16) -> windows::core::HRESULT,
}

impl IMsTscNonScriptable {
    unsafe fn set_clear_text_password(&self, password: &str) -> windows::core::Result<()> {
        let password = BSTR::from(password);
        (Interface::vtable(self).put_clear_text_password)(
            Interface::as_raw(self),
            password.as_ptr() as *mut u16,
        )
        .ok()
    }
}

#[derive(Default)]
struct NativeRdpState { hwnd: isize, parent: isize, vm_id: String, version: String }
static STATE: Mutex<NativeRdpState> = Mutex::new(NativeRdpState { hwnd: 0, parent: 0, vm_id: String::new(), version: String::new() });

struct ProcessWindowSearch { process_id: u32, hwnd: isize, dialog: isize }
struct ClassWindowSearch { class_name: &'static str, hwnd: isize }

unsafe extern "system" fn find_process_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let search = &mut *(lparam.0 as *mut ProcessWindowSearch);
    let mut process_id = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    if process_id == search.process_id {
        // O MSTSC cria primeiro dialogos #32770 e depois a janela real de
        // renderizacao. Ela pode nascer oculta enquanto a sessao termina de
        // configurar, por isso tem prioridade mesmo antes de ficar visivel.
        let class_name = window_text(hwnd, true);
        if class_name == "TscShellContainerClass" {
            search.hwnd = hwnd.0 as isize;
            // Continue enumerando: o aviso #32770 pertence ao mesmo processo
            // e precisa ser confirmado antes desta janela oculta ser exibida.
            return BOOL(1);
        }
        if class_name == "#32770" && IsWindowVisible(hwnd).as_bool() {
            search.dialog = hwnd.0 as isize;
            return BOOL(1);
        }
        let title = window_text(hwnd, false);
        if title.contains("Conexão de Máquina Virtual")
            || title.contains("Virtual Machine Connection")
        {
            search.hwnd = hwnd.0 as isize;
            return BOOL(0);
        }
        if search.hwnd == 0 && IsWindowVisible(hwnd).as_bool() {
            search.hwnd = hwnd.0 as isize;
        }
    }
    BOOL(1)
}

unsafe extern "system" fn find_class_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let search = &mut *(lparam.0 as *mut ClassWindowSearch);
    if window_text(hwnd, true) == search.class_name {
        search.hwnd = hwnd.0 as isize;
        return BOOL(0);
    }
    BOOL(1)
}

fn webview_host(owner: isize) -> isize {
    let mut search = ClassWindowSearch { class_name: "WRY_WEBVIEW", hwnd: 0 };
    unsafe {
        let _ = EnumChildWindows(
            HWND(owner as *mut c_void),
            Some(find_class_window),
            LPARAM((&mut search as *mut ClassWindowSearch) as isize),
        );
    }
    if search.hwnd != 0 { search.hwnd } else { owner }
}

fn has_visible_remote_surface(hwnd: HWND) -> bool {
    let mut search = ClassWindowSearch { class_name: "OPWindowClass", hwnd: 0 };
    unsafe {
        let _ = EnumChildWindows(
            hwnd,
            Some(find_class_window),
            LPARAM((&mut search as *mut ClassWindowSearch) as isize),
        );
        search.hwnd != 0 && IsWindowVisible(HWND(search.hwnd as *mut c_void)).as_bool()
    }
}

unsafe fn confirm_rdp_dialog(dialog: HWND) {
    let _ = SetForegroundWindow(dialog);
    thread::sleep(Duration::from_millis(120));
    let down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_RETURN, wScan: 0, dwFlags: KEYBD_EVENT_FLAGS(0), time: 0, dwExtraInfo: 0 } },
    };
    let up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_RETURN, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } },
    };
    let _ = SendInput(&[down, up], mem::size_of::<INPUT>() as i32);
}

unsafe fn dock_native_window(hwnd: HWND, parent: HWND, x: i32, y: i32, width: i32, height: i32) -> Result<(), String> {
    let current = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
    let style = (current & !(WS_POPUP.0 | WS_CAPTION.0 | WS_THICKFRAME.0 | WS_SYSMENU.0 | WS_MINIMIZEBOX.0 | WS_MAXIMIZEBOX.0))
        | WS_CHILD.0 | WS_VISIBLE.0 | WS_CLIPCHILDREN.0 | WS_CLIPSIBLINGS.0;
    SetWindowLongPtrW(hwnd, GWL_STYLE, style as isize);
    SetParent(hwnd, parent).map_err(|error| format!("Falha ao integrar o cliente RDP ao Studio: {error}"))?;
    SetWindowPos(hwnd, None, x, y, width.max(320), height.max(240), SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW)
        .map_err(|error| format!("Falha ao dimensionar a tela nativa: {error}"))?;
    let _ = ShowWindow(hwnd, SW_SHOW);
    Ok(())
}

fn window_text(hwnd: HWND, class_name: bool) -> String {
    let mut buffer = [0u16; 512];
    let length = unsafe {
        if class_name { GetClassNameW(hwnd, &mut buffer) }
        else { GetWindowTextW(hwnd, &mut buffer) }
    };
    String::from_utf16_lossy(&buffer[..length.max(0) as usize])
}

unsafe extern "system" fn accept_local_rdp_warning(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let accepted = &mut *(lparam.0 as *mut bool);
    let button_text = window_text(hwnd, false);
    if window_text(hwnd, true) == "Button"
        && (button_text == "OK" || button_text == "Conectar" || button_text == "Connect")
    {
        let _ = SendMessageW(hwnd, BM_CLICK, WPARAM(0), LPARAM(0));
        *accepted = true;
        return BOOL(0);
    }
    BOOL(1)
}

type AtlAxWinInit = unsafe extern "system" fn() -> BOOL;
type AtlAxGetControl = unsafe extern "system" fn(HWND, *mut *mut c_void) -> windows::core::HRESULT;

fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(Some(0)).collect() }

fn read_broker_credential(host: &str) -> Result<(String, String), String> {
    let credential_name = format!("FlowDetect/HyperV/{host}");
    let target = wide(&credential_name);
    let mut credential: *mut CREDENTIALW = ptr::null_mut();
    unsafe {
        CredReadW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, 0, &mut credential)
            .map_err(|_| format!("Credencial {credential_name} nao encontrada no Cofre do Windows."))?;
        if credential.is_null() {
            return Err(format!("Credencial {credential_name} vazia no Cofre do Windows."));
        }
        let item = &*credential;
        let username = item.UserName.to_string().unwrap_or_default();
        let units = item.CredentialBlobSize as usize / mem::size_of::<u16>();
        let password = if item.CredentialBlob.is_null() || units == 0 {
            String::new()
        } else {
            String::from_utf16_lossy(std::slice::from_raw_parts(
                item.CredentialBlob as *const u16,
                units,
            ))
        };
        CredFree(credential as *const c_void);
        if username.is_empty() || password.is_empty() {
            Err(format!("A credencial {credential_name} nao possui usuario ou senha."))
        } else {
            Ok((username, password))
        }
    }
}

fn provision_mstsc_credential(host: &str) -> Result<String, String> {
    let (username, password) = read_broker_credential(host)?;
    let mut target = wide(&format!("TERMSRV/{host}"));
    let mut user = wide(&username);
    let mut password_utf16: Vec<u16> = password.encode_utf16().collect();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_DOMAIN_PASSWORD,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: (password_utf16.len() * mem::size_of::<u16>()) as u32,
        CredentialBlob: password_utf16.as_mut_ptr() as *mut u8,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(user.as_mut_ptr()),
        ..Default::default()
    };
    unsafe {
        CredWriteW(&credential, 0)
            .map_err(|error| format!("Nao foi possivel autorizar o MSTSC no Cofre do Windows: {error}"))?;
    }
    // A senha permanece apenas em memoria pelo tempo desta funcao.
    password_utf16.fill(0);
    Ok(username)
}

unsafe fn atl_functions() -> Result<(AtlAxWinInit, AtlAxGetControl), String> {
    let module = LoadLibraryW(PCWSTR(wide("atl.dll").as_ptr())).map_err(|error| format!("ATL indisponivel: {error}"))?;
    let init_name = CString::new("AtlAxWinInit").unwrap();
    let get_name = CString::new("AtlAxGetControl").unwrap();
    let init = GetProcAddress(module, PCSTR(init_name.as_ptr() as _)).ok_or("AtlAxWinInit nao encontrado.")?;
    let get = GetProcAddress(module, PCSTR(get_name.as_ptr() as _)).ok_or("AtlAxGetControl nao encontrado.")?;
    Ok((mem::transmute(init), mem::transmute(get)))
}

unsafe fn dispatch_id(dispatch: &IDispatch, name: &str) -> Result<i32, String> {
    let text = wide(name);
    let names = [PCWSTR(text.as_ptr())];
    let mut id = 0i32;
    dispatch.GetIDsOfNames(&windows::core::GUID::zeroed(), names.as_ptr(), 1, 0, &mut id).map_err(|error| format!("Propriedade RDP {name} indisponivel: {error}"))?;
    Ok(id)
}

unsafe fn dispatch_put(dispatch: &IDispatch, name: &str, mut value: VARIANT) -> Result<(), String> {
    let id = dispatch_id(dispatch, name)?;
    let mut named = -3i32; // DISPID_PROPERTYPUT
    let params = DISPPARAMS { rgvarg: &mut value, rgdispidNamedArgs: &mut named, cArgs: 1, cNamedArgs: 1 };
    dispatch.Invoke(id, &windows::core::GUID::zeroed(), 0, DISPATCH_PROPERTYPUT, &params, None, None, None).map_err(|error| format!("Falha ao definir {name}: {error}"))
}

unsafe fn dispatch_get_dispatch(dispatch: &IDispatch, name: &str) -> Result<IDispatch, String> {
    let id = dispatch_id(dispatch, name)?;
    let params = DISPPARAMS::default();
    let mut result = VARIANT::default();
    dispatch
        .Invoke(
            id,
            &windows::core::GUID::zeroed(),
            0,
            DISPATCH_PROPERTYGET,
            &params,
            Some(&mut result),
            None,
            None,
        )
        .map_err(|error| format!("Falha ao obter {name}: {error}"))?;
    IDispatch::try_from(&result).map_err(|error| format!("{name} nao retornou IDispatch: {error}"))
}

unsafe fn dispatch_call(dispatch: &IDispatch, name: &str) -> Result<(), String> {
    let id = dispatch_id(dispatch, name)?;
    let params = DISPPARAMS::default();
    dispatch.Invoke(id, &windows::core::GUID::zeroed(), 0, DISPATCH_METHOD, &params, None, None, None).map_err(|error| format!("Falha ao chamar {name}: {error}"))
}

fn installed_version() -> Result<&'static str, String> {
    // Version 13 is present in the registry on some Windows builds but its
    // class factory is unavailable. 12 is the newest verified control here.
    for version in ["12", "11", "10"] {
        let key = format!("Registry::HKEY_CLASSES_ROOT\\MsTscAx.MsTscAx.{version}");
        let status = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &format!("if(Test-Path '{}'){{exit 0}}else{{exit 1}}", key.replace('\'', "''"))])
            .creation_flags(0x08000000).status();
        if status.is_ok_and(|value| value.success()) { return Ok(version); }
    }
    Err("Microsoft RDP ActiveX 10 ou superior nao foi encontrado.".into())
}

pub fn probe() -> Result<Value, String> {
    let version = installed_version()?;
    unsafe { atl_functions()?; }
    Ok(serde_json::json!({"ok":true,"provider":"mstscax-hyperv-vmbus","version":version,"activex":format!("MsTscAx.MsTscAx.{version}")}))
}

pub fn open(owner: isize, vm_id: &str, vm_name: &str, x: i32, y: i32, width: i32, height: i32) -> Result<Value, String> {
    // O parser oficial do MSTSC configura o estado privado `sawvmconnect`
    // exigido pelo broker do Hyper-V. Depois da conexao, a janela do cliente
    // vira um filho real do WebView e permanece recortada dentro do painel.
    open_vmconnect(owner, vm_id, vm_name, x, y, width, height)
}

fn open_vmconnect(owner: isize, vm_id: &str, vm_name: &str, x: i32, y: i32, width: i32, height: i32) -> Result<Value, String> {
    close().ok();
    let vm_id = vm_id.trim_matches(|c| c == '{' || c == '}').to_string();
    let host = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "localhost".into());
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA nao esta disponivel.".to_string())?;
    let session_dir = local_app_data.join("FlowDetect Studio").join("HyperV");
    fs::create_dir_all(&session_dir).map_err(|error| format!("Falha ao preparar a sessao Hyper-V: {error}"))?;
    let rdp_path = session_dir.join(format!("{}.rdp", vm_id));
    let username = provision_mstsc_credential(&host)?;
    let rdp = format!(
        "full address:s:{host}\r\nserver port:i:2179\r\npcb:s:{vm_id};EnhancedMode=1\r\nsawvmconnect:i:1\r\nauthentication level:i:2\r\nnegotiate security layer:i:0\r\nusername:s:{username}\r\nprompt for credentials:i:0\r\npromptcredentialonce:i:0\r\nscreen mode id:i:1\r\ndesktopwidth:i:{}\r\ndesktopheight:i:{}\r\nsmart sizing:i:1\r\ndynamic resolution:i:1\r\nredirectclipboard:i:1\r\nredirectprinters:i:0\r\nredirectsmartcards:i:0\r\n", width.max(640), height.max(480)
    );
    fs::write(&rdp_path, rdp).map_err(|error| format!("Falha ao criar a sessao RDP da VM: {error}"))?;
    let mut child = Command::new("mstsc.exe")
        .arg(&rdp_path)
        .spawn()
        .map_err(|error| format!("Nao foi possivel iniciar o cliente nativo do Hyper-V: {error}"))?;
    let process_id = child.id();
    let mut embedded = 0isize;
    // O primeiro acesso pode levar mais tempo enquanto o broker do Hyper-V
    // prepara a sessao e o Windows valida o arquivo RDP local.
    for _ in 0..900 {
        let mut search = ProcessWindowSearch { process_id, hwnd: 0, dialog: 0 };
        unsafe { let _ = EnumWindows(Some(find_process_window), LPARAM((&mut search as *mut ProcessWindowSearch) as isize)); }
        if search.dialog != 0 {
            let mut accepted = false;
            let dialog = HWND(search.dialog as *mut c_void);
            unsafe {
                let _ = EnumChildWindows(
                    dialog,
                    Some(accept_local_rdp_warning),
                    LPARAM((&mut accepted as *mut bool) as isize),
                );
                // Nas versoes recentes o aviso usa controles XAML sem HWND
                // para o botao. ENTER aciona com seguranca o botao padrao
                // "Conectar" deste dialogo local do broker Hyper-V.
                if !accepted {
                    confirm_rdp_dialog(dialog);
                    accepted = true;
                }
            }
            if accepted {
                thread::sleep(Duration::from_millis(350));
                continue;
            }
        }
        if search.hwnd != 0 {
            let candidate = HWND(search.hwnd as *mut c_void);
            let candidate_class = window_text(candidate, true);
            if candidate_class == "#32770" {
                let mut accepted = false;
                unsafe {
                    let _ = EnumChildWindows(
                        candidate,
                        Some(accept_local_rdp_warning),
                        LPARAM((&mut accepted as *mut bool) as isize),
                    );
                }
                if accepted { thread::sleep(Duration::from_millis(250)); }
                // Dialogos de aviso/progresso nunca sao a superficie remota.
                // Aguarde a TscShellContainerClass criada pelo MSTSC.
                continue;
            } else if candidate_class == "TscShellContainerClass" {
                // O aviso de seguranca pode ser hospedado dentro da propria
                // janela do MSTSC. Clique apenas no botao de confirmacao, mas
                // nao encaixe a janela ate o renderizador remoto existir.
                let mut accepted = false;
                unsafe {
                    let _ = EnumChildWindows(
                        candidate,
                        Some(accept_local_rdp_warning),
                        LPARAM((&mut accepted as *mut bool) as isize),
                    );
                }
                if accepted {
                    thread::sleep(Duration::from_millis(250));
                    continue;
                }
                if !has_visible_remote_surface(candidate) {
                    continue;
                }
                embedded = search.hwnd;
                break;
            }
        }
        if child.try_wait().map_err(|error| error.to_string())?.is_some() {
            return Err("O cliente RDP encerrou antes de criar a tela da VM.".into());
        }
        thread::sleep(Duration::from_millis(100));
    }
    if embedded == 0 {
        let _ = child.kill();
        return Err("O cliente RDP nao criou a janela da VM a tempo.".into());
    }
    let native_parent = webview_host(owner);
    unsafe {
        let hwnd = HWND(embedded as *mut c_void);
        dock_native_window(hwnd, HWND(native_parent as *mut c_void), x, y, width, height)?;
    }
    *STATE.lock().unwrap_or_else(|error| error.into_inner()) = NativeRdpState {
        hwnd: embedded,
        parent: native_parent,
        vm_id: vm_id.clone(),
        version: "mstsc-embedded".into(),
    };
    // O VMConnect troca o HWND inicial pela janela definitiva depois que a
    // sessao abre. Acompanhe essa transicao e encaixe o novo HWND no Studio.
    let watched_vm_id = vm_id.clone();
    thread::spawn(move || {
        for _ in 0..360 {
            thread::sleep(Duration::from_millis(250));
            let mut search = ProcessWindowSearch { process_id, hwnd: 0, dialog: 0 };
            unsafe { let _ = EnumWindows(Some(find_process_window), LPARAM((&mut search as *mut ProcessWindowSearch) as isize)); }
            if search.hwnd == 0 { continue; }
            let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
            if state.vm_id != watched_vm_id || state.hwnd == 0 { break; }
            if state.hwnd != search.hwnd {
                let result = unsafe {
                    dock_native_window(
                        HWND(search.hwnd as *mut c_void),
                        HWND(native_parent as *mut c_void),
                        x, y, width, height,
                    )
                };
                if result.is_ok() { state.hwnd = search.hwnd; }
            }
        }
    });
    Ok(serde_json::json!({"ok":true,"provider":"mstsc-hyperv-child","vm_id":vm_id,"vm_name":vm_name,"version":"native"}))
}

#[allow(dead_code)]
fn open_activex(owner: isize, vm_id: &str, x: i32, y: i32, width: i32, height: i32) -> Result<Value, String> {
    close().ok();
    let version = installed_version()?.to_string();
    let vm_id = vm_id.trim_matches(|c| c == '{' || c == '}').to_string();
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    let thread_vm_id = vm_id.clone();
    let thread_version = version.clone();
    let thread_host_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "localhost".to_string());
    thread::Builder::new().name("flowdetect-rdp-vmbus".into()).spawn(move || unsafe {
        let result = (|| -> Result<isize, String> {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|error| format!("COM RDP: {error}"))?;
            let (atl_init, atl_get_control) = atl_functions()?;
            if !atl_init().as_bool() { return Err("ATL recusou inicializar o host ActiveX.".into()); }
            let class = wide("AtlAxWin");
            let control_name = wide(&format!("MsTscAx.MsTscAx.{thread_version}"));
            let hwnd = CreateWindowExW(WINDOW_EX_STYLE(0), PCWSTR(class.as_ptr()), PCWSTR(control_name.as_ptr()), WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS, x, y, width.max(320), height.max(240), HWND(owner as *mut c_void), None, None, None)
                .map_err(|error| format!("Falha ao criar area RDP nativa: {error}"))?;
            let mut unknown = ptr::null_mut();
            atl_get_control(hwnd, &mut unknown).ok().map_err(|error| format!("ATL nao entregou o controle RDP: {error}"))?;
            let unknown = windows::core::IUnknown::from_raw(unknown);
            let dispatch: IDispatch = unknown.cast().map_err(|error| format!("Controle RDP sem IDispatch: {error}"))?;
            // VMConnect's enhanced Windows session is brokered locally by the
            // Hyper-V RDP listener (2179). The PCB selects the target VM while
            // keeping the guest network and IP completely out of the path.
            dispatch_put(&dispatch, "Server", VARIANT::from(thread_host_name.as_str()))?;
            dispatch_put(&dispatch, "DesktopWidth", VARIANT::from(width.max(640)))?;
            dispatch_put(&dispatch, "DesktopHeight", VARIANT::from(height.max(480)))?;
            dispatch_put(&dispatch, "ColorDepth", VARIANT::from(32i32)).ok();
            let advanced = [
                "AdvancedSettings9", "AdvancedSettings8", "AdvancedSettings7",
                "AdvancedSettings6", "AdvancedSettings5", "AdvancedSettings4",
                "AdvancedSettings3", "AdvancedSettings2", "AdvancedSettings",
            ]
            .into_iter()
            .find_map(|name| dispatch_get_dispatch(&dispatch, name).ok())
            .ok_or_else(|| "O ActiveX RDP nao forneceu as configuracoes avancadas para o VMBus.".to_string())?;
            // O listener 2179 e o broker local usado pela sessao aprimorada.
            // PCB seleciona a VM pelo GUID sem depender do IP do convidado.
            dispatch_put(&advanced, "RDPPort", VARIANT::from(2179i32))?;
            let pcb = format!("{};EnhancedMode=1", thread_vm_id);
            dispatch_put(&advanced, "PCB", VARIANT::from(pcb.as_str()))?;
            // Equivalente nativo de `sawvmconnect:i:1`. O mstsc.exe traduz
            // esse campo antes de criar o ActiveX; como hospedamos o controle
            // diretamente, precisamos selecionar explicitamente o SPN do
            // console virtual para autenticar no broker, e nao no host RDP.
            dispatch_put(
                &advanced,
                "AuthenticationServiceClass",
                VARIANT::from("Microsoft Virtual Console Service"),
            )?;
        // O arquivo .rdp representa esta opção como inteiro (0/1). Algumas
        // versões do MsTscAx recusam VARIANT_BOOL e outras não permitem que a
        // propriedade seja alterada por IDispatch. Ela é uma otimização de
        // compatibilidade, portanto não deve impedir a abertura da sessão.
        dispatch_put(&advanced, "NegotiateSecurityLayer", VARIANT::from(0i32)).ok();
            // Com o SPN de VMConnect configurado acima, o nivel 2 autentica o
            // broker usando o token do usuario Windows atual sem transformar
            // a conexao em um RDP comum para o host.
            dispatch_put(&advanced, "AuthenticationLevel", VARIANT::from(2i32)).ok();
            // `sawvmconnect:i:1` tambem desativa CredSSP: o broker autentica
            // com o token Kerberos/Windows do processo e nao com uma senha
            // RDP delegada. Esse detalhe e necessario antes do primeiro frame.
            dispatch_put(&advanced, "EnableCredSspSupport", VARIANT::from(false)).ok();
            // A credencial do broker fica no Cofre do Windows sob
            // FlowDetect/HyperV/<host>. Dialogos nativos de senha nao podem ser
            // hospedados com seguranca dentro do WebView, portanto o ActiveX
            // usa exclusivamente a credencial protegida do sistema.
            dispatch_put(&advanced, "PromptForCredentials", VARIANT::from(false)).ok();
            dispatch_put(&advanced, "PromptForCredentialsOnClient", VARIANT::from(false)).ok();
            dispatch_put(&advanced, "SmartSizing", VARIANT::from(true)).ok();
            // SawVMConnect e aceito pelo parser de arquivos .rdp, mas nao e
            // exposto pela interface COM em todas as versoes do MsTscAx. O
            // broker VMBus continua funcional sem ele quando CredSSP e a
            // negociacao convencional estao desligados.
            dispatch_call(&dispatch, "Connect")?;
            Ok(hwnd.0 as isize)
        })();
        let hwnd = result.as_ref().copied().unwrap_or(0);
        let _ = tx.send(result);
        if hwnd != 0 {
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
                if !IsWindow(HWND(hwnd as *mut c_void)).as_bool() { break; }
            }
            let _ = DestroyWindow(HWND(hwnd as *mut c_void));
        }
        CoUninitialize();
    }).map_err(|error| format!("Falha ao iniciar thread RDP: {error}"))?;
    let hwnd = rx.recv_timeout(std::time::Duration::from_secs(15)).map_err(|_| "O ActiveX RDP nao iniciou a tempo. A criacao da janela COM ficou bloqueada.".to_string())??;
    *STATE.lock().unwrap_or_else(|error| error.into_inner()) = NativeRdpState { hwnd, parent: owner, vm_id: vm_id.clone(), version: version.clone() };
    Ok(serde_json::json!({"ok":true,"provider":"mstscax-hyperv-vmbus","vm_id":vm_id,"version":version}))
}

pub fn resize(x: i32, y: i32, width: i32, height: i32, visible: bool) -> Result<Value, String> {
    let state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if state.hwnd == 0 { return Err("Nenhuma sessao RDP nativa ativa.".into()); }
    unsafe {
        let hwnd = HWND(state.hwnd as *mut c_void);
        if visible {
            if state.version == "mstsc-embedded" {
                dock_native_window(hwnd, HWND(state.parent as *mut c_void), x, y, width, height)?;
            } else {
                SetWindowPos(hwnd, None, x, y, width.max(320), height.max(240), SWP_NOACTIVATE)
                    .map_err(|error| error.to_string())?;
            }
        }
        let _ = ShowWindow(hwnd, if visible { SW_SHOW } else { SW_HIDE });
    }
    Ok(serde_json::json!({"ok":true,"visible":visible,"vm_id":state.vm_id,"version":state.version}))
}

pub fn close() -> Result<Value, String> {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if state.hwnd != 0 { unsafe { PostMessageW(HWND(state.hwnd as *mut c_void), WM_CLOSE, WPARAM(0), LPARAM(0)).map_err(|error| error.to_string())?; } }
    *state = NativeRdpState::default();
    Ok(serde_json::json!({"ok":true}))
}

#[cfg(windows)]
trait HiddenCommand { fn creation_flags(&mut self, flags: u32) -> &mut Self; }
#[cfg(windows)]
impl HiddenCommand for std::process::Command {
    fn creation_flags(&mut self, flags: u32) -> &mut Self { use std::os::windows::process::CommandExt; CommandExt::creation_flags(self, flags) }
}
