#!/usr/bin/env python3
"""Pobiera WCEP-10 (klastry newsów o tym samym evencie) do data/wcep/."""

import zipfile
from pathlib import Path

from huggingface_hub import hf_hub_download

REPO = "ccdv/WCEP-10"
ROOT = Path(__file__).resolve().parent
DEST = ROOT / "data" / "wcep"
RAW_FILE = DEST / "train.txt"


def download_wcep() -> Path:
    if RAW_FILE.exists():
        print(f"Dataset już jest w {RAW_FILE}")
        return RAW_FILE

    print(f"Pobieram {REPO} train.zip ...")
    zip_path = hf_hub_download(repo_id=REPO, filename="train.zip", repo_type="dataset")
    DEST.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        member = next(name for name in archive.namelist() if name.endswith("train.txt"))
        RAW_FILE.write_bytes(archive.read(member))
    print(f"Zapisano {RAW_FILE}")
    return RAW_FILE


if __name__ == "__main__":
    download_wcep()
