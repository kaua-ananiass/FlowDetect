import argparse
import sys
import time

from automacao_alterdata_background import AlterdataBackgroundAutomation


SAFE_SEQUENCE = [
    "Referência",
    "Pagamento",
    "ISS Tomador",
    "Faturamento e Deduções",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Teste simples de cliques em segundo plano no Alterdata."
    )
    parser.add_argument(
        "--ciclos",
        type=int,
        default=20,
        help="Quantidade de ciclos da sequencia de cliques.",
    )
    parser.add_argument(
        "--intervalo",
        type=float,
        default=1.5,
        help="Segundos entre um clique e outro.",
    )
    parser.add_argument(
        "--com-filtrar",
        action="store_true",
        help="Inclui o botao Filtrar ao final de cada ciclo.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    automation = AlterdataBackgroundAutomation()

    try:
        automation.localizar_janela_alvo()
        sequence = list(SAFE_SEQUENCE)
        if args.com_filtrar:
            sequence.append("Filtrar")

        automation.log(
            f"iniciando sequencia simples: ciclos={args.ciclos} intervalo={args.intervalo}s "
            f"botoes={sequence}"
        )

        for ciclo in range(1, args.ciclos + 1):
            automation.log(f"ciclo {ciclo}/{args.ciclos}")
            for button_name in sequence:
                automation.clicar_botao_por_nome(nome=button_name)
                if button_name == "Filtrar":
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
