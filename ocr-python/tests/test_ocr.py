"""
Unit tests for OCR Mathdoku puzzle recognition.

Tests compare OCR output against ground truth YAML files in ocr/tests/fixtures/.
Run with: uv run pytest
"""
from __future__ import annotations

import pytest
from pathlib import Path

import yaml

from ocr_mathdoku import ocr_mathdoku


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def normalize_cage(cage: dict) -> tuple:
    """Normalize a cage dict for comparison (sort cells, normalize op)."""
    cells = tuple(sorted(cage.get("cells", [])))
    value = cage.get("value")
    op = cage.get("op")
    # Normalize operator representation
    if op in ("-", "−", "\u2212"):
        op = "-"
    return (cells, value, op)


def normalize_cages(cages: list[dict]) -> set[tuple]:
    """Normalize all cages for set comparison."""
    return {normalize_cage(c) for c in cages}


def load_expected(yaml_path: Path) -> dict:
    """Load expected YAML and return normalized structure."""
    with open(yaml_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def compare_puzzles(actual: dict, expected: dict) -> list[str]:
    """Compare two puzzle dicts and return list of differences."""
    errors = []

    # Compare size
    if actual.get("size") != expected.get("size"):
        errors.append(f"Size mismatch: got {actual.get('size')}, expected {expected.get('size')}")

    # Compare cages
    actual_cages = normalize_cages(actual.get("cages", []))
    expected_cages = normalize_cages(expected.get("cages", []))

    missing = expected_cages - actual_cages
    extra = actual_cages - expected_cages

    for cage in sorted(missing):
        cells, value, op = cage
        errors.append(f"Missing cage: {list(cells)} = {value}{op or ''}")

    for cage in sorted(extra):
        cells, value, op = cage
        errors.append(f"Extra cage: {list(cells)} = {value}{op or ''}")

    return errors


def discover_fixtures() -> list[tuple[str, Path, Path]]:
    """Discover all image/yaml pairs in fixtures directory."""
    if not FIXTURES_DIR.exists():
        return []

    pairs = []
    for yaml_file in sorted(FIXTURES_DIR.glob("*.yaml")):
        stem = yaml_file.stem
        # Look for matching image (jpg, jpeg, or png)
        for ext in [".jpg", ".jpeg", ".png"]:
            img_file = yaml_file.with_suffix(ext)
            if img_file.exists():
                pairs.append((stem, img_file, yaml_file))
                break
    return pairs


# Discover fixtures at module load time for parametrization
FIXTURE_PAIRS = discover_fixtures()
FIXTURE_IDS = [name for name, _, _ in FIXTURE_PAIRS]


@pytest.mark.parametrize(
    "name,img_path,yaml_path",
    FIXTURE_PAIRS,
    ids=FIXTURE_IDS,
)
def test_ocr_fixture(name: str, img_path: Path, yaml_path: Path):
    """Test OCR on a fixture image against expected YAML."""
    # Run OCR
    actual = ocr_mathdoku(img_path)

    # Load expected
    expected = load_expected(yaml_path)

    errors = compare_puzzles(actual, expected)

    if errors:
        # Format detailed error message
        msg = f"\nOCR errors for {img_path.name}:\n"
        msg += "\n".join(f"  - {e}" for e in errors)
        msg += f"\n\nActual cages:\n"
        for cage in actual.get("cages", []):
            cells = cage.get("cells", [])
            value = cage.get("value")
            op = cage.get("op", "")
            msg += f"  {cells}: {value}{op}\n"
        msg += f"\nExpected cages:\n"
        for cage in expected.get("cages", []):
            cells = cage.get("cells", [])
            value = cage.get("value")
            op = cage.get("op", "")
            msg += f"  {cells}: {value}{op}\n"
        pytest.fail(msg)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
