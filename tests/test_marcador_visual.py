import unittest
from unittest.mock import Mock

from marcador_visual import aplicar_flip, desenhar_marcador, progresso_flip, _pixels_premultiplicados
import executar_automacao as motor


class MarcadorVisualTest(unittest.TestCase):
    def test_ocr_and_visual_use_distinct_studio_palettes(self):
        ocr = desenhar_marcador(200, 40, "OCR encontrado", "ocr")
        visual = desenhar_marcador(200, 40, "Reconhecido", "visual")

        self.assertEqual(ocr.mode, "RGBA")
        self.assertEqual(ocr.size, visual.size)
        self.assertEqual(ocr.getpixel((124, 82))[3], 0)
        self.assertEqual(visual.getpixel((124, 82))[3], 0)
        azul = ocr.getpixel((24, 82))
        verde = visual.getpixel((24, 82))
        busca = desenhar_marcador(200, 40, "OCR 1", "ocr_busca_1").getpixel((24, 82))
        self.assertGreater(azul[2], azul[1])
        self.assertGreater(busca[2], busca[1])
        self.assertGreater(verde[1], verde[2])
        self.assertGreater(azul[3], 0)
        self.assertGreater(verde[3], 0)

    def test_premultiplied_pixels_keep_transparent_center(self):
        imagem = desenhar_marcador(120, 36, "OCR encontrado", "ocr")
        pixels = _pixels_premultiplicados(imagem)
        self.assertEqual(len(pixels), imagem.width * imagem.height * 4)
        centro = ((62 + 18) * imagem.width + (24 + 60)) * 4
        self.assertEqual(pixels[centro:centro + 3], b"\x00\x00\x00")
        self.assertLessEqual(pixels[centro + 3], 1)

    def test_flip_enters_and_exits_within_original_duration(self):
        base = desenhar_marcador(200, 40, "OCR encontrado", "ocr")
        fechado = aplicar_flip(base, 0, "ocr")
        aberto = aplicar_flip(base, 1, "ocr")
        self.assertEqual(fechado.size, aberto.size)
        # A borda fica fixa sobre o alvo; so a etiqueta faz o flip.
        self.assertGreater(fechado.getbbox()[2] - fechado.getbbox()[0], base.width // 2)
        self.assertEqual(fechado.getpixel((24, 82))[3] > 0, aberto.getpixel((24, 82))[3] > 0)
        self.assertEqual(progresso_flip(0, 0.45), 0)
        self.assertEqual(progresso_flip(0.22, 0.45), 1)
        self.assertLess(progresso_flip(0.43, 0.45), 1)
        self.assertEqual(progresso_flip(0.45, 0.45), 0)

    @unittest.skipUnless(motor.os.name == "nt", "Marcador nativo apenas no Windows")
    def test_native_marker_applies_margin_around_the_target(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.marcar_area_reconhecida_windows = Mock(return_value=True)
        executor.marcar_area_reconhecida(
            {"left": 100, "top": 200, "width": 80, "height": 24},
            tema="ocr", margem=18,
        )
        self.assertEqual(executor.marcar_area_reconhecida_windows.call_args.args[:4],
                         (82, 182, 116, 60))


if __name__ == "__main__":
    unittest.main()
