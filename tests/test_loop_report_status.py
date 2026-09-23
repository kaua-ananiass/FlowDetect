import unittest

import executar_automacao as motor


class LoopReportStatusTest(unittest.TestCase):
    def setUp(self):
        self.executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        self.executor._relatorio_loop = {"marcacoes": {}, "resultados": []}

    def test_manual_stop_is_saved_as_interrupted_with_warning_tone(self):
        self.executor.registrar_resultado_relatorio_loop(
            indice=0,
            linha_referencia=2,
            empresa="Empresa exemplo",
            sucesso=False,
            erro="Execucao interrompida pelo usuario.",
            interrompida=True,
        )

        result = self.executor._relatorio_loop["resultados"][0]
        self.assertEqual(result["status"], "Interrompida")
        self.assertEqual(result["tom"], "warning")
        self.assertEqual(result["resultado"], "Execucao interrompida pelo usuario.")

    def test_selected_report_column_replaces_the_default_loop_item(self):
        self.executor.registrar_marcacao_relatorio_loop(
            indice=0,
            status="Concluida",
            coluna_relatorio="Empresa",
            item_relatorio="Empresa Modelo",
        )
        self.executor.registrar_resultado_relatorio_loop(
            indice=0,
            linha_referencia=2,
            empresa="03943209000187",
            sucesso=True,
        )

        result = self.executor._relatorio_loop["resultados"][0]
        self.assertEqual(result["empresa"], "Empresa Modelo")
        self.assertEqual(result["coluna_relatorio"], "Empresa")

    def test_result_block_values_are_preserved_in_the_pdf_row(self):
        self.executor.registrar_marcacao_relatorio_loop(
            indice=0,
            status="Sem debitos",
            tom="info",
            resultado="Nenhum debito encontrado.",
            confirmacao="Alerta validado.",
        )
        self.executor.registrar_resultado_relatorio_loop(
            indice=0,
            linha_referencia=2,
            empresa="Empresa exemplo",
            sucesso=True,
        )

        result = self.executor._relatorio_loop["resultados"][0]
        self.assertEqual(result["status"], "Sem debitos")
        self.assertEqual(result["tom"], "info")
        self.assertEqual(result["resultado"], "Nenhum debito encontrado.")
        self.assertEqual(result["confirmacao"], "Alerta validado.")


if __name__ == "__main__":
    unittest.main()
