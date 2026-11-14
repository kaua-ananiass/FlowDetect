import json
import os
from pathlib import Path
import tempfile
import threading
import urllib.parse
import urllib.request
import unittest
from unittest.mock import patch

import google_workspace as google


class GoogleWorkspaceTests(unittest.TestCase):
    def test_sheet_link_is_validated_without_fetching_arbitrary_urls(self):
        identifier = "abcd_EFGH-123456789"
        self.assertEqual(google.sheet_id(f"https://docs.google.com/spreadsheets/d/{identifier}/edit#gid=0"), identifier)
        for bad in ["https://evil.test/file", "../connection.dat", "https://docs.google.com.evil.test/spreadsheets/d/" + identifier]:
            with self.assertRaises(ValueError):
                google.sheet_id(bad)

    def test_changes_preserve_other_users_edits(self):
        before = {"Dados": [["Nome", "Resultado"], ["Ana", ""]]}
        local = {"Dados": [["Nome", "Resultado"], ["Ana", "Concluído"]]}
        remote = {"Dados": [["Nome", "Resultado"], ["Ana atualizada", ""]]}
        self.assertEqual(google.changes(before, local, remote, {"Dados": "Dados"}),
                         [("Dados", 1, 1, {"stringValue": "Concluído"})])

    def test_conflict_stops_all_changes(self):
        with self.assertRaisesRegex(ValueError, "Conflito"):
            google.changes({"A": [[1]]}, {"A": [[2]]}, {"A": [[3]]}, {"A": "A"})

    def test_already_sent_value_does_not_write_again(self):
        self.assertEqual(google.changes({"A": [[1]]}, {"A": [[2]]}, {"A": [[2]]}, {"A": "A"}), [])

    def test_types_and_clearing_cells(self):
        edits = google.changes({"A": [["x", 3, False, ""]]}, {"A": [["", 4, True, "=SUM(B1)"]]},
                               {"A": [["x", 3, False, ""]]}, {"A": "A"})
        self.assertEqual([x[3] for x in edits], [{"stringValue": ""}, {"numberValue": 4}, {"boolValue": True}, {"formulaValue": "=SUM(B1)"}])

    def test_pull_and_push_real_xlsx_changes_only_modified_cells(self):
        from openpyxl import load_workbook
        identifier = "abcDEF_123456789"
        meta = {"properties": {"title": "Empresas"}, "sheets": [{"properties": {"title": "Dados", "sheetId": 7}}]}
        tabs = {"Dados": [["Empresa", "Status"], ["Empresa A", ""]]}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(google, "sheet_data", return_value=(meta, tabs)):
                result = google.pull(directory, identifier, "token")
            path = Path(directory) / result["workbook_id"]
            workbook = load_workbook(path)
            workbook.active["B2"] = "Concluído"
            workbook.save(path)
            workbook.close()
            with patch.object(google, "sheet_data", return_value=(meta, tabs)), patch.object(google, "request", return_value={}) as api:
                self.assertEqual(google.push(directory, identifier, "token"), {"updated_cells": 1})
                payload = api.call_args.kwargs["data"]["requests"]
                self.assertEqual(len(payload), 1)
                self.assertEqual(payload[0]["updateCells"]["range"]["sheetId"], 7)
            self.assertNotIn("token", path.with_suffix(".google.json").read_text())

    @unittest.skipUnless(os.name == "nt", "Windows DPAPI")
    def test_tokens_encrypted_outside_workspace(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(google, "storage", return_value=Path(directory)):
            google.save_private({"refresh_token": "test-secret-value"})
            self.assertNotIn(b"test-secret-value", (Path(directory) / "connection.dat").read_bytes())
            self.assertEqual(google.load_private()["refresh_token"], "test-secret-value")

    def test_web_client_is_rejected_without_changing_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "client.json"
            path.write_text(json.dumps({"web": {"client_id": "x"}}))
            with patch.object(google, "save_private") as save, self.assertRaisesRegex(ValueError, "App para computador"):
                google.configure(path)
            save.assert_not_called()

    def test_oauth_uses_pkce_and_loopback_without_exposing_tokens(self):
        authorize = {}
        def browser(url):
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
            authorize.update(query)
            def callback():
                target = query["redirect_uri"][0] + "?" + urllib.parse.urlencode({"state": query["state"][0], "code": "auth-code"})
                with urllib.request.urlopen(target, timeout=5) as response:
                    self.assertEqual(response.status, 200)
            thread = threading.Thread(target=callback, daemon=True)
            thread.start()
            return True
        connection = {"client_id": "desktop.apps.googleusercontent.com", "client_secret": "desktop-secret"}
        token = {"access_token": "access-value", "refresh_token": "refresh-value", "scope": google.SCOPES}
        with patch.object(google.webbrowser, "open", side_effect=browser), patch.object(google, "request", return_value=token) as api, patch.object(google, "save_private") as save:
            result = google.connect(connection)
            self.assertTrue(result["connected"])
            self.assertNotIn("access_token", result)
            verifier = api.call_args.kwargs["form"]["code_verifier"]
            expected = google.base64.urlsafe_b64encode(google.hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
            self.assertEqual(authorize["code_challenge"], [expected])
            self.assertTrue(authorize["redirect_uri"][0].startswith("http://127.0.0.1:"))
            self.assertEqual(save.call_args.args[0]["refresh_token"], "refresh-value")

    def test_auto_sync_merges_local_result_and_remote_input(self):
        from openpyxl import load_workbook
        identifier = "auto_sheet_123456789"
        meta = {"properties": {"title": "Empresas"}, "sheets": [{"properties": {"title": "Dados", "sheetId": 3}}]}
        initial = {"Dados": [["Empresa", "Status"], ["A", ""]]}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(google, "sheet_data", return_value=(meta, initial)):
                google.pull(directory, identifier, "token")
            path = google.link_path(directory, identifier)
            wb = load_workbook(path)
            wb.active["B2"] = "Concluído"
            wb.save(path)
            wb.close()
            remote = {"Dados": [["Empresa", "Status"], ["Nome atualizado", ""], ["Nova empresa", ""]]}
            with patch.object(google, "sheet_data", return_value=(meta, remote)), patch.object(google, "request", return_value={}) as api:
                result = google.sync(directory, identifier, "token")
            self.assertEqual(result["updated_cells"], 1)
            self.assertEqual(result["received_cells"], 2)
            self.assertEqual(len(api.call_args.kwargs["data"]["requests"]), 1)
            wb = load_workbook(path)
            self.assertEqual(wb.active["A2"].value, "Nome atualizado")
            self.assertEqual(wb.active["B2"].value, "Concluído")
            self.assertEqual(wb.active["A3"].value, "Nova empresa")
            wb.close()
            with patch.object(google, "sheet_data", return_value=(meta, {"Dados": [["Empresa", "Status"], ["Nome atualizado", "Concluído"], ["Nova empresa", ""]]})), patch.object(google, "request") as api:
                again = google.sync(directory, identifier, "token")
            self.assertEqual(again["updated_cells"], 0)
            self.assertEqual(again["received_cells"], 0)
            api.assert_not_called()

    def test_auto_conflict_preserves_both_local_files_and_makes_no_api_write(self):
        from openpyxl import load_workbook
        identifier = "auto_sheet_123456789"
        meta = {"properties": {"title": "Empresas"}, "sheets": [{"properties": {"title": "Dados", "sheetId": 3}}]}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(google, "sheet_data", return_value=(meta, {"Dados": [[1]]})):
                google.pull(directory, identifier, "token")
            path = google.link_path(directory, identifier)
            wb = load_workbook(path)
            wb.active["A1"] = 2
            wb.save(path)
            wb.close()
            before = path.read_bytes(), path.with_suffix('.google.json').read_bytes()
            with patch.object(google, "sheet_data", return_value=(meta, {"Dados": [[3]]})), patch.object(google, "request") as api:
                with self.assertRaisesRegex(ValueError, 'Conflito'):
                    google.sync(directory, identifier, 'token')
            api.assert_not_called()
            self.assertEqual(before, (path.read_bytes(), path.with_suffix('.google.json').read_bytes()))

    def test_drive_upload_is_streamed_to_google_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "relatorio.pdf"
            path.write_bytes(b"pdf data")
            connection = {"folder_id": "folder"}
            def api(url, method="GET", **kwargs):
                if method == "GET": return {"id": "folder", "trashed": False}
                if method == "POST": return (b"", {"Location": "https://www.googleapis.com/upload/session"})
                self.assertTrue(hasattr(kwargs["data"], "read"))
                self.assertEqual(kwargs["data"].read(), b"pdf data")
                return {"id": "file"}
            with patch.object(google, "access", return_value="token"), patch.object(google, "request", side_effect=api):
                self.assertEqual(google.upload(connection, path)["id"], "file")


if __name__ == "__main__":
    unittest.main()
