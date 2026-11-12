import copy
import json
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import gerenciar_roteiro as helper


class ChatGPTFlowTests(unittest.TestCase):
    def setUp(self):
        self.payload = {"eventos": [{"ordem": 1, "tipo": "chrome_tabela", "sequencia": "principal", "texto": "Tabela",
            "detalhes": {"table": {"mode": "list", "descriptor": {"headers": ["Guia", "Valor"]}, "prepare_loop": True,
                                   "rows": [["PRIVATE_GUIDE", "SECRET_VALUE"]]}, "ao_sucesso": "ir_para_bloco", "bloco_sucesso": 999}}]}

    def draft(self, steps, questions=None):
        return {"name": "Minha rotina", "summary": "Proposta", "revision": helper.contexto_chatgpt(self.payload)["revision"],
                "steps": steps, "questions": questions or []}

    def test_context_contains_structure_but_no_rows_or_commands(self):
        self.payload["eventos"][0]["comando_python"] = "SECRET_CODE"
        context = json.dumps(helper.contexto_chatgpt(self.payload))
        self.assertIn("Guia", context)
        for secret in ("PRIVATE_GUIDE", "SECRET_VALUE", "SECRET_CODE"):
            self.assertNotIn(secret, context)

    def test_compile_and_merge_isolated_editable_blocks(self):
        draft = self.draft([{"kind": "reuse", "source_order": 1, "title": "Lista de guias"},
                            {"kind": "loop_start", "title": "Para cada guia"},
                            {"kind": "text", "text": "{{VALOR_DOC}}", "title": "Digitar valor"},
                            {"kind": "keys", "keys": ["tab"], "title": "Próximo campo"},
                            {"kind": "loop_end", "title": "Próxima guia"}])
        original = copy.deepcopy(self.payload)
        origin, preview = helper.preparar_proposta_chatgpt(self.payload, draft)
        self.assertEqual(self.payload, original)
        self.assertEqual(origin["eventos"][0]["detalhes"]["bloco_sucesso"], "")
        self.assertEqual(origin["eventos"][0]["detalhes"]["ao_sucesso"], "continuar")
        helper.mesclar_caminho_mapa(self.payload, origin, draft["name"], "principal")
        self.assertEqual(len(self.payload["eventos"]), 6)
        self.assertNotEqual(self.payload["eventos"][1]["sequencia"], "principal")
        self.assertEqual(self.payload["eventos"][3]["texto"], "{{VALOR_DOC}}")
        self.assertEqual(preview[0]["source_order"], 1)
        self.assertEqual(helper.card_do_evento(origin["eventos"][0])["title"], "Lista de guias")

    def test_stale_proposal_cannot_copy_wrong_mapping(self):
        draft = self.draft([{"kind": "reuse", "source_order": 1, "title": "Tabela"}])
        self.payload["eventos"][0]["detalhes"]["table"]["descriptor"]["headers"] = ["Outra tabela"]
        with self.assertRaisesRegex(ValueError, "mapa mudou"):
            helper.preparar_proposta_chatgpt(self.payload, draft)

    def test_saving_metadata_does_not_invalidate_a_proposal(self):
        draft = self.draft([{"kind": "reuse", "source_order": 1, "title": "Tabela"}])
        self.payload.update(criado_em="new timestamp", resumo_digitado="new summary")
        _, preview = helper.preparar_proposta_chatgpt(self.payload, draft)
        self.assertEqual(len(preview), 1)

    def test_rejects_code_invented_blocks_urls_keys_and_unbalanced_loop(self):
        cases = [[{"kind": "shell", "title": "Executar", "command": "whoami"}],
                 [{"kind": "reuse", "title": "Alvo inventado", "source_order": 999}],
                 [{"kind": "navigate", "title": "Programa", "url": "javascript:alert(1)"}],
                 [{"kind": "navigate", "title": "Credenciais", "url": "https://user:pass@example.com"}],
                 [{"kind": "keys", "title": "Inválido", "keys": ["__import__('os')"]}],
                 [{"kind": "loop_end", "title": "Fim"}],
                 [{"kind": "loop_start", "title": "Início"}]]
        for steps in cases:
            with self.subTest(steps=steps), self.assertRaises(ValueError):
                helper.preparar_proposta_chatgpt(self.payload, self.draft(steps))

    def test_questions_block_apply_and_validation_does_not_save(self):
        import argparse
        draft = self.draft([], ["Mapeie o botão de abrir no Chrome."])
        with patch.object(helper, 'carregar_e_normalizar', return_value=self.payload), patch.object(helper, 'salvar_e_retornar') as save:
            result = helper.comando_caminhos_mapa(argparse.Namespace(request=json.dumps({"action": "ai_validate", "draft": draft})))
            self.assertFalse(result["can_apply"])
            with self.assertRaisesRegex(ValueError, "Responda"):
                helper.comando_caminhos_mapa(argparse.Namespace(request=json.dumps({"action": "ai_apply", "draft": draft})))
            save.assert_not_called()

    def test_apply_creates_new_section_without_touching_original(self):
        import argparse
        draft = self.draft([{"kind": "navigate", "url": "https://example.com/", "title": "Abrir portal"}])
        original = copy.deepcopy(self.payload["eventos"][0])
        with patch.object(helper, 'carregar_e_normalizar', return_value=self.payload), patch.object(helper, 'salvar_e_retornar', side_effect=lambda p:p):
            result = helper.comando_caminhos_mapa(argparse.Namespace(request=json.dumps({"action": "ai_apply", "draft": draft})))
            self.assertEqual(result["eventos"][0], original)
            self.assertEqual(result["map_paths"][0]["engine"], "chrome")
            self.assertEqual(result["eventos"][1]["tipo"], "abrir_url")

    def test_real_cli_context_validate_apply_preserves_a_legacy_project(self):
        # A legacy project may have no IDs; read-only normalization generates them.
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / 'mapeamento_teclado.json').write_text(json.dumps(self.payload), encoding='utf-8')
            def command(request):
                result = subprocess.run([sys.executable, str(Path(helper.__file__).resolve()), 'map-paths', '--request', json.dumps(request)],
                                        cwd=base, capture_output=True, text=True, encoding='utf-8')
                self.assertEqual(result.returncode, 0, result.stderr)
                return json.loads(result.stdout)
            context = command({'action':'ai_context'})
            draft = self.draft([{'kind':'text','text':'{{VALOR_DOC}}','title':'Digitar valor'}])
            draft['revision'] = context['revision']
            validated = command({'action':'ai_validate','draft':draft})
            self.assertTrue(validated['can_apply'])
            self.assertFalse((base / '.flowdetect_roteiro_history').exists())
            applied = command({'action':'ai_apply','draft':draft})
            self.assertEqual(len(applied['events']),2)
            self.assertEqual(applied['events'][1]['text'],'{{VALOR_DOC}}')
            self.assertEqual(applied['events'][1]['title'],'Digitar valor')
            self.assertTrue(list((base / '.flowdetect_roteiro_history').glob('*.json')))


if __name__ == '__main__':
    unittest.main()
