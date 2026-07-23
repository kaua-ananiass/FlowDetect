import argparse
import json
import sys
import time
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import ttk
except Exception:
    tk = None
    ttk = None

try:
    from PIL import ImageGrab, ImageTk
except Exception as erro:
    print(json.dumps({"erro": f"Falha ao importar PIL.ImageGrab: {erro}"}), flush=True)
    sys.exit(1)

try:
    from pynput import keyboard, mouse
except Exception as erro:
    print(json.dumps({"erro": f"Falha ao importar pynput: {erro}"}), flush=True)
    sys.exit(1)


TECLAS_ESPECIAIS = {
    keyboard.Key.enter: "enter",
    keyboard.Key.tab: "tab",
    keyboard.Key.backspace: "backspace",
    keyboard.Key.space: "space",
    keyboard.Key.delete: "delete",
    keyboard.Key.esc: "esc",
    keyboard.Key.up: "up",
    keyboard.Key.down: "down",
    keyboard.Key.left: "left",
    keyboard.Key.right: "right",
    keyboard.Key.home: "home",
    keyboard.Key.end: "end",
    keyboard.Key.page_up: "page_up",
    keyboard.Key.page_down: "page_down",
}

PAGINAS_GRAVADOR = [
    ("Pagina 1", "principal"),
    ("Pagina 2", "pagina_2"),
    ("Pagina 3", "pagina_3"),
    ("Pagina 4", "pagina_4"),
]


def normalizar_botao(button):
    nome = getattr(button, "name", None)
    if nome:
        return str(nome).lower()
    texto = str(button).replace("Button.", "").strip().lower()
    return texto if texto in {"left", "right", "middle"} else "left"


def pagina_gravador_payload(rotulo):
    for label, sequencia in PAGINAS_GRAVADOR:
        if label == rotulo:
            return {"target_sequence": sequencia}
    return {"target_sequence": "principal"}


class GravadorInteligente:
    def __init__(self, output, images_dir, stop_flag, crop_width=180, crop_height=110):
        self.output = Path(output)
        self.images_dir = Path(images_dir)
        self.stop_flag = Path(stop_flag)
        self.crop_width = max(40, int(crop_width or 180))
        self.crop_height = max(40, int(crop_height or 110))
        self.started_at = time.time()
        self.last_event_at = self.started_at
        self.event_index = 0
        self.text_buffer = []
        self.running = True
        self.confirmando_click = False
        self.overlay_windows = []
        self.overlay_status_label = None
        self.pending_click = None
        self.ignore_keyboard_until = 0.0
        self.tk_root = None
        self.paused = False
        self.overlay_refresh_requested = False
        self.output.parent.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        if self.output.exists():
            self.output.unlink()
        if self.stop_flag.exists():
            self.stop_flag.unlink()

    def obter_tk_root(self):
        if tk is None:
            return None
        if self.tk_root is None:
            self.tk_root = tk.Tk()
            self.tk_root.withdraw()
        return self.tk_root

    def criar_overlay_gravacao(self):
        if tk is None or self.overlay_windows:
            return
        root = self.obter_tk_root()
        if root is None:
            return
        try:
            screenshot = ImageGrab.grab()
            largura = screenshot.width
            altura = screenshot.height
            cor_overlay = "#FBBF24" if self.paused else "#12B5CB"
            texto_status = "Pausado | F10: voltar" if self.paused else "Gravando | direito: texto/tecla"
            cor_texto_status = "#FDE68A" if self.paused else "#5EEAD4"
            specs = [
                ("top", 0, 0, largura, 20),
                ("bottom", 0, max(0, altura - 3), largura, 3),
                ("left", 0, 0, 3, altura),
                ("right", max(0, largura - 3), 0, 3, altura),
            ]
            for nome, x, y, w, h in specs:
                janela = tk.Toplevel(root)
                janela.overrideredirect(True)
                janela.attributes("-topmost", True)
                janela.configure(bg=cor_overlay)
                janela.geometry(f"{w}x{h}+{x}+{y}")
                if nome == "top":
                    label = tk.Label(
                        janela,
                        text=texto_status,
                        bg="#07111F",
                        fg=cor_texto_status,
                        font=("Segoe UI", 8, "bold"),
                        padx=10,
                        pady=1,
                    )
                    label.place(relx=0.5, rely=0.5, anchor="center")
                    self.overlay_status_label = label
                self.overlay_windows.append(janela)
            root.update_idletasks()
            root.update()
        except Exception:
            self.fechar_overlay_gravacao()

    def atualizar_overlay_gravacao(self):
        for janela in list(self.overlay_windows):
            try:
                janela.update_idletasks()
                janela.update()
            except Exception:
                try:
                    janela.destroy()
                except Exception:
                    pass
                if janela in self.overlay_windows:
                    self.overlay_windows.remove(janela)

    def fechar_overlay_gravacao(self):
        for janela in list(self.overlay_windows):
            try:
                janela.destroy()
            except Exception:
                pass
        self.overlay_windows = []
        self.overlay_status_label = None

    def atualizar_estado_overlay(self):
        self.fechar_overlay_gravacao()
        self.criar_overlay_gravacao()
        self.overlay_refresh_requested = False

    def fechar_tk_root(self):
        self.fechar_overlay_gravacao()
        if self.tk_root is not None:
            try:
                self.tk_root.destroy()
            except Exception:
                pass
            self.tk_root = None

    def elapsed(self):
        return max(0.0, time.time() - self.last_event_at)

    def escrever_evento(self, evento):
        self.event_index += 1
        evento = {
            "id": self.event_index,
            "created_at": time.time(),
            "delay": round(self.elapsed(), 3),
            **evento,
        }
        self.last_event_at = time.time()
        with self.output.open("a", encoding="utf-8") as arquivo:
            arquivo.write(json.dumps(evento, ensure_ascii=False) + "\n")

    def flush_texto(self):
        if not self.text_buffer:
            return
        texto = "".join(self.text_buffer)
        self.text_buffer = []
        if texto:
            self.escrever_evento({
                "type": "texto_livre",
                "title": "Texto digitado",
                "text": texto,
            })

    def capturar_area_click(self, x, y, largura=None, altura=None, nome=None, crop=None):
        if crop:
            left = max(0, int(crop.get("x", 0)))
            top = max(0, int(crop.get("y", 0)))
            largura = max(40, int(crop.get("width", self.crop_width)))
            altura = max(40, int(crop.get("height", self.crop_height)))
        else:
            largura = max(40, int(largura or self.crop_width))
            altura = max(40, int(altura or self.crop_height))
            half_w = largura // 2
            half_h = altura // 2
            left = max(0, int(x) - half_w)
            top = max(0, int(y) - half_h)
        right = left + largura
        bottom = top + altura
        imagem = ImageGrab.grab(bbox=(left, top, right, bottom))
        nome = nome or f"gravador_click_{self.event_index + 1:04d}.png"
        destino = self.images_dir / nome
        imagem.save(destino)
        return {
            "image_id": f"imagens/gravador/{nome}",
            "crop": {"x": left, "y": top, "width": largura, "height": altura},
            "preview_image": imagem,
        }

    def selecionar_area_na_tela(self, janela_pai, crop_atual):
        root = self.obter_tk_root()
        if root is None:
            return None
        janela_pai.withdraw()
        janela_pai.update_idletasks()
        time.sleep(0.12)
        screenshot = ImageGrab.grab()
        janela_pai.deiconify()

        resultado = {"crop": None}
        seletor = tk.Toplevel(root)
        seletor.overrideredirect(True)
        seletor.attributes("-topmost", True)
        seletor.configure(bg="black")

        largura_tela = screenshot.width
        altura_tela = screenshot.height
        seletor.geometry(f"{largura_tela}x{altura_tela}+0+0")

        canvas = tk.Canvas(seletor, width=largura_tela, height=altura_tela, highlightthickness=0, cursor="crosshair")
        canvas.pack(fill="both", expand=True)

        imagem_tela = screenshot.copy()
        imagem_tela.thumbnail((largura_tela, altura_tela))
        imagem_tk = ImageTk.PhotoImage(imagem_tela)
        canvas.create_image(0, 0, image=imagem_tk, anchor="nw")
        canvas.image_ref = imagem_tk
        canvas.create_rectangle(0, 0, largura_tela, altura_tela, fill="#00111f", stipple="gray50", outline="")

        info = canvas.create_text(
            largura_tela // 2,
            34,
            text="Arraste para selecionar a area do clique  |  Enter confirma  |  Esc cancela",
            fill="#E6F7FF",
            font=("Segoe UI", 13, "bold"),
        )
        canvas.create_rectangle(canvas.bbox(info), fill="#07111F", outline="#12B5CB")
        canvas.tag_raise(info)

        start = {"x": int(crop_atual.get("x", 0)), "y": int(crop_atual.get("y", 0))}
        end = {
            "x": start["x"] + int(crop_atual.get("width", self.crop_width)),
            "y": start["y"] + int(crop_atual.get("height", self.crop_height)),
        }
        rect = canvas.create_rectangle(
            start["x"],
            start["y"],
            end["x"],
            end["y"],
            outline="#12B5CB",
            width=3,
            dash=(10, 5),
        )
        fill = canvas.create_rectangle(
            start["x"],
            start["y"],
            end["x"],
            end["y"],
            outline="",
            fill="#12B5CB",
            stipple="gray25",
        )
        size_text = canvas.create_text(
            end["x"],
            max(16, start["y"] - 12),
            text="",
            fill="#5EEAD4",
            font=("Segoe UI", 10, "bold"),
            anchor="e",
        )

        def crop_normalizado():
            x1 = max(0, min(start["x"], end["x"]))
            y1 = max(0, min(start["y"], end["y"]))
            x2 = min(largura_tela, max(start["x"], end["x"]))
            y2 = min(altura_tela, max(start["y"], end["y"]))
            return {"x": x1, "y": y1, "width": max(40, x2 - x1), "height": max(40, y2 - y1)}

        def desenhar():
            crop = crop_normalizado()
            x1 = crop["x"]
            y1 = crop["y"]
            x2 = x1 + crop["width"]
            y2 = y1 + crop["height"]
            canvas.coords(fill, x1, y1, x2, y2)
            canvas.coords(rect, x1, y1, x2, y2)
            canvas.coords(size_text, x2, max(16, y1 - 12))
            canvas.itemconfigure(size_text, text=f"{crop['width']} x {crop['height']}")
            canvas.tag_raise(fill)
            canvas.tag_raise(rect)
            canvas.tag_raise(size_text)

        def iniciar(event):
            start["x"] = int(event.x)
            start["y"] = int(event.y)
            end["x"] = int(event.x)
            end["y"] = int(event.y)
            desenhar()

        def arrastar(event):
            end["x"] = int(event.x)
            end["y"] = int(event.y)
            desenhar()

        def fechar_seletor():
            seletor.destroy()

        def confirmar(_event=None):
            resultado["crop"] = crop_normalizado()
            fechar_seletor()

        def cancelar(_event=None):
            resultado["crop"] = None
            fechar_seletor()

        canvas.bind("<ButtonPress-1>", iniciar)
        canvas.bind("<B1-Motion>", arrastar)
        canvas.bind("<ButtonRelease-1>", arrastar)
        canvas.bind("<Double-Button-1>", confirmar)
        seletor.bind("<Return>", confirmar)
        seletor.bind("<Escape>", cancelar)
        desenhar()
        seletor.focus_force()
        seletor.wait_window()
        return resultado["crop"]

    def abrir_menu_acao_manual(self, x, y):
        if tk is None:
            return None
        root = self.obter_tk_root()
        if root is None:
            return None

        resultado = {"evento": None}
        active_tab = {"value": "texto"}
        key_capture = {"active": False}
        key_value = {"value": ""}
        destino_var = tk.StringVar(value="Pagina 1")
        cor_fundo = "#07111F"
        cor_card = "#0E1B2E"
        cor_card_2 = "#101A2A"
        cor_borda = "#12B5CB"
        cor_texto = "#E6F7FF"
        cor_suave = "#9CB8C9"
        cor_verde = "#22C55E"

        janela = tk.Toplevel(root)
        janela.overrideredirect(True)
        janela.attributes("-topmost", True)
        janela.configure(bg=cor_borda)
        largura_janela = 400
        altura_janela = 462
        pos_x = min(max(8, int(x) + 18), max(8, root.winfo_screenwidth() - largura_janela - 8))
        pos_y = min(max(8, int(y) + 18), max(8, root.winfo_screenheight() - altura_janela - 8))
        janela.geometry(f"{largura_janela}x{altura_janela}+{pos_x}+{pos_y}")

        frame = tk.Frame(janela, bg=cor_fundo, highlightthickness=1, highlightbackground=cor_borda)
        frame.pack(fill="both", expand=True, padx=1, pady=1)

        def criar_botao(parent, texto, comando, fill, fg, hover_fill=None, outline="#203149", pady=9, font_size=9, height=1):
            wrapper = tk.Frame(parent, bg=outline, padx=1, pady=1)
            label = tk.Label(
                wrapper,
                text=texto,
                bg=fill,
                fg=fg,
                font=("Segoe UI", font_size, "bold"),
                cursor="hand2",
                padx=10,
                pady=pady,
                height=height,
            )
            label.pack(fill="both", expand=True)
            label.normal_bg = fill
            label.normal_fg = fg
            label.hover_bg = hover_fill or fill
            label.bind("<Enter>", lambda _event: label.configure(bg=label.hover_bg, fg=label.normal_fg))
            label.bind("<Leave>", lambda _event: label.configure(bg=label.normal_bg, fg=label.normal_fg))
            label.bind("<Button-1>", lambda _event: comando())
            return wrapper, label

        header = tk.Frame(frame, bg=cor_fundo)
        header.pack(fill="x", padx=14, pady=(13, 8))
        header_left = tk.Frame(header, bg=cor_fundo)
        header_left.pack(side="left", fill="x", expand=True)
        tk.Label(header_left, text="Adicionar bloco", bg=cor_fundo, fg=cor_texto, font=("Segoe UI", 13, "bold")).pack(anchor="w")
        tk.Label(header_left, text="Crie texto ou tecla sem digitar na tela alvo.", bg=cor_fundo, fg=cor_suave, font=("Segoe UI", 8)).pack(anchor="w", pady=(2, 0))
        tk.Label(header, text="GRAVADOR", bg="#123044", fg="#5EEAD4", font=("Segoe UI", 7, "bold"), padx=8, pady=4).pack(side="right", anchor="n")

        tabs = tk.Frame(frame, bg=cor_fundo)
        tabs.pack(fill="x", padx=14, pady=(0, 10))
        tab_buttons = {}
        content = tk.Frame(frame, bg=cor_fundo)
        content.pack(fill="both", expand=True, padx=14)
        text_panel = tk.Frame(content, bg=cor_fundo)
        key_panel = tk.Frame(content, bg=cor_fundo)

        def mostrar_aba(nome):
            active_tab["value"] = nome
            text_panel.pack_forget()
            key_panel.pack_forget()
            (text_panel if nome == "texto" else key_panel).pack(fill="both", expand=True)
            for tab_name, (_wrap, label) in tab_buttons.items():
                ativo = tab_name == nome
                label.normal_bg = cor_borda if ativo else cor_card_2
                label.normal_fg = "#04111B" if ativo else cor_texto
                label.hover_bg = cor_borda if ativo else "#162234"
                label.configure(bg=label.normal_bg, fg=label.normal_fg)

        for nome, texto in (("texto", "Texto"), ("tecla", "Tecla")):
            slot = tk.Frame(tabs, bg=cor_fundo)
            slot.pack(side="left", fill="x", expand=True, padx=(0, 8))
            botao = criar_botao(slot, texto, lambda value=nome: mostrar_aba(value), cor_card_2, cor_texto, hover_fill="#162234", outline="#223650", pady=7)
            botao[0].pack(fill="x")
            tab_buttons[nome] = botao

        texto_card = tk.Frame(text_panel, bg=cor_card, highlightthickness=1, highlightbackground="#16314A")
        texto_card.pack(fill="both", expand=True)
        tk.Label(texto_card, text="TEXTO DO BLOCO", bg=cor_card, fg="#7DD3FC", font=("Segoe UI", 7, "bold")).pack(anchor="w", padx=10, pady=(9, 4))
        texto_input = tk.Text(texto_card, height=7, bg="#070D18", fg=cor_texto, insertbackground=cor_texto, relief="flat", font=("Segoe UI", 10), wrap="word")
        texto_input.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        key_card = tk.Frame(key_panel, bg=cor_card, highlightthickness=1, highlightbackground="#16314A")
        key_card.pack(fill="both", expand=True)
        tk.Label(key_card, text="TECLA DO BLOCO", bg=cor_card, fg="#7DD3FC", font=("Segoe UI", 7, "bold")).pack(anchor="w", padx=10, pady=(9, 6))
        key_label = tk.Label(key_card, text="Nenhuma tecla gravada", bg="#070D18", fg=cor_suave, font=("Segoe UI", 11, "bold"), padx=10, pady=14)
        key_label.pack(fill="x", padx=10, pady=(0, 10))

        def gravar_tecla():
            key_capture["active"] = True
            key_label.configure(text="Pressione a tecla agora...", fg="#5EEAD4")
            janela.focus_force()

        gravar_btn, _ = criar_botao(key_card, "Gravar tecla", gravar_tecla, cor_card_2, cor_texto, hover_fill="#162234", outline="#223650", pady=10)
        gravar_btn.pack(fill="x", padx=10, pady=(0, 12))
        repeat_wrap = tk.Frame(key_card, bg=cor_card_2, highlightthickness=1, highlightbackground="#203149")
        repeat_wrap.pack(fill="x", padx=10, pady=(0, 10))
        tk.Label(repeat_wrap, text="REPETIR QUANTAS VEZES", bg=cor_card_2, fg=cor_suave, font=("Segoe UI", 7, "bold")).pack(anchor="w", padx=9, pady=(7, 2))
        repeat_var = tk.IntVar(value=1)
        repeat_input = tk.Spinbox(repeat_wrap, from_=1, to=999, increment=1, textvariable=repeat_var, bg="#070D18", fg=cor_texto, buttonbackground="#142033", insertbackground=cor_texto, relief="flat", justify="center")
        repeat_input.pack(fill="x", padx=8, pady=(2, 8), ipady=4)

        destino_wrap = tk.Frame(frame, bg=cor_fundo)
        destino_wrap.pack(fill="x", padx=14, pady=(10, 0))
        tk.Label(destino_wrap, text="CRIAR NA PAGINA", bg=cor_fundo, fg="#7DD3FC", font=("Segoe UI", 7, "bold")).pack(anchor="w")
        destino_select = ttk.Combobox(
            destino_wrap,
            textvariable=destino_var,
            values=[label for label, _sequencia in PAGINAS_GRAVADOR],
            state="readonly",
        )
        destino_select.pack(fill="x", pady=(5, 0), ipady=4)

        def normalizar_tecla_tk(event):
            if event.char and len(event.char) == 1 and event.keysym not in {"Return", "Tab", "BackSpace", "Escape"}:
                return event.char
            mapa = {"Return": "enter", "Tab": "tab", "BackSpace": "backspace", "space": "space", "Delete": "delete", "Escape": "esc", "Up": "up", "Down": "down", "Left": "left", "Right": "right", "Home": "home", "End": "end", "Prior": "page_up", "Next": "page_down"}
            return mapa.get(event.keysym, str(event.keysym).lower())

        def fechar_janela():
            janela.destroy()

        def cancelar():
            self.pending_click = None
            resultado["evento"] = None
            fechar_janela()

        def on_key_press(event):
            if key_capture["active"]:
                tecla = normalizar_tecla_tk(event)
                key_value["value"] = tecla
                key_capture["active"] = False
                key_label.configure(text=tecla.upper(), fg=cor_texto)
                return "break"
            if event.keysym == "Escape":
                cancelar()
                return "break"
            return None

        actions = tk.Frame(frame, bg=cor_fundo)
        actions.pack(side="bottom", fill="x", padx=14, pady=(8, 13))

        def confirmar():
            self.pending_click = None
            if active_tab["value"] == "texto":
                texto = texto_input.get("1.0", "end").strip()
                if texto:
                    resultado["evento"] = {
                        "type": "texto_livre",
                        "title": "Texto manual",
                        "text": texto,
                        **pagina_gravador_payload(destino_var.get()),
                    }
            else:
                tecla = key_value["value"].strip()
                if tecla:
                    try:
                        repeat = max(1, int(repeat_var.get() or 1))
                    except Exception:
                        repeat = 1
                    resultado["evento"] = {
                        "type": "tecla",
                        "title": f"Tecla {tecla.upper()}",
                        "keys": tecla,
                        "repeat": repeat,
                        **pagina_gravador_payload(destino_var.get()),
                    }
            fechar_janela()

        confirm_slot = tk.Frame(actions, bg=cor_fundo)
        confirm_slot.pack(side="left", fill="x", expand=True, padx=(0, 8))
        cancel_slot = tk.Frame(actions, bg=cor_fundo)
        cancel_slot.pack(side="left", fill="x", expand=True)
        confirm_btn, _ = criar_botao(confirm_slot, "Adicionar bloco", confirmar, cor_verde, "white", hover_fill="#16A34A", outline="#2FE874", pady=10, font_size=10, height=2)
        confirm_btn.pack(fill="x")
        cancel_btn, _ = criar_botao(cancel_slot, "Cancelar", cancelar, "#162234", cor_texto, hover_fill="#1E2B40", outline="#26364F", pady=10, font_size=10, height=2)
        cancel_btn.pack(fill="x")

        janela.bind("<KeyPress>", on_key_press)
        mostrar_aba("texto")
        texto_input.focus_set()
        janela.wait_window()
        return resultado["evento"]

    def confirmar_click_na_tela(self, x, y, button):
        if tk is None or ttk is None:
            captura = self.capturar_area_click(x, y)
            captura.pop("preview_image", None)
            return {
                "type": "clicar_imagem",
                "title": "Clique visual",
                "x": int(x),
                "y": int(y),
                "button": normalizar_botao(button),
                "clicks": 1,
                "click_action": "clicar",
                "confidence": 0.82,
                "confirmed": True,
                "target_sequence": "principal",
                **captura,
            }

        nome_imagem = f"gravador_click_{self.event_index + 1:04d}.png"
        largura_var = None
        altura_var = None
        cliques_var = None
        destino_var = tk.StringVar(value="Pagina 1")
        crop_var = {
            "x": max(0, int(x) - self.crop_width // 2),
            "y": max(0, int(y) - self.crop_height // 2),
            "width": self.crop_width,
            "height": self.crop_height,
        }
        resultado = {"evento": None}

        root = self.obter_tk_root()
        if root is None:
            return None

        janela = tk.Toplevel(root)
        janela.overrideredirect(True)
        janela.attributes("-topmost", True)
        janela.configure(bg="#12B5CB")

        largura_janela = 400
        altura_janela = 540
        tela_largura = root.winfo_screenwidth()
        tela_altura = root.winfo_screenheight()
        pos_x = min(max(8, int(x) + 18), max(8, tela_largura - largura_janela - 8))
        pos_y = min(max(8, int(y) + 18), max(8, tela_altura - altura_janela - 8))
        janela.geometry(f"{largura_janela}x{altura_janela}+{pos_x}+{pos_y}")

        largura_var = tk.IntVar(value=self.crop_width)
        altura_var = tk.IntVar(value=self.crop_height)
        cliques_var = tk.StringVar(value="1 clique")

        cor_fundo = "#07111F"
        cor_card = "#0E1B2E"
        cor_card_2 = "#101A2A"
        cor_borda = "#12B5CB"
        cor_texto = "#E6F7FF"
        cor_suave = "#9CB8C9"
        cor_verde = "#22C55E"

        def desenhar_retangulo_arredondado(canvas, x1, y1, x2, y2, raio, fill, outline=""):
            canvas.create_rectangle(x1 + raio, y1, x2 - raio, y2, fill=fill, outline=outline)
            canvas.create_rectangle(x1, y1 + raio, x2, y2 - raio, fill=fill, outline=outline)
            canvas.create_arc(x1, y1, x1 + raio * 2, y1 + raio * 2, start=90, extent=90, fill=fill, outline=outline)
            canvas.create_arc(x2 - raio * 2, y1, x2, y1 + raio * 2, start=0, extent=90, fill=fill, outline=outline)
            canvas.create_arc(x2 - raio * 2, y2 - raio * 2, x2, y2, start=270, extent=90, fill=fill, outline=outline)
            canvas.create_arc(x1, y2 - raio * 2, x1 + raio * 2, y2, start=180, extent=90, fill=fill, outline=outline)

        def criar_botao_pill(parent, texto, comando, fill, fg, hover_fill=None, outline="#203149", altura=38):
            canvas = tk.Canvas(parent, height=altura, bg=parent["bg"], highlightthickness=0, bd=0, cursor="hand2")
            canvas.pack_propagate(False)

            def render(cor):
                canvas.delete("all")
                canvas.update_idletasks()
                largura = max(80, canvas.winfo_width())
                desenhar_retangulo_arredondado(canvas, 1, 1, largura - 1, altura - 1, 15, cor, outline)
                canvas.create_text(
                    largura // 2,
                    altura // 2,
                    text=texto,
                    fill=getattr(canvas, "fg_atual", fg),
                    font=("Segoe UI", 9, "bold"),
                )

            def on_click(_event=None):
                comando()

            canvas.bind("<Configure>", lambda _event: render(fill))
            canvas.bind("<Enter>", lambda _event: render(hover_fill or fill))
            canvas.bind("<Leave>", lambda _event: render(fill))
            canvas.bind("<Button-1>", on_click)
            return canvas, render

        def criar_botao_estavel(parent, texto, comando, fill, fg, hover_fill=None, outline="#203149", pady=8, font_size=9, height=1):
            wrapper = tk.Frame(parent, bg=outline, padx=1, pady=1)
            label = tk.Label(
                wrapper,
                text=texto,
                bg=fill,
                fg=fg,
                font=("Segoe UI", font_size, "bold"),
                cursor="hand2",
                padx=10,
                pady=pady,
                height=height,
            )
            label.pack(fill="both", expand=True)
            label.bind("<Enter>", lambda _event: label.configure(bg=getattr(label, "hover_bg", hover_fill or fill), fg=getattr(label, "normal_fg", fg)))
            label.bind("<Leave>", lambda _event: label.configure(bg=getattr(label, "normal_bg", fill), fg=getattr(label, "normal_fg", fg)))
            label.bind("<Button-1>", lambda _event: comando())
            label.normal_bg = fill
            label.normal_fg = fg
            label.hover_bg = hover_fill or fill
            return wrapper, label

        frame = tk.Frame(janela, bg=cor_fundo, highlightthickness=1, highlightbackground=cor_borda)
        frame.pack(fill="both", expand=True, padx=1, pady=1)
        header_wrap = tk.Frame(frame, bg=cor_fundo)
        header_wrap.pack(fill="x", padx=14, pady=(13, 7))
        header_left = tk.Frame(header_wrap, bg=cor_fundo)
        header_left.pack(side="left", fill="x", expand=True)
        header = tk.Label(
            header_left,
            text="Clique visual",
            bg=cor_fundo,
            fg=cor_texto,
            font=("Segoe UI", 13, "bold"),
        )
        header.pack(anchor="w")
        hint = tk.Label(
            header_left,
            text="Confirme a area que o FlowDetect deve procurar.",
            bg=cor_fundo,
            fg=cor_suave,
            font=("Segoe UI", 8),
        )
        hint.pack(anchor="w", pady=(2, 0))
        tk.Label(
            header_wrap,
            text="RECONHECIMENTO",
            bg="#123044",
            fg="#5EEAD4",
            font=("Segoe UI", 7, "bold"),
            padx=7,
            pady=4,
        ).pack(side="right", anchor="n")

        preview_card = tk.Frame(
            frame,
            bg=cor_card,
            highlightthickness=1,
            highlightbackground="#16314A",
        )
        preview_card.pack(fill="x", padx=14, pady=(0, 10))
        tk.Label(
            preview_card,
            text="PREVIEW DA AREA",
            bg=cor_card,
            fg="#7DD3FC",
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w", padx=10, pady=(8, 4))

        preview_box = tk.Label(
            preview_card,
            bg="#050A12",
            bd=0,
            width=326,
            height=116,
            anchor="center",
            compound="center",
        )
        preview_box.pack(fill="x", padx=10, pady=(0, 10), ipady=4)
        preview_box.image_ref = None

        def valor_inteiro(variable, fallback):
            try:
                return max(40, int(variable.get() or fallback))
            except Exception:
                variable.set(fallback)
                return max(40, int(fallback))

        def atualizar_preview():
            janela.withdraw()
            janela.update_idletasks()
            time.sleep(0.08)
            try:
                captura = self.capturar_area_click(
                    x,
                    y,
                    valor_inteiro(largura_var, self.crop_width),
                    valor_inteiro(altura_var, self.crop_height),
                    nome_imagem,
                    crop=crop_var,
                )
            finally:
                janela.deiconify()
                janela.attributes("-topmost", True)
                janela.lift()
            imagem = captura["preview_image"].copy()
            imagem.thumbnail((326, 116))
            imagem_tk = ImageTk.PhotoImage(imagem)
            preview_box.configure(image=imagem_tk)
            preview_box.image_ref = imagem_tk
            return captura

        controls = tk.Frame(frame, bg=cor_fundo)
        controls.pack(fill="x", padx=14)

        def add_field(col, label, variable, values=None):
            wrapper = tk.Frame(
                controls,
                bg=cor_card_2,
                highlightthickness=1,
                highlightbackground="#203149",
            )
            wrapper.grid(row=0, column=col, sticky="ew", padx=(0 if col == 0 else 6, 0))
            tk.Label(wrapper, text=label, bg=cor_card_2, fg=cor_suave, font=("Segoe UI", 7, "bold")).pack(anchor="w", padx=9, pady=(7, 2))
            if values:
                widget = ttk.Combobox(wrapper, textvariable=variable, values=values, state="readonly", width=7)
            else:
                widget = tk.Spinbox(
                    wrapper,
                    from_=40,
                    to=800,
                    increment=10,
                    textvariable=variable,
                    width=7,
                    bg="#070D18",
                    fg=cor_texto,
                    buttonbackground="#142033",
                    insertbackground=cor_texto,
                    relief="flat",
                    justify="center",
                )
            widget.pack(fill="x", padx=8, pady=(2, 8), ipady=3)
            return widget

        controls.grid_columnconfigure(0, weight=1)
        controls.grid_columnconfigure(1, weight=1)
        largura_input = add_field(0, "Largura", largura_var)
        altura_input = add_field(1, "Altura", altura_var)

        action_choice = tk.Frame(frame, bg=cor_fundo)
        action_choice.pack(fill="x", padx=14, pady=(10, 0))
        tk.Label(
            action_choice,
            text="ACAO DO BLOCO",
            bg=cor_fundo,
            fg="#7DD3FC",
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w")
        action_buttons = {}
        action_buttons_row = tk.Frame(action_choice, bg=cor_fundo)
        action_buttons_row.pack(fill="x", pady=(6, 0))

        def selecionar_acao(valor):
            self.pending_click = None
            cliques_var.set(valor)
            for item_valor, controls_btn in action_buttons.items():
                ativo = item_valor == valor
                _wrapper, label_btn = controls_btn
                label_btn.normal_bg = cor_borda if ativo else cor_card_2
                label_btn.normal_fg = "#04111B" if ativo else cor_texto
                label_btn.hover_bg = cor_borda if ativo else "#162234"
                label_btn.configure(
                    bg=label_btn.normal_bg,
                    fg=label_btn.normal_fg,
                )

        for valor, texto in (("1 clique", "1 clique"), ("2 cliques", "2 cliques"), ("So identificar", "So identificar")):
            slot = tk.Frame(action_buttons_row, bg=cor_fundo)
            slot.pack(side="left", fill="x", expand=True, padx=(0, 7))
            botao, label_botao = criar_botao_estavel(
                slot,
                texto,
                lambda value=valor: selecionar_acao(value),
                cor_card_2,
                cor_texto,
                hover_fill="#162234",
                outline="#223650",
                pady=7,
                font_size=8,
            )
            botao.pack(fill="x")
            action_buttons[valor] = (botao, label_botao)
        selecionar_acao(cliques_var.get())

        destino_wrap = tk.Frame(frame, bg=cor_fundo)
        destino_wrap.pack(fill="x", padx=14, pady=(10, 0))
        tk.Label(
            destino_wrap,
            text="CRIAR NA PAGINA",
            bg=cor_fundo,
            fg="#7DD3FC",
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w")
        destino_select = ttk.Combobox(
            destino_wrap,
            textvariable=destino_var,
            values=[label for label, _sequencia in PAGINAS_GRAVADOR],
            state="readonly",
        )
        destino_select.pack(fill="x", pady=(5, 0), ipady=4)

        actions = tk.Frame(frame, bg=cor_fundo)
        actions.pack(side="bottom", fill="x", padx=14, pady=(8, 13))

        def selecionar_area():
            novo_crop = self.selecionar_area_na_tela(janela, crop_var)
            if not novo_crop:
                return
            crop_var.update(novo_crop)
            largura_var.set(novo_crop["width"])
            altura_var.set(novo_crop["height"])
            atualizar_preview()
            pos_x = min(max(8, novo_crop["x"] + novo_crop["width"] + 18), max(8, janela.winfo_screenwidth() - largura_janela - 8))
            pos_y = min(max(8, novo_crop["y"]), max(8, janela.winfo_screenheight() - altura_janela - 8))
            janela.geometry(f"{largura_janela}x{altura_janela}+{pos_x}+{pos_y}")

        def fechar_janela():
            janela.destroy()

        def confirmar():
            self.pending_click = None
            captura = atualizar_preview()
            captura.pop("preview_image", None)
            resultado["evento"] = {
                "type": "clicar_imagem",
                "title": "Clique visual",
                "x": int(x),
                "y": int(y),
                "button": normalizar_botao(button),
                "click_action": "identificar" if cliques_var.get() == "So identificar" else "clicar",
                "clicks": 0 if cliques_var.get() == "So identificar" else (2 if cliques_var.get() == "2 cliques" else 1),
                "confidence": 0.82,
                "confirmed": True,
                **pagina_gravador_payload(destino_var.get()),
                **captura,
            }
            fechar_janela()

        def cancelar():
            self.pending_click = None
            resultado["evento"] = None
            fechar_janela()

        area_button, _ = criar_botao_estavel(
            actions,
            "Selecionar area manual",
            selecionar_area,
            cor_card_2,
            cor_texto,
            hover_fill="#162234",
            outline="#223650",
            pady=11,
            font_size=9,
            height=1,
        )
        area_button.pack(fill="x", pady=(0, 10))

        bottom_actions = tk.Frame(actions, bg=cor_fundo)
        bottom_actions.pack(fill="x")
        confirm_slot = tk.Frame(bottom_actions, bg=cor_fundo)
        confirm_slot.pack(side="left", fill="x", expand=True, padx=(0, 8))
        cancel_slot = tk.Frame(bottom_actions, bg=cor_fundo)
        cancel_slot.pack(side="left", fill="x", expand=True)
        confirm_button, _ = criar_botao_estavel(
            confirm_slot,
            "Confirmar area",
            confirmar,
            cor_verde,
            "white",
            hover_fill="#16A34A",
            outline="#2FE874",
            pady=10,
            font_size=10,
            height=2,
        )
        confirm_button.pack(fill="x")
        cancel_button, _ = criar_botao_estavel(
            cancel_slot,
            "Cancelar",
            cancelar,
            "#162234",
            cor_texto,
            hover_fill="#1E2B40",
            outline="#26364F",
            pady=10,
            font_size=10,
            height=2,
        )
        cancel_button.pack(fill="x")

        def atualizar_por_campos(_event=None):
            largura = valor_inteiro(largura_var, self.crop_width)
            altura = valor_inteiro(altura_var, self.crop_height)
            crop_var.update({
                "x": max(0, int(x) - largura // 2),
                "y": max(0, int(y) - altura // 2),
                "width": largura,
                "height": altura,
            })
            atualizar_preview()

        for widget in (largura_input, altura_input):
            widget.bind("<Return>", atualizar_por_campos)
        janela.bind("<Escape>", lambda _event: cancelar())
        atualizar_preview()
        janela.focus_force()
        janela.wait_window()
        return resultado["evento"]

    def ao_clicar(self, x, y, button, pressed):
        if not self.running or self.stop_flag.exists():
            return False
        if self.paused:
            return True
        if self.confirmando_click:
            return True
        if not pressed:
            return True
        if int(y) <= 24:
            return True
        tipo_menu = "manual" if normalizar_botao(button) == "right" else "visual"
        self.pending_click = (tipo_menu, x, y, button, time.time())
        return True

    def processar_click_pendente(self):
        if not self.pending_click or self.confirmando_click or self.paused:
            return
        tipo_menu, x, y, button, clicked_at = self.pending_click
        self.pending_click = None
        action_delay = max(0.0, clicked_at - self.last_event_at)
        self.confirmando_click = True
        try:
            self.fechar_overlay_gravacao()
            if tipo_menu == "manual":
                evento = self.abrir_menu_acao_manual(x, y)
            else:
                evento = self.confirmar_click_na_tela(x, y, button)
            if evento:
                evento["delay"] = round(action_delay, 3)
                self.escrever_evento(evento)
        finally:
            self.confirmando_click = False
            self.ignore_keyboard_until = time.time() + 0.45
            if self.running and not self.stop_flag.exists():
                self.criar_overlay_gravacao()

    def ao_teclar(self, key):
        if not self.running or self.stop_flag.exists():
            return False
        if time.time() < self.ignore_keyboard_until:
            return True
        if key == keyboard.Key.f10:
            self.paused = not self.paused
            self.pending_click = None
            self.overlay_refresh_requested = True
            return True
        if self.paused:
            return True
        if self.confirmando_click:
            return True
        if key == keyboard.Key.esc:
            self.running = False
            return False
        return True

    def executar(self):
        self.escrever_evento({"type": "status", "title": "Gravacao iniciada"})
        self.criar_overlay_gravacao()
        mouse_listener = mouse.Listener(on_click=self.ao_clicar)
        keyboard_listener = keyboard.Listener(on_press=self.ao_teclar)
        mouse_listener.start()
        keyboard_listener.start()
        try:
            while self.running and not self.stop_flag.exists():
                if self.overlay_refresh_requested:
                    self.atualizar_estado_overlay()
                self.atualizar_overlay_gravacao()
                self.processar_click_pendente()
                time.sleep(0.15)
        finally:
            self.running = False
            mouse_listener.stop()
            keyboard_listener.stop()
            self.fechar_tk_root()
            self.escrever_evento({"type": "status", "title": "Gravacao finalizada"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--recrop", action="store_true")
    parser.add_argument("--event-json", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--stop-flag", required=True)
    parser.add_argument("--crop-width", type=int, default=180)
    parser.add_argument("--crop-height", type=int, default=110)
    parser.add_argument("--clicks", type=int, default=1)
    parser.add_argument("--click-action", default="clicar")
    args = parser.parse_args()
    if args.recrop:
        evento = json.loads(args.event_json)
        x = int(evento.get("x", 0))
        y = int(evento.get("y", 0))
        largura = max(40, int(args.crop_width or 180))
        altura = max(40, int(args.crop_height or 110))
        left = max(0, x - largura // 2)
        top = max(0, y - altura // 2)
        imagem = ImageGrab.grab(bbox=(left, top, left + largura, top + altura))
        images_dir = Path(args.images_dir)
        images_dir.mkdir(parents=True, exist_ok=True)
        nome = Path(str(evento.get("image_id", ""))).name or f"gravador_click_{int(evento.get('id', 0)):04d}.png"
        destino = images_dir / nome
        imagem.save(destino)
        evento.update({
            "image_id": f"imagens/gravador/{nome}",
            "crop": {"x": left, "y": top, "width": largura, "height": altura},
            "click_action": "identificar" if str(args.click_action).lower() == "identificar" else "clicar",
            "clicks": 0 if str(args.click_action).lower() == "identificar" else (2 if int(args.clicks or 1) >= 2 else 1),
            "confirmed": True,
        })
        print(json.dumps(evento, ensure_ascii=False), flush=True)
        return
    GravadorInteligente(
        args.output,
        args.images_dir,
        args.stop_flag,
        args.crop_width,
        args.crop_height,
    ).executar()


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:
        print(json.dumps({"erro": str(erro)}), flush=True)
        sys.exit(1)
