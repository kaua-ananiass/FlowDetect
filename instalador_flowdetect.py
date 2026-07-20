from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from tkinter import BooleanVar, StringVar, Tk, filedialog, messagebox, ttk
import tkinter as tk
from tkinter.scrolledtext import ScrolledText


APP_TITLE = "Instalador do FlowDetect"
APP_NAME = "FlowDetect"
ROOT = Path(__file__).resolve().parent
DEFAULT_INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / APP_NAME
EXCLUDED_DIRS = {
    ".git",
    ".agents",
    "__pycache__",
    "saida_exe",
    "relatorios_loop",
    "node_modules",
    "target",
}
EXCLUDED_FILES = {
    "login_session.json",
}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".zip"}


@dataclass
class InstallOptions:
    install_dir: Path
    install_dependencies: bool
    run_diagnostics: bool
    create_desktop_shortcut: bool
    launch_after_install: bool


def configure_utf8() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def is_excluded(relative_path: Path) -> bool:
    if any(part in EXCLUDED_DIRS for part in relative_path.parts):
        return True
    if relative_path.name in EXCLUDED_FILES:
        return True
    if relative_path.suffix.lower() in EXCLUDED_SUFFIXES:
        return True
    return False


def detect_python_commands() -> list[list[str]]:
    commands: list[list[str]] = []
    current = Path(sys.executable) if sys.executable else None
    if current and current.exists():
        commands.append([str(current)])
    commands.append(["python"])
    commands.append(["py", "-3"])

    unique: list[list[str]] = []
    seen: set[tuple[str, ...]] = set()
    for command in commands:
        key = tuple(command)
        if key in seen:
            continue
        seen.add(key)
        unique.append(command)
    return unique


def run_command(command: list[str], cwd: Path, logger) -> subprocess.CompletedProcess[str]:
    logger(f"> {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if completed.stdout.strip():
        logger(completed.stdout.strip())
    if completed.stderr.strip():
        logger(completed.stderr.strip())
    return completed


def try_commands(commands: list[list[str]], cwd: Path, logger, description: str) -> bool:
    for command in commands:
        completed = run_command(command, cwd, logger)
        if completed.returncode == 0:
            logger(f"{description} concluido com sucesso.")
            return True
    logger(f"{description} nao foi concluido.")
    return False


def launcher_target(install_dir: Path) -> Path:
    candidates = [
        install_dir / "FlowDetect.exe",
        install_dir / "abrir_gerador.vbs",
        install_dir / "abrir_gerador.bat",
        install_dir / "Gerador de Automacoes.exe",
        install_dir / "main.py",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return install_dir / "FlowDetect.exe"


def create_desktop_shortcut(install_dir: Path, logger) -> None:
    desktop = Path.home() / "Desktop"
    shortcut_path = desktop / f"{APP_NAME}.lnk"
    target = launcher_target(install_dir)

    powershell_script = f"""
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('{str(shortcut_path).replace("'", "''")}')
$shortcut.TargetPath = '{str(target).replace("'", "''")}'
$shortcut.WorkingDirectory = '{str(install_dir).replace("'", "''")}'
$shortcut.IconLocation = '{str(target).replace("'", "''")}'
$shortcut.Save()
"""
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell_script],
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if completed.returncode == 0:
        logger(f"Atalho criado na area de trabalho: {shortcut_path}")
        return

    fallback_path = desktop / "Abrir FlowDetect.vbs"
    fallback_path.write_text(
        "\r\n".join(
            [
                'Set shell = CreateObject("WScript.Shell")',
                f'shell.CurrentDirectory = "{str(install_dir).replace(chr(34), chr(34) + chr(34))}"',
                f'shell.Run Chr(34) & "{str(target).replace(chr(34), chr(34) + chr(34))}" & Chr(34), 1, False',
            ]
        ),
        encoding="utf-8",
    )
    logger(f"Nao foi possivel criar o atalho .lnk. Foi criado um atalho silencioso em {fallback_path}.")


def launch_installed_app(install_dir: Path, logger) -> None:
    target = launcher_target(install_dir)
    if not target.exists():
        logger("Nenhum iniciador foi encontrado para abrir o FlowDetect automaticamente.")
        return
    os.startfile(str(target))
    logger(f"FlowDetect iniciado: {target}")


def save_install_manifest(install_dir: Path, options: InstallOptions) -> None:
    manifest = {
        "installed_at": datetime.now().isoformat(timespec="seconds"),
        "source_root": str(ROOT),
        "install_dir": str(install_dir),
        "options": {
            "install_dependencies": options.install_dependencies,
            "run_diagnostics": options.run_diagnostics,
            "create_desktop_shortcut": options.create_desktop_shortcut,
            "launch_after_install": options.launch_after_install,
        },
    }
    (install_dir / "instalacao_flowdetect.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def copy_project(source_root: Path, install_dir: Path, logger) -> None:
    install_dir.mkdir(parents=True, exist_ok=True)

    source_root = source_root.resolve()
    install_dir = install_dir.resolve()

    if source_root == install_dir:
        logger("A pasta escolhida ja e a pasta atual do pacote. Nenhuma copia foi necessaria.")
        return

    for item in source_root.iterdir():
        try:
            item_resolved = item.resolve()
        except Exception:
            item_resolved = item

        if item_resolved == install_dir:
            logger(f"Ignorando a propria pasta de destino durante a copia: {install_dir}")
            continue

        relative = item.relative_to(source_root)
        if is_excluded(relative):
            continue

        destination = install_dir / item.name
        if item.is_dir():
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(
                item,
                destination,
                ignore=shutil.ignore_patterns(*EXCLUDED_DIRS, "*.pyc", "*.pyo", "*.zip"),
            )
            logger(f"Pasta copiada: {relative}")
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        logger(f"Arquivo copiado: {relative}")


def install_python_dependencies(install_dir: Path, logger) -> None:
    requirements = install_dir / "requirements.txt"
    if not requirements.exists():
        logger("Arquivo requirements.txt nao encontrado. Dependencias Python foram puladas.")
        return

    wheel_cache = install_dir / "python-wheels"
    commands = detect_python_commands()
    ensurepip_commands = [command + ["-m", "ensurepip", "--upgrade"] for command in commands]
    try_commands(ensurepip_commands, install_dir, logger, "Verificacao do pip")

    install_commands = []
    if wheel_cache.exists():
        for command in commands:
            install_commands.append(
                command
                + [
                    "-m",
                    "pip",
                    "install",
                    "--no-index",
                    "--find-links",
                    str(wheel_cache),
                    "-r",
                    str(requirements),
                    "--disable-pip-version-check",
                ]
            )
    for command in commands:
        install_commands.append(command + ["-m", "pip", "install", "-r", str(requirements), "--disable-pip-version-check"])
        install_commands.append(command + ["-m", "pip", "install", "--user", "-r", str(requirements), "--disable-pip-version-check"])

    if not try_commands(install_commands, install_dir, logger, "Instalacao das dependencias Python"):
        raise RuntimeError("Nao foi possivel instalar as dependencias Python automaticamente.")


def run_environment_diagnostics(install_dir: Path, logger) -> None:
    diagnostics_script = install_dir / "diagnostico_ambiente.py"
    if not diagnostics_script.exists():
        logger("Arquivo diagnostico_ambiente.py nao encontrado. Diagnostico foi pulado.")
        return

    commands = [command + [str(diagnostics_script)] for command in detect_python_commands()]
    for command in commands:
        completed = run_command(command, install_dir, logger)
        if completed.returncode != 0:
            continue
        raw = completed.stdout.strip() or completed.stderr.strip()
        if not raw:
            logger("Diagnostico executado, mas sem retorno textual.")
            return
        data = json.loads(raw)
        summary_path = install_dir / "diagnostico_instalacao.json"
        summary_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        counts = data.get("counts", {})
        logger(
            "Diagnostico final: "
            f"{counts.get('ok', 0)} ok | "
            f"{counts.get('warning', 0)} avisos | "
            f"{counts.get('error', 0)} erros."
        )
        logger(f"Relatorio salvo em: {summary_path}")
        return

    raise RuntimeError("Nao foi possivel executar o diagnostico final da instalacao.")


class InstallerWizard(Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("920x640")
        self.minsize(860, 600)
        self.configure(bg="#07111F")

        self.install_dir_var = StringVar(value=str(DEFAULT_INSTALL_DIR))
        self.install_dependencies_var = BooleanVar(value=True)
        self.run_diagnostics_var = BooleanVar(value=True)
        self.create_shortcut_var = BooleanVar(value=True)
        self.launch_after_var = BooleanVar(value=True)

        self.current_step = 0
        self.steps: list[ttk.Frame] = []
        self.install_running = False
        self.install_finished = False
        self.log_queue: queue.Queue[str] = queue.Queue()
        self.log_poller_active = True

        self._configure_style()
        self._build_layout()
        self._render_steps()
        self._show_step(0)
        self.after(120, self._flush_log_queue)

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure(".", background="#07111F", foreground="#E6F7FF", fieldbackground="#0E1B2E")
        style.configure("Card.TFrame", background="#0E1B2E", borderwidth=0)
        style.configure("Panel.TFrame", background="#0B1626", borderwidth=0)
        style.configure("Title.TLabel", background="#07111F", foreground="#E6F7FF", font=("Segoe UI", 24, "bold"))
        style.configure("Eyebrow.TLabel", background="#07111F", foreground="#12B5CB", font=("Segoe UI", 11, "bold"))
        style.configure("Body.TLabel", background="#07111F", foreground="#B8D9E8", font=("Segoe UI", 11))
        style.configure("CardTitle.TLabel", background="#0E1B2E", foreground="#E6F7FF", font=("Segoe UI", 14, "bold"))
        style.configure("CardBody.TLabel", background="#0E1B2E", foreground="#B8D9E8", font=("Segoe UI", 10))
        style.configure("Accent.TButton", background="#12B5CB", foreground="#07111F", padding=(18, 10), font=("Segoe UI", 10, "bold"))
        style.map("Accent.TButton", background=[("active", "#5EEAD4"), ("disabled", "#35576A")])
        style.configure("Ghost.TButton", background="#13243A", foreground="#E6F7FF", padding=(16, 10), font=("Segoe UI", 10, "bold"))
        style.map("Ghost.TButton", background=[("active", "#183049"), ("disabled", "#102033")])
        style.configure("Install.TCheckbutton", background="#0E1B2E", foreground="#E6F7FF", font=("Segoe UI", 10))
        style.map("Install.TCheckbutton", background=[("active", "#0E1B2E")])
    def _build_layout(self) -> None:
        wrapper = ttk.Frame(self, style="Panel.TFrame", padding=24)
        wrapper.pack(fill="both", expand=True)

        header = ttk.Frame(wrapper, style="Panel.TFrame")
        header.pack(fill="x")

        ttk.Label(header, text="INSTALACAO GUIADA", style="Eyebrow.TLabel").pack(anchor="w")
        ttk.Label(header, text="Preparar o FlowDetect nesta maquina", style="Title.TLabel").pack(anchor="w", pady=(6, 10))
        ttk.Label(
            header,
            text="Escolha a pasta, confirme o que deseja instalar e deixe o assistente preparar o ambiente antes de abrir o programa.",
            style="Body.TLabel",
            wraplength=780,
            justify="left",
        ).pack(anchor="w")

        self.step_badges = ttk.Frame(wrapper, style="Panel.TFrame")
        self.step_badges.pack(fill="x", pady=(18, 18))

        content_card = ttk.Frame(wrapper, style="Card.TFrame", padding=18)
        content_card.pack(fill="both", expand=True)

        self.content_host = ttk.Frame(content_card, style="Card.TFrame")
        self.content_host.pack(fill="both", expand=True)

        footer = ttk.Frame(wrapper, style="Panel.TFrame")
        footer.pack(fill="x", pady=(18, 0))

        self.back_button = ttk.Button(footer, text="Voltar", style="Ghost.TButton", command=self._go_back)
        self.back_button.pack(side="left")

        self.status_label = ttk.Label(footer, text="Etapa 1 de 4", style="Body.TLabel")
        self.status_label.pack(side="left", padx=(16, 0))

        self.next_button = ttk.Button(footer, text="Avancar", style="Accent.TButton", command=self._go_next)
        self.next_button.pack(side="right")

    def _render_steps(self) -> None:
        self.steps = [
            self._build_welcome_step(),
            self._build_destination_step(),
            self._build_components_step(),
            self._build_install_step(),
        ]

        step_names = ["Inicio", "Destino", "Componentes", "Instalacao"]
        for name in step_names:
            badge = tk.Label(
                self.step_badges,
                text=name,
                bg="#10243A",
                fg="#7ACFDE",
                padx=14,
                pady=8,
                font=("Segoe UI", 10, "bold"),
            )
            badge.pack(side="left", padx=(0, 10))

    def _build_welcome_step(self) -> ttk.Frame:
        frame = ttk.Frame(self.content_host, style="Card.TFrame")
        ttk.Label(frame, text="O que este instalador faz", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame,
            text=(
                "Este launcher copia o FlowDetect para a pasta desejada, instala as dependencias Python, "
                "valida o ambiente e ja pode deixar o programa pronto para abrir."
            ),
            style="CardBody.TLabel",
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(8, 18))

        bullets = [
            "Copiar o programa para outra pasta",
            "Instalar bibliotecas do requirements.txt",
            "Criar atalho na area de trabalho",
            "Rodar um diagnostico ao final",
            "Abrir o FlowDetect assim que terminar",
        ]
        for bullet in bullets:
            ttk.Label(frame, text=f"- {bullet}", style="CardBody.TLabel").pack(anchor="w", pady=4)
        return frame

    def _build_destination_step(self) -> ttk.Frame:
        frame = ttk.Frame(self.content_host, style="Card.TFrame")
        ttk.Label(frame, text="Onde instalar", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame,
            text="Escolha a pasta em que o FlowDetect deve ficar instalado nesta maquina.",
            style="CardBody.TLabel",
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(8, 18))

        row = ttk.Frame(frame, style="Card.TFrame")
        row.pack(fill="x")
        entry = tk.Entry(
            row,
            textvariable=self.install_dir_var,
            bg="#10243A",
            fg="#E6F7FF",
            insertbackground="#E6F7FF",
            relief="flat",
            bd=0,
            font=("Segoe UI", 11),
        )
        entry.pack(side="left", fill="x", expand=True)
        ttk.Button(row, text="Escolher pasta", style="Ghost.TButton", command=self._pick_folder).pack(side="left", padx=(10, 0))

        hint = ttk.Label(
            frame,
            text="Dica: a pasta padrao fica no AppData Local do usuario e nao costuma exigir permissao de administrador.",
            style="CardBody.TLabel",
            wraplength=760,
            justify="left",
        )
        hint.pack(anchor="w", pady=(14, 0))
        return frame

    def _build_components_step(self) -> ttk.Frame:
        frame = ttk.Frame(self.content_host, style="Card.TFrame")
        ttk.Label(frame, text="O que instalar", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame,
            text="Marque o que deseja preparar agora. O basico recomendado ja vem selecionado.",
            style="CardBody.TLabel",
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(8, 18))

        checks = [
            (self.install_dependencies_var, "Instalar dependencias Python do FlowDetect"),
            (self.run_diagnostics_var, "Rodar diagnostico completo ao finalizar"),
            (self.create_shortcut_var, "Criar atalho na area de trabalho"),
            (self.launch_after_var, "Abrir o FlowDetect ao concluir"),
        ]
        for variable, text in checks:
            ttk.Checkbutton(frame, text=text, variable=variable, style="Install.TCheckbutton").pack(anchor="w", pady=8)
        return frame

    def _build_install_step(self) -> ttk.Frame:
        frame = ttk.Frame(self.content_host, style="Card.TFrame")
        ttk.Label(frame, text="Instalacao", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame,
            text="Revise as opcoes e clique em Instalar para preparar o programa.",
            style="CardBody.TLabel",
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(8, 14))

        self.summary_label = ttk.Label(frame, text="", style="CardBody.TLabel", wraplength=760, justify="left")
        self.summary_label.pack(anchor="w", pady=(0, 12))

        self.log_output = ScrolledText(
            frame,
            height=18,
            bg="#08121F",
            fg="#E6F7FF",
            insertbackground="#E6F7FF",
            relief="flat",
            bd=0,
            font=("Consolas", 10),
            padx=12,
            pady=12,
        )
        self.log_output.pack(fill="both", expand=True)
        self.log_output.configure(state="disabled")
        return frame

    def _update_summary_text(self) -> None:
        install_dir = Path(self.install_dir_var.get().strip() or str(DEFAULT_INSTALL_DIR))
        lines = [
            f"Pasta de instalacao: {install_dir}",
            f"Instalar dependencias Python: {'Sim' if self.install_dependencies_var.get() else 'Nao'}",
            f"Rodar diagnostico final: {'Sim' if self.run_diagnostics_var.get() else 'Nao'}",
            f"Criar atalho: {'Sim' if self.create_shortcut_var.get() else 'Nao'}",
            f"Abrir o programa ao concluir: {'Sim' if self.launch_after_var.get() else 'Nao'}",
        ]
        self.summary_label.configure(text="\n".join(lines))

    def _show_step(self, index: int) -> None:
        self.current_step = max(0, min(index, len(self.steps) - 1))
        for step_index, frame in enumerate(self.steps):
            frame.pack_forget()
            if step_index == self.current_step:
                frame.pack(fill="both", expand=True)

        for badge_index, child in enumerate(self.step_badges.winfo_children()):
            if badge_index == self.current_step:
                child.configure(bg="#12B5CB", fg="#07111F")
            else:
                child.configure(bg="#10243A", fg="#7ACFDE")

        self.status_label.configure(text=f"Etapa {self.current_step + 1} de {len(self.steps)}")
        self.back_button.configure(state="normal" if self.current_step > 0 and not self.install_running else "disabled")

        if self.current_step < len(self.steps) - 1:
            self.next_button.configure(text="Avancar", state="normal")
        else:
            self._update_summary_text()
            if self.install_finished:
                self.next_button.configure(text="Concluir", state="normal")
            elif self.install_running:
                self.next_button.configure(text="Instalando...", state="disabled")
            else:
                self.next_button.configure(text="Instalar", state="normal")

    def _go_back(self) -> None:
        if self.install_running:
            return
        self._show_step(self.current_step - 1)

    def _go_next(self) -> None:
        if self.install_running:
            return
        if self.current_step == 1 and not self._validate_destination():
            return
        if self.current_step < len(self.steps) - 1:
            self._show_step(self.current_step + 1)
            return
        if self.install_finished:
            self.destroy()
            return
        self._start_installation()

    def _pick_folder(self) -> None:
        selected = filedialog.askdirectory(initialdir=self.install_dir_var.get().strip() or str(DEFAULT_INSTALL_DIR))
        if selected:
            self.install_dir_var.set(selected)

    def _validate_destination(self) -> bool:
        raw = self.install_dir_var.get().strip()
        if not raw:
            messagebox.showerror(APP_TITLE, "Escolha uma pasta de instalacao antes de continuar.")
            return False
        try:
            Path(raw).mkdir(parents=True, exist_ok=True)
        except Exception as error:
            messagebox.showerror(APP_TITLE, f"Nao foi possivel preparar a pasta escolhida:\n{error}")
            return False
        return True

    def _append_log(self, message: str) -> None:
        self.log_output.configure(state="normal")
        self.log_output.insert("end", f"{message.rstrip()}\n")
        self.log_output.see("end")
        self.log_output.configure(state="disabled")
        self.update_idletasks()

    def _queue_log(self, message: str) -> None:
        self.log_queue.put(message)

    def _flush_log_queue(self) -> None:
        if not self.log_poller_active:
            return
        drained = False
        while True:
            try:
                message = self.log_queue.get_nowait()
            except queue.Empty:
                break
            drained = True
            self._append_log(message)
        if drained:
            self.update_idletasks()
        self.after(120, self._flush_log_queue)

    def destroy(self) -> None:
        self.log_poller_active = False
        super().destroy()

    def _set_install_state(self, running: bool, finished: bool = False) -> None:
        self.install_running = running
        self.install_finished = finished
        self.back_button.configure(state="disabled" if running or self.current_step == 0 else "normal")
        if running:
            self.next_button.configure(text="Instalando...", state="disabled")
        elif finished:
            self.next_button.configure(text="Concluir", state="normal")
        else:
            self.next_button.configure(text="Instalar", state="normal")

    def _current_options(self) -> InstallOptions:
        return InstallOptions(
            install_dir=Path(self.install_dir_var.get().strip() or str(DEFAULT_INSTALL_DIR)),
            install_dependencies=self.install_dependencies_var.get(),
            run_diagnostics=self.run_diagnostics_var.get(),
            create_desktop_shortcut=self.create_shortcut_var.get(),
            launch_after_install=self.launch_after_var.get(),
        )

    def _start_installation(self) -> None:
        options = self._current_options()
        self._set_install_state(True)
        self._append_log("Instalacao iniciada.")
        self._append_log(f"Origem do pacote: {ROOT}")
        self._append_log(f"Destino selecionado: {options.install_dir}")

        def worker() -> None:
            try:
                copy_project(ROOT, options.install_dir, self._queue_log)
                save_install_manifest(options.install_dir, options)

                if options.install_dependencies:
                    self._queue_log("Instalando dependencias Python...")
                    install_python_dependencies(options.install_dir, self._queue_log)

                if options.run_diagnostics:
                    self._queue_log("Rodando diagnostico final do ambiente...")
                    run_environment_diagnostics(options.install_dir, self._queue_log)

                if options.create_desktop_shortcut:
                    self._queue_log("Criando atalho...")
                    create_desktop_shortcut(options.install_dir, self._queue_log)

                self._queue_log("Instalacao concluida com sucesso.")

                if options.launch_after_install:
                    self._queue_log("Abrindo o FlowDetect...")
                    launch_installed_app(options.install_dir, self._queue_log)

                self.after(0, lambda: self._set_install_state(False, True))
            except Exception as error:
                self._queue_log(f"Falha na instalacao: {error}")
                self.after(0, lambda: self._set_install_state(False, False))
                self.after(0, lambda: messagebox.showerror(APP_TITLE, f"A instalacao falhou:\n{error}"))

        threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    configure_utf8()
    app = InstallerWizard()
    app.mainloop()


if __name__ == "__main__":
    main()
