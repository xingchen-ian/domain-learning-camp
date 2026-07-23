/* ============================================================
   Bilingual engine — Chinese / English
   Default language: English (en). The "中文 / English" switch
   lives top-right on both the home page and the game page.
   Every string is looked up from window.I18N[lang][key].
   ============================================================ */
window.I18N = {
  /* ---------------- ENGLISH (default) ---------------- */
  en: {
    page_title: 'Forest Drone Navigator · 3D',
    home_link: '← Home',

    /* HUD */
    hud_alt_label: 'ALTITUDE',
    hud_alt_sub: 'Goal: reach 0 on the LAND pad',
    hud_wind_label: 'WIND',
    hud_wind_hint: 'Watch the wind—compensate early',
    hud_time: '⏱ 0 s',
    hud_level: 'Level: —',
    hud_speed: 'Speed 0',
    hud_progress: 'To LAND 0 m',

    /* Menu */
    menu_h1: 'Forest Drone Navigator · 3D',
    menu_lead: 'Fly your drone through the forest and <b>reach the LAND pad with altitude at 0</b> to win.<br/>Watch out for building-tall trees (fly over) and overhead cables (dip under), and always compensate for the wind.',
    menu_lv1_name: 'P1 · Beginner',
    menu_lv1_desc: 'Short trees · light wind · no cables',
    menu_lv2_name: 'P2 · Intermediate',
    menu_lv2_desc: 'Tall trees (some above start) · moderate wind · 3 cables',
    menu_lv3_name: 'P3 · Challenge',
    menu_lv3_desc: 'Tallest trees · strong wind · 4 cables',
    menu_hint: 'Tip: Inside a level, press <b>Space</b> to see the controls and start.',

    /* Help / tutorial */
    help_h2: 'Controls (press <b>Space</b> to start / pause)',
    help_k1: "<span class='key'>W</span> Throttle forward",
    help_k2: "<span class='key'>S</span> Brake / reverse",
    help_k3: "<span class='key'>A</span> Strafe left",
    help_k4: "<span class='key'>D</span> Strafe right",
    help_k5: "<span class='key'>U</span> Ascend",
    help_k6: "<span class='key'>H</span> Descend",
    help_k7: "<span class='key'>Ctrl</span> Boost: hold Control for extra thrust (faster, but more inertia—ease off early)",
    help_k8: "<span class='key'>Space</span> Pause / resume (shows this guide)",
    help_n1: "🎯 <b>Win:</b> Fly to the <b>LAND</b> pad at the end and hold <b>H</b> to bring altitude down to <b>0</b>. Touch down off the pad and you crash.",
    help_n2: "🌬️ The <b>WIND</b> readout shows speed and direction; the wind keeps pushing you off course—compensate against it early.",
    help_n3: "🌲 Fly <b>over</b> tall trees; ⌁ stay <b>below the marked height</b> to pass under overhead cables.",
    help_n4: "⏱ The <b>timer</b> in the top-right counts down; <b>harder tiers have less time</b> (P1 60s / P2 40s / P3 30s). Hit zero and the mission fails.",
    help_adv: "⚠️ <b>Advanced (P2 / P3):</b> Stronger wind here, and some trees rise above your 70 m start height—you must actively <b>climb over</b> them. Cables force you to <b>drop low</b> and slip beneath. Read the wind first, then weave an S-shaped path switching between 'climb over trees / dive under cables'.",
    help_hint: 'Press <b>Space</b> to start.',

    /* Win / Lose */
    win_h1: '🏆 Landing Successful!',
    win_again: 'Play Again',
    win_menu: 'Choose Level',
    lose_h1: '💥 Mission Failed',
    lose_again: 'Try Again',
    lose_menu: 'Choose Level',

    /* Dynamic (filled at runtime) */
    hud_level_prefix: 'Level: ',
    speed_prefix: 'Speed ',
    boost_suffix: ' 🚀Boost',
    progress_prefix: 'To LAND ',
    win_msg: 'You compensated for the wind, kept your momentum under control, and touched down smoothly on the LAND pad ({name}). Time used: {used} s.',
    lose_tree: 'You hit a tree! Fly above the tree top to get over it.',
    lose_cable: 'You hit a cable! Stay below the marked height to slip under.',
    lose_ground: 'You touched down off the pad and crashed. Land on the LAND pad before descending.',
    lose_time: 'Out of time! Harder tiers have tighter limits—reach the LAND pad faster next time.',
    lose_out: 'You flew out of bounds! Stay within the left/right edges and the course end.',
    lose_default: 'Drone destroyed.',
    lv_names: ['P1 · Beginner', 'P2 · Intermediate', 'P3 · Challenge'],
    tree_label: 'tree {h}m',
    tall_label: 'TALL {h}m',
    cable_label: 'Altitude < {b} to pass',

    /* ---------------- HOME PAGE ---------------- */
    nav_brand: '🚁 Forest Drone Navigator · 3D',
    nav_home: 'Home',
    nav_play: 'Play Game',
    hero_sub: '3D · Three.js · Runs right in your browser · Fully offline',
    hero_h1: 'Forest Drone Navigator · 3D',
    hero_domain: '<strong>Domain:</strong> Drone flight with wind compensation and momentum control',
    hero_goal: "<strong>Goal:</strong> Pilot your drone through a dense forest, dodge tall trees and overhead cables, and reach the <strong>LAND</strong> pad at the far end—then bring it down to <strong>0</strong> altitude for a smooth landing. All the while you're fighting a constant crosswind that pushes you off course, and you must finish <strong>before time runs out</strong>.",
    tag1: 'Observe',
    tag2: 'Decide',
    tag3: 'Operate',
    tag4: 'Feedback',
    tag5: 'Adjust',
    hero_btn: '▶ Start Playing Now',

    ctrl_h2: 'Controls',
    ctrl_p: "No install, no internet—just open and play. Inside a level, press <kbd>Space</kbd> to see the controls and begin; press <kbd>Space</kbd> any time to pause / resume (the timer freezes with you).",
    ctrl_k1: "<kbd>W</kbd> / <kbd>S</kbd> — throttle forward / brake &amp; reverse",
    ctrl_k2: "<kbd>A</kbd> — strafe <b>left</b>　<kbd>D</kbd> — strafe <b>right</b>",
    ctrl_k3: "<kbd>U</kbd> / <kbd>H</kbd> — ascend / descend",
    ctrl_k4: "<kbd>Space</kbd> — pause / resume (shows this guide)",
    ctrl_quote: "When you let go, the drone doesn't stop instantly—it keeps <strong>gliding</strong> on its <strong>momentum</strong>, and the wind keeps nudging it off course. To hold a straight line you have to <strong>anticipate</strong> the drift and steer against it early.",

    dom_h2: 'Domain Knowledge',
    dom_real_h3: 'The Real Domain',
    dom_real_p: "The creator loves flying drones but finds plain sightseeing boring. The real fun is <em>navigation</em>—threading through an obstacle-filled forest, with the wind as an invisible enemy.",
    dom_mistakes_h3: 'Common Beginner Mistakes',
    dom_mistakes_li1: 'Assuming the drone flies straight wherever the nose points.',
    dom_mistakes_li2: 'Not realizing the drone keeps <strong>drifting forward</strong> on momentum after you release the controls.',
    dom_mistakes_li3: "Ignoring how the <strong>wind</strong> keeps changing your actual heading.",
    dom_mistakes_li4: 'Only letting go when a crash is already unavoidable—too late.',
    dom_expert_h3: 'What Experts Do',
    dom_expert_quote: "Beginners hold throttle and hope for a straight line; experts <strong>anticipate</strong>, make small corrections early, and counter the wind's push with opposite inputs to keep their path straight.",
    dom_why_h3: 'Why It Works as a Game',
    dom_why_p: "The game makes the invisible <strong>visible</strong>: the WIND readout shows speed and direction, momentum lets you feel the drone keep gliding after you let go, and the enlarged ALTITUDE gauge plus distance-to-LAND bar give instant feedback. Through repeated failures and adjustments, players shift their thinking from novice to expert.",

    sys_h2: 'System Design',
    sys_intro: 'The game is driven by three clearly separated groups of data:',
    sys_env_h3: 'Environment Data (the world)',
    sys_env_li1: "<strong>Wind</strong>—speed + direction, constantly pushing the drone off course.",
    sys_env_li2: "<strong>Tall trees</strong>—fly <b>over</b> them (some tower above the 70 m start height).",
    sys_env_li3: "<strong>Overhead cables</strong>—dip <b>below</b> the marked height to slip under.",
    sys_env_li4: "<strong>LAND pad</strong>—the landing target at the end of the course.",
    sys_ctrl_h3: 'Data From Player Controls',
    sys_ctrl_li1: "<b>W</b>/<b>S</b> forward / reverse thrust.",
    sys_ctrl_li2: "<b>A</b>/<b>D</b> strafe left / right.",
    sys_ctrl_li3: "<b>U</b>/<b>H</b> ascend / descend.",
    sys_res_h3: 'Results the System Computes',
    sys_res_li1: 'Drone position, velocity, altitude.',
    sys_res_li2: 'Whether it hit a tree / cable / touched ground off the pad.',
    sys_res_li3: 'Whether it reached the pad and dropped to 0 m.',
    sys_res_li4: "Whether the <strong>countdown</strong> has run out.",
    sys_fb_h3: 'Feedback Translation',
    sys_fb_li1: "<strong>WIND indicator</strong>—arrow shows direction, number shows speed.",
    sys_fb_li2: "<strong>ALTITUDE gauge</strong>—large readout + vertical bar + pad marker line.",
    sys_fb_li3: "<strong>⏱ Timer</strong>—turns red and flashes when 10 seconds remain.",
    sys_wl_h3: 'Win / Lose',
    sys_wl_li1: "<strong>Win:</strong> Fly above the <strong>LAND</strong> pad and hold <kbd>H</kbd> to bring altitude down to <strong>0 m</strong> for a smooth touchdown.",
    sys_wl_li2: "<strong>Lose:</strong> Hit a tree, hit a cable, touch ground off the pad, or let the <strong>countdown hit zero</strong>.",

    tiers_h2: 'Three Difficulty Tiers (different variables, not just looks)',
    tier_p1_lvl: 'P1 · Beginner',
    tier_p1_name: 'Calm Glade',
    tier_p1_li1: 'Short trees, light breeze',
    tier_p1_li2: 'No cable obstacles',
    tier_p1_li3: 'Shortest course',
    tier_p1_time: '⏱ Time limit 60 s',
    tier_p2_lvl: 'P2 · Intermediate',
    tier_p2_name: 'Crosswind Pass',
    tier_p2_li1: 'Tall trees (some above start height)',
    tier_p2_li2: 'Moderate wind · 3 cables',
    tier_p2_li3: 'Alternate tree / cable gates',
    tier_p2_time: '⏱ Time limit 40 s',
    tier_p3_lvl: 'P3 · Challenge',
    tier_p3_name: 'Gust Maze',
    tier_p3_li1: 'Tallest trees · strong wind',
    tier_p3_li2: '4 cables · longest course',
    tier_p3_li3: 'Climb over trees / dive under cables',
    tier_p3_time: '⏱ Time limit 30 s',
    tiers_note: "The harder the tier, the <strong>shorter the time limit</strong> (60 / 40 / 30 s)—you must fly right and fly fast.",

    about_h2: 'About This 3D Version',
    about_li1: "Rendered with <strong>Three.js (r128)</strong> in true 3D: chase camera, 3D drone / trees / cables / pad, and floating labels.",
    about_li2: "Three.js is <strong>bundled locally</strong> (<code>vendor/</code>), so it runs fully offline with zero network calls.",
    about_li3: 'Independent from the 2D version: this 3D build runs on its own port and never touches the original 2D game.',
    about_li4: "Levels use a deterministic 'gate scheduler' (tree gates and cable gates at fixed spacing) that guarantees every level is <strong>completable</strong>.",
    about_btn: '▶ Launch Forest Drone Navigator · 3D',
    footer: 'Forest Drone Navigator · 3D learning game · Built from domain-learning-brief.md'
  },

  /* ---------------- 中文 ---------------- */
  zh: {
    page_title: '无人机森林导航 · 3D',
    home_link: '← 首页',

    hud_alt_label: '高度 ALTITUDE',
    hud_alt_sub: '目标：降到 0 并落在 LAND',
    hud_wind_label: '风 WIND',
    hud_wind_hint: '注意风向，提前补偿',
    hud_time: '⏱ 0 s',
    hud_level: '关卡：—',
    hud_speed: '速度 0',
    hud_progress: '距 LAND 0 m',

    menu_h1: '无人机森林导航 · 3D',
    menu_lead: '驾驶无人机穿越森林，<b>抵达 LAND 平台并把高度降到 0</b> 即可获胜。<br/>小心高楼般的树木（从上方飞过）和头顶电缆（从下方钻过），并始终补偿风的影响。',
    menu_lv1_name: 'P1 · 入门',
    menu_lv1_desc: '矮树 · 微风 · 无障碍电缆',
    menu_lv2_name: 'P2 · 进阶',
    menu_lv2_desc: '高树(部分高于起点) · 中速风 · 3 条电缆',
    menu_lv3_name: 'P3 · 挑战',
    menu_lv3_desc: '最高树 · 强风 · 4 条电缆',
    menu_hint: '提示：进入关卡后按 <b>空格</b> 查看操作说明并开始。',

    help_h2: '操作说明（按 <b>空格</b> 开始 / 暂停）',
    help_k1: "<span class='key'>W</span> 向前推进（前进）",
    help_k2: "<span class='key'>S</span> 减速 / 后退",
    help_k3: "<span class='key'>A</span> 向左平移",
    help_k4: "<span class='key'>D</span> 向右平移",
    help_k5: "<span class='key'>U</span> 上升高度",
    help_k6: "<span class='key'>H</span> 下降高度",
    help_k7: "<span class='key'>Ctrl</span> 加速：按住 Control 提升推力（速度更快，但惯性更强，需提前减速）",
    help_k8: "<span class='key'>空格</span> 暂停 / 继续（显示本说明）",
    help_n1: '🎯 <b>胜利条件：</b>把无人机飞到尽头的 <b>LAND</b> 平台，并持续按 <b>H</b> 把高度降到 <b>0</b>。落地时若不在平台上则坠毁。',
    help_n2: '🌬️ 顶部 <b>WIND</b> 显示风速与方向，风会持续把无人机吹偏——提前向反方向补偿。',
    help_n3: '🌲 高树要从 <b>上方</b> 飞过；⌁ 头顶电缆要保持在 <b>低于标注高度</b> 才能通过。',
    help_n4: '⏱ 右上角 <b>计时</b> 在倒计时，<b>难度越高时限越短</b>（P1 60s / P2 40s / P3 30s），归零即任务失败。',
    help_adv: '⚠️ <b>进阶要点（P2 / P3）：</b>本关风力更强，且部分树木比你的起点高度（70 m）还高，必须主动 <b>爬升越过</b>；电缆要求你 <b>压低高度</b> 从下方钻过。请先观察风向，沿 S 形路线在“爬升过树 / 俯冲过缆”之间切换。',
    help_hint: '按 <b>空格</b> 开始游戏。',

    win_h1: '🏆 着陆成功！',
    win_again: '再玩一次',
    win_menu: '选择关卡',
    lose_h1: '💥 任务失败',
    lose_again: '再试一次',
    lose_menu: '选择关卡',

    hud_level_prefix: '关卡：',
    speed_prefix: '速度 ',
    boost_suffix: ' 🚀加速',
    progress_prefix: '距 LAND ',
    win_msg: '你成功补偿风、控制动量，并平稳降落在 LAND 平台（{name}）。用时 {used} 秒。',
    lose_tree: '撞上树木！请从树顶（top 高度）上方飞过。',
    lose_cable: '撞上电缆！请保持在标注高度以下从下方钻过。',
    lose_ground: '在平台外触地坠毁。请飞到 LAND 平台上再下降。',
    lose_time: '时间耗尽！难度越高时限越短——下次更快抵达 LAND 平台。',
    lose_out: '飞出飞行范围！请保持在场地左右边界与尽头之内。',
    lose_default: '无人机损毁。',
    lv_names: ['P1 · 入门', 'P2 · 进阶', 'P3 · 挑战'],
    tree_label: '树 {h}m',
    tall_label: '超高 {h}m',
    cable_label: '高度 < {b} 通过',

    nav_brand: '🚁 无人机森林导航 · 3D',
    nav_home: '首页',
    nav_play: '开始游戏',
    hero_sub: '3D · Three.js · 纯浏览器运行 · 完全离线',
    hero_h1: '无人机森林导航 · 3D',
    hero_domain: '<strong>领域：</strong>无人机飞行与风力补偿 / 动量控制',
    hero_goal: '驾驶无人机穿越茂密森林，躲避高树与头顶电缆，抵达尽头的 <strong>LAND</strong> 平台并把高度降到 <strong>0</strong> 平稳着陆——同时对抗持续把你吹偏的风，并在<strong>限定时间</strong>内完成。',
    tag1: '观察',
    tag2: '判断',
    tag3: '操作',
    tag4: '反馈',
    tag5: '调整',
    hero_btn: '▶ 立即开始游戏',

    ctrl_h2: '操作方式',
    ctrl_p: '无需安装、无需联网，打开即玩。进入关卡后按 <kbd>空格</kbd> 查看操作说明并开始；游戏中任意时刻按 <kbd>空格</kbd> 暂停 / 继续（计时同步冻结）。',
    ctrl_k1: '<kbd>W</kbd> / <kbd>S</kbd> — 前进 / 减速后退',
    ctrl_k2: '<kbd>A</kbd> — 向<b>左</b>平移　<kbd>D</kbd> — 向<b>右</b>平移',
    ctrl_k3: '<kbd>U</kbd> / <kbd>H</kbd> — 上升 / 下降高度',
    ctrl_k4: '<kbd>空格</kbd> — 暂停 / 继续（并显示说明）',
    ctrl_quote: '松开按键后无人机不会立刻停下——它带着<strong>动量</strong>继续滑行；风还会持续把它吹偏。想走直线，必须<strong>提前</strong>向反方向补偿。',

    dom_h2: '领域知识',
    dom_real_h3: '真实领域',
    dom_real_p: '设计者热爱飞无人机，但觉得单纯飞行、拍照很无聊。真正有意思的是 <em>导航</em>——在布满障碍的密林中穿梭，而风是隐形的敌人。',
    dom_mistakes_h3: '新手常见误区',
    dom_mistakes_li1: '以为机头朝哪就笔直往哪飞。',
    dom_mistakes_li2: '没意识到松杆后无人机会因<strong>动量</strong>继续前冲。',
    dom_mistakes_li3: '忽视<strong>风</strong>会持续改变实际航向。',
    dom_mistakes_li4: '快撞上障碍才松手——为时已晚。',
    dom_expert_h3: '专家的判断',
    dom_expert_quote: '新手按住前进就指望走直线；专家会<strong>提前</strong>改变航向、谨慎修正，用反向操作抵消风的推力，把轨迹维持成一条直线。',
    dom_why_h3: '为什么它能变成游戏',
    dom_why_p: '游戏把看不见的东西<strong>可视化</strong>：顶部 WIND 显示风速与风向，动量让你在松手后仍能感到无人机的滑行，放大的 ALTITUDE 高度表 + 距 LAND 进度给出即时反馈。玩家通过一次次失败与调整，完成从新手到专家的思维转变。',

    sys_h2: '系统设计',
    sys_intro: '游戏由三组清晰分离的数据驱动：',
    sys_env_h3: '环境数据（世界）',
    sys_env_li1: '<strong>风</strong>——风速 + 风向，持续把无人机吹偏。',
    sys_env_li2: '<strong>高树</strong>——需从 <b>上方</b> 飞越（部分树比起点 70 m 还高）。',
    sys_env_li3: '<strong>头顶电缆</strong>——需压低到标注高度 <b>以下</b> 钻过。',
    sys_env_li4: '<strong>LAND 平台</strong>——航线尽头的着陆目标。',
    sys_ctrl_h3: '玩家控制的数据',
    sys_ctrl_li1: '<b>W</b>/<b>S</b> 前进 / 后退推力。',
    sys_ctrl_li2: '<b>A</b>/<b>D</b> 左 / 右平移。',
    sys_ctrl_li3: '<b>U</b>/<b>H</b> 上升 / 下降。',
    sys_res_h3: '系统计算的结果',
    sys_res_li1: '无人机位置、速度、高度。',
    sys_res_li2: '是否撞树 / 撞缆 / 平台外触地。',
    sys_res_li3: '是否抵达平台并降到 0 m。',
    sys_res_li4: '剩余<strong>倒计时</strong>是否归零。',
    sys_fb_h3: '反馈翻译',
    sys_fb_li1: '<strong>WIND 指示</strong>——箭头显示风向、数值显示风速。',
    sys_fb_li2: '<strong>ALTITUDE 高度表</strong>——大号读数 + 竖直高度条 + 平台标记线。',
    sys_fb_li3: '<strong>⏱ 计时</strong>——剩 10 秒变红闪烁提醒。',
    sys_wl_h3: '成功 / 失败',
    sys_wl_li1: '<strong>成功：</strong>飞到 <strong>LAND</strong> 平台上方，持续按 <kbd>H</kbd> 把高度降到 <strong>0 m</strong> 平稳着陆。',
    sys_wl_li2: '<strong>失败：</strong>撞树、撞电缆、在平台外触地，或<strong>倒计时归零</strong>。',

    tiers_h2: '三档挑战（变量不同，不只是外观）',
    tier_p1_lvl: 'P1 · 入门',
    tier_p1_name: 'Calm Glade',
    tier_p1_li1: '矮树、微风',
    tier_p1_li2: '无电缆障碍',
    tier_p1_li3: '航程最短',
    tier_p1_time: '⏱ 时限 60 s',
    tier_p2_lvl: 'P2 · 进阶',
    tier_p2_name: 'Crosswind Pass',
    tier_p2_li1: '高树（部分高于起点）',
    tier_p2_li2: '中速风 · 3 条电缆',
    tier_p2_li3: '树 / 缆交替切换',
    tier_p2_time: '⏱ 时限 40 s',
    tier_p3_lvl: 'P3 · 挑战',
    tier_p3_name: 'Gust Maze',
    tier_p3_li1: '最高树 · 强风',
    tier_p3_li2: '4 条电缆 · 航程最长',
    tier_p3_li3: '爬升过树 / 俯冲过缆',
    tier_p3_time: '⏱ 时限 30 s',
    tiers_note: '难度越高，<strong>时限越短</strong>（60 / 40 / 30 秒）——不仅要飞得对，还要飞得快。',

    about_h2: '关于这个 3D 版本',
    about_li1: '使用 <strong>Three.js（r128）</strong> 渲染真 3D 场景：追尾摄像机、3D 无人机 / 树木 / 电缆 / 平台、悬空标签。',
    about_li2: 'Three.js 已<strong>下载到本地</strong>（<code>vendor/</code>），运行时零联网、完全离线。',
    about_li3: '与 2D 版相互独立：本 3D 版运行在独立端口，不影响原 2D 游戏。',
    about_li4: '关卡采用确定性「关卡门」调度器（固定间距排布树丛门 / 电缆门），从根本上保证每关都<strong>可通关</strong>。',
    about_btn: '▶ 启动无人机森林导航 · 3D',
    footer: '无人机森林导航 · 3D 学习游戏 · 基于 domain-learning-brief.md 构建'
  }
};

(function () {
  'use strict';
  var LANG_KEY = 'drone3d_i18n_lang';

  function getLang() {
    var l = null;
    try { l = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (l !== 'zh' && l !== 'en') l = 'en'; // default: English
    return l;
  }
  function setLang(l) {
    if (l !== 'zh' && l !== 'en') l = 'en';
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    applyLang();
    if (typeof window.onLangChange === 'function') window.onLangChange(l);
  }
  function t(key, params) {
    var dict = window.I18N[getLang()];
    var s = dict[key];
    if (s == null) { dict = window.I18N.en; s = dict[key]; }
    if (s == null) return key;
    if (params) {
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k)) {
          s = String(s).replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        }
      }
    }
    return s;
  }
  function applyLang() {
    var lang = getLang();
    try { document.documentElement.lang = (lang === 'zh') ? 'zh-CN' : 'en'; } catch (e) {}
    try { document.title = window.I18N[lang].page_title; } catch (e) {}

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var val = window.I18N[lang][key];
      if (val != null) el.innerHTML = val;
    }
    // attribute translations, e.g. data-i18n-attr="title:someKey"
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var ael = attrNodes[j];
      var spec = ael.getAttribute('data-i18n-attr').split(';');
      for (var m = 0; m < spec.length; m++) {
        if (!spec[m]) continue;
        var parts = spec[m].split(':');
        var attr = parts[0].trim();
        var ak = parts[1].trim();
        var av = window.I18N[lang][ak];
        if (av != null) ael.setAttribute(attr, av);
      }
    }
    // toggle active state
    var btns = document.querySelectorAll('[data-setlang]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', btns[b].getAttribute('data-setlang') === lang);
    }
  }

  window.getLang = getLang;
  window.setLang = setLang;
  window.t = t;
  window.applyLang = applyLang;

  // Switch buttons (event delegation so it works whenever DOM is ready)
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-setlang]') : null;
    if (btn) { e.preventDefault(); setLang(btn.getAttribute('data-setlang')); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLang);
  else applyLang();
})();
