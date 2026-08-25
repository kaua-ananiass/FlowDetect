import argparse
import hashlib
import json
import sys
import time
from pathlib import Path


MAP_CACHE = {}


def carregar_uiautomation():
    try:
        import uiautomation as auto

        return auto
    except Exception as erro:
        return None, erro


def erro_dependencia(erro):
    return {
        "ok": False,
        "erro": (
            "A biblioteca uiautomation nao esta instalada. "
            "Instale com: python -m pip install uiautomation"
        ),
        "detalhe": str(erro),
    }


def texto_curto(valor, limite=120):
    texto = str(valor or "").replace("\r", " ").replace("\n", " ").strip()
    return texto if len(texto) <= limite else texto[: limite - 3] + "..."


def rect_to_dict(rect):
    try:
        left = int(rect.left)
        top = int(rect.top)
        right = int(rect.right)
        bottom = int(rect.bottom)
    except Exception:
        left = top = right = bottom = 0
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": max(0, right - left),
        "height": max(0, bottom - top),
    }


def control_prop(control, attr, default=""):
    try:
        value = getattr(control, attr)
        return value() if callable(value) else value
    except Exception:
        return default


def pattern_names(control):
    patterns = []
    candidates = [
        ("ValuePattern", "GetValuePattern"),
        ("InvokePattern", "GetInvokePattern"),
        ("TogglePattern", "GetTogglePattern"),
        ("SelectionItemPattern", "GetSelectionItemPattern"),
        ("ExpandCollapsePattern", "GetExpandCollapsePattern"),
        ("RangeValuePattern", "GetRangeValuePattern"),
        ("GridPattern", "GetGridPattern"),
        ("TablePattern", "GetTablePattern"),
    ]
    for label, getter in candidates:
        try:
            getattr(control, getter)()
            patterns.append(label)
        except Exception:
            pass
    return patterns


def classify(control_type, class_name, capabilities):
    ctype = str(control_type or "")
    cls = str(class_name or "")
    caps = set(capabilities or [])
    if ctype == "EditControl" and "ValuePattern" in caps:
        return "input_text", "texto editavel", "set_text"
    if ctype == "ComboBoxControl" and "ExpandCollapsePattern" in caps:
        return "combo_select", "combo de selecao", "select_option"
    if ctype == "ComboBoxControl" and "ValuePattern" in caps:
        return "combo_select", "combo editavel", "set_or_select"
    if ctype == "ButtonControl" and "InvokePattern" in caps:
        return "button_click", "botao", "click"
    if ctype == "CheckBoxControl" and "TogglePattern" in caps:
        return "checkbox_toggle", "checkbox", "toggle"
    if ctype == "RadioButtonControl" and ({"SelectionItemPattern", "TogglePattern"} & caps):
        return "radio_select", "opcao unica", "select"
    if ctype == "TabItemControl" and "SelectionItemPattern" in caps:
        return "tab_select", "aba", "select_tab"
    if ctype == "MenuItemControl" and "InvokePattern" in caps:
        return "menu_action", "menu clicavel", "click"
    if ctype == "MenuItemControl" and "ExpandCollapsePattern" in caps:
        return "menu_action", "menu expansivel", "expand"
    if ctype in {"DataGridControl", "TableControl", "DataItemControl"} or "TcxGrid" in cls:
        return "grid_read", "grade/tabela", "read_grid"
    if ctype in {"TextControl", "LabelControl"} and "ValuePattern" not in caps:
        return "text_read", "texto", "read_text"
    if ctype in {"PaneControl", "GroupControl", "WindowControl", "MenuBarControl"}:
        return "container_reference", "container", "reference_only"
    return "container_reference", "elemento", "reference_only"


def montar_selector(element, siblings):
    warnings = []
    control_type = element.get("control_type", "")
    aid = element.get("automation_id", "")
    name = element.get("name", "")
    class_name = element.get("class_name", "")
    parent = element.get("parent", "")

    candidates = []
    if aid and control_type:
        candidates.append(("automation_id_control_type", {"automation_id": aid, "control_type": control_type}, "FORTE"))
    if aid:
        candidates.append(("automation_id", {"automation_id": aid}, "FORTE"))
    if name and control_type:
        candidates.append(("name_control_type", {"name": name, "control_type": control_type}, "MEDIO"))
    if class_name and name and parent:
        candidates.append(("class_name_parent_name", {"class_name": class_name, "name": name, "parent": parent}, "MEDIO"))
    candidates.append(("hierarchy_path", {"path": element.get("path", "")}, "FRAGIL"))

    for strategy, query, quality in candidates:
        match_count = 0
        for item in siblings:
            if all(str(item.get(k, "")) == str(v) for k, v in query.items()):
                match_count += 1
        if match_count <= 1:
            return {"strategy": strategy, "query": query, "quality": quality, "match_count": max(1, match_count), "warnings": warnings}

    warnings.append("Seletor nao unico. O caminho hierarquico sera usado como fallback.")
    return {
        "strategy": "hierarchy_path_index",
        "query": {"path": element.get("path", ""), "index": element.get("index", 0)},
        "quality": "FRAGIL",
        "match_count": 2,
        "warnings": warnings,
    }


def control_to_element(control, depth, index, parent_path, parent_name):
    control_type = str(control_prop(control, "ControlTypeName", ""))
    name = texto_curto(control_prop(control, "Name", ""))
    automation_id = texto_curto(control_prop(control, "AutomationId", ""))
    class_name = texto_curto(control_prop(control, "ClassName", ""))
    framework_id = texto_curto(control_prop(control, "FrameworkId", ""))
    rect = rect_to_dict(control_prop(control, "BoundingRectangle", None))
    path = f"{parent_path}/{control_type or 'Control'}[{index}]"
    capabilities = pattern_names(control)
    block_type, field_kind, action = classify(control_type, class_name, capabilities)
    visible = not bool(control_prop(control, "IsOffscreen", False))
    enabled = bool(control_prop(control, "IsEnabled", False))
    handle = int(control_prop(control, "NativeWindowHandle", 0) or 0)
    item = {
        "id": hashlib.sha1(f"{path}|{name}|{automation_id}|{class_name}|{rect}".encode("utf-8")).hexdigest()[:16],
        "name": name,
        "automation_id": automation_id,
        "control_type": control_type,
        "class_name": class_name,
        "framework_id": framework_id,
        "process_id": int(control_prop(control, "ProcessId", 0) or 0),
        "handle": handle,
        "bounding_rectangle": rect,
        "is_enabled": enabled,
        "is_visible": visible and rect["width"] > 0 and rect["height"] > 0,
        "is_offscreen": bool(control_prop(control, "IsOffscreen", False)),
        "help_text": texto_curto(control_prop(control, "HelpText", "")),
        "access_key": texto_curto(control_prop(control, "AccessKey", "")),
        "accelerator_key": texto_curto(control_prop(control, "AcceleratorKey", "")),
        "parent": parent_name,
        "children": [],
        "depth": depth,
        "path": path,
        "index": index,
        "capabilities": capabilities,
        "block_type": block_type,
        "field_kind": field_kind,
        "recommended_action": action,
        "actionable": action not in {"reference_only", "read_text", "read_grid"},
        "editable": block_type == "input_text",
        "clickable": action == "click",
        "selectable": action in {"select", "select_option", "set_or_select", "select_tab"},
        "expandable": action == "expand",
        "readable": action in {"read_text", "read_grid"},
        "visible": visible,
        "enabled": enabled,
        "warnings": [],
    }
    return item


def scan_children(control, depth, parent_path, parent_name, flat, max_depth, max_items):
    if depth > max_depth or len(flat) >= max_items:
        return []
    children = []
    try:
        controls = control.GetChildren()
    except Exception:
        controls = []
    for index, child in enumerate(controls):
        try:
            item = control_to_element(child, depth, index, parent_path, parent_name)
            flat.append(item)
            item["children"] = scan_children(child, depth + 1, item["path"], item.get("name") or item.get("control_type"), flat, max_depth, max_items)
            children.append(item)
        except Exception as erro:
            flat.append({
                "id": hashlib.sha1(f"{parent_path}/erro/{index}".encode("utf-8")).hexdigest()[:16],
                "name": "Elemento ignorado",
                "control_type": "Unknown",
                "class_name": "",
                "depth": depth,
                "path": f"{parent_path}/erro[{index}]",
                "warnings": [str(erro)],
                "children": [],
            })
    return children


def context_signature(root):
    base = "|".join([
        str(root.get("name", "")),
        str(root.get("class_name", "")),
        str(root.get("process_id", "")),
        str(root.get("handle", "")),
    ])
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def scan_window(title="", hwnd=0, max_depth=8, max_items=700):
    loaded = carregar_uiautomation()
    if isinstance(loaded, tuple):
        return erro_dependencia(loaded[1])
    auto = loaded
    started = time.perf_counter()
    try:
        if hwnd:
            root_control = auto.ControlFromHandle(int(hwnd))
        elif str(title or "").strip():
            root_control = auto.WindowControl(searchDepth=1, Name=str(title).strip())
            if not root_control.Exists(1):
                root_control = auto.GetForegroundControl()
        else:
            root_control = auto.GetForegroundControl()
    except Exception as erro:
        return {"ok": False, "erro": f"Nao foi possivel acessar a janela: {erro}"}

    flat = []
    root = control_to_element(root_control, 0, 0, "", "")
    flat.append(root)
    root["children"] = scan_children(root_control, 1, root["path"], root.get("name") or "Janela", flat, max_depth, max_items)
    for item in flat:
        item["selector"] = montar_selector(item, flat)
        item["selector_quality"] = item["selector"]["quality"]
        item["confidence"] = "alta" if item["selector_quality"] == "FORTE" else "media" if item["selector_quality"] == "MEDIO" else "baixa"
        item["warnings"].extend(item["selector"].get("warnings") or [])
    signature = context_signature(root)
    result = {
        "ok": True,
        "source": "uiautomation",
        "duration_ms": int((time.perf_counter() - started) * 1000),
        "context_signature": signature,
        "source_window": {
            "title": root.get("name", ""),
            "class_name": root.get("class_name", ""),
            "process_id": root.get("process_id", 0),
            "handle": root.get("handle", 0),
            "bounding_rectangle": root.get("bounding_rectangle", {}),
        },
        "source_tab": root.get("name", ""),
        "count": len(flat),
        "tree": root,
        "elements": flat,
        "warnings": [] if len(flat) < max_items else ["Mapa limitado para evitar travamento da interface."],
    }
    MAP_CACHE[signature] = result
    return result


def find_from_point(x=None, y=None):
    loaded = carregar_uiautomation()
    if isinstance(loaded, tuple):
        return erro_dependencia(loaded[1])
    auto = loaded
    try:
        if x is not None and y is not None and hasattr(auto, "ControlFromPoint"):
            control = auto.ControlFromPoint(int(x), int(y))
        else:
            control = auto.ControlFromCursor()
        item = control_to_element(control, 0, 0, "", "")
        item["selector"] = montar_selector(item, [item])
        item["selector_quality"] = item["selector"]["quality"]
        item["confidence"] = "alta" if item["selector_quality"] == "FORTE" else "media"
        return {"ok": True, "element": item}
    except Exception as erro:
        return {"ok": False, "erro": f"Nao consegui identificar o elemento abaixo do mouse: {erro}"}


def capture_click_with_win32_hook(timeout=12):
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    WH_MOUSE_LL = 14
    WM_LBUTTONDOWN = 0x0201
    WM_RBUTTONDOWN = 0x0204
    WM_MBUTTONDOWN = 0x0207
    PM_REMOVE = 0x0001

    class POINT(ctypes.Structure):
        _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

    class MSLLHOOKSTRUCT(ctypes.Structure):
        _fields_ = [
            ("pt", POINT),
            ("mouseData", wintypes.DWORD),
            ("flags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_void_p),
        ]

    LowLevelMouseProc = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
    clicked = {"x": None, "y": None, "button": "", "pressed": False}
    hook_handle = ctypes.c_void_p()

    def hook_proc(n_code, w_param, l_param):
        if n_code >= 0 and int(w_param) in {WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_MBUTTONDOWN}:
            info = ctypes.cast(l_param, ctypes.POINTER(MSLLHOOKSTRUCT)).contents
            button = {
                WM_LBUTTONDOWN: "left",
                WM_RBUTTONDOWN: "right",
                WM_MBUTTONDOWN: "middle",
            }.get(int(w_param), "mouse")
            clicked.update({"x": int(info.pt.x), "y": int(info.pt.y), "button": button, "pressed": True})
            return 1
        return user32.CallNextHookEx(hook_handle, n_code, w_param, l_param)

    proc = LowLevelMouseProc(hook_proc)
    hook_handle = user32.SetWindowsHookExW(WH_MOUSE_LL, proc, kernel32.GetModuleHandleW(None), 0)
    if not hook_handle:
        raise OSError("Nao foi possivel instalar o hook global de mouse.")

    msg = wintypes.MSG()
    started = time.perf_counter()
    try:
        while not clicked["pressed"] and (time.perf_counter() - started) < max(1.0, float(timeout or 12)):
            while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, PM_REMOVE):
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            time.sleep(0.01)
    finally:
        user32.UnhookWindowsHookEx(hook_handle)

    if not clicked["pressed"]:
        return {"ok": False, "erro": "Nenhum clique capturado dentro do tempo limite."}
    found = find_from_point(clicked["x"], clicked["y"])
    if not found.get("ok"):
        return found
    found["click"] = clicked
    found["click_blocked"] = True
    return found


def capture_click_with_pynput(timeout=12):
    try:
        from pynput import mouse
    except Exception as erro:
        return {
            "ok": False,
            "erro": "A biblioteca pynput nao esta instalada. Instale com: python -m pip install pynput",
            "detalhe": str(erro),
        }

    click = {"x": None, "y": None, "button": "", "pressed": False}

    def on_click(x, y, button, pressed):
        if pressed:
            click.update({"x": int(x), "y": int(y), "button": str(button), "pressed": True})
            return False
        return True

    started = time.perf_counter()
    listener = mouse.Listener(on_click=on_click)
    listener.start()
    while listener.running and (time.perf_counter() - started) < max(1.0, float(timeout or 12)):
        time.sleep(0.03)
    if listener.running:
        listener.stop()
    listener.join(0.2)

    if not click["pressed"]:
        return {"ok": False, "erro": "Nenhum clique capturado dentro do tempo limite."}

    found = find_from_point(click["x"], click["y"])
    if not found.get("ok"):
        return found
    found["click"] = click
    found["click_blocked"] = False
    return found


def capture_next_click(timeout=12):
    loaded = carregar_uiautomation()
    if isinstance(loaded, tuple):
        return erro_dependencia(loaded[1])
    try:
        return capture_click_with_win32_hook(timeout)
    except Exception as erro:
        fallback = capture_click_with_pynput(timeout)
        if fallback.get("ok"):
            warnings = fallback.setdefault("warnings", [])
            warnings.append(f"Hook Win32 indisponivel; clique real pode ter passado para o app: {erro}")
            return fallback
        return {"ok": False, "erro": f"Nao consegui capturar o clique: {erro}", "fallback": fallback}


def highlight_element(element, seconds=1.6):
    rect = (element or {}).get("bounding_rectangle") or {}
    left, top = int(rect.get("left", 0)), int(rect.get("top", 0))
    width, height = int(rect.get("width", 0)), int(rect.get("height", 0))
    if width <= 0 or height <= 0:
        return {"ok": False, "erro": "Elemento sem area visivel para destacar."}
    try:
        import tkinter as tk
    except Exception as erro:
        return {"ok": False, "erro": f"Tkinter indisponivel para highlight: {erro}"}
    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    root.attributes("-alpha", 0.72)
    root.geometry(f"{width + 8}x{height + 8}+{left - 4}+{top - 4}")
    root.configure(bg="#12B5CB")
    inner = tk.Frame(root, bg="#07111F")
    inner.place(x=4, y=4, width=width, height=height)
    root.after(int(max(0.3, seconds) * 1000), root.destroy)
    root.mainloop()
    return {"ok": True}


def show_hover_box(rect, label=""):
    try:
        import tkinter as tk
    except Exception:
        return None
    left, top = int(rect.get("left", 0)), int(rect.get("top", 0))
    width, height = int(rect.get("width", 0)), int(rect.get("height", 0))
    if width <= 0 or height <= 0:
        return None
    transparent = "#010203"
    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    try:
        root.attributes("-transparentcolor", transparent)
    except Exception:
        root.attributes("-alpha", 0.42)
    root.configure(bg=transparent)
    root.geometry(f"{width + 12}x{height + 12}+{left - 6}+{top - 6}")
    canvas = tk.Canvas(root, bg=transparent, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_rectangle(3, 3, width + 9, height + 9, outline="#5EEAD4", width=3)
    canvas.create_rectangle(6, 6, width + 6, height + 6, outline="#12B5CB", width=2)
    if label:
        label_text = texto_curto(label, 36)
        label_width = max(94, min(width + 6, len(label_text) * 7 + 22))
        canvas.create_rectangle(6, 0, label_width, 22, fill="#07111F", outline="#12B5CB", width=1)
        canvas.create_text(14, 11, anchor="w", text=label_text, fill="#E6F7FF", font=("Segoe UI", 8, "bold"))
    root.update_idletasks()
    root.update()
    try:
        import ctypes

        hwnd = int(root.winfo_id())
        user32 = ctypes.windll.user32
        GWL_EXSTYLE = -20
        WS_EX_LAYERED = 0x00080000
        WS_EX_TRANSPARENT = 0x00000020
        WS_EX_TOOLWINDOW = 0x00000080
        style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW)
    except Exception:
        pass
    return root


def destroy_hover_box(box):
    if not box:
        return
    try:
        box.destroy()
    except Exception:
        pass


def actionable_score(element):
    if element.get("editable") or element.get("clickable") or element.get("selectable"):
        return 0
    if element.get("readable") or element.get("actionable"):
        return 1
    return 3


def visible_candidate_elements(elements, source_rect=None):
    candidates = []
    window_rect = source_rect or {}
    for element in elements or []:
        rect = element.get("bounding_rectangle") or {}
        width = int(rect.get("width", 0) or 0)
        height = int(rect.get("height", 0) or 0)
        left = int(rect.get("left", 0) or 0)
        top = int(rect.get("top", 0) or 0)
        if width < 8 or height < 8:
            continue
        if element.get("is_offscreen") or not element.get("is_visible", True):
            continue
        if window_rect:
            if left < int(window_rect.get("left", -99999)) - 4 or top < int(window_rect.get("top", -99999)) - 4:
                continue
            if left > int(window_rect.get("right", 99999)) + 4 or top > int(window_rect.get("bottom", 99999)) + 4:
                continue
        candidates.append(element)
    return candidates


def best_element_at_point(candidates, screen_x, screen_y):
    matches = []
    for element in candidates or []:
        rect = element.get("bounding_rectangle") or {}
        left = int(rect.get("left", 0) or 0)
        top = int(rect.get("top", 0) or 0)
        right = int(rect.get("right", 0) or 0)
        bottom = int(rect.get("bottom", 0) or 0)
        if left <= screen_x <= right and top <= screen_y <= bottom:
            area = max(1, (right - left) * (bottom - top))
            depth = int(element.get("depth", 0) or 0)
            matches.append((actionable_score(element), area, -depth, element))
    if not matches:
        return None
    return sorted(matches, key=lambda item: (item[0], item[1], item[2]))[0][3]


def focus_window(hwnd=0):
    if not hwnd:
        return
    try:
        import ctypes

        user32 = ctypes.windll.user32
        SW_RESTORE = 9
        user32.ShowWindow(int(hwnd), SW_RESTORE)
        user32.SetForegroundWindow(int(hwnd))
        time.sleep(0.12)
    except Exception:
        pass


def pick_element_from_hover_hook(timeout=20, elements=None, source_rect=None):
    loaded = carregar_uiautomation()
    if isinstance(loaded, tuple):
        return erro_dependencia(loaded[1])
    auto = loaded

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    WH_MOUSE_LL = 14
    WM_LBUTTONDOWN = 0x0201
    WM_RBUTTONDOWN = 0x0204
    WM_MBUTTONDOWN = 0x0207
    PM_REMOVE = 0x0001

    class POINT(ctypes.Structure):
        _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

    class MSLLHOOKSTRUCT(ctypes.Structure):
        _fields_ = [
            ("pt", POINT),
            ("mouseData", wintypes.DWORD),
            ("flags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_void_p),
        ]

    state = {
        "selected": None,
        "hover_element": None,
        "hover_id": "",
        "last_probe": 0.0,
        "done": False,
    }
    candidates = visible_candidate_elements(elements or [], source_rect)
    state["hover_box"] = None
    hook_handle = ctypes.c_void_p()
    LowLevelMouseProc = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)

    def set_hover_from_point(x, y):
        now = time.perf_counter()
        if now - state["last_probe"] < 0.06:
            return
        state["last_probe"] = now
        item = best_element_at_point(candidates, int(x), int(y)) if candidates else None
        if item is None:
            try:
                control = auto.ControlFromPoint(int(x), int(y))
                item = control_to_element(control, 0, 0, "", "")
                item["selector"] = montar_selector(item, [item])
                item["selector_quality"] = item["selector"]["quality"]
                item["confidence"] = "alta" if item["selector_quality"] == "FORTE" else "media"
            except Exception:
                return
        if item.get("id") == state["hover_id"]:
            return
        state["hover_id"] = item.get("id", "")
        state["hover_element"] = item
        destroy_hover_box(state["hover_box"])
        state["hover_box"] = show_hover_box(item.get("bounding_rectangle") or {}, uia_label_for_overlay(item))

    def hook_proc(n_code, w_param, l_param):
        if n_code >= 0:
            message = int(w_param)
            if message in {WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_MBUTTONDOWN}:
                if state["hover_element"]:
                    state["selected"] = state["hover_element"]
                    state["done"] = True
                return 1
        return user32.CallNextHookEx(hook_handle, n_code, w_param, l_param)

    proc = LowLevelMouseProc(hook_proc)
    user32.SetWindowsHookExW.argtypes = [ctypes.c_int, LowLevelMouseProc, wintypes.HINSTANCE, wintypes.DWORD]
    user32.SetWindowsHookExW.restype = wintypes.HHOOK
    user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
    user32.CallNextHookEx.restype = ctypes.c_int
    user32.UnhookWindowsHookEx.argtypes = [wintypes.HHOOK]
    user32.UnhookWindowsHookEx.restype = wintypes.BOOL
    user32.GetCursorPos.argtypes = [ctypes.POINTER(POINT)]
    user32.GetCursorPos.restype = wintypes.BOOL
    hook_handle = user32.SetWindowsHookExW(WH_MOUSE_LL, proc, None, 0)
    if not hook_handle:
        code = ctypes.get_last_error()
        return {"ok": False, "erro": f"Nao foi possivel iniciar a captura visual do mouse. Codigo Windows: {code}"}

    msg = wintypes.MSG()
    started = time.perf_counter()
    try:
        while not state["done"] and (time.perf_counter() - started) < max(3.0, float(timeout or 20)):
            while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, PM_REMOVE):
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            point = POINT()
            if user32.GetCursorPos(ctypes.byref(point)):
                set_hover_from_point(point.x, point.y)
            if state["hover_box"]:
                try:
                    state["hover_box"].update()
                except Exception:
                    state["hover_box"] = None
            time.sleep(0.01)
    finally:
        destroy_hover_box(state["hover_box"])
        user32.UnhookWindowsHookEx(hook_handle)

    if state["selected"]:
        return {"ok": True, "element": state["selected"], "click_blocked": True}
    return {"ok": False, "erro": "Nenhum elemento selecionado dentro do tempo limite."}


def pick_element_from_hover_pynput(timeout=20, elements=None, source_rect=None):
    loaded = carregar_uiautomation()
    if isinstance(loaded, tuple):
        return erro_dependencia(loaded[1])
    auto = loaded
    try:
        from pynput import mouse
    except Exception as erro:
        return {
            "ok": False,
            "erro": "A biblioteca pynput nao esta instalada. Instale com: python -m pip install pynput",
            "detalhe": str(erro),
        }
    try:
        import ctypes
        from ctypes import wintypes
    except Exception as erro:
        return {"ok": False, "erro": f"Nao foi possivel ler a posicao do mouse: {erro}"}

    user32 = ctypes.windll.user32

    class POINT(ctypes.Structure):
        _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

    # GetCursorPos pode ter sido tipado por outro fluxo de captura. Reaplicamos
    # o POINT local para evitar conflito entre estruturas ctypes diferentes.
    user32.GetCursorPos.argtypes = [ctypes.POINTER(POINT)]
    user32.GetCursorPos.restype = wintypes.BOOL

    candidates = visible_candidate_elements(elements or [], source_rect)
    state = {
        "selected": None,
        "hover_element": None,
        "hover_id": "",
        "hover_box": None,
        "last_probe": 0.0,
    }

    def set_hover_from_point(x, y):
        now = time.perf_counter()
        if now - state["last_probe"] < 0.06:
            return
        state["last_probe"] = now
        item = best_element_at_point(candidates, int(x), int(y)) if candidates else None
        if item is None:
            try:
                control = auto.ControlFromPoint(int(x), int(y))
                item = control_to_element(control, 0, 0, "", "")
                item["selector"] = montar_selector(item, [item])
                item["selector_quality"] = item["selector"]["quality"]
                item["confidence"] = "alta" if item["selector_quality"] == "FORTE" else "media"
            except Exception:
                return
        if item.get("id") == state["hover_id"]:
            return
        state["hover_id"] = item.get("id", "")
        state["hover_element"] = item
        destroy_hover_box(state["hover_box"])
        state["hover_box"] = show_hover_box(item.get("bounding_rectangle") or {}, uia_label_for_overlay(item))

    def on_click(_x, _y, _button, pressed):
        if pressed and state["hover_element"]:
            state["selected"] = state["hover_element"]
            return False
        return True

    listener = mouse.Listener(on_click=on_click)
    listener.start()
    started = time.perf_counter()
    try:
        while listener.running and not state["selected"] and (time.perf_counter() - started) < max(3.0, float(timeout or 20)):
            point = POINT()
            if user32.GetCursorPos(ctypes.byref(point)):
                set_hover_from_point(point.x, point.y)
            if state["hover_box"]:
                try:
                    state["hover_box"].update()
                except Exception:
                    state["hover_box"] = None
            time.sleep(0.01)
    finally:
        if listener.running:
            listener.stop()
        listener.join(0.2)
        destroy_hover_box(state["hover_box"])

    if state["selected"]:
        return {
            "ok": True,
            "element": state["selected"],
            "click_blocked": False,
            "warnings": ["Fallback sem bloqueio total do clique foi usado."],
        }
    return {"ok": False, "erro": "Nenhum elemento selecionado dentro do tempo limite."}


def pick_element_from_overlay(elements, source_rect=None, timeout=20):
    candidates = visible_candidate_elements(elements or [], source_rect)
    if not candidates:
        return {"ok": False, "erro": "Nenhum elemento visivel para selecionar nessa janela."}

    try:
        import ctypes
        import tkinter as tk
    except Exception as erro:
        return {"ok": False, "erro": f"Nao foi possivel abrir a selecao visual: {erro}"}

    user32 = ctypes.windll.user32
    x0 = user32.GetSystemMetrics(76)
    y0 = user32.GetSystemMetrics(77)
    vw = user32.GetSystemMetrics(78)
    vh = user32.GetSystemMetrics(79)
    transparent = "#010203"
    selected = {"element": None, "cancelled": False}

    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    try:
        root.attributes("-transparentcolor", transparent)
    except Exception:
        root.attributes("-alpha", 0.18)
    root.configure(bg=transparent)
    root.geometry(f"{vw}x{vh}+{x0}+{y0}")

    canvas = tk.Canvas(root, bg=transparent, highlightthickness=0, bd=0, cursor="crosshair")
    canvas.pack(fill="both", expand=True)
    canvas.create_rectangle(8, 8, 270, 44, fill="#07111F", outline="#12B5CB", width=2)
    canvas.create_text(
        24,
        26,
        anchor="w",
        text="Clique no elemento para usar no FlowDetect",
        fill="#E6F7FF",
        font=("Segoe UI", 10, "bold"),
    )

    ordered = sorted(candidates, key=lambda item: (
        int((item.get("bounding_rectangle") or {}).get("width", 0) or 0)
        * int((item.get("bounding_rectangle") or {}).get("height", 0) or 0)
    ), reverse=True)
    for element in ordered:
        rect = element.get("bounding_rectangle") or {}
        left = int(rect.get("left", 0) or 0) - x0
        top = int(rect.get("top", 0) or 0) - y0
        right = int(rect.get("right", 0) or 0) - x0
        bottom = int(rect.get("bottom", 0) or 0) - y0
        actionable = bool(element.get("actionable") or element.get("editable") or element.get("clickable") or element.get("readable"))
        color = "#22C55E" if actionable else "#12B5CB"
        canvas.create_rectangle(left, top, right, bottom, outline=color, width=2)
        label = texto_curto(element.get("name") or element.get("field_kind") or element.get("control_type"), 28)
        if label and (bottom - top) >= 18 and (right - left) >= 45:
            canvas.create_text(left + 5, top + 10, anchor="w", text=label, fill=color, font=("Segoe UI", 8, "bold"))

    def choose_at(screen_x, screen_y):
        element = best_element_at_point(candidates, screen_x, screen_y)
        if element:
            selected["element"] = element
            root.destroy()

    def on_click(event):
        choose_at(event.x_root, event.y_root)

    def on_escape(_event=None):
        selected["cancelled"] = True
        root.destroy()

    root.bind("<Button-1>", on_click)
    root.bind("<Escape>", on_escape)
    root.after(int(max(3, float(timeout or 20)) * 1000), on_escape)
    root.mainloop()

    if selected["element"]:
        return {"ok": True, "element": selected["element"]}
    return {"ok": False, "erro": "Selecao visual cancelada."}


def pick_element_from_hover_overlay(elements, source_rect=None, timeout=20):
    candidates = visible_candidate_elements(elements or [], source_rect)
    if not candidates:
        return {"ok": False, "erro": "Nenhum elemento visivel para selecionar nessa janela."}

    try:
        import ctypes
        import tkinter as tk
    except Exception as erro:
        return {"ok": False, "erro": f"Nao foi possivel abrir a selecao visual: {erro}"}

    user32 = ctypes.windll.user32
    x0 = user32.GetSystemMetrics(76)
    y0 = user32.GetSystemMetrics(77)
    vw = user32.GetSystemMetrics(78)
    vh = user32.GetSystemMetrics(79)
    transparent = "#010203"
    selected = {"element": None, "hover": None}

    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    try:
        root.attributes("-transparentcolor", transparent)
    except Exception:
        root.attributes("-alpha", 0.18)
    root.configure(bg=transparent)
    root.geometry(f"{vw}x{vh}+{x0}+{y0}")

    canvas = tk.Canvas(root, bg=transparent, highlightthickness=0, bd=0, cursor="crosshair")
    canvas.pack(fill="both", expand=True)
    box_id = None
    glow_id = None
    label_box_id = None
    label_id = None

    def element_at(screen_x, screen_y):
        return best_element_at_point(candidates, screen_x, screen_y)

    def redraw_hover(element):
        nonlocal box_id, glow_id, label_box_id, label_id
        for item_id in (box_id, glow_id, label_box_id, label_id):
            if item_id:
                canvas.delete(item_id)
        box_id = glow_id = label_box_id = label_id = None
        if not element:
            return
        rect = element.get("bounding_rectangle") or {}
        left = int(rect.get("left", 0) or 0) - x0
        top = int(rect.get("top", 0) or 0) - y0
        right = int(rect.get("right", 0) or 0) - x0
        bottom = int(rect.get("bottom", 0) or 0) - y0
        label = texto_curto(uia_label_for_overlay(element), 42)
        glow_id = canvas.create_rectangle(left - 4, top - 4, right + 4, bottom + 4, outline="#5EEAD4", width=5)
        box_id = canvas.create_rectangle(left, top, right, bottom, outline="#12B5CB", width=2)
        if label:
            label_width = max(120, min(340, len(label) * 7 + 26))
            label_top = max(8, top - 34)
            label_box_id = canvas.create_rectangle(left, label_top, left + label_width, label_top + 26, fill="#07111F", outline="#12B5CB", width=1)
            label_id = canvas.create_text(left + 12, label_top + 13, anchor="w", text=label, fill="#E6F7FF", font=("Segoe UI", 9, "bold"))

    def on_motion(event):
        element = element_at(event.x_root, event.y_root)
        if (element or {}).get("id") == (selected["hover"] or {}).get("id"):
            return
        selected["hover"] = element
        redraw_hover(element)

    def on_click(_event):
        if selected["hover"]:
            selected["element"] = selected["hover"]
            root.destroy()

    def on_escape(_event=None):
        root.destroy()

    root.bind("<Motion>", on_motion)
    root.bind("<Button-1>", on_click)
    root.bind("<Escape>", on_escape)
    root.after(int(max(3, float(timeout or 20)) * 1000), on_escape)
    root.mainloop()

    if selected["element"]:
        return {"ok": True, "element": selected["element"]}
    return {"ok": False, "erro": "Selecao visual cancelada."}


def uia_label_for_overlay(element):
    return (
        element.get("name")
        or element.get("automation_id")
        or element.get("field_kind")
        or element.get("control_type")
        or "Elemento"
    )


def select_from_window(title="", hwnd=0, timeout=20):
    mapped = scan_window(title=title, hwnd=hwnd, max_depth=8, max_items=700)
    if not mapped.get("ok"):
        return mapped
    source_rect = (mapped.get("source_window") or {}).get("bounding_rectangle") or {}
    elements = mapped.get("elements") or []
    picked = pick_element_from_hover_hook(timeout, elements, source_rect)
    if not picked.get("ok"):
        fallback = pick_element_from_hover_pynput(timeout, elements, source_rect)
        if fallback.get("ok"):
            fallback.setdefault("warnings", []).append(picked.get("erro", "Hook global indisponivel."))
            picked = fallback
        else:
            picked["fallback"] = fallback
            picked["map_count"] = mapped.get("count", 0)
            picked["context_signature"] = mapped.get("context_signature", "")
            return picked
    picked["source_window"] = mapped.get("source_window") or {}
    picked["source_tab"] = mapped.get("source_tab") or ""
    picked["context_signature"] = mapped.get("context_signature") or ""
    picked["map_count"] = mapped.get("count", 0)
    return picked


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan")
    scan.add_argument("--title", default="")
    scan.add_argument("--hwnd", type=int, default=0)
    scan.add_argument("--max-depth", type=int, default=8)
    scan.add_argument("--max-items", type=int, default=700)
    sub.add_parser("capture-cursor")
    capture_click = sub.add_parser("capture-click")
    capture_click.add_argument("--timeout", type=float, default=12)
    select_visual = sub.add_parser("select-visual")
    select_visual.add_argument("--title", default="")
    select_visual.add_argument("--hwnd", type=int, default=0)
    select_visual.add_argument("--timeout", type=float, default=20)
    high = sub.add_parser("highlight")
    high.add_argument("--element-json", required=True)
    high.add_argument("--seconds", type=float, default=1.6)
    args = parser.parse_args()
    if args.command == "scan":
        result = scan_window(args.title, args.hwnd, args.max_depth, args.max_items)
    elif args.command == "capture-cursor":
        result = find_from_point()
    elif args.command == "capture-click":
        result = capture_next_click(args.timeout)
    elif args.command == "select-visual":
        result = select_from_window(args.title, args.hwnd, args.timeout)
    else:
        result = highlight_element(json.loads(args.element_json), args.seconds)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()
