import argparse
import json
import queue
import subprocess
import sys
import threading
import time
import traceback
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk


ARQUIVO_EXECUTOR = Path("executar_automacao.py")
ARQUIVO_MAPEAMENTO = Path("mapeamento_teclado.json")
ARQUIVO_PLANILHA = Path("db.xlsx")
ARQUIVO_DADOS_LOOP = Path("gerenciar_dados_planilha.py")
ARQUIVO_CANCELAMENTO = Path(".parar_automacao.flag")
CORES = {
    "bg": "#090B11",
    "panel": "#0D1017",
    "panel_soft": "#11151F",
    "cream": "#F5F2EC",
    "accent": "#DF6D3A",
    "accent_soft": "#E3B38A",
    "ink": "#1A203A",
    "text_soft": "#A79E93",
    "line": "#262B39",
    "success": "#1D5E46",
}


class PainelAutomacao:
    def __init__(self, modo_inicial="normal", atraso_inicial=3.0, loop_start_inicial=1, autostart=False):
        self.root = tk.Tk()
        self.root.title("Automacao")
        self.root.geometry("620x560")
        self.root.minsize(580, 520)
        self.root.configure(bg=CORES["bg"])
        self.root.protocol("WM_DELETE_WINDOW", self.ao_fechar)

        self.processo = None
        self.fila_saida = queue.Queue()
        self.instante_parada = None
        self.total_passos = 1
        self.empresa_atual = ""
        self.animacao_tick = 0

        self.status_var = tk.StringVar(value="Pronta para executar")
        self.detalhe_var = tk.StringVar(value="Configure o modo e inicie a automacao.")
        self.empresa_var = tk.StringVar(value="Empresa atual: -")
        self.percentual_var = tk.StringVar(value="0%")
        self.progresso_var = tk.DoubleVar(value=0.0)
        self.modo_var = tk.StringVar(value=str(modo_inicial or "normal"))
        self.atraso_var = tk.StringVar(value=str(atraso_inicial))
        self.loop_start_var = tk.StringVar(value=str(loop_start_inicial))
        self.loop_hint_var = tk.StringVar(value="Aguardando leitura do loop da planilha.")
        self.loop_rows_state = []
        self.autostart = bool(autostart)

        self.preparar_estilos()
        self.construir_interface()
        self.root.after(70, self.animar_interface)
        self.root.after(120, self.processar_fila_saida)
        self.root.after(180, self.monitorar_processo)

    def preparar_estilos(self):
        estilo = ttk.Style()
        try:
            estilo.theme_use("clam")
        except tk.TclError:
            pass
        estilo.configure(
            "Warm.Horizontal.TProgressbar",
            troughcolor="#1A2030",
            bordercolor="#1A2030",
            background=CORES["accent"],
            lightcolor=CORES["accent"],
            darkcolor="#C45426",
            thickness=14,
        )

    def construir_interface(self):
        container = tk.Frame(self.root, bg=CORES["bg"])
        container.pack(fill="both", expand=True, padx=18, pady=18)

        self.hero = tk.Canvas(
            container,
            bg=CORES["bg"],
            highlightthickness=0,
            height=180,
        )
        self.hero.pack(fill="x")

        self.orb_a = self.hero.create_oval(0, 0, 220, 220, fill="#1A203A", outline="")
        self.orb_b = self.hero.create_oval(0, 0, 160, 160, fill="#2A1320", outline="")
        self.orb_c = self.hero.create_oval(0, 0, 110, 110, fill=CORES["accent"], outline="")
        self.hero_line = self.hero.create_rectangle(0, 0, 0, 0, fill=CORES["accent_soft"], outline="")
        self.hero_grid = self.hero.create_rectangle(0, 0, 0, 0, outline="#161B27")

        self.hero.create_text(
            24,
            24,
            anchor="nw",
            text="AUTOMACAO",
            fill=CORES["cream"],
            font=("Montserrat", 26, "bold"),
        )
        self.hero.create_text(
            26,
            70,
            anchor="nw",
            text="painel de execucao",
            fill=CORES["accent"],
            font=("Montserrat", 10, "bold"),
        )
        self.hero.create_text(
            24,
            98,
            anchor="nw",
            text="Visual inspirado no Design: foco em clareza, progresso e acompanhamento ao vivo.",
            fill="#BBB3A7",
            width=360,
            font=("Plus Jakarta Sans", 10),
        )

        self.badge_text = self.hero.create_text(
            0,
            0,
            text="STANDBY",
            fill=CORES["cream"],
            font=("Montserrat", 10, "bold"),
        )
        self.badge_bg = self.hero.create_rectangle(0, 0, 0, 0, outline="", fill="#13192F")

        corpo = tk.Frame(container, bg=CORES["bg"])
        corpo.pack(fill="both", expand=True, pady=(14, 0))
        corpo.grid_columnconfigure(0, weight=6)
        corpo.grid_columnconfigure(1, weight=5)
        corpo.grid_rowconfigure(0, weight=1)

        controle = tk.Frame(
            corpo,
            bg=CORES["panel"],
            highlightbackground=CORES["line"],
            highlightthickness=1,
            padx=18,
            pady=18,
        )
        controle.grid(row=0, column=0, sticky="nsew", padx=(0, 10))

        tk.Label(
            controle,
            text="Controle",
            bg=CORES["panel"],
            fg=CORES["cream"],
            font=("Montserrat", 16, "bold"),
        ).pack(anchor="w")
        tk.Label(
            controle,
            text="Modo, atraso e acoes principais da automacao.",
            bg=CORES["panel"],
            fg=CORES["text_soft"],
            font=("Plus Jakarta Sans", 9),
        ).pack(anchor="w", pady=(4, 14))

        linha_superior = tk.Frame(controle, bg=CORES["panel"])
        linha_superior.pack(fill="x")

        box_modo = self.criar_box(linha_superior)
        box_modo.pack(side="left", fill="x", expand=True, padx=(0, 8))
        tk.Label(
            box_modo,
            text="MODO",
            bg=CORES["panel_soft"],
            fg=CORES["accent_soft"],
            font=("Montserrat", 8, "bold"),
        ).pack(anchor="w")
        self.combo_modo = ttk.Combobox(
            box_modo,
            textvariable=self.modo_var,
            values=("normal", "loop"),
            state="readonly",
            width=14,
        )
        self.combo_modo.pack(fill="x", pady=(8, 0))

        box_atraso = self.criar_box(linha_superior)
        box_atraso.pack(side="left", fill="x", expand=True, padx=(8, 0))
        tk.Label(
            box_atraso,
            text="ATRASO INICIAL",
            bg=CORES["panel_soft"],
            fg=CORES["accent_soft"],
            font=("Montserrat", 8, "bold"),
        ).pack(anchor="w")
        self.entrada_atraso = tk.Entry(
            box_atraso,
            textvariable=self.atraso_var,
            relief="flat",
            bd=0,
            bg="#151A27",
            fg=CORES["cream"],
            insertbackground=CORES["cream"],
            justify="center",
            font=("Montserrat", 14, "bold"),
        )
        self.entrada_atraso.pack(fill="x", pady=(8, 0), ipady=6)

        box_loop_start = self.criar_box(controle)
        box_loop_start.pack(fill="x", pady=(12, 0))
        tk.Label(
            box_loop_start,
            text="INICIAR LOOP NO ITEM",
            bg=CORES["panel_soft"],
            fg=CORES["accent_soft"],
            font=("Montserrat", 8, "bold"),
        ).pack(anchor="w")
        self.entrada_loop_start = tk.Entry(
            box_loop_start,
            textvariable=self.loop_start_var,
            relief="flat",
            bd=0,
            bg="#151A27",
            fg=CORES["cream"],
            insertbackground=CORES["cream"],
            justify="center",
            font=("Montserrat", 14, "bold"),
        )
        self.entrada_loop_start.pack(fill="x", pady=(8, 0), ipady=6)
        tk.Label(
            box_loop_start,
            text="Use 1 para comecar do primeiro item da planilha.",
            bg=CORES["panel_soft"],
            fg=CORES["text_soft"],
            font=("Plus Jakarta Sans", 9),
        ).pack(anchor="w", pady=(8, 0))
        tk.Label(
            box_loop_start,
            textvariable=self.loop_hint_var,
            bg=CORES["panel_soft"],
            fg=CORES["cream"],
            justify="left",
            wraplength=260,
            font=("Plus Jakarta Sans", 9, "bold"),
        ).pack(anchor="w", pady=(8, 0))
        self.entrada_loop_start.bind("<KeyRelease>", lambda _event: self.atualizar_resumo_loop())

        linha_botoes = tk.Frame(controle, bg=CORES["panel"])
        linha_botoes.pack(fill="x", pady=(16, 16))
        self.botao_iniciar = self.criar_botao(
            linha_botoes,
            "Iniciar",
            "#1A203A",
            CORES["accent"],
            self.iniciar_automacao,
        )
        self.botao_iniciar.pack(side="left")
        self.botao_parar = self.criar_botao(
            linha_botoes,
            "Parar",
            "#34151A",
            "#B84545",
            self.parar_automacao,
        )
        self.botao_parar.pack(side="left", padx=(10, 0))

        status_box = self.criar_box(controle)
        status_box.pack(fill="x")
        linha_status = tk.Frame(status_box, bg=CORES["panel_soft"])
        linha_status.pack(fill="x")
        self.status_dot = tk.Canvas(
            linha_status,
            width=14,
            height=14,
            bg=CORES["panel_soft"],
            highlightthickness=0,
        )
        self.status_dot.pack(side="left", pady=(1, 0))
        self.status_dot_oval = self.status_dot.create_oval(2, 2, 12, 12, fill=CORES["accent"], outline="")
        tk.Label(
            linha_status,
            textvariable=self.status_var,
            bg=CORES["panel_soft"],
            fg=CORES["cream"],
            font=("Montserrat", 10, "bold"),
        ).pack(side="left", padx=(8, 0))
        tk.Label(
            linha_status,
            textvariable=self.percentual_var,
            bg=CORES["panel_soft"],
            fg=CORES["accent_soft"],
            font=("Montserrat", 10, "bold"),
        ).pack(side="right")

        self.progresso = ttk.Progressbar(
            status_box,
            mode="determinate",
            maximum=100,
            variable=self.progresso_var,
            style="Warm.Horizontal.TProgressbar",
        )
        self.progresso.pack(fill="x", pady=(10, 10))

        tk.Label(
            status_box,
            textvariable=self.empresa_var,
            bg=CORES["panel_soft"],
            fg=CORES["cream"],
            justify="left",
            wraplength=260,
            font=("Plus Jakarta Sans", 10, "bold"),
        ).pack(anchor="w")
        tk.Label(
            status_box,
            textvariable=self.detalhe_var,
            bg=CORES["panel_soft"],
            fg=CORES["text_soft"],
            justify="left",
            wraplength=260,
            font=("Plus Jakarta Sans", 9),
        ).pack(anchor="w", pady=(6, 0))

        lateral = tk.Frame(
            corpo,
            bg="#F5F2EC",
            highlightbackground="#D9CBB8",
            highlightthickness=1,
            padx=16,
            pady=16,
        )
        lateral.grid(row=0, column=1, sticky="nsew")

        tk.Label(
            lateral,
            text="Linha do tempo",
            bg="#F5F2EC",
            fg=CORES["ink"],
            font=("Cormorant Garamond", 24, "bold"),
        ).pack(anchor="w")
        tk.Label(
            lateral,
            text="Mensagens do executor aparecem aqui enquanto a automacao roda.",
            bg="#F5F2EC",
            fg="#6F6254",
            wraplength=230,
            justify="left",
            font=("Plus Jakarta Sans", 9),
        ).pack(anchor="w", pady=(4, 12))

        self.log = tk.Text(
            lateral,
            relief="flat",
            bd=0,
            bg="#EFE7DB",
            fg=CORES["ink"],
            wrap="word",
            font=("Consolas", 8),
            state="disabled",
            padx=10,
            pady=10,
        )
        self.log.pack(fill="both", expand=True)

        rodape = tk.Frame(container, bg=CORES["bg"])
        rodape.pack(fill="x", pady=(12, 0))
        tk.Label(
            rodape,
            text=f"{ARQUIVO_MAPEAMENTO.name}  |  {ARQUIVO_PLANILHA.name}",
            bg=CORES["bg"],
            fg="#7E776D",
            font=("Montserrat", 8, "bold"),
        ).pack(anchor="w")

        self.registrar_log("Painel carregado.")
        self.atualizar_estado_botoes()
        self.root.after(220, self.carregar_resumo_loop)
        if self.autostart:
            self.root.after(420, self.iniciar_automacao)

    def criar_box(self, parent):
        return tk.Frame(
            parent,
            bg=CORES["panel_soft"],
            highlightbackground="#1C2230",
            highlightthickness=1,
            padx=12,
            pady=12,
        )

    def criar_botao(self, parent, texto, base, hover, comando):
        botao = tk.Button(
            parent,
            text=texto,
            command=comando,
            relief="flat",
            bd=0,
            padx=18,
            pady=10,
            cursor="hand2",
            bg=base,
            fg=CORES["cream"],
            activebackground=hover,
            activeforeground=CORES["cream"],
            font=("Montserrat", 10, "bold"),
        )
        botao.bind("<Enter>", lambda _e, b=botao, cor=hover: b.configure(bg=cor))
        botao.bind("<Leave>", lambda _e, b=botao, cor=base: b.configure(bg=cor))
        return botao

    def registrar_log(self, mensagem):
        horario = time.strftime("%H:%M:%S")
        self.log.configure(state="normal")
        self.log.insert("end", f"[{horario}] {mensagem}\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def carregar_resumo_loop(self):
        if not ARQUIVO_DADOS_LOOP.exists():
            self.loop_rows_state = []
            self.loop_hint_var.set("Arquivo gerenciar_dados_planilha.py nao encontrado.")
            return

        try:
            resultado = subprocess.run(
                [sys.executable, str(ARQUIVO_DADOS_LOOP), "listar"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=True,
            )
            payload = json.loads(resultado.stdout or "{}")
            self.loop_rows_state = payload.get("rows") or []
            self.atualizar_resumo_loop()
        except Exception as erro:
            self.loop_rows_state = []
            self.loop_hint_var.set(f"Nao foi possivel ler o loop atual: {erro}")

    def atualizar_resumo_loop(self):
        if not self.loop_rows_state:
            self.loop_hint_var.set("Nenhum loop de planilha encontrado para calcular a linha inicial.")
            return

        try:
            linha_solicitada = int((self.loop_start_var.get() or "1").strip())
        except ValueError:
            self.loop_hint_var.set("Informe uma linha inicial valida da planilha.")
            return

        if linha_solicitada < 1:
            self.loop_hint_var.set("A linha inicial precisa ser maior ou igual a 1.")
            return

        linha_resolvida = next(
            (row for row in self.loop_rows_state if int(row.get("row_number", 0)) >= linha_solicitada),
            None,
        )
        if linha_resolvida is None:
            ultima_linha = self.loop_rows_state[-1].get("row_number", "-")
            self.loop_hint_var.set(
                f"A linha {linha_solicitada} nao existe nesse loop. Ultima linha disponivel: {ultima_linha}."
            )
            return

        empresa = str(linha_resolvida.get("company") or "").strip()
        resumo = f"Vai iniciar na linha {linha_resolvida.get('row_number')}: {linha_resolvida.get('value', '-')}"
        if empresa:
            resumo += f" | {empresa}"
        resumo += ". Outros loops de planilha acompanham essa mesma linha quando ela existir."
        self.loop_hint_var.set(resumo)

    def definir_badge(self, texto):
        self.hero.itemconfigure(self.badge_text, text=texto)

    def animar_interface(self):
        largura = max(self.hero.winfo_width(), 1)
        self.animacao_tick += 1

        ox1 = largura - 190 + int(18 * __import__("math").sin(self.animacao_tick / 12))
        oy1 = 10 + int(14 * __import__("math").cos(self.animacao_tick / 15))
        ox2 = largura - 130 + int(12 * __import__("math").cos(self.animacao_tick / 11))
        oy2 = 50 + int(10 * __import__("math").sin(self.animacao_tick / 10))
        ox3 = largura - 110 + int(10 * __import__("math").sin(self.animacao_tick / 8))
        oy3 = 88 + int(8 * __import__("math").cos(self.animacao_tick / 9))

        self.hero.coords(self.orb_a, ox1, oy1, ox1 + 210, oy1 + 210)
        self.hero.coords(self.orb_b, ox2, oy2, ox2 + 150, oy2 + 150)
        self.hero.coords(self.orb_c, ox3, oy3, ox3 + 96, oy3 + 96)

        barra = 110 + int(44 * (1 + __import__("math").sin(self.animacao_tick / 7)))
        self.hero.coords(self.hero_line, 24, 154, 24 + barra, 158)
        self.hero.coords(self.hero_grid, largura - 170, 24, largura - 26, 154)
        self.hero.coords(self.badge_bg, largura - 152, 22, largura - 26, 52)
        self.hero.coords(self.badge_text, largura - 89, 37)

        brilho = 180 + int(50 * __import__("math").sin(self.animacao_tick / 6))
        cor = f"#DF{max(80, min(220, brilho)):02X}3A"
        self.status_dot.itemconfigure(self.status_dot_oval, fill=cor if self.processo else CORES["accent"])

        self.root.after(70, self.animar_interface)

    def atualizar_progresso(self, atual, total, percentual, descricao, empresa):
        self.total_passos = max(1, total)
        self.progresso_var.set(max(0.0, min(100.0, percentual)))
        self.percentual_var.set(f"{int(round(percentual))}%")
        self.status_var.set(f"Executando {atual}/{self.total_passos}")
        self.detalhe_var.set(descricao or "Executando automacao...")
        empresa_limpa = empresa.strip() if empresa else ""
        self.empresa_atual = empresa_limpa
        self.empresa_var.set(f"Empresa atual: {empresa_limpa or '-'}")

    def processar_mensagem_progresso(self, mensagem):
        partes = mensagem.split("|", 5)
        if len(partes) != 6:
            return False
        try:
            atual = int(float(partes[1]))
            total = int(float(partes[2]))
            percentual = float(partes[3])
        except ValueError:
            return False
        self.atualizar_progresso(atual, total, percentual, partes[4], partes[5])
        return True

    def arquivos_prontos(self):
        return [
            str(arquivo.name)
            for arquivo in (ARQUIVO_EXECUTOR, ARQUIVO_MAPEAMENTO)
            if not arquivo.exists()
        ]

    def iniciar_automacao(self):
        if self.processo and self.processo.poll() is None:
            messagebox.showwarning("Automacao", "Ja existe uma execucao em andamento.")
            return

        self.carregar_resumo_loop()

        faltando = self.arquivos_prontos()
        if faltando:
            messagebox.showerror(
                "Arquivos ausentes",
                "Nao foi possivel iniciar.\n\nArquivos faltando: " + ", ".join(faltando),
            )
            return

        try:
            atraso = round(float(self.atraso_var.get().strip().replace(",", ".")), 2)
        except ValueError:
            messagebox.showwarning("Automacao", "Informe um atraso valido em segundos.")
            return

        if atraso < 0:
            messagebox.showwarning("Automacao", "O atraso nao pode ser negativo.")
            return

        try:
            loop_start = int(self.loop_start_var.get().strip() or "1")
        except ValueError:
            messagebox.showwarning("Automacao", "Informe um item inicial valido para o loop.")
            return

        if loop_start < 1:
            messagebox.showwarning("Automacao", "O item inicial do loop deve ser maior ou igual a 1.")
            return

        if ARQUIVO_CANCELAMENTO.exists():
            ARQUIVO_CANCELAMENTO.unlink()

        comando = [
            sys.executable,
            str(ARQUIVO_EXECUTOR),
            "--modo",
            self.modo_var.get(),
            "--atraso",
            str(atraso),
            "--loop-start",
            str(loop_start),
            "--arquivo",
            str(ARQUIVO_MAPEAMENTO),
            "--planilha",
            str(ARQUIVO_PLANILHA),
            "--cancelamento-arquivo",
            str(ARQUIVO_CANCELAMENTO),
        ]

        try:
            self.processo = subprocess.Popen(
                comando,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except OSError as erro:
            messagebox.showerror("Automacao", f"Nao foi possivel iniciar a automacao.\n\n{erro}")
            return

        threading.Thread(target=self.ler_saida_processo, daemon=True).start()
        self.instante_parada = None
        self.total_passos = 1
        self.progresso_var.set(0.0)
        self.percentual_var.set("0%")
        self.status_var.set("Preparando...")
        detalhe_loop = f" Linha inicial procurada no loop: {loop_start}." if self.modo_var.get() == "loop" else ""
        self.detalhe_var.set(f"Modo {self.modo_var.get()} com atraso inicial de {atraso}s.{detalhe_loop}")
        self.empresa_var.set("Empresa atual: -")
        self.definir_badge("RUNNING")
        self.registrar_log("Execucao iniciada.")
        self.registrar_log("A interface foi minimizada. Foque a janela onde a automacao deve atuar.")
        try:
            self.root.iconify()
        except tk.TclError:
            pass
        self.atualizar_estado_botoes()

    def parar_automacao(self):
        if self.processo is None or self.processo.poll() is not None:
            messagebox.showinfo("Automacao", "Nenhuma automacao esta rodando agora.")
            return

        ARQUIVO_CANCELAMENTO.write_text("parar", encoding="utf-8")
        self.instante_parada = time.time()
        self.status_var.set("Parando...")
        self.detalhe_var.set("Pedido de parada enviado.")
        self.registrar_log("Pedido de parada enviado.")
        self.atualizar_estado_botoes()

    def ler_saida_processo(self):
        if self.processo is None or self.processo.stdout is None:
            return
        for linha in self.processo.stdout:
            texto = linha.strip()
            if texto:
                self.fila_saida.put(texto)

    def processar_fila_saida(self):
        while True:
            try:
                mensagem = self.fila_saida.get_nowait()
            except queue.Empty:
                break

            if mensagem.startswith("PROGRESS|"):
                self.processar_mensagem_progresso(mensagem)
                continue

            self.registrar_log(mensagem)
            if "Automacao pronta" in mensagem:
                self.status_var.set("Aguardando atraso...")
            elif mensagem.startswith("Executando loop"):
                self.status_var.set("Executando loop")
            elif mensagem.startswith("Executando roteiro"):
                self.status_var.set("Executando roteiro")
            elif mensagem.startswith("Iteracao "):
                self.detalhe_var.set(mensagem)

        self.root.after(120, self.processar_fila_saida)

    def monitorar_processo(self):
        ativo = self.processo is not None and self.processo.poll() is None
        if ativo and self.instante_parada and (time.time() - self.instante_parada) > 3.0:
            self.registrar_log("Parada forcada por tempo excedido.")
            self.processo.terminate()
            self.instante_parada = None

        if self.processo is not None and self.processo.poll() is not None:
            codigo = self.processo.returncode
            if ARQUIVO_CANCELAMENTO.exists():
                ARQUIVO_CANCELAMENTO.unlink()
            self.processo = None
            self.instante_parada = None
            try:
                self.root.deiconify()
                self.root.lift()
            except tk.TclError:
                pass

            if codigo == 0:
                self.progresso_var.set(100.0)
                self.percentual_var.set("100%")
                self.status_var.set("Concluida")
                self.detalhe_var.set("Automacao finalizada com sucesso.")
                self.definir_badge("DONE")
                self.registrar_log("Execucao concluida.")
            else:
                self.status_var.set("Interrompida")
                self.detalhe_var.set("A execucao foi interrompida ou terminou com alerta.")
                self.definir_badge("STOPPED")
                self.registrar_log(f"Processo finalizado com codigo {codigo}.")
            self.atualizar_estado_botoes()

        self.root.after(180, self.monitorar_processo)

    def atualizar_estado_botoes(self):
        executando = self.processo is not None and self.processo.poll() is None
        self.botao_iniciar.configure(state="disabled" if executando else "normal")
        self.botao_parar.configure(state="normal" if executando else "disabled")
        self.entrada_atraso.configure(state="disabled" if executando else "normal")
        self.combo_modo.configure(state="disabled" if executando else "readonly")

    def ao_fechar(self):
        if self.processo is not None and self.processo.poll() is None:
            fechar = messagebox.askyesno(
                "Encerrar painel",
                "Existe uma automacao em execucao. Deseja parar e fechar?",
            )
            if not fechar:
                return
            self.parar_automacao()
            self.root.after(700, self.root.destroy)
            return
        self.root.destroy()

    def executar(self):
        self.root.mainloop()


def main():
    try:
        parser = argparse.ArgumentParser(description="Interface local da automacao.")
        parser.add_argument("--modo", choices=("normal", "loop"), default="normal")
        parser.add_argument("--atraso", type=float, default=3.0)
        parser.add_argument("--loop-start", type=int, default=1)
        parser.add_argument("--autostart", action="store_true")
        args = parser.parse_args()

        PainelAutomacao(
            modo_inicial=args.modo,
            atraso_inicial=max(0, round(float(args.atraso), 2)),
            loop_start_inicial=max(1, int(args.loop_start)),
            autostart=args.autostart,
        ).executar()
    except Exception:
        detalhe = traceback.format_exc()
        Path("ultimo_erro_interface.txt").write_text(detalhe, encoding="utf-8")
        raiz_erro = tk.Tk()
        raiz_erro.withdraw()
        messagebox.showerror(
            "Falha ao abrir a interface",
            "A interface encontrou um erro ao iniciar.\n\n"
            "Veja o arquivo ultimo_erro_interface.txt para detalhes.",
        )
        raiz_erro.destroy()


if __name__ == "__main__":
    main()
