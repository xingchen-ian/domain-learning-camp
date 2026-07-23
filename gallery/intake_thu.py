#!/usr/bin/env python3
"""Intake gamedesignfinal-thu playable games into gallery/projects/ (append to projects.json)."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "gamedesignfinal-thu"
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
        if path.name in SKIP_NAMES or path.name.startswith("._"):
            continue
        if path.is_dir():
            continue
        if skip_videos and path.suffix.lower() in VIDEO_EXTS:
            if "assets/videos" not in str(rel).replace("\\", "/"):
                continue
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def wrap_single_html(html_src: Path, dest_ex: Path, title: str) -> None:
    if dest_ex.exists():
        shutil.rmtree(dest_ex)
    dest_ex.mkdir(parents=True)
    shutil.copy2(html_src, dest_ex / "game.html")
    # Copy sibling assets if any (same folder)
    for path in html_src.parent.iterdir():
        if path == html_src or path.name.startswith("._"):
            continue
        if path.suffix.lower() in VIDEO_EXTS or path.suffix.lower() == ".zip":
            continue
        if path.is_file() and path.suffix.lower() in {".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"}:
            shutil.copy2(path, dest_ex / path.name)
        elif path.is_dir() and path.name.lower() in {"assets", "css", "js", "img", "images", "lib", "vendor"}:
            copy_tree(path, dest_ex / path.name, skip_videos=True)

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


def copy_loose_site(src_dir: Path, dest_ex: Path) -> None:
    if dest_ex.exists():
        shutil.rmtree(dest_ex)
    dest_ex.mkdir(parents=True)

    for path in src_dir.iterdir():
        if path.name in SKIP_NAMES or path.name.startswith("._"):
            continue
        if path.suffix.lower() in VIDEO_EXTS or path.suffix.lower() == ".zip":
            continue
        if path.is_dir():
            if path.name in SKIP_DIR_NAMES:
                continue
            copy_tree(path, dest_ex / path.name, skip_videos=True)
        else:
            shutil.copy2(path, dest_ex / path.name)

    if not (dest_ex / "index.html").exists():
        htmls = list(dest_ex.glob("*.html"))
        if htmls:
            shutil.copy2(htmls[0], dest_ex / "index.html")
    if not (dest_ex / "game.html").exists():
        # Prefer a game-named html, else index
        for cand in dest_ex.glob("*.html"):
            if "game" in cand.name.lower() and cand.name != "index.html":
                shutil.copy2(cand, dest_ex / "game.html")
                break
        if not (dest_ex / "game.html").exists() and (dest_ex / "index.html").exists():
            # index is the playable page
            pass


GAMES = [
    {
        "id": "sailing-game-alina",
        "title": "Sailing Game",
        "titleZh": "帆船游戏",
        "domain": "Sailing",
        "domainZh": "帆船",
        "summary": "Read the wind and sail — a playable sailing system.",
        "summaryZh": "读风与驾船：可玩的帆船系统。",
        "team": "Alina Zaigralova",
        "mode": "exhibition",
        "src": "alina zaigralova group 3 /sailing-game/exhibition",
    },
    {
        "id": "rotate-run",
        "title": "Rotate Run",
        "titleZh": "旋转跑酷",
        "domain": "Spatial rotation",
        "domainZh": "空间旋转",
        "summary": "Rotate the world and run through shifting paths.",
        "summaryZh": "旋转世界，在变化的路径中奔跑。",
        "team": "Xuanjie / Coral",
        "mode": "site",
        "src": "coral rotate/game-website",
    },
    {
        "id": "cued-speech",
        "title": "Cued Speech",
        "titleZh": "提示语",
        "domain": "Cued speech",
        "domainZh": "提示语",
        "summary": "Learn cued-speech patterns through a playable practice game.",
        "summaryZh": "通过可玩练习学习提示语模式。",
        "team": "Hanson Zheng",
        "mode": "single",
        "src": "CuedSpeechFinal-Hanson Zheng 郑湙泓/CuedspeechFinal.html",
    },
    {
        "id": "dyno-master",
        "title": "Dyno Master",
        "titleZh": "Dyno Master",
        "domain": "Free solo / Climbing feel",
        "domainZh": "徒手攀岩感",
        "summary": "A free-solo inspired challenge about timing and commitment.",
        "summaryZh": "关于时机与决心的徒手攀岩感挑战。",
        "team": "Nathan Fang",
        "mode": "single",
        "src": "Dyno Master- Nathan Fang 方之了/Dyno Master-free solo.html",
    },
    {
        "id": "echo-pathfinder",
        "title": "Echo Pathfinder",
        "titleZh": "回声寻路",
        "domain": "Echolocation / Pathfinding",
        "domainZh": "回声定位 / 寻路",
        "summary": "Find your way by reading echoes in space.",
        "summaryZh": "通过回声读懂空间并找到出路。",
        "team": "Yixuan Lyu",
        "mode": "single",
        "src": "echo-pathfindfer-group2-YixuanLyu/echo_pathfinder.html",
    },
    {
        "id": "first-diagnosis",
        "title": "First Diagnosis",
        "titleZh": "初次诊断",
        "domain": "First aid / Diagnosis",
        "domainZh": "急救 / 诊断",
        "summary": "Practice first-response diagnosis as a playable system.",
        "summaryZh": "把急救诊断做成可玩的决策系统。",
        "team": "Pim",
        "mode": "exhibition",
        "src": "First Aid - Pim/first-diagnosis/exhibition",
    },
    {
        "id": "ruff-routine",
        "title": "Fluffy Paws / Ruff Routine",
        "titleZh": "软爪日常",
        "domain": "Pet care",
        "domainZh": "宠物照料",
        "summary": "A pet-care routine game about reading a companion’s needs.",
        "summaryZh": "读懂宠物需求的日常照料游戏。",
        "team": "Aurora",
        "mode": "single",
        "src": "Fluffy Paws- Aurora/Fluffy Paws/ruff-routine.html",
    },
    {
        "id": "dream-village",
        "title": "Dream Village",
        "titleZh": "梦幻村庄",
        "domain": "Planting / Tower defense feel",
        "domainZh": "种植 / 塔防感",
        "summary": "Plant your own village defense in a dream landscape.",
        "summaryZh": "在梦幻村庄里种植与布防。",
        "team": "Cindy W",
        "mode": "single",
        "src": "Game design- Cindy w （group3） /Dream-Village-Plant-Your-Own-Zombie/game.html",
    },
    {
        "id": "angry-textbooks",
        "title": "Angry Textbooks",
        "titleZh": "愤怒课本",
        "domain": "Compulsory education",
        "domainZh": "义务教育",
        "summary": "A game system abstracted from compulsory schooling pressure.",
        "summaryZh": "从义务教育压力中抽象出的游戏系统。",
        "team": "Thomas Li",
        "mode": "single",
        "src": "Game design- Thomas Li/李其乐+义务教育/angry-textbooks.html",
    },
    {
        "id": "nature-balance",
        "title": "Nature Balance Simulator",
        "titleZh": "自然平衡模拟器",
        "domain": "Ecosystem balance",
        "domainZh": "生态平衡",
        "summary": "Balance an ecosystem by reading feedback between species.",
        "summaryZh": "通过物种反馈学习生态平衡。",
        "team": "Harry Tang",
        "mode": "single",
        "src": "Harry Tang - Ecosystem/自然平衡模拟器/index.html",
    },
    {
        "id": "into-the-unknown",
        "title": "Into the Unknown",
        "titleZh": "进入未知",
        "domain": "Cave exploration",
        "domainZh": "洞穴探索",
        "summary": "Explore caves with limited light — learn to read the dark.",
        "summaryZh": "在有限光照下探索洞穴，学会阅读黑暗。",
        "team": "Hawinate",
        "mode": "exhibition",
        "src": "Hawinate,Into the unknown/exhibition",
    },
    {
        "id": "time-garden",
        "title": "Time Garden",
        "titleZh": "时间花园",
        "domain": "Gardening / Time",
        "domainZh": "园艺 / 时间",
        "summary": "A garden game about patience, seasons, and care over time.",
        "summaryZh": "关于耐心、季节与时间照料的花园游戏。",
        "team": "Huang Aili",
        "mode": "single",
        "src": "huang-aili-time-garden/huang aili.html",
    },
    {
        "id": "interstellar",
        "title": "INTERSTELLAR",
        "titleZh": "星际",
        "domain": "Space travel",
        "domainZh": "太空航行",
        "summary": "A space journey game about navigation and cosmic systems.",
        "summaryZh": "关于导航与宇宙系统的星际旅程。",
        "team": "Yvette Wang",
        "mode": "single",
        "src": "INTERSTELLAR-Yvette Wang 王怡辰/game.html",
    },
    {
        "id": "neon-strike",
        "title": "Neon Strike",
        "titleZh": "霓虹突击",
        "domain": "Rhythm / Action",
        "domainZh": "节奏 / 动作",
        "summary": "Strike on the neon beat — timing as the core skill.",
        "summaryZh": "在霓虹节拍中突击——时机就是核心技能。",
        "team": "Joe Wu",
        "mode": "single",
        "src": "neon strike  Joe Wu/neon-strike/neon-strike/index.html",
    },
    {
        "id": "peppa-runner",
        "title": "Peppa Running",
        "titleZh": "佩奇跑酷",
        "domain": "Running / Timing",
        "domainZh": "奔跑 / 时机",
        "summary": "A 2D runner about pacing, jumps, and reading the path.",
        "summaryZh": "关于节奏、跳跃与读路的 2D 跑酷。",
        "team": "Zhenxi Yi",
        "mode": "single",
        "src": "Peppa running- Group2-Zhenxi Yi/peppa-runner-2d.html",
    },
    {
        "id": "cello-resonance",
        "title": "Cello Resonance",
        "titleZh": "大提琴共鸣",
        "domain": "Cello / Music",
        "domainZh": "大提琴 / 音乐",
        "summary": "Feel cello resonance as an interactive musical system.",
        "summaryZh": "把大提琴共鸣做成可交互的音乐系统。",
        "team": "Peter",
        "mode": "site",
        "src": "Peter Cello game/CelloResonance_Game",
    },
    {
        "id": "sky-storm",
        "title": "Sky Storm",
        "titleZh": "天空风暴",
        "domain": "Flight / Weather",
        "domainZh": "飞行 / 天气",
        "summary": "Fly through storm systems and read the sky.",
        "summaryZh": "穿越风暴系统，学会阅读天空。",
        "team": "Harry",
        "mode": "single",
        "src": "project skystorm-Harry/sky-storm-en/sky-storm-en.html",
    },
    {
        "id": "granny-square-rhythm",
        "title": "Granny Square Rhythm",
        "titleZh": "祖母方格节奏",
        "domain": "Crochet / Pattern",
        "domainZh": "钩针 / 图案",
        "summary": "Crochet granny-square patterns as a rhythmic game system.",
        "summaryZh": "把钩针祖母方格做成有节奏的游戏系统。",
        "team": "Qingrong Jiang",
        "mode": "exhibition",
        "src": "Qingrong Jiang/2026-Camp-Group-02-GrannySquareRhythm/exhibition",
    },
    {
        "id": "raise-a-cat",
        "title": "Raise a Cat",
        "titleZh": "养猫",
        "domain": "Cat care",
        "domainZh": "猫的照料",
        "summary": "Raise a cat by reading needs, moods, and daily care loops.",
        "summaryZh": "通过读懂需求与情绪来照料一只猫。",
        "team": "Maureen Mo",
        "mode": "exhibition",
        "src": "Raise a cat---Maureen.Mo/exhibition",
    },
    {
        "id": "survival",
        "title": "Survival",
        "titleZh": "生存",
        "domain": "Wilderness survival",
        "domainZh": "野外生存",
        "summary": "Survive by managing resources, risk, and decisions.",
        "summaryZh": "通过资源、风险与决策学习生存。",
        "team": "Sawyer Johanneman",
        "mode": "exhibition",
        "src": "Sawyer_Johanneman_Game_Design Final 2/Survival/exhibition",
    },
    {
        "id": "speed-car-tournament",
        "title": "Speed Car Tournament",
        "titleZh": "极速赛车锦标赛",
        "domain": "Racing",
        "domainZh": "赛车",
        "summary": "A tournament racer about speed, control, and track reading.",
        "summaryZh": "关于速度、操控与读赛道的锦标赛。",
        "team": "JinXuan Ma / Sarah Ma",
        "mode": "single",
        "src": "speed-car-tournament-JinXuan Ma: Sarah.Ma/index.html",
    },
    {
        "id": "the-escape",
        "title": "The Escape",
        "titleZh": "逃脱",
        "domain": "Escape / Spatial puzzle",
        "domainZh": "逃脱 / 空间谜题",
        "summary": "Escape by reading space, clues, and constrained choices.",
        "summaryZh": "通过阅读空间与线索完成逃脱。",
        "team": "Ada vd",
        "mode": "single",
        "src": "The escape-Ada vd/the-escape-playable/the-escape.html",
    },
    {
        "id": "to-the-end",
        "title": "To the End",
        "titleZh": "抵达终点",
        "domain": "Endurance / Journey",
        "domainZh": "耐力 / 旅程",
        "summary": "Push toward the end through a designed journey system.",
        "summaryZh": "在设计好的旅程系统中抵达终点。",
        "team": "Hanson Liu",
        "mode": "exhibition",
        "src": "To the end- Group2 Hanson Liu/to-the-end/exhibition",
    },
    {
        "id": "to-leave",
        "title": "To Leave",
        "titleZh": "离开",
        "domain": "Departure / Choice",
        "domainZh": "离开 / 选择",
        "summary": "A game about leaving — choices, timing, and consequence.",
        "summaryZh": "关于离开：选择、时机与后果。",
        "team": "Tianle",
        "mode": "exhibition",
        "src": "to-leave-tianle/exhibition",
    },
    {
        "id": "villainous-house",
        "title": "The Villainous House",
        "titleZh": "凶宅",
        "domain": "Haunted house / Spatial fear",
        "domainZh": "凶宅 / 空间恐惧",
        "summary": "Explore a villainous house by reading space and threat.",
        "summaryZh": "通过阅读空间与威胁探索凶宅。",
        "team": "Wang Yizhen",
        "mode": "single",
        "src": "Wang Yizhen 凶宅/凶宅The Villainous House - by Wang Yizhen/index.html",
    },
    {
        "id": "lab-escape",
        "title": "Lab Escape",
        "titleZh": "实验室逃脱",
        "domain": "Lab escape room",
        "domainZh": "实验室密室",
        "summary": "Escape the lab through observation, tools, and deduction.",
        "summaryZh": "通过观察、工具与推理逃离实验室。",
        "team": "Weiru Xu",
        "mode": "exhibition",
        "src": "WeiruXu_LabEscape/lab-escape/lab-escape/exhibition",
    },
    {
        "id": "wing-flight",
        "title": "Wing Flight",
        "titleZh": "翼之飞行",
        "domain": "Flight / Wings",
        "domainZh": "飞行 / 翅膀",
        "summary": "Learn flight feel — lift, glide, and reading the air.",
        "summaryZh": "学习飞行感：升力、滑翔与读空气。",
        "team": "Suria Sun",
        "mode": "exhibition",
        "src": "WING-FLIGHT group2 Suria SUN/wing-flight/exhibition",
    },
    {
        "id": "paper-folding",
        "title": "Paper Folding",
        "titleZh": "折纸",
        "domain": "Origami",
        "domainZh": "折纸",
        "summary": "Fold paper step by step — sequence and spatial thinking.",
        "summaryZh": "一步步折纸：序列与空间思维。",
        "team": "Yilia Hu / JinXuan",
        "mode": "site",
        "src": "Yilia Hu JinXuan-paper folding",
    },
    {
        "id": "dodge-dish",
        "title": "Dodge & Dish",
        "titleZh": "闪避与上菜",
        "domain": "Kitchen service",
        "domainZh": "厨房服务",
        "summary": "Dodge and serve — kitchen pressure as a playable system.",
        "summaryZh": "闪避与上菜：厨房压力的可玩系统。",
        "team": "Yuhan Ma",
        "mode": "single",
        "src": "Yuhan Ma_dodge&dish/dodge:dish.html",
    },
    {
        "id": "bake-carefully",
        "title": "Bake Carefully",
        "titleZh": "小心烘焙",
        "domain": "Baking",
        "domainZh": "烘焙",
        "summary": "Bake with care — timing, heat, and kitchen judgment.",
        "summaryZh": "小心烘焙：火候、时机与厨房判断。",
        "team": "YuYu Choi",
        "mode": "exhibition",
        "src": "YuYu - Bakery/YuYu - Bakery/exhibition",
    },
]


SKIPPED = [
    {
        "folder": "Escape the Cellar - Doris",
        "title": "Escape the Cellar",
        "team": "Doris",
        "reason": "Submitted as Next.js/Vite source (needs build); no static exhibition HTML.",
        "reasonZh": "提交的是 Next.js/Vite 源码包，需构建，没有可直接托管的静态展览页。",
    },
    {
        "folder": "general(with ai) - group2 - rex xinyi li",
        "title": "General (with AI)",
        "team": "Rex / Xinyi Li",
        "reason": "Submitted as Next.js client/server app; no static playable HTML package.",
        "reasonZh": "提交的是 Next.js 前后端工程，没有静态可玩 HTML 包。",
    },
    {
        "folder": "黄馨娴。win a basketball game",
        "title": "Win a Basketball Game",
        "team": "Huang Xinxian (黄馨娴)",
        "reason": "ZIP contains the course website, not the basketball game; only a screen recording is present.",
        "reasonZh": "ZIP 里是课程网站而非篮球游戏本体，只有录屏可用。",
    },
    {
        "folder": "Weiru_LabEscape",
        "title": "Lab Escape (duplicate package)",
        "team": "Weiru Xu",
        "reason": "Duplicate of WeiruXu_LabEscape; gallery lists one Lab Escape entry.",
        "reasonZh": "与 WeiruXu_LabEscape 重复；展览只保留一份 Lab Escape。",
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
    else:
        game_rel = "exhibition/index.html"

    preview = None
    for cand in [
        dest / "preview.png",
        dest_ex / "preview.png",
        src.parent / "preview.png" if mode == "exhibition" else None,
        src / "preview.png" if mode == "site" else None,
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
        "group": "thu",
        "team": game["team"],
        "teamDisplay": game["team"],
        "consent": "yes",
        "preview": preview,
        "entryPage": f"projects/{game['id']}/exhibition/index.html",
        "gamePage": f"projects/{game['id']}/{game_rel}",
        "featured": False,
    }


def main() -> None:
    existing = json.loads((GALLERY / "projects.json").read_text(encoding="utf-8"))
    # Drop prior thu entries if re-running
    kept = [p for p in existing["projects"] if p.get("group") != "thu"]
    thu_ids = {g["id"] for g in GAMES}
    kept = [p for p in kept if p["id"] not in thu_ids]

    results = []
    errors = []
    for game in GAMES:
        try:
            entry = ingest_one(game)
            entry_path = GALLERY / entry["entryPage"]
            if not entry_path.exists():
                raise FileNotFoundError(entry_path)
            results.append(entry)
            print(f"OK  {game['id']:28} → {entry['entryPage']}")
        except Exception as e:
            errors.append((game["id"], str(e)))
            print(f"ERR {game['id']:28} {e}")

    projects = kept + results
    data = {
        "updated": "2026-07-23",
        "title": existing.get("title", {"zh": "夏令营游戏展览", "en": "Summer Camp Game Gallery"}),
        "description": existing.get(
            "description",
            {
                "zh": "文件按项目存放；展览首页把全部游戏平铺展示，并支持按游戏名搜索。",
                "en": "Files are stored by project; the exhibition homepage lists every game in one flat, searchable view.",
            },
        ),
        "storage": "by-project",
        "display": "flat-by-title",
        "projects": projects,
    }
    out = GALLERY / "projects.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = {
        "thu_ingested": len(results),
        "thu_errors": [{"id": i, "error": e} for i, e in errors],
        "thu_skipped": SKIPPED,
        "gallery_total": len(projects),
        "by_group": {},
    }
    for p in projects:
        g = p.get("group", "other")
        summary["by_group"][g] = summary["by_group"].get(g, 0) + 1

    (GALLERY / "intake_thu_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"\nWrote {len(projects)} projects to {out}")
    print(f"Thu OK: {len(results)}  errors: {len(errors)}  skipped: {len(SKIPPED)}")
    print("By group:", summary["by_group"])
    if errors:
        for i, e in errors:
            print(f"  - {i}: {e}")


if __name__ == "__main__":
    main()
