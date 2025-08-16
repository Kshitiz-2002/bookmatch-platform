# recs-service/inspect_artifact.py
import joblib, sys, os

artifact = sys.argv[1] if len(sys.argv) > 1 else "./artifacts/41a430aa-2da1-40fc-9bf1-e64cfb3e3118_1755341655.joblib"
if not os.path.exists(artifact):
    print("Artifact not found:", artifact); sys.exit(1)

data = joblib.load(artifact)
print("Artifact keys:", list(data.keys()))
print("user_map size:", len(data.get("user_map", {})))
print("item_map size:", len(data.get("item_map", {})))
if "user_item" in data:
    ui = data["user_item"]
    try:
        print("user_item shape:", ui.shape, "type:", type(ui))
    except Exception as e:
        print("user_item present but shape read failed:", e)
else:
    print("user_item NOT present in artifact")
print("example user_map items (first 10):", list(data.get("user_map", {}).items())[:10])
