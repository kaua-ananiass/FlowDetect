import argparse
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import win32api
import win32con
import win32gui
import win32process
from pywinauto import Desktop


DEFAULT_TITLE = "Consulta de movimento de ISS / Faturamento e Deducoes"
DEFAULT_TITLE_REGEX = r"Consulta de movimento.*Faturamento.*Dedu"
DEFAULT_CLASS_NAME = "TfrmConsultaISSFatDed"
DEFAULT_DIAGNOSTIC_FILE = Path("controles_alterdata.txt")


def normalize_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


def rect_to_tuple(rect: Any) -> Tuple[int, int, int, int]:
    return (int(rect.left), int(rect.top), int(rect.right), int(rect.bottom))


class AlterdataBackgroundAutomation:
    def __init__(
        self,
        title: str = DEFAULT_TITLE,
        title_regex: str = DEFAULT_TITLE_REGEX,
        class_name: str = DEFAULT_CLASS_NAME,
        diagnostic_file: Path = DEFAULT_DIAGNOSTIC_FILE,
    ) -> None:
        self.title = title
        self.title_regex = title_regex
        self.class_name = class_name
        self.diagnostic_file = Path(diagnostic_file)
        self.desktop = Desktop(backend="uia")
        self.target_hwnd: Optional[int] = None
        self._controls_cache: Optional[List[Dict[str, Any]]] = None

    def log(self, message: str) -> None:
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")

    def _iter_visible_windows(self) -> Iterable[Tuple[int, str, str]]:
        windows: List[Tuple[int, str, str]] = []

        def callback(hwnd: int, _extra: object) -> bool:
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd).strip()
                if title:
                    windows.append((hwnd, title, win32gui.GetClassName(hwnd)))
            return True

        win32gui.EnumWindows(callback, None)
        return windows

    def localizar_janela_alvo(self, refresh: bool = False) -> int:
        if self.target_hwnd and not refresh and self.validar_se_janela_existe(self.target_hwnd):
            return self.target_hwnd

        target_title = normalize_text(self.title)
        pattern = re.compile(self.title_regex, re.IGNORECASE)
        ranked: List[Tuple[int, int, str, str]] = []

        for hwnd, title, class_name in self._iter_visible_windows():
            score = 0
            normalized_title = normalize_text(title)
            normalized_class = normalize_text(class_name)

            if class_name == self.class_name:
                score += 100
            if normalized_class == normalize_text(self.class_name):
                score += 80
            if pattern.search(title):
                score += 60
            if target_title and target_title in normalized_title:
                score += 40

            if score:
                ranked.append((score, hwnd, title, class_name))

        if not ranked:
            raise RuntimeError("Janela alvo nao encontrada.")

        ranked.sort(reverse=True)
        score, hwnd, title, class_name = ranked[0]
        self.target_hwnd = hwnd
        self._controls_cache = None
        self.log(
            f"janela encontrada: hwnd={hwnd} titulo={title!r} classe={class_name!r} score={score}"
        )
        return hwnd

    def validar_se_janela_existe(self, hwnd: Optional[int] = None) -> bool:
        handle = hwnd or self.target_hwnd
        exists = bool(handle and win32gui.IsWindow(handle))
        self.log(f"validar janela: hwnd={handle} existe={exists}")
        return exists

    def _window_spec(self):
        hwnd = self.localizar_janela_alvo()
        return self.desktop.window(handle=hwnd)

    def _read_control_value(self, wrapper: Any) -> str:
        for getter_name in ("get_value", "window_text"):
            getter = getattr(wrapper, getter_name, None)
            if getter is None:
                continue
            try:
                value = getter()
            except Exception:
                continue
            if value is not None:
                return str(value)
        return ""

    def _infer_category(self, info: Dict[str, Any]) -> str:
        control_type = info["control_type"]
        class_name = str(info["class_name"] or "")
        text = str(info["name"] or "")
        value = str(info["value"] or "")
        if "DateEdit" in class_name:
            return "date"
        if "Grid" in class_name:
            return "grid"
        if control_type == "Edit":
            if "DropDown" in class_name and re.search(r"\d{2}/\d{2}/\d{4}", f"{text} {value}"):
                return "date"
            return "edit"
        if control_type == "Button":
            return "button"
        if "Group" in class_name:
            return "group"
        return control_type.lower() if control_type else "unknown"

    def _nearby_texts(
        self,
        current: Dict[str, Any],
        controls: List[Dict[str, Any]],
        max_vertical_gap: int = 28,
        max_horizontal_gap: int = 420,
    ) -> List[str]:
        left, top, right, bottom = current["rectangle"]
        texts: List[Tuple[int, str]] = []
        for item in controls:
            if item["global_index"] == current["global_index"]:
                continue
            candidate_text = str(item["name"] or "").strip()
            if not candidate_text:
                continue
            c_left, c_top, c_right, c_bottom = item["rectangle"]
            same_row = abs(c_top - top) <= max_vertical_gap or abs(c_bottom - bottom) <= max_vertical_gap
            left_side = c_right <= right and (left - c_right) <= max_horizontal_gap
            above = c_bottom <= bottom and (top - c_bottom) <= max_vertical_gap
            if same_row and left_side:
                distance = abs(left - c_right)
                texts.append((distance, candidate_text))
            elif above:
                distance = abs(top - c_bottom) + 100
                texts.append((distance, candidate_text))

        texts.sort(key=lambda item: item[0])
        unique: List[str] = []
        for _, text in texts:
            if text not in unique:
                unique.append(text)
        return unique[:3]

    def listar_controles(self, refresh: bool = False) -> List[Dict[str, Any]]:
        if self._controls_cache is not None and not refresh:
            return self._controls_cache

        window = self._window_spec()
        raw_descendants = list(window.descendants())
        controls: List[Dict[str, Any]] = []
        type_counters: Dict[str, int] = {}

        for index, control in enumerate(raw_descendants):
            info = control.element_info
            handle = control.handle
            wrapper = control
            if not hasattr(wrapper, "window_text"):
                try:
                    wrapper = control.wrapper_object()
                except Exception:
                    wrapper = None

            try:
                rect = rect_to_tuple(control.rectangle())
            except Exception:
                rect = (0, 0, 0, 0)

            name = ""
            try:
                name = str(control.window_text() or "")
            except Exception:
                name = ""

            value = ""
            if wrapper is not None:
                value = self._read_control_value(wrapper)
            if not value and handle:
                try:
                    value = self._read_control_value(self._wrapper_for_hwnd(handle))
                except Exception:
                    pass

            base_info: Dict[str, Any] = {
                "global_index": index,
                "handle": int(handle) if handle else None,
                "name": name,
                "value": value,
                "control_type": info.control_type or "",
                "automation_id": str(info.automation_id or ""),
                "class_name": str(info.class_name or ""),
                "rectangle": rect,
            }
            base_info["category"] = self._infer_category(base_info)
            type_key = base_info["category"]
            base_info["type_index"] = type_counters.get(type_key, 0)
            type_counters[type_key] = base_info["type_index"] + 1
            controls.append(base_info)

        for item in controls:
            item["nearby_texts"] = self._nearby_texts(item, controls)
            search_parts = [
                item["name"],
                item["value"],
                item["automation_id"],
                item["class_name"],
                item["category"],
                str(item["handle"] or ""),
                " ".join(item["nearby_texts"]),
            ]
            item["search_text"] = normalize_text(" | ".join(part for part in search_parts if part))

        self._controls_cache = controls
        self.log(f"controles encontrados: total={len(controls)}")
        return controls

    def _format_control_line(self, control: Dict[str, Any]) -> str:
        return (
            f"[idx={control['global_index']:02d} type_idx={control['type_index']:02d}] "
            f"hwnd={control['handle']} category={control['category']} "
            f"control_type={control['control_type']} auto_id={control['automation_id']!r} "
            f"class_name={control['class_name']!r} title={control['name']!r} "
            f"value={control['value']!r} nearby={control['nearby_texts']} "
            f"rect={control['rectangle']}"
        )

    def gerar_diagnostico_controles(self, path: Optional[Path] = None, refresh: bool = True) -> Path:
        output = Path(path or self.diagnostic_file)
        controls = self.listar_controles(refresh=refresh)
        header = [
            f"Janela alvo: {self.localizar_janela_alvo()} - {win32gui.GetWindowText(self.localizar_janela_alvo())}",
            f"Classe alvo: {self.class_name}",
            f"Total de controles: {len(controls)}",
            "",
        ]
        lines = header + [self._format_control_line(control) for control in controls]
        output.write_text("\n".join(lines), encoding="utf-8")
        self.log(f"arquivo de diagnostico gerado: {output.resolve()}")
        return output

    def _match_score(
        self,
        control: Dict[str, Any],
        name: str,
        allowed_categories: Optional[Iterable[str]] = None,
    ) -> int:
        score = 0
        query = normalize_text(name)
        if not query:
            return score

        if allowed_categories and control["category"] not in set(allowed_categories):
            return 0

        search_text = control["search_text"]
        if not search_text:
            return 0

        if search_text == query:
            score += 120
        if query in normalize_text(control["name"]):
            score += 90
        if query in normalize_text(control["value"]):
            score += 70
        if query in normalize_text(" ".join(control["nearby_texts"])):
            score += 60
        if query in normalize_text(control["class_name"]):
            score += 40
        if query in normalize_text(control["automation_id"]):
            score += 35
        if query in search_text:
            score += 20
        return score

    def _resolve_control(
        self,
        nome: Optional[str] = None,
        indice: Optional[int] = None,
        hwnd: Optional[int] = None,
        allowed_categories: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        controls = self.listar_controles()
        category_set = set(allowed_categories or [])

        if hwnd is not None:
            for control in controls:
                if control["handle"] == hwnd:
                    self.log(f"controle encontrado por hwnd: {self._format_control_line(control)}")
                    return control
            raise RuntimeError(f"controle nao encontrado pelo hwnd={hwnd}")

        filtered = [
            control
            for control in controls
            if not category_set or control["category"] in category_set or control["control_type"] in category_set
        ]

        if indice is not None:
            for control in filtered:
                if control["type_index"] == indice:
                    self.log(f"controle encontrado por indice: {self._format_control_line(control)}")
                    return control
            raise RuntimeError(f"controle nao encontrado pelo indice={indice} categorias={sorted(category_set)}")

        if nome:
            scored = [
                (self._match_score(control, nome, category_set), control)
                for control in filtered
            ]
            scored = [item for item in scored if item[0] > 0]
            if not scored:
                raise RuntimeError(f"controle nao encontrado pelo nome={nome!r}")
            scored.sort(key=lambda item: (item[0], -item[1]["global_index"]), reverse=True)
            control = scored[0][1]
            self.log(f"controle encontrado por nome: {self._format_control_line(control)}")
            return control

        raise RuntimeError("informe nome, indice ou hwnd para localizar o controle.")

    def validar_se_controle_existe(
        self,
        nome: Optional[str] = None,
        indice: Optional[int] = None,
        hwnd: Optional[int] = None,
        allowed_categories: Optional[Iterable[str]] = None,
    ) -> bool:
        try:
            self._resolve_control(
                nome=nome,
                indice=indice,
                hwnd=hwnd,
                allowed_categories=allowed_categories,
            )
            exists = True
        except Exception as exc:
            self.log(f"erro ao encontrar controle: {exc}")
            exists = False
        self.log(f"validar controle: existe={exists}")
        return exists

    def localizar_controle(
        self,
        nome: Optional[str] = None,
        indice: Optional[int] = None,
        hwnd: Optional[int] = None,
        allowed_categories: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        return self._resolve_control(
            nome=nome,
            indice=indice,
            hwnd=hwnd,
            allowed_categories=allowed_categories,
        )

    def _wrapper_for_hwnd(self, hwnd: int):
        return self.desktop.window(handle=hwnd).wrapper_object()

    def _wait_for_edit_value(self, hwnd: int, expected: str, timeout: float = 1.5) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            current = self._read_control_value(self._wrapper_for_hwnd(hwnd))
            if current == expected:
                return True
            time.sleep(0.05)
        return False

    def enviar_texto_para_edit_hwnd(
        self,
        hwnd: int,
        texto: str,
        limpar: bool = True,
        intervalo: float = 0.03,
    ) -> bool:
        if not win32gui.IsWindow(hwnd):
            raise RuntimeError(f"hwnd invalido para edit: {hwnd}")

        wrapper = self._wrapper_for_hwnd(hwnd)
        current_value = self._read_control_value(wrapper)
        base_value = current_value

        if limpar and current_value:
            for _ in range(len(current_value)):
                win32gui.PostMessage(hwnd, win32con.WM_CHAR, 8, 0)
                time.sleep(intervalo)
            base_value = ""

        for char in texto:
            win32gui.PostMessage(hwnd, win32con.WM_CHAR, ord(char), 0)
            time.sleep(intervalo)

        expected = base_value + texto
        ok = self._wait_for_edit_value(hwnd, expected)
        if ok:
            self.log(f"campo preenchido via WM_CHAR: hwnd={hwnd} texto={texto!r}")
        else:
            final_value = self._read_control_value(self._wrapper_for_hwnd(hwnd))
            self.log(
                f"fallback WM_CHAR usado, mas valor final diferente: hwnd={hwnd} "
                f"esperado={expected!r} atual={final_value!r}"
            )
        return ok

    def preencher_edit_por_nome_ou_indice(
        self,
        texto: str,
        nome: Optional[str] = None,
        indice: Optional[int] = None,
        hwnd: Optional[int] = None,
        limpar: bool = True,
    ) -> bool:
        control = self._resolve_control(
            nome=nome,
            indice=indice,
            hwnd=hwnd,
            allowed_categories=("edit", "date"),
        )
        if not control["handle"]:
            raise RuntimeError("controle Edit sem hwnd; nao foi possivel preencher.")

        wrapper = self._wrapper_for_hwnd(control["handle"])
        if limpar:
            try:
                wrapper.set_edit_text(texto)
                if self._wait_for_edit_value(control["handle"], texto):
                    self.log(
                        f"campo preenchido via pywinauto: hwnd={control['handle']} "
                        f"indice={control['type_index']} texto={texto!r}"
                    )
                    return True
            except Exception as exc:
                self.log(f"set_edit_text falhou: hwnd={control['handle']} erro={exc}")

        self.log(f"fallback usado para preenchimento: hwnd={control['handle']} metodo=WM_CHAR")
        return self.enviar_texto_para_edit_hwnd(control["handle"], texto=texto, limpar=limpar)

    def _client_center(self, hwnd: int) -> Tuple[int, int]:
        left, top, right, bottom = win32gui.GetClientRect(hwnd)
        return ((right - left) // 2, (bottom - top) // 2)

    def clicar_controle_por_hwnd(self, hwnd: int, x: Optional[int] = None, y: Optional[int] = None) -> bool:
        if not win32gui.IsWindow(hwnd):
            raise RuntimeError(f"hwnd invalido para clique: {hwnd}")

        rel_x, rel_y = (x, y) if x is not None and y is not None else self._client_center(hwnd)
        lparam = win32api.MAKELONG(int(rel_x), int(rel_y))
        win32gui.PostMessage(hwnd, win32con.WM_MOUSEMOVE, 0, lparam)
        time.sleep(0.05)
        win32gui.PostMessage(hwnd, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, lparam)
        time.sleep(0.05)
        win32gui.PostMessage(hwnd, win32con.WM_LBUTTONUP, 0, lparam)
        self.log(f"botao clicado via mensagem: hwnd={hwnd} x={rel_x} y={rel_y}")
        return True

    def clicar_botao_por_nome(
        self,
        nome: Optional[str] = None,
        indice: Optional[int] = None,
        hwnd: Optional[int] = None,
    ) -> bool:
        control = self._resolve_control(
            nome=nome,
            indice=indice,
            hwnd=hwnd,
            allowed_categories=("button",),
        )

        if control["handle"]:
            try:
                return self.clicar_controle_por_hwnd(control["handle"])
            except Exception as exc:
                self.log(f"clique por mensagem falhou: hwnd={control['handle']} erro={exc}")

        try:
            wrapper = self._wrapper_for_hwnd(control["handle"])
            wrapper.invoke()
            self.log(f"fallback usado para clique: hwnd={control['handle']} metodo=invoke")
            return True
        except Exception as exc:
            raise RuntimeError(f"nao foi possivel clicar no botao {nome!r}: {exc}") from exc

    def aguardar_janela_aguarde_sumir(self, timeout: float = 30.0, intervalo: float = 0.2) -> bool:
        self.log(f"aguardando janela 'Aguarde...' sumir: timeout={timeout}s")
        deadline = time.time() + timeout
        while time.time() < deadline:
            found = []
            for hwnd, title, _class_name in self._iter_visible_windows():
                if "aguarde" in normalize_text(title):
                    found.append((hwnd, title))
            if not found:
                self.log("janela 'Aguarde...' nao encontrada; fluxo liberado")
                return True
            time.sleep(intervalo)
        self.log("timeout aguardando a janela 'Aguarde...' desaparecer")
        return False

    def resumo_controles(self) -> Dict[str, int]:
        controls = self.listar_controles()
        summary: Dict[str, int] = {}
        for control in controls:
            summary[control["category"]] = summary.get(control["category"], 0) + 1
        return dict(sorted(summary.items()))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Automacao em segundo plano para a janela do Alterdata.")
    parser.add_argument("--title", default=DEFAULT_TITLE, help="Titulo preferencial da janela alvo.")
    parser.add_argument("--title-regex", default=DEFAULT_TITLE_REGEX, help="Regex para localizar a janela alvo.")
    parser.add_argument("--class-name", default=DEFAULT_CLASS_NAME, help="Classe Win32 da janela alvo.")
    parser.add_argument("--diagnostico", action="store_true", help="Gera controles_alterdata.txt.")
    parser.add_argument("--listar-controles", action="store_true", help="Lista os controles no terminal.")
    parser.add_argument("--validar-janela", action="store_true", help="Valida se a janela alvo existe.")
    parser.add_argument("--validar-controle-nome", help="Valida se um controle existe por nome.")
    parser.add_argument("--validar-controle-hwnd", type=int, help="Valida se um controle existe por hwnd.")
    parser.add_argument("--validar-controle-categoria", help="Categoria do controle na validacao.")
    parser.add_argument("--preencher-edit-nome", help="Nome para localizar um Edit/Date.")
    parser.add_argument("--preencher-edit-indice", type=int, help="Indice da categoria edit/date.")
    parser.add_argument("--preencher-edit-hwnd", type=int, help="HWND direto do Edit/Date.")
    parser.add_argument("--texto", help="Texto a ser enviado para o Edit.")
    parser.add_argument("--limpar-edit", action="store_true", help="Limpa o Edit selecionado.")
    parser.add_argument("--clicar-botao", help="Nome do botao a clicar.")
    parser.add_argument("--clicar-botao-indice", type=int, help="Indice da categoria button.")
    parser.add_argument("--clicar-hwnd", type=int, help="Clica diretamente em um hwnd.")
    parser.add_argument("--aguardar-aguarde", action="store_true", help="Aguarda a janela 'Aguarde...' fechar.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    automation = AlterdataBackgroundAutomation(
        title=args.title,
        title_regex=args.title_regex,
        class_name=args.class_name,
    )

    try:
        automation.localizar_janela_alvo()

        if args.validar_janela:
            automation.validar_se_janela_existe()

        if args.diagnostico:
            automation.gerar_diagnostico_controles()

        if args.listar_controles:
            controls = automation.listar_controles(refresh=True)
            automation.log(f"resumo de controles: {automation.resumo_controles()}")
            for control in controls:
                print(automation._format_control_line(control))

        if args.validar_controle_nome or args.validar_controle_hwnd:
            categories = None
            if args.validar_controle_categoria:
                categories = (args.validar_controle_categoria,)
            automation.validar_se_controle_existe(
                nome=args.validar_controle_nome,
                hwnd=args.validar_controle_hwnd,
                allowed_categories=categories,
            )

        if args.preencher_edit_nome or args.preencher_edit_indice is not None or args.preencher_edit_hwnd:
            texto = args.texto
            if args.limpar_edit:
                texto = ""
            if texto is None:
                raise RuntimeError("informe --texto para preencher o campo ou use --limpar-edit.")
            automation.preencher_edit_por_nome_ou_indice(
                texto=texto,
                nome=args.preencher_edit_nome,
                indice=args.preencher_edit_indice,
                hwnd=args.preencher_edit_hwnd,
            )

        if args.clicar_botao or args.clicar_botao_indice is not None:
            automation.clicar_botao_por_nome(
                nome=args.clicar_botao,
                indice=args.clicar_botao_indice,
            )

        if args.clicar_hwnd:
            automation.clicar_controle_por_hwnd(args.clicar_hwnd)

        if args.aguardar_aguarde:
            automation.aguardar_janela_aguarde_sumir()

        if not any(
            [
                args.validar_janela,
                args.diagnostico,
                args.listar_controles,
                args.validar_controle_nome,
                args.validar_controle_hwnd,
                args.preencher_edit_nome,
                args.preencher_edit_indice is not None,
                args.preencher_edit_hwnd,
                args.clicar_botao,
                args.clicar_botao_indice is not None,
                args.clicar_hwnd,
                args.aguardar_aguarde,
            ]
        ):
            automation.log("nenhuma acao especifica foi solicitada. Use --diagnostico ou --listar-controles.")

        return 0
    except Exception as exc:
        automation.log(f"erro: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
