import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / "gerenciar_roteiro.py"


def load_roadmap_module():
    spec = importlib.util.spec_from_file_location("roadmap_chrome_export_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ChromeExtensionExportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.roadmap = load_roadmap_module()

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp_dir.name)

    def tearDown(self):
        os.chdir(self.previous_cwd)
        self.temp_dir.cleanup()

    def test_exports_supported_web_blocks_and_reports_unsupported_ones(self):
        automation_id = "auto_chrome"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "abrir_url",
                "intervalo_antes": 0,
                "detalhes": {"url": "https://example.com", "aguardar_segundos": 2},
            },
            {
                "ordem": 2,
                "sequencia": "principal",
                "tipo": "chrome_elemento_html",
                "intervalo_antes": 0.3,
                "detalhes": {
                    "alvo": {"metodo": "css", "valor": "#email"},
                    "acao": {"tipo": "preencher", "valor": "teste@flowdetect.com", "limpar_antes": True},
                    "timeout": 8000,
                },
            },
            {
                "ordem": 3,
                "sequencia": "principal",
                "tipo": "tecla",
                "intervalo_antes": 0,
                "detalhes": {},
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(
            automation_id,
            {"nome": "Cadastro", "descricao": "Cadastro web"},
        )

        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        self.assertEqual(exported["schema"], "flowdetect_chrome_automation")
        self.assertEqual(exported["version"], 1)
        self.assertEqual([step["type"] for step in exported["steps"]], ["navigate", "element_action"])
        self.assertEqual(exported["steps"][1]["selector"]["value"], "#email")
        self.assertEqual(exported["steps"][1]["action"]["value"], "teste@flowdetect.com")
        self.assertEqual(result["exported_steps"], 2)
        self.assertTrue(any("tecla" in warning for warning in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
