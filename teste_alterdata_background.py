import argparse
import re
import threading
import time
from typing import Dict, List, Optional, Tuple

import win32api
import win32con
import win32gui
import win32process
from pywinauto import Desktop


TARGET_TITLE_REGEX = r"Consulta de movimento.*Faturamento e Deducoes|Consulta de movimento.*Faturamento e Deduções"


def list_visible_windows() -> List[Tuple[int, str]]:
    items: List[Tuple[int, str]] = []

    def callback(hwnd: int, _extra: object) -> bool:
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd).strip()
            if title:
                items.append((hwnd, title))
        return True

    win32gui.EnumWindows(callback, None)
    items.sort(key=lambda item: item[1].lower())
    return items


def find_target_window(title_regex: str) -> Optional[int]:
    pattern = re.compile(title_regex, re.IGNORECASE)
    for hwnd, title in list_visible_windows():
        if pattern.search(title):
            return hwnd
    return None


def get_window_summary(hwnd: int) -> Dict[str, object]:
    thread_id, process_id = win32process.GetWindowThreadProcessId(hwnd)
    return {
        "hwnd": hwnd,
        "title": win32gui.GetWindowText(hwnd),
        "class_name": win32gui.GetClassName(hwnd),
        "parent": win32gui.GetParent(hwnd),
        "owner": win32gui.GetWindow(hwnd, win32con.GW_OWNER),
        "rect": win32gui.GetWindowRect(hwnd),
        "thread_id": thread_id,
        "process_id": process_id,
    }


def get_child_windows(hwnd: int) -> List[Dict[str, object]]:
    children: List[Dict[str, object]] = []

    def callback(child_hwnd: int, _extra: object) -> bool:
        children.append(
            {
                "hwnd": child_hwnd,
                "class_name": win32gui.GetClassName(child_hwnd),
                "title": win32gui.GetWindowText(child_hwnd),
                "rect": win32gui.GetWindowRect(child_hwnd),
            }
        )
        return True

    win32gui.EnumChildWindows(hwnd, callback, None)
    return children


def get_uia_descendants(hwnd: int) -> List[Dict[str, object]]:
    window = Desktop(backend="uia").window(handle=hwnd)
    descendants = []
    for control in window.descendants():
        info = control.element_info
        entry = {
            "handle": control.handle,
            "control_type": info.control_type,
            "automation_id": info.automation_id,
            "class_name": info.class_name,
            "text": control.window_text(),
        }
        if info.control_type == "Edit":
            entry["value"] = read_edit_value(control.handle)
        descendants.append(entry)
    return descendants


def choose_demo_handles(uia_descendants: List[Dict[str, object]]) -> Dict[str, Optional[int]]:
    edit_handles = [
        item["handle"]
        for item in uia_descendants
        if item["control_type"] == "Edit" and item["handle"]
    ]
    empty_edits = [
        item["handle"]
        for item in uia_descendants
        if item["control_type"] == "Edit" and not (item.get("value") or "")
    ]
    button_handles = [
        item["handle"]
        for item in uia_descendants
        if item["control_type"] == "Button" and item["handle"]
    ]

    return {
        "watch_edit": empty_edits[0] if empty_edits else (edit_handles[0] if edit_handles else None),
        "wm_char_edit": empty_edits[1] if len(empty_edits) > 1 else (edit_handles[0] if edit_handles else None),
        "button": button_handles[0] if button_handles else None,
    }


def read_edit_value(hwnd: int) -> str:
    wrapper = Desktop(backend="uia").window(handle=hwnd).wrapper_object()
    for getter in (
        lambda: wrapper.get_value(),
        lambda: wrapper.window_text(),
    ):
        try:
            value = getter()
            if value is not None:
                return value
        except Exception:
            pass
    return ""


def get_edit_value(hwnd: int) -> str:
    return read_edit_value(hwnd)


def restore_appended_text(edit_hwnd: int, count: int) -> None:
    for _ in range(count):
        win32gui.PostMessage(edit_hwnd, win32con.WM_CHAR, 8, 0)
        time.sleep(0.03)


def monitor_foreground(stop_event: threading.Event, history: List[Tuple[int, str]]) -> None:
    last_hwnd = None
    while not stop_event.is_set():
        hwnd = win32gui.GetForegroundWindow()
        title = win32gui.GetWindowText(hwnd)
        if hwnd != last_hwnd:
            history.append((hwnd, title))
            last_hwnd = hwnd
        time.sleep(0.02)


def visible_window_set() -> List[Tuple[int, str]]:
    return list_visible_windows()


def run_with_focus_monitor(action) -> Dict[str, object]:
    before_windows = visible_window_set()
    focus_history: List[Tuple[int, str]] = []
    stop_event = threading.Event()
    worker = threading.Thread(target=monitor_foreground, args=(stop_event, focus_history))
    worker.start()
    try:
        action()
        time.sleep(0.4)
    finally:
        stop_event.set()
        worker.join()
    after_windows = visible_window_set()
    return {
        "focus_history": focus_history,
        "new_windows": [item for item in after_windows if item not in before_windows],
        "closed_windows": [item for item in before_windows if item not in after_windows],
    }


def test_wm_char_to_edit(edit_hwnd: int, text: str) -> Dict[str, object]:
    before = get_edit_value(edit_hwnd)

    def action() -> None:
        for char in text:
            win32gui.PostMessage(edit_hwnd, win32con.WM_CHAR, ord(char), 0)
            time.sleep(0.05)

    result = run_with_focus_monitor(action)
    result["before_value"] = before
    result["after_value"] = get_edit_value(edit_hwnd)
    result["accepted"] = result["after_value"] == before + text
    if result["accepted"]:
        restore_appended_text(edit_hwnd, len(text))
        result["restored_value"] = get_edit_value(edit_hwnd)
    return result


def test_wm_char_to_top_level(target_hwnd: int, watch_edit_hwnd: int, text: str) -> Dict[str, object]:
    before = get_edit_value(watch_edit_hwnd)

    def action() -> None:
        for char in text:
            win32gui.PostMessage(target_hwnd, win32con.WM_CHAR, ord(char), 0)
            time.sleep(0.05)

    result = run_with_focus_monitor(action)
    result["before_value"] = before
    result["after_value"] = get_edit_value(watch_edit_hwnd)
    result["accepted"] = result["after_value"] != before
    return result


def test_enter_to_top_level(target_hwnd: int) -> Dict[str, object]:
    def action() -> None:
        win32gui.PostMessage(target_hwnd, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0)
        time.sleep(0.05)
        win32gui.PostMessage(target_hwnd, win32con.WM_KEYUP, win32con.VK_RETURN, 0)

    result = run_with_focus_monitor(action)
    result["accepted"] = bool(result["new_windows"])
    return result


def test_click_to_control(control_hwnd: int, x: int = 10, y: int = 10) -> Dict[str, object]:
    lparam = win32api.MAKELONG(x, y)

    def action() -> None:
        win32gui.PostMessage(control_hwnd, win32con.WM_MOUSEMOVE, 0, lparam)
        time.sleep(0.05)
        win32gui.PostMessage(control_hwnd, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, lparam)
        time.sleep(0.05)
        win32gui.PostMessage(control_hwnd, win32con.WM_LBUTTONUP, 0, lparam)

    result = run_with_focus_monitor(action)
    result["accepted"] = bool(result["new_windows"])
    return result


def print_window_listing() -> None:
    for hwnd, title in list_visible_windows():
        print(f"{hwnd} - {title}")


def print_inspection(hwnd: int) -> Dict[str, object]:
    summary = get_window_summary(hwnd)
    print("Janela alvo:")
    for key, value in summary.items():
        print(f"  {key}: {value}")

    print("\nFilhos Win32:")
    children = get_child_windows(hwnd)
    for child in children:
        print(f"  {child['hwnd']} | {child['class_name']} | {child['title']!r}")

    print("\nControles UI Automation:")
    descendants = get_uia_descendants(hwnd)
    for item in descendants:
        print(
            f"  {item['handle']} | {item['control_type']} | "
            f"{item['class_name']} | {item['text']!r} | "
            f"auto_id={item['automation_id']} | value={item.get('value')!r}"
        )
    return {"children": children, "descendants": descendants}


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnostico de automacao em segundo plano no Alterdata.")
    parser.add_argument("--list", action="store_true", help="Lista janelas visiveis.")
    parser.add_argument("--title-regex", default=TARGET_TITLE_REGEX, help="Regex para localizar a janela alvo.")
    parser.add_argument("--inspect", action="store_true", help="Inspeciona a janela alvo e seus controles.")
    parser.add_argument("--run-tests", action="store_true", help="Executa os testes de teclado, texto, clique e UIA.")
    parser.add_argument("--text", default="teste123", help="Texto usado no teste de WM_CHAR.")
    args = parser.parse_args()

    if args.list:
        print_window_listing()
        print()

    target_hwnd = find_target_window(args.title_regex)
    if not target_hwnd:
        print("Janela alvo nao encontrada.")
        return

    print(f"Janela alvo encontrada: {target_hwnd} - {win32gui.GetWindowText(target_hwnd)}")

    inspection = None
    if args.inspect or args.run_tests:
        inspection = print_inspection(target_hwnd)

    if not args.run_tests:
        return

    descendants = inspection["descendants"] if inspection else get_uia_descendants(target_hwnd)
    handles = choose_demo_handles(descendants)
    watch_edit = handles["watch_edit"]
    wm_char_edit = handles["wm_char_edit"]
    button = handles["button"]

    print("\nTeste 1 - WM_CHAR no HWND principal:")
    if watch_edit:
        print(test_wm_char_to_top_level(target_hwnd, watch_edit, args.text))
    else:
        print("Nenhum campo Edit encontrado para validacao.")

    print("\nTeste 2 - WM_CHAR direto em um Edit filho:")
    if wm_char_edit:
        print(test_wm_char_to_edit(wm_char_edit, args.text))
    else:
        print("Nenhum campo Edit encontrado.")

    print("\nTeste 3 - ENTER via PostMessage no HWND principal:")
    print(test_enter_to_top_level(target_hwnd))

    print("\nTeste 4 - Clique WM_LBUTTONDOWN/UP em um controle filho:")
    if button:
        print(test_click_to_control(button))
    else:
        print("Nenhum Button encontrado.")

    print("\nTeste 5 - UI Automation disponivel:")
    print(
        {
            "uia_controls_found": len(descendants),
            "edit_count": len([item for item in descendants if item["control_type"] == "Edit"]),
            "button_count": len([item for item in descendants if item["control_type"] == "Button"]),
        }
    )


if __name__ == "__main__":
    main()
