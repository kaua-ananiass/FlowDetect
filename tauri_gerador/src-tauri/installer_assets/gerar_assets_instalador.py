from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SIDEBAR_PATH = ROOT / "flowdetect_sidebar.bmp"
HEADER_PATH = ROOT / "flowdetect_header.bmp"
BRAND_CYAN = "#12B5CB"
BRAND_MINT = "#5EEAD4"
BRAND_GREEN = "#22C55E"
BRAND_BG = "#07111F"
BRAND_CARD = "#0E1B2E"


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def draw_badge(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, *, active: bool = True) -> None:
    fill = "#073447" if active else "#142236"
    outline = BRAND_CYAN if active else "#24455F"
    draw.rounded_rectangle(box, radius=9, outline=outline, width=1, fill=fill)
    font = load_font(9, bold=True)
    draw.text((box[0] + 8, box[1] + 5), label.upper(), font=font, fill=BRAND_MINT if active else "#BFD7E5")


def draw_fd_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    radius = max(10, size // 5)
    draw.rounded_rectangle((x, y, x + size, y + size), radius=radius, outline=BRAND_CYAN, width=3, fill="#061426")
    font_mark = load_font(max(18, size // 2), bold=True)
    mark = "FD"
    bbox = draw.textbbox((0, 0), mark, font=font_mark)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        (x + (size - text_w) / 2, y + (size - text_h) / 2 - 2),
        mark,
        font=font_mark,
        fill=BRAND_MINT,
    )
    draw.rounded_rectangle(
        (x + size - 20, y + size - 20, x + size + 4, y + size + 4),
        radius=12,
        outline=BRAND_GREEN,
        width=3,
        fill="#062117",
    )


def draw_sidebar(filename: str, product: str, subtitle: str, role: str) -> None:
    sidebar_path = ROOT / filename
    image = Image.new("RGB", (164, 314), "#07111F")
    draw = ImageDraw.Draw(image)

    for y in range(image.height):
        ratio = y / max(image.height - 1, 1)
        r = int(7 + (14 - 7) * ratio)
        g = int(17 + (27 - 17) * ratio)
        b = int(31 + (46 - 31) * ratio)
        draw.line((0, y, image.width, y), fill=(r, g, b))

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-28, 18, 170, 210), fill=(18, 181, 203, 72))
    glow_draw.ellipse((12, 168, 158, 318), fill=(94, 234, 212, 56))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw = ImageDraw.Draw(image)
    font_title = load_font(22, bold=True)
    font_subtitle = load_font(12, bold=False)

    draw_fd_icon(draw, 20, 20, 70)

    name_lines = product.split(" ", 1)
    draw.text((20, 118), name_lines[0], font=font_title, fill=BRAND_CYAN)
    draw.text((20, 145), name_lines[1] if len(name_lines) > 1 else "", font=font_title, fill="#E6F7FF")
    draw.text((20, 180), subtitle, font=font_subtitle, fill=BRAND_MINT)

    draw.line((20, 214, 144, 214), fill="#1E3A52", width=1)
    draw_badge(draw, (20, 232, 126, 252), role)
    draw.text((20, 272), "Instalador", font=font_subtitle, fill="#9FDDE8")

    image.convert("RGB").save(sidebar_path)


def draw_header(filename: str, product: str, role: str) -> None:
    header_path = ROOT / filename
    image = Image.new("RGB", (150, 57), "#0E1B2E")
    draw = ImageDraw.Draw(image)

    for x in range(image.width):
        ratio = x / max(image.width - 1, 1)
        r = int(14 + (7 - 14) * ratio)
        g = int(27 + (17 - 27) * ratio)
        b = int(46 + (31 - 46) * ratio)
        draw.line((x, 0, x, image.height), fill=(r, g, b))

    draw_fd_icon(draw, 7, 8, 39)
    font_title = load_font(16, bold=True)
    font_role = load_font(9, bold=True)
    draw.text((53, 10), "FlowDetect", font=font_title, fill="#E6F7FF")
    draw.text((54, 32), role.upper(), font=font_role, fill=BRAND_MINT)
    image.save(header_path)


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
