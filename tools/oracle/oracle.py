"""產生 TS 迴歸引擎的標準答案。

讀取 tests/fixtures/*.input.json，以 statsmodels / scikit-learn / scipy 計算，
輸出同名的 *.expected.json；另輸出 distributions.expected.json 作為 t / F 分布參考表。

選擇規則（標準化、α 網格、破平手）必須與 design.md D3–D5 及 feature-selection spec 一致。
"""

from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

import numpy as np
import statsmodels.api as sm
from scipy import stats
from sklearn.feature_selection import RFE
from sklearn.linear_model import LinearRegression, enet_path, lasso_path
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from statsmodels.stats.outliers_influence import variance_inflation_factor

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"

N_ALPHAS = 200
ALPHA_MIN_RATIO = 1e-4
PATH_TOL = 1e-10
PATH_MAX_ITER = 1_000_000
ENTRY_REL_THRESHOLD = 1e-9
TIE_REL = 1e-12
ENET_L1_RATIO = 0.5


# ---------- 共用 ----------

def usable_columns(X: np.ndarray) -> list[int]:
    """在此訓練集上非常數的欄位。"""
    return [j for j in range(X.shape[1]) if np.ptp(X[:, j]) > 0]


def standardize(X: np.ndarray, y: np.ndarray):
    mean = X.mean(axis=0)
    std = X.std(axis=0)  # ddof=0，與 StandardScaler 相同
    std[std == 0] = 1.0
    return (X - mean) / std, y - y.mean()


def rss_with_intercept(X: np.ndarray, y: np.ndarray, cols: list[int]) -> float:
    A = np.column_stack([np.ones(len(y)), X[:, cols]])
    if np.linalg.matrix_rank(A) < A.shape[1]:
        return float("inf")
    beta, *_ = np.linalg.lstsq(A, y, rcond=None)
    r = y - A @ beta
    return float(r @ r)


def better(a: float, b: float) -> bool:
    """a 是否嚴格優於 b（考慮相對平手容差）。"""
    if b == float("inf"):
        return a < b
    return a < b - TIE_REL * abs(b)


# ---------- 特徵選擇 ----------

def alpha_grid(Xs: np.ndarray, yc: np.ndarray, l1_ratio: float) -> np.ndarray:
    n = Xs.shape[0]
    alpha_max = np.max(np.abs(Xs.T @ yc)) / (n * l1_ratio)
    return np.geomspace(alpha_max, alpha_max * ALPHA_MIN_RATIO, N_ALPHAS)


def path_order(X: np.ndarray, y: np.ndarray, cand: list[int], l1_ratio: float):
    Xs, yc = standardize(X[:, cand], y)
    alphas = alpha_grid(Xs, yc, l1_ratio)
    if l1_ratio == 1.0:
        _, coefs, _ = lasso_path(Xs, yc, alphas=alphas, tol=PATH_TOL, max_iter=PATH_MAX_ITER)
    else:
        _, coefs, _ = enet_path(
            Xs, yc, l1_ratio=l1_ratio, alphas=alphas, tol=PATH_TOL, max_iter=PATH_MAX_ITER
        )
    thr = ENTRY_REL_THRESHOLD * float(np.std(y))
    entered, never = [], []
    for local, j in enumerate(cand):
        nz = np.nonzero(np.abs(coefs[local]) > thr)[0]
        if len(nz):
            i = int(nz[0])
            entered.append((i, -abs(float(coefs[local, i])), j))
        else:
            never.append(j)
    entered.sort()
    return [j for *_, j in entered] + never, alphas


def sfs_order(X: np.ndarray, y: np.ndarray, cand: list[int]) -> list[int]:
    chosen: list[int] = []
    remaining = list(cand)
    while remaining:
        best_j, best_rss = None, float("inf")
        for j in remaining:
            rss = rss_with_intercept(X, y, chosen + [j])
            if best_j is None or better(rss, best_rss):
                best_j, best_rss = j, rss
        chosen.append(best_j)
        remaining.remove(best_j)
    return chosen


def exhaustive_best(X: np.ndarray, y: np.ndarray, cand: list[int], k: int) -> list[int]:
    best, best_rss = None, float("inf")
    for combo in itertools.combinations(cand, k):
        rss = rss_with_intercept(X, y, list(combo))
        if best is None or better(rss, best_rss):
            best, best_rss = list(combo), rss
    return best


def rfe_select(X: np.ndarray, y: np.ndarray, cand: list[int], k: int) -> list[int]:
    Xs, _ = standardize(X[:, cand], y)
    sel = RFE(LinearRegression(), n_features_to_select=k, step=1).fit(Xs, y)
    return [cand[i] for i in np.nonzero(sel.support_)[0]]


def select(method: str, X: np.ndarray, y: np.ndarray, k: int):
    cand = usable_columns(X)
    if k > len(cand):
        return None
    if method == "lasso":
        return sorted(path_order(X, y, cand, 1.0)[0][:k])
    if method == "enet":
        return sorted(path_order(X, y, cand, ENET_L1_RATIO)[0][:k])
    if method == "sfs":
        return sorted(sfs_order(X, y, cand)[:k])
    if method == "exhaustive":
        return exhaustive_best(X, y, cand, k)
    if method == "rfe":
        return sorted(rfe_select(X, y, cand, k))
    raise ValueError(method)


# ---------- OLS 與推論 ----------

def ols_report(X: np.ndarray, y: np.ndarray, cols: list[int], Xte=None, yte=None) -> dict:
    A = sm.add_constant(X[:, cols], has_constant="add")
    res = sm.OLS(y, A).fit()
    ci = res.conf_int(0.05)
    out = {
        "subset": cols,
        "params": res.params.tolist(),
        "bse": res.bse.tolist(),
        "tvalues": res.tvalues.tolist(),
        "pvalues": res.pvalues.tolist(),
        "ci_lower": ci[:, 0].tolist(),
        "ci_upper": ci[:, 1].tolist(),
        "s": float(np.sqrt(res.scale)),
        "df_resid": float(res.df_resid),
        "rsquared": float(res.rsquared),
        "rsquared_adj": float(res.rsquared_adj),
        "fvalue": float(res.fvalue),
        "f_pvalue": float(res.f_pvalue),
        "vif": None
        if len(cols) < 2
        else [float(variance_inflation_factor(A, i)) for i in range(1, A.shape[1])],
    }
    if Xte is not None:
        At = sm.add_constant(Xte[:, cols], has_constant="add")
        frame = res.get_prediction(At).summary_frame(alpha=0.05)
        pred = frame["mean"].to_numpy()
        resid = yte - pred
        se_obs = np.sqrt(frame["mean_se"].to_numpy() ** 2 + res.scale)
        out["test"] = {
            "pred": pred.tolist(),
            "pi_lower": frame["obs_ci_lower"].tolist(),
            "pi_upper": frame["obs_ci_upper"].tolist(),
            "resid": resid.tolist(),
            "r": (resid / se_obs).tolist(),
            "rmse": float(np.sqrt(mean_squared_error(yte, pred))),
            "mae": float(mean_absolute_error(yte, pred)),
            "r2": float(r2_score(yte, pred)),
        }
    return out


def cv_rmse(method: str, X, y, train, folds, k) -> float | None:
    scores = []
    for val in folds:
        fit = np.setdiff1d(train, val)
        Xf, yf = X[fit], y[fit]
        cols = usable_columns(Xf) if method == "ols" else select(method, Xf, yf, k)
        if cols is None or rss_with_intercept(Xf, yf, cols) == float("inf"):
            return None
        if len(fit) - len(cols) - 1 <= 0:
            return None
        A = np.column_stack([np.ones(len(fit)), Xf[:, cols]])
        beta, *_ = np.linalg.lstsq(A, yf, rcond=None)
        pred = np.column_stack([np.ones(len(val)), X[val][:, cols]]) @ beta
        scores.append(np.sqrt(mean_squared_error(y[val], pred)))
    return float(np.mean(scores))


def pipeline(X, y, train, test, folds, exhaustive_max_p: int) -> dict:
    Xtr, ytr, Xte, yte = X[train], y[train], X[test], y[test]
    p = len(usable_columns(Xtr))
    out: dict = {}

    def entry(cols, method, k):
        rep = ols_report(Xtr, ytr, cols, Xte, yte)
        return {
            "features": cols,
            "test_rmse": rep["test"]["rmse"],
            "test_mae": rep["test"]["mae"],
            "test_r2": rep["test"]["r2"],
            "adj_r2": rep["rsquared_adj"],
            "cv_rmse": cv_rmse(method, X, y, train, folds, k),
        }

    out["ols"] = entry(usable_columns(Xtr), "ols", p)
    for method in ["lasso", "enet", "sfs", "rfe", "exhaustive"]:
        if method == "exhaustive" and p > exhaustive_max_p:
            continue
        out[method] = {str(k): entry(select(method, Xtr, ytr, k), method, k) for k in range(1, p + 1)}
    return out


# ---------- 主程式 ----------

def run_case(path: Path) -> None:
    case = json.loads(path.read_text())
    X = np.asarray(case["X"], dtype=float)
    y = np.asarray(case["y"], dtype=float)
    train = np.asarray(case["train"], dtype=int)
    test = np.asarray(case["test"], dtype=int)
    Xtr, ytr = X[train], y[train]
    cand = usable_columns(Xtr)

    lasso_ord, lasso_alphas = path_order(Xtr, ytr, cand, 1.0)
    enet_ord, enet_alphas = path_order(Xtr, ytr, cand, ENET_L1_RATIO)
    expected = {
        "ols": [ols_report(Xtr, ytr, s, X[test], y[test]) for s in case.get("subsets", [])],
        "lasso": {"alphas": lasso_alphas.tolist(), "order": lasso_ord},
        "enet": {"alphas": enet_alphas.tolist(), "order": enet_ord},
        "sfs_order": sfs_order(Xtr, ytr, cand),
        "rfe": {str(k): sorted(rfe_select(Xtr, ytr, cand, k)) for k in range(1, len(cand) + 1)},
    }
    if len(cand) <= case.get("exhaustiveMaxP", 15):
        expected["exhaustive"] = {
            str(k): exhaustive_best(Xtr, ytr, cand, k) for k in range(1, len(cand) + 1)
        }
    if case.get("folds"):
        folds = [np.asarray(f, dtype=int) for f in case["folds"]]
        expected["pipeline"] = pipeline(X, y, train, test, folds, case.get("exhaustiveMaxP", 15))

    out = path.with_name(path.name.replace(".input.json", ".expected.json"))
    out.write_text(json.dumps(expected, indent=1))
    print(f"wrote {out.relative_to(ROOT)}")


def distributions() -> None:
    dfs = [1, 2, 3, 5, 10, 30, 100, 500]
    ts = [0.0, 0.5, 1.0, 1.96, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0]
    f_pairs = [(1, 1), (1, 10), (2, 5), (3, 46), (5, 34), (12, 391), (30, 300)]
    fs = [0.1, 0.5, 1.0, 2.0, 5.0, 20.0, 100.0, 1000.0]
    ref = {
        "t_two_sided": [
            {"df": d, "t": t, "p": float(2 * stats.t.sf(abs(t), d))} for d in dfs for t in ts
        ],
        "t_cdf": [
            {"df": d, "t": t, "cdf": float(stats.t.cdf(t, d))} for d in dfs for t in [-3.0, -1.0, 0.5, 2.5]
        ],
        "t_ppf_975": [{"df": d, "q": float(stats.t.ppf(0.975, d))} for d in dfs + [4, 7, 44, 45]],
        "f_sf": [
            {"d1": a, "d2": b, "f": f, "p": float(stats.f.sf(f, a, b))} for a, b in f_pairs for f in fs
        ],
    }
    out = FIXTURES / "distributions.expected.json"
    out.write_text(json.dumps(ref, indent=1))
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    targets = [Path(a).resolve() for a in sys.argv[1:]] or sorted(FIXTURES.glob("*.input.json"))
    for t in targets:
        run_case(t)
    distributions()
