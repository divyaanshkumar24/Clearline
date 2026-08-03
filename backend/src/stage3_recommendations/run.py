"""CLI entry point for standalone testing of Stage 3 (sentiment, emotion, pivot, recommendation).

Usage:
    python src/stage3_recommendations/run.py stage2_output.json
    python src/stage3_recommendations/run.py stage2_output.json --output stage3_out.json
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.stage3_recommendations.analyze import analyze_call  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run sentiment/emotion/pivot analysis + LLM recommendation (Stage 3)."
    )
    parser.add_argument("stage2_json", help="Path to a Stage 2 output JSON ({call_id, segments})")
    parser.add_argument("-o", "--output", default=None, help="Write JSON to this file instead of stdout")
    args = parser.parse_args()

    stage2_result = json.loads(Path(args.stage2_json).read_text(encoding="utf-8"))
    result = analyze_call(stage2_result["segments"], call_id=stage2_result.get("call_id"))
    output_json = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"Wrote Stage 3 analysis to {args.output}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
