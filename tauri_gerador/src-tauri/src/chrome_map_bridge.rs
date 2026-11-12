//! Executes a Chrome section of the command map. The chain_* names are
//! legacy extension wire-protocol messages, shared with ordinary map execution.
//! This module has no saved chains, stage orchestration or dedicated chain API.
use super::*;
use serde_json::json;
use std::time::Instant;

// A private per-process directory is inherited by the Python child. No unauthenticated network endpoint.
pub(crate) fn serve_map_bridge(root: &PathBuf, folder: &PathBuf, finished: Arc<AtomicBool>) {
    while !finished.load(Ordering::SeqCst) {
        let pending = folder.join("request.json");
        if pending.exists() && fs::rename(&pending, folder.join("processing.json")).is_ok() {
            let result = (|| -> Result<Value, String> {
                let bytes = fs::read(folder.join("processing.json")).map_err(|e| e.to_string())?;
                let request: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                let chain_id = format!("map-{}", now_millis());
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
                )?;
                if reserve["ok"] != true {
                    return Err(reserve["error"]
                        .as_str()
                        .unwrap_or("Chrome ocupado.")
                        .into());
                }
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
                                return Ok(json!({"ok":true,"exit":status["run"]["mapExit"],"variables":status["run"]["capturedVariables"]}))
                            }
                            "completed" | "failed" | "stopped" => {
                                return Err("O caminho Chrome falhou ou foi interrompido.".into())
                            }
                            _ => thread::sleep(Duration::from_millis(500)),
                        }
                    }
                })();
                {
                    let release = chrome_test_bridge::wait_for_job(
                        json!({"type":"chain_release","chainId":chain_id}),
                    );
                    if !release.as_ref().is_ok_and(|reply| reply["ok"] == true) {
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
