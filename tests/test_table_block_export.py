import importlib.util
from pathlib import Path
from unittest import TestCase,main
from unittest.mock import patch
from types import SimpleNamespace
import json
import tempfile
class TableExport(TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('table_roadmap',Path(__file__).resolve().parents[1]/'gerenciar_roteiro.py')
        self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
    def test_table_exports_descriptor_selected_columns_and_flow_without_sample_rows(self):
        config={'variable':'fgts','descriptor':{'headers':['Nome','Total'],'origin':'https://example.test','pathname':'/'},'columns':['Total'],'mode':'value','match_column':'Nome','match_value':'Ana'}
        event={'tipo':'chrome_tabela','ordem':1,'detalhes':{'table':config,'ao_sucesso':'continuar'}}
        step,error=self.m.converter_evento_para_chrome(event)
        self.assertIsNone(error);self.assertEqual(step['type'],'table_read');self.assertEqual(step['table'],config)
        self.assertEqual(step['on_failure']['action'],'parar')
        self.assertEqual(self.m.card_do_evento(event)['title'],'Ler tabela')
    def test_unmapped_table_does_not_silently_export(self):
        with self.assertRaises(ValueError):self.m.converter_evento_para_chrome({'tipo':'chrome_tabela','ordem':1,'detalhes':{}})
    def test_click_exports_row_identity_and_button_without_requiring_output_columns(self):
        config={'descriptor':{'headers':['Guia','Acoes'],'origin':'https://example.test','pathname':'/'},'mode':'click','action':{'column':'Acoes','signature':{'aria':'Detalhes'}},'match_column':'Guia','match_value':'{{Guia}}'}
        step,error=self.m.converter_evento_para_chrome({'tipo':'chrome_tabela','ordem':2,'detalhes':{'table':config}})
        self.assertIsNone(error);self.assertEqual(step['table'],config)
        config.pop('match_value')
        with self.assertRaises(ValueError):self.m.converter_evento_para_chrome({'tipo':'chrome_tabela','ordem':2,'detalhes':{'table':config}})
    def test_create_and_update_keep_sequence_and_discard_preview_data(self):
        payload={'eventos':[]}
        config={'variable':'dados','descriptor':{'headers':['Nome'],'origin':'https://example.test','pathname':'/','rows':['private']},'columns':['Nome'],'rows':['private']}
        def request(**values):
            with patch.object(self.m,'carregar_e_normalizar',return_value=payload),patch.object(self.m,'salvar_e_retornar',side_effect=lambda p:p):
                return self.m.comando_caminhos_mapa(SimpleNamespace(request=json.dumps(values)))
        request(action='table_save',sequence='principal',table=config)
        event=payload['eventos'][0]
        self.assertEqual(event['sequencia'],'principal')
        self.assertNotIn('private',json.dumps(event))
        event['ordem']=1
        request(action='table_save',order=1,table={**config,'variable':'outra'})
        self.assertEqual(len(payload['eventos']),1)
        self.assertEqual(event['detalhes']['table']['variable'],'outra')
        self.assertEqual(event['sequencia'],'principal')
    def test_reserved_variable_is_rejected(self):
        with patch.object(self.m,'carregar_e_normalizar',return_value={'eventos':[]}):
            with self.assertRaises(ValueError):self.m.comando_caminhos_mapa(SimpleNamespace(request=json.dumps({'action':'table_save','table':{'variable':'__proto__'}})))
    def test_traversal_builds_same_sequence_remaps_links_exports_all_steps_and_prevents_duplicate_generation(self):
        parent={'headers':['Guia','Total','Acoes'],'origin':'https://portal.test','pathname':'/lista'}
        detail={'headers':['Nome','FGTS'],'origin':'https://portal.test','pathname':'/detalhe'}
        payload={'eventos':[{'ordem':1,'tipo':'chrome_tabela','sequencia':'principal','detalhes':{}},{'ordem':2,'tipo':'texto_livre','sequencia':'principal','texto':'fim','detalhes':{'ao_sucesso':'ir_para_bloco','bloco_sucesso':2}}]}
        request={'action':'table_traversal_create','order':1,'table':{'variable':'guias','descriptor':parent,'action':{'column':'Acoes','signature':{'aria':'Detalhar'}}},'traversal':{'key_column':'Guia','detail_descriptor':detail,'return_mode':'button','return_control':{'signature':{'aria':'Fechar'}},'collection':'detalhes','company':'{{empresa}}'}}
        def save(p):self.m.normalizar_eventos(p);return p
        with patch.object(self.m,'carregar_e_normalizar',return_value=payload),patch.object(self.m,'salvar_e_retornar',side_effect=save):
            self.m.comando_caminhos_mapa(SimpleNamespace(request=json.dumps(request)))
            self.assertEqual(len(payload['eventos']),8)
            self.assertTrue(all(e['sequencia']=='principal' for e in payload['eventos']))
            self.assertEqual(payload['eventos'][-1]['detalhes']['bloco_sucesso'],8)
            configs=[e['detalhes']['table'] for e in payload['eventos'] if e['tipo']=='chrome_tabela']
            self.assertEqual([c['mode'] for c in configs],['list','click','list','return','export'])
            self.assertEqual(configs[1]['match_value'],'{{Guia}}');self.assertTrue(configs[2]['accumulate']);self.assertTrue(configs[0]['prepare_loop'])
            self.assertTrue(configs[-1]['xlsx'])
            for e in payload['eventos'][:7]:self.assertIsNone(self.m.converter_evento_para_chrome(e)[1])
            with self.assertRaisesRegex(ValueError,'ja foi criado'):self.m.comando_caminhos_mapa(SimpleNamespace(request=json.dumps(request)))
            request['action']='table_traversal_update';request['traversal']['collection']='novo_resultado';request['traversal']['detail_descriptor']={**detail,'headers':['Nome','Total atualizado']}
            self.m.comando_caminhos_mapa(SimpleNamespace(request=json.dumps(request)))
            self.assertEqual(len(payload['eventos']),8)
            self.assertEqual(payload['eventos'][3]['detalhes']['table']['columns'],['Nome','Total atualizado'])
            self.assertEqual(payload['eventos'][6]['detalhes']['table']['variable'],'novo_resultado')
            self.assertEqual(payload['eventos'][0]['detalhes']['table']['traversal_options']['collection'],'novo_resultado')
    def test_unfinished_visual_draft_cannot_be_exported_as_a_runnable_table(self):
        with self.assertRaisesRegex(ValueError,'rascunho'):
            self.m.converter_evento_para_chrome({'tipo':'chrome_tabela','ordem':1,'detalhes':{'table':{'setup_pending':True,'mode':'list'}}})
    def test_export_explains_unresolved_row_click_before_writing_a_broken_automation(self):
        descriptor={'headers':['Guia','Acoes'],'origin':'https://portal.test','pathname':'/'}
        click={'ordem':3,'tipo':'chrome_tabela','sequencia':'principal','detalhes':{'table':{'descriptor':descriptor,'mode':'click','match_column':'Guia','match_value':'{{Guia}}','action':{'signature':{'aria':'Abrir'}}}}}
        payload={'eventos':[click]}
        with tempfile.TemporaryDirectory() as folder,patch.object(self.m,'carregar_payload_da_automacao',return_value=payload),patch.object(self.m,'diretorio_automacao',return_value=Path('.')):
            dest=Path(folder)/'export.json'
            with self.assertRaisesRegex(ValueError,'Criar percurso no mapa'):
                self.m.exportar_automacao_para_chrome('test',{'nome':'Teste'},dest)
            self.assertFalse(dest.exists())
            payload['eventos']=[{'ordem':1,'tipo':'chrome_tabela','sequencia':'principal','detalhes':{'table':{'descriptor':descriptor,'mode':'list','columns':['Guia'],'variable':'guias','prepare_loop':True}}},{'ordem':2,'tipo':'inicio_loop','detalhes':{}},click,{'ordem':4,'tipo':'fim_loop','detalhes':{}}]
            self.m.exportar_automacao_para_chrome('test',{'nome':'Teste'},dest)
            self.assertEqual(len(json.loads(dest.read_text(encoding='utf-8'))['steps']),4)
if __name__=='__main__':main()
