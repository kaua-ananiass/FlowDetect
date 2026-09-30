import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import gerenciar_roteiro as roteiro


class RoadmapBlockIdentityTests(unittest.TestCase):
    def test_save_preserves_previous_roadmap_in_history(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            roadmap_path = root / "mapeamento_teclado.json"
            roadmap_path.write_text(json.dumps({"eventos": [{"tipo": "bloco_futuro", "texto": "original"}]}), encoding="utf-8")
            payload = {"eventos": [{"tipo": "bloco_futuro", "texto": "nova versao"}]}
            with patch.object(roteiro, "ARQUIVO_SAIDA", roadmap_path), \
                 patch.object(roteiro, "ARQUIVO_RESUMO", root / "resumo.txt"), \
                 patch.object(roteiro, "ARQUIVO_SCRIPT", root / "comandos.py"), \
                 patch.object(roteiro, "DIRETORIO_HISTORICO_ROTEIRO", root / "historico"), \
                 patch.object(roteiro, "sincronizar_automacao_ativa"):
                roteiro.normalizar_eventos(payload)
                roteiro.salvar_payload(payload)
            backups = list((root / "historico").glob("*.json"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(json.loads(backups[0].read_text(encoding="utf-8"))["eventos"][0]["texto"], "original")
            self.assertEqual(json.loads(roadmap_path.read_text(encoding="utf-8"))["eventos"][0]["texto"], "nova versao")

    def test_pdf_insertion_keeps_existing_blocks_and_ids(self):
        payload = {"eventos": [
            roteiro.criar_bloco_resultado_relatorio(status="Validacao 01"),
            {"tipo": "bloco_futuro", "sequencia": "pagina_2", "texto": "bloco diferente"},
            roteiro.criar_bloco_resultado_relatorio(status="Validacao 02"),
        ]}
        roteiro.normalizar_eventos(payload)
        before = [(item["id"], item["tipo"], item.get("texto")) for item in payload["eventos"]]

        roteiro.inserir_evento(payload, roteiro.criar_bloco_resultado_relatorio(status="Nova variacao"), 1, "after")
        roteiro.normalizar_eventos(payload)

        self.assertEqual(len(payload["eventos"]), 4)
        self.assertEqual(payload["eventos"][1]["detalhes"]["status"], "Nova variacao")
        self.assertEqual(
            [(item["id"], item["tipo"], item.get("texto")) for item in payload["eventos"] if item["id"] in {row[0] for row in before}],
            before,
        )
        self.assertEqual(len({item["id"] for item in payload["eventos"]}), 4)
        self.assertEqual(roteiro.card_do_evento(payload["eventos"][2])["id"], before[1][0])

    def test_duplicate_imported_ids_are_repaired_without_merging_blocks(self):
        payload = {"eventos": [
            {"id": "same", "tipo": "bloco_futuro", "texto": "A"},
            {"id": "same", "tipo": "bloco_futuro", "texto": "B"},
        ]}
        roteiro.normalizar_eventos(payload)
        self.assertEqual(payload["eventos"][0]["id"], "same")
        self.assertNotEqual(payload["eventos"][1]["id"], "same")
        self.assertEqual([item["texto"] for item in payload["eventos"]], ["A", "B"])


if __name__ == "__main__":
    unittest.main()
