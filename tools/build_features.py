#!/usr/bin/env python3
"""Real ground features for a JG RoveaRange map: buildings, roads, rivers and canals, ponds, land cover.

Sources (all open data, free for commercial use with attribution):
  Overture Maps Foundation, release 2026-10-21.0 (ODbL / CDLA): buildings (OpenStreetMap, Microsoft and Google
    Open Buildings footprints), transportation segments and water, which come from OpenStreetMap.
  ESA WorldCover 2021 v200, 10 m land cover (CC BY 4.0).
Credit line: (c) OpenStreetMap contributors, Overture Maps Foundation, ESA WorldCover 2021.

Usage: python3 tools/build_features.py <map.js> [--out path] [--bld-radius 3500] [--home lat,lon]
Writes MAP_FEAT[id] = {...} next to the map (src/maps/<id>_feat.js by default). Everything is packed into small
binary arrays (base64) so the single-file game stays light:
  b   buildings, 10 bytes each: x, z int16 (0.5 m), w, l uint8 (0.5 m), angle uint8, height uint8 (0.5 m), kind, roof
  r   roads, polylines: class uint8, count uint16, then int16 x, z pairs (0.5 m)
  wl  water lines (rivers, canals, streams, drains), same packing as roads
  wp  water polygons (ponds, lakes, river areas), exterior rings, same packing
  lc  land cover grid, run-length coded rows of class codes
"""
import sys, os, math, json, re, base64, struct, argparse, pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path('/tmp/claude-0/-home-claude/17455d3b-ea3b-56c7-95e7-ac4d8cefe543/scratchpad/ov')
OVERTURE = 's3://overturemaps-us-west-2/release/2026-10-21.0/'

ROAD = {'motorway': 1, 'trunk': 2, 'primary': 3, 'secondary': 4, 'tertiary': 5, 'residential': 6, 'unclassified': 6,
        'living_street': 6, 'unknown': 6, 'service': 7, 'track': 8}
WLINE = {'river': 1, 'canal': 2, 'stream': 3, 'drain': 4, 'ditch': 4}
WPOLY = {'lake': 1, 'reservoir': 1, 'pond': 2, 'river': 3, 'water': 2, 'canal': 3, 'basin': 2, 'swimming_pool': 4}
BKIND = {'house': 1, 'residential': 1, 'detached': 1, 'apartments': 5, 'school': 2, 'college': 2, 'university': 2, 'hospital': 2,
         'church': 4, 'mosque': 4, 'temple': 4, 'religious': 4, 'commercial': 3, 'retail': 3, 'industrial': 3, 'factory': 3,
         'warehouse': 3, 'office': 3}
# ESA WorldCover classes to game codes: 1 trees, 2 shrub, 3 grass, 4 crop, 5 built-up, 6 bare, 8 water, 9 wetland, 10 mangrove
WC = {10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 60: 6, 70: 6, 80: 8, 90: 9, 95: 10, 100: 3}


def read_map(path):
    t = pathlib.Path(path).read_text()
    m = re.search(r'MAP_DATA\[("[^"]+")\]=Object\.assign\((\{.*?\}),\{h:', t, re.S)
    return json.loads(m.group(1)), json.loads(m.group(2))


class Proj:
    def __init__(self, lat0, lon0):
        self.lat0, self.lon0, self.k = lat0, lon0, 111320.0 * math.cos(math.radians(lat0))
    def xz(self, lon, lat):
        return ((lon - self.lon0) * self.k, (self.lat0 - lat) * 111320.0)
    def bbox(self, half):
        return (self.lon0 - half / self.k, self.lon0 + half / self.k, self.lat0 - half / 111320.0, self.lat0 + half / 111320.0)


def duck():
    import duckdb
    for k in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'):
        os.environ.pop(k, None)
    c = duckdb.connect()
    c.execute("INSTALL spatial; LOAD spatial; LOAD httpfs; CREATE SECRET (TYPE s3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2');")
    return c


def overture(c, theme, typ, cols, bb, tag):
    """rows of (cols..., wkb) for features whose bbox overlaps bb; cached per map so reruns are instant"""
    import pickle
    f = CACHE / f'{tag}_{theme}_{typ}.pkl'
    if f.exists():
        return pickle.loads(f.read_bytes())
    w = f'bbox.xmax>{bb[0]} AND bbox.xmin<{bb[1]} AND bbox.ymax>{bb[2]} AND bbox.ymin<{bb[3]}'
    q = f"SELECT {cols}, ST_AsWKB(geometry) FROM read_parquet('{OVERTURE}theme={theme}/type={typ}/*', hive_partitioning=1) WHERE {w}"
    rows = [tuple(r[:-1]) + (bytes(r[-1]),) for r in c.execute(q).fetchall()]
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_bytes(pickle.dumps(rows))
    return rows


def q05(v):
    return int(max(-32767, min(32767, round(v * 2))))


def pack_lines(items):
    """items: list of (class, [(x, z), ...]) in metres"""
    out = bytearray()
    for cls, pts in items:
        pts = pts[:65535]
        out += struct.pack('<BH', cls, len(pts))
        for x, z in pts:
            out += struct.pack('<hh', q05(x), q05(z))
    return base64.b64encode(bytes(out)).decode()


def geoms_xz(g, P, clipbox, tol):
    """shapely geometry in lon/lat to a list of simplified local-metre shapely parts, clipped to the map square"""
    import shapely
    from shapely.geometry import box
    gx = shapely.transform(g, lambda a: np.c_[(a[:, 0] - P.lon0) * P.k, (P.lat0 - a[:, 1]) * 111320.0])
    gx = gx.intersection(clipbox)
    if gx.is_empty:
        return []
    gx = gx.simplify(tol, preserve_topology=True)
    return list(gx.geoms) if hasattr(gx, 'geoms') else [gx]


def landcover(P, size, g):
    """ESA WorldCover 10 m, resampled by majority vote onto a g x g grid over the map (north up, row 0 = north)"""
    import rasterio
    from rasterio.windows import from_bounds
    half = size / 2
    lon0, lon1, lat0, lat1 = P.bbox(half)
    tiles = {}
    for la in range(int(math.floor(lat0 / 3) * 3), int(math.floor(lat1 / 3) * 3) + 1, 3):
        for lo in range(int(math.floor(lon0 / 3) * 3), int(math.floor(lon1 / 3) * 3) + 1, 3):
            tiles[(la, lo)] = f"/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}_Map.tif"
    # sample at 4 x 4 sub-points per grid cell, then take the most common class
    sub = 4
    m = g * sub
    xs = (np.arange(m) + 0.5) / m * size - half
    X, Z = np.meshgrid(xs, xs)
    LON = P.lon0 + X / P.k
    LAT = P.lat0 - Z / 111320.0
    cls = np.zeros((m, m), dtype=np.uint8)
    for (la, lo), url in tiles.items():
        sel = (LAT >= la) & (LAT < la + 3) & (LON >= lo) & (LON < lo + 3)
        if not sel.any():
            continue
        with rasterio.open(url) as src:
            win = from_bounds(LON[sel].min() - 0.001, LAT[sel].min() - 0.001, LON[sel].max() + 0.001, LAT[sel].max() + 0.001, src.transform)
            win = win.round_offsets().round_lengths()
            a = src.read(1, window=win)
            T = src.window_transform(win)
            col = ((LON[sel] - T.c) / T.a).astype(int).clip(0, a.shape[1] - 1)
            row = ((LAT[sel] - T.f) / T.e).astype(int).clip(0, a.shape[0] - 1)
            cls[sel] = a[row, col]
    lut = np.zeros(256, dtype=np.uint8)
    for k, v in WC.items():
        lut[k] = v
    c = lut[cls].reshape(g, sub, g, sub).transpose(0, 2, 1, 3).reshape(g, g, sub * sub)
    out = np.zeros((g, g), dtype=np.uint8)
    for k in range(11):
        cnt = (c == k).sum(axis=2)
        if k == 0:
            best = cnt; continue
        better = cnt > best
        out[better] = k; best = np.maximum(best, cnt)
    return out


def site_checker(lat, lon, half, tag):
    """clearance test for a candidate field centred at (lat, lon): the 150 x 210 m field must hold no real building,
    road or water (with a small buffer), and land cover inside it adds a penalty (trees, buildings, water)"""
    import shapely
    from shapely import wkb, STRtree
    from shapely.geometry import box
    P = Proj(lat, lon)
    c = duck()
    bb = P.bbox(half + 300)
    to_xz = lambda g: shapely.transform(g, lambda a: np.c_[(a[:, 0] - P.lon0) * P.k, (P.lat0 - a[:, 1]) * 111320.0])
    geoms = []
    for row in overture(c, 'buildings', 'building', "coalesce(class,'')", bb, tag + '_b'):
        geoms.append(to_xz(wkb.loads(row[-1])).buffer(6))
    for sub, cls, g in overture(c, 'transportation', 'segment', "subtype, coalesce(class,'')", bb, tag + '_t'):
        if sub == 'road' or sub == 'rail':
            geoms.append(to_xz(wkb.loads(g)).buffer(5))
    for sub, cls, g in overture(c, 'base', 'water', "subtype, coalesce(class,'')", bb, tag + '_w'):
        if cls != 'swimming_pool':
            geoms.append(to_xz(wkb.loads(g)).buffer(4))
    tree = STRtree(geoms)
    size = 2 * half + 600
    G = int(size / 20)
    lc = landcover(P, size, G)
    def check(la, lo):
        x0, z0 = P.xz(lo, la)
        fb = box(x0 - 75, z0 - 130, x0 + 75, z0 + 80)
        if len(tree.query(fb, predicate='intersects')):
            return False, 0
        i0, i1 = int((x0 - 75 + size / 2) / 20), int((x0 + 75 + size / 2) / 20)
        j0, j1 = int((z0 - 130 + size / 2) / 20), int((z0 + 80 + size / 2) / 20)
        w = lc[max(0, j0):j1 + 1, max(0, i0):i1 + 1]
        f = lambda k: float((w == k).mean()) if w.size else 0
        return True, 0.8 * f(1) + 2.0 * f(5) + 1.5 * (f(8) + f(9)) + 0.3 * f(2)
    print(f'site checker: {len(geoms)} obstacles, land cover {G}x{G}', file=sys.stderr)
    return check


def lake_mask(lat0, lon0, size, n, H, tag, min_area=20000):
    """grid mask and levels for the real lakes and reservoirs (Overture water polygons over 2 ha); the level is the median
    elevation-model height inside, since reservoir surfaces are flat in the source data"""
    import shapely
    from shapely import wkb
    P = Proj(lat0, lon0)
    c = duck()
    xs = np.linspace(-size / 2, size / 2, n)
    X, Z = np.meshgrid(xs, xs)
    M = np.zeros((n, n), dtype=bool); levels = []
    for sub, cls, g in overture(c, 'base', 'water', "subtype, coalesce(class,'')", P.bbox(size / 2), tag + '_lakes'):
        geo = wkb.loads(g)
        if geo.geom_type not in ('Polygon', 'MultiPolygon') or cls == 'swimming_pool':
            continue
        gx = shapely.transform(geo, lambda a: np.c_[(a[:, 0] - P.lon0) * P.k, (P.lat0 - a[:, 1]) * 111320.0])
        if gx.area < min_area:
            continue
        inside = shapely.contains_xy(gx, X, Z)
        if inside.sum() < 3:
            continue
        lvl = float(np.median(H[inside]))
        M |= inside; levels.append(round(lvl, 2))
    return M, sorted(set(levels))


def rle(grid):
    out = bytearray()
    for row in grid:
        v, n = int(row[0]), 0
        for x in row:
            x = int(x)
            if x == v and n < 255:
                n += 1
            else:
                out += bytes((v, n)); v, n = x, 1
        out += bytes((v, n))
    return base64.b64encode(bytes(out)).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('map')
    ap.add_argument('--out')
    ap.add_argument('--bld-radius', type=float, default=3500)
    ap.add_argument('--minor-radius', type=float, default=5000)
    ap.add_argument('--lc', type=int, default=0, help='land cover grid size (default: about 20 m cells, at most 512)')
    a = ap.parse_args()
    from shapely import wkb
    from shapely.geometry import box, Point
    mid, M = read_map(a.map)
    P = Proj(M['lat'], M['lon'])
    size = M['size']; half = size / 2
    clip = box(-half, -half, half, half)
    bb = P.bbox(half)
    c = duck()
    tag = f"{mid}_{M['lat']}_{M['lon']}_{int(size)}"
    stats = {}

    # buildings near the field, as oriented rectangles
    rows = overture(c, 'buildings', 'building', "coalesce(class,''), coalesce(height,0), coalesce(num_floors,0), coalesce(roof_shape,'')", P.bbox(a.bld_radius + 200), tag + f'_r{int(a.bld_radius)}')
    B = bytearray(); seen = set(); nb = 0
    for cls, h, fl, roof, g in rows:
        g = wkb.loads(g)
        for part in geoms_xz(g, P, clip, 0.3):
            if part.geom_type != 'Polygon' or part.area < 9:
                continue
            ct = part.centroid
            if math.hypot(ct.x, ct.y) > a.bld_radius:
                continue
            key = (round(ct.x), round(ct.y))
            if key in seen:
                continue
            seen.add(key)
            r = part.minimum_rotated_rectangle
            xy = list(r.exterior.coords)[:4]
            e1 = (xy[1][0] - xy[0][0], xy[1][1] - xy[0][1]); e2 = (xy[2][0] - xy[1][0], xy[2][1] - xy[1][1])
            L1, L2 = math.hypot(*e1), math.hypot(*e2)
            if L1 < L2:
                e1, e2, L1, L2 = e2, e1, L2, L1
            ang = math.atan2(e1[1], e1[0]) % math.pi
            # a rectangle much bigger than the footprint (L-shapes, courtyards) is shrunk to the footprint area
            k = math.sqrt(min(1.0, part.area / max(L1 * L2, 1e-6)))
            L1, L2 = L1 * k, L2 * k
            hh = h if h and h > 0 else (fl * 3.2 if fl else 0)
            kind = BKIND.get(cls, 0)
            rs = {'flat': 1, 'gabled': 2, 'hipped': 3, 'pyramidal': 3}.get(roof, 0)
            B += struct.pack('<hhBBBBBB', q05(ct.x), q05(ct.y), min(255, round(L1 * 2)), min(255, round(L2 * 2)),
                             int(ang / math.pi * 256) % 256, min(255, round(hh * 2)), kind, rs)
            nb += 1
    stats['buildings'] = nb

    # roads
    rows = overture(c, 'transportation', 'segment', "subtype, coalesce(class,'')", bb, tag)
    roads = []
    for sub, cls, g in rows:
        if sub != 'road' or cls not in ROAD:
            continue
        for part in geoms_xz(wkb.loads(g), P, clip, 1.2):
            if part.geom_type == 'LineString' and part.length > 4:
                # lanes, service roads and tracks only near the field: far out they are sub-pixel and only cost download size
                if ROAD[cls] >= 6 and part.distance(Point(0, 0)) > a.minor_radius:
                    continue
                roads.append((ROAD[cls], list(part.coords)))
    stats['roads'] = len(roads); stats['road_km'] = round(sum(math.dist(p, q) for _, pts in roads for p, q in zip(pts, pts[1:])) / 1000, 1)

    # water
    rows = overture(c, 'base', 'water', "subtype, coalesce(class,'')", bb, tag)
    wl, wp = [], []
    for sub, cls, g in rows:
        geo = wkb.loads(g)
        if geo.geom_type in ('LineString', 'MultiLineString'):
            code = WLINE.get(cls) or WLINE.get(sub)
            if not code:
                continue
            for part in geoms_xz(geo, P, clip, 1.5):
                if part.geom_type == 'LineString' and part.length > 6:
                    wl.append((code, list(part.coords)))
        elif geo.geom_type in ('Polygon', 'MultiPolygon'):
            code = WPOLY.get(cls) or WPOLY.get(sub) or 2
            if code == 4:
                continue
            for part in geoms_xz(geo, P, clip, 1.0):
                if part.geom_type == 'Polygon' and part.area > 25:
                    wp.append((code, list(part.exterior.coords)[:-1]))
    stats['water_lines'] = len(wl); stats['water_polys'] = len(wp)

    g = a.lc or int(min(512, round(size / 20)))
    lc = landcover(P, size, g)
    stats['landcover'] = {int(k): int((lc == k).sum()) for k in np.unique(lc)}

    feat = {'id': mid, 'src': 'Overture Maps 2026-10-21.0 (OSM, Microsoft, Google Open Buildings); ESA WorldCover 2021',
            'bldR': a.bld_radius, 'nb': nb, 'b': base64.b64encode(bytes(B)).decode(),
            'r': pack_lines(roads), 'wl': pack_lines(wl), 'wp': pack_lines(wp), 'lc': {'g': g, 'rle': rle(lc)}}
    js = ('/* generated by tools/build_features.py; (c) OpenStreetMap contributors, Overture Maps Foundation, ESA WorldCover 2021; do not edit */\n'
          f'MAP_FEAT[{json.dumps(mid)}]={json.dumps(feat, separators=(",", ":"))};\n')
    out = pathlib.Path(a.out) if a.out else pathlib.Path(a.map).with_name(mid + '_feat.js')
    out.write_text(js)
    print(json.dumps(stats), 'bytes', len(js), '->', out)


if __name__ == '__main__':
    main()
