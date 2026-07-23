#!/usr/bin/env python3
"""Build gameplay-focused showreel proxies for Day1 + Thursday trailers.

Picks high-motion windows (skip early UI / menu navigation), exports 720p clips.
"""

from __future__ import annotations

import csv
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOWREEL = ROOT / "chatcut-showreel"
MEDIA = SHOWREEL / "media"
PROXIES = SHOWREEL / "proxies-gameplay"  # new folder; don't clobber old proxies until done
CLIPS = SHOWREEL / "clips-5s"  # hard 5s gameplay picks for timeline
THU = ROOT / "gamedesignfinal-thu"
LOG = SHOWREEL / "gameplay-proxy-build.log"

PROXY_LEN = 12.0  # seconds for ChatCut import (trim to ~5s on timeline)
CLIP_LEN = 5.0
SAMPLE_FPS = 1.0


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")[:50] or "game"


def probe_duration(path: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return 60.0


def motion_scores(path: Path, duration: float) -> list[tuple[float, float]]:
    """Return list of (t_sec, motion) sampled at ~1fps, skipping ends.

    Uses small grayscale frames and mean abs frame difference.
    """
    # Analyze from 18% to 92% to skip opening UI / ending freezes
    start = min(max(duration * 0.18, 8.0), max(duration - 20, 0))
    end = max(duration * 0.92, start + 10)
    analyze_len = min(max(end - start, 5.0), 90.0)  # cap for huge screen recordings

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        # Extract 160px-wide frames at 1fps from the analysis window
        out_pat = str(td_path / "f%05d.png")
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{start:.2f}",
            "-t",
            f"{analyze_len:.2f}",
            "-i",
            str(path),
            "-vf",
            "fps=1,scale=160:-2,format=gray",
            "-y",
            out_pat,
        ]
        subprocess.run(cmd, check=False)
        frames = sorted(td_path.glob("f*.png"))
        if len(frames) < 3:
            # fallback: middle of video
            mid = max(duration * 0.4, 5.0)
            return [(mid, 1.0)]

        try:
            from PIL import Image
            import numpy as np
        except ImportError:
            mid = start + analyze_len * 0.55
            return [(mid, 1.0), (mid + 2, 0.9), (mid + 4, 0.8)]

        prev = None
        scores: list[tuple[float, float]] = []
        for i, fp in enumerate(frames):
            arr = np.asarray(Image.open(fp), dtype=np.float32)
            t = start + i / SAMPLE_FPS
            if prev is None:
                scores.append((t, 0.0))
            else:
                scores.append((t, float(np.mean(np.abs(arr - prev)))))
            prev = arr
        return scores


def best_window(scores: list[tuple[float, float]], duration: float, length: float) -> float:
    if not scores:
        return min(max(duration * 0.35, 5.0), max(duration - length, 0))
    # Sliding window of `length` seconds over score samples
    best_t = scores[0][0]
    best_sum = -1.0
    n = max(int(length), 1)
    for i in range(len(scores)):
        window = scores[i : i + n]
        if len(window) < max(n // 2, 1):
            break
        s = sum(v for _, v in window) / len(window)
        # slight preference for later gameplay (menus often early)
        t0 = window[0][0]
        s *= 1.0 + 0.15 * (t0 / max(duration, 1))
        if s > best_sum:
            best_sum = s
            best_t = t0
    # Clamp so we can take full length
    return min(best_t, max(duration - length - 0.5, 0))


def export_clip(src: Path, dest: Path, start: float, length: float) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Mild center crop to reduce browser chrome / dock, then scale to 720p
    vf = (
        "crop=iw*0.88:ih*0.88:(iw-ow)/2:(ih-oh)/2,"
        "scale=-2:720"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{start:.2f}",
        "-i",
        str(src),
        "-t",
        f"{length:.2f}",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "26",
        "-an",  # mute gameplay for showreel (music track carries)
        "-movflags",
        "+faststart",
        str(dest),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and dest.exists() and dest.stat().st_size > 20_000


THU_MAP = [
    # (slug, title, author, folder_name, relative_video)
    ("31-Rotate-Run--Coral", "Rotate Run", "Coral / Xuanjie", "coral rotate", "coral rotate/录屏2026-07-23 13.47.14.mov"),
    ("32-Cued-Speech--Hanson-Zheng", "Cued Speech", "Hanson Zheng", "CuedSpeechFinal-Hanson Zheng 郑湙泓", "CuedSpeechFinal-Hanson Zheng 郑湙泓/CuedSpeechFinalVideo.mp4"),
    ("33-Dyno-Master--Nathan-Fang", "Dyno Master", "Nathan Fang", "Dyno Master- Nathan Fang 方之了", "Dyno Master- Nathan Fang 方之了/录屏2026-07-23 10.05.32.mov"),
    ("34-Echo-Pathfinder--Yixuan-Lyu", "Echo Pathfinder", "Yixuan Lyu", "echo-pathfindfer-group2-YixuanLyu", "echo-pathfindfer-group2-YixuanLyu/Screen Recording 2026-07-23 at 11.03.46 copy.mov"),
    ("35-Escape-the-Cellar--Doris", "Escape the Cellar", "Doris", "Escape the Cellar - Doris", "Escape the Cellar - Doris/6e2119a7c2f64ca3236c016546cc291c_raw.mp4"),
    ("36-First-Diagnosis--Pim", "First Diagnosis", "Pim", "First Aid - Pim", "First Aid - Pim/Screen Recording 2569-07-23 at 13.47.20.mov"),
    ("37-Ruff-Routine--Aurora", "Fluffy Paws / Ruff Routine", "Aurora", "Fluffy Paws- Aurora", "Fluffy Paws- Aurora/Video .mov"),
    ("38-Dream-Village--Cindy-W", "Dream Village", "Cindy W", "Game design- Cindy w （group3） ", "Game design- Cindy w （group3） /录屏2026-07-23 14.04.38.mov"),
    ("39-Angry-Textbooks--Thomas-Li", "Angry Textbooks", "Thomas Li", "Game design- Thomas Li", "Game design- Thomas Li/李其乐+义务教育.mp4"),
    ("40-General-Replay--Rex-Xinyi", "General Replay", "Rex / Xinyi Li", "general(with ai) - group2 - rex xinyi li", "general(with ai) - group2 - rex xinyi li/GAME REPLAY.mp4"),
    ("41-Nature-Balance--Harry-Tang", "Nature Balance", "Harry Tang", "Harry Tang - Ecosystem", "Harry Tang - Ecosystem/Screen Recording 2026-07-23 at 1.43.38 PM.mov"),
    ("42-Into-the-Unknown--Hawinate", "Into the Unknown", "Hawinate", "Hawinate,Into the unknown", "Hawinate,Into the unknown/Screen Recording 2026-07-23 at 16.55.42.mov"),
    ("43-Time-Garden--Huang-Aili", "Time Garden", "Huang Aili", "huang-aili-time-garden", "huang-aili-time-garden/Screen Recording 2026-07-23 at 12.31.27 PM.mov"),
    ("44-INTERSTELLAR--Yvette-Wang", "INTERSTELLAR", "Yvette Wang", "INTERSTELLAR-Yvette Wang 王怡辰", "INTERSTELLAR-Yvette Wang 王怡辰/screen record.mp4"),
    ("45-Neon-Strike--Joe-Wu", "Neon Strike", "Joe Wu", "neon strike  Joe Wu", "neon strike  Joe Wu/WorkBuddy 2026-07-23 09-40-26.mp4"),
    ("46-Peppa-Running--Zhenxi-Yi", "Peppa Running", "Zhenxi Yi", "Peppa running- Group2-Zhenxi Yi", "Peppa running- Group2-Zhenxi Yi/录屏2026-07-23 09.44.08.mov"),
    ("47-Cello-Resonance--Peter", "Cello Resonance", "Peter", "Peter Cello game", "Peter Cello game/屏幕录制 2026-07-23 144359.mp4"),
    ("48-Sky-Storm--Harry", "Sky Storm", "Harry", "project skystorm-Harry", "project skystorm-Harry/Desktop 2026.07.23 - 11.10.57.03.mp4"),
    ("49-Granny-Square--Qingrong-Jiang", "Granny Square Rhythm", "Qingrong Jiang", "Qingrong Jiang", "Qingrong Jiang/录屏2026-07-23 09.40.23.mov"),
    ("50-Raise-a-Cat--Maureen-Mo", "Raise a Cat", "Maureen Mo", "Raise a cat---Maureen.Mo", "Raise a cat---Maureen.Mo/Video.mp4"),
    ("51-Survival--Sawyer", "Survival", "Sawyer Johanneman", "Sawyer_Johanneman_Game_Design Final 2", "Sawyer_Johanneman_Game_Design Final 2/Survival Recording.mov"),
    ("52-Speed-Car--JinXuan-Sarah", "Speed Car Tournament", "JinXuan / Sarah Ma", "speed-car-tournament-JinXuan Ma: Sarah.Ma", "speed-car-tournament-JinXuan Ma: Sarah.Ma/Screen Recording 2026-07-23 at 1.59.58 PM.mov"),
    ("53-The-Escape--Ada", "The Escape", "Ada vd", "The escape-Ada vd", "The escape-Ada vd/Screen Recording 2026-07-23 at 09.54.58/Screen Recording 2026-07-23 at 09.54.58.mov"),
    ("54-To-the-End--Hanson-Liu", "To the End", "Hanson Liu", "To the end- Group2 Hanson Liu", "To the end- Group2 Hanson Liu/Screen Recording 2026-07-23 at 09.41.37.mov"),
    ("55-To-Leave--Tianle", "To Leave", "Tianle", "to-leave-tianle", "to-leave-tianle/录屏2026-07-23 14.05.05.mov"),
    ("56-Villainous-House--Wang-Yizhen", "The Villainous House", "Wang Yizhen", "Wang Yizhen 凶宅", "Wang Yizhen 凶宅/Recording.mov"),
    ("57-Lab-Escape--Weiru-Xu", "Lab Escape", "Weiru Xu", "WeiruXu_LabEscape", "WeiruXu_LabEscape/Aufzeichnung 2026-07-23 140537.mp4"),
    ("58-Wing-Flight--Suria-Sun", "Wing Flight", "Suria Sun", "WING-FLIGHT group2 Suria SUN", "WING-FLIGHT group2 Suria SUN/Play — Wing Flight 和另外 1 个页面 - 用户配置 1 - Microsoft​ Edge 2026-07-23 09-39-13.mp4"),
    ("59-Paper-Folding--Yilia-JinXuan", "Paper Folding", "Yilia Hu / JinXuan", "Yilia Hu JinXuan-paper folding", "Yilia Hu JinXuan-paper folding/玩法教程.mov"),
    ("60-Dodge-Dish--Yuhan-Ma", "Dodge & Dish", "Yuhan Ma", "Yuhan Ma_dodge&dish", "Yuhan Ma_dodge&dish/demo.mov"),
    ("61-Bake-Carefully--YuYu", "Bake Carefully", "YuYu Choi", "YuYu - Bakery", "YuYu - Bakery/Screen Recording 2026-07-23 at 2.53.29 PM.mov"),
    ("62-Basketball--Huang-Xinxian", "Win a Basketball Game", "Huang Xinxian", "黄馨娴。win a basketball game", "黄馨娴。win a basketball game/录屏2026-07-23 13.55.19.mov"),
]


def day1_sources() -> list[tuple[str, Path]]:
    items = []
    for p in sorted(MEDIA.iterdir()):
        if p.suffix.lower() in {".mp4", ".mov"} and not p.name.startswith("."):
            # resolve symlink
            src = p.resolve() if p.is_symlink() else p
            items.append((p.stem, src))
    return items


def process_one(stem: str, src: Path, picks: list[dict]) -> None:
    if not src.exists():
        print(f"MISSING {stem}: {src}", flush=True)
        return
    dur = probe_duration(src)
    print(f"ANALYZE {stem} ({dur:.0f}s, {src.stat().st_size/1e6:.0f}MB)", flush=True)
    scores = motion_scores(src, dur)
    start_proxy = best_window(scores, dur, PROXY_LEN)
    start_clip = best_window(scores, dur, CLIP_LEN)

    proxy_dest = PROXIES / f"{stem}.mp4"
    clip_dest = CLIPS / f"{stem}.mp4"
    ok1 = export_clip(src, proxy_dest, start_proxy, PROXY_LEN)
    ok2 = export_clip(src, clip_dest, start_clip, CLIP_LEN)
    print(
        f"  {'OK' if ok1 else 'FAIL'} proxy@{start_proxy:.1f}s  "
        f"{'OK' if ok2 else 'FAIL'} clip@{start_clip:.1f}s",
        flush=True,
    )
    picks.append(
        {
            "stem": stem,
            "source": str(src),
            "duration": round(dur, 2),
            "proxy_start": round(start_proxy, 2),
            "clip_start": round(start_clip, 2),
            "proxy_ok": ok1,
            "clip_ok": ok2,
        }
    )


def main() -> None:
    PROXIES.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    LOG.write_text("")
    picks: list[dict] = []

    print("=== Day1 rebuild ===", flush=True)
    for stem, src in day1_sources():
        process_one(stem, src, picks)

    print("\n=== Thursday add ===", flush=True)
    thu_media = MEDIA / "thu"
    thu_media.mkdir(parents=True, exist_ok=True)
    manifest_rows = []
    for slug, title, author, _folder, rel in THU_MAP:
        src = THU / rel
        if not src.exists():
            print(f"MISSING thu src: {rel}", flush=True)
            continue
        link = thu_media / f"{slug}{src.suffix.lower()}"
        if link.exists() or link.is_symlink():
            link.unlink()
        try:
            link.symlink_to(src)
        except OSError:
            shutil.copy2(src, link)
        process_one(slug, src, picks)
        manifest_rows.append(
            {
                "clip": slug,
                "title": title,
                "author": author,
                "source": rel,
                "mb": round(src.stat().st_size / 1e6, 1),
            }
        )

    (SHOWREEL / "gameplay-picks.json").write_text(
        json.dumps(picks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (SHOWREEL / "manifest-thu.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["clip", "title", "author", "source", "mb"])
        w.writeheader()
        w.writerows(manifest_rows)

    ok_p = sum(1 for p in picks if p.get("proxy_ok"))
    ok_c = sum(1 for p in picks if p.get("clip_ok"))
    print(f"\nDONE proxies {ok_p}/{len(picks)}  clips {ok_c}/{len(picks)}", flush=True)
    print(f"OUT {PROXIES}", flush=True)
    print(f"OUT {CLIPS}", flush=True)


if __name__ == "__main__":
    main()
