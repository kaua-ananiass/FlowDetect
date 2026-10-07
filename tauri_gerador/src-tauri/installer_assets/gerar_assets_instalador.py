from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
ICON_PATH = ROOT.parent / "icons" / "icon.ico"
SIDEBAR_PATH = ROOT / "flowdetect_sidebar.bmp"
HEADER_PATH = ROOT / "flowdetect_header.bmp"
BRAND_CYAN = "#12B5CB"
BRAND_MINT = "#5EEAD4"
BRAND_BG = "#07111F"


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def paste_logo(image: Image.Image, x: int, y: int, size: int) -> None:
    """Use the same icon as the installed executable, never a hand-drawn substitute."""
    with Image.open(ICON_PATH) as source:
        logo = source.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, (x, y))


def draw_sidebar(filename: str, product: str, subtitle: str, role: str) -> None:
    sidebar_path = ROOT / filename
    image = Image.new("RGB", (164, 314), BRAND_BG)
    draw = ImageDraw.Draw(image)

    for y in range(image.height):
        ratio = y / max(image.height - 1, 1)
        r = int(6 + 5 * ratio)
        g = int(16 + 19 * ratio)
        b = int(31 + 28 * ratio)
        draw.line((0, y, image.width, y), fill=(r, g, b))

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-95, -65, 138, 157), fill=(18, 181, 203, 52))
    glow_draw.ellipse((36, 176, 210, 390), fill=(34, 197, 94, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 2, 313), fill=BRAND_CYAN)
    draw.line((18, 104, 145, 104), fill="#24566A", width=1)
    paste_logo(image, 17, 15, 78)

    name_lines = product.split(" ", 1)
    draw.text((18, 119), name_lines[0], font=load_font(19, bold=True), fill="#E6F7FF")
    draw.text((18, 145), name_lines[1] if len(name_lines) > 1 else "", font=load_font(22, bold=True), fill=BRAND_MINT)
    draw.text((18, 183), subtitle, font=load_font(11), fill="#B9D2E0")

    draw.line((18, 222, 145, 222), fill="#24566A", width=1)
    draw.rounded_rectangle((18, 239, 102, 260), radius=10, fill="#073447", outline=BRAND_CYAN, width=1)
    draw.text((27, 244), role.upper(), font=load_font(9, bold=True), fill=BRAND_MINT)
    draw.text((18, 280), "INSTALADOR", font=load_font(9, bold=True), fill="#8CB8C8")
    draw.line((18, 300, 76, 300), fill=BRAND_CYAN, width=2)

    image.convert("RGB").save(sidebar_path)


def draw_header(filename: str, product: str, role: str) -> None:
    header_path = ROOT / filename
    image = Image.new("RGB", (150, 57), BRAND_BG)
    draw = ImageDraw.Draw(image)

    for x in range(image.width):
        ratio = x / max(image.width - 1, 1)
        r = int(7 + 7 * ratio)
        g = int(18 + 14 * ratio)
        b = int(34 + 22 * ratio)
        draw.line((x, 0, x, image.height), fill=(r, g, b))

    image = image.convert("RGBA")
    paste_logo(image, 5, 6, 43)
    draw = ImageDraw.Draw(image)
    draw.text((52, 10), "FlowDetect", font=load_font(15, bold=True), fill="#E6F7FF")
    draw.text((53, 32), role.upper(), font=load_font(9, bold=True), fill=BRAND_MINT)
    draw.rectangle((147, 0, 149, 56), fill=BRAND_CYAN)
    image.convert("RGB").save(header_path)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    variants = [
        ("flowdetect_studio", "FlowDetect Studio", "Crie automacoes", "Studio"),
        ("flowdetect_agent", "FlowDetect Agent", "Execute no PC alvo", "Agent"),
        ("flowdetect", "FlowDetect", "Automacao visual", "Setup"),
    ]
    generated: list[Path] = []
    for prefix, product, subtitle, role in variants:
        draw_sidebar(f"{prefix}_sidebar.bmp", product, subtitle, role)
        draw_header(f"{prefix}_header.bmp", product, role)
        generated.extend([ROOT / f"{prefix}_sidebar.bmp", ROOT / f"{prefix}_header.bmp"])
    print("Arquivos gerados:")
    for path in generated:
        print(f"- {path}")


if __name__ == "__main__":
    main()
