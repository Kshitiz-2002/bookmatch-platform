# recs-service/recs/trainer.py
import os
import numpy as np
import joblib
from typing import Callable, Optional, Tuple, Dict, List
from scipy.sparse import coo_matrix
import time
import json

# Try to import implicit (ALS for implicit feedback). If not available, we'll fallback to a simple item-item similarity.
try:
    import implicit
    _HAS_IMPLICIT = True
except Exception:
    _HAS_IMPLICIT = False

# simple alias types
UserID = str
ItemID = str
Score = float

class Trainer:
    """
    Trainer encapsulates model training and in-memory model access for recommendations.
    - For implicit feedback we expect input CSV with (user_id, book_id, event_value) or can accept direct matrices.
    - The trainer persists artifacts (joblib) and keeps loaded model in RAM for serving recommendations.
    """

    def __init__(self, artifact_dir: str = "./artifacts"):
        self.artifact_dir = artifact_dir
        os.makedirs(self.artifact_dir, exist_ok=True)
        self.model = None
        self.user_map = {}  # maps user_id -> internal int
        self.item_map = {}  # maps item_id -> internal int (and reverse maps)
        self.rev_user_map = {}
        self.rev_item_map = {}

    def _load_events_from_csv(self, path: str) -> List[tuple]:
        # expect CSV: user_id,book_id,value
        events = []
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                parts = line.split(",")
                if len(parts) < 2:
                    continue
                user_id = parts[0].strip()
                book_id = parts[1].strip()
                val = float(parts[2]) if len(parts) > 2 and parts[2] != "" else 1.0
                events.append((user_id, book_id, val))
        return events

    def _build_matrix(self, events: List[tuple]):
        # assign numeric ids
        users = {}
        items = {}
        u_idx = 0
        i_idx = 0
        rows, cols, vals = [], [], []
        for (u, i, v) in events:
            if u not in users:
                users[u] = u_idx; u_idx += 1
            if i not in items:
                items[i] = i_idx; i_idx += 1
            rows.append(users[u])
            cols.append(items[i])
            vals.append(v)
        # persistent maps
        self.user_map = users
        self.item_map = items
        self.rev_user_map = {v:k for k,v in users.items()}
        self.rev_item_map = {v:k for k,v in items.items()}
        mat = coo_matrix((np.array(vals, dtype=np.float32), (np.array(rows), np.array(cols))), shape=(u_idx, i_idx))
        return mat

    def train(self, full: bool=False, source_csv: Optional[str]=None, on_progress: Optional[Callable[[int], None]]=None) -> Tuple[str, Dict]:
        """
        Train a model.
        - source_csv: path to CSV file with user,book,(value)
        - returns (artifact_path, metrics)
        """
        start = time.time()
        if on_progress:
            on_progress(1)

        if source_csv:
            events = self._load_events_from_csv(source_csv)
        else:
            # For demo: synthetic tiny events (should be replaced with dataset extraction)
            events = [("user1", "book1", 1.0), ("user1", "book2", 1.0), ("user2", "book1", 1.0)]

        if on_progress:
            on_progress(5)

        mat = self._build_matrix(events)  # user x item
        # implicit expects item-user matrix for ALS fitting
        item_user = mat.T.tocsr()

        if on_progress:
            on_progress(10)

        if _HAS_IMPLICIT:
            # configure ALS
            model = implicit.als.AlternatingLeastSquares(factors=64, regularization=0.01, iterations=20, calculate_training_loss=False)
            # implicit library expects confidence values (e.g., alpha * counts). Use mat * 1.0
            # Fit (model expects item_users matrix)
            model.fit(item_user)
            self.model = {"type": "implicit_als", "model": model}
        else:
            # fallback: build simple item-item cosine similarity (dense-ish) for small catalogs
            # compute item vectors via SVD or raw co-occurrence
            # Create item vectors (items x users)
            item_user_dense = item_user.toarray()
            # normalize
            norms = np.linalg.norm(item_user_dense, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            item_vecs = item_user_dense / norms
            # store item_vecs in model
            self.model = {"type": "item_vectors", "item_vecs": item_vecs}

        artifact_name = f"model_{int(start)}.joblib"
        artifact_path = os.path.join(self.artifact_dir, artifact_name)
        # persist maps + model (model may be not serializable by joblib if it contains C-extensions - implicit is joblib-able)
        to_dump = {
            "user_map": self.user_map,
            "item_map": self.item_map,
            "rev_user_map": self.rev_user_map,
            "rev_item_map": self.rev_item_map,
            "model_meta": {"type": self.model["type"]}
        }
        # Save model object separately if using implicit (to avoid joblib issues you can save model via implicit's own saving)
        if _HAS_IMPLICIT and self.model["type"] == "implicit_als":
            # implicit models have save and load methods; joblib them together (works)
            to_dump["model_obj"] = self.model["model"]
            joblib.dump(to_dump, artifact_path)
        else:
            to_dump["model_obj"] = self.model.get("item_vecs")
            joblib.dump(to_dump, artifact_path)

        duration = time.time() - start
        metrics = {"duration_s": duration, "n_users": len(self.user_map), "n_items": len(self.item_map)}
        if on_progress:
            on_progress(95)
        return artifact_path, metrics

    def _ensure_loaded(self):
        if not self.model:
            # try to load latest artifact
            # for demo we search artifacts dir and load newest joblib
            candidates = [f for f in os.listdir(self.artifact_dir) if f.endswith(".joblib")]
            if not candidates:
                raise RuntimeError("No trained model available")
            latest = sorted(candidates)[-1]
            data = joblib.load(os.path.join(self.artifact_dir, latest))
            self.user_map = data["user_map"]
            self.item_map = data["item_map"]
            self.rev_user_map = data["rev_user_map"]
            self.rev_item_map = data["rev_item_map"]
            if data["model_meta"]["type"] == "implicit_als" and _HAS_IMPLICIT:
                self.model = {"type": "implicit_als", "model": data["model_obj"]}
            else:
                self.model = {"type": data["model_meta"]["type"], "item_vecs": data.get("model_obj")}

    def recommend_for_user(self, user_id: UserID, k: int = 20) -> List[tuple]:
        self._ensure_loaded()
        if user_id not in self.user_map:
            # cold-start: recommend popular items (top by item popularity)
            # for demo return first k item ids
            items = list(self.item_map.keys())[:k]
            return [(it, 0.0) for it in items]
        uidx = self.user_map[user_id]
        if self.model["type"] == "implicit_als" and _HAS_IMPLICIT:
            model = self.model["model"]
            # implicit expects user id internal int; call recommend(user, N)
            recs = model.recommend(uidx, N=k)
            # recs: list of (item_internal_index, score)
            return [(self.rev_item_map[item_idx], score) for item_idx, score in recs]
        else:
            # fallback: score items by dot product between user vector and item vecs
            item_vecs = self.model["item_vecs"]  # items x features
            # Build user vector as sum of item vectors the user interacted with
            # For simplicity, use the co-occurrence matrix we built earlier (not persisted) — fallback returns empty
            # In real fallback you should persist user vectors.
            items = list(self.item_map.keys())[:k]
            return [(it, 0.0) for it in items]

    def similar_items(self, item_id: ItemID, k: int = 10) -> List[tuple]:
        self._ensure_loaded()
        if item_id not in self.item_map:
            return []
        idx = self.item_map[item_id]
        if self.model["type"] == "implicit_als" and _HAS_IMPLICIT:
            model = self.model["model"]
            sims = model.similar_items(idx, N=k)
            return [(self.rev_item_map[item_idx], score) for item_idx, score in sims]
        else:
            item_vecs = self.model["item_vecs"]
            v = item_vecs[idx:idx+1]  # 1 x d
            scores = item_vecs @ v.T
            scores = scores.squeeze()
            top_idx = np.argsort(-scores)[:k+1]
            results = []
            for i in top_idx:
                if i == idx:
                    continue
                results.append((self.rev_item_map[i], float(scores[i])))
                if len(results) >= k:
                    break
            return results
