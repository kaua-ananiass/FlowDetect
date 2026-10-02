//! Local bridge for diagnostics and explicit automation transfers to the Chrome extension.
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const ADDRESS: &str = "127.0.0.1:18453";
const EXTENSION_VERSION: &str = "0.2.57";
static RUNNING: AtomicBool = AtomicBool::new(false);
static BRIDGE: OnceLock<Arc<(Mutex<BridgeState>, Condvar)>> = OnceLock::new();

#[derive(Default)]
struct BridgeState {
    active_id: String,
    pending: Option<Value>,
    result: Option<Value>,
    last_poll: Option<Instant>,
    extension_id: String,
    phase: String,
    candidates: HashMap<String, (String, Instant)>,
    paired_extension_id: String,
    paired_code: String,
    pairing_path: Option<PathBuf>,
}

fn bridge() -> Arc<(Mutex<BridgeState>, Condvar)> {
    BRIDGE
        .get_or_init(|| Arc::new((Mutex::new(BridgeState::default()), Condvar::new())))
        .clone()
}

pub fn start(pairing_path: Option<PathBuf>) -> Result<(), String> {
    if RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    if let Some(path) = pairing_path {
        let shared = bridge();
        let (lock, _) = &*shared;
        let mut state = lock.lock().map_err(|_| "Ponte Chrome indisponivel.")?;
        if let Ok(bytes) = fs::read(&path) {
            if let Ok(saved) = serde_json::from_slice::<Value>(&bytes) {
                let id = saved["extension_id"].as_str().unwrap_or("");
                let code = saved["code"].as_str().unwrap_or("");
                if valid_extension_id(id) && valid_pair_code(code) {
                    state.paired_extension_id = id.to_string();
                    state.paired_code = code.to_string();
                }
            }
        }
        state.pairing_path = Some(path);
    }
    let listener = TcpListener::bind(ADDRESS).map_err(|error| {
        format!("Nao foi possivel iniciar a ponte com a extensao em {ADDRESS}: {error}")
    })?;
    RUNNING.store(true, Ordering::SeqCst);
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            thread::spawn(move || handle_client(stream));
        }
        RUNNING.store(false, Ordering::SeqCst);
    });
    Ok(())
}

fn valid_extension_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|byte| (b'a'..=b'p').contains(&byte))
}

fn valid_pair_code(code: &str) -> bool {
    code.len() == 6 && code.bytes().all(|byte| byte.is_ascii_digit())
}

fn matching_candidate(state: &BridgeState, code: &str) -> Result<String, String> {
    let matches: Vec<_> = state
        .candidates
        .iter()
        .filter(|(_, (candidate, seen))| {
            candidate == code && seen.elapsed() < Duration::from_secs(20)
        })
        .map(|(id, _)| id.clone())
        .collect();
    match matches.as_slice() {
        [] => Err("Codigo nao detectado. Abra a extensao no mesmo computador e confira se ela mostra 'Studio encontrado'.".into()),
        [id] => Ok(id.clone()),
        _ => Err("Mais de uma extensao apresentou esse codigo. Gere um novo codigo e tente novamente.".into()),
    }
}

#[tauri::command]
pub fn pair_chrome_extension(code: String) -> Result<Value, String> {
    let code = code.trim();
    if !valid_pair_code(code) {
        return Err("Digite os 6 numeros mostrados na extensao.".into());
    }
    if !RUNNING.load(Ordering::SeqCst) {
        return Err(
            "Ponte Chrome indisponivel. Feche todas as janelas do Studio e abra novamente.".into(),
        );
    }
    let shared = bridge();
    let (lock, signal) = &*shared;
    let mut state = lock.lock().map_err(|_| "Ponte Chrome indisponivel.")?;
    state
        .candidates
        .retain(|_, (_, seen)| seen.elapsed() < Duration::from_secs(20));
    let id = matching_candidate(&state, code)?;
    if let Some(path) = &state.pairing_path {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Falha ao salvar pareamento: {error}"))?;
        }
        fs::write(
            path,
            serde_json::to_vec(&json!({"extension_id":id,"code":code})).unwrap(),
        )
        .map_err(|error| format!("Falha ao salvar pareamento: {error}"))?;
    }
    state.paired_extension_id = id.clone();
    state.paired_code = code.to_string();
    state.last_poll = None;
    state.extension_id.clear();
    state.phase.clear();
    signal.notify_all();
    Ok(json!({"ok":true,"extensionId":id}))
}

#[tauri::command]
pub async fn test_chrome_extension_recognition(
    textos: Vec<String>,
    selector: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || wait_for_extension_test(textos, selector))
        .await
        .map_err(|error| format!("Falha ao aguardar a extensao: {error}"))?
}

#[tauri::command]
pub fn chrome_extension_connection_status() -> Value {
    let shared = bridge();
    let (lock, _) = &*shared;
    let Ok(state) = lock.lock() else {
        return json!({"connected": false, "phase": "error"});
    };
    let connected = RUNNING.load(Ordering::SeqCst)
        && state
            .last_poll
            .is_some_and(|seen| seen.elapsed() < Duration::from_secs(15))
        && !state.paired_extension_id.is_empty();
    let studio_detected = state
        .candidates
        .values()
        .any(|(_, seen)| seen.elapsed() < Duration::from_secs(20));
    json!({
        "connected": connected,
        "bridgeActive": RUNNING.load(Ordering::SeqCst),
        "studioDetected": studio_detected,
        "paired": !state.paired_extension_id.is_empty(),
        "phase": state.phase,
        "extensionId": if connected { state.extension_id.as_str() } else { "" },
    })
}

pub async fn send_automation(automation: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if automation.get("schema").and_then(Value::as_str) != Some("flowdetect_chrome_automation")
            || !automation.get("steps").is_some_and(Value::is_array)
        {
            return Err("A exportacao para Chrome esta invalida.".into());
        }
        let name = automation["automation"]["nome"]
            .as_str()
            .unwrap_or("Automacao")
            .to_string();
        let result = wait_for_job(json!({"type": "import_automation", "automation": automation}))?;
        if result.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(result["error"]
                .as_str()
                .unwrap_or("A extensao recusou a automacao.")
                .to_string());
        }
        Ok(json!({"ok": true, "name": name, "steps": result["steps"]}))
    })
    .await
    .map_err(|error| format!("Falha ao enviar a automacao: {error}"))?
}

fn wait_for_extension_test(textos: Vec<String>, selector: Option<String>) -> Result<Value, String> {
    let texts: Vec<String> = textos
        .into_iter()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .collect();
    let selector = selector.unwrap_or_default().trim().to_string();
    if (texts.is_empty() && selector.is_empty())
        || texts.len() > 30
        || texts.iter().any(|text| text.len() > 300)
        || selector.len() > 1500
    {
        return Err("Configure ate 30 textos curtos ou um seletor CSS para testar.".into());
    }
    wait_for_job(json!({"type": "test_recognition", "texts": texts, "selector": selector}))
}

fn wait_for_job(mut job: Value) -> Result<Value, String> {
    if !RUNNING.load(Ordering::SeqCst) {
        return Err("A ponte com a extensao nao esta ativa. Reinicie o FlowDetect Studio.".into());
    }
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|time| time.as_nanos().to_string())
        .unwrap_or_else(|_| "0".into());
    let shared = bridge();
    let (lock, signal) = &*shared;
    let mut state = lock.lock().map_err(|_| "Ponte Chrome indisponivel.")?;
    if !state
        .last_poll
        .is_some_and(|seen| seen.elapsed() < Duration::from_secs(15))
    {
        return Err("Extensao nao conectada. Abra Conectar Chrome no Studio e digite o codigo mostrado na extensao.".into());
    }
    if !state.active_id.is_empty() {
        return Err("Ja existe um teste Chrome em andamento.".into());
    }
    state.active_id = id.clone();
    job["id"] = json!(id);
    state.pending = Some(job);
    state.result = None;
    state.phase = "queued".into();
    signal.notify_all();
    let deadline = Instant::now() + Duration::from_secs(45);
    loop {
        if let Some(result) = state.result.take() {
            state.active_id.clear();
            state.pending = None;
            state.phase.clear();
            return Ok(result);
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            state.active_id.clear();
            state.pending = None;
            let phase = std::mem::take(&mut state.phase);
            return Err(if phase == "delivered" {
                "A extensao recebeu o pedido, mas nao concluiu. Recarregue a aba do site e tente novamente.".into()
            } else {
                "A extensao nao recebeu o pedido. Recarregue a extensao FlowDetect no Chrome."
                    .into()
            });
        }
        let (next, _) = signal
            .wait_timeout(state, remaining)
            .map_err(|_| "Ponte Chrome indisponivel.")?;
        state = next;
    }
}

fn extension_origin(request: &str) -> Option<String> {
    let origin = request.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case("origin")
            .then(|| value.trim().to_string())
    })?;
    let id = origin.strip_prefix("chrome-extension://")?;
    valid_extension_id(id).then_some(origin)
}

fn request_header<'a>(request: &'a str, expected: &str) -> Option<&'a str> {
    request.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case(expected)
            .then(|| value.trim())
    })
}

fn response(status: &str, body: Value, origin: Option<&str>) -> Vec<u8> {
    let body = serde_json::to_string(&body).unwrap_or_else(|_| "{}".into());
    let cors = origin.map(|value| format!(
        "Access-Control-Allow-Origin: {value}\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-FlowDetect-Version, X-FlowDetect-Extension-ID, X-FlowDetect-Pair-Code\r\nAccess-Control-Allow-Private-Network: true\r\nVary: Origin\r\n"
    )).unwrap_or_default();
    format!("HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\n{cors}Content-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).into_bytes()
}

fn read_request(stream: &mut TcpStream) -> Result<(String, Vec<u8>), String> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let size = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if size == 0 {
            return Err("Requisicao incompleta".into());
        }
        bytes.extend_from_slice(&chunk[..size]);
        if bytes.len() > 65536 {
            return Err("Requisicao muito grande".into());
        }
        if let Some(end) = bytes
            .windows(4)
            .position(|part| part == b"\r\n\r\n")
            .map(|at| at + 4)
        {
            let header = String::from_utf8_lossy(&bytes[..end]).to_string();
            let length = header
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.trim()
                        .eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
                .unwrap_or(0);
            if length > 32768 {
                return Err("Corpo muito grande".into());
            }
            if bytes.len() >= end + length {
                return Ok((header, bytes[end..end + length].to_vec()));
            }
        }
    }
}

fn handle_client(mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let (request, body) = match read_request(&mut stream) {
        Ok(value) => value,
        Err(_) => return,
    };
    let origin = extension_origin(&request);
    let first = request.lines().next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    let claimed_id = request_header(&request, "x-flowdetect-extension-id").unwrap_or("");
    let origin_matches = origin.as_deref().map_or(true, |value| {
        value.trim_start_matches("chrome-extension://") == claimed_id
    });
    let has_invalid_origin = request_header(&request, "origin").is_some() && origin.is_none();
    let authorized = if method == "OPTIONS" {
        origin.is_some()
    } else {
        valid_extension_id(claimed_id) && origin_matches && !has_invalid_origin
    };
    let reply = if !authorized {
        response(
            "403 Forbidden",
            json!({"error":"Extensao nao autorizada"}),
            None,
        )
    } else if method == "OPTIONS" {
        response("200 OK", json!({}), origin.as_deref())
    } else if method == "GET" && path == "/poll" {
        let version = request_header(&request, "x-flowdetect-version");
        if version != Some(EXTENSION_VERSION) {
            let _ = stream.write_all(&response(
                "426 Upgrade Required",
                json!({"error":"Atualize a extensao FlowDetect para Chrome."}),
                origin.as_deref(),
            ));
            return;
        }
        let code = request_header(&request, "x-flowdetect-pair-code").unwrap_or("");
        if !valid_pair_code(code) {
            let _ = stream.write_all(&response(
                "400 Bad Request",
                json!({"error":"Codigo de pareamento invalido."}),
                origin.as_deref(),
            ));
            return;
        }
        let extension_id = claimed_id.to_string();
        let shared = bridge();
        let (lock, signal) = &*shared;
        let mut state = match lock.lock() {
            Ok(value) => value,
            Err(_) => return,
        };
        state
            .candidates
            .retain(|_, (_, seen)| seen.elapsed() < Duration::from_secs(20));
        state
            .candidates
            .insert(extension_id.clone(), (code.to_string(), Instant::now()));
        let paired = state.paired_extension_id == extension_id && state.paired_code == code;
        if !paired {
            if state.paired_extension_id == extension_id {
                state.last_poll = None;
            }
            response(
                "200 OK",
                json!({"job":null,"paired":false}),
                origin.as_deref(),
            )
        } else {
            state.last_poll = Some(Instant::now());
            state.extension_id = extension_id.clone();
            if state.pending.is_none() {
                state = match signal.wait_timeout(state, Duration::from_secs(8)) {
                    Ok((value, _)) => value,
                    Err(_) => return,
                };
            }
            let still_paired =
                state.paired_extension_id == extension_id && state.paired_code == code;
            if still_paired && state.pending.is_some() {
                state.phase = "delivered".into();
            }
            response(
                "200 OK",
                json!({"job":if still_paired { state.pending.take() } else { None },"paired":still_paired}),
                origin.as_deref(),
            )
        }
    } else if method == "POST" && path == "/result" {
        let payload: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
        let id = payload.get("id").and_then(Value::as_str).unwrap_or("");
        let shared = bridge();
        let (lock, signal) = &*shared;
        let mut state = match lock.lock() {
            Ok(value) => value,
            Err(_) => return,
        };
        let extension_id = claimed_id;
        let code = request_header(&request, "x-flowdetect-pair-code").unwrap_or("");
        if !id.is_empty()
            && state.active_id == id
            && state.paired_extension_id == extension_id
            && state.paired_code == code
        {
            state.result = Some(payload.get("result").cloned().unwrap_or(Value::Null));
            signal.notify_all();
            response("200 OK", json!({"ok":true}), origin.as_deref())
        } else {
            response(
                "409 Conflict",
                json!({"error":"Teste expirado"}),
                origin.as_deref(),
            )
        }
    } else {
        response(
            "404 Not Found",
            json!({"error":"Rota desconhecida"}),
            origin.as_deref(),
        )
    };
    let _ = stream.write_all(&reply);
}

#[cfg(test)]
mod tests {
    use super::*;
    static TEST_GUARD: Mutex<()> = Mutex::new(());

    fn exchange(method: &str, path: &str, body: &str) -> String {
        exchange_version(method, path, body, EXTENSION_VERSION)
    }

    fn exchange_version(method: &str, path: &str, body: &str, version: &str) -> String {
        exchange_identity(
            method,
            path,
            body,
            version,
            Some("chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
    }

    fn exchange_identity(
        method: &str,
        path: &str,
        body: &str,
        version: &str,
        origin: Option<&str>,
        extension_id: &str,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let worker = thread::spawn(move || handle_client(listener.accept().unwrap().0));
        let mut stream = TcpStream::connect(address).unwrap();
        let origin_header = origin
            .map(|value| format!("Origin: {value}\r\n"))
            .unwrap_or_default();
        write!(stream, "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n{origin_header}X-FlowDetect-Version: {version}\r\nX-FlowDetect-Extension-ID: {extension_id}\r\nX-FlowDetect-Pair-Code: 123456\r\nContent-Length: {}\r\n\r\n{body}", body.len()).unwrap();
        let mut reply = String::new();
        stream.read_to_string(&mut reply).unwrap();
        worker.join().unwrap();
        reply
    }

    #[test]
    fn rejects_web_page_origin() {
        assert!(extension_origin("Origin: https://example.com\r\n").is_none());
        assert!(extension_origin(
            "Origin: chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\r\n"
        )
        .is_some());
    }

    #[test]
    fn accepts_extension_identity_without_origin_but_rejects_mismatch() {
        let _guard = TEST_GUARD.lock().unwrap();
        let direct = exchange_identity(
            "GET",
            "/poll",
            "",
            EXTENSION_VERSION,
            None,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        assert!(direct.contains("200 OK"));
        let mismatch = exchange_identity(
            "GET",
            "/poll",
            "",
            EXTENSION_VERSION,
            Some("chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        assert!(mismatch.contains("403 Forbidden"));
    }

    #[test]
    fn rejects_outdated_extension_before_delivering_jobs() {
        let reply = exchange_version("GET", "/poll", "", "0.2.56");
        assert!(reply.contains("426 Upgrade Required"));
    }

    #[test]
    fn pairing_requires_exact_six_digit_code_from_recent_extension() {
        assert!(valid_pair_code("012345"));
        assert!(!valid_pair_code("12345"));
        assert!(!valid_pair_code("12345a"));
        let mut state = BridgeState::default();
        let id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string();
        state
            .candidates
            .insert(id.clone(), ("012345".into(), Instant::now()));
        assert_eq!(matching_candidate(&state, "012345").unwrap(), id);
        assert!(matching_candidate(&state, "123456").is_err());
    }

    #[test]
    fn exchanges_read_only_test_request() {
        let _guard = TEST_GUARD.lock().unwrap();
        let shared = bridge();
        let (lock, _) = &*shared;
        {
            let mut state = lock.lock().unwrap();
            state.active_id = "test-id".into();
            state.pending = Some(json!({"id":"test-id","texts":["Pesquisar"]}));
            state.result = None;
            state.paired_extension_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into();
            state.paired_code = "123456".into();
        }
        let polled = exchange("GET", "/poll", "");
        assert!(polled.contains("Pesquisar"));
        let posted = exchange(
            "POST",
            "/result",
            r#"{"id":"test-id","result":{"ok":true}}"#,
        );
        assert!(posted.contains("\"ok\":true"));
        let mut state = lock.lock().unwrap();
        assert_eq!(state.result.take().unwrap()["ok"], true);
        state.pending = Some(json!({"id":"test-id","type":"import_automation"}));
        drop(state);
        let imported = exchange("GET", "/poll", "");
        assert!(imported.contains("import_automation"));
        let mut state = lock.lock().unwrap();
        state.active_id.clear();
        state.paired_extension_id.clear();
        state.paired_code.clear();
    }

    #[test]
    fn unpaired_extension_cannot_take_pending_job() {
        let _guard = TEST_GUARD.lock().unwrap();
        let shared = bridge();
        let (lock, _) = &*shared;
        {
            let mut state = lock.lock().unwrap();
            state.pending = Some(json!({"id":"private-job"}));
            state.paired_extension_id.clear();
            state.paired_code.clear();
        }
        let reply = exchange("GET", "/poll", "");
        assert!(reply.contains("\"paired\":false"));
        let mut state = lock.lock().unwrap();
        assert_eq!(state.pending.take().unwrap()["id"], "private-job");
    }
}
