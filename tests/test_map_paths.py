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
    def test_chrome_json_recovers_editable_blocks_routes_images_and_data(self):
        project = {'schema': 'flowdetect_chrome_automation', 'initial_sequence': 'principal', 'steps': [
            {'type': 'ocr_text', 'source_order': 2, 'sequence': 'principal', 'text': 'Pesquisar', 'action': 'clicar', 'click': False, 'offset_x': 20, 'click_anchor': {'from_text_left': 22}, 'preview_image': {'data_url': 'data:image/png;base64,aW1hZ2U='}, 'on_failure': {'action': 'ir_para_bloco', 'block': 8, 'delay_ms': 300}},
            {'type': 'data_source', 'source_order': 4, 'sequence': 'principal', 'name': 'Codigo', 'values': ['330'], 'rows': [{'Empresa': 'Teste'}]},
            {'type': 'key_sequence', 'source_order': 6, 'sequence': 'principal', 'keys': ['enter'], 'repetitions': 2},
            {'type': 'report_result', 'source_order': 8, 'sequence': 'principal', 'status': 'OK', 'result': 'Finalizado'}]}
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory); source = base / 'source'; source.mkdir()
            recovered = helper.converter_projeto_chrome_importado(project, source)
            current = {'eventos': [{'ordem': 1, 'sequencia': 'principal', 'tipo': 'texto_livre', 'texto': 'Antes'}]}
            with patch.object(helper, 'PASTA_IMAGENS', base / 'images'), patch.object(helper, 'DIRETORIO_PLANILHAS', base / 'sheets'):
                helper.mesclar_caminho_mapa(current, recovered, 'Chrome', 'principal', source)
            ocr = current['eventos'][1]
            self.assertEqual(ocr['detalhes']['bloco_nao_encontrar'], 5)
            self.assertTrue(Path(ocr['detalhes']['imagem']).is_file())
            exported, warning = helper.converter_evento_para_chrome(ocr)
            self.assertIsNone(warning)
            self.assertEqual(exported['on_failure'], {'action': 'ir_para_bloco', 'block': 5, 'sequence': '', 'delay_ms': 300})
            self.assertEqual(exported['click_anchor'], project['steps'][0]['click_anchor'])
            self.assertFalse(exported['click'])
            data = current['eventos'][2]
            self.assertTrue(Path(data['detalhes']['arquivo']).is_file())
            exported, warning = helper.converter_evento_para_chrome(data)
            self.assertEqual(exported['values'], ['330'])
            self.assertEqual(exported['rows'], [{'Empresa': 'Teste'}])
            with self.assertRaisesRegex(ValueError, 'ainda nao importaveis'):
                helper.converter_projeto_chrome_importado({'schema': project['schema'], 'steps': [{'type': 'unknown'}]}, source)

    def test_section_count_matches_nonempty_map_lanes_and_library_summary(self):
        payload = {'eventos': [{'sequencia': 'principal'}, {'sequencia': 'principal'}, {'sequencia': 'web'}],
                   'map_paths': [{'sequences': ['web', 'empty']}]}
        self.assertEqual(helper.contar_secoes_payload(payload), 2)
        self.assertEqual(helper.contar_secoes_payload({'eventos': []}), 0)
        with patch.object(helper, 'carregar_biblioteca', return_value={'items': [{'id': 'test'}]}), \
             patch.object(helper, 'obter_automacao_ativa_id', return_value='test'), \
             patch.object(helper, 'carregar_payload_da_automacao', return_value=payload):
            self.assertEqual(helper.listar_automacoes_resumidas()['items'][0]['section_count'], 2)

    def test_delete_section_clears_incoming_routes_and_preserves_other_sections(self):
        payload = {'sequencia_inicial': 'principal', 'eventos': [
            {'ordem': 1, 'sequencia': 'principal', 'detalhes': {'ao_sucesso': 'ir_para_bloco', 'bloco_sucesso': 2, 'ocr_targets': [{'falha': {'action': 'ir_para_sequencia', 'sequencia': 'web'}}]}},
            {'ordem': 2, 'sequencia': 'web', 'detalhes': {}},
            {'ordem': 3, 'sequencia': 'other', 'detalhes': {'ao_sucesso': 'ir_para_bloco', 'bloco_sucesso': 1}}],
            'map_paths': [{'id': 'p', 'parent': 'principal', 'entry_sequence': 'web', 'sequences': ['web', 'other']}, {'id': 'child', 'parent': 'web', 'entry_sequence': 'child', 'sequences': ['child']}],
            'configuracoes_sequencia': {'web': {}, 'principal': {'after_loop_sequence': 'web'}}}
        helper.remover_secao_mapa(payload, 'web')
        self.assertEqual([e['sequencia'] for e in payload['eventos']], ['principal', 'other'])
        self.assertEqual(payload['eventos'][0]['detalhes']['ao_sucesso'], 'parar')
        self.assertEqual(payload['eventos'][0]['detalhes']['bloco_sucesso'], '')
        self.assertEqual(payload['eventos'][0]['detalhes']['ocr_targets'][0]['falha']['action'], 'parar')
        self.assertEqual(payload['eventos'][1]['detalhes']['bloco_sucesso'], 1)
        self.assertEqual(payload['map_paths'][0]['entry_sequence'], 'other')
        self.assertEqual(payload['map_paths'][1]['parent'], 'principal')
        self.assertNotIn('web', payload['configuracoes_sequencia'])
        self.assertEqual(payload['configuracoes_sequencia']['principal']['after_loop_sequence'], '')
        with self.assertRaises(ValueError):
            helper.remover_secao_mapa(payload, 'web')

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
            self.assertEqual(result['summary']['section_count'], 2)
            result = call({'action': 'connect', 'source': 1, 'route': 'failure', 'sequence': sequence})
            self.assertEqual(result['events'][0]['details']['sequencia_nao_encontrar'], sequence)
            self.assertTrue(list((base / '.flowdetect_roteiro_history').glob('*.json')))
            result = call({'action': 'delete', 'sequence': sequence})
            self.assertEqual(len(result['events']), 1)
            self.assertEqual(result['map_paths'], [])
            self.assertEqual(result['summary']['section_count'], 1)
            self.assertEqual(result['events'][0]['details']['ao_nao_encontrar'], 'parar')
            result = call({'action': 'delete', 'sequence': 'principal'})
            self.assertEqual(result['events'], [])

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
