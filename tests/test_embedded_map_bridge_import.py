import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / 'tauri_gerador/src-tauri/installer_support/python_runtime_prebuilt/python.exe'


@unittest.skipUnless(PYTHON.exists(), 'Requer runtime portatil Windows')
class EmbeddedMapImportTest(unittest.TestCase):
    def test_screen_capture_probe_returns_json_in_embedded_runtime(self):
        import json
        result = subprocess.run(
            [str(PYTHON), '-I', str(ROOT / 'reconhecimento_worker.py'), '--test-variable', '{"reference":"","capture":{"enabled":true}}'],
            cwd=ROOT, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        payload=json.loads(result.stdout)
        self.assertFalse(payload['ok'])
        self.assertIn('error', payload)

    def test_recognition_worker_imports_sibling_with_isolated_runtime(self):
        # EOF lets the actual worker initialize and exit without screenshots,
        # clicks, OCR or modifying the active automation.
        result = subprocess.run(
            [str(PYTHON), '-I', str(ROOT / 'reconhecimento_worker.py')],
            input=b'', cwd=ROOT, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))

    def test_map_converter_loads_with_embedded_isolated_sys_path(self):
        code = r'''
import importlib.util,sys,os,json,threading,time,tempfile
from pathlib import Path
root=Path(sys.argv[1])
assert str(root) not in sys.path
spec=importlib.util.spec_from_file_location('executor_test',root/'executar_automacao.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
executor=module.ExecutorAutomacao.__new__(module.ExecutorAutomacao)
executor.eventos=[{'ordem':1,'tipo':'texto_livre','texto':'teste','sequencia':'web','detalhes':{}}]
executor.arquivo_mapeamento=root/'mapeamento_teclado.json'
executor.cancelamento_solicitado=lambda:False
executor.obter_contexto_linha_loop=lambda _:{}
with tempfile.TemporaryDirectory() as temp:
    folder=Path(temp);os.environ['FLOWDETECT_MAP_BRIDGE_DIR']=temp
    def answer():
        for _ in range(100):
            if (folder/'request.json').exists():
                request=json.loads((folder/'request.json').read_text(encoding='utf-8'))
                assert request['automation']['steps'][0]['source_order']==1
                (folder/'response.tmp').write_text('{"ok":true}',encoding='utf-8')
                os.replace(folder/'response.tmp',folder/'reply.json');return
            time.sleep(.05)
    worker=threading.Thread(target=answer);worker.start()
    assert executor.executar_caminho_chrome_mapa({'id':'test','name':'test','sequences':['web']},executor.eventos[0]) is None
    worker.join()
print('embedded-map-import-ok')
'''
        result = subprocess.run([str(PYTHON), '-I', '-c', code, str(ROOT)], cwd=ROOT, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        self.assertIn(b'embedded-map-import-ok', result.stdout)
