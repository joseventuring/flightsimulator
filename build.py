#!/usr/bin/env python3
"""Build app.html (artifact page) and index.html (standalone/Electron/Pages) from app.template.html + sim.js."""
import re, pathlib
root = pathlib.Path(__file__).parent
tpl = (root / 'app.template.html').read_text()
sim = (root / 'sim.js').read_text()
sim_core = re.search(r'/\*SIM-BEGIN\*/(.*?)/\*SIM-END\*/', sim, re.S).group(1)
sim_core = sim_core.replace("(typeof THREE!=='undefined'?THREE:require('three'))", "(THREE)")
sim_core = re.sub(r"\(typeof THREE!=='undefined'\?THREE:require\('[^']*'\)\)", "(THREE)", sim_core)
app = tpl.replace('/*__SIM__*/', sim_core)
maps_js = 'const MAP_DATA={};\n' + ''.join(f.read_text() for f in sorted((root / 'src' / 'maps').glob('*.js'))) + (root / 'src' / 'maps.js').read_text()
app = app.replace('/*__MAPS__*/', maps_js)
for name in ['scene','aircraft','mesh','fx','world','audio','hud','input','txsetup','pursuit','multi','flow']:
    f = root / 'src' / (name + '.js')
    if f.exists():
        app = app.replace('/*__' + name.upper() + '__*/', f.read_text())
assert '—' not in app and '–' not in app, 'dash found'
(root / 'app.html').write_text(app)
page = app.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
head, rest = page.split('<style>', 1)
style, body = rest.split('</style>', 1)
index = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
         '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#1B222B">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<link rel="apple-touch-icon" href="icon-512.png">\n'
         + head + '<style>' + style + '</style>\n</head>\n<body>' + body + '\n</body>\n</html>\n')
(root / 'index.html').write_text(index)
print('built app.html', len(app), 'bytes; index.html', len(index), 'bytes')
