import importlib.util
import base64
import json
import os
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / "gerenciar_roteiro.py"


def load_roadmap_module():
    spec = importlib.util.spec_from_file_location("roadmap_chrome_export_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ChromeExtensionExportTest(unittest.TestCase):
    def test_individual_ocr_exports_separate_transition_delays(self):
        module = load_roadmap_module()
        layout = {"action": "confirmar_ir_para_bloco", "block": "7", "successDelay": 1.5,
                  "failureAction": "ir_para_bloco", "failureBlock": "9", "failureDelay": 2.4}
        success = module.fluxo_alvo_ocr_para_chrome(layout, {}, "sucesso")
        failure = module.fluxo_alvo_ocr_para_chrome(layout, {}, "falha")
        self.assertEqual(success["delay_ms"], 1500)
        self.assertEqual(failure["delay_ms"], 2400)
        self.assertEqual(success["block"], "7")
        self.assertEqual(failure["block"], "9")

    @classmethod
    def setUpClass(cls):
        cls.roadmap = load_roadmap_module()

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp_dir.name)

    def tearDown(self):
        os.chdir(self.previous_cwd)
        self.temp_dir.cleanup()

    def test_exports_web_blocks_for_the_chrome_runner(self):
        automation_id = "auto_chrome"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "abrir_url",
                "intervalo_antes": 0,
                "detalhes": {"url": "https://example.com", "aguardar_segundos": 2},
            },
            {
                "ordem": 2,
                "sequencia": "principal",
                "tipo": "procurar_texto_ocr",
                "intervalo_antes": 0.3,
                "detalhes": {
                    "fonte_ocr": "elemento",
                    "texto": "#email",
                    "acao": "clicar",
                    "clicks": 1,
                    "timeout": 8,
                },
            },
            {
                "ordem": 3,
                "sequencia": "principal",
                "tipo": "tecla",
                "teclas": ["enter"],
                "intervalo_antes": 0,
                "detalhes": {},
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(
            automation_id,
            {"nome": "Cadastro", "descricao": "Cadastro web"},
        )

        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        self.assertEqual(exported["schema"], "flowdetect_chrome_automation")
        self.assertEqual(exported["version"], 3)
        self.assertEqual(exported["initial_sequence"], "principal")
        self.assertEqual([step["type"] for step in exported["steps"]], ["navigate", "element_action", "key_sequence"])
        self.assertEqual(exported["steps"][1]["selector"]["value"], "#email")
        self.assertEqual(exported["steps"][1]["clicks"], 1)
        self.assertEqual(exported["steps"][2]["keys"], ["enter"])
        self.assertEqual(result["exported_steps"], 3)

    def test_exports_ocr_and_visual_reference_with_its_image_data(self):
        automation_id = "auto_visual"
        payload = self.roadmap.criar_payload_vazio()
        image_path = Path("imagens") / "referencia.png"
        image_path.parent.mkdir(parents=True)
        image_path.write_bytes(
            bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082")
        )
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "procurar_texto_ocr",
                "detalhes": {"texto": "Empresa", "acao": "clicar", "clicar": True, "timeout": 4},
            },
            {
                "ordem": 2,
                "sequencia": "principal",
                "tipo": "clicar_imagem",
                "detalhes": {"imagem": "referencia.png", "clicar": True, "confianca": 0.8},
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Visual"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))

        self.assertEqual([step["type"] for step in exported["steps"]], ["ocr_text", "visual_match"])
        self.assertTrue(exported["steps"][1]["image"]["data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exported["steps"][0]["click"])

    def test_export_uses_images_from_selected_automation_not_open_studio_map(self):
        automation_id = "auto_selected"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [{
            "ordem": 1, "sequencia": "pagina_2", "tipo": "clicar_imagem",
            "detalhes": {
                "imagem": "imagens/validacao-02",
                "modo_reconhecimento": "texto_ocr",
                "fonte_ocr": "legado",
                "texto_ocr_busca": "Nenhum registro encontrado",
                "acao_ocr": "clicar",
            },
        }]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)
        own_image = self.roadmap.diretorio_automacao(automation_id) / "imagens" / "validacao-02"
        own_image.parent.mkdir(parents=True)
        image_bytes = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082"
        )
        own_image.write_bytes(image_bytes)
        root_image = Path("imagens") / own_image.name
        root_image.parent.mkdir()
        root_image.write_bytes(b"image from a different automation")

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Selecionada"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        preview = exported["steps"][0]["visual_fallback"]["data_url"]
        self.assertEqual(base64.b64decode(preview.split(",", 1)[1]), image_bytes)
        self.assertEqual(exported["warnings"], [])

        root_image.unlink()
        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Selecionada"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        self.assertEqual(base64.b64decode(exported["steps"][0]["visual_fallback"]["data_url"].split(",", 1)[1]), image_bytes)

    def test_ocr_source_chooses_dom_text_or_image_matching(self):
        image_path = Path("imagens") / "icone.png"
        image_path.parent.mkdir(parents=True)
        image_path.write_bytes(bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082"
        ))
        chrome_block = self.roadmap.criar_bloco_procurar_texto_ocr(
            "Emitir guia", 0, fonte_ocr="chrome"
        )
        visual_block = self.roadmap.criar_bloco_procurar_texto_ocr(
            "", 0, fonte_ocr="visual", imagem_ocr="icone.png"
        )
        chrome_block["ordem"] = 1
        visual_block["ordem"] = 2
        chrome_step, chrome_warning = self.roadmap.converter_evento_para_chrome(chrome_block)
        visual_step, visual_warning = self.roadmap.converter_evento_para_chrome(visual_block)
        self.assertIsNone(chrome_warning)
        self.assertIsNone(visual_warning)
        self.assertEqual(chrome_step["type"], "ocr_text")
        self.assertEqual(chrome_step["text"], "Emitir guia")
        self.assertEqual(visual_step["type"], "visual_match")
        self.assertTrue(visual_step["image"]["data_url"].startswith("data:image/png;base64,"))

    def test_exports_ocr_plus_visual_with_an_image_fallback(self):
        automation_id = "auto_hybrid"
        payload = self.roadmap.criar_payload_vazio()
        image_path = Path("imagens") / "definir.png"
        image_path.parent.mkdir(parents=True)
        image_path.write_bytes(
            bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082")
        )
        payload["eventos"] = [{
            "ordem": 1,
            "sequencia": "principal",
            "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr",
                "texto_ocr_busca": "Definir",
                "acao_ocr": "clicar",
                "imagem": "definir.png",
            },
        }]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "OCR e Visual"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        step = exported["steps"][0]

        self.assertEqual(step["type"], "ocr_text")
        self.assertTrue(step["click"])
        self.assertTrue(step["visual_fallback"]["data_url"].startswith("data:image/png;base64,"))

    def test_hybrid_ocr_source_can_use_chrome_text_without_visual_fallback(self):
        block = {
            "ordem": 3,
            "sequencia": "principal",
            "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr",
                "fonte_ocr": "chrome",
                "texto_ocr_busca": "Emitir guia",
                "imagem": "imagem_antiga.png",
                "acao_ocr": "clicar",
                "ocr_target_layouts": [
                    {"texto": "Emitir guia", "action": "clicar", "clicks": 1},
                    {"texto": "Confirmar", "action": "confirmar_ir_para_bloco", "block": "16"},
                ],
            },
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["type"], "ocr_text")
        self.assertNotIn("visual_fallback", step)
        self.assertEqual(len(step["ocr_targets"]), 2)
        self.assertEqual(str(step["ocr_targets"][1]["on_success"]["block"]), "16")

    def test_ocr_reference_is_embedded_for_the_execution_carousel(self):
        image_path = Path("preview.png")
        image_path.write_bytes(bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082"
        ))
        step, warning = self.roadmap.converter_evento_para_chrome({
            "ordem": 5, "sequencia": "principal", "tipo": "procurar_texto_ocr",
            "detalhes": {"texto": "Pesquisar", "imagem_ocr": str(image_path)},
        })
        self.assertIsNone(warning)
        self.assertEqual(step["type"], "ocr_text")
        self.assertTrue(step["preview_image"]["data_url"].startswith("data:image/png;base64,"))

    def test_hybrid_ocr_click_uses_distance_from_text_to_click_marker(self):
        block = {
            "ordem": 3, "sequencia": "principal", "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr", "fonte_ocr": "chrome",
                "texto_ocr_busca": "50.317.977/0001-05", "acao_ocr": "clicar",
                "offset_x": 130, "offset_y": 0,
                "ocr_target_layouts": [{"texto": "50.317.977/0001-05", "offsetX": -70, "offsetY": 0}],
            },
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["offset_x"], 200)
        self.assertEqual(step["offset_y"], 0)

    def test_ocr_marker_is_exported_from_the_drawn_text_box_edge(self):
        block = {
            "ordem": 1, "sequencia": "principal", "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr", "fonte_ocr": "chrome",
                "texto_ocr_busca": "50.317.977/0001-05 - SCRITA SOLU",
                "acao_ocr": "clicar", "offset_x": 136, "offset_y": -16,
                "leitura_relativa": {
                    "ativo": True, "offset_x": -34, "offset_y": -19,
                    "largura": 197, "altura": 30,
                },
            },
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["click_anchor"], {"from_text_left": 268.5, "from_text_top": 18.0})

    def test_each_ocr_target_uses_its_own_origin_for_the_click(self):
        block = {
            "ordem": 4, "sequencia": "principal", "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr", "fonte_ocr": "chrome",
                "texto_ocr_busca": "Empresa\nCNPJ", "acao_ocr": "clicar",
                "offset_x": 100, "offset_y": 10,
                "ocr_target_layouts": [
                    {"texto": "Empresa", "action": "clicar", "offsetX": -60, "offsetY": 0},
                    {"texto": "CNPJ", "action": "clicar", "offsetX": -20, "offsetY": 5},
                ],
            },
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual([target["offset_x"] for target in step["ocr_targets"]], [160, 120])
        self.assertEqual([target["offset_y"] for target in step["ocr_targets"]], [10, 5])

    def test_hybrid_ocr_source_can_use_only_the_reference_image(self):
        image_path = Path("imagens") / "botao.png"
        image_path.parent.mkdir(parents=True)
        image_path.write_bytes(bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082"
        ))
        block = {
            "ordem": 4,
            "sequencia": "principal",
            "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr",
                "fonte_ocr": "visual",
                "texto_ocr_busca": "Texto antigo",
                "imagem": "botao.png",
                "clicar": False,
            },
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["type"], "visual_match")
        self.assertFalse(step["click"])
        self.assertNotIn("ocr_targets", step)

    def test_element_source_exports_a_unique_css_target(self):
        block = self.roadmap.criar_bloco_procurar_texto_ocr(
            "tr[data-cnpj='123'] button.expandir", 0, fonte_ocr="elemento", clicks=2
        )
        block["ordem"] = 5
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["type"], "element_action")
        self.assertEqual(step["selector"], {"method": "css", "value": "tr[data-cnpj='123'] button.expandir"})
        self.assertTrue(step["require_unique"])
        self.assertEqual(step["clicks"], 2)

    def test_hybrid_element_source_exports_without_an_image(self):
        block = {
            "ordem": 6, "sequencia": "principal", "tipo": "clicar_imagem",
            "detalhes": {"modo_reconhecimento": "texto_ocr", "fonte_ocr": "elemento",
                         "texto_ocr_busca": "button[aria-label='Expandir']", "imagem": ""},
        }
        step, warning = self.roadmap.converter_evento_para_chrome(block)
        self.assertIsNone(warning)
        self.assertEqual(step["type"], "element_action")
        self.assertEqual(step["selector"]["value"], "button[aria-label='Expandir']")

    def test_exports_spreadsheet_values_as_a_loop_source(self):
        automation_id = "auto_spreadsheet"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "sequencia_planilha",
                "detalhes": {
                    "coluna": "CNPJ",
                    "valores": ["03943209000187", 51708970000187],
                    "acao_apos_item": ["enter"],
                    "intervalo_entre_itens": 0.5,
                },
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Planilha"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        step = exported["steps"][0]

        self.assertEqual(step["type"], "data_source")
        self.assertEqual(step["name"], "CNPJ")
        self.assertEqual(step["values"], ["03943209000187", "51708970000187"])
        self.assertEqual(step["interval_ms"], 500)
        self.assertNotIn("after_keys", step)

    def test_exports_the_selected_report_column_with_each_spreadsheet_row(self):
        from openpyxl import Workbook

        workbook_path = Path("clientes.xlsx")
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Dados"
        sheet.append(["CNPJ", "Empresa", "Cidade"])
        sheet.append(["03943209000187", "Empresa Modelo", "Sao Paulo"])
        sheet.append(["51708970000187", "Outra Empresa", "Campinas"])
        workbook.save(workbook_path)
        workbook.close()

        automation_id = "auto_report_column"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "sequencia_planilha",
                "detalhes": {
                    "arquivo": str(workbook_path),
                    "aba": "Dados",
                    "coluna": "CNPJ",
                    "valores": ["03943209000187", "51708970000187"],
                },
            },
            {
                "ordem": 2,
                "sequencia": "principal",
                "tipo": "resultado_relatorio",
                "detalhes": {
                    "status": "Concluida",
                    "tom": "success",
                    "resultado": "Automacao concluida para {{empresa}}.",
                    "coluna_relatorio": "Empresa",
                    "coluna_resultado": "Cidade",
                    "coluna_confirmacao": "Empresa",
                },
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Relatorio por empresa"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))

        source, report = exported["steps"]
        self.assertEqual(source["values"], ["03943209000187", "51708970000187"])
        self.assertEqual(
            source["rows"],
            [
                {"Empresa": "Empresa Modelo", "Cidade": "Sao Paulo"},
                {"Empresa": "Outra Empresa", "Cidade": "Campinas"},
            ],
        )
        self.assertEqual(report["report_column"], "Empresa")
        self.assertEqual(report["result_column"], "Cidade")
        self.assertEqual(report["confirmation_column"], "Empresa")

    def test_exports_report_result_for_the_chrome_execution_report(self):
        automation_id = "auto_report"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [{
            "ordem": 1,
            "sequencia": "principal",
            "tipo": "resultado_relatorio",
            "intervalo_antes": 0,
            "detalhes": {
                "status": "Sem debitos",
                "tom": "info",
                "resultado": "Nenhum debito encontrado para {{CNPJ}}.",
                "confirmacao": "Alerta confirmado na tela.",
                "ao_sucesso": "ir_para_sequencia",
                "sequencia_sucesso": "pagina_2",
                "atraso_antes_sequencia_sucesso": 0.8,
            },
        }]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Relatorio"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))

        self.assertEqual(exported["steps"][0]["type"], "report_result")
        self.assertEqual(exported["steps"][0]["status"], "Sem debitos")
        self.assertEqual(exported["steps"][0]["tone"], "info")
        self.assertEqual(exported["steps"][0]["confirmation"], "Alerta confirmado na tela.")
        self.assertEqual(exported["steps"][0]["on_success"], {
            "action": "ir_para_sequencia",
            "block": "",
            "sequence": "pagina_2",
        })

    def test_exports_ocr_routes_and_secondary_page_targets(self):
        automation_id = "auto_ocr_route"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [
            {
                "ordem": 1,
                "sequencia": "principal",
                "tipo": "clicar_imagem",
                "detalhes": {
                    "modo_reconhecimento": "texto_ocr",
                    "texto_ocr_busca": "Certificado digital",
                    "acao_ocr": "clicar",
                    "cliques": 1,
                    "ocr_target_layouts": [{
                        "texto": "Certificado digital",
                        "action": "clicar_ir_para_bloco",
                        "block": "2",
                        "clicks": 2,
                        "failureAction": "ir_para_bloco",
                        "failureBlock": "2",
                    }],
                    "ao_nao_encontrar": "parar",
                },
            },
            {
                "ordem": 2,
                "sequencia": "pagina_2",
                "tipo": "clicar_imagem",
                "detalhes": {
                    "modo_reconhecimento": "texto_ocr",
                    "texto_ocr_busca": "Meu Perfil",
                    "acao_ocr": "clicar",
                },
            },
        ]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Rota OCR"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))

        self.assertEqual(result["exported_steps"], 2)
        self.assertEqual([step["sequence"] for step in exported["steps"]], ["principal", "pagina_2"])
        self.assertEqual(exported["steps"][0]["on_success"], {"action": "ir_para_bloco", "block": "2", "sequence": ""})
        self.assertEqual(exported["steps"][0]["on_failure"], {"action": "ir_para_bloco", "block": "2", "sequence": ""})
        self.assertTrue(exported["steps"][0]["click"])
        self.assertEqual(exported["steps"][0]["clicks"], 2)
        self.assertFalse(exported["warnings"])

    def test_exports_each_route_of_multiple_ocr_targets(self):
        automation_id = "auto_multiple_ocr_routes"
        payload = self.roadmap.criar_payload_vazio()
        payload["eventos"] = [{
            "ordem": 9,
            "sequencia": "principal",
            "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr",
                "texto_ocr_busca": "Competencia\n09/2026",
                "acao_ocr": "clicar",
                "ao_nao_encontrar": "parar",
                "ocr_target_layouts": [
                    {
                        "texto": "Competencia",
                        "action": "continuar",
                        "failureAction": "continuar",
                    },
                    {
                        "texto": "09/2026",
                        "editableChrome": True,
                        "action": "confirmar_ir_para_bloco",
                        "block": "15",
                        "failureAction": "ir_para_bloco",
                        "failureBlock": "12",
                    },
                ],
            },
        }]
        self.roadmap.salvar_payload_em_automacao(automation_id, payload, incluir_recursos=False)

        result = self.roadmap.exportar_automacao_para_chrome(automation_id, {"nome": "Rotas OCR"})
        exported = json.loads(Path(result["json_path"]).read_text(encoding="utf-8"))
        step = exported["steps"][0]

        self.assertEqual([target["text"] for target in step["ocr_targets"]], ["Competencia", "09/2026"])
        self.assertEqual([target["editable"] for target in step["ocr_targets"]], [False, True])
        self.assertEqual(step["ocr_targets"][0]["on_failure"], {"action": "continuar", "block": "", "sequence": ""})
        self.assertEqual(step["ocr_targets"][1]["on_success"], {"action": "ir_para_bloco", "block": "15", "sequence": ""})
        self.assertEqual(step["ocr_targets"][1]["on_failure"], {"action": "ir_para_bloco", "block": "12", "sequence": ""})

    def test_single_ocr_target_can_be_edited_in_chrome(self):
        step, warning = self.roadmap.converter_evento_para_chrome({
            "ordem": 17, "sequencia": "principal", "tipo": "clicar_imagem",
            "detalhes": {
                "modo_reconhecimento": "texto_ocr", "fonte_ocr": "chrome",
                "texto_ocr_busca": "09/2026", "acao_ocr": "clicar",
                "ocr_target_layouts": [{"texto": "09/2026", "editableChrome": True,
                                        "action": "clicar", "offsetX": 12, "offsetY": 4}],
            },
        })
        self.assertIsNone(warning)
        self.assertTrue(step["editable_ocr"])
        self.assertEqual(step["text"], "09/2026")
        self.assertTrue(step["click"])
        self.assertNotIn("ocr_targets", step)

    def test_standalone_ocr_target_can_be_edited_in_chrome(self):
        step, warning = self.roadmap.converter_evento_para_chrome({
            "ordem": 3, "sequencia": "principal", "tipo": "procurar_texto_ocr",
            "detalhes": {"texto": "09/2026", "ocr_target_layouts": [
                {"texto": "09/2026", "editableChrome": True}
            ]},
        })
        self.assertIsNone(warning)
        self.assertTrue(step["editable_ocr"])
        self.assertEqual(step["text"], "09/2026")


if __name__ == "__main__":
    unittest.main()
