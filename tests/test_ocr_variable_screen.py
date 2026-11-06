import unittest
from unittest.mock import Mock
import reconhecimento_worker as worker
from executar_automacao import ExecutorAutomacao
import executar_automacao as motor
from pathlib import Path


class ScreenVariableTest(unittest.TestCase):
    def setUp(self):
        self.engine=ExecutorAutomacao.__new__(ExecutorAutomacao)
        self.engine.contexto_variaveis={}
        self.engine.localizar_texto_por_ocr_screenshot=Mock(return_value=[dict(left=100,top=100,width=120,height=40,source='ocr')])
        self.engine.capturar_tela_pil=Mock(return_value=(object(),0,0))
        self.engine.ler_textos_variavel_ocr=Mock(return_value=['84,67'])
        self.engine.marcar_regiao_ocr=Mock(return_value=True)
        self.engine.marcar_area_reconhecida=Mock(return_value=True)
        self.engine.clicar_resultado_texto=Mock(side_effect=AssertionError('no clicks'))
        self.request={'reference':'Valor do documento','capture':dict(enabled=True,name='Valor_DOC',kind='money',region=dict(x=.6,y=.3,width=.25,height=.2),anchor=dict(x=.1,y=.3,width=.3,height=.2))}

    def test_screen_ocr_returns_value_and_region_without_clicking(self):
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['value'],'84,67')
        self.assertEqual(result['raw_text'],'84,67')
        self.assertEqual(result['region'],[300,100,100,40])
        self.engine.clicar_resultado_texto.assert_not_called()
        self.assertEqual(self.engine.marcar_area_reconhecida.call_count,2)
        self.assertTrue(result["results"][0]["markerShown"])

    def test_ambiguous_capture_returns_raw_text_for_adjustment(self):
        self.engine.ler_textos_variavel_ocr.return_value=['84,67 100,00']
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertFalse(result['ok'])
        self.assertEqual(result['raw_text'],'84,67 100,00')
        self.assertNotIn('value',result)
        self.assertNotIn('Valor_DOC',self.engine.contexto_variaveis)

    def test_reuses_first_confirmed_ocr_anchor_without_second_lookup(self):
        anchor = dict(left=100, top=100, width=120, height=40, source='ocr')
        self.engine.localizar_texto_por_ocr_screenshot.return_value=[anchor, dict(left=900,top=500,width=120,height=40)]
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['region'], [300,100,100,40])
        self.engine.localizar_texto_por_ocr_screenshot.assert_called_once()
        self.assertEqual(self.engine.localizar_texto_por_ocr_screenshot.call_args.kwargs['limite_candidatos'],1)
        self.assertEqual(self.engine.marcar_area_reconhecida.call_count,2)
        self.assertEqual({call.kwargs["tema"] for call in self.engine.marcar_area_reconhecida.call_args_list},{"ocr","variavel"})

    def test_joint_test_reports_ocr_success_even_when_variable_is_invalid(self):
        self.engine.ler_textos_variavel_ocr.return_value=['84,67 100,00']
        self.request['texts']=['Valor do documento','Confirmar']
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertFalse(result['ok'])
        self.assertTrue(all(row['found'] for row in result['results']))
        self.assertFalse(result['variable']['found'])
        self.assertEqual(self.engine.localizar_texto_por_ocr_screenshot.call_count,2)

    def test_markers_are_sequential_with_identical_style_and_timing(self):
        calls=[]
        active=False
        def show(bounds,**kwargs):
            nonlocal active
            self.assertFalse(active)
            active=True
            self.engine.capturar_tela_pil.assert_called_once()
            calls.append(kwargs)
            active=False
            return True
        self.engine.marcar_area_reconhecida.side_effect=show
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertTrue(result['ok'])
        self.assertTrue(result['results'][0]['markerShown'])
        self.assertEqual([c['tema'] for c in calls],['ocr','variavel'])
        self.assertEqual([c['etiqueta'] for c in calls],['OCR 1','Vari\u00e1vel'])
        for key in ('duracao','bloqueante','margem'):
            self.assertEqual(calls[0][key],calls[1][key])
        self.assertTrue(calls[0]['bloqueante'])
        self.engine.marcar_regiao_ocr.assert_not_called()

    def test_missing_reference_does_not_use_saved_image_value(self):
        self.engine.localizar_texto_por_ocr_screenshot.return_value=[]
        result=worker.testar_variavel_na_tela(self.engine,self.request)
        self.assertFalse(result['ok'])
        self.engine.capturar_tela_pil.assert_not_called()

    @unittest.skipUnless(motor.OCR_DISPONIVEL and motor.TESSERACT_EXECUTAVEL and Path('C:/Windows/Fonts/arial.ttf').exists(), 'Requires Windows OCR runtime')
    def test_real_local_ocr_reads_8467_from_image_pixels(self):
        from PIL import Image, ImageDraw, ImageFont
        image=Image.new('RGB',(800,300),'white');draw=ImageDraw.Draw(image)
        font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',28)
        draw.text((60,100),'Valor',font=font,fill='black')
        draw.text((340,100),'84,67',font=font,fill='black')
        bounds=draw.textbbox((60,100),'Valor',font=font)
        engine=ExecutorAutomacao(arquivo_mapeamento=Path('mapeamento_teclado.json'),arquivo_planilha=Path('db.xlsx'),modo_teste_reconhecimento=True)
        def capture(region=None,**_):
            if region:
                x,y,w,h=map(int,region);return image.crop((x,y,x+w,y+h)),x,y
            return image.copy(),0,0
        engine.capturar_tela_pil=Mock(side_effect=capture)
        engine.marcar_regiao_ocr=Mock()
        engine.marcar_area_reconhecida=Mock()
        config=dict(enabled=True,name='Valor_DOC',kind='money',region=dict(x=320/800,y=100/300,width=220/800,height=80/300),anchor=dict(x=bounds[0]/800,y=bounds[1]/300,width=(bounds[2]-bounds[0])/800,height=(bounds[3]-bounds[1])/300))
        result=worker.testar_variavel_na_tela(engine,dict(reference='Valor',capture=config))
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['value'],'84,67')

    @unittest.skipUnless(motor.OCR_DISPONIVEL and motor.TESSERACT_EXECUTAVEL, 'Requires OCR runtime')
    def test_real_saved_reference_uses_text_box_not_padded_editor_box(self):
        from PIL import Image
        fixture=Path(__file__).parent/'fixtures/ocr-variable-document.png'
        image=Image.open(fixture).convert('RGB')
        engine=ExecutorAutomacao(arquivo_mapeamento=Path('mapeamento_teclado.json'),arquivo_planilha=Path('db.xlsx'),modo_teste_reconhecimento=True)
        def capture(region=None,**_):
            if region:
                x,y,w,h=map(int,region);return image.crop((x,y,x+w,y+h)),x,y
            return image.copy(),0,0
        engine.capturar_tela_pil=Mock(side_effect=capture)
        engine.marcar_regiao_ocr=Mock();engine.marcar_area_reconhecida=Mock()
        config=dict(enabled=True,name='VALOR_DOC',kind='money',referenceImage=str(fixture.resolve()),referenceText='Valor do Documento',
            region=dict(x=.4893939394,y=.4938112353,width=.4757575758,height=.4114754098),
            anchor=dict(x=.0492424242,y=.0901639344,width=.8560606061,height=.4262295082))
        result=worker.testar_variavel_na_tela(engine,dict(reference='Valor do Documento',capture=config))
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['value'],'84,67')
        self.assertEqual(result['raw_text'],'84,67')
        # The marked text rectangle is 26 px high, but glyphs are only ~10 px.
        # Projection must not compress the value area or move it into the next row.
        self.assertLess(result['region'][1],38)
        self.assertGreater(result['region'][1]+result['region'][3],49)
        self.assertTrue(engine._cache_ancoras_variaveis)


if __name__=='__main__':unittest.main()
