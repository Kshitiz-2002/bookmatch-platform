# recs-service/recs/trainer.py
import os
import time
import joblib
import numpy as np
from typing import Callable, Optional, Tuple, Dict, List
from scipy.sparse import coo_matrix, csr_matrix, vstack, hstack

try:
    import implicit
    _HAS_IMPLICIT = True
except Exception:
    _HAS_IMPLICIT = False

UserID = str
ItemID = str
Score = float


class Trainer:
    """
    Trainer that supports:
      - training an implicit ALS model (if 'implicit' is available)
      - persisting user/item maps, user_item matrix, and model artifact
      - serving recommend_for_user and similar_items with robust handling
    """

    def __init__(self, artifact_dir: str = "./artifacts"):
        self.artifact_dir = artifact_dir
        os.makedirs(self.artifact_dir, exist_ok=True)
        self.model: Optional[Dict] = None
        self.user_map: Dict[str, int] = {}
        self.item_map: Dict[str, int] = {}
        self.rev_user_map: Dict[int, str] = {}
        self.rev_item_map: Dict[int, str] = {}
        self.user_item: Optional[csr_matrix] = None  # user x item csr matrix

    def _load_events_from_csv(self, path: str) -> List[tuple]:
        events: List[tuple] = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 2:
                    continue
                user_id = parts[0]
                book_id = parts[1]
                val = float(parts[2]) if len(parts) > 2 and parts[2] != "" else 1.0
                events.append((user_id, book_id, val))
        return events

    def _build_matrix(self, events: List[tuple]):
        users: Dict[str, int] = {}
        items: Dict[str, int] = {}
        u_idx = 0
        i_idx = 0
        rows, cols, vals = [], [], []
        for (u, i, v) in events:
            if u not in users:
                users[u] = u_idx
                u_idx += 1
            if i not in items:
                items[i] = i_idx
                i_idx += 1
            rows.append(users[u])
            cols.append(items[i])
            vals.append(v)
        self.user_map = users
        self.item_map = items
        self.rev_user_map = {v: k for k, v in users.items()}
        self.rev_item_map = {v: k for k, v in items.items()}
        mat = coo_matrix((np.array(vals, dtype=np.float32), (np.array(rows), np.array(cols))),
                         shape=(u_idx, i_idx))
        return mat

    def train(self, full: bool = False, source_csv: Optional[str] = None,
              on_progress: Optional[Callable[[int], None]] = None) -> Tuple[str, Dict]:
        """
        Train the recommender. If source_csv is provided, load events from that CSV (user,book,value).
        Returns (artifact_path, metrics).
        """
        start = time.time()
        if on_progress:
            on_progress(1)

        if source_csv:
            events = self._load_events_from_csv(source_csv)
        else:
            # small demo dataset if none provided
            events = [("user1", "book1", 1.0), ("user1", "book2", 1.0), ("user2", "book1", 1.0)]

        if on_progress:
            on_progress(5)

        mat = self._build_matrix(events)  # user x item COO
        self.user_item = mat.tocsr()
        item_user = mat.T.tocsr()  # items x users (implicit expects this to fit)

        if on_progress:
            on_progress(10)

        if _HAS_IMPLICIT:
            # train implicit ALS
            model = implicit.als.AlternatingLeastSquares(
                factors=64,
                regularization=0.01,
                iterations=20,
                calculate_training_loss=False
            )
            model.fit(item_user)
            self.model = {"type": "implicit_als", "model": model}
        else:
            # fallback item vectors (normalized)
            item_user_dense = item_user.toarray()
            norms = np.linalg.norm(item_user_dense, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            item_vecs = item_user_dense / norms
            self.model = {"type": "item_vectors", "item_vecs": item_vecs}

        artifact_name = f"model_{int(start)}.joblib"
        artifact_path = os.path.join(self.artifact_dir, artifact_name)

        to_dump = {
            "user_map": self.user_map,
            "item_map": self.item_map,
            "rev_user_map": self.rev_user_map,
            "rev_item_map": self.rev_item_map,
            "model_meta": {"type": self.model["type"]},
            "user_item": self.user_item
        }

        # try to persist model object directly; if that fails try a fallback save path
        try:
            if _HAS_IMPLICIT and self.model["type"] == "implicit_als":
                to_dump["model_obj"] = self.model["model"]
                joblib.dump(to_dump, artifact_path)
            else:
                to_dump["model_obj"] = self.model.get("item_vecs")
                joblib.dump(to_dump, artifact_path)
        except Exception as e:
            # fallback: attempt to save model separately if it supports save()
            try:
                if _HAS_IMPLICIT and hasattr(self.model["model"], "save"):
                    model_file = artifact_path + ".implicit_model.pkl"
                    try:
                        # try implicit's save if available
                        self.model["model"].save(model_file)
                    except Exception:
                        # final fallback: joblib dump the model object
                        joblib.dump(self.model["model"], model_file)
                    to_dump.pop("model_obj", None)
                    to_dump["model_obj_path"] = model_file
                    joblib.dump(to_dump, artifact_path)
                    print("[Trainer] saved model to separate file:", model_file)
                else:
                    # persist what we can (maps + user_item)
                    joblib.dump(to_dump, artifact_path)
                    print("[Trainer] Warning: couldn't persist model object; saved maps + user_item only:", e)
            except Exception as e2:
                print("[Trainer] Critical failure saving artifact:", e, e2)
                raise

        duration = time.time() - start
        metrics = {"duration_s": duration, "n_users": len(self.user_map), "n_items": len(self.item_map)}
        if on_progress:
            on_progress(95)
        return artifact_path, metrics

    def _align_user_item_to_model(self):
        """
        Try to align/truncate/pad self.user_item rows to match the implicit model's user_factors length.
        This is tolerant: if we cannot determine expected users, we do nothing.
        """
        if self.user_item is None or self.model is None:
            return

        expected_n_users = None
        if _HAS_IMPLICIT and self.model.get("type") == "implicit_als":
            m = self.model.get("model")
            if hasattr(m, "user_factors"):
                expected_n_users = int(getattr(m, "user_factors").shape[0])
            elif hasattr(m, "user_items"):
                try:
                    expected_n_users = int(m.user_items.shape[0])
                except Exception:
                    expected_n_users = None

        # nothing to align
        if expected_n_users is None:
            return

        current_rows, current_cols = self.user_item.shape
        expected_n_items = len(self.item_map)

        # align columns (items) first: pad or truncate columns to expected_n_items
        if current_cols != expected_n_items:
            if current_cols < expected_n_items:
                pad_cols = expected_n_items - current_cols
                pad = csr_matrix((current_rows, pad_cols))
                self.user_item = hstack([self.user_item, pad], format="csr")
                print(f"[Trainer] Aligned user_item: padded {pad_cols} zero columns (cols {current_cols} -> {expected_n_items}).")
            else:
                self.user_item = self.user_item[:, :expected_n_items]
                print(f"[Trainer] Aligned user_item: truncated columns {current_cols} -> {expected_n_items}.")

        # align rows (users)
        current_rows = self.user_item.shape[0]
        if current_rows != expected_n_users:
            if current_rows < expected_n_users:
                extra = expected_n_users - current_rows
                pad = csr_matrix((extra, self.user_item.shape[1]))
                self.user_item = vstack([self.user_item, pad], format="csr")
                print(f"[Trainer] Aligned user_item: padded {extra} zero rows to match model.user_factors ({expected_n_users}).")
            else:
                self.user_item = self.user_item[:expected_n_users]
                print(f"[Trainer] Aligned user_item: truncated rows {current_rows} -> {expected_n_users} to match model.user_factors.")

    def _ensure_loaded(self):
        if self.model is not None:
            return

        candidates = [f for f in os.listdir(self.artifact_dir) if f.endswith(".joblib")]
        if not candidates:
            raise RuntimeError("No trained model available")
        latest = sorted(candidates)[-1]
        artifact_path = os.path.join(self.artifact_dir, latest)
        data = joblib.load(artifact_path)

        self.user_map = data.get("user_map", {})
        self.item_map = data.get("item_map", {})
        self.rev_user_map = data.get("rev_user_map", {})
        self.rev_item_map = data.get("rev_item_map", {})
        self.user_item = data.get("user_item", None)

        meta = data.get("model_meta", {}) or {}
        mtype = meta.get("type")

        if mtype == "implicit_als" and _HAS_IMPLICIT:
            model_obj = data.get("model_obj", None)
            if model_obj is not None:
                self.model = {"type": "implicit_als", "model": model_obj}
            else:
                model_obj_path = data.get("model_obj_path", None)
                if model_obj_path and os.path.exists(model_obj_path):
                    try:
                        loaded = joblib.load(model_obj_path)
                        self.model = {"type": "implicit_als", "model": loaded}
                    except Exception as e:
                        raise RuntimeError("Failed to load implicit model object from path: " + str(e))
                else:
                    raise RuntimeError("Implicit model object not found in artifact; please retrain with model persistence enabled.")
        else:
            item_vecs = data.get("model_obj", None)
            self.model = {"type": mtype or "item_vectors", "item_vecs": item_vecs}

        # try to align user_item to model (pads/truncates as needed)
        try:
            self._align_user_item_to_model()
            if self.user_item is not None:
                print(f"[Trainer] Loaded artifact {artifact_path}; user_item.shape={self.user_item.shape} n_users_map={len(self.user_map)} n_items_map={len(self.item_map)}")
            else:
                print(f"[Trainer] Loaded artifact {artifact_path} but user_item is None")
        except Exception as e:
            print("[Trainer] Warning while aligning user_item:", e)

    def _normalize_recs(self, raw_recs) -> List[Tuple[int, float]]:
        """
        Normalize different return formats of implicit library to a list of (item_idx, score) pairs.
        Supported forms:
          - iterable of (item_idx, score) pairs
          - tuple (items_array, scores_array)
        """
        normalized: List[Tuple[int, float]] = []

        if raw_recs is None:
            return normalized

        # Case: tuple of arrays (items_array, scores_array)
        if isinstance(raw_recs, tuple) and len(raw_recs) == 2:
            items_arr, scores_arr = raw_recs
            try:
                items_list = list(items_arr)
                scores_list = list(scores_arr)
                normalized = [(int(i), float(s)) for i, s in zip(items_list, scores_list)]
                return normalized
            except Exception:
                # fall through to another attempt
                pass

        # Case: iterable of pairs
        try:
            for entry in raw_recs:
                if isinstance(entry, (list, tuple)) and len(entry) >= 2:
                    normalized.append((int(entry[0]), float(entry[1])))
                else:
                    # if entry is array-like length 2
                    try:
                        a, b = entry
                        normalized.append((int(a), float(b)))
                    except Exception:
                        continue
        except TypeError:
            # raw_recs not iterable, try another approach
            try:
                x, y = raw_recs
                normalized = [(int(i), float(s)) for i, s in zip(list(x), list(y))]
            except Exception:
                pass

        return normalized

    def recommend_for_user(self, user_id: UserID, k: int = 20) -> List[Tuple[ItemID, Score]]:
        """
        Return list of (external_book_id, score) recommendations for a given user_id.
        """
        self._ensure_loaded()

        if user_id not in self.user_map:
            # cold-start fallback: return first k items
            items = list(self.item_map.keys())[:k]
            return [(it, 0.0) for it in items]

        uidx = self.user_map[user_id]

        if self.model["type"] == "implicit_als" and _HAS_IMPLICIT:
            model = self.model["model"]

            if self.user_item is None:
                raise RuntimeError("user_item matrix not available. Retrain so artifact contains user_item.")

            # ensure uidx within rows (try align once)
            rows = self.user_item.shape[0]
            if uidx >= rows:
                try:
                    self._align_user_item_to_model()
                except Exception:
                    pass
                rows = self.user_item.shape[0]
                if uidx >= rows:
                    raise RuntimeError(f"user index {uidx} out of range: user_item.shape[0]={rows}, user_map_len={len(self.user_map)}")

            # Pass only the single user's row (1 x n_items)
            user_row = self.user_item[uidx:uidx + 1]

            raw_recs = model.recommend(uidx, user_row, N=k)
            normalized = self._normalize_recs(raw_recs)

            # map internal item idx -> external id
            return [(self.rev_item_map.get(item_idx, str(item_idx)), float(score)) for item_idx, score in normalized]
        else:
            # fallback: simple top-k items (no personalization)
            items = list(self.item_map.keys())[:k]
            return [(it, 0.0) for it in items]

    def similar_items(self, item_id: ItemID, k: int = 10) -> List[Tuple[ItemID, Score]]:
        self._ensure_loaded()
        if item_id not in self.item_map:
            return []
        idx = self.item_map[item_id]

        if self.model["type"] == "implicit_als" and _HAS_IMPLICIT:
            model = self.model["model"]
            try:
                raw = model.similar_items(idx, N=k)
            except Exception as e:
                raise RuntimeError(f"implicit similar_items failed: {e}")

            normalized = self._normalize_recs(raw)
            return [(self.rev_item_map.get(item_idx, str(item_idx)), float(score)) for item_idx, score in normalized]
        else:
            item_vecs = self.model.get("item_vecs")
            if item_vecs is None:
                return []
            v = item_vecs[idx:idx + 1]
            scores = item_vecs @ v.T
            scores = np.asarray(scores).squeeze()
            top_idx = np.argsort(-scores)[:k + 1]
            results: List[Tuple[str, float]] = []
            for i in top_idx:
                if i == idx:
                    continue
                results.append((self.rev_item_map.get(i, str(i)), float(scores[i])))
                if len(results) >= k:
                    break
            return results
