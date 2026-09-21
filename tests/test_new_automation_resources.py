import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / "gerenciar_roteiro.py"


def load_roadmap_module():
    spec = importlib.util.spec_from_file_location("roadmap_new_automation_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class NewAutomationResourcesTest(unittest.TestCase):
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

    def test_new_automation_starts_without_previous_spreadsheets(self):
        # Simula os recursos carregados pela automacao aberta anteriormente.
        Path("db.xlsx").write_bytes(b"planilha-anterior")
        Path("planilhas").mkdir()
        Path("planilhas/Clientes.xlsx").write_bytes(b"clientes-anteriores")

        response = self.roadmap.comando_criar_automacao(
            SimpleNamespace(nome="Automacao limpa", descricao="", categoria="Outros")
        )

        automation_id = response["active_automation"]["id"]
        automation_dir = Path("automacoes") / automation_id

        self.assertFalse(Path("db.xlsx").exists())
        self.assertFalse(Path("planilhas").exists())
        self.assertFalse((automation_dir / "db.xlsx").exists())
        self.assertFalse((automation_dir / "planilhas").exists())


if __name__ == "__main__":
    unittest.main()
