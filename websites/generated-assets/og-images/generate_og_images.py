#!/usr/bin/env python3
"""
Generate Open Graph images (1200x630) for the 9 Heady ecosystem domains.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = "/home/user/workspace/heady-production-fixes/websites/generated-assets/og-images"

# Font paths
FONT_REGULAR = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
FONT_BOLD    = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
FONT_LIGHT   = "/usr/share/fonts/truetype/noto/NotoSans-Light.ttf"
FONT_BLACK   = "/usr/share/fonts/truetype/noto/NotoSans-Black.ttf"

# Canvas
W, H = 1200, 630

# Base brand colors
BG_COLOR       = (10, 10, 15)        # #0a0a0f
ACCENT_BLUE    = (0, 212, 255)       # #00d4ff
ACCENT_PURPLE  = (139, 92, 246)      # #8b5cf6
TEXT_WHITE     = (255, 255, 255)
TEXT_DIM       = (180, 180, 200)
TEXT_MUTED     = (100, 100, 130)

# Per-domain configurations: (domain, tagline, subtitle, filename_stem, accent_a, accent_b)
DOMAINS = [
    {
        "domain":   "headyme.com",
        "tagline":  "Your Sovereign AI",
        "subtitle": "Personal Intelligence",
        "stem":     "og-headyme",
        "accent_a": (0, 212, 255),    # electric blue
        "accent_b": (139, 92, 246),   # purple
    },
    {
        "domain":   "heady-ai.com",
        "tagline":  "The AI Operating System",
        "subtitle": "Heady AI Platform",
        "stem":     "og-heady-ai",
        "accent_a": (0, 255, 200),    # cyan-green
        "accent_b": (0, 150, 255),    # blue
    },
    {
        "domain":   "headysystems.com",
        "tagline":  "The AI Operating System Company",
        "subtitle": "Corporate Hub",
        "stem":     "og-headysystems",
        "accent_a": (139, 92, 246),   # purple
        "accent_b": (200, 50, 255),   # violet
    },
    {
        "domain":   "headyconnection.org",
        "tagline":  "Community · Education · Accessibility",
        "subtitle": "Nonprofit Arm",
        "stem":     "og-headyconnection",
        "accent_a": (0, 230, 180),    # teal
        "accent_b": (0, 180, 255),    # sky blue
    },
    {
        "domain":   "headybuddy.org",
        "tagline":  "Your AI Companion — Everywhere",
        "subtitle": "AI Companion",
        "stem":     "og-headybuddy",
        "accent_a": (255, 150, 0),    # amber
        "accent_b": (255, 80, 150),   # pink
    },
    {
        "domain":   "headymcp.com",
        "tagline":  "Model Context Protocol Server",
        "subtitle": "MCP Tools",
        "stem":     "og-headymcp",
        "accent_a": (80, 200, 255),   # sky
        "accent_b": (80, 80, 255),    # indigo
    },
    {
        "domain":   "headyio.com",
        "tagline":  "Integration Hub — Connect Everything",
        "subtitle": "Service Integrations",
        "stem":     "og-headyio",
        "accent_a": (0, 255, 150),    # green
        "accent_b": (0, 200, 255),    # blue
    },
    {
        "domain":   "headybot.com",
        "tagline":  "Agent Marketplace",
        "subtitle": "Bot & Agent Marketplace",
        "stem":     "og-headybot",
        "accent_a": (255, 80, 180),   # magenta
        "accent_b": (139, 92, 246),   # purple
    },
    {
        "domain":   "headyapi.com",
        "tagline":  "API Reference & Developer Docs",
        "subtitle": "API Documentation",
        "stem":     "og-headyapi",
        "accent_a": (0, 255, 100),    # green
        "accent_b": (0, 212, 255),    # blue
    },
]


def lerp_color(c1, c2, t):
    """Linear interpolation between two RGB tuples."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def draw_gradient_background(img: Image.Image, bg: tuple, accent_a: tuple, accent_b: tuple):
    """Fill with dark bg + subtle radial glow using a separate RGBA overlay."""
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, H], fill=bg)

    # Radial gradient overlay — blended from center
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    cx, cy = W // 2, H // 2
    max_r = math.hypot(cx, cy)
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        r = int(max_r * t)
        # blend accent_a toward transparent near edges
        alpha = int(55 * (1 - t))
        color = lerp_color(accent_a, accent_b, 1 - t)
        od.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=(*color, alpha))

    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))


def draw_geometric_texture(draw: ImageDraw.Draw, accent_a: tuple, accent_b: tuple):
    """
    Draw a subtle sacred-geometry inspired hexagonal grid + concentric circles
    as a background texture.
    """
    # --- Concentric circles (faint) ---
    cx, cy = W // 2, H // 2
    for i in range(1, 9):
        r = i * 65
        alpha_val = max(8, 30 - i * 3)
        color = lerp_color(accent_a, accent_b, i / 9)
        # Draw as arc with low opacity via a temporary overlay
        # We'll use the draw object directly with low-alpha fill trick via ellipse outlines
        # Pillow doesn't support per-pixel alpha on draw, so we approximate with thin ellipses
        for offset in range(2):
            draw.ellipse(
                [cx - r - offset, cy - r - offset, cx + r + offset, cy + r + offset],
                outline=(*color, alpha_val), width=1
            )

    # --- Hexagonal grid (very faint) ---
    hex_size = 55   # radius of each hex
    hex_w = hex_size * 2
    hex_h = math.sqrt(3) * hex_size
    col_step = hex_w * 0.75
    row_step = hex_h

    cols = int(W / col_step) + 3
    rows = int(H / row_step) + 3

    for col in range(-1, cols):
        for row in range(-1, rows):
            hx = col * col_step
            hy = row * row_step + (hex_h / 2 if col % 2 else 0)
            # Draw hexagon outline
            pts = []
            for angle_deg in range(0, 360, 60):
                angle_rad = math.radians(angle_deg + 30)
                px = hx + hex_size * math.cos(angle_rad)
                py = hy + hex_size * math.sin(angle_rad)
                pts.append((px, py))
            t = (col + row) / (cols + rows)
            color = lerp_color(accent_a, accent_b, t % 1.0)
            draw.polygon(pts, outline=(*color, 12))


def draw_gradient_line(img: Image.Image, y: int, accent_a: tuple, accent_b: tuple,
                        thickness: int = 3, margin: int = 60):
    """Draw a horizontal gradient line across the image."""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(margin, W - margin):
        t = (x - margin) / (W - 2 * margin)
        color = lerp_color(accent_a, accent_b, t)
        od.line([(x, y), (x, y + thickness - 1)], fill=(*color, 220))
    base = img.convert("RGBA")
    img.paste(Image.alpha_composite(base, overlay).convert("RGB"))


def draw_H_logo(img: Image.Image, cx: int, cy: int, size: int,
                accent_a: tuple, accent_b: tuple):
    """
    Draw a stylized geometric 'H' mark built from rectangles,
    rendered with a left-to-right gradient.
    """
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    stroke = max(6, size // 5)
    # Left vertical bar
    od.rectangle(
        [cx - size // 2, cy - size // 2,
         cx - size // 2 + stroke, cy + size // 2],
        fill=(*accent_a, 255)
    )
    # Right vertical bar — accent_b
    od.rectangle(
        [cx + size // 2 - stroke, cy - size // 2,
         cx + size // 2, cy + size // 2],
        fill=(*accent_b, 255)
    )
    # Crossbar — gradient across
    cb_y1 = cy - stroke // 2
    cb_y2 = cy + stroke // 2
    for x in range(cx - size // 2 + stroke, cx + size // 2 - stroke):
        t = (x - (cx - size // 2 + stroke)) / max(1, (size - stroke * 2))
        color = lerp_color(accent_a, accent_b, t)
        od.line([(x, cb_y1), (x, cb_y2)], fill=(*color, 255))

    # Small decorative corner dots
    dot_r = max(3, stroke // 3)
    corners = [
        (cx - size // 2, cy - size // 2),
        (cx + size // 2, cy - size // 2),
        (cx - size // 2, cy + size // 2),
        (cx + size // 2, cy + size // 2),
    ]
    for i, (dx, dy) in enumerate(corners):
        t = i / 3
        color = lerp_color(accent_a, accent_b, t)
        od.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r],
                   fill=(*color, 200))

    base = img.convert("RGBA")
    img.paste(Image.alpha_composite(base, overlay).convert("RGB"))


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Simple word-wrapping."""
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def generate_og_image(cfg: dict):
    img = Image.new("RGB", (W, H), BG_COLOR)
    accent_a = cfg["accent_a"]
    accent_b = cfg["accent_b"]

    # 1 — Gradient background
    draw_gradient_background(img, BG_COLOR, accent_a, accent_b)

    # 2 — Geometric texture (RGBA-capable draw)
    overlay_tex = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tex_draw = ImageDraw.Draw(overlay_tex)
    draw_geometric_texture(tex_draw, accent_a, accent_b)
    img = Image.alpha_composite(img.convert("RGBA"), overlay_tex).convert("RGB")

    # Re-create draw after compositing
    draw = ImageDraw.Draw(img)

    # 3 — Decorative gradient line near top and bottom
    draw_gradient_line(img, 90, accent_a, accent_b, thickness=2, margin=60)
    draw_gradient_line(img, H - 90, accent_b, accent_a, thickness=2, margin=60)

    # 4 — H logo mark (top-center area, slightly left of center)
    draw_H_logo(img, W // 2, 160, 52, accent_a, accent_b)

    # 5 — Draw text elements
    draw = ImageDraw.Draw(img)

    # Load fonts
    try:
        font_domain   = ImageFont.truetype(FONT_BOLD,   26)
        font_tagline  = ImageFont.truetype(FONT_BLACK,  62)
        font_tagline2 = ImageFont.truetype(FONT_BLACK,  52)
        font_subtitle = ImageFont.truetype(FONT_LIGHT,  28)
        font_corp     = ImageFont.truetype(FONT_REGULAR, 22)
        font_tm       = ImageFont.truetype(FONT_REGULAR, 14)
    except Exception as e:
        print(f"Font load error: {e}")
        raise

    # -- Domain name (top-left) --
    domain_x, domain_y = 60, 48
    draw.text((domain_x, domain_y), cfg["domain"],
              font=font_domain, fill=TEXT_WHITE)

    # -- "Heady™" brand watermark next to domain --
    domain_bbox = font_domain.getbbox(cfg["domain"])
    domain_w = domain_bbox[2] - domain_bbox[0]
    # small "™" superscript after domain text is skipped; we add a separate brand pill

    # -- "HEADY™" top center micro tag --
    brand_tag = "HEADY™"
    bt_bbox = font_tm.getbbox(brand_tag)
    bt_w = bt_bbox[2] - bt_bbox[0]
    draw.text(((W - bt_w) // 2, 30), brand_tag,
              font=font_tm, fill=(*lerp_color(accent_a, accent_b, 0.5), 160))

    # -- Main tagline (centered, with wrapping if needed) --
    tagline = cfg["tagline"]
    max_tagline_w = W - 120

    # Try primary large size; fall back to smaller if too wide
    test_bbox = font_tagline.getbbox(tagline)
    if test_bbox[2] - test_bbox[0] > max_tagline_w:
        chosen_font = font_tagline2
    else:
        chosen_font = font_tagline

    lines = wrap_text(tagline, chosen_font, max_tagline_w)

    # Render tagline as gradient text via per-character RGBA overlay
    line_h_approx = chosen_font.getbbox("Ag")[3] + 10
    total_text_h = len(lines) * line_h_approx
    text_start_y = (H // 2) - (total_text_h // 2) + 20   # slightly below center

    tag_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tag_draw = ImageDraw.Draw(tag_overlay)

    for li, line in enumerate(lines):
        line_bbox = chosen_font.getbbox(line)
        line_w = line_bbox[2] - line_bbox[0]
        lx = (W - line_w) // 2
        ly = text_start_y + li * line_h_approx
        # Gradient per character
        char_x = lx
        for ch in line:
            ch_bbox = chosen_font.getbbox(ch)
            ch_w = max(1, ch_bbox[2] - ch_bbox[0])
            t = (char_x - lx) / max(1, line_w)
            color = lerp_color(accent_a, accent_b, t)
            tag_draw.text((char_x, ly), ch, font=chosen_font, fill=(*color, 255))
            char_x += ch_w

    img = Image.alpha_composite(img.convert("RGBA"), tag_overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # -- Subtitle below tagline --
    subtitle = cfg["subtitle"]
    sub_bbox = font_subtitle.getbbox(subtitle)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_y = text_start_y + len(lines) * line_h_approx + 18
    draw.text(((W - sub_w) // 2, sub_y), subtitle,
              font=font_subtitle, fill=TEXT_DIM)

    # -- "HeadySystems Inc." bottom-right --
    corp_text = "HeadySystems Inc."
    corp_bbox = font_corp.getbbox(corp_text)
    corp_w = corp_bbox[2] - corp_bbox[0]
    corp_x = W - corp_w - 60
    corp_y = H - 55
    draw.text((corp_x, corp_y), corp_text, font=font_corp, fill=TEXT_MUTED)

    # -- Thin bottom accent bar (full width) --
    bar_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar_overlay)
    for x in range(W):
        t = x / (W - 1)
        color = lerp_color(accent_a, accent_b, t)
        bd.line([(x, H - 5), (x, H - 1)], fill=(*color, 200))
    img = Image.alpha_composite(img.convert("RGBA"), bar_overlay).convert("RGB")

    # Save
    out_path = os.path.join(OUTPUT_DIR, cfg["stem"] + ".png")
    img.save(out_path, "PNG", optimize=False)
    print(f"  Saved: {out_path}  ({W}x{H})")
    return out_path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating {len(DOMAINS)} OG images → {OUTPUT_DIR}\n")
    generated = []
    for cfg in DOMAINS:
        print(f"→ {cfg['domain']} ({cfg['stem']})")
        path = generate_og_image(cfg)
        generated.append(path)
    print(f"\nDone! {len(generated)}/{len(DOMAINS)} images generated.")
    return generated


if __name__ == "__main__":
    main()
