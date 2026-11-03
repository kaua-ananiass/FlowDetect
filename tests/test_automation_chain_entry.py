import unittest
from types import SimpleNamespace
from unittest.mock import patch
import executar_automacao as executor_module
import gerenciar_roteiro as helper


class ChainEntryTest(unittest.TestCase):
    def test_desktop_enters_at_selected_block_without_replaying_previous_steps(self):
        executor=executor_module.ExecutorAutomacao.__new__(executor_module.ExecutorAutomacao)
        executor.sequencias={'principal':[{'ordem':1},{'ordem':4}], 'segunda':[{'ordem':8}]}
        executor.sequencia_inicial='principal'
        with patch.object(executor,'executar_fluxo',return_value=True) as run:
            self.assertTrue(executor.executar_normal(start_order=8))
            run.assert_called_once_with(sequencia_inicial='segunda',indice_inicial=0)
            run.reset_mock()
            with self.assertRaises(ValueError): executor.executar_normal(start_order=999)
            run.assert_not_called()

    def test_preview_does_not_open_or_copy_resources_into_active_automation(self):
        payload={'eventos':[]}
        with patch.object(helper,'carregar_biblioteca',return_value={}),patch.object(helper,'localizar_item_biblioteca',return_value=(0,{'id':'flow-1'})),patch.object(helper,'carregar_payload_da_automacao',return_value=payload),patch.object(helper,'payload_para_resposta',return_value={'events':[]}),patch.object(helper,'carregar_automacao_na_raiz') as open_automation:
            result=helper.comando_prever_automacao(SimpleNamespace(id='flow-1'))
            self.assertEqual(result['active_automation']['id'],'flow-1')
            open_automation.assert_not_called()
