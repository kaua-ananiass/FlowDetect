from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SIDEBAR_PATH = ROOT / "flowdetect_sidebar.bmp"
HEADER_PATH = ROOT / "flowdetect_header.bmp"


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def draw_sidebar() -> None:
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
    font_title = load_font(24, bold=True)
    font_subtitle = load_font(13, bold=False)
    font_mark = load_font(40, bold=True)

    draw.rounded_rectangle((20, 22, 86, 88), radius=18, outline="#22C55E", width=2, fill="#0E1B2E")
    draw.text((37, 29), "FD", font=font_mark, fill="#E6F7FF")

    draw.text((20, 122), "FlowDetect", font=font_title, fill="#E6F7FF")
    draw.text((20, 154), "Automacao visual", font=font_subtitle, fill="#5EEAD4")
    draw.text((20, 174), "com reconhecimento", font=font_subtitle, fill="#12B5CB")

    draw.line((20, 214, 144, 214), fill="#1E3A52", width=1)
    draw.text((20, 230), "Setup Wizard", font=font_subtitle, fill="#9FDDE8")

    image.convert("RGB").save(SIDEBAR_PATH)


def draw_header() -> None:
    image = Image.new("RGB", (150, 57), "#0E1B2E")
    draw = ImageDraw.Draw(image)

    for x in range(image.width):
        ratio = x / max(image.width - 1, 1)
        r = int(14 + (7 - 14) * ratio)
        g = int(27 + (17 - 27) * ratio)
        b = int(46 + (31 - 46) * ratio)
        draw.line((x, 0, x, image.height), fill=(r, g, b))

    draw.rounded_rectangle((8, 8, 44, 48), radius=12, fill="#07111F", outline="#22C55E", width=1)
    font_logo = load_font(18, bold=True)
    font_title = load_font(18, bold=True)
    draw.text((14, 14), "FD", font=font_logo, fill="#E6F7FF")
    draw.text((54, 16), "FlowDetect", font=font_title, fill="#E6F7FF")
    image.save(HEADER_PATH)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    draw_sidebar()
    draw_header()
    print(f"Arquivos gerados:\n- {SIDEBAR_PATH}\n- {HEADER_PATH}")


if __name__ == "__main__":
    main()
