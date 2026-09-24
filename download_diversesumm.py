#!/usr/bin/env python3
"""Pobiera DiverseSumm (pełne artykuły, ten sam event) do data/diversesumm/."""

import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/salesforce/DiverseSumm/main/data/diverse_summ.json"
ROOT = Path(__file__).resolve().parent
RAW_FILE = ROOT / "data" / "diversesumm" / "diverse_summ.json"


def download_diversesumm() -> Path:
    if RAW_FILE.exists() and RAW_FILE.stat().st_size > 1_000_000:
        print(f"Dataset już jest w {RAW_FILE}")
        return RAW_FILE

    RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    print("Pobieram DiverseSumm ...")
    request = urllib.request.Request(URL, headers={"User-Agent": "ASK/2.0"})
    with urllib.request.urlopen(request) as response:
        RAW_FILE.write_bytes(response.read())
    print(f"Zapisano {RAW_FILE}")
    return RAW_FILE


if __name__ == "__main__":
    download_diversesumm()
