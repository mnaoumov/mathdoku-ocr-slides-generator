"""
OCR tool for Mathdoku puzzles: screenshot -> YAML spec.

Usage:
    python ocr_mathdoku.py Blog09.png          -> Blog09.yaml
    python ocr_mathdoku.py Blog09.png --debug  -> save debug images

Requirements:
    pip install opencv-python numpy pytesseract pyyaml
    Tesseract-OCR engine:
      Windows: https://github.com/UB-Mannheim/tesseract/wiki
      macOS:   brew install tesseract
      Linux:   apt install tesseract-ocr
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
import yaml

try:
    import pytesseract
except ImportError:
    pytesseract = None

# Auto-detect Tesseract on Windows when not in PATH
if pytesseract is not None and sys.platform == "win32" and not shutil.which("tesseract"):
    _WIN_PATHS = [
        os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"),
                     "Tesseract-OCR", "tesseract.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
                     "Tesseract-OCR", "tesseract.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Tesseract-OCR", "tesseract.exe"),
    ]
    for _p in _WIN_PATHS:
        if os.path.isfile(_p):
            pytesseract.pytesseract.tesseract_cmd = _p
            break

_DEBUG = False


# ── YAML formatting ────────────────────────────────────────────────────────

class _FlowList(list):
    """List that serializes in YAML flow style: [A1, B1, C1]."""


def _flow_representer(dumper: yaml.Dumper, data: _FlowList):
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=True)


yaml.add_representer(_FlowList, _flow_representer)


# ── helpers ─────────────────────────────────────────────────────────────────

def _cell_a1(r: int, c: int) -> str:
    return f"{chr(ord('A') + c)}{r + 1}"


def _dbg(msg: str) -> None:
    if _DEBUG:
        print(f"  [debug] {msg}")


def _dbg_save(name: str, img: np.ndarray) -> None:
    if _DEBUG:
        cv2.imwrite(name, img)


# ── grid detection ──────────────────────────────────────────────────────────

def _find_grid_bbox(gray: np.ndarray) -> tuple[int, int, int, int]:
    """Detect the puzzle grid bounding rectangle. Returns (x, y, w, h)."""
    h, w = gray.shape

    def _find_via_lines() -> tuple[int, int, int, int] | None:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        min_len = min(h, w) // 3
        h_lines = cv2.morphologyEx(
            binary, cv2.MORPH_OPEN,
            cv2.getStructuringElement(cv2.MORPH_RECT, (min_len, 1)),
        )
        v_lines = cv2.morphologyEx(
            binary, cv2.MORPH_OPEN,
            cv2.getStructuringElement(cv2.MORPH_RECT, (1, min_len)),
        )
        combined = cv2.dilate(
            cv2.add(h_lines, v_lines), np.ones((5, 5), np.uint8), iterations=2,
        )
        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        best, best_area = None, 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < h * w * 0.05:
                continue
            bx, by, bw, bh = cv2.boundingRect(cnt)
            aspect = min(bw, bh) / max(bw, bh)
            if aspect < 0.70 or area <= best_area:
                continue
            best_area = area
            best = (bx, by, bw, bh)
        return best

    def _find_via_white_region() -> tuple[int, int, int, int] | None:
        """Fallback for app screenshots: find the largest white rectangular area."""
        white = (gray > 200).astype(np.uint8) * 255
        kernel = np.ones((15, 15), np.uint8)
        closed = cv2.morphologyEx(white, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        best, best_area = None, 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < h * w * 0.03:
                continue
            bx, by, bw, bh = cv2.boundingRect(cnt)
            aspect = min(bw, bh) / max(bw, bh)
            if aspect < 0.70 or area <= best_area:
                continue
            best_area = area
            best = (bx, by, bw, bh)
        return best

    result = _find_via_lines()
    if result is None:
        _dbg("Line-based grid detection failed, trying white-region fallback")
        result = _find_via_white_region()
    if result is None:
        raise ValueError("Could not locate puzzle grid in image.")
    return result


# ── line detection via adaptive threshold + projection ──────────────────────

def _detect_line_positions(
    gray: np.ndarray, gx: int, gy: int, gw: int, gh: int,
) -> tuple[list[int], list[int]]:
    """Return candidate (h_positions, v_positions) of grid lines relative to grid origin."""
    crop = gray[gy:gy + gh, gx:gx + gw]

    # Adaptive threshold catches both thin (gray) and thick (dark) lines
    adaptive = cv2.adaptiveThreshold(
        crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=15, C=5,
    )
    _dbg_save("debug_adaptive.png", adaptive)

    # Sum-projection: fraction of dark pixels per row / column
    h_proj = np.sum(adaptive > 0, axis=1).astype(float) / gw
    v_proj = np.sum(adaptive > 0, axis=0).astype(float) / gh

    def find_peaks(proj: np.ndarray, threshold: float = 0.25) -> list[int]:
        peaks: list[int] = []
        in_run, start = False, 0
        for i in range(len(proj)):
            if proj[i] > threshold and not in_run:
                start, in_run = i, True
            elif proj[i] <= threshold and in_run:
                seg = proj[start:i]
                peaks.append(start + int(np.argmax(seg)))
                in_run = False
        if in_run:
            seg = proj[start:]
            peaks.append(start + int(np.argmax(seg)))
        return peaks

    h_peaks = find_peaks(h_proj)
    v_peaks = find_peaks(v_proj)
    _dbg(f"Raw peaks: {len(h_peaks)}h {h_peaks}, {len(v_peaks)}v {v_peaks}")

    # Ensure grid edges are represented in peak lists.  The outer border
    # should always produce a peak at (near) 0 and (near) total-1, but
    # faint/dotted lines or image artifacts can cause them to be missed.
    # Missing edge peaks throw off spacing calculations for grid-size
    # scoring and line fitting.
    # Use adaptive threshold: only add edge if gap exceeds half the
    # average peak spacing (suggesting a full missing row/column).
    def _maybe_add_edges(peaks: list[int], total: int) -> list[int]:
        if len(peaks) < 2:
            return peaks
        avg_sp = (peaks[-1] - peaks[0]) / (len(peaks) - 1)
        thresh = avg_sp * 0.5
        if peaks[0] > thresh:
            peaks.insert(0, 0)
        if total - 1 - peaks[-1] > thresh:
            peaks.append(total - 1)
        return peaks

    h_peaks = _maybe_add_edges(h_peaks, gh)
    v_peaks = _maybe_add_edges(v_peaks, gw)

    return h_peaks, v_peaks


# ── grid size selection ─────────────────────────────────────────────────────

def _regularity_score(candidates: list[int], total: int, n: int) -> float:
    """Score how well candidates fit a regular N-division grid. Lower = better."""
    if len(candidates) < 2:
        return float("inf")
    first, last = candidates[0], candidates[-1]
    spacing = (last - first) / n
    if spacing < 10:
        return float("inf")

    matched, error = 0, 0.0
    for k in range(n + 1):
        expected = first + k * spacing
        min_dist = min(abs(c - expected) for c in candidates)
        if min_dist < spacing * 0.20:
            matched += 1
            error += min_dist
        else:
            error += spacing * 0.5
    return -matched * 1000 + error / (n + 1)


def _fit_lines(candidates: list[int], total: int, n: int) -> list[int]:
    """Select N+1 evenly-spaced grid lines from candidates."""
    if len(candidates) < 2:
        return [round(i * total / n) for i in range(n + 1)]
    first, last = candidates[0], candidates[-1]
    spacing = (last - first) / n

    result: list[int] = []
    for k in range(n + 1):
        expected = first + k * spacing
        dists = [(abs(c - expected), c) for c in candidates]
        min_dist, nearest = min(dists)
        result.append(nearest if min_dist < spacing * 0.20 else int(round(expected)))
    return result


def _detect_size_and_lines(
    h_cands: list[int], v_cands: list[int],
    gh: int, gw: int, n: int | None,
) -> tuple[int, list[int], list[int]]:
    """Determine grid size and final line positions."""
    if n is not None:
        return n, _fit_lines(h_cands, gh, n), _fit_lines(v_cands, gw, n)

    best_n, best_score = 4, float("inf")
    for try_n in range(4, 10):
        score = _regularity_score(h_cands, gh, try_n) + _regularity_score(v_cands, gw, try_n)
        _dbg(f"  n={try_n}: score={score:.1f}")
        if score < best_score:
            best_score, best_n = score, try_n

    _dbg(f"Best size: {best_n}")
    return best_n, _fit_lines(h_cands, gh, best_n), _fit_lines(v_cands, gw, best_n)


# ── border classification ──────────────────────────────────────────────────

def _classify_borders(
    gray: np.ndarray,
    gx: int, gy: int,
    n: int, h_pos: list[int], v_pos: list[int],
) -> tuple[dict[tuple[int, int], bool], dict[tuple[int, int], bool]]:
    """
    Classify internal borders as thick (cage boundary) or thin (same cage).
    Metric: near-darkest pixel (255 - 5th-percentile) in a narrow strip.
    Cage borders have many dark pixels; same-cage borders have only light-gray pixels.
    Using 5th percentile instead of min to be robust to label text contamination.
    """
    gh_end = min(gy + max(h_pos) + 10, gray.shape[0])
    gw_end = min(gx + max(v_pos) + 10, gray.shape[1])
    crop = gray[gy:gh_end, gx:gw_end]

    cell_h = (h_pos[-1] - h_pos[0]) / n
    cell_w = (v_pos[-1] - v_pos[0]) / n
    margin_h = max(5, int(cell_h * 0.25))
    margin_w = max(5, int(cell_w * 0.25))
    radius = max(2, int(min(cell_h, cell_w) * 0.02))

    measurements: list[tuple[str, int, int, float]] = []

    # Horizontal internal borders
    for r in range(1, n):
        y = h_pos[r]
        y0, y1 = max(0, y - radius), min(crop.shape[0], y + radius + 1)
        for c in range(n):
            x0, x1 = v_pos[c] + margin_w, v_pos[c + 1] - margin_w
            if x0 >= x1 or y0 >= y1:
                continue
            strip = crop[y0:y1, x0:x1]
            if strip.size == 0:
                continue
            measurements.append(("h", r, c, 255.0 - float(np.percentile(strip, 10))))

    # Vertical internal borders
    for c in range(1, n):
        x = v_pos[c]
        x0, x1 = max(0, x - radius), min(crop.shape[1], x + radius + 1)
        for r in range(n):
            y0, y1 = h_pos[r] + margin_h, h_pos[r + 1] - margin_h
            if y0 >= y1 or x0 >= x1:
                continue
            strip = crop[y0:y1, x0:x1]
            if strip.size == 0:
                continue
            measurements.append(("v", r, c, 255.0 - float(np.percentile(strip, 10))))

    if not measurements:
        return {}, {}

    # Two-class separation (Otsu on mean darkness values)
    values = np.array([v for *_, v in measurements])
    _dbg(f"Border darkness: min={np.min(values):.1f} max={np.max(values):.1f} "
         f"median={np.median(values):.1f}")

    sorted_v = np.sort(np.unique(values))
    best_thresh, best_var = float(np.median(values)), -1.0
    for t in sorted_v:
        lo, hi = values[values <= t], values[values > t]
        if len(lo) == 0 or len(hi) == 0:
            continue
        var = len(lo) * len(hi) * (np.mean(hi) - np.mean(lo)) ** 2
        if var > best_var:
            best_var, best_thresh = var, float(t)

    best_thresh = max(best_thresh, 3.0)
    _dbg(f"Border threshold: {best_thresh:.1f}")

    h_thick: dict[tuple[int, int], bool] = {}
    v_thick: dict[tuple[int, int], bool] = {}
    for axis, r, c, score in measurements:
        is_thick = score > best_thresh
        (h_thick if axis == "h" else v_thick)[(r, c)] = is_thick

    if _DEBUG:
        for axis, r, c, score in measurements:
            tag = "THICK" if score > best_thresh else "thin "
            _dbg(f"  {axis}({r},{c}): {score:.3f} {tag}")

    return h_thick, v_thick


# ── cage grouping (union-find) ─────────────────────────────────────────────

def _group_cages(
    n: int,
    h_thick: dict[tuple[int, int], bool],
    v_thick: dict[tuple[int, int], bool],
) -> list[list[tuple[int, int]]]:
    parent: dict[tuple[int, int], tuple[int, int]] = {
        (r, c): (r, c) for r in range(n) for c in range(n)
    }

    def find(x: tuple[int, int]) -> tuple[int, int]:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: tuple[int, int], b: tuple[int, int]) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for r in range(n):
        for c in range(n):
            if c + 1 < n and not v_thick.get((r, c + 1), True):
                union((r, c), (r, c + 1))
            if r + 1 < n and not h_thick.get((r + 1, c), True):
                union((r, c), (r + 1, c))

    groups: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for r in range(n):
        for c in range(n):
            groups.setdefault(find((r, c)), []).append((r, c))
    return [sorted(cells) for cells in groups.values()]


# ── label OCR ──────────────────────────────────────────────────────────────

_LABEL_RE = re.compile(r"^(\d[\d,]*)([+\-x/])?$")


def _require_tesseract() -> None:
    if pytesseract is None:
        print(
            "Error: pytesseract not installed.\n"
            "  pip install pytesseract\n"
            "  + install Tesseract engine",
            file=sys.stderr,
        )
        raise SystemExit(1)
    if not shutil.which(pytesseract.pytesseract.tesseract_cmd):
        print(
            "Error: Tesseract engine not found.\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "  macOS:   brew install tesseract\n"
            "  Linux:   apt install tesseract-ocr",
            file=sys.stderr,
        )
        raise SystemExit(1)


def _trim_to_text(crop_gray: np.ndarray) -> np.ndarray:
    """Remove border artifacts and crop tightly around label text."""
    h, w = crop_gray.shape

    # 1. Use Otsu threshold to detect dark pixels (works for borders and text)
    _, binary = cv2.threshold(crop_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 2. Strip continuous dark columns/rows from left/top edge (grid border
    #    remnants).  Only strip if the column/row is >90% dark across its
    #    full extent — ensures we only remove solid border lines, not text.
    max_strip = min(w, h) // 6  # never strip more than ~16% of the crop
    left = 0
    for c in range(min(max_strip, w)):
        if np.mean(binary[:, c] > 0) > 0.90:
            left = c + 1
        else:
            break
    top = 0
    for r in range(min(max_strip, h)):
        if np.mean(binary[r, :] > 0) > 0.90:
            top = r + 1
        else:
            break
    right = w
    for c in range(w - 1, max(w - max_strip - 1, -1), -1):
        if np.mean(binary[:, c] > 0) > 0.90:
            right = c
        else:
            break
    if left > 0 or top > 0 or right < w:
        _dbg(f"  Stripped border: left={left}px top={top}px right={w - right}px")
        crop_gray = crop_gray[top:, left:right]
        binary = binary[top:, left:right]
        h, w = crop_gray.shape
        if h < 5 or w < 5:
            return crop_gray

    # 3. Pad so contours touching the edge are properly detected
    bp = 2
    padded = cv2.copyMakeBorder(binary, bp, bp, bp, bp,
                                cv2.BORDER_CONSTANT, value=0)
    contours, _ = cv2.findContours(padded, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return crop_gray

    # 5. Keep contours that look like text (not thin border lines)
    # Must balance filtering border artifacts vs keeping small operators (-, +)
    min_area = max(5, int(w * h * 0.002))  # scale threshold with crop size
    text_cnts: list[np.ndarray] = []
    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        if cw * ch < min_area:
            continue
        aspect = min(cw, ch) / max(cw, ch) if max(cw, ch) > 0 else 0
        # Allow thin horizontal strokes (potential minus signs) if not too thin
        # Border artifacts span full height/width; operators are short
        is_short_horizontal = cw > ch * 2 and cw < w * 0.7 and ch < h * 0.3
        if aspect < 0.08 and not is_short_horizontal:
            continue
        text_cnts.append(cnt)

    if not text_cnts:
        return crop_gray

    all_pts = np.vstack(text_cnts)
    bx, by, tw, th = cv2.boundingRect(all_pts)
    bx, by = bx - bp, by - bp
    pad = 3
    bx, by = max(0, bx - pad), max(0, by - pad)
    tw = min(w - bx, tw + 2 * pad)
    th = min(h - by, th + 2 * pad)
    return crop_gray[by:by + th, bx:bx + tw]


def _prepare_ocr_image(crop_gray: np.ndarray) -> np.ndarray:
    """Prepare a grayscale crop for Tesseract: scale, binarize, pad."""
    h, w = crop_gray.shape
    if h < 80:
        scale = max(2, 80 // h)
        crop_gray = cv2.resize(crop_gray, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_CUBIC)

    _, binary = cv2.threshold(crop_gray, 0, 255,
                              cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(binary) < 128:
        binary = 255 - binary

    pad = 12
    return cv2.copyMakeBorder(binary, pad, pad, pad, pad,
                              cv2.BORDER_CONSTANT, value=255)


def _run_tesseract(padded: np.ndarray, configs: list[str]) -> str:
    """Try multiple Tesseract configs, pick best result via voting.

    Strategy: prefer longest digit string (avoids '11+' being outvoted by '1+'),
    then majority vote among those, then include operator if any matching result
    has one (catches operators missed by some configs).
    """
    from collections import Counter
    results: list[tuple[str, str | None]] = []  # (digits, op_or_None)
    best_raw = ""
    raw_texts: list[str] = []  # for debugging
    for cfg in configs:
        try:
            text = pytesseract.image_to_string(padded, config=cfg).strip()
        except Exception:
            continue
        text = text.replace(" ", "").replace("\n", "")
        text = text.replace("×", "x").replace("÷", "/").replace("−", "-")
        text = text.replace("X", "x")
        text = text.replace("O", "0").replace("o", "0").replace("Q", "0")
        text = text.replace("l", "1").replace("I", "1")
        text = text.rstrip(".,;:'\"")
        raw_texts.append(text)
        m = _LABEL_RE.match(text)
        if not m:
            # Try to salvage trailing operator from garbled/unknown characters
            m_raw = re.match(r"^(\d+)(.)$", text)
            if m_raw and not m_raw.group(2).isdigit():
                ch = m_raw.group(2)
                # Dash variants: hyphen-minus, minus sign, en-dash, em-dash,
                # figure dash, horizontal bar, soft hyphen, non-breaking hyphen
                if ch in "+-\u2212\u2013\u2014\u2012\u2015\u00ad\u2011_":
                    text = m_raw.group(1) + "-"
                elif ch in "/\u00f7|\\":
                    text = m_raw.group(1) + "/"
                elif ch in "*xX\u00d7":
                    text = m_raw.group(1) + "x"
                else:
                    # Unknown operator - mark with ? for manual review
                    text = m_raw.group(1) + "?"
                m = _LABEL_RE.match(text)
        if m:
            results.append((m.group(1), m.group(2)))
        elif len(text) > len(best_raw):
            best_raw = text

    _dbg(f"  Tesseract raw: {raw_texts}")
    if not results:
        return best_raw

    # Group results by digit-string length, pick the best group.
    # Use total vote count per length group as the primary criterion
    # (the reading most configs agree on is most likely correct).
    # Break ties in favor of longer strings (more complete reading).
    digit_counts = Counter(d for d, _ in results)
    by_len: dict[int, list[str]] = {}
    for d in digit_counts:
        by_len.setdefault(len(d), []).append(d)

    def _len_votes(length: int) -> int:
        return sum(digit_counts[d] for d in by_len[length])

    best_length = max(by_len, key=lambda l: (_len_votes(l), l))
    best_digits = max(by_len[best_length], key=lambda d: digit_counts[d])

    # Prefer a longer candidate when the shorter is a suffix of it (leading
    # digits cut off).  Only upgrade when the vote gap is small (≤ 2) and
    # the longer candidate has ≥ 2 votes, to avoid noise.
    best_votes = _len_votes(best_length)
    for longer_len in sorted(by_len):
        if longer_len <= best_length:
            continue
        longer_votes = _len_votes(longer_len)
        if best_votes - longer_votes > 2:
            continue
        for d in sorted(by_len[longer_len], key=lambda x: digit_counts[x],
                        reverse=True):
            if d.endswith(best_digits) and digit_counts[d] >= 2:
                _dbg(f"  Suffix upgrade: {best_digits} -> {d}"
                     f" ({digit_counts[d]} vs {digit_counts[best_digits]})")
                best_digits = d
                best_length = longer_len
                break
        break  # only check the next longer group

    # Include operator if any result with this digit string has one
    # Exclude '?' from voting - it's a fallback marker, not a real operator
    real_ops = [op for d, op in results if d == best_digits and op and op != "?"]
    if real_ops:
        op_counts = Counter(real_ops)
        return best_digits + op_counts.most_common(1)[0][0]
    # Fall back to '?' only if majority of results see an operator
    # (avoids spurious '?' from single noisy config)
    no_op_count = sum(1 for d, op in results if d == best_digits and op is None)
    fallback_ops = [op for d, op in results if d == best_digits and op == "?"]
    if len(fallback_ops) > no_op_count:
        return best_digits + "?"
    # Check if a longer candidate captured the operator as a trailing digit
    # (e.g., "134" = "13" + "4" where Tesseract misread "+" as "4")
    _OP_DIGIT = {"4": "+", "0": "+"}
    for longer_len in sorted(by_len):
        if longer_len != len(best_digits) + 1:
            continue
        for d in by_len[longer_len]:
            if d[:-1] == best_digits and d[-1] in _OP_DIGIT and digit_counts[d] >= 2:
                return best_digits + _OP_DIGIT[d[-1]]
    return best_digits


_OCR_CONFIGS = [
    "--oem 1 --psm 7 -c tessedit_char_whitelist=0123456789+x-/,",
    "--oem 1 --psm 8 -c tessedit_char_whitelist=0123456789+x-/,",
    "--oem 1 --psm 13 -c tessedit_char_whitelist=0123456789+x-/,",
    "--psm 7 -c tessedit_char_whitelist=0123456789+x-/,",
    "--psm 8 -c tessedit_char_whitelist=0123456789+x-/,",
    "--psm 13 -c tessedit_char_whitelist=0123456789+x-/,",
    "--psm 7",
    "--psm 8",
]


def _ocr_crop(crop_gray: np.ndarray) -> str:
    """OCR a small grayscale crop. Returns cleaned text."""
    h, w = crop_gray.shape
    if h < 10 or w < 10:
        return ""

    # Trim to text area (removes border line artifacts)
    trimmed = _trim_to_text(crop_gray)
    th, tw = trimmed.shape
    if th < 5 or tw < 5:
        return ""

    padded = _prepare_ocr_image(trimmed)
    result = _run_tesseract(padded, _OCR_CONFIGS)

    # Cage value "0" is never valid in Mathdoku (all values are positive).
    # The most common OCR confusion is "9" → "0" due to similar shapes.
    # Replace "0" with "9" as a post-processing correction.
    m = _LABEL_RE.match(result)
    if m and m.group(1) == "0":
        op_suffix = m.group(2) or ""
        _dbg(f"  Correcting invalid value '0' -> '9' (likely 9→0 OCR confusion)")
        result = "9" + op_suffix

    return result


def _extract_label_crop(
    gray: np.ndarray, grid_up: np.ndarray | None,
    gx: int, gy: int, upscale: int,
    cx: int, cy: int, cw: int, ch: int,
    margin: int = 2,
) -> np.ndarray | None:
    """Extract the label region crop from the cell at (cx, cy)."""
    if grid_up is not None:
        s = upscale
        lx = int(cx * s) + margin
        ly = int(cy * s) + margin
        lw = int(cw * s * 0.92)
        lh = int(ch * s * 0.42)
        crop = grid_up[ly:ly + lh, lx:lx + lw]
    else:
        lx = gx + cx + margin
        ly = gy + cy + margin
        lw = int(cw * 0.92)
        lh = int(ch * 0.42)
        crop = gray[ly:ly + lh, lx:lx + lw]
    if crop.size == 0 or crop.shape[0] < 5 or crop.shape[1] < 5:
        return None
    return crop


def _detect_trailing_operator(crop_gray: np.ndarray) -> str | None:
    """Detect an operator character (+, -, x, /) at the right end of a label crop.

    Uses connected-component analysis to isolate the rightmost glyph,
    then classifies it by shape and single-character OCR (PSM 10).
    """
    trimmed = _trim_to_text(crop_gray)
    h, w = trimmed.shape
    if h < 5 or w < 5:
        return None

    _, binary = cv2.threshold(trimmed, 0, 255,
                              cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    bp = 2
    padded = cv2.copyMakeBorder(binary, bp, bp, bp, bp,
                                cv2.BORDER_CONSTANT, value=0)
    contours, _ = cv2.findContours(padded, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    if len(contours) < 2:
        return None

    # Sort contours left-to-right by bounding-rect x
    sorted_cnts = sorted(contours, key=lambda c: cv2.boundingRect(c)[0])
    last = sorted_cnts[-1]
    lx, ly, lw, lh_c = cv2.boundingRect(last)

    # Must be in the right portion of the crop (after digits)
    if lx < w * 0.35:
        return None
    # Must be reasonably small (operator, not a digit)
    if lw * lh_c > w * h * 0.35:
        return None

    # Extract the operator region with padding
    pad = 4
    ox = max(0, lx - bp - pad)
    oy = max(0, ly - bp - pad)
    ow = min(w - ox, lw + 2 * pad + 2 * bp)
    oh = min(h - oy, lh_c + 2 * pad + 2 * bp)
    op_crop = trimmed[oy:oy + oh, ox:ox + ow]
    if op_crop.size == 0 or op_crop.shape[0] < 3 or op_crop.shape[1] < 3:
        return None

    # Aggressively upscale for single-character OCR (operators are tiny)
    oh_px, ow_px = op_crop.shape
    if oh_px < 60:
        scale = max(4, 60 // oh_px)
        op_crop = cv2.resize(op_crop, None, fx=scale, fy=scale,
                             interpolation=cv2.INTER_CUBIC)
    op_prepared = _prepare_ocr_image(op_crop)

    # Try PSM 10 (single character) with operator-only whitelist
    _OP_CONFIGS = [
        "--psm 10 -c tessedit_char_whitelist=+-x/",
        "--oem 1 --psm 10 -c tessedit_char_whitelist=+-x/",
        "--psm 13 -c tessedit_char_whitelist=+-x/",
        "--oem 1 --psm 13 -c tessedit_char_whitelist=+-x/",
        "--psm 10",
        "--psm 13",
    ]
    from collections import Counter
    votes: list[str] = []
    for cfg in _OP_CONFIGS:
        try:
            text = pytesseract.image_to_string(op_prepared, config=cfg).strip()
        except Exception:
            continue
        text = text.replace("×", "x").replace("÷", "/").replace("−", "-")
        if len(text) == 1 and text in {"+", "-", "x", "/"}:
            votes.append(text)
    if votes:
        best_op = Counter(votes).most_common(1)[0][0]
        _dbg(f"  Operator detection votes: {votes} -> {best_op}")
        return best_op

    # Fallback: shape-based classification
    aspect = lw / lh_c if lh_c > 0 else 0
    if 0.6 < aspect < 1.6:
        # Near-square: likely '+' or 'x'
        # Check for cross shape by looking at center density
        cx_c = lx - bp + lw // 2
        cy_c = ly - bp + lh_c // 2
        # Horizontal and vertical strips through center
        h_strip = binary[max(0, cy_c - 1):cy_c + 2, lx - bp:lx - bp + lw]
        v_strip = binary[ly - bp:ly - bp + lh_c, max(0, cx_c - 1):cx_c + 2]
        h_fill = np.mean(h_strip > 0) if h_strip.size > 0 else 0
        v_fill = np.mean(v_strip > 0) if v_strip.size > 0 else 0
        if h_fill > 0.5 and v_fill > 0.5:
            _dbg(f"  Shape-based: cross detected (h={h_fill:.2f} v={v_fill:.2f})")
            return "+"
    elif aspect > 2.0:
        # Wide and short: likely '-'
        return "-"

    return None


# ── mathematical validation ──────────────────────────────────────────────

def _can_factor(value: int, k: int, max_digit: int) -> bool:
    """Check if value can be expressed as product of exactly k digits in [1, max_digit]."""
    if k == 1:
        return 1 <= value <= max_digit
    if value > max_digit ** k:
        return False
    for d in range(max_digit, 0, -1):
        if value % d == 0 and _can_factor(value // d, k - 1, max_digit):
            return True
    return False


def _is_valid_cage_value(
    value_str: str, op: str | None, n_cells: int, grid_size: int,
) -> bool:
    """Check if a cage value is mathematically possible for the given operation."""
    try:
        value = int(value_str)
    except ValueError:
        return True  # Can't validate non-integer values
    if value <= 0:
        return False

    if op == "+":
        # 2-cell cages always share a row/col → different digits → min sum = 1+2 = 3
        min_sum = 3 if n_cells == 2 else n_cells
        max_sum = n_cells * grid_size
        return min_sum <= value <= max_sum
    elif op == "-":
        # Subtraction only for 2-cell cages; |a-b| with a≠b → [1, grid_size-1]
        return 1 <= value <= grid_size - 1
    elif op == "x":
        return _can_factor(value, n_cells, grid_size)
    elif op == "/":
        # Division only for 2-cell cages; a/b with a≠b → [2, grid_size]
        # (quotient 1 would require a=b, impossible for adjacent cells)
        return 2 <= value <= grid_size

    return True  # Unknown or no op → can't validate


# Common Tesseract digit confusions: misread digit → possible correct digits
_DIGIT_CONFUSIONS: dict[str, list[str]] = {
    "1": ["7", "4"],
    "4": ["1"],
    "7": ["1"],
    "6": ["8"],
    "8": ["6", "3"],
    "3": ["8"],
    "0": ["9"],
    "9": ["0"],
}

_OP_CONFUSIONS: dict[str, list[str]] = {
    "+": ["-"],
    "-": ["+"],
}


def _try_correct_cage_value(
    value_str: str, op: str | None, n_cells: int, grid_size: int,
) -> tuple[str, str | None] | None:
    """Try to find a valid correction for an invalid cage value.

    Returns (corrected_value, corrected_op) or None if no correction found.
    Strategies are ordered by likelihood: first-digit substitution (most common
    OCR error for cage labels), then dropping extra digits, then operator swap.
    """
    # Strategy 1: Substitute first digit (common leading-digit misread)
    if value_str and value_str[0] in _DIGIT_CONFUSIONS:
        for replacement in _DIGIT_CONFUSIONS[value_str[0]]:
            candidate = replacement + value_str[1:]
            if _is_valid_cage_value(candidate, op, n_cells, grid_size):
                return (candidate, op)

    # Strategy 2: Drop leading digit (border artifact added extra digit)
    if len(value_str) >= 2:
        shorter = value_str[1:]
        if _is_valid_cage_value(shorter, op, n_cells, grid_size):
            return (shorter, op)

    # Strategy 3: Swap operator (+/- confusion)
    if op and op in _OP_CONFUSIONS:
        for new_op in _OP_CONFUSIONS[op]:
            if _is_valid_cage_value(value_str, new_op, n_cells, grid_size):
                return (value_str, new_op)

    # Strategy 4: Drop trailing digit (operator misread as digit)
    if len(value_str) >= 2:
        shorter = value_str[:-1]
        if _is_valid_cage_value(shorter, op, n_cells, grid_size):
            return (shorter, op)

    # Strategy 5: Substitute other digits
    for i in range(1, len(value_str)):
        if value_str[i] in _DIGIT_CONFUSIONS:
            for replacement in _DIGIT_CONFUSIONS[value_str[i]]:
                candidate = value_str[:i] + replacement + value_str[i + 1:]
                if _is_valid_cage_value(candidate, op, n_cells, grid_size):
                    return (candidate, op)

    return None


def _read_cage_labels(
    gray: np.ndarray,
    gx: int, gy: int,
    n: int,
    h_pos: list[int], v_pos: list[int],
    cages: list[list[tuple[int, int]]],
) -> list[tuple[str, str | None]]:
    """For each cage, read and parse its label. Returns [(value, op), ...]."""
    _require_tesseract()

    # If cells are small, pre-upscale the grid region for better OCR accuracy.
    # Extracting tiny 15px-tall crops leads to heavy per-crop upscaling with
    # poor quality.  Upscaling the whole grid once gives much better results.
    cell_h = (h_pos[-1] - h_pos[0]) / n
    cell_w = (v_pos[-1] - v_pos[0]) / n
    min_cell = min(cell_h, cell_w)
    _MIN_CELL_FOR_OCR = 50  # cells below this size benefit from pre-upscaling
    if min_cell < _MIN_CELL_FOR_OCR:
        upscale = max(2, int(_MIN_CELL_FOR_OCR / min_cell) + 1)
        # Extract grid region with small padding
        gh_end = min(gy + max(h_pos) + 20, gray.shape[0])
        gw_end = min(gx + max(v_pos) + 20, gray.shape[1])
        grid_crop = gray[gy:gh_end, gx:gw_end]
        grid_up = cv2.resize(grid_crop, None, fx=upscale, fy=upscale,
                             interpolation=cv2.INTER_CUBIC)
        _dbg(f"Pre-upscaled grid {upscale}x: {grid_crop.shape} -> {grid_up.shape}")
    else:
        grid_up = None
        upscale = 1

    results: list[tuple[str, str | None]] = []
    for idx, cells in enumerate(cages):
        tl_r, tl_c = cells[0]
        cx, cy = v_pos[tl_c], h_pos[tl_r]
        cw = v_pos[tl_c + 1] - cx
        ch = h_pos[tl_r + 1] - cy

        if grid_up is not None:
            # Use upscaled grid for crop extraction
            s = upscale
            cw_s, ch_s = cw * s, ch * s
            margin = max(3, int(min(cw_s, ch_s) * 0.03))
            lx = int(cx * s) + margin
            ly = int(cy * s) + margin
            lw = int(cw_s * 0.92)
            lh = int(ch_s * 0.42)
            crop = grid_up[ly:ly + lh, lx:lx + lw]
        else:
            margin = max(3, int(min(cw, ch) * 0.03))
            lx = gx + cx + margin
            ly = gy + cy + margin
            lw = int(cw * 0.92)
            lh = int(ch * 0.42)
            crop = gray[ly:ly + lh, lx:lx + lw]

        if crop.size == 0:
            results.append(("?", None))
            continue

        _dbg_save(f"debug_label_{idx}.png", crop)

        raw = _ocr_crop(crop)

        # If first attempt failed, didn't match, or produced a suspicious
        # value, retry with wider margins to avoid border artifacts bleeding
        # into the crop.  Suspicious values:
        #  - all-zero digits (no Mathdoku cage has value 0)
        #  - single digit for a multi-cell cage (a digit may be cut off by
        #    the thick cage border)
        m_raw = _LABEL_RE.match(raw)
        raw_digits = m_raw.group(1) if m_raw else ""
        is_zero_val = m_raw is not None and raw_digits.lstrip("0") == ""
        is_short_for_cage = m_raw is not None and (
            (len(raw_digits) == 1 and len(cells) > 1)  # 1-digit for 2+ cells
            or (len(raw_digits) == 2 and len(cells) > 2)  # 2-digit for 3+ cells
        )
        needs_retry = not m_raw or is_zero_val or is_short_for_cage
        if needs_retry:
            for margin2 in (margin * 2, margin * 3, margin * 4):
                if grid_up is not None:
                    lx2 = int(cx * s) + margin2
                    ly2 = int(cy * s) + margin2
                    crop2 = grid_up[ly2:ly2 + lh, lx2:lx2 + lw]
                else:
                    lx2 = gx + cx + margin2
                    ly2 = gy + cy + margin2
                    crop2 = gray[ly2:ly2 + lh, lx2:lx2 + lw]
                if crop2.size == 0 or crop2.shape[0] < 5 or crop2.shape[1] < 5:
                    continue
                raw2 = _ocr_crop(crop2)
                m2 = _LABEL_RE.match(raw2)
                if not m2:
                    continue
                new_digits = m2.group(1)
                # Accept if better: non-zero when was zero, or longer reading
                improved = False
                if not m_raw:
                    improved = True
                elif is_zero_val and new_digits.lstrip("0") != "":
                    improved = True
                elif is_short_for_cage and len(new_digits) > len(raw_digits):
                    improved = True
                if improved:
                    _dbg(f"  Retry with margin={margin2} improved: {raw!r} -> {raw2!r}")
                    raw = raw2
                    break
        m = _LABEL_RE.match(raw)
        if m:
            results.append((m.group(1), m.group(2)))
        elif raw and raw[0].isdigit():
            digits = re.match(r"[\d,]+", raw)
            val = digits.group(0) if digits else raw
            rest = raw[len(val):]
            op = rest[0] if rest and rest[0] in "+-x/?" else None
            results.append((val, op))
        else:
            results.append(("?", None))

    # Post-processing pass 1: retry short-value labels at higher upscale
    # from original gray to recover leading digits lost to border artifacts.
    # For small-cell grids (pre-upscaled), retry 2-digit values.
    # For all grids, retry 1-digit values in multi-cell cages (a single
    # digit like "8" is suspicious for a cage with 3+ cells and operation).
    for idx in range(len(results)):
        value, op = results[idx]
        if not value or value == "?":
            continue
        is_short_multicell = (
            len(value) == 1 and (
                (op is not None and len(cages[idx]) > 1)  # has operator: any multi-cell
                or len(cages[idx]) > 2  # no operator: 3+ cells (1 digit is implausible)
            )
        ) or (
            len(value) == 2 and op is not None and len(cages[idx]) > 2
            # 2-digit with operator for 3+ cells: may have lost leading digit
        )
        is_small_cell_retry = grid_up is not None and len(value) == 2
        if not is_short_multicell and not is_small_cell_retry:
            continue
        tl_r, tl_c = cages[idx][0]
        cx_r, cy_r = v_pos[tl_c], h_pos[tl_r]
        cw_r = v_pos[tl_c + 1] - cx_r
        ch_r = h_pos[tl_r + 1] - cy_r
        for retry_m in (3, 4):
            rx = gx + cx_r + retry_m
            ry = gy + cy_r + retry_m
            rw = int(cw_r * 0.95)
            rh = int(ch_r * 0.45)
            crop_raw = gray[ry:ry + rh, rx:rx + rw]
            if crop_raw.size == 0 or crop_raw.shape[0] < 5:
                continue
            scale = max(3, 80 // crop_raw.shape[0])
            crop_hi = cv2.resize(crop_raw, None, fx=scale, fy=scale,
                                 interpolation=cv2.INTER_CUBIC)
            raw_hi = _ocr_crop(crop_hi)
            m_hi = _LABEL_RE.match(raw_hi)
            if m_hi and len(m_hi.group(1)) > len(value):
                # Require original value as suffix in the longer result
                # (prevents "7" → "10" but allows "8" → "108",
                #  prevents "26" → "31" but allows "26" → "126")
                if not m_hi.group(1).endswith(value):
                    continue
                # Accept if same operator or new operator is compatible
                hi_op = m_hi.group(2)
                if op is not None and hi_op is not None and hi_op != op:
                    continue
                new_op = hi_op or op
                _dbg(f"  Cage {idx}: retry {value}{op or ''}"
                     f" -> {m_hi.group(1)}{new_op or ''}")
                results[idx] = (m_hi.group(1), new_op)
                break

    # Post-processing pass 2: enforce operators for multi-cell cages.
    # Only applies when the puzzle SHOWS operators (most cages already have one).
    multi_cell_cages_with_operator = sum(1 for (_, op), c in zip(results, cages) if len(c) > 1 and op)
    multi_cell_cages_without_operator = sum(1 for (_, op), c in zip(results, cages) if len(c) > 1 and not op)
    has_operators = multi_cell_cages_with_operator > multi_cell_cages_without_operator
    if not has_operators:
        return results

    for idx in range(len(results)):
        value, op = results[idx]
        if len(cages[idx]) <= 1 or op is not None:
            continue
        # Multi-cell cage without operator detected
        _dbg(f"  Cage {idx}: multi-cell without op, value={value!r}")

        # Strategy 1: Last digit might be a misread '+' operator
        # Common low-res confusions: '+' → '0' (round shape), '+' → '4' (cross)
        if value and len(value) >= 2 and value[-1] in ("0", "4"):
            _dbg(f"    -> {value[:-1]}+ (digit-to-op correction)")
            results[idx] = (value[:-1], "+")
            continue

        # Strategy 2: Retry with higher-resolution individual crop.
        # Extract from original gray at 4x/6x upscale for better operator detection.
        tl_r, tl_c = cages[idx][0]
        cx2, cy2 = v_pos[tl_c], h_pos[tl_r]
        cw2 = v_pos[tl_c + 1] - cx2
        ch2 = h_pos[tl_r + 1] - cy2
        found = False
        for retry_scale in (4, 6):
            for m2 in (2, 3, 4):
                rx = gx + cx2 + m2
                ry = gy + cy2 + m2
                rw = int(cw2 * 0.95)
                rh = int(ch2 * 0.45)
                crop_raw = gray[ry:ry + rh, rx:rx + rw]
                if crop_raw.size == 0 or crop_raw.shape[0] < 5:
                    continue
                crop_hi = cv2.resize(crop_raw, None, fx=retry_scale,
                                     fy=retry_scale,
                                     interpolation=cv2.INTER_CUBIC)
                raw_hi = _ocr_crop(crop_hi)
                m_hi = _LABEL_RE.match(raw_hi)
                # Only accept if a real operator found (not '?')
                if m_hi and m_hi.group(2) and m_hi.group(2) != "?":
                    # For short values, don't accept if digits changed
                    # (prevents '7' -> '1+' type misreads)
                    if len(value) <= 2 and m_hi.group(1) != value:
                        continue
                    _dbg(f"    -> {raw_hi!r} (retry {retry_scale}x margin={m2})")
                    results[idx] = (m_hi.group(1), m_hi.group(2))
                    found = True
                    break
            if found:
                break
        if found:
            continue

        # Strategy 3: Detect operator from rightmost connected component.
        # The operator sits to the right of digits; isolate and classify it.
        crop_for_op = _extract_label_crop(
            gray, grid_up, gx, gy, upscale,
            cx2, cy2, cw2, ch2, margin=2,
        )
        if crop_for_op is not None:
            detected_op = _detect_trailing_operator(crop_for_op)
            if detected_op:
                _dbg(f"    -> {value}{detected_op} (component-based op detection)")
                results[idx] = (value, detected_op)

    # Post-processing pass 3: mathematical validation.
    # Flag cage values that are mathematically impossible for the given
    # operation and cage size.  First try re-reading the label from the
    # original (non-upscaled) image at high resolution — this recovers
    # digits lost to low-resolution OCR (e.g. "68x" → "288x" at 6×).
    # Fall back to heuristic corrections (digit substitutions, operator
    # swaps, extra-digit removal) only if the retry doesn't help.
    for idx in range(len(results)):
        value, op = results[idx]
        if not value or value == "?":
            continue
        n_cells = len(cages[idx])
        if _is_valid_cage_value(value, op, n_cells, n):
            continue

        # Strategy A: re-read from original gray at high resolution.
        tl_r, tl_c = cages[idx][0]
        cx_r, cy_r = v_pos[tl_c], h_pos[tl_r]
        cw_r = v_pos[tl_c + 1] - cx_r
        ch_r = h_pos[tl_r + 1] - cy_r
        ocr_fixed = False
        for retry_scale in (4, 6, 8):
            for retry_margin in (2, 3, 4):
                rx = gx + cx_r + retry_margin
                ry = gy + cy_r + retry_margin
                rw = int(cw_r * 0.95)
                rh = int(ch_r * 0.45)
                crop_raw = gray[ry:ry + rh, rx:rx + rw]
                if crop_raw.size == 0 or crop_raw.shape[0] < 5:
                    continue
                crop_hi = cv2.resize(crop_raw, None, fx=retry_scale,
                                     fy=retry_scale,
                                     interpolation=cv2.INTER_CUBIC)
                raw_hi = _ocr_crop(crop_hi)
                m_hi = _LABEL_RE.match(raw_hi)
                if not m_hi:
                    continue
                new_val = m_hi.group(1)
                new_op = m_hi.group(2) or op
                if _is_valid_cage_value(new_val, new_op, n_cells, n):
                    _dbg(f"  Cage {idx}: hi-res retry {value}{op or ''}"
                         f" -> {new_val}{new_op or ''}"
                         f" (scale={retry_scale} margin={retry_margin})")
                    results[idx] = (new_val, new_op)
                    ocr_fixed = True
                    break
            if ocr_fixed:
                break

        if ocr_fixed:
            continue

        # Strategy B: heuristic correction (digit subs, op swaps, etc.)
        corrected = _try_correct_cage_value(value, op, n_cells, n)
        if corrected:
            _dbg(f"  Cage {idx}: validation fix {value}{op or ''}"
                 f" -> {corrected[0]}{corrected[1] or ''}")
            results[idx] = corrected

    return results


# ── main pipeline ──────────────────────────────────────────────────────────

def ocr_mathdoku(
    img_path: Path,
    *,
    n: int | None = None,
) -> dict:
    img = cv2.imread(str(img_path))
    if img is None:
        raise FileNotFoundError(f"Cannot read: {img_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Grid bounding box
    gx, gy, gw, gh = _find_grid_bbox(gray)
    _dbg(f"Grid bbox: ({gx},{gy}) {gw}x{gh}")

    # 2. Candidate line positions
    h_cands, v_cands = _detect_line_positions(gray, gx, gy, gw, gh)

    # 3. Grid size & line selection
    n_detected, h_pos, v_pos = _detect_size_and_lines(h_cands, v_cands, gh, gw, n)
    if n is None:
        n = n_detected
    print(f"Grid: {n}x{n} at ({gx},{gy}) {gw}x{gh}")
    _dbg(f"h_pos={h_pos}")
    _dbg(f"v_pos={v_pos}")

    # 4. Border classification
    h_thick, v_thick = _classify_borders(gray, gx, gy, n, h_pos, v_pos)

    # 5. Cage grouping
    cages = _group_cages(n, h_thick, v_thick)
    print(f"Cages: {len(cages)}")

    # 6. Label OCR
    labels = _read_cage_labels(gray, gx, gy, n, h_pos, v_pos, cages)

    # 7. Build result
    has_operators = False
    cages_data: list[dict] = []
    for cells, (value, op) in zip(cages, labels):
        refs = _FlowList(_cell_a1(r, c) for r, c in cells)
        entry: dict = {"cells": refs}
        entry["value"] = int(value) if value.isdigit() else value
        if op:
            entry["op"] = op
            has_operators = True
        cages_data.append(entry)
        print(f"  {refs}: {value}{op or ''}")

    result: dict = {"size": n}
    result["difficulty"] = "?"
    result["hasOperators"] = has_operators
    result["cages"] = cages_data

    return result


def main() -> None:
    global _DEBUG
    ap = argparse.ArgumentParser(description="OCR a Mathdoku screenshot to YAML")
    ap.add_argument("image", help="puzzle screenshot (PNG, JPG, ...)")
    ap.add_argument("--debug", action="store_true", help="save debug images and info")
    args = ap.parse_args()

    _DEBUG = args.debug

    path = Path(args.image)
    if not path.is_file():
        print(f"Error: {path} not found", file=sys.stderr)
        raise SystemExit(1)

    out = path.with_suffix(".yaml")
    result = ocr_mathdoku(path)

    with open(out, "w", encoding="utf-8") as f:
        yaml.dump(result, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
