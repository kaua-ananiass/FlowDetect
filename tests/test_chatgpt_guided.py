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
    def test_optional_tutorial_copy_does_not_block_complete_action_values(self):
        for value in [None, '', '   ']:
            with self.subTest(value=value):
                steps=[self.step('text',id='start',text='começo',instruction=value,description=None,placement={'anchor_order':1,'position':'after'}),
                       self.step('ocr',id='empty',instruction=value,placement={'anchor_step':'start','position':'after'}),
                       self.step('keys',id='press-p',keys=['p'],instruction=value,placement={'anchor_step':'empty','position':'after'})]
                steps[1].pop('instruction')
                before=copy.deepcopy(self.payload)
                plan=guided.validate(helper,self.payload,self.plan(steps=steps),require_placement=True)
                self.assertEqual(plan['questions'],[])
                self.assertTrue(all(step['instruction'] for step in plan['steps']))
                self.assertEqual(plan['steps'][0]['text'],'começo')
                self.assertEqual(plan['steps'][0]['description'],'')
                self.assertEqual(plan['steps'][2]['keys'],['p'])
                self.assertEqual(self.payload,before)
        for value in [42, {}, [], 'x'*1801]:
            with self.subTest(invalid=value),self.assertRaises(ValueError):
                guided.validate(helper,self.payload,self.plan(steps=[self.step(instruction=value)]))

    def test_complete_three_block_request_keeps_values_and_resolves_prior_steps(self):
        steps=[self.step('text',id='start',text='começo',placement={'anchor_order':1,'position':'after'}),
               self.step('ocr',id='empty',placement={'anchor_step':'start','position':'after'}),
               self.step('keys',id='press-p',keys=['p'],placement={'anchor_step':'empty','position':'after'})]
        plan=guided.validate(helper,self.payload,self.plan(steps=steps),require_placement=True)
        self.assertEqual(plan['questions'],[])
        identities={}
        with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
            for step in plan['steps']:
                step=copy.deepcopy(step)
                if step['placement'].get('anchor_step'):
                    anchor=next(e for e in self.payload['eventos'] if e['id']==identities[step['placement']['anchor_step']])
                    step['placement']={'anchor_order':anchor['ordem'],'anchor_id':anchor['id'],'position':'after'}
                _,identity=guided.create_step(helper,self.payload,{'name':'Three blocks','revision':helper.contexto_chatgpt(self.payload)['revision'],'guide_id':'batch','require_placement':True,'step':step})
                identities[step['id']]=identity
        added=[e for e in self.payload['eventos'] if e['id'] in identities.values()]
        self.assertEqual([e['tipo'] for e in added],['texto_livre','clicar_imagem','tecla'])
        self.assertEqual(added[0]['texto'],'começo')
        self.assertEqual(added[1]['detalhes']['imagem'],'')
        self.assertEqual(added[2]['teclas'],['p'])
        self.assertEqual(len({e['sequencia'] for e in added}),1)
        for bad in ['missing','press-p']:
            steps[1]['placement']['anchor_step']=bad
            with self.assertRaises(ValueError):guided.validate(helper,self.payload,self.plan(steps=steps))

    def test_guided_creation_after_block_nine_stays_in_its_section(self):
        self.payload['eventos'] = [
            {'id':f'block-{n}','ordem':n,'sequencia':('target-section' if n in (8,9) else 'lower-section' if n==10 else 'principal'),
             'tipo':'tecla','teclas':['tab'],'detalhes':{}}
            for n in range(1,11)
        ]
        self.payload['map_paths']=[{'id':'target','name':'Target','parent':'principal','entry_sequence':'target-section','sequences':['target-section']},
                                   {'id':'lower','name':'Lower','parent':'principal','entry_sequence':'lower-section','sequences':['lower-section']}]
        paths=copy.deepcopy(self.payload['map_paths'])
        request={'name':'Tecla P','revision':helper.contexto_chatgpt(self.payload)['revision'],'guide_id':'same-section','require_placement':True,
                 'step':self.step('keys',keys=['p'],placement={'anchor_order':9,'anchor_id':'block-9','position':'after'})}
        with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
            roadmap,identity=guided.create_step(helper,self.payload,request)
        created=next(e for e in roadmap['events'] if e['id']==identity)
        self.assertEqual((created['order'],created['sequence']),(10,'target-section'))
        self.assertEqual(next(e for e in roadmap['events'] if e['id']=='block-10')['sequence'],'lower-section')
        self.assertEqual(self.payload['map_paths'],paths)

    def test_inline_guided_creation_cannot_silently_make_a_new_section(self):
        before=copy.deepcopy(self.payload)
        request={'name':'Tecla P','revision':helper.contexto_chatgpt(self.payload)['revision'],'guide_id':'same-section','require_placement':True,
                 'step':self.step('keys',keys=['p'])}
        with self.assertRaisesRegex(ValueError,'Nenhuma seção'):
            guided.create_step(helper,self.payload,request)
        self.assertEqual(self.payload,before)

    def test_assistant_asks_for_position_before_creating_and_inserts_at_confirmed_anchor(self):
        plan=guided.validate(helper,self.payload,self.plan(),require_placement=True)
        self.assertTrue(plan['questions'])
        self.assertIn('Ainda não criei',plan['message'])
        placement={'anchor_order':1,'position':'after'}
        step=self.step(placement=placement)
        request={'name':'Nova etapa','revision':helper.contexto_chatgpt(self.payload)['revision'],'guide_id':'chat-placement','step':step}
        with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
            roadmap,block_id=guided.create_step(helper,self.payload,request)
            block=next(e for e in roadmap['events'] if e['id']==block_id)
            self.assertEqual(block['order'],2)
            self.assertEqual(block['sequence'],'principal')
            self.assertFalse(self.payload.get('map_paths'))
        with self.assertRaises(ValueError):guided.validate(helper,self.payload,self.plan(steps=[self.step(placement={'anchor_order':999,'position':'after'})]))

    def test_assistant_configuration_is_typed_and_preserves_routes(self):
        event={"tipo":"clicar_imagem","detalhes":{"imagem":"reference.png","ao_sucesso":"ir_para_bloco","bloco_sucesso":7,"ocr_target_layouts":[{"texto":"Old","region":{"x":.2}}]}}
        result=guided.configuration(copy.deepcopy(event),{"mode":"ocr","source":"chrome","text":"Consultar","clicks":0,"timeout":12})
        self.assertEqual(result['detalhes']['texto_ocr_busca'],'Consultar')
        self.assertEqual(result['detalhes']['ocr_target_layouts'][0]['texto'],'Consultar')
        self.assertEqual(result['detalhes']['bloco_sucesso'],7)
        self.assertEqual(result['detalhes']['imagem'],'reference.png')
        self.assertFalse(result['detalhes']['clicar'])
        for patch in [{'selector':'body'},{'clicks':True},{'timeout':0},{'confidence':9}]:
            with self.subTest(patch=patch),self.assertRaises(ValueError):guided.configuration(copy.deepcopy(event),patch)
        with self.assertRaises(ValueError):guided.configuration({'tipo':'chrome_tabela','detalhes':{'table':{'descriptor':{'headers':['Nome']}}}},{'columns':['Inventada']})

    def test_assistant_transaction_can_undo_but_rejects_later_map_changes(self):
        import os
        with tempfile.TemporaryDirectory() as directory:
            previous=os.getcwd()
            try:
                os.chdir(directory)
                event=helper.criar_bloco_clicar_imagem('',0,clicar=False,clicks=0,varredura_scroll=False)
                event.update(id='ocr-edit',ordem=2,sequencia='principal');self.payload['eventos'].append(event)
                before=copy.deepcopy(self.payload)
                request={'action':'ai_assist_apply','revision':helper.contexto_chatgpt(self.payload)['revision'],'step':self.step('reuse',source_order=2,configuration={'timeout':14,'clicks':1})}
                with patch.object(helper,'salvar_e_retornar',side_effect=helper.payload_para_resposta),patch.object(helper,'carregar_planilha_meta',return_value={}):
                    result=guided.assist(helper,self.payload,request)
                    self.assertEqual(self.payload['eventos'][-1]['detalhes']['timeout'],14)
                    undo={'action':'ai_assist_undo','revision':result['context']['revision'],'undo_token':result['undo_token']}
                    self.payload['eventos'][-1]['detalhes']['timeout']=15
                    with self.assertRaises(ValueError):guided.assist(helper,self.payload,undo)
                    self.payload['eventos'][-1]['detalhes']['timeout']=14
                    guided.assist(helper,self.payload,undo)
                    self.assertEqual(self.payload,before)
            finally:os.chdir(previous)

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
            created=call({'action':'ai_guide_create','name':'Meu fluxo','revision':ctx['revision'],'guide_id':'chat-a','step':self.step('text',text='{{EMPRESA}}',instruction=None)})
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

    def test_guided_typed_edit_resolves_the_real_block_and_rejects_wrong_type(self):
        event=helper.criar_bloco_abrir_url('https://example.com',ao_sucesso='parar')
        event.update(id='url-block',ordem=2,sequencia='secao')
        self.payload['eventos'].append(event)
        plan=self.plan(steps=[self.step('navigate',source_order=2,url='https://example.org')])
        validated=guided.validate(helper,self.payload,plan)
        self.assertEqual(validated['steps'][0]['block_id'],'url-block')
        self.assertEqual(validated['steps'][0]['url'],'https://example.org')
        self.assertEqual(event['detalhes']['url'],'https://example.com')
        for step in [self.step('text',source_order=2,text='Wrong type'),self.step('navigate',source_order=99,url='https://example.org')]:
            with self.subTest(step=step),self.assertRaises(ValueError):
                guided.validate(helper,self.payload,self.plan(steps=[step]))

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
