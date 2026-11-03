import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import gerenciar_roteiro as helper
from executar_automacao import ExecutorAutomacao


class MapPathsTests(unittest.TestCase):
    def test_import_remaps_nested_routes_and_isolates_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / 'source'
            (source / 'imagens').mkdir(parents=True)
            (source / 'imagens' / 'ref.png').write_bytes(b'image')
            (source / 'db.xlsx').write_bytes(b'source-sheet')
            current = {'eventos': [{'ordem': 1, 'sequencia': 'principal'}]}
            imported = {'sequencia_inicial': 'principal', 'eventos': [
                {'ordem': 1, 'sequencia': 'principal', 'tipo': 'clicar_imagem', 'detalhes': {'imagem': 'ref.png', 'bloco_sucesso': 2, 'ocr_targets': [{'falha': {'bloco': 2, 'sequencia': 'outra'}}]}},
                {'ordem': 2, 'sequencia': 'outra', 'tipo': 'sequencia_planilha', 'detalhes': {'arquivo': 'db.xlsx'}}]}
            with patch.object(helper, 'PASTA_IMAGENS', base / 'images'), patch.object(helper, 'DIRETORIO_PLANILHAS', base / 'sheets'):
                first = helper.mesclar_caminho_mapa(current, imported, 'Recuperar', 'principal', source)
                second = helper.mesclar_caminho_mapa(current, imported, 'Outra cópia', 'principal', source)
            self.assertEqual(current['eventos'][0]['ordem'], 1)
            detail = current['eventos'][1]['detalhes']
            self.assertEqual(detail['bloco_sucesso'], 3)
            self.assertEqual(detail['ocr_targets'][0]['falha']['bloco'], 3)
            self.assertEqual(detail['ocr_targets'][0]['falha']['sequencia'], first['sequences'][1])
            self.assertNotEqual(first['entry_sequence'], second['entry_sequence'])
            self.assertEqual(Path(detail['imagem']).read_bytes(), b'image')
            self.assertEqual(Path(current['eventos'][2]['detalhes']['arquivo']).read_bytes(), b'source-sheet')
            self.assertEqual(imported['eventos'][0]['detalhes']['bloco_sucesso'], 2)

    def test_invalid_external_reference_does_not_append_or_replace_the_map(self):
        current = {'eventos': [{'ordem': 1}]}
        with self.assertRaisesRegex(ValueError, 'Referencia'):
            helper.mesclar_caminho_mapa(current, {'eventos': [{'ordem': 1, 'sequencia': 'principal', 'detalhes': {'bloco_sucesso': 999}}]}, 'x', 'principal')
        self.assertEqual(len(current['eventos']), 1)

    def test_import_preserves_nested_chrome_paths_and_remaps_later_insertions(self):
        current = {'eventos': []}
        source = {'sequencia_inicial': 'principal', 'eventos': [
            {'ordem': 1, 'tipo': 'texto_livre', 'sequencia': 'principal', 'detalhes': {}},
            {'ordem': 2, 'tipo': 'texto_livre', 'sequencia': 'web', 'detalhes': {'ocr_targets': [{'bloco': 1}]}}],
            'map_paths': [{'id': 'old', 'name': 'Web', 'entry_sequence': 'web', 'sequences': ['web'], 'engine': 'chrome', 'page_id': '2'}]}
        root = helper.mesclar_caminho_mapa(current, source, 'Projeto', 'principal')
        nested = current['map_paths'][1]
        self.assertEqual(nested['engine'], 'chrome')
        self.assertEqual(nested['page_id'], '2')
        self.assertNotIn(nested['entry_sequence'], root['sequences'])
        orders = helper.mapa_ordens_eventos_existentes(current['eventos'])
        current['eventos'].insert(0, {'ordem': 0})
        helper.remapear_referencias_de_blocos(current, orders)
        self.assertEqual(current['eventos'][2]['detalhes']['ocr_targets'][0]['bloco'], 2)

    def test_cli_creates_and_connects_a_path_and_preserves_backup(self):
        script = Path(helper.__file__).resolve()
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            payload = {'sequencia_inicial': 'principal', 'eventos': [{'ordem': 1, 'tipo': 'procurar_texto_ocr', 'sequencia': 'principal', 'texto': '', 'detalhes': {'texto_ocr': 'Teste'}}]}
            (base / 'mapeamento_teclado.json').write_text(json.dumps(payload), encoding='utf-8')
            def call(request):
                run = subprocess.run([sys.executable, str(script), 'map-paths', '--request', json.dumps(request)], cwd=base, capture_output=True)
                self.assertEqual(run.returncode, 0, run.stderr.decode('utf-8', errors='replace'))
                return json.loads(run.stdout)
            result = call({'action': 'create', 'name': 'Recuperar', 'parent': 'principal'})
            sequence = result['map_paths'][0]['entry_sequence']
            result = call({'action': 'connect', 'source': 1, 'route': 'failure', 'sequence': sequence})
            self.assertEqual(result['events'][0]['details']['sequencia_nao_encontrar'], sequence)
            self.assertTrue(list((base / '.flowdetect_roteiro_history').glob('*.json')))

    def test_chrome_lane_mailbox_passes_entry_and_returns_desktop_route(self):
        executor = ExecutorAutomacao.__new__(ExecutorAutomacao)
        executor.eventos = [{'ordem': 1, 'tipo': 'texto_livre', 'texto': 'Desktop', 'sequencia': 'principal', 'detalhes': {}}, {'ordem': 2, 'tipo': 'texto_livre', 'texto': 'Web', 'sequencia': 'web', 'detalhes': {}}]
        executor.cancelamento_solicitado = lambda: False
        executor.obter_contexto_linha_loop = lambda context: {'empresa': '330'}
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            executor.arquivo_mapeamento = base / 'mapeamento_teclado.json'
            received = []
            def agent():
                for _ in range(100):
                    if (base / 'request.json').exists():
                        received.append(json.loads((base / 'request.json').read_text(encoding='utf-8')))
                        temp = base / 'reply.tmp'
                        temp.write_text(json.dumps({'ok': True, 'exit': {'action': 'ir_para_bloco', 'block': 1}}), encoding='utf-8')
                        os.replace(temp, base / 'reply.json')
                        return
                    time.sleep(.02)
            worker = threading.Thread(target=agent)
            worker.start()
            with patch.dict(os.environ, {'FLOWDETECT_MAP_BRIDGE_DIR': str(base)}):
                result = executor.executar_caminho_chrome_mapa({'id': 'p', 'name': 'Web', 'sequences': ['web'], 'page_id': '2'}, executor.eventos[1])
            worker.join()
            self.assertEqual(result['acao'], 'ir_para_bloco')
            self.assertEqual(result['bloco'], 1)
            self.assertEqual(received[0]['entryOrder'], 2)
            self.assertEqual(received[0]['automation']['map_boundary']['orders'], [1])
            self.assertEqual(len(received[0]['automation']['steps']), 1)
