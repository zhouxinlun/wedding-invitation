"""Rebuild the self-contained title font from the official Noto Serif SC TTF.

Requires fonttools. Usage: python build-title-font.py /path/to/NotoSerifSC.ttf
Only the listed display headings use this font; body text keeps system fonts.
"""
import base64
import io
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
TEXT = '良辰之约良辰美景，邀你共赴。这一天，想与你分享。往后余生，都是我们。心动，有迹可循。良辰，一刻一刻。有你在，才圆满。一眼千年让美好，稍等片刻。带着祝福来，就很好。'
font = TTFont(sys.argv[1])
missing = set(TEXT) - {chr(c) for c in font.getBestCmap()}
if missing:
    raise ValueError('Missing title glyphs: ' + ''.join(sorted(missing)))
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=TEXT)
subsetter.subset(font)
font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
# Give this modified subset its own family name.
for name_id, text in [(1, 'Wedding Display'), (2, 'Regular'), (4, 'Wedding Display Regular'), (6, 'WeddingDisplay-Regular'), (16, 'Wedding Display'), (17, 'Regular')]:
    font['name'].setName(text, name_id, 3, 1, 0x409)
font.flavor = 'woff'
buffer = io.BytesIO()
font.save(buffer)
encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
css = '/* Generated title subset. Noto Serif SC, SIL OFL 1.1; see THIRD-PARTY-NOTICES.txt. */\n'
css += '@font-face{font-family:"Wedding Display";font-style:normal;font-weight:400;font-display:swap;src:url("data:font/woff;base64,' + encoded + '") format("woff")}\n'
(ROOT / 'miniprogram/shared/title-font.wxss').write_text(css)
(ROOT / 'web/title-font.css').write_text(css)
print(f'Title subset: {len(set(TEXT))} characters, {len(buffer.getvalue())} bytes; CSS {len(css)} bytes')
