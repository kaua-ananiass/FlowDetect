use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter, Manager, State};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

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

fn newest_timestamp(paths: &[PathBuf]) -> Option<std::time::SystemTime> {
    paths.iter()
        .filter_map(|path| fs::metadata(path).ok())
        .filter_map(|metadata| metadata.modified().ok())
        .max()
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
            .output();
        if probe.map(|out| out.status.success()).unwrap_or(false) {
            return Ok((program.to_string(), args));
        }
    }

    Err("Nenhum interpretador Python compativel foi encontrado.".to_string())
}

fn run_python_script(root: &PathBuf, script_name: &str, extra_args: &[String]) -> Result<String, String> {
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

fn run_helper_json(root: &PathBuf, args: &[String]) -> Result<Value, String> {
    let raw = run_python_script(root, "gerenciar_roteiro.py", args)?;
    serde_json::from_str(&raw).map_err(|err| format!("Falha ao interpretar retorno do gerador: {err}"))
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
        append_launcher_log(&root, format!("ERRO: executor nao encontrado em {}", script_path.display()));
        return Err(format!(
            "Nenhum executor de automacao foi encontrado. Esperado: {}",
            script_path.display()
        ));
    }

    let (python_program, python_args) = python_command(&root)?;
    append_launcher_log(
        &root,
        format!("Python detectado: {} {}", python_program, python_args.join(" ")),
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

    if let Some(title) = window_title.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        command.arg("--janela-alvo").arg(title);
    }

    if mode == "loop" {
        command.arg("--loop-start").arg(loop_start.max(1).to_string());
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
    let parsed: Value =
        serde_json::from_str(&raw).map_err(|err| format!("Falha ao interpretar retorno de {script_name}: {err}"))?;

    if let Some(message) = parsed.get("erro").and_then(Value::as_str) {
        return Err(message.to_string());
    }

    Ok(parsed)
}

fn copy_if_exists(source: &Path, destination: &Path, copied: &mut Vec<String>, missing: &mut Vec<String>) {
    if source.exists() {
        if let Some(parent) = destination.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if fs::copy(source, destination).is_ok() {
            copied.push(destination.file_name().unwrap_or_default().to_string_lossy().to_string());
        }
    } else {
        missing.push(source.file_name().unwrap_or_default().to_string_lossy().to_string());
    }
}

fn automation_launcher() -> String {
    [
        "@echo off",
        "setlocal",
        "cd /d \"%~dp0\"",
        "",
        "if not exist \"Automacao.exe\" (",
        "    echo Arquivo Automacao.exe nao encontrado nesta pasta.",
        "    pause",
        "    endlocal",
        "    exit /b 1",
        ")",
        "",
        "start \"\" \"%~dp0Automacao.exe\"",
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
        "- executar_automacao.bat: abre a interface da automacao.",
        "- Automacao.exe: painel visual em Tauri com HTML/CSS, quando disponivel.",
        "- interface_automacao.py: fallback visual em Python com progresso e empresa atual.",
        "- executar_automacao.py: executor separado do roteiro gravado.",
        "- gerenciar_dados_planilha.py: utilitario para listar e editar os itens do loop na planilha.",
        "- mapeamento_teclado.json: roteiro completo salvo pela interface.",
        "- db.xlsx: planilha usada para ler os dados mais recentes.",
        "- imagens/: referencias usadas pelos blocos de clicar por imagem.",
        "",
        "Como usar:",
        "1. Edite a planilha db.xlsx se precisar atualizar os dados.",
        "2. Clique duas vezes em executar_automacao.bat.",
        "3. Ajuste o atraso inicial na interface da automacao.",
        "4. Acompanhe a barra de porcentagem e a empresa atual durante a execucao.",
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
        "O programa principal do projeto continua separado no main.py.",
        "",
        "Arquivos principais desta pasta:",
        "- iniciar.bat: abre a interface principal da automacao.",
        "- Automacao.exe: interface visual da automacao.",
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
        "- Esta exportacao foi pensada para sair com interface propria da automacao.",
        "- O Python precisa estar instalado no Windows para a parte de execucao funcionar.",
    ]
    .join("\n")
}

fn configure_background_process(command: &mut Command) {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        command.creation_flags(0x08000000);
    }
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
        current: parts.next().and_then(|value| value.parse().ok()).unwrap_or(0),
        total: parts.next().and_then(|value| value.parse().ok()).unwrap_or(0),
        percent: parts.next().and_then(|value| value.parse().ok()).unwrap_or(0.0),
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
        return Err("Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.".into());
    }

    let root = workspace_root(app);
    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));
    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(&root, format!("Iniciando processo de teste: {error_context}"));

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

    append_launcher_log(&root, format!("Processo iniciado com sucesso: {error_context}"));
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

            child.wait().ok().and_then(|status| status.code()).unwrap_or(-1)
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
fn get_test_execution_state(state: State<'_, RuntimeState>) -> Result<TestExecutionPayload, String> {
    let running = state
        .running
        .lock()
        .map_err(|_| "Falha no estado interno da execucao.".to_string())?
        .to_owned();
    Ok(TestExecutionPayload { running })
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
    let opened = run_helper_json(&root, &["automation-open".into(), "--id".into(), id.clone()])?;
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
    fs::create_dir_all(&planilhas_dir).map_err(|err| format!("Falha ao criar pasta planilhas: {err}"))?;

    let sanitized_name = sanitize_workbook_filename(&file_name);
    let destino = planilhas_dir.join(&sanitized_name);
    fs::write(&destino, bytes).map_err(|err| format!("Falha ao salvar planilha importada: {err}"))?;

    Ok(serde_json::json!({
        "saved": destino.display().to_string(),
        "workbook_id": format!("planilhas/{}", sanitized_name),
    }))
}

#[tauri::command]
fn import_image_asset(app: AppHandle, file_name: String, bytes: Vec<u8>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let imagens_dir = root.join("imagens");
    fs::create_dir_all(&imagens_dir).map_err(|err| format!("Falha ao criar pasta imagens: {err}"))?;

    let sanitized_name = sanitize_asset_filename(&file_name, "imagem.png");
    let destino = imagens_dir.join(&sanitized_name);
    fs::write(&destino, bytes).map_err(|err| format!("Falha ao salvar imagem importada: {err}"))?;

    Ok(serde_json::json!({
        "saved": destino.display().to_string(),
        "image_id": format!("imagens/{}", sanitized_name),
    }))
}

fn append_success_flow_args(args: &mut Vec<String>, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) {
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
}

#[tauri::command]
fn capture_mouse_click(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_script_json(&root, "capturar_mouse_global.py", &[])
}

#[tauri::command]
fn add_text_block(app: AppHandle, text: String, delay: f64, sequencia: Option<String>, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) -> Result<Value, String> {
    let root = workspace_root(&app);
    let mut args = vec!["add-text".into(), "--text".into(), text, "--delay".into(), delay.to_string()];
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_key_block(app: AppHandle, keys: String, repeat: i32, delay: f64, sequencia: Option<String>, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) -> Result<Value, String> {
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
    run_helper_json(&root, &args)
}

#[tauri::command]
fn add_mouse_block(app: AppHandle, x: i32, y: i32, button: String, clicks: i32, delay: f64, sequencia: Option<String>, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) -> Result<Value, String> {
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
    run_helper_json(&root, &args)
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
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    sequencia: Option<String>,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
        "--ao-nao-encontrar".into(),
        ao_nao_encontrar,
    ];
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_falhar: String,
    bloco_falha: Option<i32>,
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
        serde_json::to_string(&elemento).map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
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
    if let Some(sequence_name) = sequencia {
        args.push("--sequencia".into());
        args.push(sequence_name);
    }
    run_helper_json(&root, &args)
}

#[tauri::command]
fn insert_text_block(
    app: AppHandle,
    target_order: i32,
    position: String,
    text: String,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
            "--ao-nao-encontrar".into(),
            ao_nao_encontrar,
    ];
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
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_falhar: String,
    bloco_falha: Option<i32>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
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
        serde_json::to_string(&elemento).map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
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
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_text_block(app: AppHandle, order: i32, text: String, delay: f64, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) -> Result<Value, String> {
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
    run_helper_json(&root, &args)
}

#[tauri::command]
fn update_key_block(app: AppHandle, order: i32, keys: String, repeat: i32, delay: f64, ao_sucesso: Option<String>, bloco_sucesso: Option<i32>) -> Result<Value, String> {
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_nao_encontrar: String,
    sequencia_nao_encontrar: Option<String>,
    bloco_nao_encontrar: Option<i32>,
    quantidade_tentativas: i32,
    intervalo_tentativas: f64,
    delay: f64,
    ao_sucesso: Option<String>,
    bloco_sucesso: Option<i32>,
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
            "--ao-nao-encontrar".into(),
            ao_nao_encontrar,
    ];
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
    args.extend([
        "--quantidade-tentativas".into(),
        quantidade_tentativas.max(1).to_string(),
        "--intervalo-tentativas".into(),
        intervalo_tentativas.max(0.0).to_string(),
        "--delay".into(),
        delay.to_string(),
    ]);
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    append_success_flow_args(&mut args, ao_sucesso, bloco_sucesso);
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
    ao_falhar: String,
    bloco_falha: Option<i32>,
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
        serde_json::to_string(&elemento).map_err(|err| format!("Falha ao serializar elemento: {err}"))?,
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
        &[
            "remove".into(),
            "--order".into(),
            order.to_string(),
        ],
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
    Command::new(&python_program)
        .current_dir(&root)
        .args(&python_args)
        .arg(&script_path)
        .spawn()
        .map_err(|err| format!("Falha ao abrir a captura avancada: {err}"))?;

    Ok("Captura avancada aberta em uma nova janela.".into())
}

#[tauri::command]
fn test_image_recognition(
    app: AppHandle,
    imagem: String,
    timeout: f64,
    confianca: f64,
    perfil_busca: Option<String>,
    janela_alvo: Option<String>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        return Err(format!("Arquivo nao encontrado: {}", script_path.display()));
    }

    let _ = std::fs::remove_file(root.join(".parar_automacao.flag"));

    let (python_program, python_args) = python_command(&root)?;
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

    if let Some(title) = janela_alvo.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        command.arg("--janela-alvo").arg(title);
    }

    let main_window = app.get_webview_window("main");
    if let Some(window) = main_window.as_ref() {
        let _ = window.minimize();
    }

    let output = command
        .output()
        .map_err(|err| format!("Falha ao iniciar o teste de reconhecimento: {err}"))?;

    if let Some(window) = main_window.as_ref() {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        return Ok(if stdout.is_empty() {
            "Reconhecimento concluido com sucesso.".into()
        } else {
            stdout
        });
    }

    let message = if !stderr.is_empty() { stderr } else { stdout };
    Err(if message.is_empty() {
        "Falha ao testar o reconhecimento.".into()
    } else {
        message
    })
}

#[tauri::command]
fn analyze_html_element(app: AppHandle, html: String) -> Result<Value, String> {
    let root = workspace_root(&app);
    run_helper_json(
        &root,
        &[
            "analyze-html-element".into(),
            "--html".into(),
            html,
        ],
    )
}

#[tauri::command]
fn get_test_loop_data(app: AppHandle) -> Result<Value, String> {
    let root = workspace_root(&app);
    let raw = run_python_script(&root, "gerenciar_dados_planilha.py", &[String::from("listar")])?;
    serde_json::from_str(&raw).map_err(|err| format!("Falha ao interpretar os dados do loop: {err}"))
}

#[tauri::command]
fn launch_quick_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    window_title: Option<String>,
    _minimize_window: Option<bool>,
) -> Result<String, String> {
    let root = workspace_root(&app);
    let _ = std::fs::remove_file(root.join("ultimo_log_launcher.txt"));
    append_launcher_log(&root, format!("launch_quick_test chamado | delay={}", delay.max(0.0)));

    let script_path = root.join("executar_automacao.py");
    if !script_path.exists() {
        append_launcher_log(&root, format!("ERRO: executor nao encontrado em {}", script_path.display()));
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
        .arg("normal")
        .arg("--atraso")
        .arg(delay.max(0.0).to_string())
        .arg("--arquivo")
        .arg(root.join("mapeamento_teclado.json"))
        .arg("--planilha")
        .arg(root.join("db.xlsx"))
        .arg("--cancelamento-arquivo")
        .arg(root.join(".parar_automacao.flag"));

    if let Some(title) = window_title.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        command.arg("--janela-alvo").arg(title);
    }

    spawn_test_process(
        &app,
        &state,
        command,
        format!(
            "Teste simples iniciado no proprio launcher. A automacao vai executar uma vez com atraso inicial de {}s.",
            delay.max(0.0),
        ),
        "o teste simples",
    )
}

#[tauri::command]
fn launch_assisted_quick_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    window_title: Option<String>,
) -> Result<String, String> {
    launch_quick_test(app, state, delay, window_title, Some(false))
}

#[tauri::command]
fn launch_test_automation(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    loop_start: i32,
    window_title: Option<String>,
    _minimize_window: Option<bool>,
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
        append_launcher_log(&root, format!("ERRO: executor nao encontrado em {}", script_path.display()));
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

    if let Some(title) = window_title.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        command.arg("--janela-alvo").arg(title);
    }

    spawn_test_process(
        &app,
        &state,
        command,
        format!(
            "Teste com loop iniciado no proprio launcher. O executor vai procurar a linha {} com atraso inicial de {}s.",
            loop_start.max(1),
            delay.max(0.0),
        ),
        "o teste direto com loop",
    )
}

#[tauri::command]
fn launch_assisted_loop_test(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    delay: f64,
    loop_start: i32,
    window_title: Option<String>,
) -> Result<String, String> {
    launch_test_automation(app, state, delay, loop_start, window_title, Some(false))
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
        append_launcher_log(&root, "Parada solicitada pelo launcher com encerramento forcado do processo.");
        return Ok("Parada forcada enviada. A automacao foi interrompida imediatamente.".into());
    }

    append_launcher_log(&root, "Parada solicitada pelo launcher.");
    Ok("Parada solicitada. A automacao vai encerrar no proximo ponto seguro.".into())
}

#[tauri::command]
fn export_automation_bundle(app: AppHandle, automation_name: String) -> Result<ExportResult, String> {
    let root = workspace_root(&app);
    let normalized_name = normalize_automation_name(&automation_name);
    let export_folder_name = sanitize_export_folder_name(&normalized_name);
    let build_dir = root.join("build_automacao");
    let export_dir = root.join(&export_folder_name);
    fs::create_dir_all(&build_dir).map_err(|err| format!("Falha ao criar build_automacao: {err}"))?;
    fs::create_dir_all(&export_dir)
        .map_err(|err| format!("Falha ao criar pasta da automacao {export_folder_name}: {err}"))?;

    let files = [
        "mapeamento_teclado.json",
        "resumo_teclado.txt",
        "comandos_teclado.py",
        "db.xlsx",
        "executar_automacao.py",
        "executar_automacao.bat",
        "interface_automacao.py",
        "gerenciar_dados_planilha.py",
        "requirements.txt",
    ];

    let built_exe_candidates = [
        root.join("tauri_ui").join("src-tauri").join("target").join("release").join("Automacao.exe"),
        root.join("tauri_ui").join("src-tauri").join("target").join("release").join("automacao_tauri_ui.exe"),
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
        for entry in fs::read_dir(&planilhas_dir).map_err(|err| format!("Falha ao ler pasta planilhas: {err}"))? {
            let entry = entry.map_err(|err| format!("Falha ao ler item da pasta planilhas: {err}"))?;
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
        for entry in fs::read_dir(&imagens_dir).map_err(|err| format!("Falha ao ler pasta imagens: {err}"))? {
            let entry = entry.map_err(|err| format!("Falha ao ler item da pasta imagens: {err}"))?;
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

    let ui_source_files = [
        root.join("tauri_ui").join("web").join("index.html"),
        root.join("tauri_ui").join("web").join("style.css"),
        root.join("tauri_ui").join("web").join("main.js"),
        root.join("tauri_ui").join("src-tauri").join("src").join("lib.rs"),
        root.join("tauri_ui").join("src-tauri").join("tauri.conf.json"),
    ];

    let source_timestamp = newest_timestamp(&ui_source_files.iter().cloned().collect::<Vec<_>>());
    let built_exe = built_exe_candidates.iter().find(|candidate| candidate.exists());

    if let Some(exe) = built_exe {
        let exe_timestamp = fs::metadata(exe)
            .ok()
            .and_then(|metadata| metadata.modified().ok());

        if let (Some(source_time), Some(binary_time)) = (source_timestamp, exe_timestamp) {
            if binary_time < source_time {
                return Err(
                    "A interface da automacao foi alterada, mas o Automacao.exe ainda esta desatualizado. "
                        .to_string()
                        + "Rode a build do tauri_ui novamente antes de exportar."
                );
            }
        }

        let _ = fs::copy(exe, build_dir.join("Automacao.exe"));
        let _ = fs::copy(exe, export_dir.join("Automacao.exe"));
        let _ = fs::copy(exe, root.join("Automacao.exe"));
        copied.push("Automacao.exe".into());
    } else {
        return Err(
            "Nao foi encontrado o arquivo Automacao.exe da interface final. "
                .to_string()
                + "Gere a interface da automacao primeiro em tauri_ui e depois clique novamente em Gerar automacao."
        );
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
    fs::write(export_dir.join("COMO_EXECUTAR.txt"), export_guide(&normalized_name))
        .map_err(|err| format!("Falha ao gravar guia da exportacao: {err}"))?;

    Ok(ExportResult {
        build_dir: build_dir.display().to_string(),
        export_dir: export_dir.display().to_string(),
        copied,
        missing,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState {
            child: Arc::new(Mutex::new(None)),
            running: Arc::new(Mutex::new(false)),
            pid: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            get_roadmap,
            get_workbook_meta,
            get_workbook_preview,
            list_saved_automations,
            list_open_windows,
            create_saved_automation,
            open_saved_automation,
            duplicate_saved_automation,
            rename_saved_automation,
            delete_saved_automation,
            execute_saved_automation,
            import_workbook,
            import_image_asset,
            capture_mouse_click,
            add_text_block,
            add_key_block,
            add_mouse_block,
            add_image_click_block,
            add_verify_button_state_block,
            add_chrome_html_block,
            add_spreadsheet_block,
            insert_text_block,
            insert_key_block,
            insert_mouse_block,
            insert_image_click_block,
            insert_chrome_html_block,
            insert_spreadsheet_block,
            update_text_block,
            update_key_block,
            update_mouse_block,
            update_image_click_block,
            update_verify_button_state_block,
            update_chrome_html_block,
            update_spreadsheet_block,
            update_block_delay,
            update_all_blocks_delay,
            move_block,
            reorder_block,
            remove_block,
            clear_blocks,
            launch_legacy_capture,
            analyze_html_element,
            test_image_recognition,
            get_test_loop_data,
            get_test_execution_state,
            launch_quick_test,
            launch_assisted_quick_test,
            launch_test_automation,
            launch_assisted_loop_test,
            stop_test_execution,
            export_automation_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o gerador");
}
