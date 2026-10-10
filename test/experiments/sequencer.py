"""Reference implementation of the N2N sequencer exactly as specified in Section 5 of the manuscript
(edge cost, normalisation, trend-based congestion, A* with Haversine heuristic, disjoint backup).
Topology: node identifiers are the real AS numbers found in the stored RIS-derived ABATL mappings
(data/experiment_state.json). Link attributes (distance, bandwidth, security, reliability, history) are
synthetic, drawn from a seeded generator, and are therefore class S in the manuscript.
Output: data/sequencer_output.json
"""
import json, math, heapq, random, time, os, re, statistics
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rnd = random.Random(42)
W = {"VoIP": (0.7, .1, .1, .1), "Video": (0.3, .5, .1, .1), "CriticalData": (0.2, .1, .5, .2), "Default": (0.5, .2, .2, .1)}

st = json.load(open(os.path.join(ROOT, "data", "experiment_state.json")))
srcs, dsts = set(), set()
for m in st["abatlMappings"].values():
    srcs.add(int(re.match(r"NID-(\d+)-", m["sourceNID"]).group(1)))
    dsts.add(int(m["destNIAS"].split("-")[1]))
nodes = sorted(srcs | dsts)
N = len(nodes)
pos = {a: (rnd.uniform(-50, 65), rnd.uniform(-120, 140)) for a in nodes}

def hav(a, b):
    (p1, l1), (p2, l2) = pos[a], pos[b]
    p1, l1, p2, l2 = map(math.radians, (p1, l1, p2, l2))
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin((l2 - l1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))

# k-nearest-neighbour graph (k=6) plus a ring for connectivity
adj = {a: {} for a in nodes}
def add(a, b):
    if a == b or b in adj[a]: return
    d = hav(a, b)
    bw = rnd.choice([100, 1000, 10000]); avail = bw * rnd.uniform(0.2, 0.95)
    hist = [rnd.uniform(0.05, 0.6) for _ in range(10)]
    e = dict(lat=d / 200 + rnd.uniform(0.5, 4), maxbw=bw, avail=avail, sec=rnd.uniform(0.7, 1.0),
             rel=rnd.uniform(0.9, 1.0), hist=hist)
    adj[a][b] = e; adj[b][a] = e
for a in nodes:
    for b in sorted(nodes, key=lambda x: hav(a, x))[1:7]: add(a, b)
for i, a in enumerate(nodes): add(a, nodes[(i + 1) % N])

def trend(h):
    n = len(h); xs = range(n); mx = (n - 1) / 2; my = sum(h) / n
    sl = sum((x - mx) * (y - my) for x, y in zip(xs, h)) / sum((x - mx) ** 2 for x in xs)
    return max(-0.2, min(0.2, sl))

def edge_cost(e, cls):
    wl, wb, ws, wr = W[cls]
    NL = e["lat"] / 100; NB = 1 - e["avail"] / e["maxbw"]; NS = 1 - e["sec"]; NR = 1 - e["rel"]
    CF = max(0.0, sum(e["hist"]) / len(e["hist"]) + trend(e["hist"]))   # Predicted = AvgHist + Trend
    HF = 1 - e["rel"]
    c = (wl * NL + wb * NB + ws * NS + wr * NR) * (1 + CF) * (1 + HF)
    if cls == "VoIP" and NL > 0.5: c *= 2
    return c

def astar(s, t, cls, banned=frozenset()):
    wl = W[cls][0]
    h = lambda n: hav(n, t) / 20000 * wl
    pq = [(h(s), 0.0, s, (s,))]; best = {}
    while pq:
        f, g, u, p = heapq.heappop(pq)
        if u == t: return list(p)
        if u in best and best[u] <= g: continue
        best[u] = g
        for v, e in adj[u].items():
            if v in p or (v in banned and v != t): continue
            g2 = g + edge_cost(e, cls)
            heapq.heappush(pq, (g2 + h(v), g2, v, p + (v,)))
    return None

def metrics(p):
    es = [adj[a][b] for a, b in zip(p, p[1:])]
    return dict(latency=sum(e["lat"] for e in es), min_bw=min(e["avail"] for e in es),
                security=math.prod(e["sec"] for e in es), hops=len(p) - 1)

def diversity(p, q):
    shared = len(set(p[1:-1]) & set(q[1:-1])); uniq = len(set(p[1:-1]) | set(q[1:-1]))
    return 1 - shared / uniq if uniq else 1.0

pairs = []
S = sorted(srcs); D = sorted(dsts)
while len(pairs) < 200:
    s, t = rnd.choice(S), rnd.choice(D)
    if s != t: pairs.append((s, t))
out = []
for i, (s, t) in enumerate(pairs):
    cls = list(W)[i % 4]
    t0 = time.perf_counter(); P = astar(s, t, cls); t1 = time.perf_counter()
    if not P or len(P) < 3: continue
    B = astar(s, t, cls, banned=frozenset(P[1:-1])); t2 = time.perf_counter()
    rec = dict(i=i, cls=cls, src=s, dst=t, primary=P, backup=B, primary_ms=(t1 - t0) * 1e3, backup_ms=(t2 - t1) * 1e3,
               pm=metrics(P), diversity=diversity(P, B) if B else None)
    # failure of a random intermediate node: recompute avoiding it (splice-style re-sequencing)
    failed = rnd.choice(P[1:-1]); t3 = time.perf_counter(); R = astar(s, t, cls, banned=frozenset([failed])); t4 = time.perf_counter()
    rec.update(failed=failed, resequenced=R, reseq_ms=(t4 - t3) * 1e3)
    # class differentiation: primary under every class
    rec["by_class"] = {c: astar(s, t, c) for c in W}
    out.append(rec)
json.dump(dict(nodes=N, edges=sum(len(v) for v in adj.values()) // 2, records=out), open(os.path.join(ROOT, "data", "sequencer_output.json"), "w"))
print("nodes", N, "edges", sum(len(v) for v in adj.values()) // 2, "records", len(out),
      "with backup", sum(1 for r in out if r["backup"]))
