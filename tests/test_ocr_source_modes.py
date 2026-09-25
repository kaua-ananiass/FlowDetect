import unittest
from unittest.mock import Mock

import executar_automacao as motor


class OcrSourceModesTest(unittest.TestCase):
    def setUp(self):
        self.executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        self.executor.cancelamento_solicitado = Mock(return_value=False)
        self.executor.resultado_sucesso_evento = Mock(return_value={"acao": "continuar"})
        self.executor.resultado_fluxo = Mock(side_effect=lambda acao, **kwargs: {"acao": acao, **kwargs})
        self.executor.salvar_variavel_contexto = Mock()

    def test_visual_source_uses_the_reference_image(self):
        self.executor.clicar_imagem = Mock(return_value={"x": 12, "y": 20})
        event = {"ordem": 4, "detalhes": {
            "fonte_ocr": "visual", "imagem_ocr": "imagens/icone.png",
            "texto": "", "clicar": False, "ao_nao_encontrar": "parar",
        }}

        result = self.executor.executar_bloco_procurar_texto_ocr(event)

        self.assertEqual(result, {"acao": "continuar"})
        self.executor.clicar_imagem.assert_called_once()
        self.assertEqual(self.executor.clicar_imagem.call_args.kwargs["imagem"], "imagens/icone.png")
        self.assertFalse(self.executor.clicar_imagem.call_args.kwargs["clicar"])

    def test_chrome_source_uses_page_text_and_preserves_found_value(self):
        target = Mock()
        target.inner_text.return_value = "Emitir guia"
        page = Mock()
        page.get_by_text.return_value.first = target
        self.executor.obter_pagina_chrome = Mock(return_value=page)
        event = {"ordem": 7, "detalhes": {
            "fonte_ocr": "chrome", "texto": "Emitir guia", "clicar": True,
            "quantidade_tentativas": 1,
        }}

        result = self.executor.executar_bloco_procurar_texto_ocr(event)

        self.assertEqual(result, {"acao": "continuar"})
        page.get_by_text.assert_called_once_with("Emitir guia", exact=False)
        target.click.assert_called_once()
        self.executor.salvar_variavel_contexto.assert_any_call("ultimo_ocr", "Emitir guia")

    def test_chrome_source_keeps_the_route_of_each_hybrid_ocr(self):
        first_target = Mock()
        first_target.inner_text.return_value = "Emitir guia"
        page = Mock()
        page.get_by_text.return_value.first = first_target
        self.executor.obter_pagina_chrome = Mock(return_value=page)
        self.executor.clicar_imagem = Mock()
        event = {"ordem": 8, "detalhes": {
            "fonte_ocr": "chrome", "texto": "Emitir guia",
            "ocr_target_layouts": [{"texto": "Emitir guia", "action": "clicar_ir_para_bloco", "block": "16"}],
        }}

        result = self.executor.executar_bloco_procurar_texto_ocr(event)

        self.assertEqual(result, {"acao": "ir_para_bloco", "bloco": "16"})
        first_target.click.assert_called_once()
        self.executor.clicar_imagem.assert_not_called()

    def test_element_source_clicks_only_a_unique_page_match(self):
        target = Mock()
        locator = Mock(first=target)
        locator.count.return_value = 1
        page = Mock()
        page.locator.return_value = locator
        self.executor.obter_pagina_chrome = Mock(return_value=page)
        event = {"ordem": 9, "detalhes": {
            "fonte_ocr": "elemento", "texto": "tr[data-cnpj='123'] button.expandir",
            "clicar": True, "cliques": 2, "quantidade_tentativas": 1,
        }}

        result = self.executor.executar_bloco_procurar_texto_ocr(event)

        self.assertEqual(result, {"acao": "continuar"})
        page.locator.assert_called_once_with("tr[data-cnpj='123'] button.expandir")
        target.click.assert_called_once_with(click_count=2, timeout=8000)

    def test_element_source_rejects_ambiguous_page_match(self):
        locator = Mock()
        locator.count.return_value = 3
        page = Mock()
        page.locator.return_value = locator
        self.executor.obter_pagina_chrome = Mock(return_value=page)
        self.executor.resultado_falha_bloco_ocr = Mock(return_value={"acao": "parar"})
        event = {"ordem": 9, "detalhes": {
            "fonte_ocr": "elemento", "texto": "button.expandir", "quantidade_tentativas": 1,
        }}

        self.assertEqual(self.executor.executar_bloco_procurar_texto_ocr(event), {"acao": "parar"})
        locator.first.click.assert_not_called()


if __name__ == "__main__":
    unittest.main()
