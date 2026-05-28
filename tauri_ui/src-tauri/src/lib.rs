use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter, Manager, State};

struct RuntimeState {
    child: Arc<Mutex<Option<Child>>>,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    current: i32,
    total: i32,
    percent: f64,
    description: String,
    company: String,
}

#[derive(Serialize, Clone)]
struct LogPayload {
    message: String,
}

#[derive(Serialize, Clone)]
struct FinishedPayload {
    code: i32,
    success: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct LoopDataRow {
    row_number: i32,
    value: String,
    company: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct LoopDataPayload {
    sheet: String,
    column: String,
    company_column: String,
    origin: String,
    rows: Vec<LoopDataRow>,
}

#[derive(Serialize, Deserialize, Clone)]
struct TextInputItem {
    order: i32,
    text: String,
    preview: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct TextInputsPayload {
    items: Vec<TextInputItem>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AutomationConfigPayload {
    name: String,
}

fn runtime_markers_present(path: &PathBuf) -> bool {
    path.join("executar_automacao.py").exists()
        && path.join("mapeamento_teclado.json").exists()
        && path.join("db.xlsx").exists()
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

fn load_automation_config(root: &PathBuf) -> AutomationConfigPayload {
    let config_path = root.join("automacao_config.json");
    if let Ok(text) = std::fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<AutomationConfigPayload>(&text) {
            if !config.name.trim().is_empty() {
                return config;
            }
        }
    }

    AutomationConfigPayload {
        name: "Geracao de ISS Saida e Tomador todas as empresas".to_string(),
    }
}

fn python_command(root: &PathBuf) -> Result<(String, Vec<String>), String> {
    let candidates = [
        ("python", Vec::<String>::new()),
        ("py", vec!["-3".to_string()]),
    ];

    for (program, args) in candidates {
        let probe = Command::new(program)
            .args(&args)
            .arg("--version")
            .current_dir(root)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if probe.map(|status| status.success()).unwrap_or(false) {
            return Ok((program.to_string(), args));
        }
    }

    Err("Nenhum interpretador Python compativel foi encontrado.".to_string())
}

fn run_python_script(
    root: &PathBuf,
    script_name: &str,
    extra_args: &[String],
) -> Result<String, String> {
    let script_path = root.join(script_name);
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }

    let (python_program, python_args) = python_command(root)?;
    let output = Command::new(&python_program)
        .current_dir(root)
        .args(&python_args)
        .arg(&script_path)
        .args(extra_args)
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

fn emit_log(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit("automation-log", LogPayload {
        message: message.into(),
    });
}

fn parse_progress(line: &str) -> Option<ProgressPayload> {
    if !line.starts_with("PROGRESS|") {
        return None;
    }

    let parts: Vec<&str> = line.splitn(6, '|').collect();
    if parts.len() != 6 {
        return None;
    }

    Some(ProgressPayload {
        current: parts[1].parse().ok()?,
        total: parts[2].parse().ok()?,
        percent: parts[3].parse().ok()?,
        description: parts[4].to_string(),
        company: parts[5].to_string(),
    })
}

#[tauri::command]
fn start_automation(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    mode: String,
    delay: f64,
    loop_start: i32,
) -> Result<(), String> {
    let mut child_slot = state
        .child
        .lock()
        .map_err(|_| "Falha no estado interno.".to_string())?;
    if child_slot.is_some() {
        return Err("Ja existe uma automacao em andamento.".into());
    }

    let root = workspace_root(&app);
    let python_script = root.join("executar_automacao.py");
    if !python_script.exists() {
        return Err(format!(
            "Arquivo nao encontrado: {}",
            python_script.display()
        ));
    }

    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));
    let (python_program, python_args) = python_command(&root)?;

    let mut command = Command::new(&python_program);
    command.current_dir(&root);
    for arg in python_args {
        command.arg(arg);
    }

    let mut child = command
        .arg(&python_script)
        .arg("--modo")
        .arg(mode)
        .arg("--atraso")
        .arg(delay.to_string())
        .arg("--loop-start")
        .arg(loop_start.max(1).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Falha ao iniciar a automacao: {err}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Nao foi possivel capturar a saida da automacao.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Nao foi possivel capturar os erros da automacao.".to_string())?;

    *child_slot = Some(child);
    drop(child_slot);

    let app_stdout = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if let Some(payload) = parse_progress(&line) {
                let _ = app_stdout.emit("automation-progress", payload);
            } else {
                emit_log(&app_stdout, line);
            }
        }
    });

    let app_stderr = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            emit_log(&app_stderr, line);
        }
    });

    let app_wait = app.clone();
    let child_wait = state.child.clone();
    thread::spawn(move || {
        let code = if let Ok(mut slot) = child_wait.lock() {
            if let Some(child) = slot.as_mut() {
                child.wait().ok().and_then(|s| s.code()).unwrap_or(1)
            } else {
                1
            }
        } else {
            1
        };

        if let Ok(mut slot) = child_wait.lock() {
            slot.take();
        }

        let _ = app_wait.emit(
            "automation-finished",
            FinishedPayload {
                code,
                success: code == 0,
            },
        );
    });

    Ok(())
}

#[tauri::command]
fn stop_automation(app: AppHandle, state: State<'_, RuntimeState>) -> Result<(), String> {
    let root = workspace_root(&app);
    let flag = root.join(".parar_automacao.flag");
    std::fs::write(&flag, "parar").map_err(|err| format!("Falha ao criar arquivo de parada: {err}"))?;

    if let Ok(mut slot) = state.child.lock() {
        if let Some(child) = slot.as_mut() {
            let _ = child.kill();
        }
    }

    emit_log(&app, "Pedido de parada enviado.");
    Ok(())
}

#[tauri::command]
fn get_runtime_root(app: AppHandle) -> String {
    workspace_root(&app).display().to_string()
}

#[tauri::command]
fn get_automation_config(app: AppHandle) -> AutomationConfigPayload {
    let root = workspace_root(&app);
    load_automation_config(&root)
}

#[tauri::command]
fn get_loop_data(app: AppHandle) -> Result<LoopDataPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(&root, "gerenciar_dados_planilha.py", &[String::from("listar")])?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os dados do loop: {err}"))
}

#[tauri::command]
fn add_loop_data_value(app: AppHandle, value: String, company: String) -> Result<LoopDataPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[
            String::from("adicionar"),
            String::from("--valor"),
            value,
            String::from("--empresa"),
            company,
        ],
    )?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os dados atualizados: {err}"))
}

#[tauri::command]
fn remove_loop_data_row(app: AppHandle, row_number: i32) -> Result<LoopDataPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[
            String::from("remover"),
            String::from("--linha"),
            row_number.to_string(),
        ],
    )?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os dados atualizados: {err}"))
}

#[tauri::command]
fn move_loop_data_row(
    app: AppHandle,
    row_number: i32,
    direction: String,
) -> Result<LoopDataPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[
            String::from("mover"),
            String::from("--linha"),
            row_number.to_string(),
            String::from("--direcao"),
            direction,
        ],
    )?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os dados atualizados: {err}"))
}

#[tauri::command]
fn get_text_inputs(app: AppHandle) -> Result<TextInputsPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[String::from("listar_textos")],
    )?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os textos livres: {err}"))
}

#[tauri::command]
fn update_text_input(app: AppHandle, order: i32, text: String) -> Result<TextInputsPayload, String> {
    let root = workspace_root(&app);
    let output = run_python_script(
        &root,
        "gerenciar_dados_planilha.py",
        &[
            String::from("atualizar_texto"),
            String::from("--ordem"),
            order.to_string(),
            String::from("--texto"),
            text,
        ],
    )?;
    serde_json::from_str(&output).map_err(|err| format!("Falha ao interpretar os textos atualizados: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            start_automation,
            stop_automation,
            get_runtime_root,
            get_automation_config,
            get_loop_data,
            add_loop_data_value,
            remove_loop_data_row,
            move_loop_data_row,
            get_text_inputs,
            update_text_input
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar app tauri");
}
