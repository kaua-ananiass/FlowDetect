"""Exercise Procurar through the real search pipeline with screen I/O replaced."""

import contextlib
import io
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import executar_automacao as motor


class OcrDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor = self.executor
        self.texts = ["Cartao", "Combustivel", "Inventario", "Simples", "ISS"]
        self.missing = set()
        self.visual_missing = set()
        self.visited = []
        self.markers = []
        self.leitura = {
            "largura": 80, "altura": 20, "offset_x": 0, "offset_y": -40,
            "ocr_target_layouts": [
                {"texto": text, "width": 80, "height": 20, "offsetX": 0, "offsetY": -40 + index * 20,
                 "action": "continuar", "failureAction": "continuar"}
                for index, text in enumerate(self.texts)
            ],
        }
        self.reference = {"left": 300, "top": 200, "width": 300, "height": 120, "score": .99}
        window = {"title": "Fiscal", "left": 0, "top": 0, "width": 1920, "height": 1080}
        executor.janela_alvo = "Fiscal"
        executor._janela_contexto = ""
        executor._cache_ocr_screenshot = {}
        executor._needle_maior_logada = False
        executor.modo_teste_reconhecimento = True
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.alvo_execucao_ativo = Mock(return_value=False)
        executor.resolver_janela_evento = Mock(return_value="Fiscal")
        executor.localizar_janela_alvo = Mock(return_value=window)
        executor.obter_janela_ativa = Mock(return_value=window)
        executor.janela_parece_interface_flowdetect = Mock(return_value=False)
        executor.obter_regiao_busca = Mock(return_value=(0, 0, 1920, 1080))
        executor.construir_regiao_personalizada = Mock(return_value=(0, 0, 1920, 1080))
        executor.obter_regiao_historica_reconhecimento = Mock(return_value=None)
        executor.limitar_regiao = Mock(side_effect=lambda region, **kwargs: region)
        executor.resolver_imagem = Mock(return_value=(Path(__file__), "menu"))
        executor.obter_dimensoes_imagem = Mock(return_value=(300, 120))
        executor.registrar_reconhecimento_bem_sucedido = Mock()
        executor.confirmar_ocr_relativo = Mock(side_effect=AssertionError("Repeated joint OCR validation"))
        executor.ativar_janela_alvo = Mock(side_effect=AssertionError("Must not change windows"))
        executor.clicar_area_reconhecida = Mock(side_effect=AssertionError("A test must not click"))
        executor.marcar_regiao_absoluta = Mock(side_effect=lambda *args, **kw: self.markers.append(kw["etiqueta"]))
        executor.marcar_area_reconhecida = Mock(side_effect=lambda *args, **kw: self.markers.append(kw["etiqueta"]))
        self.crop_readings = []
        executor.capturar_tela_pil = Mock(return_value=(motor.Image.new("RGB", (80, 24)), 0, 0))
        executor.extrair_texto_ocr_imagem_pil = Mock(return_value="")
        executor.extrair_textos_ocr_rapido = Mock(side_effect=lambda *args, **kw: self.crop_readings)

        def read(text, **kwargs):
            index = self.texts.index(text)
            self.visited.append(index)
            if index in self.missing:
                return []
            return [{"left": 410, "top": 210 + index * 20, "width": 80, "height": 20,
                     "texto": text, "score": .99}]

        executor.localizar_texto_por_ocr_screenshot = Mock(side_effect=read)
        executor.procurar_imagem_por_template = Mock(side_effect=lambda *a, **kw:
            None if self.visited[-1] in self.visual_missing else dict(self.reference))

    def run_search(self):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream), patch.object(motor, "OCR_DISPONIVEL", True), \
                patch.object(motor, "OPENCV_DISPONIVEL", True), patch.object(motor.time, "sleep"):
            success = self.executor.testar_reconhecimento(
                "menu", timeout=10, texto_ocr_esperado="\n".join(self.texts), leitura_relativa=self.leitura,
            )
        reports = [json.loads(line.split("|", 1)[1]) for line in stream.getvalue().splitlines()
                   if line.startswith("OCR_VALIDATION_JSON|")]
        self.assertEqual(len(reports), 1, stream.getvalue())
        self.executor.confirmar_ocr_relativo.assert_not_called()
        self.executor.clicar_area_reconhecida.assert_not_called()
        self.executor.ativar_janela_alvo.assert_not_called()
        self.assertEqual(self.visited, [0, 1, 2, 3, 4])
        return success, reports[0]

    def test_failed_third_target_is_reported_without_repeating_first_two(self):
        self.missing = {2}
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertTrue(report["visual_confirmed"])
        self.assertEqual([item["status"] for item in report["targets"]],
                         ["confirmed", "confirmed", "not_found", "confirmed", "confirmed"])
        self.assertEqual(self.markers, ["OCR 1", "OCR 2", "Falha OCR 3", "OCR 4", "OCR 5", "Reconhecimento"])
        failed_marker = self.executor.marcar_regiao_absoluta.call_args_list[2]
        self.assertEqual(failed_marker.kwargs["tema"], "ocr_alvo_falha")

    def test_fifth_target_is_confirmed_in_its_crop_when_wide_scan_misses_it(self):
        self.missing = {4}
        self.executor.extrair_texto_ocr_imagem_pil.return_value = self.texts[4]
        success, report = self.run_search()
        self.assertTrue(success)
        self.assertEqual(report["targets"][4]["status"], "confirmed")
        self.assertEqual(self.markers, ["OCR 1", "OCR 2", "OCR 3", "OCR 4", "OCR 5", "Reconhecimento"])
        self.executor.capturar_tela_pil.assert_called_once_with(region=(410, 290, 80, 20))
        self.executor.extrair_textos_ocr_rapido.assert_not_called()

    def test_crop_variants_are_compared_individually_without_merging_text(self):
        self.missing = {4}
        self.crop_readings = ["wrong label", self.texts[4], "another unrelated label"]
        success, report = self.run_search()
        self.assertTrue(success)
        self.assertEqual(report["targets"][4]["status"], "confirmed")

    def test_matching_image_does_not_approve_wrong_crop_text(self):
        self.missing = {4}
        self.crop_readings = ["a different text", "another label"]
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertEqual(report["targets"][4]["status"], "not_found")
        self.assertTrue(report["visual_confirmed"])

    def test_crop_capture_failure_remains_an_ocr_failure(self):
        self.missing = {4}
        self.executor.capturar_tela_pil.side_effect = RuntimeError("Capture unavailable")
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertEqual(report["targets"][4]["status"], "not_found")

    def test_all_pass_finish_with_one_visual_marker(self):
        success, report = self.run_search()
        self.assertTrue(success)
        self.assertTrue(report["success"])
        self.assertEqual(self.markers, ["OCR 1", "OCR 2", "OCR 3", "OCR 4", "OCR 5", "Reconhecimento"])

    def test_all_fail_do_not_reenter_search_or_invent_visual_confirmation(self):
        self.missing = set(range(5))
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertFalse(report["visual_confirmed"])
        self.assertEqual([item["status"] for item in report["targets"]], ["not_found"] * 5)
        self.assertEqual(self.markers, [])

    def test_diagnostic_evaluates_every_target_despite_jump_and_stop_rules(self):
        self.leitura["ocr_target_layouts"][0].update(action="clicar_ir_para_bloco", block="20")
        self.leitura["ocr_target_layouts"][2]["failureAction"] = "parar"
        self.missing = {2}
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertEqual(len(report["targets"]), 5)

    def test_visual_failure_is_distinguished_from_missing_text(self):
        self.visual_missing = {2}
        success, report = self.run_search()
        self.assertFalse(success)
        self.assertEqual(report["targets"][2]["status"], "visual_failed")


if __name__ == "__main__":
    unittest.main()
