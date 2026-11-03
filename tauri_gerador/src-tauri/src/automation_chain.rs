//! Sequential desktop/Chrome orchestration on the dedicated agent.
use super::*;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::time::Instant;

static ACTIVE: AtomicBool = AtomicBool::new(false);
static CANCEL: AtomicBool = AtomicBool::new(false);
static STATE: OnceLock<Mutex<Value>> = OnceLock::new();
pub(crate) fn active() -> bool {
    ACTIVE.load(Ordering::SeqCst)
}
pub(crate) fn initialize(root: &PathBuf) {
    let recovered = snapshot(root);
    if ["interrupted", "needs_attention"].contains(&recovered["status"].as_str().unwrap_or("")) {
        ACTIVE.store(true, Ordering::SeqCst);
        update(root, recovered);
    }
}
fn state() -> &'static Mutex<Value> {
    STATE.get_or_init(|| Mutex::new(json!({"status":"idle"})))
}
fn update(root: &PathBuf, value: Value) {
    if let Ok(mut current) = state().lock() {
        *current = value.clone();
    }
    let _ = fs::write(
        root.join("automation_chain_last.json"),
        serde_json::to_vec_pretty(&value).unwrap_or_default(),
    );
}
fn snapshot(root: &PathBuf) -> Value {
    let value = state()
        .lock()
        .map(|value| value.clone())
        .unwrap_or(json!({}));
    if value["status"] == "idle" {
        if let Ok(bytes) = fs::read(root.join("automation_chain_last.json")) {
            if let Ok(mut saved) = serde_json::from_slice::<Value>(&bytes) {
                if ["running", "preparing"].contains(&saved["status"].as_str().unwrap_or("")) {
                    saved["status"] = json!("interrupted");
                    saved["error"] = json!(
                        "O agente reiniciou. Confira os resultados antes de executar novamente."
                    );
                }
                return saved;
            }
        }
    }
    value
}
fn id(value: &Value) -> Result<&str, String> {
    let id = value.as_str().unwrap_or("");
    if id.is_empty()
        || id.len() > 120
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Identificador de automação inválido.".into());
    }
    Ok(id)
}
fn source(root: &PathBuf, stage: &Value) -> Result<Vec<u8>, String> {
    let path = root
        .join("automacoes")
        .join(id(&stage["id"])?)
        .join("mapeamento_teclado.json");
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 30 * 1024 * 1024 {
        return Err("Fluxo maior que 30 MB.".into());
    }
    fs::read(path).map_err(|e| e.to_string())
}
fn fingerprint(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
fn validate_entry(stage: &Value, bytes: &[u8]) -> Result<(), String> {
    if stage["fingerprint"].as_str() != Some(fingerprint(bytes).as_str()) {
        return Err("A versão da automação mudou. Remova o processo e adicione novamente para revisar os blocos.".into());
    }
    let entry = stage["entryOrder"].as_i64().unwrap_or(0);
    if entry > 0 {
        let payload: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        let events = payload["eventos"].as_array().ok_or("Fluxo sem eventos.")?;
        if !events
            .iter()
            .any(|event| event["ordem"].as_i64() == Some(entry))
        {
            return Err("Bloco de entrada não encontrado.".into());
        }
        if events.iter().any(|event| {
            [
                "sequencia_planilha",
                "loop_inicio",
                "inicio_loop",
                "marcador_loop_inicio",
            ]
            .contains(&event["tipo"].as_str().unwrap_or(""))
        }) {
            return Err("Fluxos com loop devem iniciar pelo começo.".into());
        }
    }
    Ok(())
}
fn variables(value: &Value) -> Result<Value, String> {
    if value.is_null() {
        return Ok(json!({}));
    }
    let values = value
        .as_object()
        .ok_or("As variáveis devem ser um objeto JSON.")?;
    if values.len() > 50
        || values.iter().any(|(key, value)| {
            key.is_empty()
                || key.len() > 64
                || !key
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_.".contains(&b))
                || !value.is_string()
                || value.as_str().unwrap_or("").len() > 4096
        })
    {
        return Err(
            "Use até 50 variáveis de texto, com nomes simples e valores de até 4096 caracteres."
                .into(),
        );
    }
    Ok(value.clone())
}
fn text_overrides(bytes: &[u8], values: &Value) -> Result<String, String> {
    let payload: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let mut result = serde_json::Map::new();
    for event in payload["eventos"].as_array().ok_or("Fluxo sem eventos.")? {
        if event["tipo"] == "texto_livre" && event["detalhes"]["editavel_execucao"] == true {
            let mut text = event["texto"].as_str().unwrap_or("").to_string();
            if let Some(values) = values.as_object() {
                for (key, value) in values {
                    text = text.replace(&format!("{{{{{key}}}}}"), value.as_str().unwrap_or(""));
                }
            }
            if let Some(order) = event["ordem"].as_i64() {
                result.insert(order.to_string(), json!(text));
            }
        }
    }
    serde_json::to_string(&result).map_err(|e| e.to_string())
}
fn export_chrome(root: &PathBuf, automation_id: &str) -> Result<Value, String> {
    let transfer = root.join("chain_chrome_transfer.json");
    let exported = run_helper_json(
        root,
        &[
            "automation-export-chrome".into(),
            "--id".into(),
            automation_id.into(),
            "--destino".into(),
            transfer.to_string_lossy().into_owned(),
        ],
    )?;
    let path = exported["result"]["json_path"]
        .as_str()
        .map(PathBuf::from)
        .unwrap_or(transfer);
    if path.parent() != Some(root.as_path()) {
        return Err("Destino de exportação inesperado.".into());
    }
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&path);
    let automation: Value = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    if automation["warnings"]
        .as_array()
        .is_some_and(|warnings| !warnings.is_empty())
    {
        return Err("Exportação Chrome contém avisos ou blocos incompatíveis. Corrija o fluxo antes de encadear.".into());
    }
    Ok(automation)
}
fn validate(stages: &[Value]) -> Result<(), String> {
    if stages.is_empty() || stages.len() > 30 {
        return Err("Escolha entre 1 e 30 processos.".into());
    }
    for stage in stages {
        id(&stage["id"])?;
        if !["desktop", "chrome"].contains(&stage["engine"].as_str().unwrap_or("")) {
            return Err("Executor inválido.".into());
        }
        if stage["entryOrder"].as_i64().unwrap_or(0) < 0 {
            return Err("Bloco de entrada inválido.".into());
        }
        if stage["engine"] == "chrome" && stage["pageId"].as_str().unwrap_or("").is_empty() {
            return Err("Selecione a página Chrome de cada processo web.".into());
        }
    }
    Ok(())
}

pub(crate) fn action(app: &AppHandle, root: &PathBuf, request: Value) -> Result<Value, String> {
    match request["action"].as_str().unwrap_or("") {
        "status" => Ok(
            json!({"ok":true,"chain":snapshot(root),"chrome":chrome_test_bridge::chrome_extension_connection_status(),"active":active()}),
        ),
        "pair" => chrome_test_bridge::pair_chrome_extension(
            request["code"].as_str().unwrap_or("").to_string(),
        ),
        "pages" => chrome_test_bridge::wait_for_job(json!({"type":"chain_pages"})),
        "preview" => {
            if active() || get_remote_agent_snapshot(root)["snapshot"]["running"] == true {
                return Err("Aguarde a execução terminar para abrir outro fluxo.".into());
            }
            let automation_id = id(&request["id"])?;
            let bytes = source(root, &request)?;
            let mut preview = run_helper_json(
                root,
                &[
                    "automation-preview".into(),
                    "--id".into(),
                    automation_id.into(),
                ],
            )?;
            preview["fingerprint"] = json!(fingerprint(&bytes));
            Ok(preview)
        }
        "stop" => {
            CANCEL.store(true, Ordering::SeqCst);
            fs::write(root.join(".parar_automacao.flag"), b"stop").map_err(|e| e.to_string())?;
            let current = snapshot(root);
            if let Some(run_id) = current["chromeRunId"].as_str() {
                let _ =
                    chrome_test_bridge::wait_for_job(json!({"type":"chain_stop","runId":run_id}));
            }
            Ok(
                json!({"ok":true,"message":"Parada solicitada; aguardando confirmação do executor."}),
            )
        }
        "release" => {
            let current = snapshot(root);
            if !["needs_attention", "interrupted"]
                .contains(&current["status"].as_str().unwrap_or(""))
                || get_remote_agent_snapshot(root)["snapshot"]["running"] == true
            {
                return Err(
                    "Só libere após conferir uma execução sem confirmação e parar o executor."
                        .into(),
                );
            }
            if current["usesChrome"] == true {
                let reply = chrome_test_bridge::wait_for_job(
                    json!({"type":"chain_release","chainId":current["chainId"]}),
                )?;
                if reply["ok"] != true {
                    return Err(reply["error"]
                        .as_str()
                        .unwrap_or("Confira a extensão.")
                        .into());
                }
            }
            ACTIVE.store(false, Ordering::SeqCst);
            update(
                root,
                json!({"status":"stopped","message":"Liberado manualmente após conferência."}),
            );
            Ok(json!({"ok":true}))
        }
        "start" => {
            let mut stages = request["stages"]
                .as_array()
                .ok_or("Lista de processos inválida.")?
                .clone();
            validate(&stages)?;
            let values = variables(&request["variables"])?;
            for stage in &mut stages {
                stage["variables"] = values.clone();
            }
            if get_remote_agent_snapshot(root)["snapshot"]["running"] == true {
                return Err("O desktop do agente já está executando.".into());
            }
            ACTIVE
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .map_err(|_| "Já existe um encadeamento ativo ou aguardando conferência.")?;
            CANCEL.store(false, Ordering::SeqCst);
            update(
                root,
                json!({"status":"preparing","name":request["name"],"stages":stages,"current":0,"chainId":now_millis().to_string(),"usesChrome":stages.iter().any(|stage|stage["engine"]=="chrome")}),
            );
            let app = app.clone();
            let root = root.clone();
            thread::spawn(move || run(&app, &root, stages));
            Ok(json!({"ok":true}))
        }
        _ => Err("Ação de encadeamento desconhecida.".into()),
    }
}

fn sequential<T>(
    stages: &[T],
    mut execute: impl FnMut(usize, &T) -> Result<(), String>,
) -> Result<(), String> {
    for (index, stage) in stages.iter().enumerate() {
        execute(index, stage)?;
    }
    Ok(())
}

fn run(app: &AppHandle, root: &PathBuf, stages: Vec<Value>) {
    let mut progress = snapshot(root);
    let mut uncertain = false;
    let mut chrome_reserved = false;
    let outcome = (|| -> Result<(), String> {
        // Freeze fingerprints before any clicks. Editing a source later aborts rather than changing the run silently.
        let sources: Vec<Vec<u8>> = stages
            .iter()
            .map(|stage| source(root, stage))
            .collect::<Result<_, _>>()?;
        let mut exports = Vec::new();
        for (index, stage) in stages.iter().enumerate() {
            validate_entry(stage, &sources[index])?;
            exports.push(if stage["engine"] == "chrome" {
                Some(export_chrome(root, id(&stage["id"])?)?)
            } else {
                None
            });
        }
        if stages.iter().any(|stage| stage["engine"] == "chrome") {
            let pages = chrome_test_bridge::wait_for_job(json!({"type":"chain_pages"}))?;
            if pages["ok"] != true {
                return Err("A extensão do agente não respondeu.".into());
            }
            for stage in stages.iter().filter(|stage| stage["engine"] == "chrome") {
                if !pages["pages"].as_array().is_some_and(|items| {
                    items
                        .iter()
                        .any(|page| page["id"] == stage["pageId"] && page["tabId"].is_number())
                }) {
                    return Err("Uma página Chrome está sem aba vinculada no agente.".into());
                }
                if let Some(expected) = stage["expectedUrl"].as_str().filter(|url| !url.is_empty())
                {
                    if !expected.starts_with("http://") && !expected.starts_with("https://") {
                        return Err("Informe uma URL HTTP ou HTTPS.".into());
                    }
                }
            }
            chrome_reserved = true;
            progress["chromeReserved"] = json!(true);
            update(root, progress.clone());
            let reserved = chrome_test_bridge::wait_for_job(
                json!({"type":"chain_reserve","chainId":progress["chainId"],"stages":stages}),
            )?;
            if reserved["ok"] != true {
                chrome_reserved = false;
                progress["chromeReserved"] = json!(false);
                return Err(reserved["error"]
                    .as_str()
                    .unwrap_or("Chrome ocupado.")
                    .into());
            }
        }
        sequential(&stages, |index, stage| {
            if CANCEL.load(Ordering::SeqCst) {
                return Err("Encadeamento interrompido.".into());
            }
            if source(root, stage)? != sources[index] {
                return Err(
                    "A automação foi alterada durante o encadeamento. Revise antes de repetir."
                        .into(),
                );
            }
            progress["status"] = json!("running");
            progress["current"] = json!(index);
            progress["message"] = json!(format!(
                "Executando processo {} de {}",
                index + 1,
                stages.len()
            ));
            progress["chromeRunId"] = Value::Null;
            update(root, progress.clone());
            let timeout = stage["timeoutSeconds"]
                .as_u64()
                .unwrap_or(1800)
                .clamp(30, 86400);
            let deadline = Instant::now() + Duration::from_secs(timeout);
            let automation_id = id(&stage["id"])?;
            if stage["engine"] == "desktop" {
                uncertain = true;
                let overrides = text_overrides(&sources[index], &stage["variables"])?;
                execute_remote_automation(
                    app,
                    root,
                    automation_id,
                    1.0,
                    1,
                    None,
                    true,
                    Some(overrides),
                    stage["entryOrder"].as_i64(),
                )?;
                let mut stopping: Option<Instant> = None;
                loop {
                    let snapshot = get_remote_agent_snapshot(root);
                    if snapshot["snapshot"]["automation_id"] != automation_id {
                        return Err("Outra execução substituiu o contexto do agente.".into());
                    }
                    if snapshot["snapshot"]["running"] != true {
                        uncertain = false;
                        if CANCEL.load(Ordering::SeqCst)
                            || snapshot["snapshot"]["progress"]["percent"] != 100
                        {
                            return Err("O processo desktop falhou ou foi interrompido.".into());
                        }
                        break;
                    }
                    if CANCEL.load(Ordering::SeqCst) || Instant::now() > deadline {
                        CANCEL.store(true, Ordering::SeqCst);
                        let _ = fs::write(root.join(".parar_automacao.flag"), b"stop");
                        let requested = stopping.get_or_insert_with(Instant::now);
                        if requested.elapsed() > Duration::from_secs(15) {
                            return Err("Parada solicitada ao desktop. Confira o agente antes de liberar uma nova execução.".into());
                        }
                    }
                    thread::sleep(Duration::from_millis(500));
                }
            } else {
                let mut automation = exports[index].clone().ok_or("Exportação Chrome ausente.")?;
                automation["chain_variables"] = stage["variables"].clone();
                uncertain = true;
                let started = chrome_test_bridge::wait_for_job(
                    json!({"type":"chain_start","chainId":progress["chainId"],"automation":automation,"pageId":stage["pageId"],"entryOrder":stage["entryOrder"],"expectedUrl":stage["expectedUrl"]}),
                )?;
                if started["ok"] != true {
                    uncertain = false;
                    return Err(started["error"]
                        .as_str()
                        .unwrap_or("Chrome recusou o início.")
                        .into());
                }
                let run_id = started["runId"]
                    .as_str()
                    .ok_or("Chrome não confirmou o identificador de execução.")?;
                progress["chromeRunId"] = json!(run_id);
                update(root, progress.clone());
                let mut stopping: Option<Instant> = None;
                loop {
                    if CANCEL.load(Ordering::SeqCst) || Instant::now() > deadline {
                        CANCEL.store(true, Ordering::SeqCst);
                        if stopping.is_none() {
                            chrome_test_bridge::wait_for_job(
                                json!({"type":"chain_stop","runId":run_id}),
                            )?;
                            stopping = Some(Instant::now());
                        }
                        if stopping.is_some_and(|time| time.elapsed() > Duration::from_secs(15)) {
                            return Err("Parada enviada ao Chrome. Confira a aba antes de liberar outra execução.".into());
                        }
                    }
                    thread::sleep(Duration::from_secs(1));
                    let status = chrome_test_bridge::wait_for_job(
                        json!({"type":"chain_status","runId":run_id}),
                    )?;
                    if status["ok"] != true {
                        return Err(status["error"]
                            .as_str()
                            .unwrap_or("Perda da confirmação do Chrome.")
                            .into());
                    }
                    progress["chromeProgress"] = status["run"].clone();
                    update(root, progress.clone());
                    match status["run"]["status"].as_str().unwrap_or("") {
                        "completed" => {
                            uncertain = false;
                            if CANCEL.load(Ordering::SeqCst) {
                                return Err(
                                    "Encadeamento interrompido após concluir o processo atual."
                                        .into(),
                                );
                            }
                            break;
                        }
                        "failed" | "stopped" => {
                            uncertain = false;
                            return Err("O processo Chrome falhou ou foi interrompido.".into());
                        }
                        _ => {}
                    }
                }
            }
            progress["stages"][index]["status"] = json!("completed");
            update(root, progress.clone());
            Ok(())
        })?;
        Ok(())
    })();
    if uncertain {
        let _ = fs::write(root.join(".parar_automacao.flag"), b"stop");
    }
    if !uncertain && chrome_reserved {
        if let Err(error) = chrome_test_bridge::wait_for_job(
            json!({"type":"chain_release","chainId":progress["chainId"]}),
        )
        .and_then(|reply| {
            if reply["ok"] == true {
                Ok(())
            } else {
                Err(reply["error"]
                    .as_str()
                    .unwrap_or("Reserva Chrome sem confirmação.")
                    .to_string())
            }
        }) {
            uncertain = true;
            progress["releaseError"] = json!(error);
        }
    }
    progress["status"] = json!(if uncertain {
        "needs_attention"
    } else if outcome.is_ok() {
        "completed"
    } else if CANCEL.load(Ordering::SeqCst) {
        "stopped"
    } else {
        "failed"
    });
    progress["error"] = json!(outcome.err());
    update(root, progress);
    if !uncertain {
        ACTIVE.store(false, Ordering::SeqCst);
    }
}

// A private per-process directory is inherited by the Python child. No unauthenticated network endpoint.
pub(crate) fn serve_map_bridge(root: &PathBuf, folder: &PathBuf, finished: Arc<AtomicBool>) {
    while !finished.load(Ordering::SeqCst) {
        let pending = folder.join("request.json");
        if pending.exists() && fs::rename(&pending, folder.join("processing.json")).is_ok() {
            let result = (|| -> Result<Value, String> {
                let bytes = fs::read(folder.join("processing.json")).map_err(|e| e.to_string())?;
                let request: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                let outer = active();
                let chain_id = if outer {
                    snapshot(root)["chainId"].as_str().unwrap_or("").to_string()
                } else {
                    format!("map-{}", now_millis())
                };
                let pages = chrome_test_bridge::wait_for_job(json!({"type":"chain_pages"}))?;
                let items = pages["pages"]
                    .as_array()
                    .ok_or("A extensao nao retornou paginas.")?;
                let wanted = request["pageId"].as_str().unwrap_or("1");
                let page = items
                    .iter()
                    .find(|page| page["id"] == wanted)
                    .or_else(|| {
                        wanted
                            .parse::<usize>()
                            .ok()
                            .and_then(|i| i.checked_sub(1))
                            .and_then(|i| items.get(i))
                    })
                    .ok_or("Pagina Chrome nao encontrada no agente.")?;
                let stage = json!({"engine":"chrome","pageId":page["id"]});
                let reserve = chrome_test_bridge::wait_for_job(
                    json!({"type":"chain_reserve","chainId":chain_id,"stages":[stage]}),
                ).map_err(|error|{
                    if !outer {
                        ACTIVE.store(true,Ordering::SeqCst);
                        update(root,json!({"status":"needs_attention","usesChrome":true,"chainId":chain_id,"error":"A reserva do caminho Chrome nao foi confirmada. Confira a extensao antes de liberar."}));
                    }
                    error
                })?;
                if reserve["ok"] != true {
                    return Err(reserve["error"]
                        .as_str()
                        .unwrap_or("Chrome ocupado.")
                        .into());
                }
                let mut execution_id = Value::Null;
                let outcome = (|| -> Result<Value, String> {
                    let start = chrome_test_bridge::wait_for_job(
                        json!({"type":"chain_start","chainId":chain_id,"pageId":page["id"],"automation":request["automation"],"entryOrder":request["entryOrder"]}),
                    )?;
                    if start["ok"] != true {
                        return Err(start["error"]
                            .as_str()
                            .unwrap_or("Chrome recusou o caminho.")
                            .into());
                    }
                    let run_id = start["runId"]
                        .as_str()
                        .ok_or("Chrome sem identificador de execucao.")?;
                    execution_id = json!(run_id);
                    let deadline = Instant::now() + Duration::from_secs(1800);
                    let mut stopping = None;
                    loop {
                        if finished.load(Ordering::SeqCst)
                            || root.join(".parar_automacao.flag").exists()
                            || Instant::now() > deadline
                        {
                            if stopping.is_none() {
                                let _ = chrome_test_bridge::wait_for_job(
                                    json!({"type":"chain_stop","runId":run_id}),
                                );
                                stopping = Some(Instant::now());
                            }
                            if stopping
                                .is_some_and(|at: Instant| at.elapsed() > Duration::from_secs(15))
                            {
                                return Err(
                                    "Chrome sem confirmacao de parada. Confira a aba.".into()
                                );
                            }
                        }
                        let status = chrome_test_bridge::wait_for_job(
                            json!({"type":"chain_status","runId":run_id}),
                        )?;
                        if status["ok"] != true {
                            return Err(status["error"]
                                .as_str()
                                .unwrap_or("Chrome sem confirmacao.")
                                .into());
                        }
                        match status["run"]["status"].as_str().unwrap_or("") {
                            "completed" if stopping.is_none() => {
                                return Ok(json!({"ok":true,"exit":status["run"]["mapExit"]}))
                            }
                            "completed" | "failed" | "stopped" => {
                                return Err("O caminho Chrome falhou ou foi interrompido.".into())
                            }
                            _ => thread::sleep(Duration::from_millis(500)),
                        }
                    }
                })();
                if !outer {
                    let release = chrome_test_bridge::wait_for_job(
                        json!({"type":"chain_release","chainId":chain_id}),
                    );
                    if !release.as_ref().is_ok_and(|reply| reply["ok"] == true) {
                        ACTIVE.store(true, Ordering::SeqCst);
                        update(
                            root,
                            json!({"status":"needs_attention","usesChrome":true,"chainId":chain_id,"chromeRunId":execution_id,"error":"Confira o Chrome do agente antes de liberar outra execucao."}),
                        );
                        return Err("A reserva Chrome nao foi liberada. Confira o agente.".into());
                    }
                }
                outcome
            })();
            let reply = result.unwrap_or_else(|error| json!({"ok":false,"error":error}));
            if let Ok(bytes) = serde_json::to_vec(&reply) {
                let temporary = folder.join("reply.tmp");
                if fs::write(&temporary, bytes).is_ok() {
                    let _ = fs::rename(temporary, folder.join("reply.json"));
                }
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    for name in [
        "request.json",
        "processing.json",
        "reply.json",
        "request.tmp",
        "reply.tmp",
    ] {
        let _ = fs::remove_file(folder.join(name));
    }
    let _ = fs::remove_dir(folder);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unsafe_ids_and_missing_chrome_page() {
        assert!(validate(&[json!({"id":"../escape","engine":"desktop"})]).is_err());
        assert!(validate(&[json!({"id":"flow-1","engine":"chrome"})]).is_err());
        assert!(validate(&[json!({"id":"flow-1","engine":"desktop","entryOrder":4})]).is_ok());
        assert!(validate(&[]).is_err());
    }
    #[test]
    fn sequencing_waits_for_each_stage_and_aborts_after_failure() {
        let mut executed = Vec::new();
        let error = sequential(&["desktop", "chrome", "desktop-2"], |_, engine| {
            executed.push(*engine);
            if *engine == "chrome" {
                Err("Chrome falhou".into())
            } else {
                Ok(())
            }
        });
        assert!(error.is_err());
        assert_eq!(executed, vec!["desktop", "chrome"]);
        let mut completed = Vec::new();
        sequential(&["desktop", "chrome"], |_, engine| {
            completed.push(*engine);
            Ok(())
        })
        .unwrap();
        assert_eq!(completed, vec!["desktop", "chrome"]);
    }
    #[test]
    fn changed_reviewed_source_or_loop_entry_is_rejected() {
        let bytes = br#"{"eventos":[{"ordem":3,"tipo":"texto_livre"}]}"#;
        let stage = json!({"entryOrder":3,"fingerprint":fingerprint(bytes)});
        assert!(validate_entry(&stage, bytes).is_ok());
        assert!(validate_entry(
            &json!({"entryOrder":4,"fingerprint":fingerprint(bytes)}),
            bytes
        )
        .is_err());
        assert!(validate_entry(&stage, br#"{"eventos":[]}"#).is_err());
        let looped = br#"{"eventos":[{"ordem":3,"tipo":"sequencia_planilha"}]}"#;
        assert!(validate_entry(
            &json!({"entryOrder":3,"fingerprint":fingerprint(looped)}),
            looped
        )
        .is_err());
    }
    #[test]
    fn shared_variables_only_replace_editable_texts() {
        let bytes=br#"{"eventos":[{"ordem":1,"tipo":"texto_livre","texto":"Empresa {{empresa}}","detalhes":{"editavel_execucao":true}},{"ordem":2,"tipo":"texto_livre","texto":"Nao editar","detalhes":{}}]}"#;
        let result: Value =
            serde_json::from_str(&text_overrides(bytes, &json!({"empresa":"330"})).unwrap())
                .unwrap();
        assert_eq!(result, json!({"1":"Empresa 330"}));
        assert!(variables(&json!({"empresa":330})).is_err());
        assert!(variables(&json!({"empresa":"330"})).is_ok());
    }
}
