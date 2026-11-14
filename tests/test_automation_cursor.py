import sys
import ctypes
import threading
import time
import types
import unittest
from unittest.mock import patch

import executar_automacao as motor
import marcador_visual
from marcador_visual import desenhar_cursor


class CursorTest(unittest.TestCase):
    def executor(self):
        executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.cancelamento_solicitado = lambda: False
        return executor

    def test_native_visual_failure_never_replays_an_action(self):
        calls = []

        def overlay(*args, **kwargs):
            kwargs['acao']()
            raise OSError('render failure after input')

        module = types.SimpleNamespace(exibir_marcador_windows=overlay)
        with patch.dict(sys.modules, {'_flowdetect_marcador_visual': module}), patch.object(motor.pyautogui, 'position', return_value=(10, 20)):
            with self.assertRaises(OSError):
                self.executor().com_cursor_flow(100, 200, 'Clique', lambda: calls.append('click'))
        self.assertEqual(calls, ['click'])

    def test_visual_unavailable_falls_back_once_and_cancellation_prevents_input(self):
        calls = []
        module = types.SimpleNamespace(exibir_marcador_windows=lambda *a, **k: False)
        with patch.dict(sys.modules, {'_flowdetect_marcador_visual': module}), patch.object(motor.pyautogui, 'position', return_value=(10, 20)):
            executor = self.executor()
            executor.com_cursor_flow(100, 200, 'Digitando', lambda: calls.append('text'))
            executor.cancelamento_solicitado = lambda: True
            with self.assertRaisesRegex(RuntimeError, 'interrompida'):
                executor.com_cursor_flow(100, 200, 'Clique', lambda: calls.append('click'))
        self.assertEqual(calls, ['text'])

    def test_native_frame_is_transparent_and_contains_pointer(self):
        image = desenhar_cursor()
        self.assertEqual(image.mode, 'RGBA')
        self.assertEqual(image.getpixel((189, 95))[3], 0)
        self.assertGreater(image.getpixel((9, 45))[3], 0)

    def test_runtime_uses_pointer_without_separate_recognition_or_click_boxes(self):
        executor = self.executor()
        executor.modo_teste_reconhecimento = False
        with patch.object(executor, 'marcar_area_reconhecida_windows') as marker:
            self.assertFalse(executor.marcar_area_reconhecida({'left':100,'top':100,'width':40,'height':20}, tema='ocr'))
            self.assertFalse(executor.marcar_regiao_absoluta(100,100,18,18,etiqueta='Clique'))
            marker.assert_not_called()

    @unittest.skipUnless(motor.os.name == 'nt', 'Win32 only')
    def test_animation_runs_independently_but_input_stays_on_executor_thread(self):
        calls=[]
        main_thread=threading.get_ident()
        user32=ctypes.WinDLL('user32')
        user32.GetForegroundWindow.restype=ctypes.c_void_p
        user32.IsWindowVisible.argtypes=[ctypes.c_void_p]
        foreground=user32.GetForegroundWindow()
        try:
            marcador_visual.executar_cursor_windows(350,250,'Clique',(250,200),lambda:calls.append(threading.get_ident()),lambda:False)
            service=marcador_visual._servicos_cursor[main_thread]
            self.assertNotEqual(service.thread.ident,main_thread)
            self.assertTrue(marcador_visual.definir_analise_cursor_windows(True))
            before=marcador_visual.posicao_cursor_windows()
            # The OCR/executor does not poll or update the renderer during this wait.
            time.sleep(.65)
            after=marcador_visual.posicao_cursor_windows()
            self.assertGreater(abs(after[0]-before[0]),15)
            marker=marcador_visual._cursores_retidos[service.thread.ident]['hwnd']
            marcador_visual.suspender_cursor_windows(True)
            self.assertFalse(user32.IsWindowVisible(marker))
            frozen=marcador_visual.posicao_cursor_windows()
            time.sleep(.12)
            self.assertEqual(marcador_visual.posicao_cursor_windows(),frozen)
            marcador_visual.suspender_cursor_windows(False)
            self.assertTrue(user32.IsWindowVisible(marker))
            marcador_visual.definir_analise_cursor_windows(False)
            with self.assertRaisesRegex(RuntimeError,'interrompida'):
                marcador_visual.executar_cursor_windows(800,400,'Clique',after,lambda:calls.append('unexpected'),lambda:True)
            self.assertEqual(calls,[main_thread])
            self.assertEqual(user32.GetForegroundWindow(),foreground)
        finally:
            marcador_visual.fechar_cursor_windows()
        self.assertFalse(service.thread.is_alive())
        self.assertNotIn(service.thread.ident,marcador_visual._cursores_retidos)

    @unittest.skipUnless(motor.os.name == 'nt', 'Win32 only')
    def test_native_cursor_remains_between_actions_hides_for_capture_and_cleans_up(self):
        user32 = ctypes.WinDLL('user32')
        user32.GetForegroundWindow.restype = ctypes.c_void_p
        user32.IsWindow.argtypes = [ctypes.c_void_p]
        user32.IsWindowVisible.argtypes = [ctypes.c_void_p]
        foreground = user32.GetForegroundWindow()
        calls = []
        old = latest = None
        try:
            for x in (120, 260):
                marcador_visual.exibir_marcador_windows(x, 180, 190, 96, .26, 'Clique', cursor=(100, 180), acao=lambda: calls.append('once'), persistir=True)
                latest = marcador_visual._cursores_retidos[threading.get_ident()]['hwnd']
                if old:
                    self.assertFalse(user32.IsWindow(old), 'previous window released after handoff')
                self.assertTrue(user32.IsWindowVisible(latest))
                self.assertTrue(marcador_visual.definir_analise_cursor_windows(True))
                state = marcador_visual._cursores_retidos[threading.get_ident()]
                before = state['posicao']
                state['inicio_busca'] -= .75
                marcador_visual.atualizar_cursor_windows()
                self.assertGreater(abs(state['posicao'][0]-before[0]), 15)
                self.assertTrue(marcador_visual._cursores_retidos[threading.get_ident()]['analisando'])
                marcador_visual.definir_analise_cursor_windows(False)
                frozen = state['posicao']
                marcador_visual.atualizar_cursor_windows()
                self.assertEqual(state['posicao'], frozen)
                self.assertFalse(marcador_visual._cursores_retidos[threading.get_ident()]['analisando'])
                marcador_visual.suspender_cursor_windows(True)
                self.assertFalse(user32.IsWindowVisible(latest))
                marcador_visual.suspender_cursor_windows(False)
                self.assertTrue(user32.IsWindowVisible(latest))
                old = latest
            self.assertEqual(calls, ['once', 'once'])
            self.assertEqual(user32.GetForegroundWindow(), foreground)
        finally:
            marcador_visual.fechar_cursor_windows()
        self.assertFalse(user32.IsWindow(latest))

    def test_capture_restores_cursor_even_when_capture_fails(self):
        calls = []
        module = types.SimpleNamespace(suspender_cursor_windows=lambda hidden: calls.append(hidden))
        executor = self.executor()
        executor._capturar_tela_sem_cursor = lambda region: (_ for _ in ()).throw(ValueError('capture failed'))
        with patch.dict(sys.modules, {'_flowdetect_marcador_visual': module}):
            with self.assertRaisesRegex(ValueError, 'capture failed'):
                executor.capturar_tela_pil()
        self.assertEqual(calls, [True, False])


if __name__ == '__main__':
    unittest.main()
