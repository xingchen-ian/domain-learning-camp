#!/usr/bin/env python3
"""Intake GameDesignFinal_Day1 playable games into gallery/projects/."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "GameDesignFinal_Day1"
GALLERY = ROOT / "gallery"
PROJECTS = GALLERY / "projects"

VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
SKIP_NAMES = {".DS_Store", "__MACOSX"}
SKIP_DIR_NAMES = {"node_modules", "WorkBuddy", ".workbuddy", ".git"}


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:60] or "game"


def copy_tree(src: Path, dst: Path, *, skip_videos: bool = True) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)

    for path in src.rglob("*"):
        rel = path.relative_to(src)
        if any(part in SKIP_DIR_NAMES for part in rel.parts):
            continue
        if path.name in SKIP_NAMES:
            continue
        if path.is_dir():
            continue
        if skip_videos and path.suffix.lower() in VIDEO_EXTS:
            # Keep in-game background videos under exhibition/assets/videos
            if "assets/videos" not in str(rel).replace("\\", "/"):
                continue
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def wrap_single_html(html_src: Path, dest_ex: Path, title: str) -> None:
    """Place a single-file game into exhibition/ with a thin home page."""
    if dest_ex.exists():
        shutil.rmtree(dest_ex)
    dest_ex.mkdir(parents=True)
    game_name = "game.html"
    shutil.copy2(html_src, dest_ex / game_name)
    # Also keep original name if spaces/special — game.html is canonical
    index = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — Home</title>
  <style>
    body {{
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #091015; color: #edf2ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    a {{
      display: inline-block; padding: 14px 22px;
      border: 1px solid rgba(202,218,220,0.28); border-radius: 3px;
      color: #fff; background: #c85243; text-decoration: none; font-weight: 700;
    }}
    h1 {{ margin: 0 0 12px; font-size: 28px; }}
    p {{ color: #a8b5b1; margin: 0 0 28px; }}
    .box {{ text-align: center; padding: 40px; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>{title}</h1>
    <p>Summer Camp submission</p>
    <a href="game.html">Play →</a>
  </div>
</body>
</html>
"""
    (dest_ex / "index.html").write_text(index, encoding="utf-8")


def copy_loose_site(src_dir: Path, dest_ex: Path, *, entry: str = "index.html") -> None:
    """Copy HTML site files (no videos) into exhibition/."""
    if dest_ex.exists():
        shutil.rmtree(dest_ex)
    dest_ex.mkdir(parents=True)

    for path in src_dir.iterdir():
        if path.name in SKIP_NAMES or path.suffix.lower() in {".zip", ".txt", ".md"} and path.name.lower().startswith("readme"):
            # still copy readme if useful — skip videos/zips
            if path.suffix.lower() in {".zip"} or path.suffix.lower() in VIDEO_EXTS:
                continue
        if path.suffix.lower() in VIDEO_EXTS or path.suffix.lower() == ".zip":
            continue
        if path.name in SKIP_NAMES:
            continue
        if path.is_dir():
            if path.name in SKIP_DIR_NAMES:
                continue
            copy_tree(path, dest_ex / path.name, skip_videos=True)
        else:
            if path.suffix.lower() in VIDEO_EXTS:
                continue
            shutil.copy2(path, dest_ex / path.name)

    # Ensure index.html exists
    if not (dest_ex / "index.html").exists():
        # find any html
        htmls = list(dest_ex.glob("*.html"))
        if htmls:
            shutil.copy2(htmls[0], dest_ex / "index.html")


# (slug, title, titleZh, domain, domainZh, summary, summaryZh, team, source_rel, mode)
# mode: exhibition | site | single
# source_rel: path relative to GameDesignFinal_Day1 pointing to package or exhibition parent / html file

GAMES = [
    {
        "id": "a-skating-novice",
        "title": "A Skating Novice",
        "titleZh": "滑冰新手",
        "domain": "Ice skating",
        "domainZh": "滑冰",
        "summary": "Learn the feel of skating as a beginner through a playable project site.",
        "summaryZh": "通过可玩项目体验初学者滑冰的感觉。",
        "team": "Sihan Lyu",
        "mode": "site",
        "src": "A Skating Novice_by Sihan Lyu",
    },
    {
        "id": "hue-keeper",
        "title": "Hue Keeper",
        "titleZh": "色相守护",
        "domain": "Color / Hue",
        "domainZh": "色彩 / 色相",
        "summary": "Keep and read hues through a light-and-color game system.",
        "summaryZh": "通过光色系统学习辨认与守护色相。",
        "team": "Amy Fang",
        "mode": "exhibition",
        "src": "Amy Fang-Hue Keeper/exhibition",
    },
    {
        "id": "keep-going",
        "title": "Keep Going",
        "titleZh": "继续跑",
        "domain": "Trail running",
        "domainZh": "越野跑",
        "summary": "A trail-run game about pacing and keeping going.",
        "summaryZh": "关于节奏与坚持的越野跑游戏。",
        "team": "Amy Xiao",
        "mode": "site",
        "src": "Amy Xiao/keep-going-game",
    },
    {
        "id": "adventure-on-horseback",
        "title": "An Adventure on Horseback",
        "titleZh": "马背冒险",
        "domain": "Horseback riding",
        "domainZh": "骑马",
        "summary": "An adventure that turns horseback experience into an interactive system.",
        "summaryZh": "将骑马体验抽象为可交互的冒险系统。",
        "team": "Angelina Xu",
        "mode": "exhibition",
        "src": "Angelina徐梓淇-An adventure on  horseback/2026-Camp-Group-XX-An-adventure-on-horseback/exhibition",
    },
    {
        "id": "dream-cake-studio",
        "title": "Dream Cake STUDIO",
        "titleZh": "梦幻蛋糕工作室",
        "domain": "Baking / Cake design",
        "domainZh": "烘焙 / 蛋糕设计",
        "summary": "Design and bake in a dream-cake studio game.",
        "summaryZh": "在梦幻蛋糕工作室里设计与烘焙。",
        "team": "Annie Yang",
        "mode": "exhibition",
        "src": "Annie Yang-Dream Cake Studio/dream-cake-studio/exhibition",
    },
    {
        "id": "bug-stealth",
        "title": "Bug Stealth",
        "titleZh": "虫虫潜行",
        "domain": "Insects / Stealth",
        "domainZh": "昆虫 / 潜行",
        "summary": "A stealth game inspired by how bugs move and hide.",
        "summaryZh": "从昆虫移动与隐蔽中抽象出的潜行游戏。",
        "team": "Cindy Chen",
        "mode": "exhibition",
        "src": "Bug Stealth-Cindy Chen/gamedemo/exhibition",
    },
    {
        "id": "knead-for-speed",
        "title": "Knead for Speed",
        "titleZh": "揉面竞速",
        "domain": "Bread kneading",
        "domainZh": "揉面",
        "summary": "Turn kneading dough into a timing-and-feel speed challenge.",
        "summaryZh": "把揉面的节奏与手感变成竞速挑战。",
        "team": "Camellia Cai",
        "mode": "exhibition",
        "src": "Camellia Cai - Knead for Speed/Knead for Speed/exhibition",
    },
    {
        "id": "art-class",
        "title": "Art Class",
        "titleZh": "美术课",
        "domain": "Calligraphy tracing",
        "domainZh": "描红",
        "summary": "A drawing/tracing practice game from art class.",
        "summaryZh": "来自美术课的描红练习游戏。",
        "team": "Charlene",
        "mode": "single",
        "src": "Charlene Art Class Game/art-class-game.html",
    },
    {
        "id": "animal-dash",
        "title": "Animal Dash",
        "titleZh": "动物冲刺",
        "domain": "Animals / Racing",
        "domainZh": "动物 / 竞速",
        "summary": "Dash and race with animal movement as the core feel.",
        "summaryZh": "以动物运动感为核心的冲刺竞速。",
        "team": "Chengxuan Zhang",
        "mode": "site",
        "src": "Chengxuan zhang-Animal Dash/Animal_Dash",
    },
    {
        "id": "spectrum-path",
        "title": "Spectrum Path",
        "titleZh": "光谱之路",
        "domain": "Light / Spectrum",
        "domainZh": "光 / 光谱",
        "summary": "Navigate with light and spectrum as the playable system.",
        "summaryZh": "把光与光谱变成可导航的游戏系统。",
        "team": "Chloe",
        "mode": "single",
        "src": "Chloe-Light/index.html",
    },
    {
        "id": "cycling-safety",
        "title": "Cycling Safety",
        "titleZh": "骑行安全",
        "domain": "Cycling",
        "domainZh": "骑行",
        "summary": "A bike-riding game about reading the road and riding safely.",
        "summaryZh": "关于读路与安全骑行的自行车游戏。",
        "team": "Cicichen",
        "mode": "exhibition",
        "src": "Cicichen Cycling game/gamedemo/exhibition",
    },
    {
        "id": "forest-drone-navigator",
        "title": "Forest Drone Navigator",
        "titleZh": "森林无人机导航",
        "domain": "Drone flight",
        "domainZh": "无人机飞行",
        "summary": "A 3D forest flight game about piloting a drone.",
        "summaryZh": "在森林中驾驶无人机的 3D 飞行游戏。",
        "team": "Eason He",
        "mode": "site",
        "src": "EasonHe -- 3D Drone Flight with hy3/drone3d-i18n",
    },
    {
        "id": "dream-echo",
        "title": "Dream",
        "titleZh": "梦境",
        "domain": "Dream / Environment",
        "domainZh": "梦境 / 环境",
        "summary": "Explore a dreamlike environment as an interactive system.",
        "summaryZh": "把梦境环境做成可探索的交互系统。",
        "team": "Echo Wu",
        "mode": "exhibition",
        "src": "GameDesign_EchoWu/game/exhibition",
    },
    {
        "id": "cake",
        "title": "Cake",
        "titleZh": "蛋糕",
        "domain": "Baking",
        "domainZh": "烘焙",
        "summary": "A cake-making game built from real baking experience.",
        "summaryZh": "从真实烘焙体验转译的做蛋糕游戏。",
        "team": "Huang Yan Yue",
        "mode": "exhibition",
        "src": "HUANG YAN YUE/Cake-Game-Project/exhibition",
    },
    {
        "id": "ski-mountain",
        "title": "Ski Mountain",
        "titleZh": "滑雪山",
        "domain": "Skiing",
        "domainZh": "滑雪",
        "summary": "Read the mountain and ski through a designed slope system.",
        "summaryZh": "读懂雪道与山势的滑雪游戏。",
        "team": "Henry Zhang",
        "mode": "exhibition",
        "src": "Henry Zhang - skiing game (game design)/Archive/exhibition",
    },
    {
        "id": "hidden-tides",
        "title": "Hidden Tides",
        "titleZh": "暗潮",
        "domain": "Sailing / Survival",
        "domainZh": "帆船 / 生存",
        "summary": "Caribbean sailing survival — read wind, tide, and risk.",
        "summaryZh": "加勒比帆船生存：读风、潮汐与风险。",
        "team": "Hidden Tides team",
        "mode": "exhibition",
        "src": "Hidden-Tides-Caribbean-Edition/exhibition",
    },
    {
        "id": "the-sea",
        "title": "The Sea",
        "titleZh": "海",
        "domain": "Diving",
        "domainZh": "潜水",
        "summary": "A first-person diving learning game about reading the sea.",
        "summaryZh": "第一人称潜水学习游戏，学会读懂海洋。",
        "team": "Jason Hu",
        "mode": "exhibition",
        "src": "Jason Hu-The Sea/the-sea/exhibition",
    },
    {
        "id": "rubiks-cube",
        "title": "3x3 Rubik's Cube",
        "titleZh": "三阶魔方",
        "domain": "Rubik's Cube",
        "domainZh": "魔方",
        "summary": "Learn cube notation and solving as a playable system.",
        "summaryZh": "把魔方公式与解法做成可玩系统。",
        "team": "Kimi Xu",
        "mode": "exhibition",
        "src": "Kimi Xu Game Design/exhibition",
    },
    {
        "id": "bullseye-archery",
        "title": "Bullseye Archery",
        "titleZh": "射箭靶心",
        "domain": "Archery",
        "domainZh": "射箭",
        "summary": "An archery challenge about aim, release, and precision.",
        "summaryZh": "关于瞄准、撒放与精准的射箭挑战。",
        "team": "Mulan",
        "mode": "single",
        "src": "Mulan/Bullseye Archery/Bullseye Archery.html",
    },
    {
        "id": "shark-bite",
        "title": "Shark Bite",
        "titleZh": "鲨鱼咬击",
        "domain": "Ocean / Sharks",
        "domainZh": "海洋 / 鲨鱼",
        "summary": "Ocean explorer game about shark behavior and the sea.",
        "summaryZh": "关于鲨鱼行为与海洋的探索游戏。",
        "team": "Natalia Ma",
        "mode": "exhibition",
        "src": "Natalia Ma shark-bite/exhibition",
    },
    {
        "id": "succulent-simulator",
        "title": "Succulent Care Simulator",
        "titleZh": "多肉植物养护模拟器",
        "domain": "Succulent care",
        "domainZh": "多肉养护",
        "summary": "A bilingual simulator for watering, light, and plant care.",
        "summaryZh": "浇水、光照与养护的双语多肉模拟器。",
        "team": "Rachel Li",
        "mode": "single",
        "src": "Rachel Li. succulent-simulator-bilingual /succulent-simulator-bilingual.html",
    },
    {
        "id": "squint",
        "title": "Squint",
        "titleZh": "眯眼看画",
        "domain": "Painting / Light",
        "domainZh": "绘画 / 光线",
        "summary": "A painting-and-light game about squinting to see value.",
        "summaryZh": "通过眯眼观察明暗与光影的绘画游戏。",
        "team": "Charlie",
        "mode": "site",
        "src": "SQUINT - charlie",
    },
    {
        "id": "racing",
        "title": "Racing",
        "titleZh": "赛车",
        "domain": "Racing",
        "domainZh": "竞速",
        "summary": "A racing game from real driving feel into a playable track.",
        "summaryZh": "把真实驾驶感转译成赛道游戏。",
        "team": "Sungmo",
        "mode": "exhibition",
        "src": "Sungmo-Racing game/racing-game/exhibition",
    },
    {
        "id": "beast-rush",
        "title": "Beast RUSH",
        "titleZh": "野兽冲刺",
        "domain": "Animal racing",
        "domainZh": "动物竞速",
        "summary": "Animal racing with rush pacing and creature feel.",
        "summaryZh": "带有动物冲刺感的竞速游戏。",
        "team": "Tiffany Chen",
        "mode": "single",
        "src": "TiffanyChen-BestRUSH/BeastRUSH/BeastRUSH-Game.html",
    },
    {
        "id": "how-to-skateboarding",
        "title": "How to Skateboarding",
        "titleZh": "如何滑板",
        "domain": "Skateboarding",
        "domainZh": "滑板",
        "summary": "Learn skateboarding moves through an interactive system.",
        "summaryZh": "通过交互系统学习滑板动作。",
        "team": "Wang Yiran",
        "mode": "exhibition",
        "src": "Wang Yiran- How to skateboarding/Wang Yiran  How to Skateboarding/exhibition",
    },
    {
        "id": "virtual-kitchen-lab",
        "title": "Virtual Kitchen Lab",
        "titleZh": "虚拟厨房实验室",
        "domain": "Cooking",
        "domainZh": "烹饪",
        "summary": "A cooking lab game about timing, heat, and kitchen decisions.",
        "summaryZh": "关于火候、时机与厨房决策的烹饪游戏。",
        "team": "Yijin Wang",
        "mode": "single",
        "src": "Yijin Wang - Virtual kitchen lab/virtual-kitchen-lab/index.html",
    },
    {
        "id": "golf",
        "title": "Golf",
        "titleZh": "高尔夫",
        "domain": "Golf",
        "domainZh": "高尔夫",
        "summary": "Read the green and swing — a golf system from real play.",
        "summaryZh": "读果岭与挥杆：来自真实高尔夫体验的系统。",
        "team": "Zoe Li",
        "mode": "exhibition",
        "src": "Zoe Li - Golf/golf-game/exhibition",
    },
    {
        "id": "password-chemistry",
        "title": "PASSWORD",
        "titleZh": "PASSWORD 化学密室",
        "domain": "Chemistry escape room",
        "domainZh": "化学密室逃脱",
        "summary": "A chemistry escape-room game about codes, labs, and deduction.",
        "summaryZh": "关于密码、实验室与推理的化学密室游戏。",
        "team": "Elsa Zhang",
        "mode": "exhibition",
        "src": "game design group1 Elsa zhangyiqing/exhibition",
    },
    {
        "id": "rock-climbing",
        "title": "Rock Climbing",
        "titleZh": "攀岩",
        "domain": "Rock climbing",
        "domainZh": "攀岩",
        "summary": "A climbing game about holds, balance, and route reading.",
        "summaryZh": "关于支点、平衡与线路阅读的攀岩游戏。",
        "team": "Tsung Ju Liu",
        "mode": "exhibition",
        "src": "rock climbing game Tsung Ju, Liu/rock-climbing-game/exhibition",
    },
    {
        "id": "in-the-opera-house",
        "title": "In the Opera House",
        "titleZh": "在歌剧院",
        "domain": "Opera / Stage",
        "domainZh": "歌剧 / 舞台",
        "summary": "Experience the opera house as an interactive spatial system.",
        "summaryZh": "把歌剧院做成可交互的空间系统。",
        "team": "Stella Yuyue Ji",
        "mode": "site",
        "src": "stella yuyue ji - in the opera house",
    },
    {
        "id": "curling-master",
        "title": "Curling Master",
        "titleZh": "冰壶大师",
        "domain": "Curling",
        "domainZh": "冰壶",
        "summary": "Weight, sweep, and line — curling as a playable system.",
        "summaryZh": "壶重、刷冰与线路：冰壶的可玩系统。",
        "team": "Ashley Chen",
        "mode": "single",
        "src": "陈思含Ashley-curling/curling-game/curling-game.html",
    },
]


def ingest_one(game: dict) -> dict:
    src = SRC / game["src"]
    if not src.exists():
        raise FileNotFoundError(src)

    dest = PROJECTS / game["id"]
    dest_ex = dest / "exhibition"
    dest.mkdir(parents=True, exist_ok=True)

    mode = game["mode"]
    if mode == "exhibition":
        copy_tree(src, dest_ex, skip_videos=True)
    elif mode == "site":
        copy_loose_site(src, dest_ex)
    elif mode == "single":
        wrap_single_html(src, dest_ex, game["title"])
    else:
        raise ValueError(mode)

    if not (dest_ex / "index.html").exists():
        raise RuntimeError(f"No index.html for {game['id']}")

    if (dest_ex / "game.html").exists():
        game_rel = "exhibition/game.html"
    elif (dest_ex / "standalone.html").exists():
        game_rel = "exhibition/standalone.html"
    else:
        game_rel = "exhibition/index.html"

    preview = None
    for cand in [
        dest / "preview.png",
        dest_ex / "preview.png",
        src.parent / "preview.png" if mode == "exhibition" else None,
    ]:
        if cand and cand.exists():
            if cand != dest / "preview.png":
                shutil.copy2(cand, dest / "preview.png")
            preview = f"projects/{game['id']}/preview.png"
            break

    return {
        "id": game["id"],
        "title": game["title"],
        "titleZh": game["titleZh"],
        "domain": game["domain"],
        "domainZh": game["domainZh"],
        "summary": game["summary"],
        "summaryZh": game["summaryZh"],
        "group": "day1",
        "team": game["team"],
        "teamDisplay": game["team"],
        "consent": "yes",
        "preview": preview,
        "entryPage": f"projects/{game['id']}/exhibition/index.html",
        "gamePage": f"projects/{game['id']}/{game_rel}",
        "featured": False,
    }


def main():
    # Keep existing sailer-game (group-04)
    sailer = {
        "id": "sailer-game",
        "title": "Sailer Game",
        "titleZh": "帆船游戏",
        "domain": "Sailing / Wind reading",
        "domainZh": "帆船 / 读风",
        "summary": "The boat does not go where you point it. Learn to read the wind, trim the sail, and tack to the buoy.",
        "summaryZh": "船不会驶向你指向的方向。学习读风、调帆，并通过换舷到达浮标。",
        "group": "group-04",
        "team": "Group 04 · Xiao",
        "teamDisplay": "Group 04 · Xiao",
        "consent": "yes",
        "preview": "projects/group-04/preview.png",
        "entryPage": "projects/group-04/exhibition/index.html",
        "gamePage": "projects/group-04/exhibition/game.html",
        "featured": True,
    }

    results = []
    errors = []
    for game in GAMES:
        try:
            entry = ingest_one(game)
            # verify entry exists
            entry_path = GALLERY / entry["entryPage"]
            if not entry_path.exists():
                raise FileNotFoundError(entry_path)
            results.append(entry)
            print(f"OK  {game['id']:28} → {entry['entryPage']}")
        except Exception as e:
            errors.append((game["id"], str(e)))
            print(f"ERR {game['id']:28} {e}")

    projects = [sailer] + results
    data = {
        "updated": "2026-07-23",
        "title": {"zh": "夏令营游戏展览", "en": "Summer Camp Game Gallery"},
        "description": {
            "zh": "文件按项目存放；展览首页把全部游戏平铺展示，并支持按游戏名搜索。",
            "en": "Files are stored by project; the exhibition homepage lists every game in one flat, searchable view.",
        },
        "storage": "by-project",
        "display": "flat-by-title",
        "projects": projects,
    }
    out = GALLERY / "projects.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {len(projects)} projects to {out}")
    if errors:
        print(f"Errors: {len(errors)}")
        for i, e in errors:
            print(f"  - {i}: {e}")


if __name__ == "__main__":
    main()
