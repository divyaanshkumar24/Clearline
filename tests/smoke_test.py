"""Quick smoke test to confirm all core dependencies import correctly.

Run with: python tests/smoke_test.py
"""

import importlib

PACKAGES = [
    "faster_whisper",
    "pyannote.audio",
    "transformers",
    "torch",
    "ruptures",
    "anthropic",
    "dotenv",
    "pytest",
    "librosa",
    "soundfile",
]


def main() -> None:
    failures = []
    for name in PACKAGES:
        try:
            importlib.import_module(name)
            print(f"OK   {name}")
        except Exception as exc:
            failures.append((name, exc))
            print(f"FAIL {name}: {exc}")

    if failures:
        raise SystemExit(f"\n{len(failures)} package(s) failed to import.")

    print("\nAll packages imported successfully.")


if __name__ == "__main__":
    main()
