"""Execute the notebook workflow in order, then validate processed outputs."""

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_DIR = ROOT / "notebooks"
NOTEBOOKS = [
    "01_data_quality.ipynb",
    "02_data_cleaning.ipynb",
    "03_eda_and_kpis.ipynb",
]


def main() -> None:
    for notebook in NOTEBOOKS:
        print(f"Executing {notebook}...")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "nbconvert",
                "--to",
                "notebook",
                "--execute",
                "--inplace",
                "--ExecutePreprocessor.timeout=600",
                notebook,
            ],
            cwd=NOTEBOOK_DIR,
            check=True,
        )

    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_project.py")],
        cwd=ROOT,
        check=True,
    )
    print("Pipeline completed successfully.")


if __name__ == "__main__":
    main()
