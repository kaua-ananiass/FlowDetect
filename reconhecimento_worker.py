import contextlib
import io
import json
import sys
from pathlib import Path

# The embedded Windows Python deliberately excludes the script directory from
# sys.path. Load our sibling executor from this trusted runtime directory.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from executar_automacao import ExecutorAutomacao


ORIGINAL_STDOUT = sys.stdout


def responder(payload):
    ORIGINAL_STDOUT.write(json.dumps(payload, ensure_ascii=True) + "\n")
    ORIGINAL_STDOUT.flush()


def testar_variavel_na_tela(executor, request):
    """Read-only screen probe. No click, typing, scrolling or saved-value writes."""
    text = str(request.get("reference") or "").strip()
    config = request.get("capture") or {}
    executor._ultima_captura_variavel = {}
    if not text:
        return {"ok": False, "error": "Configure o primeiro texto OCR como referência."}
    if not config.get("enabled"):
        return {"ok": False, "error": "Ative Salvar uma informação para testar."}
    results = []
    markers = []
    variable = None
    texts = request.get("texts") or [text]
    # Same first confirmed candidate used by the regular screen OCR test.
    # Never run a second independent anchor lookup for the variable.
    for index, target in enumerate(texts):
        candidates = executor.localizar_texto_por_ocr_screenshot(
            target, confianca=.72, janela_alvo=None,
            retornar_candidatos=True, marcar_candidatos=False, limite_candidatos=1,
        ) or []
        found = bool(candidates)
        marker = False
        if found:
            anchor = candidates[0]
        results.append({"text": target, "found": found, "markerShown": bool(marker),
                        "matched": str(candidates[0].get("text", "")) if found else ""})
        if index == 0:
            try:
                if not found:
                    raise ValueError("Refer\u00eancia n\u00e3o encontrada na tela.")
                executor.capturar_variavel_ocr(anchor, config)
                reading = executor._ultima_captura_variavel
                variable = {"found": True, "name": config.get("name"), **reading}
            except Exception as error:
                variable = {"found": False, "name": config.get("name"),
                            **getattr(executor, "_ultima_captura_variavel", {}), "error": str(error)}
        if found:
            markers.append((len(results)-1, dict(anchor), "ocr", f"OCR {index+1}"))
    if variable and variable["found"]:
        markers.append((None, dict(zip(("left", "top", "width", "height"), variable["region"])),
                        "variavel", "Vari\u00e1vel"))
    # Read all pixels before drawing. Reuse the same renderer, dimensions,
    # timing and spacing for OCR and variable, presenting one marker at a time.
    for index, bounds, theme, label in markers:
        try:
            shown = bool(executor.marcar_area_reconhecida(bounds,
                tema=theme, etiqueta=label, duracao=1.5, bloqueante=True, margem=8))
        except Exception:
            shown = False
        if index is not None:
            results[index]["markerShown"] = shown
    return {"ok": all(item["found"] for item in results) and bool(variable and variable["found"]),
            "results": results, "variable": variable, **{k:v for k,v in (variable or {}).items() if k != "found"}}



def main():
    executor = ExecutorAutomacao(
        arquivo_mapeamento=ROOT / "mapeamento_teclado.json",
        arquivo_planilha=ROOT / "db.xlsx",
        arquivo_cancelamento=ROOT / ".parar_automacao.flag",
        modo_teste_reconhecimento=True,
    )

    if len(sys.argv) > 1 and sys.argv[1] == "--test-variable":
        logs = io.StringIO()
        with contextlib.redirect_stdout(logs):
            try:
                result = testar_variavel_na_tela(executor, json.loads(sys.argv[2]))
            except Exception as error:
                result = {"ok": False, "error": str(error)}
        responder(result)
        return

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
            # Um bloco OCR + Visual tambem pode ter varios textos alvo. Antes
            # apenas o OCR sem imagem recebia o tempo completo e o botao
            # Procurar encerrava o hibrido em 2,5s, antes de chegar aos OCRs
            # seguintes. Sempre que houver texto OCR, respeitamos o timeout
            # configurado pelo card para testar todos os alvos em sequencia.
            limite_teste = 10.0 if texto_ocr else 2.5
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
                    # O Studio volta da minimizacao ao receber esta resposta.
                    # A confirmacao precisa durar o bastante para continuar
                    # visivel durante essa transicao.
                    duracao_marcador=0.75,
                )
            responder({"success": bool(sucesso), "stdout": logs.getvalue(), "stderr": ""})
        except Exception as erro:
            responder({"success": False, "stdout": logs.getvalue(), "stderr": str(erro)})


if __name__ == "__main__":
    main()
