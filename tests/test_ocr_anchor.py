import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import executar_automacao as motor


class OcrAnchorTests(unittest.TestCase):
    def setUp(self):
        self.executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        self.executor.cancelamento_solicitado = Mock(return_value=False)
        self.executor.limitar_regiao = Mock(side_effect=lambda region, **kwargs: region)
        self.executor.marcar_alvos_ocr_em_sequencia = Mock()
        self.executor.procurar_imagem_por_template = Mock(return_value=None)
        self.executor.localizar_texto_por_ocr_screenshot = Mock(return_value=[])
        self.executor.localizar_texto_composto_por_ocr_screenshot = Mock(return_value=[])
        self.config = {
            "largura": 160, "altura": 30, "offset_x": -20, "offset_y": -15,
            "ocr_target_layouts": [{}, {"width": 40, "height": 20, "offsetX": 55, "offsetY": 15}],
        }
        self.anchor = {"left": 2000, "top": -5, "width": 120, "height": 20, "texto": "Meu Perfil"}
        self.value = {"left": 2120, "top": 25, "width": 30, "height": 15, "texto": "135"}

    def search(self, candidate, text="Meu Perfil => 135", config=None):
        self.executor.localizar_texto_composto_por_ocr_screenshot.return_value = [candidate]
        self.executor.localizar_texto_por_ocr_screenshot.return_value = [candidate]
        with patch.object(motor, "OCR_DISPONIVEL", True):
            return self.executor.localizar_referencia_hibrida_ocr_visual(
                "reference.png", text, region=(1920, -100, 1920, 1080),
                dimensoes_referencia=(240, 100),
                leitura_relativa=self.config if config is None else config,
            )

    def candidate(self, bounds=None):
        return {**self.anchor, "text": "Meu Perfil | 135", "score": 0.98,
                "ocr_related_bounds": [self.anchor, self.value] if bounds is None else bounds}

    def test_all_targets_allow_visual_failure_and_preserve_layout_dimensions(self):
        local = self.search(self.candidate())
        self.assertTrue(local["ocr_anchor_confirmed"])
        self.assertFalse(local["visual_confirmed"])
        self.assertEqual((local["left"], local["top"], local["width"], local["height"]),
                         (1960, -30, 240, 100))
        self.assertEqual(len(local["ocr_related_bounds"]), 2)
        self.executor.marcar_alvos_ocr_em_sequencia.assert_called_once()
        self.assertTrue(self.executor.ocr_hibrido_tem_todos_alvos(local, "Meu Perfil => 135", self.config))

    def test_missing_second_target_blocks(self):
        self.assertIsNone(self.search(self.candidate([self.anchor])))
        self.executor.marcar_alvos_ocr_em_sequencia.assert_not_called()

    def test_wrong_second_target_blocks_even_with_matching_image(self):
        self.executor.procurar_imagem_por_template.return_value = dict(self.anchor)
        self.assertIsNone(self.search(self.candidate([self.anchor, {**self.value, "texto": "136"}])))
        self.executor.procurar_imagem_por_template.assert_not_called()

    def test_similar_phrase_is_not_a_confirmed_anchor(self):
        candidate = {**self.anchor, "texto": "um Perfil", "score": 0.99}
        self.assertIsNone(self.search(candidate, "Meu Perfil", {}))

    def test_single_target_also_allows_visual_failure(self):
        local = self.search(self.anchor, "Meu Perfil", {})
        self.assertTrue(local["ocr_anchor_confirmed"])
        self.assertFalse(local["visual_confirmed"])


if __name__ == "__main__":
    unittest.main()
