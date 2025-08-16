import joblib, numpy as np, sys
artifact = sys.argv[1] if len(sys.argv) > 1 else "./artifacts/model_1755342624.joblib"
d = joblib.load(artifact)
print("keys:", list(d.keys()))
print("n_users:", len(d.get('user_map', {})), "n_items:", len(d.get('item_map', {})))
ui = d.get('user_item', None)
print("user_item shape:", getattr(ui, "shape", None))
m = d.get('model_obj', None)
print("model_obj present:", m is not None)
if m is not None:
    if hasattr(m, 'user_factors'):
        uf = m.user_factors
        itf = m.item_factors
        print("user_factors shape:", getattr(uf, "shape", None))
        print("item_factors shape:", getattr(itf, "shape", None))
        print("user_factors stats: min,max,mean,isnan,isinf:", float(uf.min()), float(uf.max()), float(uf.mean()), bool(np.isnan(uf).any()), bool(np.isinf(uf).any()))
        print("item_factors stats: min,max,mean,isnan,isinf:", float(itf.min()), float(itf.max()), float(itf.mean()), bool(np.isnan(itf).any()), bool(np.isinf(itf).any()))
    else:
        print("Model object lacks user_factors/item_factors, type:", type(m))