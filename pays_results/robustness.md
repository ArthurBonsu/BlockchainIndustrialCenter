# PAYS RBF robustness (rolling-origin, tuned baselines)

Source: Ethereum Sepolia (D), 3000 blocks, 5 expanding-window folds. All models tuned on training parts only.

## gasUtilisation

| Horizon | RBF MAE | Persistence | Best tuned baseline | RBF - best (95% block-bootstrap CI) | DM p (Holm) | Folds RBF wins | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | 0.0532 | 0.0637 | linearTrend 0.0566 | -0.0034 [-0.0058, -9.00e-4] | 0.272 | 5/5 | PARTIAL: beats persistence, no significant difference from best tuned baseline (linearTrend) |
| 2 | 0.0531 | 0.0646 | expSmoothing 0.0569 | -0.0038 [-0.0086, -2.73e-4] | 0.680 | 1/5 | PARTIAL: beats persistence, no significant difference from best tuned baseline (expSmoothing) |
| 4 | 0.0564 | 0.0667 | expSmoothing 0.0580 | -0.0016 [-0.0042, 3.53e-4] | 1.000 | 1/5 | PARTIAL: beats persistence, no significant difference from best tuned baseline (expSmoothing) |

## txCount

| Horizon | RBF MAE | Persistence | Best tuned baseline | RBF - best (95% block-bootstrap CI) | DM p (Holm) | Folds RBF wins | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | 16.2723 | 21.7214 | expSmoothing 15.9431 | 0.3292 [0.1441, 0.5151] | 0.019 | 0/5 | PARTIAL: beats persistence, but expSmoothing is significantly better |
| 2 | 16.1597 | 22.5522 | expSmoothing 15.9699 | 0.1898 [0.0636, 0.3224] | 0.168 | 0/5 | PARTIAL: beats persistence, no significant difference from best tuned baseline (expSmoothing) |
| 4 | 16.1309 | 22.1963 | expSmoothing 16.0038 | 0.1272 [-0.0150, 0.2838] | 1.000 | 2/5 | PARTIAL: beats persistence, no significant difference from best tuned baseline (expSmoothing) |

## baseFee

| Horizon | RBF MAE | Persistence | Best tuned baseline | RBF - best (95% block-bootstrap CI) | DM p (Holm) | Folds RBF wins | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | 0.0025 | 0.0019 | linearTrend 9.96e-4 | 0.0015 [2.81e-4, 0.0034] | 0.533 | 2/5 | INCONCLUSIVE: no significant gain over persistence after Holm correction |
| 2 | 0.0037 | 0.0037 | linearTrend 0.0019 | 0.0018 [2.98e-4, 0.0039] | 0.480 | 1/5 | INCONCLUSIVE: no significant gain over persistence after Holm correction |
| 4 | 0.0081 | 0.0072 | linearTrend 0.0041 | 0.0040 [9.02e-4, 0.0082] | 0.603 | 2/5 | INCONCLUSIVE: no significant gain over persistence after Holm correction |

- RBF settings and every baseline are tuned on the training part of each fold only.
- Significance: Diebold-Mariano with Newey-West variance, Holm-adjusted across all comparisons; interval: moving-block bootstrap.
- Single recorded Sepolia window; generalisation to other periods or to Ethereum mainnet is not tested here.
