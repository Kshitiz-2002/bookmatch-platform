import os
import shutil
from typing import Dict
from dotenv import load_dotenv
from supabase import create_client, Client
import time

load_dotenv()

ARTIFACT_DIR = os.environ.get("ARTIFACT_DIR", "./artifacts")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
DEFAULT_BUCKET = os.environ.get("DEFAULT_BUCKET", "models")

os.makedirs(ARTIFACT_DIR, exist_ok=True)

class ModelStore:
    """
    Saves model artifacts locally and optionally uploads to Supabase Storage.
    """

    def __init__(self):
        self.supabase: Client | None = None
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            try:
                self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            except Exception as e:
                print("Warning: could not init supabase client:", e)
                self.supabase = None

    def save_model(self, job_id: str, artifact_path: str, metadata: Dict = None) -> str:
        """
        Save model artifact to local artifacts directory (already saved by trainer).
        Optionally upload to supabase storage and return remote path.
        """
        # artifact_path is already in artifacts directory; we ensure we move/copy to a stable name
        dest_name = f"{job_id}_{int(time.time())}.joblib"
        dest_path = os.path.join(ARTIFACT_DIR, dest_name)
        shutil.copy2(artifact_path, dest_path)

        if self.supabase:
            # upload file to bucket
            try:
                with open(dest_path, "rb") as f:
                    res = self.supabase.storage.from_(DEFAULT_BUCKET).upload(dest_name, f)
                    if res and res.get("error"):
                        raise Exception(str(res["error"]))
                    public_url = self.supabase.storage.from_(DEFAULT_BUCKET).get_public_url(dest_name)
                    return public_url.get("publicURL") or dest_path
            except Exception as e:
                print("Supabase upload failed:", e)
                return dest_path
        return dest_path
