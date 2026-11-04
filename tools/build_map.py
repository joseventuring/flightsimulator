#!/usr/bin/env python3
"""Build a real-terrain map for JG RoveaRange from public elevation data.

Elevation: AWS Terrain Tiles (Terrarium encoding; SRTM / NASADEM / Copernicus sources, public domain or open licences),
sampled onto a square grid centred on the flying site, metres relative to the strip, north up (-z in the game).
Water: reservoir surfaces are flat in the source data, so a water body is grown from a seed point across cells within
a metre of its level. The strip is put on the flattest open ground near the requested point, the way real RC fields
sit on harvested paddy or level farmland.

Usage: python3 tools/build_map.py <id> <lat> <lon> [--search 1500] [--water lat,lon ...]
Writes src/maps/<id>.js with the heightmap as base64 Int16 (decimetres) and a bit-packed water mask.
"""
import sys, math, io, json, base64, pathlib, argparse, urllib.request
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path('/tmp/claude-0/-home-claude/17455d3b-ea3b-56c7-95e7-ac4d8cefe543/scratchpad/tiles')
Z = 13
SIZE = 8000.0   # metres, square
N = 200         # grid points per side (40 m spacing)

def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def fetch(z, x, y):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f'{z}_{x}_{y}.png'
    if not f.exists():
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
        f.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

class DEM:
    def __init__(self):
        self.tiles = {}
    def h(self, lat, lon):
        fx, fy = tile_xy(lat, lon, Z)
        tx, ty = int(fx), int(fy)
        key = (tx, ty)
        if key not in self.tiles:
            self.tiles[key] = fetch(Z, tx, ty)
        t = self.tiles[key]
        px, py = (fx - tx) * 256 - 0.5, (fy - ty) * 256 - 0.5
        x0, y0 = int(math.floor(px)), int(math.floor(py))
        x0 = min(max(x0, 0), 254); y0 = min(max(y0, 0), 254)
        u, v = min(max(px - x0, 0), 1), min(max(py - y0, 0), 1)
        return (t[y0, x0] * (1 - u) * (1 - v) + t[y0, x0 + 1] * u * (1 - v) + t[y0 + 1, x0] * (1 - u) * v + t[y0 + 1, x0 + 1] * u * v)

def to_latlon(lat0, lon0, x, z):
    """game metres (x east, z south) to lat/lon"""
    lat = lat0 - z / 111320.0
    lon = lon0 + x / (111320.0 * math.cos(math.radians(lat0)))
    return lat, lon

def grid(dem, lat0, lon0, size, n):
    xs = np.linspace(-size / 2, size / 2, n)
    H = np.zeros((n, n))
    for j, z in enumerate(xs):
        for i, x in enumerate(xs):
            H[j, i] = dem.h(*to_latlon(lat0, lon0, x, z))
    return H

def flattest(dem, lat, lon, search, minelev=-1e9):
    """best strip site within `search` m: lowest height spread over a 360 x 160 m box (strip plus field)"""
    best = None
    step = 80
    for dz in np.arange(-search, search + 1, step):
        for dx in np.arange(-search, search + 1, step):
            la, lo = to_latlon(lat, lon, dx, dz)
            pts = [dem.h(*to_latlon(la, lo, x, z)) for z in (-260, -150, -40, 70) for x in (-80, 0, 80)]
            spread = max(pts) - min(pts)
            if spread < 0.6:   # dead flat in the source data means a water surface, not a field
                continue
            if dem.h(la, lo) < minelev:   # keep the field above reservoir full-tank level
                continue
            score = spread + 0.0015 * math.hypot(dx, dz)   # prefer near the requested point
            if best is None or score < best[0]:
                best = (score, la, lo, spread)
    return best

def water_mask(H, seeds_ij):
    """water = the connected, dead-flat patch around each seed (a reservoir surface in the source data), plus a one-cell rim"""
    from numpy.lib.stride_tricks import sliding_window_view as sw
    n = H.shape[0]
    pad = np.pad(H, 2, mode='edge')
    flat = sw(pad, (5, 5)).std(axis=(-1, -2)) < 0.35
    M = np.zeros_like(H, dtype=bool)
    levels = []
    for (si, sj) in seeds_ij:
        if not (0 <= si < n and 0 <= sj < n):
            continue
        # walk to the nearest flat cell if the seed sits on the shore
        if not flat[sj, si]:
            best = None
            for dj in range(-6, 7):
                for di in range(-6, 7):
                    i, j = si + di, sj + dj
                    if 0 <= i < n and 0 <= j < n and flat[j, i] and (best is None or di * di + dj * dj < best[0]):
                        best = (di * di + dj * dj, i, j)
            if not best:
                continue
            si, sj = best[1], best[2]
        R = np.zeros_like(M)
        stack = [(si, sj)]
        while stack:
            i, j = stack.pop()
            if i < 0 or j < 0 or i >= n or j >= n or R[j, i] or not flat[j, i]:
                continue
            R[j, i] = True
            stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
        if R.sum() < 40:   # too small to be a lake: a flat field, not water
            continue
        lvl = float(np.median(H[R]))
        rim = R.copy(); rim[1:, :] |= R[:-1, :]; rim[:-1, :] |= R[1:, :]; rim[:, 1:] |= R[:, :-1]; rim[:, :-1] |= R[:, 1:]
        rim &= np.abs(H - lvl) < 2.5
        M |= rim
        levels.append(round(lvl, 2))
    return M, levels

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('id'); ap.add_argument('lat', type=float); ap.add_argument('lon', type=float)
    ap.add_argument('--search', type=float, default=1500)
    ap.add_argument('--water', nargs='*', default=[])
    ap.add_argument('--name', default='')
    ap.add_argument('--size', type=float, default=8000)
    ap.add_argument('--minelev', type=float, default=-1e9)
    ap.add_argument('--n', type=int, default=200)
    a = ap.parse_args()
    global SIZE, N
    SIZE, N = a.size, a.n
    dem = DEM()
    score, lat0, lon0, spread = flattest(dem, a.lat, a.lon, a.search, a.minelev)
    elev0 = dem.h(lat0, lon0)
    H = grid(dem, lat0, lon0, SIZE, N) - elev0
    seeds = []
    for w in a.water:
        la, lo = map(float, w.split(','))
        x = (lo - lon0) * 111320.0 * math.cos(math.radians(lat0)); z = (lat0 - la) * 111320.0
        seeds.append((int(round((x + SIZE / 2) / SIZE * (N - 1))), int(round((z + SIZE / 2) / SIZE * (N - 1)))))
    M, levels = water_mask(H, seeds)
    h16 = np.clip(np.round(H * 10), -32768, 32767).astype('<i2')
    bits = np.packbits(M.flatten().astype(np.uint8))
    out = {
        'id': a.id, 'name': a.name, 'lat': round(lat0, 5), 'lon': round(lon0, 5), 'elev': round(float(elev0), 1),
        'size': SIZE, 'n': N, 'stripSpread': round(float(spread), 2), 'water': [round(l, 2) for l in levels],
        'waterCells': int(M.sum()), 'relief': [round(float(H.min()), 1), round(float(H.max()), 1)],
    }
    js = ('/* generated by tools/build_map.py from AWS Terrain Tiles (SRTM/NASADEM/Copernicus, open data); do not edit */\n'
          f'MAP_DATA[{json.dumps(a.id)}]=Object.assign({json.dumps(out)},'
          f'{{h:"{base64.b64encode(h16.tobytes()).decode()}",w:"{base64.b64encode(bits.tobytes()).decode()}"}});\n')
    (ROOT / 'src' / 'maps').mkdir(exist_ok=True)
    (ROOT / 'src' / 'maps' / f'{a.id}.js').write_text(js)
    print(json.dumps(out), 'bytes', len(js))

if __name__ == '__main__':
    main()
