"""Google Workspace desktop connection. Credentials stay outside automation exports."""
import base64
import ctypes
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def storage():
    return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "FlowDetect" / "Google"


def protect(data, decrypt=False):
    if os.name != "nt":
        raise ValueError("A conexão Google protegida está disponível no Windows.")
    class Blob(ctypes.Structure):
        _fields_ = [("size", ctypes.c_ulong), ("data", ctypes.POINTER(ctypes.c_ubyte))]
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    library = ctypes.WinDLL("crypt32", use_last_error=True)
    function = library.CryptUnprotectData if decrypt else library.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                         ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(Blob)]
    function.restype = ctypes.c_int
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise ValueError("Não foi possível acessar a conexão Google protegida deste usuário.")
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel = ctypes.WinDLL("kernel32")
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def load_private():
    path = storage() / "connection.dat"
    return json.loads(protect(path.read_bytes(), True)) if path.exists() else {}


def save_private(value):
    directory = storage()
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "connection.dat"
    temp = directory / (secrets.token_hex(8) + ".tmp")
    try:
        temp.write_bytes(protect(json.dumps(value).encode()))
        os.replace(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def request(url, method="GET", data=None, token=None, form=None, headers=None, raw=False):
    headers = dict(headers or {})
    if token:
        headers["Authorization"] = "Bearer " + token
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif data is not None and not isinstance(data, bytes) and not hasattr(data, "read"):
        data = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=60) as response:
            body = response.read()
            return (body, dict(response.headers)) if raw else (json.loads(body) if body else {})
    except urllib.error.HTTPError as exc:
        # Do not expose raw responses, URLs or token request bodies to the UI/logs.
        if exc.code == 401:
            raise ValueError("A sessão Google expirou. Conecte a conta novamente.") from None
        if exc.code == 403:
            raise ValueError("Acesso recusado pelo Google. Confira as APIs habilitadas, as permissões e o acesso da conta ao arquivo.") from None
        if exc.code == 404:
            raise ValueError("Arquivo Google não encontrado ou sem acesso para esta conta.") from None
        raise ValueError(f"O Google recusou a operação (HTTP {exc.code}). Nenhuma repetição automática foi feita.") from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Não foi possível concluir a conexão com o Google. Confira a internet.") from None


def access(connection):
    if not connection.get("refresh_token"):
        raise ValueError("Conecte sua conta Google primeiro.")
    if connection.get("expires_at", 0) < time.time() + 60:
        result = request(TOKEN_URL, "POST", form={
            "client_id": connection["client_id"], "client_secret": connection["client_secret"],
            "refresh_token": connection["refresh_token"], "grant_type": "refresh_token"})
        connection.update(access_token=result["access_token"], expires_at=time.time() + result.get("expires_in", 3600))
        save_private(connection)
    return connection["access_token"]


def configure(path):
    try:
        config = json.loads(Path(path).read_text(encoding="utf-8"))["installed"]
        client_id, secret = config["client_id"], config["client_secret"]
        if not isinstance(client_id, str) or not client_id.endswith(".apps.googleusercontent.com") or not isinstance(secret, str) or not secret:
            raise ValueError()
    except (OSError, ValueError, KeyError, TypeError):
        raise ValueError("Selecione o JSON OAuth do tipo App para computador baixado do Google Cloud.") from None
    # Replacing client configuration deliberately disconnects the previous account.
    save_private({"client_id": client_id, "client_secret": secret})
    return {"configured": True, "connected": False}


def connect(connection):
    if not connection.get("client_id"):
        raise ValueError("Importe primeiro o JSON OAuth do Google Cloud.")
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    outcome = {}
    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass
        def do_GET(self):
            parsed = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            valid = (parsed.path == "/oauth/callback" and len(query.get("state", [])) == 1
                     and hmac.compare_digest(query["state"][0], state))
            if valid:
                outcome.update(code=query.get("code", [None])[0], error=query.get("error", [None])[0])
            self.send_response(200 if valid else 400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write("Volte ao FlowDetect para conferir a conexão.".encode())
    with HTTPServer(("127.0.0.1", 0), Callback) as server:
        server.timeout = 1
        redirect = f"http://127.0.0.1:{server.server_port}/oauth/callback"
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
            "client_id": connection["client_id"], "redirect_uri": redirect, "response_type": "code",
            "scope": SCOPES, "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
            "access_type": "offline", "prompt": "consent select_account"})
        if not webbrowser.open(url):
            raise ValueError("Não foi possível abrir o navegador padrão.")
        deadline = time.monotonic() + 180
        while not outcome and time.monotonic() < deadline:
            server.handle_request()
    if not outcome.get("code") or outcome.get("error"):
        raise ValueError("Login cancelado, recusado ou expirado. Tente conectar novamente.")
    result = request(TOKEN_URL, "POST", form={"client_id": connection["client_id"],
        "client_secret": connection["client_secret"], "code": outcome["code"], "redirect_uri": redirect,
        "grant_type": "authorization_code", "code_verifier": verifier})
    granted = set(result.get("scope", "").split())
    if not set(SCOPES.split()).issubset(granted) or not result.get("refresh_token"):
        raise ValueError("Autorize o Google Sheets e os arquivos do Drive para completar a conexão.")
    connection.update(access_token=result["access_token"], refresh_token=result["refresh_token"],
                      expires_at=time.time() + result.get("expires_in", 3600))
    save_private(connection)
    return {"configured": True, "connected": True}


def sheet_id(value):
    value = str(value).strip()
    match = re.fullmatch(r"https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)(?:[/?#].*)?", value)
    identifier = match.group(1) if match else value
    if not re.fullmatch(r"[A-Za-z0-9_-]{15,160}", identifier):
        raise ValueError("Cole o link da planilha do Google Sheets.")
    return identifier


def sheet_data(identifier, token):
    base = "https://sheets.googleapis.com/v4/spreadsheets/" + identifier
    meta = request(base + "?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties))", token=token)
    sheets = meta.get("sheets", [])
    if sum(s["properties"].get("gridProperties", {}).get("rowCount", 0) * s["properties"].get("gridProperties", {}).get("columnCount", 0) for s in sheets) > 2_000_000:
        raise ValueError("Esta planilha é muito grande para importar no Studio (limite de 2 milhões de células).")
    ranges = ["'" + s["properties"]["title"].replace("'", "''") + "'" for s in sheets]
    result = request(base + "/values:batchGet?" + urllib.parse.urlencode(
        [("ranges", r) for r in ranges] + [("valueRenderOption", "FORMULA")]), token=token)
    return meta, {s["properties"]["title"]: v.get("values", []) for s, v in zip(sheets, result.get("valueRanges", []))}


def link_path(root, identifier):
    return Path(root) / "planilhas" / ("Google-" + identifier + ".xlsx")


def pull(root, identifier, token):
    from openpyxl import Workbook
    meta, tabs = sheet_data(identifier, token)
    workbook = Workbook()
    workbook.remove(workbook.active)
    names = {}
    for title, rows in tabs.items():
        safe_title = re.sub(r"[\\/*?:\[\]]", "_", title)[:31] or "Aba"
        sheet = workbook.create_sheet(safe_title)
        names[sheet.title] = title
        for row in rows:
            sheet.append(row)
    if not workbook.sheetnames:
        raise ValueError("A planilha não possui abas para importar.")
    path = link_path(root, identifier)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp.xlsx")
    try:
        workbook.save(temp)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)
        workbook.close()
    # Baseline contains workbook values only, never account credentials.
    path.with_suffix(".google.json").write_text(json.dumps({"id": identifier, "names": names, "baseline": tabs}), encoding="utf-8")
    return {"workbook_id": "planilhas/" + path.name, "title": meta["properties"]["title"], "tabs": len(tabs)}


def cell_value(rows, row, column):
    return rows[row][column] if row < len(rows) and column < len(rows[row]) else ""


def changes(baseline, local, remote, names):
    from openpyxl.utils import get_column_letter
    updates = []
    for local_name, title in names.items():
        if local_name not in local or title not in remote:
            raise ValueError("Uma aba foi removida ou renomeada. Baixe a planilha novamente antes de enviar.")
        before, after, current = baseline[title], local[local_name], remote[title]
        for row in range(max(len(before), len(after))):
            for col in range(max(len(before[row]) if row < len(before) else 0, len(after[row]) if row < len(after) else 0)):
                old, new, live = cell_value(before, row, col), cell_value(after, row, col), cell_value(current, row, col)
                if old == new:
                    continue
                if live != old and live != new:
                    raise ValueError(f"Conflito em {title}, célula {get_column_letter(col + 1)}{row + 1}. O Google tem outra alteração. Nenhum valor foi enviado.")
                if live != new:
                    # updateCells with typed extended values preserves text such as '=literal'.
                    key = "boolValue" if isinstance(new, bool) else "numberValue" if isinstance(new, (int, float)) else "formulaValue" if str(new).startswith("=") else "stringValue"
                    updates.append((title, row, col, {key: new}))
    return updates


def push(root, identifier, token):
    from openpyxl import load_workbook
    path = link_path(root, identifier)
    if not path.with_suffix(".google.json").exists():
        raise ValueError("Traga esta planilha do Google antes de enviar resultados.")
    saved = json.loads(path.with_suffix(".google.json").read_text(encoding="utf-8"))
    workbook = load_workbook(path, data_only=False)
    try:
        local = {s.title: [[v if v is not None else "" for v in row] for row in s.iter_rows(values_only=True)] for s in workbook}
    finally:
        workbook.close()
    meta, remote = sheet_data(identifier, token)
    edits = changes(saved["baseline"], local, remote, saved["names"])
    ids = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
    if edits:
        request("https://sheets.googleapis.com/v4/spreadsheets/" + identifier + ":batchUpdate", "POST", token=token, data={"requests": [
            {"updateCells": {"range": {"sheetId": ids[title], "startRowIndex": row, "endRowIndex": row + 1,
                "startColumnIndex": col, "endColumnIndex": col + 1}, "rows": [{"values": [{"userEnteredValue": value}]}], "fields": "userEnteredValue"}}
            for title, row, col, value in edits]})
    # Advance locally changed cells, including an earlier successful write whose
    # response was lost. Keep unrelated remote edits out of the local baseline.
    for local_name, title in saved["names"].items():
        before, after = saved["baseline"][title], local[local_name]
        for row in range(max(len(before), len(after))):
            for col in range(max(len(before[row]) if row < len(before) else 0, len(after[row]) if row < len(after) else 0)):
                old, new = cell_value(before, row, col), cell_value(after, row, col)
                if old == new:
                    continue
                while len(before) <= row:
                    before.append([])
                while len(before[row]) <= col:
                    before[row].append("")
                before[row][col] = new
    path.with_suffix(".google.json").write_text(json.dumps(saved), encoding="utf-8")
    return {"updated_cells": len(edits)}


def upload(connection, file_path):
    path = Path(file_path)
    if not path.is_file():
        raise ValueError("Selecione um arquivo local para enviar ao Drive.")
    token = access(connection)
    folder = connection.get("folder_id")
    if folder:
        info = request("https://www.googleapis.com/drive/v3/files/" + folder + "?fields=id,trashed", token=token)
        if info.get("trashed"):
            folder = None
    if not folder:
        info = request("https://www.googleapis.com/drive/v3/files?fields=id", "POST", token=token,
                       data={"name": "FlowDetect", "mimeType": "application/vnd.google-apps.folder"})
        folder = info["id"]
        connection["folder_id"] = folder
        save_private(connection)
    size = path.stat().st_size
    _, headers = request("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink", "POST",
        token=token, data={"name": path.name, "parents": [folder]}, raw=True,
        headers={"X-Upload-Content-Type": "application/octet-stream", "X-Upload-Content-Length": str(size)})
    location = next((v for k, v in headers.items() if k.lower() == "location"), "")
    parsed = urllib.parse.urlsplit(location)
    if parsed.scheme != "https" or parsed.hostname != "www.googleapis.com":
        raise ValueError("O Google retornou uma sessão de envio inválida.")
    # urllib streams a file object, avoiding a full in-memory copy of large PDFs/ZIPs.
    with path.open("rb") as stream:
        return request(location, "PUT", token=token, data=stream.read() if size == 0 else stream,
                       headers={"Content-Type": "application/octet-stream", "Content-Length": str(size)})


def sync(root, identifier, token):
    """Three-way cell merge. Conflicts abort before either side is written."""
    from openpyxl import load_workbook
    path = link_path(root, identifier)
    baseline_path = path.with_suffix(".google.json")
    if not path.exists() or not baseline_path.exists():
        raise ValueError("Traga a planilha primeiro para ativar a sincronização automática.")
    stamp = hashlib.sha256(path.read_bytes()).digest()
    saved = json.loads(baseline_path.read_text(encoding="utf-8"))
    workbook = load_workbook(path, data_only=False)
    temp = path.with_name(path.stem + ".sync.tmp.xlsx")
    try:
        local = {s.title: [[v if v is not None else "" for v in row] for row in s.iter_rows(values_only=True)] for s in workbook}
        meta, remote = sheet_data(identifier, token)
        if set(remote) != set(saved["baseline"]) or set(local) != set(saved["names"]):
            raise ValueError("As abas da planilha mudaram. Sincronização pausada; confira e traga a planilha novamente.")
        edits = changes(saved["baseline"], local, remote, saved["names"])
        received = 0
        merged = {}
        for name, title in saved["names"].items():
            before, after, live = saved["baseline"][title], local[name], remote[title]
            rows = []
            for row in range(max(len(before), len(after), len(live))):
                values = []
                width = max(len(part[row]) if row < len(part) else 0 for part in (before, after, live))
                for col in range(width):
                    old, new, current = (cell_value(part, row, col) for part in (before, after, live))
                    value = new if new != old else current
                    values.append(value)
                    if value != new:
                        workbook[name].cell(row + 1, col + 1).value = value if value != "" else None
                        received += 1
                rows.append(values)
            merged[title] = rows
        if hashlib.sha256(path.read_bytes()).digest() != stamp:
            raise ValueError("A planilha local foi alterada durante a leitura. Sincronização pausada; tente ativar novamente.")
        # Prepare and validate the local file before making a remote write.
        if received:
            workbook.save(temp)
        ids = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
        if edits:
            request("https://sheets.googleapis.com/v4/spreadsheets/" + identifier + ":batchUpdate", "POST", token=token, data={"requests": [
                {"updateCells": {"range": {"sheetId": ids[title], "startRowIndex": row, "endRowIndex": row + 1,
                    "startColumnIndex": col, "endColumnIndex": col + 1}, "rows": [{"values": [{"userEnteredValue": value}]}], "fields": "userEnteredValue"}}
                for title, row, col, value in edits]})
        if hashlib.sha256(path.read_bytes()).digest() != stamp:
            raise ValueError("A cópia local mudou durante a sincronização. Pausado para preservar seus dados; confira os resultados no Google.")
        if received:
            os.replace(temp, path)
        saved["baseline"] = merged
        baseline_path.write_text(json.dumps(saved), encoding="utf-8")
        return {"workbook_id": "planilhas/" + path.name, "updated_cells": len(edits), "received_cells": received}
    finally:
        workbook.close()
        temp.unlink(missing_ok=True)


def action(root, payload):
    command = payload.get("action", "status")
    if command == "configure":
        return configure(payload.get("path", ""))
    connection = load_private()
    if command == "status":
        return {"configured": bool(connection.get("client_id")), "connected": bool(connection.get("refresh_token"))}
    if command == "disconnect":
        save_private({k: connection[k] for k in ("client_id", "client_secret") if k in connection})
        return {"configured": bool(connection.get("client_id")), "connected": False}
    if command == "connect":
        return connect(connection)
    if command == "upload":
        return upload(connection, payload.get("path", ""))
    if command in ("pull", "push", "sync"):
        return {"pull": pull, "push": push, "sync": sync}[command](root, sheet_id(payload.get("url", "")), access(connection))
    raise ValueError("Operação Google desconhecida.")


if __name__ == "__main__":
    try:
        result = action(Path.cwd(), json.loads(sys.argv[1]))
    except Exception as error:
        result = {"erro": str(error) if isinstance(error, ValueError) else "Não foi possível concluir a operação Google. Confira o arquivo e tente novamente."}
    print(json.dumps(result, ensure_ascii=True))
