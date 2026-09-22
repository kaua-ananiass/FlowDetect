import unittest
from pathlib import Path
from types import SimpleNamespace
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

    def test_all_targets_stay_pending_until_the_image_confirms(self):
        local = self.search(self.candidate())
        self.assertTrue(local["ocr_anchor_confirmed"])
        self.assertFalse(local["visual_confirmed"])
        self.assertEqual(local["left"], 1960)
        self.assertEqual(local["width"], 240)
        self.assertAlmostEqual(local["ocr_layout_scale_x"], 1.0, places=2)
        self.assertAlmostEqual(local["ocr_layout_scale_y"], 0.92, places=2)
        self.assertEqual(len(local["ocr_related_bounds"]), 2)
        self.executor.marcar_alvos_ocr_em_sequencia.assert_called_once()
        self.assertTrue(self.executor.ocr_hibrido_tem_todos_alvos(local, "Meu Perfil => 135", self.config))

    def test_wrong_second_target_blocks_even_with_matching_image(self):
        self.executor.procurar_imagem_por_template.return_value = dict(self.anchor)
        self.assertIsNone(self.search(self.candidate([self.anchor, {**self.value, "texto": "136"}])))
        self.executor.procurar_imagem_por_template.assert_not_called()

    def test_missing_second_target_blocks(self):
        self.assertIsNone(self.search(self.candidate([self.anchor])))
        self.executor.marcar_alvos_ocr_em_sequencia.assert_not_called()

    def test_all_target_guard_checks_each_text(self):
        local = self.candidate([self.anchor, {**self.value, "texto": "136"}])
        self.assertFalse(self.executor.ocr_hibrido_tem_todos_alvos(local, "Meu Perfil => 135", self.config))

    def test_multi_target_confirmation_does_not_use_single_ocr_area(self):
        self.executor.confirmar_alvos_ocr_por_layout_visual = Mock(return_value=None)
        self.executor.capturar_tela_pil = Mock(side_effect=AssertionError("Nao deve ler uma unica area OCR"))
        with patch.object(motor, "OCR_DISPONIVEL", True):
            self.assertFalse(
                self.executor.confirmar_ocr_relativo(
                    self.anchor,
                    texto_esperado="Meu Perfil => 135",
                    leitura_relativa=self.config,
                    dimensoes_referencia=(240, 100),
                    caminho_referencia="reference.png",
                )
            )
        self.executor.confirmar_alvos_ocr_por_layout_visual.assert_called_once()

    def test_multi_target_confirmation_saves_joined_text_when_all_targets_match(self):
        self.executor.confirmar_alvos_ocr_por_layout_visual = Mock(return_value={"ocr_text": "Meu Perfil | 135"})
        self.executor.salvar_variavel_contexto = Mock()
        with patch.object(motor, "OCR_DISPONIVEL", True):
            self.assertTrue(
                self.executor.confirmar_ocr_relativo(
                    self.anchor,
                    texto_esperado="Meu Perfil => 135",
                    leitura_relativa=self.config,
                    ordem_bloco=9,
                    dimensoes_referencia=(240, 100),
                    caminho_referencia="reference.png",
                )
            )
        self.executor.confirmar_alvos_ocr_por_layout_visual.assert_called_once()
        self.executor.salvar_variavel_contexto.assert_any_call("ultimo_ocr", "Meu Perfil | 135")
        self.executor.salvar_variavel_contexto.assert_any_call("ocr_bloco_9", "Meu Perfil | 135")

    def test_similar_phrase_is_not_a_confirmed_anchor(self):
        candidate = {**self.anchor, "texto": "um Perfil", "score": 0.99}
        self.assertIsNone(self.search(candidate, "Meu Perfil", {}))

    def test_single_target_stays_pending_until_visual_confirmation(self):
        local = self.search(self.anchor, "Meu Perfil", {})
        self.assertTrue(local["ocr_anchor_confirmed"])
        self.assertFalse(local["visual_confirmed"])

    def test_saved_visual_crop_alone_cannot_confirm_missing_ocr(self):
        config = {
            "_testar_todos_alvos_ocr": True,
            "largura": 92,
            "altura": 26,
            "offset_x": -34,
            "offset_y": -11,
            "ocr_target_layouts": [{"texto": "Empresa", "action": "continuar"}],
        }
        self.executor.localizar_referencia_por_recorte_ocr_visual = Mock(return_value={
            "left": 440,
            "top": 265,
            "width": 180,
            "height": 70,
            "x": 530,
            "y": 300,
            "score": 0.91,
            "ocr_visual_anchor": True,
            "ocr_bounds": {"left": 462, "top": 276, "width": 68, "height": 18},
        })

        with patch.object(motor, "OCR_DISPONIVEL", True):
            local = self.executor.localizar_referencia_hibrida_ocr_visual(
                "reference.png",
                "Empresa",
                region=(0, 0, 1600, 900),
                dimensoes_referencia=(180, 70),
                leitura_relativa=config,
            )

        self.assertFalse(local["ocr_validation"]["success"])
        self.assertFalse(local["ocr_validation"]["visual_confirmed"])
        self.assertEqual(local["ocr_validation"]["targets"][0]["status"], "not_found")
        self.executor.localizar_referencia_por_recorte_ocr_visual.assert_not_called()

    def test_single_target_uses_exact_image_when_button_text_is_not_legible(self):
        config = {
            "largura": 180,
            "altura": 70,
            "offset_x": 0,
            "offset_y": 0,
            "ocr_target_layouts": [{
                "texto": "Emitir guia",
                "action": "continuar",
                "failureAction": "continuar",
            }],
        }
        visual = {"left": 677, "top": 898, "width": 200, "height": 108, "x": 777, "y": 952, "score": 1.0}
        self.executor.localizar_texto_por_ocr_screenshot.return_value = []
        self.executor.procurar_imagem_por_template.return_value = visual
        self.executor.validar_correspondencia_visual = Mock(return_value=True)
        self.executor.confirmar_localizacao_imagem = Mock(return_value=visual)

        with patch.object(motor, "OCR_DISPONIVEL", True):
            local = self.executor.localizar_referencia_hibrida_ocr_visual(
                "reference.png",
                "Emitir guia",
                region=(0, 0, 1920, 1040),
                dimensoes_referencia=(200, 108),
                leitura_relativa=config,
            )

        self.assertTrue(local["visual_confirmed"])
        self.assertTrue(local["ocr_visual_fallback"])
        self.assertFalse(local["ocr_anchor_confirmed"])
        self.assertEqual(local["left"], 677)
        self.executor.procurar_imagem_por_template.assert_called_once()

    def test_visual_can_refine_position_after_ocr(self):
        events = []
        candidate = self.candidate()
        self.executor.localizar_texto_composto_por_ocr_screenshot.side_effect = lambda *a, **k: events.append("ocr") or [candidate]
        visual = {"left": 1980, "top": -10, "width": 240, "height": 100, "x": 2100, "y": 40}
        self.executor.procurar_imagem_por_template.side_effect = lambda *a, **k: events.append("visual") or visual
        local = self.search(candidate)
        self.assertEqual(events, ["ocr", "visual"])
        self.assertTrue(local["visual_confirmed"])
        self.assertEqual(local["left"], 1980)

    def test_template_checks_exact_ocr_region_before_expanded_fallback(self):
        candidate = self.candidate()
        visual = {"left": 1980, "top": -10, "width": 240, "height": 100, "x": 2100, "y": 40}
        self.executor.procurar_imagem_por_template.side_effect = [None, visual]

        local = self.search(candidate)

        chamadas = self.executor.procurar_imagem_por_template.call_args_list
        estimativa_ocr = self.executor.estimar_referencia_por_alvos_ocr(
            [self.anchor, self.value],
            leitura_relativa=self.config,
            dimensoes_referencia=(240, 100),
        )
        self.assertEqual(len(chamadas), 2)
        self.assertEqual(
            chamadas[0].kwargs["region"],
            self.executor.bounds_reconhecimento(estimativa_ocr),
        )
        self.assertNotEqual(chamadas[1].kwargs["region"], chamadas[0].kwargs["region"])
        self.assertTrue(local["visual_confirmed"])
        self.assertEqual(local["left"], 1980)

    def test_unrelated_image_cannot_move_anchor(self):
        self.executor.procurar_imagem_por_template.return_value = {
            "left": 2300, "top": 30, "width": 100, "height": 40,
        }
        local = self.search(self.candidate())
        self.assertFalse(local["visual_confirmed"])
        self.assertEqual(local["left"], 1960)

    def test_cancel_after_ocr_does_not_release_block(self):
        self.executor.cancelamento_solicitado.return_value = True
        self.assertIsNone(self.search(self.candidate()))
        self.executor.procurar_imagem_por_template.assert_not_called()

    def test_click_reuses_all_confirmed_targets_without_repeating_ocr(self):
        self.executor.procurar_imagem_por_template.return_value = {
            "left": 1980, "top": -10, "width": 240, "height": 100, "x": 2100, "y": 40,
        }
        local = self.search(self.candidate())
        self.assertTrue(local["visual_confirmed"])
        self.executor.resolver_imagem = Mock(return_value=(Path(__file__), "ref"))
        self.executor.obter_dimensoes_imagem = Mock(return_value=(240, 100))
        self.executor.esperar_imagem = Mock(return_value=local)
        self.executor.salvar_variavel_contexto = Mock()
        self.executor.confirmar_ocr_relativo = Mock(side_effect=AssertionError("OCR repetido"))
        self.executor.marcar_regiao_ocr = Mock(side_effect=AssertionError("Marcador repetido"))
        events = []
        self.executor.marcar_area_reconhecida = Mock(side_effect=lambda *a, **k: events.append("visual"))
        self.executor.clicar_area_reconhecida = Mock(side_effect=lambda *a, **k: events.append("clique") or {"x": 2087, "y": 29})
        with patch.object(motor.time, "sleep"):
            result = self.executor.clicar_imagem(
                "reference.png", texto_ocr_esperado="Meu Perfil => 135",
                leitura_relativa=self.config, offset_x=7, offset_y=9,
            )
        self.assertIsNotNone(result)
        self.assertEqual(events, ["visual", "clique"])
        self.executor.confirmar_ocr_relativo.assert_not_called()
        self.assertEqual(self.executor.clicar_area_reconhecida.call_args.kwargs["offset_x"], 7)

    def test_click_is_blocked_when_only_the_ocr_step_is_confirmed(self):
        pendente = self.search(self.candidate())
        self.executor.resolver_imagem = Mock(return_value=(Path(__file__), "ref"))
        self.executor.obter_dimensoes_imagem = Mock(return_value=(240, 100))
        self.executor.esperar_imagem = Mock(return_value=pendente)
        self.executor.marcar_area_reconhecida = Mock()
        resultado = self.executor.clicar_imagem(
            "reference.png",
            confianca=0.8,
            texto_ocr_esperado="Meu Perfil => 135",
            leitura_relativa=self.config,
        )
        self.assertIsNone(resultado)
        self.executor.marcar_area_reconhecida.assert_not_called()

    def test_reusing_confirmed_ocr_only_retries_the_image_step(self):
        pendente = self.search(self.candidate())
        chamadas_ocr = self.executor.localizar_texto_composto_por_ocr_screenshot.call_count
        self.executor.procurar_imagem_por_template.return_value = {
            "left": 1980, "top": -10, "width": 240, "height": 100, "x": 2100, "y": 40,
        }
        local = self.executor.localizar_referencia_hibrida_ocr_visual(
            "reference.png",
            "Meu Perfil => 135",
            region=(1920, -100, 1920, 1080),
            dimensoes_referencia=(240, 100),
            leitura_relativa=self.config,
            ocr_confirmado=pendente,
        )
        self.assertTrue(local["visual_confirmed"])
        self.assertEqual(self.executor.localizar_texto_composto_por_ocr_screenshot.call_count, chamadas_ocr)
        self.executor.marcar_alvos_ocr_em_sequencia.assert_called_once()

    def test_four_ocr_targets_keep_the_same_layout_instead_of_using_first_matches(self):
        partes = ["Tipo da nota", "ISS Saida", "ISS Tomador", "Faturamento e Deducoes"]
        layouts = [
            {"offset_x": -37, "offset_y": -35, "width": 80, "height": 23},
            {"offset_x": -27, "offset_y": -10, "width": 54, "height": 24},
            {"offset_x": -11, "offset_y": 9, "width": 88, "height": 23},
            {"offset_x": 13, "offset_y": 31, "width": 140, "height": 26},
        ]
        centros_reais = [(163, 165), (173, 190), (189, 209), (213, 231)]
        centros_distratores = [(780, 95), (330, 670), (940, 410), (510, 790)]

        def alvo(centro, texto):
            return {
                "left": centro[0] - 10,
                "top": centro[1] - 8,
                "width": 20,
                "height": 16,
                "texto": texto,
                "text": texto,
                "score": 0.96,
            }

        encontrados = {
            texto: [alvo(centros_distratores[indice], texto), alvo(centros_reais[indice], texto)]
            for indice, texto in enumerate(partes)
        }
        self.executor.localizar_texto_por_ocr_screenshot = Mock(
            side_effect=lambda texto, **_kwargs: encontrados[texto]
        )
        candidatos = motor.ExecutorAutomacao.localizar_texto_composto_por_ocr_screenshot(
            self.executor,
            "\n".join(partes),
            {"partes": partes, "relacional": False},
            region=(0, 0, 1200, 900),
            retornar_candidatos=True,
            layout_alvos=layouts,
        )
        self.assertEqual(len(candidatos), 1)
        bounds = candidatos[0]["ocr_related_bounds"]
        self.assertEqual([(item["left"], item["top"]) for item in bounds], [
            (153, 157), (163, 182), (179, 201), (203, 223),
        ])

    def test_four_ocr_targets_estimate_the_monitor_scale(self):
        leitura = {
            "largura": 80,
            "altura": 23,
            "offset_x": -37,
            "offset_y": -35,
            "ocr_target_layouts": [
                {},
                {"offsetX": -27, "offsetY": -10, "width": 54, "height": 24},
                {"offsetX": -11, "offsetY": 9, "width": 88, "height": 23},
                {"offsetX": 13, "offsetY": 31, "width": 140, "height": 26},
            ],
        }
        centro = (600, 400)
        escala = 1.5
        offsets = [(-37, -35), (-27, -10), (-11, 9), (13, 31)]
        bounds = [
            {
                "left": int(centro[0] + offset_x * escala - 10),
                "top": int(centro[1] + offset_y * escala - 8),
                "width": 20,
                "height": 16,
                "texto": f"OCR {indice}",
            }
            for indice, (offset_x, offset_y) in enumerate(offsets, start=1)
        ]
        estimada = self.executor.estimar_referencia_por_alvos_ocr(
            bounds,
            leitura_relativa=leitura,
            dimensoes_referencia=(198, 126),
        )
        self.assertAlmostEqual(estimada["ocr_layout_scale_x"], escala, places=2)
        self.assertAlmostEqual(estimada["ocr_layout_scale_y"], escala, places=2)
        self.assertEqual((estimada["width"], estimada["height"]), (297, 189))

    def test_layout_does_not_swap_a_similar_text_for_a_better_position(self):
        iss_saida = "ISS Sa\u00edda"
        partes = ["Tipo da nota", iss_saida]
        layouts = [
            {"offset_x": -37, "offset_y": -35, "width": 80, "height": 23},
            {"offset_x": -27, "offset_y": -10, "width": 54, "height": 24},
        ]
        ancora = {"left": 27, "top": 20, "width": 67, "height": 17, "text": partes[0], "texto": partes[0], "score": 1.0}
        leitura_correta = {"left": 49, "top": 44, "width": 44, "height": 10, "text": "ISS Safda", "texto": "ISS Safda", "score": 0.89}
        texto_errado_bem_posicionado = {"left": 50, "top": 49, "width": 65, "height": 10, "text": "ISS Tomador", "texto": "ISS Tomador", "score": 0.60}
        self.executor.localizar_texto_por_ocr_screenshot = Mock(
            side_effect=lambda texto, **_kwargs: [ancora] if texto == partes[0] else [
                texto_errado_bem_posicionado,
                leitura_correta,
            ]
        )
        candidatos = motor.ExecutorAutomacao.localizar_texto_composto_por_ocr_screenshot(
            self.executor,
            "\n".join(partes),
            {"partes": partes, "relacional": False},
            region=(0, 0, 300, 200),
            retornar_candidatos=True,
            layout_alvos=layouts,
        )
        self.assertEqual(len(candidatos), 1)
        self.assertEqual(candidatos[0]["ocr_related_bounds"][1]["texto"], "ISS Safda")

    def test_composite_accepts_one_small_label_confusion_after_layout_validation(self):
        partes = ["Natureza de", "C\u00f3digo"]
        layouts = [
            {"offset_x": 0, "offset_y": -21, "width": 136, "height": 27},
            {"offset_x": -39, "offset_y": 2, "width": 57, "height": 23},
        ]
        ancora = {
            "left": 965, "top": 495, "width": 70, "height": 10,
            "text": partes[0], "texto": partes[0], "score": 1.0,
        }
        leitura_ocr = {
            "left": 942, "top": 517, "width": 38, "height": 12,
            "text": "C\u00e9digo", "texto": "C\u00e9digo", "score": 5 / 6,
        }
        self.executor.localizar_texto_por_ocr_screenshot = Mock(
            side_effect=lambda texto, **_kwargs: [ancora] if texto == partes[0] else [leitura_ocr]
        )

        candidatos = motor.ExecutorAutomacao.localizar_texto_composto_por_ocr_screenshot(
            self.executor,
            "\n".join(partes),
            {"partes": partes, "relacional": False},
            region=(0, 0, 1600, 900),
            retornar_candidatos=True,
            layout_alvos=layouts,
        )

        self.assertEqual(len(candidatos), 1)
        self.assertEqual(candidatos[0]["ocr_related_bounds"][1]["texto"], "C\u00e9digo")
        self.assertTrue(self.executor.texto_ocr_confirma_alvo("C\u00f3digo", "C\u00e9digo", limite_ratio=0.86))
        self.assertFalse(self.executor.texto_ocr_confirma_alvo("C\u00f3digo", "C\u00e9digo", limite_ratio=0.90))
        self.assertFalse(self.executor.texto_ocr_confirma_alvo("C\u00f3digo", "Caxigo", limite_ratio=0.86))

    def test_individual_ocr_continues_to_next_target_after_a_match(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        leitura = {
            "largura": 136, "altura": 27, "offset_x": 0, "offset_y": -21,
            "ocr_target_layouts": [
                {"texto": "Natureza de", "action": "continuar", "failureAction": "continuar"},
                {"texto": "Codigo", "offsetX": -39, "offsetY": 2, "width": 57, "height": 23,
                 "action": "confirmar_ir_para_bloco", "block": "15", "failureAction": "parar"},
            ],
        }
        primeira = {"visual_confirmed": True, "left": 10, "top": 10, "width": 159, "height": 74}
        segunda = {"visual_confirmed": True, "left": 10, "top": 10, "width": 159, "height": 74}
        executor.localizar_referencia_hibrida_ocr_visual = Mock(side_effect=[primeira, segunda])

        local = executor.localizar_referencia_hibrida_por_primeiro_ocr(
            "codigo_001", "Natureza de\nCodigo", dimensoes_referencia=(159, 74), leitura_relativa=leitura,
        )

        self.assertEqual(executor.localizar_referencia_hibrida_ocr_visual.call_count, 2)
        leituras = [call.kwargs["leitura_relativa"] for call in executor.localizar_referencia_hibrida_ocr_visual.call_args_list]
        self.assertEqual([item["ocr_target_marker_index"] for item in leituras], [0, 1])
        self.assertEqual(local["ocr_target_index"], 1)
        self.assertEqual(local["ocr_target_action"]["action"], "confirmar_ir_para_bloco")

    def test_individual_ocr_marker_keeps_its_original_color_and_number(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.bounds_reconhecimento = Mock(return_value=(100, 120, 200, 90))
        executor.marcar_regiao_absoluta = Mock()

        executor.marcar_alvos_ocr_em_sequencia(
            {"ocr_bounds": {"left": 140, "top": 146, "width": 44, "height": 18}},
            leitura_relativa={
                "largura": 44,
                "altura": 18,
                "offset_x": 0,
                "offset_y": 0,
                "ocr_target_marker_index": 2,
                "ocr_target_layouts": [{"texto": "OCR tres"}],
            },
            dimensoes_referencia=(200, 90),
        )

        self.assertEqual(executor.marcar_regiao_absoluta.call_args.kwargs["tema"], "ocr_busca_3")
        self.assertEqual(executor.marcar_regiao_absoluta.call_args.kwargs["etiqueta"], "OCR 3")
        self.assertEqual(executor.tema_alvo_ocr(4), "ocr_busca_5")
        self.assertEqual(executor.tema_alvo_ocr(5), "ocr_busca_6")

    def test_individual_ocr_failure_can_stop_without_checking_next_target(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        leitura = {
            "ocr_target_layouts": [
                {"texto": "Natureza de", "action": "continuar", "failureAction": "parar"},
                {"texto": "Codigo", "action": "continuar", "failureAction": "continuar"},
            ],
        }
        executor.localizar_referencia_hibrida_ocr_visual = Mock(return_value=None)

        local = executor.localizar_referencia_hibrida_por_primeiro_ocr(
            "codigo_001", "Natureza de\nCodigo", dimensoes_referencia=(159, 74), leitura_relativa=leitura,
        )

        self.assertEqual(executor.localizar_referencia_hibrida_ocr_visual.call_count, 1)
        self.assertEqual(local["ocr_target_flow"], {"acao": "parar"})

    def test_individual_ocr_failure_can_jump_to_its_configured_block(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        leitura = {
            "ocr_target_layouts": [
                {
                    "texto": "Empresa",
                    "action": "continuar",
                    "failureAction": "ir_para_bloco",
                    "failureBlock": "20",
                },
                {"texto": "Periodo", "action": "continuar", "failureAction": "continuar"},
            ],
        }
        executor.localizar_referencia_hibrida_ocr_visual = Mock(return_value=None)

        local = executor.localizar_referencia_hibrida_por_primeiro_ocr(
            "empresa_001", "Empresa\nPeriodo", dimensoes_referencia=(159, 74), leitura_relativa=leitura,
        )

        self.assertEqual(executor.localizar_referencia_hibrida_ocr_visual.call_count, 1)
        self.assertEqual(local["ocr_target_flow"], {
            "acao": "ir_para_bloco",
            "bloco": "20",
            "origem": "falha_ocr",
        })

    def test_individual_visual_failure_respects_continue_rule(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        leitura = {
            "ocr_target_layouts": [
                {"texto": "OCR um", "action": "continuar", "failureAction": "continuar"},
                {"texto": "OCR dois", "action": "continuar", "failureAction": "continuar"},
                {"texto": "OCR tres", "action": "continuar", "failureAction": "continuar"},
            ],
        }
        primeiro = {"visual_confirmed": False, "left": 10, "top": 10, "width": 100, "height": 50}
        terceiro = {"visual_confirmed": False, "left": 12, "top": 12, "width": 100, "height": 50}
        executor.localizar_referencia_hibrida_ocr_visual = Mock(side_effect=[primeiro, None, terceiro])

        resultado = executor.localizar_referencia_hibrida_por_primeiro_ocr(
            "codigo_001", "OCR um\nOCR dois\nOCR tres", dimensoes_referencia=(159, 74), leitura_relativa=leitura,
        )

        self.assertEqual(resultado["ocr_target_flow"], {"acao": "continuar"})
        self.assertEqual(resultado["ocr_target_index"], 2)
        self.assertEqual(executor.localizar_referencia_hibrida_ocr_visual.call_count, 3)

    def test_individual_ocr_confirm_and_click_actions_jump_to_the_configured_block(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = Mock(return_value=False)
        confirmar = {
            "ocr_target_individual": True,
            "ocr_target_index": 0,
            "ocr_target_action": {"action": "confirmar_ir_para_bloco", "block": "15"},
        }

        self.assertEqual(executor.aplicar_acao_individual_ocr(confirmar), "ir_para_bloco")
        self.assertEqual(confirmar["ocr_target_flow"], {"acao": "ir_para_bloco", "bloco": "15"})

        clicar = {
            "ocr_target_individual": True,
            "ocr_target_index": 1,
            "ocr_target_action": {"action": "clicar_ir_para_bloco", "block": "18", "clicks": 1},
            "ocr_related_bounds": [{"left": 120, "top": 220, "width": 40, "height": 20}],
        }
        executor.bounds_reconhecimento = Mock(return_value=(120, 220, 40, 20))
        executor.marcar_regiao_absoluta = Mock()
        with patch.object(motor.pyautogui, "click") as click:
            self.assertEqual(executor.aplicar_acao_individual_ocr(clicar, {
                "_click_offset_x": 50,
                "_click_offset_y": -25,
                "_dimensoes_referencia": (100, 50),
            }), "ir_para_bloco")
        # O clique usa o ponto marcado no print, escalado pela referencia, e
        # nao o centro do texto OCR que serviu apenas para validar a tela.
        click.assert_called_once_with(x=160, y=220, clicks=1, interval=0.08)
        self.assertEqual(clicar["ocr_target_flow"], {"acao": "ir_para_bloco", "bloco": "18"})

    def test_hybrid_execution_reads_the_active_window_without_activating_it(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor._cache_ocr_screenshot = {}
        executor._janela_contexto = ""
        executor._janela_fixada = None
        executor.janela_alvo = ""
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.alvo_execucao_ativo = Mock(return_value=False)
        executor.resolver_imagem = Mock(return_value=(Path(__file__), "sped_001"))
        executor.resolver_janela_evento = Mock(return_value="")
        executor.obter_dimensoes_imagem = Mock(return_value=(99, 52))
        executor.normalizar_modo_area_busca = Mock(return_value="target_window")
        executor.limitar_regiao = Mock(side_effect=lambda region, **_kwargs: region)
        executor.extrair_texto_referencia = Mock(return_value="")
        executor.obter_regiao_historica_reconhecimento = Mock(return_value=None)
        executor.construir_regiao_personalizada = Mock(return_value=None)
        janela_ativa = {
            "title": "Movimento de ISS Tomador (Alteracao)",
            "left": 530, "top": 116, "width": 604, "height": 690,
        }
        executor.obter_janela_fixada = Mock(return_value=None)
        executor.obter_janela_ativa = Mock(return_value=janela_ativa)
        executor.janela_parece_interface_flowdetect = Mock(return_value=False)
        executor.adotar_janela_ativa_para_ocr = Mock(side_effect=AssertionError("Nao deve fixar a janela ativa"))
        executor.ativar_janela_alvo = Mock(side_effect=AssertionError("Nao deve ativar nenhuma janela"))
        executor.localizar_janela_alvo = Mock(side_effect=AssertionError("Nao deve procurar ou trocar janela"))
        executor.localizar_referencia_hibrida_ocr_visual = Mock(return_value={
            "left": 824, "top": 140, "width": 99, "height": 52,
            "visual_confirmed": True,
        })
        executor.registrar_reconhecimento_bem_sucedido = Mock()

        with patch.object(motor, "OCR_DISPONIVEL", True), patch.object(motor, "OPENCV_DISPONIVEL", True):
            encontrado = executor.esperar_imagem(
                "sped_001",
                timeout=3,
                confianca=0.8,
                perfil_busca="balanced",
                modo_area_busca="target_window",
                texto_ocr_esperado="SPED Reinf",
                leitura_relativa={"largura": 71, "altura": 22, "offset_x": -3, "offset_y": 4},
            )

        self.assertTrue(encontrado["visual_confirmed"])
        executor.obter_janela_ativa.assert_called_once()
        executor.adotar_janela_ativa_para_ocr.assert_not_called()
        executor.ativar_janela_alvo.assert_not_called()
        executor.localizar_janela_alvo.assert_not_called()
        self.assertEqual(
            executor.localizar_referencia_hibrida_ocr_visual.call_args.kwargs["region"],
            (530, 116, 604, 690),
        )
        executor.registrar_reconhecimento_bem_sucedido.assert_called_once()

        # Uma falha decidida pela aba "Acoes por OCR" precisa sair da busca
        # hibrida imediatamente; ela nao pode cair na regra geral do card.
        fluxo_ocr = {
            "ocr_target_individual": True,
            "ocr_target_index": 1,
            "ocr_target_flow": {"acao": "parar"},
        }
        executor.localizar_referencia_hibrida_ocr_visual.reset_mock(return_value=True)
        executor.localizar_referencia_hibrida_ocr_visual.return_value = fluxo_ocr
        encontrado_fluxo = executor.esperar_imagem(
            "sped_001",
            timeout=3,
            confianca=0.8,
            perfil_busca="balanced",
            modo_area_busca="target_window",
            texto_ocr_esperado="SPED Reinf",
            leitura_relativa={"largura": 71, "altura": 22, "offset_x": -3, "offset_y": 4},
        )
        self.assertIs(encontrado_fluxo, fluxo_ocr)

    def test_hybrid_execution_keeps_an_inherited_window_passive(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor._cache_ocr_screenshot = {}
        executor._janela_contexto = ""
        executor._janela_fixada = None
        executor.janela_alvo = ""
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.alvo_execucao_ativo = Mock(return_value=False)
        executor.resolver_imagem = Mock(return_value=(Path(__file__), "sped_001"))
        executor.resolver_janela_evento = Mock(return_value="Movimento de ISS Tomador (Alteracao)")
        executor.obter_dimensoes_imagem = Mock(return_value=(99, 52))
        executor.normalizar_modo_area_busca = Mock(return_value="target_window")
        executor.limitar_regiao = Mock(side_effect=lambda region, **_kwargs: region)
        executor.extrair_texto_referencia = Mock(return_value="")
        executor.obter_regiao_historica_reconhecimento = Mock(return_value=None)
        executor.construir_regiao_personalizada = Mock(return_value=None)
        janela = {
            "title": "Movimento de ISS Tomador (Alteracao)",
            "left": 530, "top": 116, "width": 604, "height": 690,
        }
        executor.obter_janela_fixada = Mock(return_value=None)
        executor.obter_janela_ativa = Mock(side_effect=AssertionError("Nao deve mudar a janela em primeiro plano"))
        executor.localizar_janela_alvo = Mock(return_value=janela)
        executor.ativar_janela_alvo = Mock(side_effect=AssertionError("Nao deve ativar a janela durante a busca"))
        executor.localizar_referencia_hibrida_ocr_visual = Mock(return_value={
            "left": 824, "top": 140, "width": 99, "height": 52,
            "visual_confirmed": True,
        })
        executor.registrar_reconhecimento_bem_sucedido = Mock()

        with patch.object(motor, "OCR_DISPONIVEL", True), patch.object(motor, "OPENCV_DISPONIVEL", True):
            encontrado = executor.esperar_imagem(
                "sped_001",
                timeout=3,
                confianca=0.8,
                perfil_busca="balanced",
                modo_area_busca="target_window",
                texto_ocr_esperado="SPED Reinf",
                leitura_relativa={"largura": 71, "altura": 22, "offset_x": -3, "offset_y": 4},
            )

        self.assertTrue(encontrado["visual_confirmed"])
        executor.localizar_janela_alvo.assert_called()
        executor.ativar_janela_alvo.assert_not_called()
        self.assertEqual(
            executor.localizar_referencia_hibrida_ocr_visual.call_args.kwargs["region"],
            (530, 116, 604, 690),
        )

    def test_execution_target_uses_fixed_hwnd_for_inherited_title(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor._cache_ocr_screenshot = {}
        executor._janela_contexto = "Movimento de ISS Tomador (Alteracao)"
        executor._janela_fixada = None
        executor.janela_alvo = "Movimento de ISS Tomador (Alteracao)"
        executor.contexto_execucao_alvo = {
            "target_enabled": True,
            "target_hwnd": 4421,
            "target_title": "Movimento de ISS Tomador (Alteracao)",
            "target_class": "TfrmMovimentoISSTEdita",
            "target_rect": {"left": 530, "top": 116, "width": 604, "height": 690},
        }
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.alvo_execucao_ativo = Mock(return_value=True)
        executor.resolver_imagem = Mock(return_value=(Path(__file__), "sped_001"))
        executor.resolver_janela_evento = Mock(return_value="Movimento de ISS Tomador (Alteracao)")
        executor.obter_dimensoes_imagem = Mock(return_value=(99, 52))
        executor.normalizar_modo_area_busca = Mock(return_value="target_window")
        executor.limitar_regiao = Mock(side_effect=lambda region, **_kwargs: region)
        executor.extrair_texto_referencia = Mock(return_value="")
        executor.obter_regiao_historica_reconhecimento = Mock(return_value=None)
        executor.construir_regiao_personalizada = Mock(return_value=None)
        janela = {
            "hwnd": 4421,
            "title": "Movimento de ISS Tomador (Alteracao)",
            "left": 530, "top": 116, "width": 604, "height": 690,
        }
        executor.obter_janela_alvo_execucao_atual = Mock(return_value=janela)
        executor.obter_janela_fixada = Mock(return_value=None)
        # A janela em primeiro plano so pode ser lida como dialogo complementar
        # do mesmo processo; ela nunca substitui o HWND fixado.
        executor.obter_janela_companheira_execucao = Mock(return_value=None)
        executor.obter_janela_ativa = Mock(side_effect=AssertionError("Nao deve trocar o HWND selecionado"))
        executor.localizar_janela_alvo = Mock(side_effect=AssertionError("Nao deve trocar o HWND selecionado por titulo"))
        executor.ativar_janela_alvo = Mock(side_effect=AssertionError("Nao deve ativar a janela durante a busca"))
        executor.localizar_referencia_hibrida_ocr_visual = Mock(return_value={
            "left": 824, "top": 140, "width": 99, "height": 52,
            "visual_confirmed": True,
        })
        executor.registrar_reconhecimento_bem_sucedido = Mock()

        with patch.object(motor, "OCR_DISPONIVEL", True), patch.object(motor, "OPENCV_DISPONIVEL", True):
            encontrado = executor.esperar_imagem(
                "sped_001",
                timeout=3,
                confianca=0.8,
                janela_alvo="Movimento de ISS Tomador (Alteracao)",
                perfil_busca="balanced",
                modo_area_busca="target_window",
                texto_ocr_esperado="SPED Reinf",
                leitura_relativa={"largura": 71, "altura": 22, "offset_x": -3, "offset_y": 4},
            )

        self.assertTrue(encontrado["visual_confirmed"])
        executor.obter_janela_alvo_execucao_atual.assert_called()
        executor.obter_janela_companheira_execucao.assert_called()
        executor.localizar_janela_alvo.assert_not_called()
        executor.ativar_janela_alvo.assert_not_called()
        self.assertEqual(
            executor.localizar_referencia_hibrida_ocr_visual.call_args.kwargs["region"],
            (530, 116, 604, 690),
        )

    def test_execution_target_reads_same_process_foreground_companion_passively(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor._cache_ocr_screenshot = {}
        executor._janela_contexto = "Movimento de ISS Tomador (Alteracao)"
        executor._janela_fixada = None
        executor.janela_alvo = "Movimento de ISS Tomador (Alteracao)"
        executor.contexto_execucao_alvo = {
            "target_enabled": True,
            "target_hwnd": 4421,
            "target_title": "Movimento de ISS Tomador (Alteracao)",
            "target_rect": {"left": 530, "top": 116, "width": 604, "height": 690},
        }
        executor.cancelamento_solicitado = Mock(return_value=False)
        executor.alvo_execucao_ativo = Mock(return_value=True)
        executor.resolver_imagem = Mock(return_value=(Path(__file__), "sped_001"))
        executor.resolver_janela_evento = Mock(return_value="Movimento de ISS Tomador (Alteracao)")
        executor.obter_dimensoes_imagem = Mock(return_value=(99, 52))
        executor.normalizar_modo_area_busca = Mock(return_value="target_window")
        executor.limitar_regiao = Mock(side_effect=lambda region, **_kwargs: region)
        executor.extrair_texto_referencia = Mock(return_value="")
        executor.obter_regiao_historica_reconhecimento = Mock(return_value=None)
        executor.construir_regiao_personalizada = Mock(return_value=None)
        principal = {
            "hwnd": 4421, "pid": 55, "title": "Movimento de ISS Tomador (Alteracao)",
            "left": 530, "top": 116, "width": 604, "height": 690,
        }
        dialogo = {
            "hwnd": 4422, "pid": 55, "title": "Dialogo SPED Reinf",
            "left": 1089, "top": 124, "width": 610, "height": 703,
        }
        executor.obter_janela_alvo_execucao_atual = Mock(return_value=principal)
        executor.obter_janela_ativa = Mock(return_value=dialogo)
        executor.janela_parece_interface_flowdetect = Mock(return_value=False)
        executor.obter_janela_fixada = Mock(return_value=None)
        executor.localizar_janela_alvo = Mock(side_effect=AssertionError("Nao deve trocar a janela alvo por titulo"))
        executor.ativar_janela_alvo = Mock(side_effect=AssertionError("Nao deve ativar uma janela durante a busca"))

        def localizar_hibrido(*_args, **kwargs):
            if kwargs["region"] == (1089, 124, 610, 703):
                return {"left": 1444, "top": 143, "width": 99, "height": 52, "visual_confirmed": True}
            return None

        executor.localizar_referencia_hibrida_ocr_visual = Mock(side_effect=localizar_hibrido)
        executor.registrar_reconhecimento_bem_sucedido = Mock()

        with patch.object(motor, "OCR_DISPONIVEL", True), patch.object(motor, "OPENCV_DISPONIVEL", True):
            encontrado = executor.esperar_imagem(
                "sped_001",
                timeout=1,
                confianca=0.8,
                janela_alvo="Movimento de ISS Tomador (Alteracao)",
                perfil_busca="fast",
                modo_area_busca="target_window",
                texto_ocr_esperado="SPED Reinf",
                leitura_relativa={"largura": 71, "altura": 22, "offset_x": -3, "offset_y": 4},
            )

        self.assertTrue(encontrado["visual_confirmed"])
        regioes = [chamada.kwargs["region"] for chamada in executor.localizar_referencia_hibrida_ocr_visual.call_args_list]
        # O dialogo modal visivel e menor e contem o alvo; ao confirma-lo a
        # busca encerra sem gastar uma segunda varredura na janela principal.
        self.assertEqual(regioes, [(1089, 124, 610, 703)])
        executor.ativar_janela_alvo.assert_not_called()
        executor.localizar_janela_alvo.assert_not_called()
        self.assertEqual(executor.contexto_execucao_alvo["target_hwnd"], 4421)

    def test_assisted_execution_enables_visual_markers(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.modo_teste_reconhecimento = False
        executor.ocultar_feedback_visual = False

        with patch.object(motor, "TK_DISPONIVEL", True):
            self.assertTrue(executor.feedback_visual_habilitado())

        executor.ocultar_feedback_visual = True
        with patch.object(motor, "TK_DISPONIVEL", True):
            self.assertFalse(executor.feedback_visual_habilitado())

    def test_passive_visual_context_is_kept_for_the_next_ocr_block(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.contexto_execucao_alvo = {}
        executor.janela_alvo = ""
        executor._janela_contexto = ""
        executor._janela_fixada = None
        executor.alvo_execucao_ativo = Mock(return_value=False)
        executor.janela_parece_interface_flowdetect = Mock(return_value=False)
        dialogo = {
            "hwnd": 815, "pid": 55, "title": "Movimento de ISS Tomador",
            "left": 602, "top": 297, "width": 716, "height": 438,
        }

        memorizada = executor.memorizar_contexto_visual_passivo(dialogo)

        self.assertEqual(memorizada, dialogo)
        self.assertEqual(executor._janela_contexto, "Movimento de ISS Tomador")
        self.assertEqual(executor._janela_fixada["hwnd"], 815)

    def test_visual_click_does_not_reactivate_an_old_context_by_default(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.centro_area_reconhecida = Mock(return_value=(620, 330))
        executor.preparar_janela_para_acao = Mock(side_effect=AssertionError("Nao deve reativar contexto"))
        fake_pyautogui = SimpleNamespace(moveTo=Mock(), mouseDown=Mock(), mouseUp=Mock())

        with patch.object(motor, "ctypes", SimpleNamespace()), patch.object(motor, "pyautogui", fake_pyautogui), patch.object(motor.time, "sleep"):
            resultado = executor.clicar_area_reconhecida(
                {"left": 600, "top": 310, "width": 40, "height": 40},
                janela_alvo="Janela antiga",
            )

        self.assertEqual(resultado, {"x": 620, "y": 330})
        executor.preparar_janela_para_acao.assert_not_called()
        fake_pyautogui.moveTo.assert_called_once_with(620, 330, duration=0.12)

    def test_repairing_double_encoded_text_keeps_the_ocr_target(self):
        original = "Faturamento e Dedu\u00e7\u00f5es"
        corrompido_uma_vez = original.encode("utf-8").decode("latin-1")
        corrompido_duas_vezes = corrompido_uma_vez.encode("utf-8").decode("latin-1")
        self.assertEqual(
            self.executor.normalizar_texto_ocr(corrompido_duas_vezes),
            self.executor.normalizar_texto_ocr(original),
        )

    def test_composite_ocr_reads_the_screen_once_for_all_targets(self):
        class FakeImage:
            width = 320
            height = 180

        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.modo_teste_reconhecimento = True
        executor._ocr_indisponivel_logado = False
        executor._cache_ocr_screenshot = {}
        executor.obter_regiao_busca = Mock(return_value=None)
        executor.capturar_tela_pil = Mock(return_value=(FakeImage(), 0, 0))
        executor.gerar_variantes_imagem_ocr = Mock(return_value=[("base", FakeImage())])
        fake_tesseract = SimpleNamespace(
            Output=SimpleNamespace(DICT="dict"),
            image_to_data=Mock(return_value={
                "text": ["Tipo", "da", "nota", "ISS", "Saida"],
                "conf": ["95", "95", "95", "95", "95"],
                "left": [20, 53, 78, 35, 60],
                "top": [20, 20, 20, 55, 55],
                "width": [28, 18, 30, 22, 34],
                "height": [14, 14, 14, 14, 14],
            }),
        )
        partes = ["Tipo da nota", "ISS Saida"]
        layouts = [
            {"offset_x": 0, "offset_y": 0, "width": 80, "height": 20},
            {"offset_x": 18, "offset_y": 35, "width": 60, "height": 20},
        ]
        with patch.object(motor, "OCR_DISPONIVEL", True), patch.object(motor, "pytesseract", fake_tesseract):
            candidatos = executor.localizar_texto_composto_por_ocr_screenshot(
                "\n".join(partes),
                {"partes": partes, "relacional": False},
                region=None,
                retornar_candidatos=True,
                layout_alvos=layouts,
            )

        self.assertEqual(fake_tesseract.image_to_data.call_count, 1)
        self.assertEqual(executor.capturar_tela_pil.call_count, 1)
        self.assertEqual(len(candidatos), 1)
        self.assertEqual(len(candidatos[0]["ocr_related_bounds"]), 2)


if __name__ == "__main__":
    unittest.main()
