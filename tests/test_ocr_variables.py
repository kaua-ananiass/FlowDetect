import tempfile
import json
import os
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock
import executar_automacao as motor
import gerenciar_roteiro as roteiro


class OcrVariablesTest(unittest.TestCase):
    def setUp(self):
        self.capture = dict(enabled=True, name='valor_nota', kind='money', side='right', width=160, height=30, gap=8)
        self.executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        self.executor.contexto_variaveis = {}
        self.executor.eventos = [{'detalhes': {'ocr_target_layouts': [{'capture':self.capture}]}}]

    def test_money_requires_one_value_and_preserves_cents(self):
        valid = motor.ExecutorAutomacao.validar_valor_capturado
        self.assertEqual(valid('R$ 1.250,90'), '1250,90')
        self.assertEqual(valid('61,36'), '61,36')
        for raw in ['', 'Total', 'R$ 10,00 e R$ 20,00', '1.250.90', '100']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                valid(raw)

    def test_confirm_only_does_not_fall_through_to_legacy_click(self):
        from unittest.mock import patch
        local={'ocr_target_individual':True,'ocr_target_action':{'action':'continuar'},'ocr_target_index':0}
        with patch.object(motor.pyautogui,'click') as click:
            self.assertEqual(self.executor.aplicar_acao_individual_ocr(local,{}),'confirmar')
            click.assert_not_called()
        self.assertEqual(local['ocr_target_action_applied'],'confirmar')

    def test_date_checks_calendar(self):
        valid = motor.ExecutorAutomacao.validar_valor_capturado
        self.assertEqual(valid('29/02/2024', 'date'), '29/02/2024')
        with self.assertRaises(ValueError): valid('31/02/2025','date')

    def test_visual_region_tracks_reference_at_different_position_and_scale(self):
        config=dict(region=dict(x=.6,y=.3,width=.25,height=.2),anchor=dict(x=.1,y=.3,width=.3,height=.2))
        project=motor.ExecutorAutomacao.regiao_visual_variavel
        self.assertEqual(project(config,dict(left=100,top=200,width=120,height=40)),(300,200,100,40))
        self.assertEqual(project(config,dict(left=300,top=400,width=240,height=80)),(700,400,200,80))
        self.assertEqual(project(config,dict(left=100,top=200,width=400,height=200),True),(340,260,100,40))
        config['region']['x']=.95
        with self.assertRaises(ValueError):project(config,dict(left=0,top=0,width=100,height=40))

    def test_capture_follows_reference_and_fails_closed(self):
        self.executor.capturar_tela_pil = Mock(return_value=(object(),0,0))
        self.executor.ler_textos_variavel_ocr = Mock(return_value=['R$ 61,36','61,36'])
        self.executor.capturar_variavel_ocr({'left':100,'top':200,'width':120,'height':30},self.capture)
        self.executor.capturar_tela_pil.assert_called_with(region=(228,200,160,30))
        self.assertEqual(self.executor.contexto_variaveis['valor_nota'],'61,36')
        self.executor.ler_textos_variavel_ocr.return_value=['61,36','81,36']
        with self.assertRaises(ValueError): self.executor.capturar_variavel_ocr({'left':100,'top':200},self.capture)
        self.assertNotIn('valor_nota',self.executor.contexto_variaveis)

    def test_loop_does_not_reuse_another_company_value(self):
        self.executor.obter_contexto_linha_loop = Mock(return_value={'__arquivo__':'dados.xlsx','__aba__':'Empresas'})
        self.executor.obter_linha_atual_contexto = Mock(return_value=2)
        self.executor.preparar_escopo_variaveis({'linha_atual':2})
        self.executor.contexto_variaveis['valor_nota']='61,36'
        self.executor.preparar_escopo_variaveis({'linha_atual':2})
        self.assertIn('valor_nota',self.executor.contexto_variaveis)
        self.executor.obter_linha_atual_contexto.return_value=3
        self.executor.preparar_escopo_variaveis({'linha_atual':3})
        self.assertNotIn('valor_nota',self.executor.contexto_variaveis)

    def test_missing_captured_value_cannot_fill_field(self):
        self.executor.montar_contexto_substituicao=Mock(return_value={})
        with self.assertRaisesRegex(ValueError,'capturada'):
            self.executor.substituir_variaveis_texto('{{valor_nota}}')
        self.executor.contexto_variaveis['valor_nota']='61,36'
        self.executor.montar_contexto_substituicao.return_value={'valor_nota':'61,36'}
        self.assertEqual(self.executor.substituir_variaveis_texto('{{valor_nota}}'),'61,36')

    def test_capture_is_exported_and_disabled_capture_is_removed(self):
        event={'ordem':1,'tipo':'clicar_imagem','sequencia':'principal','detalhes':{'modo_reconhecimento':'texto_ocr','fonte_ocr':'chrome','texto_ocr_busca':'Valor total','clicar':False,'ocr_target_layouts':[{'texto':'Valor total','capture':self.capture}]}}
        step,warning=roteiro.converter_evento_para_chrome(event)
        self.assertIsNone(warning)
        self.assertEqual(step['variable_capture'],self.capture)
        event['detalhes']['chrome_import_extras']={'variable_capture':dict(self.capture)}
        self.capture['enabled']=False
        step,warning=roteiro.converter_evento_para_chrome(event)
        self.assertNotIn('variable_capture',step)

    def test_import_preserves_capture_for_editing(self):
        step={'type':'ocr_text','text':'Valor total','source_order':1,'click':False,'variable_capture':self.capture}
        with tempfile.TemporaryDirectory() as directory:
            project=roteiro.converter_projeto_chrome_importado({'schema':'flowdetect_chrome_automation','steps':[step]},Path(directory))
            self.assertEqual(project['eventos'][0]['detalhes']['ocr_target_layouts'][0]['capture'],self.capture)

    def test_chrome_capture_returns_to_desktop_context(self):
        self.executor.eventos.append({'ordem':2,'tipo':'texto_livre','texto':'teste','sequencia':'web','detalhes':{}})
        self.executor.eventos[0].update(ordem=1,sequencia='principal')
        self.executor.obter_contexto_linha_loop=Mock(return_value={})
        self.executor.arquivo_mapeamento=Path('mapeamento_teclado.json').resolve()
        self.executor.cancelamento_solicitado=Mock(return_value=False)
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            def answer():
                for _ in range(100):
                    if (folder/'request.json').exists():
                        (folder/'response.tmp').write_text(json.dumps({'ok':True,'variables':{'valor_nota':'61,36','nao_declarada':'não importar'}}),encoding='utf-8')
                        os.replace(folder/'response.tmp',folder/'reply.json');return
                    time.sleep(.02)
            from unittest.mock import patch
            with patch.dict(os.environ,{'FLOWDETECT_MAP_BRIDGE_DIR':directory}):
                thread=threading.Thread(target=answer);thread.start()
                self.executor.executar_caminho_chrome_mapa({'id':'test','name':'Portal','sequences':['web']},self.executor.eventos[1])
                thread.join()
        self.assertEqual(self.executor.contexto_variaveis['valor_nota'],'61,36')
        self.assertNotIn('nao_declarada',self.executor.contexto_variaveis)


if __name__=='__main__': unittest.main()
