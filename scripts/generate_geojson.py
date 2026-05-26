#!/usr/bin/env python3
"""
Generate approximate Manhattan neighborhood GeoJSON.

Interior avenue longitudes: lon(base, lat) = base + SHIFT * (lat - ANCHOR)
West shore (Hudson River) and Harlem River east shore above 96th use
piecewise-linear interpolation through GPS-calibrated anchor points.
"""

import json, os

ANCHOR = 40.756   # reference latitude (~42nd St)
SHIFT  = 0.59     # eastward lon shift per 1° latitude

# Avenue base longitudes at ANCHOR (42nd St)
X_12  = -74.003
X_10  = -73.997
X_9   = -73.993
X_8   = -73.989   # 8th Ave / Central Park West above 59th
X_7   = -73.986
X_6   = -73.982
X_5   = -73.979   # 5th Ave / Central Park East / Lenox Ave above 110th
X_MAD = -73.975
X_PAR = -73.972
X_LEX = -73.968
X_3   = -73.964
X_2   = -73.961
X_1   = -73.957
X_FDR = -73.951
E_SH  = -73.944   # East River shore (used below 96th only)


def lx(base, lat):
    """Longitude of an avenue at a given latitude."""
    return round(base + SHIFT * (lat - ANCHOR), 5)


# ── Hudson River west shore ───────────────────────────────────────────────────
# Piecewise-linear through calibrated GPS points.
# Manhattan narrows and shifts east much faster than the street grid tilt.
_WS = [
    (40.700, -74.020),
    (40.716, -74.013),
    (40.722, -74.016),
    (40.738, -74.016),
    (40.752, -74.013),
    (40.769, -74.001),  # 59th St / Riverside Dr South
    (40.778, -73.990),  # 72nd St
    (40.796, -73.981),  # 96th St
    (40.808, -73.963),  # 125th St
    (40.816, -73.957),  # 135th St
    (40.830, -73.948),  # 155th St
    (40.851, -73.942),  # 181st St
    (40.868, -73.934),  # 207th St
    (40.875, -73.926),  # northern tip
]

def ws(lat):
    """Hudson River west shore longitude at given latitude."""
    for i in range(len(_WS) - 1):
        y0, x0 = _WS[i]; y1, x1 = _WS[i + 1]
        if y0 <= lat <= y1:
            t = (lat - y0) / (y1 - y0)
            return round(x0 + t * (x1 - x0), 5)
    y0, x0 = _WS[-2]; y1, x1 = _WS[-1]
    t = (lat - y0) / (y1 - y0)
    return round(x0 + t * (x1 - x0), 5)


# ── Harlem River east shore (above 96th St) ───────────────────────────────────
_HR = [
    (40.796, -73.918),  # 96th St
    (40.808, -73.921),  # 125th St
    (40.816, -73.924),  # 135th St
    (40.830, -73.930),  # 155th St
    (40.851, -73.936),  # 181st St
    (40.868, -73.927),  # 207th St
    (40.875, -73.919),  # northern tip
]

def hr(lat):
    """Harlem River east shore longitude at given latitude."""
    for i in range(len(_HR) - 1):
        y0, x0 = _HR[i]; y1, x1 = _HR[i + 1]
        if y0 <= lat <= y1:
            t = (lat - y0) / (y1 - y0)
            return round(x0 + t * (x1 - x0), 5)
    y0, x0 = _HR[-2]; y1, x1 = _HR[-1]
    t = (lat - y0) / (y1 - y0)
    return round(x0 + t * (x1 - x0), 5)


# ── GeoJSON helpers ───────────────────────────────────────────────────────────

def poly(name, nid, pts):
    closed = pts + [pts[0]]
    return {
        "type": "Feature",
        "properties": {"name": name, "id": nid},
        "geometry": {"type": "Polygon", "coordinates": [closed]},
    }

def rect(name, nid, s, n, w_base, e_base):
    return poly(name, nid, [
        [lx(w_base, s), s],
        [lx(w_base, n), n],
        [lx(e_base, n), n],
        [lx(e_base, s), s],
    ])

# West-shore rect: west boundary uses ws(), east uses lx()
def wrect(name, nid, s, n, e_base):
    return poly(name, nid, [
        [ws(s), s],
        [ws(n), n],
        [lx(e_base, n), n],
        [lx(e_base, s), s],
    ])

# Full-width rect above 96th: west = ws(), east = hr()
def frect(name, nid, s, n):
    return poly(name, nid, [
        [ws(s), s],
        [ws(n), n],
        [hr(n), n],
        [hr(s), s],
    ])


features = []
add = features.append

# =============================================================================
# SOUTHERN TIP  (below Canal, lat < 40.722)
# =============================================================================

add(poly("Battery Park City", "battery-park-city", [
    [-74.020, 40.700], [-74.022, 40.716],
    [-74.013, 40.716], [-74.013, 40.700],
]))

add(poly("Financial District", "financial-district", [
    [-74.013, 40.700], [-74.013, 40.716],
    [-74.005, 40.720], [-73.999, 40.720],
    [-73.990, 40.715], [-73.980, 40.705],
    [-74.000, 40.700],
]))

add(poly("Tribeca", "tribeca", [
    [-74.013, 40.716], [-74.016, 40.722],
    [-74.005, 40.722], [-74.005, 40.716],
]))

add(poly("Chinatown", "chinatown", [
    [-74.005, 40.719], [-74.005, 40.722],
    [-73.999, 40.723], [-73.988, 40.720],
    [-73.978, 40.714], [-73.985, 40.708],
    [-73.990, 40.715], [-73.999, 40.720],
]))

add(poly("Two Bridges", "two-bridges", [
    [-73.988, 40.720], [-73.985, 40.730],
    [-73.970, 40.726], [-73.967, 40.710],
    [-73.978, 40.714],
]))

# =============================================================================
# CANAL TO HOUSTON  (lat 40.722–40.728)
# =============================================================================

add(poly("SoHo", "soho", [
    [-74.016, 40.722], [-74.014, 40.728],
    [-74.005, 40.728], [-74.005, 40.722],
]))

add(poly("Little Italy", "little-italy", [
    [-74.005, 40.722], [-74.005, 40.728],
    [-73.997, 40.727], [-73.988, 40.720],
    [-73.999, 40.723],
]))

add(poly("Nolita", "nolita", [
    [-74.005, 40.728], [-74.002, 40.733],
    [-73.993, 40.731], [-73.997, 40.727],
]))

add(poly("Lower East Side", "lower-east-side", [
    [-73.988, 40.720], [-73.997, 40.727],
    [-73.993, 40.731], [-73.993, 40.738],
    [-73.970, 40.735], [-73.970, 40.726],
    [-73.985, 40.730],
]))

# =============================================================================
# HOUSTON TO 14TH ST  (lat 40.728–40.738)
# =============================================================================

add(poly("NoHo", "noho", [
    [-74.003, 40.728], [-74.003, 40.734],
    [-73.993, 40.731], [-73.997, 40.727],
]))

add(poly("Greenwich Village", "greenwich-village", [
    [-74.014, 40.728], [-74.012, 40.738],
    [-74.005, 40.738], [-74.003, 40.734],
    [-74.003, 40.728],
]))

add(poly("West Village", "west-village", [
    [-74.018, 40.728], [-74.016, 40.738],
    [-74.012, 40.738], [-74.014, 40.728],
]))

add(poly("East Village", "east-village", [
    [-74.003, 40.734], [-74.003, 40.738],
    [-73.993, 40.738], [-73.993, 40.731],
]))

# =============================================================================
# 14TH TO 34TH  (lat 40.738–40.752)
# =============================================================================

add(poly("Meatpacking District", "meatpacking-district", [
    [-74.016, 40.738], [-74.015, 40.743],
    [lx(X_9, 40.743), 40.743],
    [lx(X_9, 40.738), 40.738],
]))

add(poly("Chelsea", "chelsea", [
    [-74.015, 40.743], [-74.013, 40.752],
    [lx(X_8, 40.752), 40.752],
    [lx(X_8, 40.743), 40.743],
    [lx(X_9, 40.743), 40.743],
]))

add(rect("Flatiron District",  "flatiron",        40.738, 40.748, X_8,   X_5))
add(rect("Gramercy Park",      "gramercy",        40.738, 40.748, X_PAR, X_3))
add(rect("Stuyvesant Town",    "stuyvesant-town", 40.738, 40.745, X_1,   E_SH))
add(rect("Rose Hill",          "rose-hill",       40.745, 40.750, X_PAR, X_3))
add(rect("Kips Bay",           "kips-bay",        40.745, 40.752, X_3,   E_SH))
add(rect("NoMad",              "nomad",           40.748, 40.752, X_8,   X_MAD))
add(rect("Murray Hill",        "murray-hill",     40.750, 40.756, X_MAD, X_LEX))

# =============================================================================
# MIDTOWN  (lat 40.752–40.769)
# =============================================================================

add(rect("Hudson Yards",    "hudson-yards",    40.750, 40.756, X_12, X_10))
add(rect("Garment District","garment-district",40.752, 40.756, X_8,  X_6))
add(rect("Midtown",         "midtown",         40.756, 40.768, X_8,  X_5))
add(rect("Midtown East",    "midtown-east",    40.752, 40.768, X_5,  X_PAR))
add(rect("Turtle Bay",      "turtle-bay",      40.756, 40.765, X_PAR,E_SH))

add(poly("Hell's Kitchen", "hells-kitchen", [
    [-74.013, 40.752],
    [ws(40.769), 40.769],
    [lx(X_8, 40.769), 40.769],
    [lx(X_8, 40.752), 40.752],
    [lx(X_10, 40.752), 40.752],
    [lx(X_10, 40.750), 40.750],
]))

# =============================================================================
# 59TH TO 96TH  (lat 40.769–40.796)
# Central Park: 5th Ave (X_5) to CPW (X_8), 59th–110th St
# =============================================================================

# Lincoln Square: 59th–72nd, Hudson River to CPW
add(wrect("Lincoln Square", "lincoln-square", 40.769, 40.778, X_8))

# Upper West Side: 72nd–96th, Hudson River to CPW
add(wrect("Upper West Side", "upper-west-side", 40.778, 40.796, X_8))

# Upper East Side: 59th–77th, 5th Ave to Park Ave
add(rect("Upper East Side", "upper-east-side", 40.769, 40.782, X_5, X_PAR))

# Lenox Hill: 59th–77th, Park Ave to East River
add(rect("Lenox Hill", "lenox-hill", 40.769, 40.782, X_PAR, E_SH))

# Carnegie Hill: 77th–96th, 5th Ave to Lex
add(rect("Carnegie Hill", "carnegie-hill", 40.782, 40.796, X_5, X_LEX))

# Yorkville: 77th–96th, Lex to East River
add(rect("Yorkville", "yorkville", 40.782, 40.796, X_LEX, E_SH))

# =============================================================================
# 96TH TO 125TH  (lat 40.796–40.808)
# =============================================================================

# Morningside Heights: 96th–125th, Hudson River to Amsterdam Ave (≈ X_8/CPW ext)
add(wrect("Morningside Heights", "morningside-heights", 40.796, 40.808, X_8))

# Harlem (Central): 110th–135th, CPW (X_8) to Lenox/5th Ave (X_5)
add(rect("Harlem", "harlem", 40.800, 40.816, X_8, X_5))

# East Harlem: 96th–125th, 5th Ave to Harlem River
add(poly("East Harlem", "east-harlem", [
    [lx(X_5, 40.796), 40.796],
    [lx(X_5, 40.808), 40.808],
    [hr(40.808), 40.808],
    [hr(40.796), 40.796],
]))

# =============================================================================
# 125TH TO 155TH  (lat 40.808–40.830)
# =============================================================================

# Manhattanville: 125th–135th, Hudson to Amsterdam/Broadway (≈ X_8)
add(wrect("Manhattanville", "manhattanville", 40.808, 40.816, X_8))

# Hamilton Heights: 135th–155th, Hudson to Amsterdam/Broadway
add(wrect("Hamilton Heights", "hamilton-heights", 40.816, 40.830, X_8))

# =============================================================================
# 155TH TO 207TH  (lat 40.830–40.868)  Washington Heights
# =============================================================================

add(frect("Washington Heights", "washington-heights", 40.830, 40.868))

# =============================================================================
# INWOOD  (lat 40.868–40.875)
# =============================================================================

add(frect("Inwood", "inwood", 40.868, 40.875))

# =============================================================================
# OUTPUT
# =============================================================================

geojson = {"type": "FeatureCollection", "features": features}
out_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../public/manhattan-neighborhoods.geojson"
)
with open(out_path, "w") as fh:
    json.dump(geojson, fh, separators=(",", ":"))

print(f"Wrote {len(features)} neighborhoods → {out_path}")
for feat in features:
    print(f"  {feat['properties']['id']}")
