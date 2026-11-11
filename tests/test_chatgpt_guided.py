import argparse
import copy
import json
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import gerenciar_roteiro as helper
import chatgpt_guided as guided


class GuidedTests(unittest.TestCase):
    def setUp(self):
        self.payload={"sequencia_inicial":"principal","eventos":[{"id":"existing-id","ordem":1,"sequencia":"principal","tipo":"chrome_tabela","texto":"Guias","detalhes":{"table":{"descriptor":{"headers":["Guia","Valor"]},"rows":[["PRIVATE"]]}}}]}
        helper.normalizar_eventos(self.payload)

    def step(self,kind="ocr",**extra):
        return {"id":"consulta","kind":kind,"title":"Consultar guias","description":"Abrir a consulta","instruction":"Abra o Chrome, recorte o botão Consultar e configure OCR no editor.",**extra}

    def plan(self,**extra):
        return {"name":"Guias","message":"Vamos configurar a consulta.","steps":[self.step()],"questions":[],**extra}

    def test_validated_context_reports_missing_fields_without_images_or_rows(self):
        self.payload['eventos'].append({"ordem":2,"tipo":"clicar_imagem","detalhes":{"imagem":""}})
        context=guided.context(helper,self.payload)
        self.assertNotIn('PRIVATE',json.dumps(context))
        self.assertFalse(context['blocks'][1]['configured'])
        self.assertFalse(context['blocks'][0]['tested'])
        knowledge=context['block_knowledge']
        self.assertIn('Não clica',knowledge['blocks']['clicar_imagem']['actions']['Procurar'])
        self.assertNotIn('[data-tree',json.dumps(knowledge))

    def test_focus_must_be_a_real_control_for_the_block_type(self):
        self.payload['eventos'].append({'ordem':2,'id':'recognition','tipo':'clicar_imagem','detalhes':{'clicar':False,'cliques':0,'imagem':'','modo_reconhecimento':'imagem'}})
        plan=self.plan(steps=[self.step('reuse',source_order=2,focus='recognition.test')],navigation={'tab':'commands','order':2,'reason':'Entender Procurar','focus':'recognition.click_mode'})
        result=guided.validate(helper,self.payload,plan)
        self.assertEqual(result['steps'][0]['focus'],'recognition.test')
        self.assertEqual(result['navigation']['focus'],'recognition.click_mode')
        configuration=guided.context(helper,self.payload)['blocks'][-1]['configuration']
        self.assertFalse(configuration['click_during_execution']);self.assertIn('nunca clicar',configuration['test_action'])
        for invalid in ['button[data-tree-action=save]','imaginary.field','table.map']:
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):guided.validate(helper,self.payload,self.plan(steps=[self.step('reuse',source_order=2,focus=invalid)]))

    def test_known_editor_can_be_explained_and_opened_without_becoming_reusable_in_a_proposal(self):
        self.payload['eventos'].append({'ordem':2,'id':'sheet','tipo':'sequencia_planilha','detalhes':{'aba':'PRIVATE_SHEET','coluna':'PRIVATE_COLUMN'}})
        context=helper.contexto_chatgpt(self.payload)
        self.assertFalse(context['blocks'][-1]['can_reuse_in_proposal'])
        self.assertNotIn('PRIVATE_SHEET',json.dumps(context))
        result=guided.validate(helper,self.payload,self.plan(steps=[self.step('reuse',source_order=2,focus='block.editor')]))
        self.assertEqual(result['steps'][0]['block_id'],'sheet')

    def test_navigation_rejects_unknown_surface_invented_block_and_stale_map(self):
        for nav in [{"tab":"shell","reason":"Bad"},{"tab":"commands","order":99,"reason":"Bad"},{"tab":"workbook","order":1,"reason":"Bad"}]:
            with self.subTest(nav=nav),self.assertRaises(ValueError):guided.validate(helper,self.payload,self.plan(navigation=nav))
        with self.assertRaisesRegex(ValueError,'mapa mudou'):guided.validate(helper,self.payload,self.plan(revision='old'))
        valid=guided.validate(helper,self.payload,self.plan(navigation={"tab":"commands","order":1,"reason":"Mapeie aqui"}))
        self.assertEqual(valid['navigation']['block_id'],'existing-id')

    def test_no_model_code_selectors_or_fabricated_urls_are_compiled(self):
        for step in [self.step('shell',command='whoami'),self.step('navigate',url='javascript:alert(1)'),self.step('keys',keys=['exec']),self.step('reuse',source_order=44)]:
            with self.subTest(step=step),self.assertRaises(ValueError):guided.validate(helper,self.payload,self.plan(steps=[step]))
        valid=guided.validate(helper,self.payload,self.plan(steps=[self.step(selector='malicious',command='whoami')]))
        self.assertNotIn('selector',valid['steps'][0]);self.assertNotIn('command',valid['steps'][0])

    def test_create_actual_recognition_and_table_in_same_isolated_section_without_duplicates(self):
        original=copy.deepcopy(self.payload['eventos'][0])
        request={"name":"Guias","revision":helper.contexto_chatgpt(self.payload)['revision'],"guide_id":"conversation-a","step":self.step()}
        with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
            roadmap,block_id=guided.create_step(helper,self.payload,request)
            block=next(e for e in roadmap['events'] if e['id']==block_id)
            self.assertEqual(block['type'],'clicar_imagem');self.assertFalse(block['details']['clicar']);self.assertEqual(block['details']['imagem'],'')
            self.assertNotEqual(block['sequence'],'principal');self.assertEqual(self.payload['eventos'][0],original)
            request['revision']=helper.contexto_chatgpt(self.payload)['revision']
            _,same=guided.create_step(helper,self.payload,request);self.assertEqual(block_id,same);self.assertEqual(len(self.payload['eventos']),2)
            request['step']=self.step('table',id='tabela');roadmap,_=guided.create_step(helper,self.payload,request)
            self.assertEqual(len(self.payload['map_paths']),1)
            self.assertEqual(roadmap['events'][-1]['type'],'chrome_tabela');self.assertEqual(roadmap['events'][-1]['sequence'],block['sequence'])

    def test_real_cli_can_create_and_reopen_guided_block(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);(base/'mapeamento_teclado.json').write_text(json.dumps(self.payload),encoding='utf-8')
            script=Path(helper.__file__).resolve()
            def call(request):
                result=subprocess.run([sys.executable,str(script),'map-paths','--request',json.dumps(request)],cwd=base,capture_output=True,text=True,encoding='utf-8')
                self.assertEqual(result.returncode,0,result.stderr);return json.loads(result.stdout)
            ctx=call({'action':'ai_guide_context'})
            created=call({'action':'ai_guide_create','name':'Meu fluxo','revision':ctx['revision'],'guide_id':'chat-a','step':self.step('text',text='{{EMPRESA}}')})
            self.assertEqual(created['roadmap']['events'][-1]['text'],'{{EMPRESA}}')
            loaded=call({'action':'ai_guide_context'});self.assertEqual(loaded['blocks'][-1]['block_id'],created['block_id'])
            edited=call({'action':'ai_guide_update','revision':loaded['revision'],'block_id':created['block_id'],'step':self.step('text',text='{{CNPJ}}')})
            self.assertEqual(edited['roadmap']['events'][-1]['text'],'{{CNPJ}}')
            local=call({'action':'ai_guide_context','include_values':True})
            self.assertEqual(local['blocks'][-1]['editable']['text'],'{{CNPJ}}')

    def test_inline_edit_preserves_routes_and_identity_and_rejects_stale_revision(self):
        event=helper.criar_bloco_abrir_url('https://example.com',ao_sucesso='parar');event.update(id='url-block',ordem=2,sequencia='secao');self.payload['eventos'].append(event)
        before=copy.deepcopy(event)
        request={'block_id':'url-block','revision':helper.contexto_chatgpt(self.payload)['revision'],'step':self.step('navigate',url='https://example.org')}
        with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
            roadmap,identity=guided.update_step(helper,self.payload,request)
            updated=roadmap['events'][-1]
            self.assertEqual(identity,'url-block');self.assertEqual(updated['sequence'],'secao');self.assertEqual(updated['details']['ao_sucesso'],before['detalhes']['ao_sucesso']);self.assertEqual(updated['details']['url'],'https://example.org')
            with self.assertRaisesRegex(ValueError,'mapa mudou'):guided.update_step(helper,self.payload,request)

    def test_guided_commands_with_the_studio_embedded_python(self):
        root=Path(helper.__file__).resolve().parent
        runtime=root/'tauri_gerador/src-tauri/target/debug/python_runtime/python.exe'
        if not runtime.is_file(): self.skipTest('Runtime embutido não está disponível nesta instalação de testes.')
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);(base/'mapeamento_teclado.json').write_text(json.dumps(self.payload),encoding='utf-8')
            def call(request):
                result=subprocess.run([str(runtime),str(root/'gerenciar_roteiro.py'),'map-paths','--request',json.dumps(request)],cwd=base,capture_output=True,text=True,encoding='utf-8')
                self.assertEqual(result.returncode,0,result.stderr)
                return json.loads(result.stdout)
            context=call({'action':'ai_guide_context'})
            plan=call({'action':'ai_guide_validate','plan':self.plan(revision=context['revision'])})
            self.assertEqual(plan['steps'][0]['kind'],'ocr')
            created=call({'action':'ai_guide_create','name':plan['name'],'revision':plan['revision'],'guide_id':'embedded-chat','step':plan['steps'][0]})
            self.assertEqual(created['roadmap']['events'][-1]['type'],'clicar_imagem')
            self.assertFalse(created['context']['blocks'][-1]['configured'])
            # Exercise the inline-save path with the same isolated runtime too.
            text=call({'action':'ai_guide_create','name':plan['name'],'revision':created['context']['revision'],'guide_id':'embedded-chat','step':self.step('text',id='empresa',text='{{EMPRESA}}')})
            edited=call({'action':'ai_guide_update','block_id':text['block_id'],'revision':text['context']['revision'],'step':self.step('text',id='empresa',text='{{CNPJ}}')})
            self.assertEqual(edited['roadmap']['events'][-1]['text'],'{{CNPJ}}')


if __name__=='__main__':unittest.main()
