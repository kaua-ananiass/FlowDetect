import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class RuntimePackageLayoutTest(unittest.TestCase):
    def test_launchers_are_exported_at_the_package_root(self):
        spec = importlib.util.spec_from_file_location(
            "roadmap_runtime_package_test", PROJECT_ROOT / "gerenciar_roteiro.py"
        )
        roadmap = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(roadmap)

        previous_cwd = Path.cwd()
        try:
            os.chdir(PROJECT_ROOT)
            with tempfile.TemporaryDirectory() as directory:
                result = roadmap.exportar_runtime_para_pasta(directory)
                package_files = Path(directory) / "runtime_update" / "files"
                for name in (
                    "executar_automacao.bat",
                    "instalar_dependencias_silencioso.bat",
                ):
                    self.assertIn(name, result["manifest"]["files"])
                    self.assertEqual(
                        (package_files / name).read_bytes(),
                        (PROJECT_ROOT / "scripts" / "runtime" / name).read_bytes(),
                    )
        finally:
            os.chdir(previous_cwd)

    def test_tauri_resource_sources_exist(self):
        for product in ("tauri_gerador", "flowdetect_agent", "flowdetect_runner"):
            config = PROJECT_ROOT / product / "src-tauri" / "tauri.conf.json"
            resources = json.loads(config.read_text(encoding="utf-8"))["bundle"]["resources"]
            for source in resources:
                with self.subTest(product=product, source=source):
                    self.assertTrue((config.parent / source).exists())


if __name__ == "__main__":
    unittest.main()
