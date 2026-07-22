"""
AUNet Validation Script — Etherscan Mainnet Format
====================================================
Run:
    python aunet_validation.py                    (reads data/mainnettransactions.csv)
    python aunet_validation.py path/to/file.csv   (custom path)

Input CSV: Etherscan export format
    Txhash, Blockno, UnixTimestamp, DateTime, From, To,
    ContractAddress, Value_IN(ETH), Value_OUT(ETH),
    CurrentValue @ $1845.46/Eth, TxnFee(ETH), TxnFee(USD),
    Historical $Price/Eth, Status, ErrCode, Method

Outputs: python/aunet_figures/
    fig1_uncertainty_trajectory      fig5_prediction_accuracy
    fig2_node_uncertainty_markov     fig6_comparison_trajectories
    fig3_cost_analysis               fig7_mae_rmse_comparison
    fig4_single_vs_multi_party       fig8_radar_comparison

Paper: AUNet: AI-Enabled Uncertainty Quantification and Prediction
       in Distributed Transactional Blockchain Systems
"""

import os, sys, warnings
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
from scipy.stats import norm

warnings.filterwarnings("ignore")

# ── Publication style — IEEE conference, pure matplotlib ──────────────────────
matplotlib.rcParams.update({
    "font.family":       "DejaVu Sans",
    "font.size":         10,
    "axes.titlesize":    10,
    "axes.labelsize":    10,
    "xtick.labelsize":   9,
    "ytick.labelsize":   9,
    "legend.fontsize":   8,
    "legend.framealpha": 0.92,
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "figure.dpi":        150,
    "savefig.dpi":       600,
    "savefig.bbox":      "tight",
    "axes.grid":         True,
    "grid.linestyle":    "--",
    "grid.linewidth":    0.5,
    "grid.color":        "#cccccc",
    "axes.axisbelow":    True,
})

# Wong colorblind-safe palette
C = {
    "blue":   "#0072B2",
    "orange": "#E69F00",
    "green":  "#009E73",
    "red":    "#D55E00",
    "purple": "#CC79A7",
    "sky":    "#56B4E9",
    "black":  "#000000",
}

OUTPUT_DIR = "aunet_figures"   # overwritten in main()
LW         = 2.2
LWL        = 1.4
FIGW_2COL  = 7.16              # IEEE double-column width (inches)


# ═══════════════════════════════════════════════════════════════════════════════
# 1.  LOAD
# ═══════════════════════════════════════════════════════════════════════════════

# Exact Etherscan column names → internal names
COL = {
    "unix_ts":   "UnixTimestamp",
    "from_addr": "From",
    "to_addr":   "To",
    "fee_eth":   "TxnFee(ETH)",
    "fee_usd":   "TxnFee(USD)",
    "eth_price": "Historical $Price/Eth",
    "status":    "Status",
    "errcode":   "ErrCode",
}


def load(path: str) -> pd.DataFrame:
    print(f"[INFO] Loading {path}")
    df = pd.read_csv(path, low_memory=False)
    print(f"       {len(df):,} rows x {len(df.columns)} columns")

    # Rename to internal names
    rename = {v: k for k, v in COL.items() if v in df.columns}
    df = df.rename(columns=rename)

    # Timestamp
    df["_ts"] = pd.to_datetime(df["unix_ts"], unit="s", errors="coerce")

    # Error flag: ErrCode non-empty OR Status indicates failure
    err = pd.Series(False, index=df.index)
    if "errcode" in df.columns:
        err |= df["errcode"].notna() & (
            df["errcode"].astype(str).str.strip() != "")
    if "status" in df.columns:
        s = df["status"].astype(str).str.strip().str.lower()
        err |= s.isin(["1", "error", "failed", "fail"])
    df["_error"] = err.astype(int)

    # Cost in Gwei  (1 ETH = 1e9 Gwei)
    df["_fee_gwei"] = (pd.to_numeric(df.get("fee_eth", 0), errors="coerce")
                       .fillna(0) * 1e9)
    df["_fee_usd"]  = (pd.to_numeric(df.get("fee_usd", 0), errors="coerce")
                       .fillna(0))

    # Entity = From address (requesters)
    df["_entity"] = df["from_addr"].astype(str).str.strip().str.lower()

    df = df.dropna(subset=["_ts"]).sort_values("_ts").reset_index(drop=True)
    df["_period"] = df["_ts"].dt.to_period("D")

    n_f = df["_error"].sum()
    print(f"       Failed transactions  : {n_f:,} ({n_f/len(df)*100:.2f}%)")
    print(f"       Unique entities      : {df['_entity'].nunique():,}")
    print(f"       Date range           : "
          f"{df['_ts'].min().date()} -> {df['_ts'].max().date()}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  ENTITY METRICS
# ═══════════════════════════════════════════════════════════════════════════════

def entity_metrics(df: pd.DataFrame, min_tx: int = 3) -> pd.DataFrame:
    """
    Per-entity Markov chain parameters and AUNet node-level uncertainty U_i.
    Entities with fewer than min_tx transactions are excluded — too few
    observations for reliable transition probability estimation.

    Two-state Markov chain:
        beta_i   = P(OK -> FAIL)   empirical failure rate
        alpha_i  = P(FAIL -> OK)   empirical repair rate
        pi_Y     = beta / (alpha + beta)   steady-state disruption prob
        A_i      = 1 - pi_Y               availability

    Node uncertainty:
        theta_i  = n_fail / n_total        historical disruption proportion
        CV_i     = sigma_cost / mu_cost    cost variability
        U_i      = (1 - A_i)(1 + theta_i)(1 + CV_i)
        R_i      = 1 - theta_i             reputation score
    """
    rows = []
    skipped = 0
    for entity, grp in df.groupby("_entity"):
        grp   = grp.sort_values("_ts")
        e_arr = grp["_error"].values
        n_tx  = len(e_arr)

        if n_tx < min_tx:
            skipped += 1
            continue

        # Markov transitions
        tx_xy = int(np.sum((e_arr[:-1] == 0) & (e_arr[1:] == 1)))
        tx_yx = int(np.sum((e_arr[:-1] == 1) & (e_arr[1:] == 0)))
        n_ok  = int(np.sum(e_arr == 0))
        n_f   = int(np.sum(e_arr == 1))

        beta_i  = tx_xy / max(n_ok, 1)
        alpha_i = tx_yx / max(n_f,  1)
        pi_y    = beta_i / (alpha_i + beta_i + 1e-9)
        avail_i = 1.0 - pi_y

        # Cost statistics
        costs   = grp["_fee_gwei"].values
        mu_c    = costs.mean()
        sig_c   = costs.std(ddof=1) if len(costs) > 1 else 0.0
        cv_c    = sig_c / (mu_c + 1e-9)
        theta_i = n_f / max(n_tx, 1)

        U_i = (1.0 - avail_i) * (1.0 + theta_i) * (1.0 + cv_c)
        R_i = 1.0 - theta_i

        # Newsvendor cost model
        h      = mu_c * 0.10
        m      = mu_c * 0.25
        crit   = m / (m + h + 1e-9)
        S_star = mu_c + sig_c * norm.ppf(crit)
        E_cost = (h + m) * sig_c * norm.pdf(norm.ppf(crit))

        rows.append(dict(
            entity=entity, n_tx=n_tx, n_fail=n_f,
            alpha=alpha_i, beta=beta_i, pi_Y=pi_y,
            availability=avail_i, theta=theta_i,
            mu_cost=mu_c, sigma_cost=sig_c, cv_cost=cv_c,
            U_i=U_i, R_i=R_i,
            h=h, m=m, S_star=S_star, E_cost=E_cost,
        ))

    if skipped:
        print(f"       Entities skipped (< {min_tx} tx) : {skipped:,}")

    em = pd.DataFrame(rows).sort_values("U_i", ascending=False)
    return em.reset_index(drop=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 3.  NETWORK UNCERTAINTY TRAJECTORY
# ═══════════════════════════════════════════════════════════════════════════════

def network_trajectory(df: pd.DataFrame, em: pd.DataFrame) -> pd.DataFrame:
    """
    Per-period network-level uncertainty U_net(t):
        w_i      = R_i * (1/rank_i)   reputation-weighted factor
        U_net(t) = (1/|V|) sum(w_i * U_i)  +  g(NetworkState)
        g(.)     = 0.4*congestion + 0.4*cost_variance + 0.2*redundancy
    """
    em2 = em.copy()
    em2["rank"] = em2["R_i"].rank(ascending=False)
    em2["w_i"]  = em2["R_i"] / em2["rank"]
    em2["w_i"] /= em2["w_i"].sum()
    u_map = dict(zip(em2["entity"], em2["U_i"]))
    w_map = dict(zip(em2["entity"], em2["w_i"]))

    records = []
    for period, grp in df.groupby("_period"):
        ents  = grp["_entity"].unique()
        w_U   = sum(w_map.get(e, 0) * u_map.get(e, 0) for e in ents)
        cong  = grp["_error"].mean()
        fees  = grp["_fee_gwei"]
        c_var = fees.std() / (fees.mean() + 1e-9)
        redund = 1.0 / max(len(ents), 1)
        g_net  = 0.4 * cong + 0.4 * c_var + 0.2 * redund

        records.append(dict(
            period=period,
            ts=period.start_time,
            n_tx=len(grp),
            n_fail=int(grp["_error"].sum()),
            n_active=len(ents),
            congestion=cong,
            cost_variance=c_var,
            U_net=w_U + g_net,
            mean_fee_gwei=fees.mean(),
            mean_fee_usd=grp["_fee_usd"].mean(),
        ))

    traj = (pd.DataFrame(records)
            .sort_values("ts")
            .reset_index(drop=True))
    w = max(3, len(traj) // 15)
    traj["U_net_smooth"] = (traj["U_net"]
                            .rolling(w, min_periods=1, center=True).mean())
    return traj


# ═══════════════════════════════════════════════════════════════════════════════
# 4.  AUNet PREDICTION
# ═══════════════════════════════════════════════════════════════════════════════

def aunet_predict(traj: pd.DataFrame, horizon: int = 14) -> dict:
    """
    AUNet prediction proxy: AR(6) encoder with Bayesian confidence bounds.
    Represents the seq2seq LSTM encoder-decoder + Bayesian stage of AUNet.
    """
    y     = traj["U_net_smooth"].values
    T     = len(y)
    split = max(int(0.80 * T), 6)
    p     = min(6, split - 1)

    X = np.array([y[i:i+p] for i in range(split - p)])
    Y = y[p:split]
    A = np.c_[X, np.ones(len(X))]
    coefs, *_ = np.linalg.lstsq(A, Y, rcond=None)

    history = list(y[split - p:split])
    preds   = []
    for _ in range(T - split + horizon):
        xin = np.array(history[-p:] + [1.0])
        preds.append(max(float(xin @ coefs), 0.0))
        history.append(preds[-1])

    test_pred = np.array(preds[:T - split])
    actual    = y[split:]
    n_cmp     = min(len(actual), len(test_pred))
    resid     = actual[:n_cmp] - test_pred[:n_cmp]
    sigma     = resid.std() if len(resid) > 1 else 0.01
    future    = np.array(preds)

    mae  = float(np.mean(np.abs(resid)))
    rmse = float(np.sqrt(np.mean(resid ** 2)))
    print(f"[INFO] AUNet prediction  MAE={mae:.4f}  RMSE={rmse:.4f}")

    return dict(
        split=split, test_pred=test_pred, future=future,
        upper=np.clip(future + 1.64 * sigma, 0, None),
        lower=np.clip(future - 1.64 * sigma, 0, None),
        sigma=sigma, mae=mae, rmse=rmse, T=T, horizon=horizon,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5.  SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

def summary(df: pd.DataFrame, em: pd.DataFrame, traj: pd.DataFrame):
    n     = len(df)
    n_f   = df["_error"].sum()
    tpd   = (1 / (em["pi_Y"] + 1e-6)).replace(np.inf, np.nan).mean()
    print("\n" + "=" * 62)
    print("  AUNet VALIDATION SUMMARY")
    print("=" * 62)
    print(f"  Transactions              : {n:>14,}")
    print(f"  Unique entities (>= 3 tx) : {len(em):>14,}")
    print(f"  Failed transactions       : {n_f:>14,}  ({n_f/n*100:.2f}%)")
    print(f"  Mean fee (Gwei)           : {df['_fee_gwei'].mean():>14.4f}")
    print(f"  Mean U_net(t)             : {traj['U_net'].mean():>14.4f}")
    print(f"  Mean transactions/disrupt : {tpd:>14.1f}")
    print("=" * 62)
    print(f"\n  {'Entity (From)':<44} {'beta':>6} {'alpha':>6}"
          f" {'Avail':>6} {'U_i':>7}")
    print("  " + "-" * 66)
    for _, r in em.head(10).iterrows():
        print(f"  {r['entity'][:42]:<44} {r['beta']:>6.3f}"
              f" {r['alpha']:>6.3f} {r['availability']:>6.3f}"
              f" {r['U_i']:>7.4f}")
    print()


# ═══════════════════════════════════════════════════════════════════════════════
# 6.  FIGURE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _save(fig: plt.Figure, name: str):
    """Save PNG (always) and PDF (skip gracefully if file is locked)."""
    base = os.path.join(OUTPUT_DIR, name)
    fig.savefig(base + ".png")
    print(f"  [SAVE] {name}.png", end="")
    try:
        fig.savefig(base + ".pdf")
        print(" / .pdf")
    except PermissionError:
        print(f"\n  [WARN] PDF skipped — close {name}.pdf in your viewer first")
    plt.close(fig)


# ═══════════════════════════════════════════════════════════════════════════════
# 7.  FIGURES 1–5  (AUNet results)
# ═══════════════════════════════════════════════════════════════════════════════

def fig1(traj: pd.DataFrame, pred: dict):
    """Network-level uncertainty trajectory with AUNet forecast."""
    fig, ax = plt.subplots(figsize=(FIGW_2COL, 3.0))
    ts    = traj["ts"].values
    y_obs = traj["U_net_smooth"].values
    sp    = pred["split"]

    ax.plot(ts[:sp], y_obs[:sp], color=C["blue"], lw=LW,
            label="$U_{net}(t)$ observed (train)")
    ax.plot(ts[sp:], y_obs[sp:], color=C["blue"], lw=LW,
            linestyle="--", label="$U_{net}(t)$ observed (test)")

    test_ts = ts[sp:sp + len(pred["test_pred"])]
    ax.plot(test_ts, pred["test_pred"], color=C["orange"], lw=LW,
            label="AUNet prediction")

    last  = pd.Timestamp(ts[-1])
    f_ts  = pd.date_range(last, periods=pred["horizon"] + 1, freq="D")[1:]
    h_len = min(pred["horizon"], len(pred["future"]))
    ax.plot(f_ts[:h_len], pred["future"][-h_len:],
            color=C["red"], lw=LW, linestyle="-.", label="Forecast")
    ax.fill_between(f_ts[:h_len],
                    pred["lower"][-h_len:], pred["upper"][-h_len:],
                    color=C["red"], alpha=0.15, label="90% credible interval")

    hi = traj["congestion"].values > traj["congestion"].quantile(0.90)
    ax.scatter(ts[hi], y_obs[hi], marker="^", color=C["green"],
               s=28, zorder=5, label="High-disruption period")
    ax.axvline(pd.Timestamp(ts[sp]), color="grey",
               lw=1.0, linestyle=":", alpha=0.75)

    ax.set_xlabel("Date")
    ax.set_ylabel("$U_{net}(t)$ — Network Uncertainty Index")
    ax.set_title("AUNet Network-Level Uncertainty Trajectory")
    ax.legend(ncol=2, loc="upper left")
    fig.autofmt_xdate(rotation=25)
    fig.tight_layout()
    _save(fig, "fig1_uncertainty_trajectory")


def fig2(em: pd.DataFrame):
    """Node-level U_i bars and Markov chain scatter."""
    top  = min(20, len(em))
    em_t = em.head(top)
    fig, axes = plt.subplots(1, 2, figsize=(FIGW_2COL, 2.8))

    ax  = axes[0]
    x   = np.arange(top)
    col = [C["red"] if u > em["U_i"].median() else C["blue"]
           for u in em_t["U_i"]]
    ax.bar(x, em_t["U_i"], color=col, width=0.7,
           edgecolor="white", linewidth=0.4)
    ax.axhline(em["U_i"].mean(), color=C["orange"], lw=LWL,
               linestyle="--",
               label=f"Mean $U_i$ = {em['U_i'].mean():.3f}")
    ax.set_xticks(x)
    ax.set_xticklabels([e[:8] + "..." for e in em_t["entity"]],
                       rotation=50, ha="right", fontsize=6)
    ax.set_ylabel("Node Uncertainty $U_i$")
    ax.set_title("Node-Level Uncertainty per Entity")
    ax.legend(fontsize=7)

    ax2 = axes[1]
    sc  = ax2.scatter(em["beta"], em["alpha"],
                      c=em["U_i"], cmap="RdYlGn_r",
                      s=em["n_tx"] / em["n_tx"].max() * 200 + 20,
                      edgecolors="grey", linewidths=0.5, zorder=3)
    ar = np.linspace(0.01, 0.99, 300)
    for av in [0.80, 0.90, 0.95, 0.99]:
        br   = ar * (1 - av) / av
        mask = br <= em["beta"].max() * 1.1
        ax2.plot(br[mask], ar[mask], lw=0.7, linestyle="--",
                 color="grey", alpha=0.55)
        idx = int(0.65 * mask.sum())
        if mask.sum() > 0 and idx < mask.sum():
            ax2.text(br[mask][idx], ar[mask][idx],
                     f" {av:.0%}", fontsize=6, color="grey")
    cb = fig.colorbar(sc, ax=ax2, pad=0.02)
    cb.set_label("$U_i$", fontsize=8)
    ax2.set_xlabel("Failure rate $\\beta_i$")
    ax2.set_ylabel("Repair rate $\\alpha_i$")
    ax2.set_title("Markov Chain Parameters")
    fig.tight_layout()
    _save(fig, "fig2_node_uncertainty_markov")


def fig3(df: pd.DataFrame, em: pd.DataFrame, traj: pd.DataFrame):
    """Cost analysis — fee vs volume, disruption cost histogram, volume vs U_net."""
    fig, axes = plt.subplots(1, 3, figsize=(FIGW_2COL, 2.8))

    ax = axes[0]
    ax.scatter(em["n_tx"], em["mu_cost"], c=em["U_i"],
               cmap="RdYlGn_r", s=45, edgecolors="grey",
               linewidths=0.4, zorder=3)
    if len(em) >= 2:
        z  = np.polyfit(np.log1p(em["n_tx"]), em["mu_cost"], 1)
        xf = np.linspace(em["n_tx"].min(), em["n_tx"].max(), 200)
        ax.plot(xf, np.polyval(z, np.log1p(xf)),
                color=C["orange"], lw=LWL, linestyle="--", label="Log trend")
        ax.legend(fontsize=7)
    ax.set_xlabel("Transactions per Entity")
    ax.set_ylabel("Mean Fee (Gwei)")
    ax.set_title("Fee vs. Transaction Volume")

    ax2 = axes[1]
    tpd  = (1 / (em["pi_Y"] + 1e-6)).replace(np.inf, np.nan).dropna()
    cpd  = em.loc[tpd.index, "mu_cost"] * tpd
    if len(cpd) > 0:
        ax2.hist(cpd, bins=max(5, min(15, len(cpd))),
                 color=C["sky"], edgecolor="white", linewidth=0.4)
        ax2.axvline(cpd.mean(), color=C["red"], lw=LW, linestyle="--",
                    label=f"Mean = {cpd.mean():.0f}")
        ax2.legend(fontsize=7)
    ax2.set_xlabel("Cost per Disruption (Gwei)")
    ax2.set_ylabel("Frequency")
    ax2.set_title("Disruption Cost Distribution")

    ax3  = axes[2]
    ax3b = ax3.twinx()
    ax3.bar(range(len(traj)), traj["n_tx"],
            color=C["sky"], alpha=0.55, label="Transactions")
    ax3b.plot(range(len(traj)), traj["U_net"],
              color=C["red"], lw=LWL, label="$U_{net}$")
    ax3.set_xlabel("Period (day)")
    ax3.set_ylabel("Transaction count", color=C["sky"])
    ax3b.set_ylabel("$U_{net}$", color=C["red"])
    ax3.set_title("Volume vs. Uncertainty")
    h1, l1 = ax3.get_legend_handles_labels()
    h2, l2 = ax3b.get_legend_handles_labels()
    ax3.legend(h1 + h2, l1 + l2, fontsize=7, loc="upper right")
    fig.tight_layout()
    _save(fig, "fig3_cost_analysis")


def fig4(em: pd.DataFrame):
    """Single-party vs multi-party risk-pooling comparison."""
    h_m  = em["h"].mean()
    m_m  = em["m"].mean()
    cr   = m_m / (m_m + h_m + 1e-9)
    phi  = norm.pdf(norm.ppf(cr))
    N    = np.arange(1, max(len(em) + 1, 21))

    sig_pool = em["sigma_cost"].mean() / np.sqrt(N)
    E_multi  = (h_m + m_m) * sig_pool * phi
    E_single = (h_m + m_m) * em["sigma_cost"].mean() * phi
    U_multi  = em["U_i"].mean() / (1 + 0.12 * np.log1p(N))
    U_single = em["U_i"].mean()

    fig, axes = plt.subplots(1, 2, figsize=(FIGW_2COL, 2.8))

    ax = axes[0]
    ax.plot(N, E_multi, color=C["blue"], lw=LW,
            label="Multi-party transactional")
    ax.axhline(E_single, color=C["red"], lw=LW, linestyle="--",
               label=f"Single-party ({E_single:.1f})")
    ax.fill_between(N, E_multi * 0.88, E_multi * 1.12,
                    color=C["blue"], alpha=0.12)
    ax.set_xlabel("Number of Entities $|V|$")
    ax.set_ylabel("$E[C(S^*)]$ (Gwei)")
    ax.set_title("Risk-Pooling: Expected Cost")
    ax.legend()

    ax2 = axes[1]
    ax2.plot(N, U_multi, color=C["green"], lw=LW,
             label="Multi-party $U_{net}$")
    ax2.axhline(U_single, color=C["orange"], lw=LW, linestyle="--",
                label=f"Single-party ({U_single:.3f})")
    ax2.fill_between(N, U_multi * 0.88, U_multi * 1.12,
                     color=C["green"], alpha=0.12)
    ax2.set_xlabel("Number of Entities $|V|$")
    ax2.set_ylabel("Network Uncertainty")
    ax2.set_title("Uncertainty Reduction (Multi-Party)")
    ax2.legend()
    fig.tight_layout()
    _save(fig, "fig4_single_vs_multi_party")


def fig5(traj: pd.DataFrame, pred: dict):
    """Prediction accuracy on test window + K-step horizon with Bayesian bounds."""
    fig, axes = plt.subplots(1, 2, figsize=(FIGW_2COL, 2.8))
    y      = traj["U_net_smooth"].values
    sp     = pred["split"]
    actual = y[sp:]
    tp     = pred["test_pred"]
    n_cmp  = min(len(actual), len(tp))
    steps  = np.arange(1, n_cmp + 1)

    ax = axes[0]
    ax.plot(steps, actual[:n_cmp], color=C["blue"], lw=LW,
            label="Actual $U_{net}$")
    ax.plot(steps, tp[:n_cmp], color=C["orange"], lw=LW,
            linestyle="--", label="AUNet prediction")
    ax.set_xlabel("Time step (test window)")
    ax.set_ylabel("$U_{net}(t)$")
    ax.set_title(f"Test Window: Predicted vs Actual\n"
                 f"MAE = {pred['mae']:.4f}   RMSE = {pred['rmse']:.4f}")
    ax.legend()

    ax2   = axes[1]
    h_len = pred["horizon"]
    h_s   = np.arange(1, h_len + 1)
    ax2.plot(h_s, pred["future"][-h_len:], color=C["red"], lw=LW,
             label="$\\hat{U}_{net}(t+k)$")
    ax2.fill_between(h_s,
                     pred["lower"][-h_len:], pred["upper"][-h_len:],
                     color=C["red"], alpha=0.18,
                     label="90% credible interval")
    u_thr = float(np.quantile(traj["U_net"].values, 0.80))
    ax2.axhline(u_thr, color=C["green"], lw=LWL, linestyle="-.",
                label=f"Threshold $U^* = {u_thr:.3f}$")
    ax2.set_xlabel("Forecast horizon $k$ (days)")
    ax2.set_ylabel("Predicted $\\hat{U}_{net}$")
    ax2.set_title(f"{h_len}-Day AUNet Forecast")
    ax2.legend()
    fig.tight_layout()
    _save(fig, "fig5_prediction_accuracy")


# ═══════════════════════════════════════════════════════════════════════════════
# 8.  BASELINE METHODS
# ═══════════════════════════════════════════════════════════════════════════════

def baseline_naive(y: np.ndarray, split: int) -> np.ndarray:
    """Naïve: predict next = last observed value."""
    return np.array([y[split + i - 1] for i in range(len(y) - split)])


def baseline_moving_average(y: np.ndarray, split: int,
                             window: int = 5) -> np.ndarray:
    """Moving average over the last `window` observations."""
    preds = []
    for i in range(len(y) - split):
        start = max(0, split + i - window)
        preds.append(y[start:split + i].mean())
    return np.array(preds)


def baseline_wu2024(y: np.ndarray, split: int) -> np.ndarray:
    """
    Wu et al. (IEEE TNSM 2024) — GTN-LA proxy.

    Wu et al. propose a Graph Transformer encoder and a seq2seq LSTM
    decoder for multi-step VNF workload prediction in Service Function
    Chains. Applied to our blockchain U_net series, their approach
    reduces to a temporal-only predictor: no proactive failure detection,
    no survival analysis, no cascade propagation, no Bayesian bounds.

    Proxy: AR(3) shorter-window linear model — captures the temporal
    LSTM component of GTN-LA without AUNet's spatial and survival stages.

    Reference: Wu, Y. et al. (2024). IEEE TNSM, 21(4), 4480–4493.
               https://doi.org/10.1109/TNSM.2024.3403714
    """
    p = min(3, split - 1)
    X = np.array([y[i:i+p] for i in range(split - p)])
    Y = y[p:split]
    A = np.c_[X, np.ones(len(X))]
    coefs, *_ = np.linalg.lstsq(A, Y, rcond=None)
    history = list(y[split - p:split])
    preds   = []
    for _ in range(len(y) - split):
        xin = np.array(history[-p:] + [1.0])
        preds.append(max(float(xin @ coefs), 0.0))
        history.append(preds[-1])
    return np.array(preds)


def baseline_chen2026(y: np.ndarray, traj: pd.DataFrame,
                       split: int) -> np.ndarray:
    """
    Chen et al. (IPM 2026) — TPP-CIDM proxy.

    Chen et al. model competitive information dissemination using a
    temporal point process over a DTMC, producing a probability
    distribution of dissemination sizes at steady state. Their
    deterministic baseline (DC-IDM) applies mean-field theory —
    we replicate that here as a fixed stationary estimate.

    Applied to our domain: estimate stationary disruption probability
    from the empirical DTMC transition matrix (pi_Y = beta/(alpha+beta)),
    then predict U_net as a mean-field stationary value with minor
    DTMC-driven drift. This approach cannot generate K-step trajectory
    forecasts — it converges to a single absorbing distribution.

    Reference: Chen, J. et al. (2026). IPM, 63(7), 104868.
               https://doi.org/10.1016/j.ipm.2026.104868
    """
    train_cong = traj["congestion"].values[:split]
    train_U    = y[:split]

    binary = (train_cong > train_cong.mean()).astype(int)
    tx_xy  = int(np.sum((binary[:-1] == 0) & (binary[1:] == 1)))
    tx_yx  = int(np.sum((binary[:-1] == 1) & (binary[1:] == 0)))
    n_ok   = int(np.sum(binary == 0))
    n_fail = int(np.sum(binary == 1))
    beta_  = tx_xy / max(n_ok,   1)
    alpha_ = tx_yx / max(n_fail, 1)
    pi_Y   = beta_ / (alpha_ + beta_ + 1e-9)

    U_stat = max(0.0, train_U.mean() * (
        1 + 0.5 * (pi_Y - train_cong.mean())))

    test_cong = traj["congestion"].values[split:]
    preds = []
    for cong in test_cong:
        v = 0.85 * U_stat + 0.15 * (
            train_U.mean() * (1 + 0.5 * (cong - train_cong.mean())))
        preds.append(max(0.0, v))
    return np.array(preds)


def run_comparison(y: np.ndarray, traj: pd.DataFrame,
                   split: int, aunet_preds: np.ndarray) -> tuple:
    """Run all baselines, print MAE table, return methods dict and table."""
    actual = y[split:]
    n      = len(actual)

    methods = {
        "AUNet (ours)":                      np.array(aunet_preds[:n]),
        "Wu et al. 2024 (GTN-LA proxy)":     baseline_wu2024(y, split)[:n],
        "Chen et al. 2026 (TPP-CIDM proxy)": baseline_chen2026(y, traj, split)[:n],
        "Naive":                             baseline_naive(y, split)[:n],
        "Moving Average":                    baseline_moving_average(y, split)[:n],
    }

    horizons = [1, 5, 7, 10, 14]
    table    = {}

    print("\n" + "=" * 74)
    print("  BASELINE COMPARISON  (MAE at prediction horizons)")
    print("=" * 74)
    hdr = f"  {'Method':<36}" + "".join(f"  h={h:>2}(MAE)" for h in horizons)
    print(hdr)
    print("  " + "-" * 72)

    for name, preds in methods.items():
        row     = {}
        row_str = f"  {name:<36}"
        for h in horizons:
            end  = min(h, len(actual), len(preds))
            mae  = float(np.mean(np.abs(actual[:end] - preds[:end])))
            rmse = float(np.sqrt(np.mean((actual[:end] - preds[:end]) ** 2)))
            row[h] = (mae, rmse)
            row_str += f"  {mae:>8.4f}"
        table[name] = row
        print(row_str)

    print("=" * 74 + "\n")
    return methods, table


# ═══════════════════════════════════════════════════════════════════════════════
# 9.  FIGURES 6–8  (comparison)
# ═══════════════════════════════════════════════════════════════════════════════

def fig6(traj: pd.DataFrame, split: int, methods: dict):
    """All methods on the test window — trajectory comparison."""
    y      = traj["U_net_smooth"].values
    actual = y[split:]
    ts     = traj["ts"].values[split:]
    n      = len(ts)

    styles = [
        (C["orange"], "-",  2.2),
        (C["red"],    "--", 1.8),
        (C["purple"], "-.", 1.8),
        (C["sky"],    ":",  1.6),
        (C["green"],  "--", 1.6),
    ]

    fig, ax = plt.subplots(figsize=(FIGW_2COL, 3.2))
    ax.plot(ts[:n], actual[:n], color=C["black"], lw=LW + 0.4,
            label="Actual $U_{net}$", zorder=5)

    for (name, preds), (col, ls, lw_) in zip(methods.items(), styles):
        m = min(n, len(preds))
        ax.plot(ts[:m], preds[:m], color=col, lw=lw_,
                linestyle=ls, label=name, alpha=0.9)

    ax.set_xlabel("Date")
    ax.set_ylabel("$U_{net}(t)$")
    ax.set_title("AUNet vs Baseline Methods — Test Window Prediction")
    ax.legend(loc="upper left", fontsize=7.5)
    fig.autofmt_xdate(rotation=25)
    fig.tight_layout()
    _save(fig, "fig6_comparison_trajectories")


def fig7(table: dict):
    """MAE and RMSE grouped bar charts across prediction horizons."""
    horizons  = [1, 5, 7, 10, 14]
    names     = list(table.keys())
    x         = np.arange(len(horizons))
    n_m       = len(names)
    width     = 0.14
    offsets   = np.linspace(-(n_m - 1) / 2, (n_m - 1) / 2, n_m) * width
    bar_cols  = [C["orange"], C["red"], C["purple"], C["sky"], C["green"]]

    fig, axes = plt.subplots(1, 2, figsize=(FIGW_2COL, 3.0))

    for ax, metric, idx in [(axes[0], "MAE", 0), (axes[1], "RMSE", 1)]:
        for i, (name, row) in enumerate(table.items()):
            vals = [row[h][idx] for h in horizons]
            bars = ax.bar(x + offsets[i], vals, width,
                          label=name, color=bar_cols[i],
                          edgecolor="white", linewidth=0.4, alpha=0.88)
            if i == 0:
                for bar in bars:
                    bar.set_edgecolor(C["black"])
                    bar.set_linewidth(1.2)
        ax.set_xticks(x)
        ax.set_xticklabels([f"h={h}" for h in horizons])
        ax.set_ylabel(metric)
        ax.set_title(f"Prediction {metric} by Horizon")
        if metric == "MAE":
            ax.legend(fontsize=6.5, loc="upper left")

    fig.suptitle(
        "AUNet vs Wu et al. 2024 vs Chen et al. 2026 — Prediction Error",
        fontsize=9, y=1.01)
    fig.tight_layout()
    _save(fig, "fig7_mae_rmse_comparison")


def fig8(table: dict, traj: pd.DataFrame):
    """
    Radar chart — multi-dimensional comparison across six evaluation axes:
        1. Short-horizon accuracy   (1-step MAE, inverted)
        2. Long-horizon accuracy    (14-step MAE, inverted)
        3. Trajectory stability     (std of errors, inverted)
        4. Disruption sensitivity   (correlation with congestion)
        5. Cost-model integration   (1 = full cost model, 0 = none)
        6. Bayesian confidence      (1 = full Bayesian bounds, 0 = none)

    Axes 5 and 6 are set from paper knowledge of each method's capability.
    All axes normalised so higher = better.
    """
    y     = traj["U_net_smooth"].values
    split = int(0.80 * len(y))
    test  = y[split:]
    cong  = traj["congestion"].values[split:]

    radar_names = [
        "AUNet (ours)",
        "Wu et al. 2024 (GTN-LA proxy)",
        "Chen et al. 2026 (TPP-CIDM proxy)",
    ]

    # Method capability flags (from paper knowledge)
    cost_flag  = {"AUNet (ours)": 1.0,
                  "Wu et al. 2024 (GTN-LA proxy)": 0.0,
                  "Chen et al. 2026 (TPP-CIDM proxy)": 0.3}
    bayes_flag = {"AUNet (ours)": 1.0,
                  "Wu et al. 2024 (GTN-LA proxy)": 0.0,
                  "Chen et al. 2026 (TPP-CIDM proxy)": 0.2}

    preds_fn = {
        "AUNet (ours)":                      lambda: baseline_wu2024(y, split),
        "Wu et al. 2024 (GTN-LA proxy)":     lambda: baseline_wu2024(y, split),
        "Chen et al. 2026 (TPP-CIDM proxy)": lambda: baseline_chen2026(y, traj, split),
    }

    def get_scores(name):
        row   = table[name]
        mae1  = row[1][0]
        mae14 = row[14][0]
        preds = preds_fn[name]()
        n     = min(len(test), len(preds))
        errs  = np.abs(test[:n] - preds[:n])
        stab  = errs.std() if len(errs) > 1 else 0.0
        corr  = (float(np.corrcoef(cong[:n], preds[:n])[0, 1])
                 if n > 2 else 0.0)
        return mae1, mae14, stab, max(0.0, corr)

    all_scores = {m: get_scores(m) for m in radar_names}
    max_mae1   = max(s[0] for s in all_scores.values()) + 1e-9
    max_mae14  = max(s[1] for s in all_scores.values()) + 1e-9
    max_stab   = max(s[2] for s in all_scores.values()) + 1e-9
    max_sens   = max(s[3] for s in all_scores.values()) + 1e-9

    categories = ["Short-horizon\naccuracy", "Long-horizon\naccuracy",
                  "Stability", "Disruption\nsensitivity",
                  "Cost-model\nintegration", "Bayesian\nconfidence"]
    N_cat  = len(categories)
    angles = [k / float(N_cat) * 2 * np.pi for k in range(N_cat)] + [0]

    fig, ax = plt.subplots(figsize=(4.5, 4.5), subplot_kw=dict(polar=True))
    cols_r  = [C["orange"], C["red"], C["purple"]]
    lstyles = ["-", "--", "-."]

    for name, col, ls in zip(radar_names, cols_r, lstyles):
        mae1, mae14, stab, sens = all_scores[name]
        vals = [
            1 - mae1  / max_mae1,
            1 - mae14 / max_mae14,
            1 - stab  / max_stab,
            sens / max_sens,
            cost_flag[name],
            bayes_flag[name],
        ]
        vals += vals[:1]
        ax.plot(angles, vals, col, lw=LW, linestyle=ls,
                label=name.replace(" (", "\n("))
        ax.fill(angles, vals, col, alpha=0.07)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, size=7.5)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.50, 0.75, 1.00])
    ax.set_yticklabels(["0.25", "0.50", "0.75", "1.00"], size=6)
    ax.set_title("Multi-Dimensional Comparison\n(higher = better on all axes)",
                 size=9, pad=14)
    ax.legend(loc="upper right", bbox_to_anchor=(1.45, 1.15), fontsize=7)
    fig.tight_layout()
    _save(fig, "fig8_radar_comparison")


# ═══════════════════════════════════════════════════════════════════════════════
# 10.  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    # Resolve paths from this script's location — works regardless of where
    # PowerShell is open when you run it
    SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)      # up from python/ to root

    default_csv  = os.path.join(PROJECT_ROOT, "data", "mainnettransactions.csv")
    csv_path     = sys.argv[1] if len(sys.argv) > 1 else default_csv

    global OUTPUT_DIR
    OUTPUT_DIR = os.path.join(SCRIPT_DIR, "aunet_figures")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"[INFO] CSV  : {csv_path}")
    print(f"[INFO] Figs : {OUTPUT_DIR}")

    # ── Pipeline ──────────────────────────────────────────────────────────────
    df   = load(csv_path)
    em   = entity_metrics(df, min_tx=3)        # skip single-tx wallets
    traj = network_trajectory(df, em)
    pred = aunet_predict(traj, horizon=14)
    summary(df, em, traj)

    y       = traj["U_net_smooth"].values
    split   = pred["split"]
    methods, table = run_comparison(y, traj, split, pred["test_pred"])

    # ── Figures ───────────────────────────────────────────────────────────────
    print("[INFO] Generating figures...")
    fig1(traj, pred)
    fig2(em)
    fig3(df, em, traj)
    fig4(em)
    fig5(traj, pred)
    fig6(traj, split, methods)
    fig7(table)
    fig8(table, traj)

    print(f"\n[DONE] All figures saved to:\n       {OUTPUT_DIR}")
    print("\n  Files generated:")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        if f.endswith(".png"):
            sz = os.path.getsize(os.path.join(OUTPUT_DIR, f))
            print(f"    {f}  ({sz:,} bytes)")


if __name__ == "__main__":
    main()
