import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_feature_graphic():
    WIDTH, HEIGHT = 1024, 500
    
    # 1. Base image with gradient
    base = Image.new('RGB', (WIDTH, HEIGHT), (10, 16, 32))
    
    # Create radial gradient glow overlay
    glow = Image.new('RGB', (WIDTH, HEIGHT), (10, 16, 32))
    glow_draw = ImageDraw.Draw(glow)
    
    # Draw soft color circles for depth
    glow_draw.ellipse([50, -50, 650, 550], fill=(24, 58, 140))
    glow_draw.ellipse([600, 100, 1100, 600], fill=(16, 85, 180))
    glow_draw.ellipse([200, 150, 550, 450], fill=(37, 99, 235))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    
    # Blend base and glow
    img = Image.blend(base, glow, 0.85)
    draw = ImageDraw.Draw(img)
    
    # Subtle decorative stars/sparkles
    sparkle_coords = [
        (80, 80, 3), (180, 420, 2), (920, 70, 3), (960, 380, 2),
        (540, 60, 2), (480, 440, 2), (850, 220, 3), (120, 260, 2)
    ]
    for sx, sy, sr in sparkle_coords:
        draw.ellipse([sx-sr, sy-sr, sx+sr, sy+sr], fill=(255, 255, 255, 180))
        # Draw 4-point cross for larger sparkles
        if sr >= 3:
            draw.line([sx-sr*3, sy, sx+sr*3, sy], fill=(255, 255, 255, 120), width=1)
            draw.line([sx, sy-sr*3, sx, sy+sr*3], fill=(255, 255, 255, 120), width=1)

    # 2. Left side: App Icon with Rounded Card & Soft Shadow
    icon_size = 230
    icon_x = 100
    icon_y = (HEIGHT - icon_size) // 2

    # Shadow for icon
    shadow_pad = 20
    shadow = Image.new('RGBA', (icon_size + shadow_pad*2, icon_size + shadow_pad*2), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle(
        [shadow_pad, shadow_pad + 8, icon_size + shadow_pad, icon_size + shadow_pad + 8],
        radius=48,
        fill=(0, 0, 0, 110)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    img.paste(shadow, (icon_x - shadow_pad, icon_y - shadow_pad), shadow)

    # Load and process icon
    icon_path = 'assets/icon.png'
    if os.path.exists(icon_path):
        raw_icon = Image.open(icon_path).convert('RGBA')
        resized_icon = raw_icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        
        # Rounded mask for icon
        mask = Image.new('L', (icon_size, icon_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, icon_size, icon_size], radius=48, fill=255)
        
        # Border stroke around icon
        border = Image.new('RGBA', (icon_size, icon_size), (0, 0, 0, 0))
        b_draw = ImageDraw.Draw(border)
        b_draw.rounded_rectangle([0, 0, icon_size - 1, icon_size - 1], radius=48, outline=(255, 255, 255, 160), width=3)
        
        img.paste(resized_icon, (icon_x, icon_y), mask)
        img.paste(border, (icon_x, icon_y), border)

    # 3. Right side: Typography & Badges
    font_bold = 'C:/Windows/Fonts/segoeuib.ttf'
    font_reg = 'C:/Windows/Fonts/segoeui.ttf'
    font_semi = 'C:/Windows/Fonts/seguisb.ttf' if os.path.exists('C:/Windows/Fonts/seguisb.ttf') else font_reg

    title_font = ImageFont.truetype(font_bold, 60)
    tagline_font = ImageFont.truetype(font_semi, 23)
    badge_font = ImageFont.truetype(font_bold, 15)

    text_x = 385
    text_y = 125

    # App Title with subtle glow/shadow
    draw.text((text_x + 2, text_y + 2), "Gift List App", font=title_font, fill=(5, 12, 30))
    draw.text((text_x, text_y), "Gift List App", font=title_font, fill=(255, 255, 255))

    # Subtitle / Tagline
    sub_y = text_y + 82
    draw.text((text_x, sub_y), "Wishlists & Gift Sharing Made Simple", font=tagline_font, fill=(165, 204, 255))

    # Second Tagline description line
    desc_y = sub_y + 36
    desc_font = ImageFont.truetype(font_reg, 17)
    draw.text((text_x, desc_y), "Never get duplicate gifts again • Coordinate secretly with family & friends", font=desc_font, fill=(203, 213, 225))

    # 4. Feature Badges (3 modern pills)
    badges = [
        "🎁  Smart Wishlists",
        "🔒  Secret Claims",
        "⚡  Live Sync"
    ]
    badge_y = desc_y + 58
    curr_bx = text_x
    
    badge_overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    bo_draw = ImageDraw.Draw(badge_overlay)

    for badge_text in badges:
        # Measure badge width
        bbox = bo_draw.textbbox((0, 0), badge_text, font=badge_font)
        bw = (bbox[2] - bbox[0]) + 30
        bh = 38
        
        # Pill container (translucent dark with subtle cyan/blue border)
        bo_draw.rounded_rectangle(
            [curr_bx, badge_y, curr_bx + bw, badge_y + bh],
            radius=19,
            fill=(255, 255, 255, 28),
            outline=(255, 255, 255, 90),
            width=1
        )
        bo_draw.text((curr_bx + 15, badge_y + 9), badge_text, font=badge_font, fill=(255, 255, 255, 240))
        curr_bx += bw + 14

    img.paste(badge_overlay, (0, 0), badge_overlay)

    # 5. Save as 24-bit PNG (No alpha channel, exactly 1024x500)
    output_path = 'assets/playstore-feature-graphic-1024x500.png'
    img.save(output_path, 'PNG', optimize=True)
    print(f"Generated {output_path}: {img.size}, mode: {img.mode}, file size: {os.path.getsize(output_path)} bytes")

create_feature_graphic()
