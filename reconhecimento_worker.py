import contextlib
import io
import json
import sys
from pathlib import Path

from executar_automacao import ExecutorAutomacao


ROOT = Path(__file__).resolve().parent
ORIGINAL_STDOUT = sys.stdout


def responder(payload):
    ORIGINAL_STDOUT.write(json.dumps(payload, ensure_ascii=True) + "\n")
    ORIGINAL_STDOUT.flush()


def main():
    executor = ExecutorAutomacao(
        arquivo_mapeamento=ROOT / "mapeamento_teclado.json",
        arquivo_planilha=ROOT / "db.xlsx",
        arquivo_cancelamento=ROOT / ".parar_automacao.flag",
        modo_teste_reconhecimento=True,
    )

    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        if linha == "__quit__":
            responder({"success": True, "stdout": "worker encerrado", "stderr": ""})
            break

        logs = io.StringIO()
        try:
            request = json.loads(linha)
            executor.janela_alvo = str(request.get("janela_alvo") or "").strip()
            modo_reconhecimento = str(request.get("modo_reconhecimento") or "").strip().lower()
            texto_ocr = str(request.get("texto_ocr_busca") or request.get("texto_ocr_esperado") or "").strip()
            timeout_solicitado = float(request.get("timeout", 10) or 10)
            # Um hibrido com varios OCRs precisa de tempo para confirmar cada
            # texto e ainda comparar a imagem. O teste deve respeitar o timeout
            # configurado no bloco, em vez de ser interrompido em quatro segundos.
            limite_teste = 10.0 if modo_reconhecimento == "texto_ocr" and texto_ocr else 2.5
            timeout_teste = min(max(0.1, timeout_solicitado), limite_teste)
            with contextlib.redirect_stdout(logs):
                sucesso = executor.testar_reconhecimento(
                    imagem=request.get("imagem", ""),
                    timeout=timeout_teste,
                    confianca=float(request.get("confianca", 0.8) or 0.8),
                    janela_alvo=request.get("janela_alvo") or "",
                    clicar=False,
                    perfil_busca=request.get("perfil_busca") or "fast",
                    bloco_id=request.get("bloco_id") or "",
                    modo_area_busca=request.get("modo_area_busca") or "target_window",
                    area_personalizada=request.get("area_personalizada") or {},
                    texto_ocr_esperado=texto_ocr,
                    leitura_relativa=request.get("leitura_relativa") or {},
                    mostrar_marcador=True,
                    marcador_bloqueante=True,
                    duracao_marcador=0.36,
                )
            responder({"success": bool(sucesso), "stdout": logs.getvalue(), "stderr": ""})
        except Exception as erro:
            responder({"success": False, "stdout": logs.getvalue(), "stderr": str(erro)})


if __name__ == "__main__":
    main()
