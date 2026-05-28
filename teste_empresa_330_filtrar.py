import argparse
import sys
import time

from automacao_alterdata_background import AlterdataBackgroundAutomation


EMPRESA_EDIT_TYPE_INDEX = 6
EMPRESA_CODIGO = "330"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Teste simples: preencher empresa com 330 e clicar em Filtrar."
    )
    parser.add_argument(
        "--repeticoes",
        type=int,
        default=5,
        help="Quantidade de vezes para repetir a sequencia.",
    )
    parser.add_argument(
        "--intervalo",
        type=float,
        default=1.0,
        help="Segundos entre uma etapa e outra.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    automation = AlterdataBackgroundAutomation()

    try:
        automation.localizar_janela_alvo()
        empresa_control = automation.localizar_controle(
            indice=EMPRESA_EDIT_TYPE_INDEX,
            allowed_categories=("edit",),
        )
        filtrar_control = automation.localizar_controle(
            nome="Filtrar",
            allowed_categories=("button",),
        )

        empresa_hwnd = empresa_control["handle"]
        filtrar_hwnd = filtrar_control["handle"]
        if not empresa_hwnd or not filtrar_hwnd:
            raise RuntimeError("nao foi possivel localizar os HWNDs do campo empresa e do botao Filtrar.")

        automation.log(
            f"iniciando teste: preencher empresa={EMPRESA_CODIGO} e clicar em Filtrar "
            f"por {args.repeticoes} vez(es) em modo estrito de segundo plano"
        )

        for rodada in range(1, args.repeticoes + 1):
            automation.log(f"rodada {rodada}/{args.repeticoes}")
            automation.enviar_texto_para_edit_hwnd(
                hwnd=empresa_hwnd,
                texto=EMPRESA_CODIGO,
                limpar=True,
            )
            time.sleep(args.intervalo)
            automation.clicar_controle_por_hwnd(filtrar_hwnd)
            automation.aguardar_janela_aguarde_sumir(timeout=30.0)
            time.sleep(args.intervalo)

        automation.log("teste finalizado")
        return 0
    except KeyboardInterrupt:
        automation.log("teste interrompido pelo usuario")
        return 130
    except Exception as exc:
        automation.log(f"erro no teste: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
