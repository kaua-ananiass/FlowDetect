"""Real desktop report rendering: long content survives pagination within A4."""
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import executar_automacao as motor
try:
    import pymupdf
except ImportError:
    pymupdf = None


@unittest.skipUnless(pymupdf and motor.PDF_RELATORIO_DISPONIVEL, 'PDF rendering dependencies unavailable')
class ReportPdfLayoutTest(unittest.TestCase):
    def test_long_results_keep_their_end_and_stay_inside_the_page(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        with tempfile.TemporaryDirectory() as directory, patch.object(motor, 'PASTA_RELATORIOS_LOOP', Path(directory)):
            report = dict(arquivo='Relatório de conferência de documentos', aba='Empresas', coluna_relatorio='Empresa',
                          iniciado_em=datetime(2026, 11, 3, 9), resultados=[dict(
                              empresa='Empresa de nome extenso Comércio e Serviços Ltda', linha=1,
                              resultado='Conferência detalhada de documentos. ' * 250 + 'FIM_PRESERVADO',
                              status='Revisar competência', tom='warning', sucesso=True)])
            file = executor.gerar_relatorio_loop_pdf(report)
            with pymupdf.open(file) as document:
                self.assertGreater(len(document), 1)
                content = '\n'.join(page.get_text() for page in document)
                self.assertIn('FIM_PRESERVADO', content)
                self.assertIn('Continuacao da mesma linha', content)
                for page in document:
                    for block in page.get_text('dict')['blocks']:
                        for line in block.get('lines', []):
                            for span in line['spans']:
                                x0, y0, x1, y1 = span['bbox']
                                self.assertGreaterEqual(x0, 27, span['text'])
                                self.assertLessEqual(x1, page.rect.width - 25, span['text'])
                                self.assertGreaterEqual(y0, 14, span['text'])
                                self.assertLessEqual(y1, page.rect.height - 12, span['text'])
