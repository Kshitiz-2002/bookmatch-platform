# recs-service/debug_recs.py
import sys, os, traceback
import joblib
import numpy as np
from scipy.sparse import csr_matrix, vstack

if len(sys.argv) < 2:
    print("Usage: python debug_recs.py <artifact_path>")
    sys.exit(1)

artifact = sys.argv[1]
if not os.path.exists(artifact):
    print("Artifact not found:", artifact); sys.exit(1)

print("Loading artifact:", artifact)
data = joblib.load(artifact)
print("Artifact keys:", list(data.keys()))

user_map = data.get("user_map", {})
item_map = data.get("item_map", {})
user_item = data.get("user_item", None)
model_obj = data.get("model_obj", None)
model_obj_path = data.get("model_obj_path", None)

print("user_map size:", len(user_map))
print("item_map size:", len(item_map))
print("user_map sample:", list(user_map.items())[:20])
if user_item is None:
    print("user_item: NOT FOUND in artifact")
else:
    print("user_item.shape:", getattr(user_item, "shape", None), "type:", type(user_item))

print("model_obj present?:", model_obj is not None)
print("model_obj_path:", model_obj_path)

# If implicit is available, examine internal factors
try:
    if model_obj is not None:
        m = model_obj
        print("Model object type:", type(m))
        # If implicit ALS
        if hasattr(m, "user_factors") and hasattr(m, "item_factors"):
            uf = getattr(m, "user_factors")
            itf = getattr(m, "item_factors")
            print("model.user_factors.shape:", getattr(uf, "shape", None))
            print("model.item_factors.shape:", getattr(itf, "shape", None))
        else:
            print("Model object doesn't expose user_factors/item_factors (type info shown).")
    else:
        print("No model_obj in artifact; maybe only item_vecs persisted.")
except Exception as e:
    print("Error inspecting model object:", e)
    traceback.print_exc()

# helper to try recommend for a given uid (internal index)
def try_recommend(m, user_items, internal_uid, N=5):
    print(f"\nAttempting recommend(uid={internal_uid}, N={N})")
    try:
        recs = m.recommend(internal_uid, user_items, N=N)
        print("Recommend result (internal idx -> score):", recs)
    except Exception as e:
        print("Recommend FAILED with exception:", repr(e))
        traceback.print_exc()
        raise

# if we have model and user_item, attempt recommendations
if (model_obj is not None) and (user_item is not None):
    m = model_obj
    # ensure csr format
    if not isinstance(user_item, csr_matrix):
        try:
            user_item = csr_matrix(user_item)
        except Exception:
            pass

    # get number of users in matrix
    rows = user_item.shape[0]
    print("user_item rows:", rows, "columns:", user_item.shape[1])

    # attempt recommend for each user in user_map (by internal index)
    for user_str, uidx in list(user_map.items()):
        print(f"\n--- TEST user_str='{user_str}' internal uid={uidx} ---")
        try:
            try_recommend(m, user_item, uidx, N=5)
            print(f"SUCCESS for user {user_str} (uid={uidx})")
        except Exception as e:
            print(f"First attempt failed for {user_str}: {e}")
            # attempt an align (pad/truncate rows) based on model.user_factors if available
            expected_rows = None
            if hasattr(m, "user_factors"):
                expected_rows = getattr(m, "user_factors").shape[0]
                print("Model reports user_factors rows:", expected_rows)
            else:
                print("Model has no user_factors attribute, cannot auto-align reliably.")

            if expected_rows is not None:
                if rows < expected_rows:
                    extra = expected_rows - rows
                    print(f"Padding user_item with {extra} zero rows (rows {rows} -> {expected_rows})")
                    pad = csr_matrix((extra, user_item.shape[1]))
                    user_item_padded = vstack([user_item, pad], format="csr")
                elif rows > expected_rows:
                    print(f"Truncating user_item rows from {rows} -> {expected_rows}")
                    user_item_padded = user_item[:expected_rows, :]
                else:
                    user_item_padded = user_item

                # retry recommend with aligned matrix
                try:
                    try_recommend(m, user_item_padded, uidx, N=5)
                    print("Recommend after align: SUCCESS")
                except Exception as e2:
                    print("Recommend after align STILL FAILED:", e2)
            else:
                print("No expected_rows available; cannot auto-align. Consider retraining with consistent data or inspect model saved object.")

else:
    print("\nInsufficient data to test recommendations (missing model_obj or user_item).")
    if model_obj is None:
        print("model_obj missing.")
    if user_item is None:
        print("user_item missing.")
