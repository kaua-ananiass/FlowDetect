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

    def test_exports_web_blocks_for_the_chrome_runner(self):
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
                "teclas": ["enter"],
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
        self.assertEqual(exported["version"], 2)
        self.assertEqual([step["type"] for step in exported["steps"]], ["navigate", "element_action", "key_sequence"])
        self.assertEqual(exported["steps"][1]["selector"]["value"], "#email")
        self.assertEqual(exported["steps"][1]["action"]["value"], "teste@flowdetect.com")
        self.assertEqual(exported["steps"][2]["keys"], ["enter"])
        self.assertEqual(result["exported_steps"], 3)

    def test_exports_ocr_and_visual_reference_with_its_image_data(self):
        automation_id = "auto_visual"
        payload = self.roadmap.criar_payload_vazio()
        image_path = Path("imagens") / "referencia.png"
        image_path.parent.mkdir(parents=True)
        image_path.write_bytes(
            bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082")
        )
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "procurar_texto_ocr",
                "detalhes": {"texto": "Empresa", "acao": "clicar", "clicar": True, "timeout": 4},
            },
            {
                "ordem": 2,
                "sequencia": "principal",
                "tipo": "clicar_imagem",
                "detalhes": {"imagem": "referencia.png", "clicar": True, "confianca": 0.8},
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Visual"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))

        self.assertEqual([step["type"] for step in exported["steps"]], ["ocr_text", "visual_match"])
        self.assertTrue(exported["steps"][1]["image"]["data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exported["steps"][0]["click"])


if __name__ == "__main__":
    unittest.main()
