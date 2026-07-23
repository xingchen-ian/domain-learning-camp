/* ============================================================
   Granny Square Rhythm — Core Game Logic  (24-square edition)
   ------------------------------------------------------------
   A rhythm game where players SELECT from 24 different granny
   square patterns, each with its own rounds, stitches, colours,
   and fabric layout shape.

   DIFFICULTY TIERS
     Easy    (3 rounds, 1–2 stitch types)
     Medium  (4 rounds, 2–3 stitch types)
     Hard    (5 rounds, 4–5 stitch types)

   FABRIC LAYOUTS
     ring     — circle
     square   — square perimeter
     hexagon  — 6-sided polygon
     star5    — 5-point star
     star6    — 6-point star
     heart    — heart curve
     spiral   — Archimedean spiral
   ============================================================ */

(function () {
  "use strict";

  // ---------- Stitch Catalog (coral + ocean palette) ----------
  const STITCHES = {
    ch: { code: "ch", name: "Chain",          key: "A", color: "#FF8E72", symbol: "\u25CB" },
    sl: { code: "sl", name: "Slip stitch",    key: "S", color: "#9CAF88", symbol: "\u00B7" },
    sc: { code: "sc", name: "Single crochet", key: "D", color: "#FF6B6B", symbol: "\u271A" },
    dc: { code: "dc", name: "Double crochet", key: "J", color: "#4ECDC4", symbol: "\u2726" },
    tr: { code: "tr", name: "Treble crochet", key: "K", color: "#6CC4E0", symbol: "\u2756" }
  };
  const LANE_ORDER = ["ch", "sl", "sc", "dc", "tr"];

  // ---------- Square Library (23 unique patterns + 1 tutorial = 24) ----------
  const SQUARE_LIBRARY = [
    // ===== TUTORIAL (1 square, 2 rounds) =====
    {
      id: 0, name: "Beginner Tutorial", icon: "\uD83D\uDCD6",
      image: null, difficulty: "Tutorial",
      desc: "Learn the basics! A gentle 2-round intro to rhythm crocheting. Perfect for first-time players.",
      rounds: [
        { name: "First Stitches", bpm: 50, speedMul: 0.8, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sl","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.50,
          intro: "Welcome! Press <b>D</b> for Single Crochet (red \u271A) and <b>S</b> for Slip Stitch (green \u00B7). Watch the yarn fall and tap the matching key when it reaches the coral dashed line. No rush \u2014 the tempo is nice and slow!" },
        { name: "Pick Up Speed", bpm: 65, speedMul: 0.9, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","sl","sc","sc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.80,
          intro: "Great job! Now add <b>A</b> for Chain (salmon \u25CB). Three stitch types now \u2014 you've got this! Hit each key as the yarn crosses the line." }
      ]
    },
    // ===== EASY (5 squares, 3 rounds each) =====
    {
      id: 1, name: "Classic Granny", icon: "\uD83E\uDDF6",
      image: "assets/images/squares/01-classic-granny.png", difficulty: "Easy",
      desc: "The timeless granny square: a coral center, a teal cluster round, sage shells, and a sky-blue border.",
      rounds: [
        { name: "Coral Center", bpm: 72, speedMul: 1.0, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.45,
          intro: "Start with a magic ring of coral single crochet. Close with a slip stitch." },
        { name: "Teal Cluster Ring", bpm: 88, speedMul: 1.2, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.70,
          intro: "Work 3-double-crochet clusters in chain spaces around the center. The teal ring defines the square." },
        { name: "Sky Border", bpm: 104, speedMul: 1.4, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.90,
          intro: "Finish with a light blue single-crochet border and chain picots." }
      ]
    },
    {
      id: 2, name: "Solid Granny", icon: "\u2B1C",
      image: "assets/images/squares/02-solid-granny.png", difficulty: "Easy",
      desc: "A dense, gap-free square in warm coral with a cool sky-blue edge.",
      rounds: [
        { name: "Solid Center", bpm: 72, speedMul: 1.0, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.45,
          intro: "Begin with a solid coral ring of single crochet. No gaps, just fabric." },
        { name: "Solid Expansion", bpm: 88, speedMul: 1.2, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#FF8E72", layout: "square", size: 0.70,
          intro: "Expand outward with more single crochet in salmon. The square stays dense." },
        { name: "Sky Edge", bpm: 104, speedMul: 1.4, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","ch","sc","sc","sc","sc","sc","ch","sc","sc","sc","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.90,
          intro: "Add a neat sky-blue edge with single crochet and corner chains." }
      ]
    },
    {
      id: 3, name: "Circle-in-Square", icon: "\u2B55",
      image: "assets/images/squares/03-circle-in-square.png", difficulty: "Easy",
      desc: "A round medallion of teal, gold and coral sits inside a square frame.",
      rounds: [
        { name: "Teal Circle", bpm: 72, speedMul: 1.0, stitches: ["dc","sl"],
          pattern: ["dc","dc","dc","dc","dc","dc","dc","dc","dc","dc","dc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.45,
          intro: "Begin with a teal circle of double crochet. The curve is the heart of this square." },
        { name: "Gold Ring", bpm: 88, speedMul: 1.2, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#E8C468", layout: "ring", size: 0.65,
          intro: "A bright gold ring frames the teal center before the square shaping begins." },
        { name: "Square Frame", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.90,
          intro: "Pull the circle into a square with a teal double-crochet frame and corner chains." }
      ]
    },
    {
      id: 4, name: "V-Stitch Granny", icon: "\u25B3",
      image: "assets/images/squares/04-v-stitch.png", difficulty: "Easy",
      desc: "Diagonal V-stitches in coral, sage and teal create a crisp, striped granny square.",
      rounds: [
        { name: "Coral Base", bpm: 72, speedMul: 1.0, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.45,
          intro: "Build a small coral base ring. The V-stitch stripes will radiate from here." },
        { name: "Diagonal V Stripes", bpm: 88, speedMul: 1.2, stitches: ["ch","dc","sl"],
          pattern: ["dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.70,
          intro: "Work V-stitches in sage, creating diagonal stripes across the square." },
        { name: "Sky Edge", bpm: 104, speedMul: 1.4, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.90,
          intro: "A light blue single-crochet border frames the striped V-stitch square." }
      ]
    },
    {
      id: 5, name: "Mini Bloom", icon: "\uD83C\uDF38",
      image: "assets/images/squares/05-mini-bloom.png", difficulty: "Easy",
      desc: "A five-petal coral flower with a gold heart sits on a sage background inside a sky-blue border.",
      rounds: [
        { name: "Gold Center", bpm: 72, speedMul: 1.0, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#E8C468", layout: "ring", size: 0.40,
          intro: "Start with a small gold ring. This is the center of the flower." },
        { name: "Coral Petals", bpm: 84, speedMul: 1.15, stitches: ["ch","tr","sc","sl"],
          pattern: ["ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","sl"],
          color: "#FF6B6B", layout: "star5", size: 0.60,
          intro: "Five coral treble-crochet petals bloom around the gold center." },
        { name: "Square Frame", bpm: 100, speedMul: 1.35, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.90,
          intro: "Wrap the flower in a sky-blue square frame. The mini bloom is complete!" }
      ]
    },

    // ===== MEDIUM (9 squares, 4 rounds each) =====
    {
      id: 6, name: "Sunburst", icon: "\u2600\uFE0F",
      image: "assets/images/squares/06-sunburst.png", difficulty: "Medium",
      desc: "Radiating coral and gold sun rays burst from the center, then settle into a square.",
      rounds: [
        { name: "Gold Seed", bpm: 80, speedMul: 1.1, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#E8C468", layout: "ring", size: 0.38,
          intro: "Begin with a tiny gold seed ring. Sun rays will radiate outward." },
        { name: "Coral Sun Rays", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","dc","tr","ch","dc","ch","dc","tr","ch","dc","ch","dc","tr","ch","dc","ch","dc","tr","ch","dc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.58,
          intro: "Treble-crochet rays alternate with chains. The sun bursts outward!" },
        { name: "Sage Transition", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","sl"],
          color: "#9CAF88", layout: "square", size: 0.78,
          intro: "Pull the sunburst into a square with sage corner clusters." },
        { name: "Sky Final Ring", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.95,
          intro: "A sky-blue single-crochet ring with picots finishes the sunburst." }
      ]
    },
    {
      id: 7, name: "Star Motif", icon: "\u2B50",
      image: "assets/images/squares/07-star-motif.png", difficulty: "Medium",
      desc: "A golden five-point star floats on a coral field inside a sky-blue square.",
      rounds: [
        { name: "Star Center", bpm: 80, speedMul: 1.1, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#E8C468", layout: "ring", size: 0.35,
          intro: "Begin with a gold ring. Five star points will extend from here." },
        { name: "Gold Star Points", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","tr","dc","tr","ch","sc","ch","tr","dc","tr","ch","sc","ch","tr","dc","tr","ch","sc","ch","tr","dc","tr","ch","sc","sl"],
          color: "#E8C468", layout: "star5", size: 0.65,
          intro: "Five gold treble-crochet points extend outward. The star takes shape!" },
        { name: "Coral Square Transition", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#FF6B6B", layout: "square", size: 0.80,
          intro: "Fill between the star points with coral double crochet to form a square." },
        { name: "Sky Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.95,
          intro: "A sky-blue picot border frames the star motif." }
      ]
    },
    {
      id: 8, name: "Diagonal Split", icon: "\u25E2",
      image: "assets/images/squares/08-diagonal-split.png", difficulty: "Medium",
      desc: "A diagonal colour split: coral and teal halves meet along a shimmering gold line.",
      rounds: [
        { name: "Coral Corner", bpm: 80, speedMul: 1.1, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","ch","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "square", size: 0.40,
          intro: "Start in one corner with coral single crochet. The diagonal split begins here." },
        { name: "Teal Corner", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","ch","sc","sc","dc","dc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.60,
          intro: "The opposite corner fills with teal. Carry the yarn for the two-tone effect." },
        { name: "Gold Diagonal", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","sc","sc","dc","dc","ch","dc","dc","ch","sl"],
          color: "#E8C468", layout: "square", size: 0.80,
          intro: "A gold diagonal line separates the coral and teal halves." },
        { name: "Sky Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.95,
          intro: "A light blue border finishes the diagonal split square." }
      ]
    },
    {
      id: 9, name: "Mitred Granny", icon: "\uD83D\uDCD0",
      image: "assets/images/squares/09-mitred.png", difficulty: "Medium",
      desc: "Worked in diamond orientation with concentric rings of coral, sage and teal.",
      rounds: [
        { name: "Coral Diamond Center", bpm: 80, speedMul: 1.1, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "square", size: 0.35,
          intro: "Start at the center diamond with coral. The mitered square grows outward." },
        { name: "Sage Miter", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.55,
          intro: "A sage mitered round adds the second diamond layer." },
        { name: "Teal Miter", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.75,
          intro: "Teal brings the third diamond layer while keeping the mitered shape." },
        { name: "Sky Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.95,
          intro: "A clean sky-blue border completes the mitred granny." }
      ]
    },
    {
      id: 10, name: "Ocean Wave", icon: "\uD83C\uDF0A",
      image: "assets/images/squares/10-ocean-wave.png", difficulty: "Medium",
      desc: "Rippling waves in teal, sky and sage wash across the square, finished with a coral shore.",
      rounds: [
        { name: "Wave Center", bpm: 80, speedMul: 1.1, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#6CC4E0", layout: "ring", size: 0.38,
          intro: "Begin with a calm sky-blue ring. Waves will ripple outward." },
        { name: "Teal Ripple", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","sl"],
          pattern: ["dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.55,
          intro: "Double crochet with chains creates a rippling teal wave pattern." },
        { name: "Sage Wave Settles", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.78,
          intro: "The waves settle into a square shape with sage corner clusters." },
        { name: "Coral Shore Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sl"],
          color: "#FF6B6B", layout: "square", size: 0.95,
          intro: "A coral shore border with alternating chains and single crochet." }
      ]
    },
    {
      id: 11, name: "Hexagon Bloom", icon: "\u2B21",
      image: "assets/images/squares/11-hexagon-bloom.png", difficulty: "Medium",
      desc: "A layered flower rises from a hexagonal lace base, framed by a teal border.",
      rounds: [
        { name: "Flower Center", bpm: 80, speedMul: 1.1, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#E8C468", layout: "ring", size: 0.38,
          intro: "Start with a small gold flower center." },
        { name: "Coral Petals", bpm: 96, speedMul: 1.3, stitches: ["ch","tr","sc","sl"],
          pattern: ["ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.58,
          intro: "Coral treble petals bloom around the gold center." },
        { name: "Hexagon Lace", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "hexagon", size: 0.78,
          intro: "A sage hexagonal lace layer spreads beneath the petals." },
        { name: "Teal Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.95,
          intro: "A teal border finishes the hexagon bloom square." }
      ]
    },
    {
      id: 12, name: "Puff Stitch", icon: "\u2601\uFE0F",
      image: "assets/images/squares/12-puff-stitch.png", difficulty: "Medium",
      desc: "Puffy clusters in coral, teal and sky create a soft, textured surface with a sage edge.",
      rounds: [
        { name: "Coral Puff Center", bpm: 80, speedMul: 1.1, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.40,
          intro: "Begin with coral puff-like clusters around a ring. The texture starts here." },
        { name: "Teal Puff Round", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","sl"],
          color: "#4ECDC4", layout: "square", size: 0.62,
          intro: "Three double crochet together create teal puffy bumps along the sides." },
        { name: "Sky Expansion", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.80,
          intro: "Sky-blue puff clusters expand the square outward." },
        { name: "Sage Textured Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.95,
          intro: "A sage textured border with picot chains completes the puff square." }
      ]
    },
    {
      id: 13, name: "Corner-to-Corner", icon: "\uD83D\uDD17",
      image: "assets/images/squares/13-corner-to-corner.png", difficulty: "Medium",
      desc: "C2C diagonal stripes in cream, gold, sage, coral and sky create a pixelated blanket look.",
      rounds: [
        { name: "Cream C2C Start", bpm: 80, speedMul: 1.1, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","ch","sl"],
          color: "#F5E6D3", layout: "square", size: 0.30,
          intro: "Start in one corner with cream. Each tile is a chain-2 plus 3 double crochet." },
        { name: "Gold-Sage Stripe", bpm: 96, speedMul: 1.3, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","dc","ch","dc","dc","dc","sl"],
          color: "#E8C468", layout: "square", size: 0.50,
          intro: "The diagonal grows with a gold stripe, then sage. Each step adds a new tile block." },
        { name: "Coral-Sky Stripe", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","sl"],
          color: "#FF6B6B", layout: "square", size: 0.75,
          intro: "Coral and sky stripes complete the C2C diagonal pattern." },
        { name: "Sky C2C Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.95,
          intro: "A sky-blue border frames the pixelated C2C square." }
      ]
    },
    {
      id: 14, name: "Summer Garden", icon: "\uD83C\uDF3A",
      image: "assets/images/squares/14-summer-garden.png", difficulty: "Medium",
      desc: "A teal field scattered with coral and gold flowers, joined by sage leaves and a teal border.",
      rounds: [
        { name: "Teal Field", bpm: 80, speedMul: 1.1, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.38,
          intro: "Begin with a teal field. Flowers will bloom across this base." },
        { name: "Coral Flowers", bpm: 96, speedMul: 1.3, stitches: ["ch","tr","sc","sl"],
          pattern: ["ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","sl"],
          color: "#FF6B6B", layout: "square", size: 0.58,
          intro: "Coral treble-petal flowers bloom across the teal field." },
        { name: "Sage Leaves", bpm: 112, speedMul: 1.5, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.80,
          intro: "Sage green leaves fill the spaces between the scattered flowers." },
        { name: "Teal Border", bpm: 128, speedMul: 1.7, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.95,
          intro: "A teal picot border frames the summer garden." }
      ]
    },

    // ===== HARD (10 squares, 5 rounds each) =====
    {
      id: 15, name: "Cathedral Window", icon: "\u26EA",
      image: "assets/images/squares/15-cathedral-window.png", difficulty: "Hard",
      desc: "Inspired by stained glass: a sage frame holds coral, gold and sky window panes.",
      rounds: [
        { name: "Central Medallion", bpm: 88, speedMul: 1.2, stitches: ["ch","sc","sl"],
          pattern: ["ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.35,
          intro: "Start with a coral center medallion. The windows will radiate from here." },
        { name: "Window Arches", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","sl"],
          color: "#6CC4E0", layout: "ring", size: 0.52,
          intro: "Sky-blue arches form the stained-glass window frames." },
        { name: "Gold Window Fill", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","tr","sl"],
          pattern: ["dc","dc","tr","ch","dc","dc","tr","ch","dc","dc","tr","ch","dc","dc","tr","ch","sl"],
          color: "#E8C468", layout: "square", size: 0.70,
          intro: "Gold treble crochet fills the window panes. The stained glass glows." },
        { name: "Sage Window Frame", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","dc","dc","tr","ch","dc","dc","tr","ch","dc","dc","tr","ch","dc","dc","tr","sl"],
          color: "#9CAF88", layout: "square", size: 0.85,
          intro: "A sage frame separates and defines each stained-glass window." },
        { name: "Sage Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.98,
          intro: "A final sage picot border completes the Cathedral Window square." }
      ]
    },
    {
      id: 16, name: "Heart Square", icon: "\u2764\uFE0F",
      image: "assets/images/squares/16-heart-square.png", difficulty: "Hard",
      desc: "A coral heart rests on a teal field inside a sage-edged square.",
      rounds: [
        { name: "Coral Heart", bpm: 88, speedMul: 1.2, stitches: ["ch","sc","dc","tr","sl"],
          pattern: ["sc","dc","tr","dc","sc","sc","dc","tr","dc","sc","sl"],
          color: "#FF6B6B", layout: "heart", size: 0.50,
          intro: "Crochet the coral heart: treble at the top, single crochet at the point." },
        { name: "Teal Field", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","dc","dc","dc","dc","dc","dc","dc","dc","dc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.62,
          intro: "Round the heart with teal double crochet to smooth the edges." },
        { name: "Sage Squaring", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.75,
          intro: "Begin squaring off the heart with sage corner clusters." },
        { name: "Sky Blue Round", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.88,
          intro: "A sky-blue round fills the square around the heart." },
        { name: "Sage Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.98,
          intro: "A sage picot border finishes the heart square with love." }
      ]
    },
    {
      id: 17, name: "Lacy Victorian", icon: "\uD83D\uDD4A\uFE0F",
      image: "assets/images/squares/17-lacy-victorian.png", difficulty: "Hard",
      desc: "Delicate cream openwork with sage and sky accents — light, airy, and vintage.",
      rounds: [
        { name: "Cream Lace Ring", bpm: 88, speedMul: 1.2, stitches: ["ch","sc","sl"],
          pattern: ["ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","sl"],
          color: "#F5E6D3", layout: "ring", size: 0.35,
          intro: "Begin with a cream lace ring: chain-2 spaces with single crochet anchors." },
        { name: "Sage Lattice", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","sl"],
          color: "#9CAF88", layout: "square", size: 0.55,
          intro: "A sage lattice of chains and double crochet creates the openwork pattern." },
        { name: "Sky Lace Detail", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.72,
          intro: "Sky-blue clusters add cool accents to the cream lace." },
        { name: "Cream Lace Expansion", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","sl"],
          color: "#F5E6D3", layout: "square", size: 0.86,
          intro: "Cream treble crochet adds height and delicacy to the lace detail." },
        { name: "Cream Victorian Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sl"],
          color: "#F5E6D3", layout: "square", size: 0.98,
          intro: "A cream lace border with chain-2 picots completes the Victorian square." }
      ]
    },
    {
      id: 18, name: "Bobble Popcorn", icon: "\uD83C\uDF7F",
      image: "assets/images/squares/18-bobble-popcorn.png", difficulty: "Hard",
      desc: "Three-dimensional bobbles and popcorn stitches in coral, teal and sky with a sage border.",
      rounds: [
        { name: "Coral Bobble Center", bpm: 88, speedMul: 1.2, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.35,
          intro: "Start with coral bobble-like clusters around a ring." },
        { name: "Teal Popcorn", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","dc","dc","ch","sc","dc","dc","dc","dc","ch","sc","dc","dc","dc","dc","ch","sc","dc","dc","dc","dc","ch","sc","sl"],
          color: "#4ECDC4", layout: "ring", size: 0.52,
          intro: "Teal popcorn stitches: four dc in the same stitch, then a chain space." },
        { name: "Coral-Teal Mix", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#FF8E72", layout: "square", size: 0.70,
          intro: "Coral and teal bobble clusters alternate and expand outward." },
        { name: "Sky Popcorn Square", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","dc","ch","dc","dc","dc","dc","ch","dc","dc","dc","dc","ch","dc","dc","dc","dc","ch","sl"],
          color: "#6CC4E0", layout: "square", size: 0.85,
          intro: "Sky-blue popcorn clusters fill the sides. The square is nearly complete." },
        { name: "Sage Bobble Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.98,
          intro: "A sage picot border finishes the bobble popcorn square." }
      ]
    },
    {
      id: 19, name: "Poinsettia", icon: "\uD83C\uDF3F",
      image: "assets/images/squares/19-poinsettia.png", difficulty: "Hard",
      desc: "A Christmas poinsettia in coral-red with white accents, set in a sage window frame.",
      rounds: [
        { name: "Gold Flower Center", bpm: 88, speedMul: 1.2, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#E8C468", layout: "ring", size: 0.32,
          intro: "Begin with a gold seed ring. The poinsettia will bloom from here." },
        { name: "Coral-Red Petals", bpm: 104, speedMul: 1.4, stitches: ["ch","tr","sc","sl"],
          pattern: ["ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","sl"],
          color: "#FF6B6B", layout: "star6", size: 0.58,
          intro: "Six coral-red treble petals radiate outward like a poinsettia in bloom." },
        { name: "White Petal Accents", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sc","sl"],
          pattern: ["ch","dc","ch","sc","ch","dc","ch","sc","ch","dc","ch","sc","ch","dc","ch","sc","ch","dc","ch","sc","ch","dc","ch","sc","sl"],
          color: "#F5E6D3", layout: "ring", size: 0.72,
          intro: "White chain-and-dc accents frame the petals, adding the poinsettia's detail." },
        { name: "Sage Frame", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.88,
          intro: "Sage corner clusters pull the flower into a square window frame." },
        { name: "Sage Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.98,
          intro: "A sage picot border adds festive warmth to the poinsettia square." }
      ]
    },
    {
      id: 21, name: "Spiral Granny", icon: "\uD83C\uDF00",
      image: "assets/images/squares/21-spiral.png", difficulty: "Hard",
      desc: "A continuous spiral of coral, teal, sage and gold flows without seams into a square.",
      rounds: [
        { name: "Coral Spiral Start", bpm: 88, speedMul: 1.2, stitches: ["ch","sc","dc","tr","sl"],
          pattern: ["sc","dc","tr","dc","sc","sc","dc","tr","dc","sc","sl"],
          color: "#FF6B6B", layout: "spiral", size: 0.40,
          intro: "Start a spiral that never closes. Coral stitches flow continuously outward." },
        { name: "Teal Spiral Continue", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","tr","sl"],
          pattern: ["dc","dc","tr","dc","ch","dc","dc","tr","dc","ch","dc","dc","tr","dc","ch","sl"],
          color: "#4ECDC4", layout: "spiral", size: 0.55,
          intro: "The spiral grows. Teal flows from coral without a seam." },
        { name: "Sage Spiral Square", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.75,
          intro: "The spiral settles into a square. Sage rounds complete the shape." },
        { name: "Gold Spiral Expand", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","tr","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","tr","ch","dc","dc","dc","ch","dc","dc","tr","ch","sl"],
          color: "#E8C468", layout: "square", size: 0.88,
          intro: "Gold treble corners add height and dimension to the expanding spiral." },
        { name: "Sage Spiral Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.98,
          intro: "A sage border finally closes the spiral. The journey is complete!" }
      ]
    },
    {
      id: 22, name: "Flowers in Snow", icon: "\u2744\uFE0F",
      image: "assets/images/squares/22-flowers-in-snow.png", difficulty: "Hard",
      desc: "Pink flowers with gold hearts bloom across a white snowy field, framed by teal.",
      rounds: [
        { name: "Snow Field", bpm: 88, speedMul: 1.2, stitches: ["ch","sc","sl"],
          pattern: ["sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","ch","ch","sc","sl"],
          color: "#F5E6D3", layout: "ring", size: 0.32,
          intro: "A cream snow field spreads from the center. Chains create the first airy 'snow'." },
        { name: "Pink Flowers", bpm: 104, speedMul: 1.4, stitches: ["ch","tr","sc","sl"],
          pattern: ["ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","ch","tr","ch","sc","sl"],
          color: "#FF6B6B", layout: "square", size: 0.50,
          intro: "Pink treble-petal flowers scatter across the snowy field." },
        { name: "Gold Flower Centers", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sl"],
          pattern: ["ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","ch","dc","sl"],
          color: "#E8C468", layout: "square", size: 0.68,
          intro: "Gold double-crochet centers dot each pink flower." },
        { name: "Cream Snow Lattice", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","sl"],
          color: "#F5E6D3", layout: "square", size: 0.84,
          intro: "Cream lattice stitches fill the negative space like fresh snow." },
        { name: "Teal Snow Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.98,
          intro: "A teal lace border with chain picots finishes the snow square." }
      ]
    },
    {
      id: 23, name: "African Flower", icon: "\uD83C\uDF3B",
      image: "assets/images/squares/23-african-flower.png", difficulty: "Hard",
      desc: "A hexagonal flower with a gold center, pink petals, sage leaves and a teal border.",
      rounds: [
        { name: "Gold Center", bpm: 88, speedMul: 1.2, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#E8C468", layout: "hexagon", size: 0.35,
          intro: "Start with a gold hexagonal center. Petals will bloom from each side." },
        { name: "Pink Petals", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","tr","sl"],
          pattern: ["ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","ch","tr","ch","dc","sl"],
          color: "#FF6B6B", layout: "hexagon", size: 0.55,
          intro: "Pink treble petals bloom on each side of the hexagon." },
        { name: "Sage Leaves", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","sl"],
          color: "#9CAF88", layout: "hexagon", size: 0.72,
          intro: "Sage clusters with single-crochet anchors add leaf detail between petals." },
        { name: "Teal Square Shape", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","dc","dc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.88,
          intro: "Teal corner clusters pull the hexagon into a square." },
        { name: "Teal Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sc","sc","ch","sl"],
          color: "#4ECDC4", layout: "square", size: 0.98,
          intro: "A teal border with picots finishes the African Flower square." }
      ]
    },
    {
      id: 24, name: "Sophie's Garden", icon: "\uD83C\uDF37",
      image: "assets/images/squares/24-sophies-garden.png", difficulty: "Hard",
      desc: "A richly layered mandala: coral center, gold detail, teal ring, sage and sky accents, coral border.",
      rounds: [
        { name: "Coral Garden Center", bpm: 88, speedMul: 1.2, stitches: ["sc","sl"],
          pattern: ["sc","sc","sc","sc","sc","sc","sc","sc","sc","sc","sl"],
          color: "#FF6B6B", layout: "ring", size: 0.33,
          intro: "Build a coral base ring. Surface detail will be added on top." },
        { name: "Gold Surface Detail", bpm: 104, speedMul: 1.4, stitches: ["ch","dc","tr","sl"],
          pattern: ["dc","tr","dc","ch","dc","tr","dc","ch","dc","tr","dc","ch","dc","tr","dc","ch","sl"],
          color: "#E8C468", layout: "ring", size: 0.50,
          intro: "Gold treble and double crochet create surface texture on the base." },
        { name: "Teal Garden Ring", bpm: 120, speedMul: 1.6, stitches: ["ch","dc","sc","sl"],
          pattern: ["dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","dc","dc","dc","ch","sc","sl"],
          color: "#4ECDC4", layout: "square", size: 0.68,
          intro: "A teal ring of textured clusters separates the center from the outer garden." },
        { name: "Sage & Sky Garden", bpm: 136, speedMul: 1.8, stitches: ["ch","dc","sl"],
          pattern: ["dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","dc","dc","dc","ch","sl"],
          color: "#9CAF88", layout: "square", size: 0.85,
          intro: "Sage corner clusters with sky accents complete the layered mandala." },
        { name: "Coral Border", bpm: 152, speedMul: 2.0, stitches: ["ch","sc","sl"],
          pattern: ["sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sc","sc","sc","ch","sl"],
          color: "#FF6B6B", layout: "square", size: 0.98,
          intro: "A coral border with picots finishes Sophie's Garden. A masterpiece!" }
      ]
    }
  ];

  // ---------- Generic Layout Functions ----------
  // Circle layout
  function layoutRing(i, n, cx, cy, r) {
    if (n <= 0) return { x: cx, y: cy };
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  // Square perimeter layout
  function layoutSquare(i, n, cx, cy, s) {
    if (n <= 0) return { x: cx, y: cy };
    const u = i / n;
    const sideLen = 2 * s;
    const pos = u * (4 * sideLen);
    if (pos < sideLen) {
      const t = pos / sideLen;
      return { x: cx - s + t * 2 * s, y: cy - s };
    } else if (pos < 2 * sideLen) {
      const t = (pos - sideLen) / sideLen;
      return { x: cx + s, y: cy - s + t * 2 * s };
    } else if (pos < 3 * sideLen) {
      const t = (pos - 2 * sideLen) / sideLen;
      return { x: cx + s - t * 2 * s, y: cy + s };
    } else {
      const t = (pos - 3 * sideLen) / sideLen;
      return { x: cx - s, y: cy + s - t * 2 * s };
    }
  }

  // Regular polygon layout (for hexagon, etc.)
  function layoutPolygon(i, n, cx, cy, r, sides) {
    if (n <= 0) return { x: cx, y: cy };
    var vertices = [];
    for (var v = 0; v < sides; v++) {
      var a = (v / sides) * 2 * Math.PI - Math.PI / 2;
      vertices.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    var edgeLens = [];
    var totalLen = 0;
    for (var v = 0; v < sides; v++) {
      var next = (v + 1) % sides;
      var dx = vertices[next].x - vertices[v].x;
      var dy = vertices[next].y - vertices[v].y;
      var len = Math.sqrt(dx * dx + dy * dy);
      edgeLens.push(len);
      totalLen += len;
    }
    var target = (i / n) * totalLen;
    for (var v = 0; v < sides; v++) {
      if (target <= edgeLens[v]) {
        var t = target / edgeLens[v];
        var next = (v + 1) % sides;
        return {
          x: vertices[v].x + (vertices[next].x - vertices[v].x) * t,
          y: vertices[v].y + (vertices[next].y - vertices[v].y) * t
        };
      }
      target -= edgeLens[v];
    }
    return vertices[0];
  }

  // Star layout (5 or 6 points)
  function layoutStar(i, n, cx, cy, r, points) {
    if (n <= 0) return { x: cx, y: cy };
    var totalVerts = points * 2;
    var verts = [];
    for (var v = 0; v < totalVerts; v++) {
      var a = (v / totalVerts) * 2 * Math.PI - Math.PI / 2;
      var radius = (v % 2 === 0) ? r : r * 0.4;
      verts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    var edgeLens = [];
    var totalLen = 0;
    for (var v = 0; v < totalVerts; v++) {
      var next = (v + 1) % totalVerts;
      var dx = verts[next].x - verts[v].x;
      var dy = verts[next].y - verts[v].y;
      var len = Math.sqrt(dx * dx + dy * dy);
      edgeLens.push(len);
      totalLen += len;
    }
    var target = (i / n) * totalLen;
    for (var v = 0; v < totalVerts; v++) {
      if (target <= edgeLens[v]) {
        var t = target / edgeLens[v];
        var next = (v + 1) % totalVerts;
        return {
          x: verts[v].x + (verts[next].x - verts[v].x) * t,
          y: verts[v].y + (verts[next].y - verts[v].y) * t
        };
      }
      target -= edgeLens[v];
    }
    return verts[0];
  }

  // Heart layout (parametric heart curve)
  function layoutHeart(i, n, cx, cy, s) {
    if (n <= 0) return { x: cx, y: cy };
    var t = (i / n) * 2 * Math.PI - Math.PI / 2;
    var x = 16 * Math.pow(Math.sin(t), 3);
    var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x: cx + (x / 17) * s, y: cy + (y / 17) * s - s * 0.15 };
  }

  // Spiral layout (Archimedean spiral)
  function layoutSpiral(i, n, cx, cy, r) {
    if (n <= 0) return { x: cx, y: cy };
    var turns = 1.5;
    var t = (i / n) * turns * 2 * Math.PI;
    var radius = (r * (i + 1)) / n;
    return { x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) };
  }

  // ---------- DOM ----------
  var $ = function(sel) { return document.querySelector(sel); };
  var canvas = $("#rhythm-canvas");
  var ctx = canvas.getContext("2d");
  var fabricCanvas = $("#fabric-canvas");
  var fabricCtx = fabricCanvas.getContext("2d");
  var banner = $("#banner");
  var bannerInner = banner.querySelector(".banner-inner");
  var laneHints = document.querySelectorAll(".lane-hint .key");
  var galleryEl = $("#gallery");
  var gameShellEl = $("#game-shell-content");

  // ---------- Geometry cache (avoid forced reflow every frame) ----------
  var canvasW = 0, canvasH = 0, hitLineY_cached = 0, laneCenters = [];
  var fabricW = 0, fabricH = 0;

  // ---------- Game State ----------
  var state = {
    squareIndex: -1,
    currentSquare: null,
    currentLevels: [],
    level: 0,
    running: false,
    finished: false,
    bpm: 72,
    speedMul: 1.0,
    travelTime: 1.6,
    notes: [],
    active: {},
    nextIndex: 0,
    startTime: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    wrong: 0,
    totalScore: 0,
    allFabricStitches: [],
    roundOffset: 0
  };

  // ---------- Gallery ----------
  function buildGallery() {
    var grid = $("#gallery-grid");
    if (!grid) return;
    grid.innerHTML = "";

    for (var i = 0; i < SQUARE_LIBRARY.length; i++) {
      var sq = SQUARE_LIBRARY[i];
      var card = document.createElement("div");
      card.className = "sq-card diff-" + sq.difficulty.toLowerCase();
      var imgTag = sq.image
        ? '<div class="sq-img-wrap"><img class="sq-img" src="' + sq.image + '" alt="' + sq.name + '" loading="lazy"><span class="img-credit">AI-generated</span></div>'
        : '<div class="sq-icon">' + sq.icon + '</div>';
      var startHint = sq.difficulty === "Tutorial" ? '<span class="start-here">Start Here!</span>' : '';
      card.innerHTML =
        startHint +
        imgTag +
        '<div class="sq-name">' + sq.name + '</div>' +
        '<div class="sq-badges">' +
          '<span class="badge diff-' + sq.difficulty.toLowerCase() + '">' + sq.difficulty + '</span>' +
          '<span class="badge rounds">' + sq.rounds.length + ' rounds</span>' +
        '</div>' +
        '<div class="sq-desc">' + sq.desc + '</div>' +
        '<div class="sq-colors">' +
          sq.rounds.map(function(r) { return '<span class="color-dot" style="background:' + r.color + '"></span>'; }).join('') +
        '</div>';

      (function(idx) {
        card.addEventListener("click", function() { selectSquare(idx); });
      })(i);

      grid.appendChild(card);
    }
  }

  function selectSquare(idx) {
    state.squareIndex = idx;
    state.currentSquare = SQUARE_LIBRARY[idx];
    state.currentLevels = state.currentSquare.rounds;
    state.level = 0;
    state.totalScore = 0;
    state.allFabricStitches = [];

    // Hide gallery, show game
    if (galleryEl) galleryEl.style.display = "none";
    if (gameShellEl) gameShellEl.style.display = "";

    fitCanvas();
    refreshStitchPanel();
    updateHud();
    renderFabric();
    showIntro();
  }

  function showGallery() {
    if (galleryEl) galleryEl.style.display = "";
    if (gameShellEl) gameShellEl.style.display = "none";
    state.squareIndex = -1;
    state.currentSquare = null;
    state.currentLevels = [];
    state.level = 0;
    state.running = false;
    state.finished = false;
  }

  // ---------- Resize ----------
  function fitCanvas() {
    if (!canvas || !canvas.parentElement) return;
    var wrap = canvas.parentElement;
    var rect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    canvasW = canvas.clientWidth;
    canvasH = canvas.clientHeight;
    hitLineY_cached = canvasH - 90;
    laneCenters = [];
    var laneW = canvasW / LANE_ORDER.length;
    for (var i = 0; i < LANE_ORDER.length; i++) laneCenters.push(laneW * i + laneW / 2);

    if (fabricCanvas && fabricCanvas.parentElement) {
      var fWrap = fabricCanvas.parentElement.getBoundingClientRect();
      fabricCanvas.width = Math.floor(fWrap.width * dpr);
      fabricCanvas.height = Math.floor(fWrap.height * dpr);
      fabricCanvas.style.width = fWrap.width + "px";
      fabricCanvas.style.height = fWrap.height + "px";
      fabricCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fabricW = fabricCanvas.clientWidth;
      fabricH = fabricCanvas.clientHeight;
    }
  }

  // ---------- Geometry helpers ----------
  function laneX(i) { return laneCenters[i] || 0; }
  function hitLineY() { return hitLineY_cached; }
  function spawnY() { return -40; }

  // ---------- Fabric positioning ----------
  function fabricPosFor(roundDef, index, total) {
    var w = fabricW;
    var h = fabricH;
    var minD = Math.min(w, h);
    var cx = w * 0.5;
    var cy = h * 0.5;
    var baseR = minD * 0.22;
    var r = baseR * roundDef.size;

    switch (roundDef.layout) {
      case "ring":    return layoutRing(index, total, cx, cy, r);
      case "square":  return layoutSquare(index, total, cx, cy, r);
      case "hexagon": return layoutPolygon(index, total, cx, cy, r, 6);
      case "star5":   return layoutStar(index, total, cx, cy, r, 5);
      case "star6":   return layoutStar(index, total, cx, cy, r, 6);
      case "heart":   return layoutHeart(index, total, cx, cy, r);
      case "spiral":  return layoutSpiral(index, total, cx, cy, r);
      default:        return layoutRing(index, total, cx, cy, r);
    }
  }

  // ---------- Note scheduling ----------
  function spawnNote(stitch, beatTime) {
    var laneIndex = LANE_ORDER.indexOf(stitch);
    state.notes.push({
      lane: laneIndex,
      stitch: stitch,
      color: STITCHES[stitch].color,
      symbol: STITCHES[stitch].symbol,
      hitTime: beatTime,
      fabricIndex: state.notes.length
    });
  }

  function schedulePattern() {
    state.notes = [];
    state.nextIndex = 0;
    var beatInterval = 60 / state.bpm;
    var pattern = state.currentLevels[state.level].pattern;
    for (var i = 0; i < pattern.length; i++) {
      var t = state.startTime + 1.2 + i * beatInterval;
      spawnNote(pattern[i], t);
    }
  }

  // ---------- Input ----------
  var keyToStitch = { a: "ch", s: "sl", d: "sc", j: "dc", k: "tr" };

  function onKeyDown(e) {
    initAudio();
    var k = e.key.toLowerCase();
    if (k === " " || e.code === "Space") {
      e.preventDefault();
      if (state.finished) { advance(); }
      else if (!state.running && state.currentLevels.length > 0) { startLevel(); }
      return;
    }
    if (!state.running || state.finished) return;
    if (keyToStitch[k]) {
      state.active[k] = true;
      var lane = LANE_ORDER.indexOf(keyToStitch[k]);
      if (laneHints[lane]) laneHints[lane].classList.add("active");
      tryHit(keyToStitch[k]);
    }
  }
  function onKeyUp(e) {
    var k = e.key.toLowerCase();
    if (keyToStitch[k]) {
      state.active[k] = false;
      var lane = LANE_ORDER.indexOf(keyToStitch[k]);
      if (laneHints[lane]) laneHints[lane].classList.remove("active");
    }
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---------- Sound effects (Web Audio API) ----------
  var audioCtx = null;
  var muted = false;

  function initAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSfx(rank) {
    if (muted || !audioCtx) return;
    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (rank === "perfect") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.07);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (rank === "good") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (rank === "ok") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (rank === "miss") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (rank === "wrong") {
      osc.type = "square";
      osc.frequency.setValueAtTime(200, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  function tryHit(stitch) {
    var now = performance.now() / 1000;
    var hitY = hitLineY();
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < state.notes.length; i++) {
      var n = state.notes[i];
      if (n.hit) continue;
      if (n.stitch !== stitch) continue;
      var y = noteY(n, now);
      var dist = Math.abs(y - hitY);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }

    if (!best) {
      state.wrong++;
      state.combo = 0;
      flashWrongKey(stitch);
      playSfx("wrong");
      updateHud();
      return;
    }

    if (bestDist > 70) return;

    best.hit = true;
    var rank;
    if (bestDist < 18) { rank = "perfect"; state.perfect++; state.score += 100; state.combo += 1; }
    else if (bestDist < 40) { rank = "good"; state.good++; state.score += 60; state.combo += 1; }
    else { rank = "ok"; state.score += 30; state.combo += 1; }
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    playSfx(rank);

    floatJudgement(best.stitch, rank, laneX(best.lane));
    addStitchToFabric(best.stitch, rank, best);
    updateHud();
  }

  function noteY(note, now) {
    var remaining = note.hitTime - now;
    var t = 1 - Math.max(0, Math.min(1, remaining / state.travelTime));
    return spawnY() + (hitLineY_cached - spawnY()) * t;
  }

  // ---------- Feedback effects ----------
  var floats = [];
  function floatJudgement(stitch, rank, x) {
    var label = rank === "perfect" ? "Perfect" : rank === "good" ? "Good" : rank === "miss" ? "Miss" : "OK";
    var color = rank === "perfect" ? "#6fa86f" : rank === "good" ? "#e0a85a" : rank === "miss" ? "#c25450" : "#8b6e4e";
    floats.push({ x: x, y: hitLineY() - 30, text: label, color: color, t0: performance.now() / 1000 });
  }

  var flashes = [];
  function flashWrongKey(stitch) {
    var lane = LANE_ORDER.indexOf(stitch);
    if (lane < 0) return;
    flashes.push({ lane: lane, t0: performance.now() / 1000 });
  }

  // ---------- Fabric renderer ----------
  var fabricPending = false;
  function scheduleFabricRender() {
    if (fabricPending) return;
    fabricPending = true;
    requestAnimationFrame(function() {
      fabricPending = false;
      renderFabric();
    });
  }
  function addStitchToFabric(stitch, rank, note) {
    var lv = state.currentLevels[state.level];
    var idx = note ? note.fabricIndex : state.allFabricStitches.length - state.roundOffset;
    var pos = fabricPosFor(lv, idx, lv.pattern.length);
    state.allFabricStitches.push({
      stitch: stitch, rank: rank, round: state.level + 1,
      levelId: lv.name, x: pos.x, y: pos.y, color: lv.color
    });
    scheduleFabricRender();
  }

  function renderFabric() {
    if (!fabricCanvas) return;
    var w = fabricW;
    var h = fabricH;
    if (w <= 0 || h <= 0) return;
    fabricCtx.clearRect(0, 0, w, h);

    fabricCtx.fillStyle = "rgba(255, 107, 107, 0.04)";
    fabricCtx.fillRect(0, 0, w, h);

    // Draw connecting lines grouped by round
    var rounds = {};
    for (var i = 0; i < state.allFabricStitches.length; i++) {
      var s = state.allFabricStitches[i];
      if (!rounds[s.round]) rounds[s.round] = [];
      rounds[s.round].push(s);
    }

    var keys = Object.keys(rounds).sort(function(a, b) { return +a - +b; });
    for (var k = 0; k < keys.length; k++) {
      var stitches = rounds[keys[k]];
      if (stitches.length < 2) continue;
      fabricCtx.strokeStyle = stitches[0].color;
      fabricCtx.globalAlpha = 0.30;
      fabricCtx.lineWidth = 2;
      fabricCtx.beginPath();
      fabricCtx.moveTo(stitches[0].x, stitches[0].y);
      for (var j = 1; j < stitches.length; j++) {
        fabricCtx.lineTo(stitches[j].x, stitches[j].y);
      }
      if (stitches[stitches.length - 1].stitch === "sl") {
        fabricCtx.lineTo(stitches[0].x, stitches[0].y);
      }
      fabricCtx.stroke();
      fabricCtx.globalAlpha = 1.0;
    }

    // Draw each stitch
    for (var i = 0; i < state.allFabricStitches.length; i++) {
      drawStitchSymbol(fabricCtx, state.allFabricStitches[i], state.allFabricStitches[i].x, state.allFabricStitches[i].y, state.allFabricStitches[i].color);
    }

    // Round label
    if (state.currentLevels.length > 0) {
      var lv = state.currentLevels[state.level];
      var totalRounds = state.currentLevels.length;
      fabricCtx.fillStyle = "rgba(139, 74, 46, 0.55)";
      fabricCtx.font = "11px 'Segoe UI', sans-serif";
      fabricCtx.textAlign = "left";
      fabricCtx.fillText("Round " + (state.level + 1) + " / " + totalRounds, 8, 14);
      if (state.currentSquare) {
        fabricCtx.fillText(state.currentSquare.name, 8, 28);
      }
    }
  }

  function drawStitchSymbol(g, item, x, y, color) {
    var size = 8;
    g.fillStyle = color;

    if (item.stitch === "ch") {
      g.beginPath();
      g.ellipse(x, y, size * 0.55, size * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    } else if (item.stitch === "sl") {
      g.beginPath();
      g.arc(x, y, size * 0.35, 0, Math.PI * 2);
      g.fill();
    } else if (item.stitch === "sc") {
      g.fillRect(x - size * 0.4, y - size * 0.4, size * 0.8, size * 0.8);
    } else if (item.stitch === "dc") {
      g.fillRect(x - size * 0.3, y - size * 0.6, size * 0.6, size * 1.2);
    } else if (item.stitch === "tr") {
      g.fillRect(x - size * 0.3, y - size * 0.7, size * 0.6, size * 1.4);
      g.fillRect(x - size * 0.6, y - size * 0.1, size * 1.2, size * 0.2);
    }

    if (item.rank === "miss") {
      g.strokeStyle = "#c25450";
      g.lineWidth = 2;
      g.strokeRect(x - size - 2, y - size - 2, size * 2 + 4, size * 2 + 4);
    }
  }

  // ---------- Drawing (rhythm canvas) ----------
  function draw() {
    if (!canvas || state.currentLevels.length === 0) return;
    if (banner.style.display === "flex") return; // skip while intro/finish banner is visible
    var w = canvasW;
    var h = canvasH;
    if (w <= 0 || h <= 0) return;
    ctx.clearRect(0, 0, w, h);

    var laneW = w / LANE_ORDER.length;
    var active = state.currentLevels[state.level].stitches;

    // Lane backgrounds
    for (var i = 0; i < LANE_ORDER.length; i++) {
      var isActive = active.indexOf(LANE_ORDER[i]) >= 0;
      ctx.fillStyle = isActive ? "rgba(255, 240, 238, 0.55)" : "rgba(220, 200, 200, 0.35)";
      ctx.fillRect(laneW * i, 0, laneW, h);

      ctx.fillStyle = isActive ? "rgba(58, 48, 39, 0.55)" : "rgba(58, 48, 39, 0.22)";
      ctx.font = "13px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      var s = STITCHES[LANE_ORDER[i]];
      ctx.fillText(s.key + "  " + s.symbol, laneX(i), 22);
    }

    // Hit line
    var hl = hitLineY();
    ctx.strokeStyle = "rgba(255, 107, 107, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(8, hl);
    ctx.lineTo(w - 8, hl);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit targets
    for (var i = 0; i < LANE_ORDER.length; i++) {
      var x = laneX(i);
      var s = STITCHES[LANE_ORDER[i]];
      var isActive = active.indexOf(LANE_ORDER[i]) >= 0;
      ctx.beginPath();
      ctx.arc(x, hl, 22, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "rgba(255, 142, 114, 0.35)" : "rgba(180, 160, 160, 0.2)";
      ctx.fill();
      ctx.strokeStyle = isActive ? s.color : "rgba(120, 100, 100, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isActive ? "#3a3027" : "rgba(58,48,39,0.3)";
      ctx.font = "18px 'Segoe UI', sans-serif";
      ctx.fillText(s.symbol, x, hl + 6);
    }

    // Wrong-key flashes
    var now = performance.now() / 1000;
    for (var i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      var age = now - f.t0;
      if (age > 0.25) { flashes.splice(i, 1); continue; }
      ctx.fillStyle = "rgba(194, 84, 80, " + (0.5 - age * 2) + ")";
      ctx.fillRect(laneW * f.lane, 0, laneW, h);
    }

    // Notes
    for (var i = 0; i < state.notes.length; i++) {
      var n = state.notes[i];
      if (n.hit) continue;
      var y = noteY(n, now);
      if (y < -50 || y > h + 50) continue;
      var x = laneX(n.lane);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "16px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.symbol, x, y + 1);
      ctx.textBaseline = "alphabetic";
    }

    // Judgement floats
    for (var i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      var age = now - f.t0;
      if (age > 0.7) { floats.splice(i, 1); continue; }
      ctx.fillStyle = f.color;
      ctx.font = "bold 16px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - age * 40);
    }
  }

  // ---------- HUD ----------
  function updateHud() {
    if (state.currentLevels.length === 0) return;
    var lv = state.currentLevels[state.level];
    var totalRounds = state.currentLevels.length;
    $("#stage-title").textContent = "Round " + (state.level + 1) + " \u00B7 " + lv.name;
    $("#stage-sub").textContent = lv.intro.length > 80 ? lv.intro.substring(0, 77) + "..." : lv.intro;
    $("#hud-level").textContent = (state.level + 1) + " / " + totalRounds;
    $("#hud-score").textContent = state.totalScore + state.score;
    $("#hud-combo").textContent = "x" + state.combo;
    var total = state.perfect + state.good + state.miss;
    var acc = total > 0 ? Math.round(((state.perfect + state.good) / total) * 100) : 100;
    $("#hud-acc").textContent = acc + "%";
    $("#hud-bpm").textContent = state.bpm;
    $("#hud-stitches").textContent = lv.stitches.length;
    $("#fabric-round").textContent = (state.level + 1) + " / " + totalRounds;
  }

  // ---------- Game loop ----------
  function tick() {
    if (state.currentLevels.length > 0) {
      if (state.running && !state.finished) {
        var now = performance.now() / 1000;
        for (var i = 0; i < state.notes.length; i++) {
          var n = state.notes[i];
          if (n.hit) continue;
          if (n.hitTime + 0.4 < now) {
            n.hit = true;
            state.miss++;
            state.combo = 0;
            playSfx("miss");
            addStitchToFabric(n.stitch, "miss", n);
            floatJudgement(n.stitch, "miss", laneX(n.lane));
            updateHud();
          }
        }
        var allDone = true;
        for (var i = 0; i < state.notes.length; i++) {
          if (!state.notes[i].hit) { allDone = false; break; }
        }
        var last = state.notes[state.notes.length - 1];
        if (allDone && last && now > last.hitTime + 0.8) {
          finishLevel();
        }
      }
      if (state.running) draw();
    }
    requestAnimationFrame(tick);
  }

  // ---------- Level flow ----------
  function startLevel() {
    var lv = state.currentLevels[state.level];
    state.bpm = lv.bpm;
    state.speedMul = lv.speedMul;
    state.travelTime = 1.6 / state.speedMul;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.perfect = 0;
    state.good = 0;
    state.miss = 0;
    state.wrong = 0;
    state.finished = false;
    state.running = true;
    state.startTime = performance.now() / 1000;
    state.roundOffset = state.allFabricStitches.length;
    schedulePattern();
    hideBanner();
    renderFabric();
    updateHud();
    refreshStitchPanel();
  }

  function finishLevel() {
    state.finished = true;
    state.running = false;

    var total = state.perfect + state.good + state.miss;
    var acc = total > 0 ? Math.round(((state.perfect + state.good) / total) * 100) : 0;
    var passed = state.miss <= 3;
    var isLast = state.level >= state.currentLevels.length - 1;

    var title, body, btn, image;
    if (passed && isLast) {
      title = "\uD83C\uDF1F " + state.currentSquare.name + " Complete!";
      body = "You finished all " + state.currentLevels.length + " rounds and made a " +
        state.currentSquare.name + "! Accuracy " + acc + "%, best combo x" +
        state.bestCombo + ". Total score: " + (state.totalScore + state.score) + ".";
      btn = "Pick Another Square (Space)";
      image = state.currentSquare.image || null;
    } else if (passed) {
      title = "Round " + (state.level + 1) + " complete \u2713";
      var nextLv = state.currentLevels[state.level + 1];
      body = "Accuracy " + acc + "%, best combo x" + state.bestCombo + ". " +
        "Press Space to continue to Round " + (state.level + 2) + ": " + nextLv.name + ".";
      btn = "Next Round (Space)";
      image = null;
    } else {
      var hitCount = state.perfect + state.good;
      var totalCount = state.perfect + state.good + state.miss;
      var encouragements = [
        "Almost there! You hit " + hitCount + " out of " + totalCount + " stitches. Keep going!",
        "You're making real progress! Every attempt brings you closer. Let's try again!",
        "So close! The yarn moves fast, but you'll catch the rhythm. One more time!",
        "Don't give up! Even expert crocheters drop stitches sometimes. You've got this!",
        "Nice effort! Focus on the falling yarn and tap when it reaches the line. Retry!",
        "That round had some tricky parts! Take a breath and give it another go!"
      ];
      var encMsg = encouragements[Math.floor(Math.random() * encouragements.length)];
      title = "Round " + (state.level + 1) + " \u2014 Try Again!";
      body = "You hit <b>" + hitCount + " / " + totalCount + "</b> stitches (" + acc + "% accuracy). Best combo: x" + state.bestCombo + ".<br><br>" +
        "\uD83D\uDCA1 " + encMsg + "<br><br>" +
        "<span style='font-size:13px;color:var(--text-soft);'>Tip: Watch the yarn as it falls, not the keys. The hit line is the dashed coral line near the bottom.</span>";
      btn = "Retry (Space)";
      image = null;
    }
    showBanner(title, body, btn, image);
  }

  function advance() {
    var passed = state.miss <= 3;
    var isLast = state.level >= state.currentLevels.length - 1;

    if (passed && !isLast) {
      state.totalScore += state.score;
      state.level++;
      showIntro();
    } else if (passed && isLast) {
      state.totalScore += state.score;
      // Go back to gallery
      showGallery();
    } else {
      state.allFabricStitches = state.allFabricStitches.slice(0, state.roundOffset);
      showIntro();
    }
  }

  function showBanner(title, body, btn, image, callback) {
    var imgHtml = image
      ? '<div class="banner-img-wrap">' +
        '<img class="banner-img" src="' + image + '" alt="' + title + '">' +
        '<span class="img-credit">AI-generated reference photo</span>' +
        '</div>'
      : '';
    bannerInner.innerHTML =
      imgHtml +
      '<h2>' + title + '</h2>' +
      '<p>' + body + '</p>' +
      '<button class="btn" id="banner-btn">' + btn + '</button>' +
      '<button class="btn ghost" id="banner-back">Back to Gallery</button>';
    banner.style.display = "flex";
    var b = document.getElementById("banner-btn");
    if (b) b.addEventListener("click", callback || advance);
    var bk = document.getElementById("banner-back");
    if (bk) bk.addEventListener("click", showGallery);
  }
  function hideBanner() { banner.style.display = "none"; }

  // ---------- Stitch panel ----------
  function refreshStitchPanel() {
    var wrap = $("#stitch-panel");
    if (!wrap || state.currentLevels.length === 0) return;
    wrap.innerHTML = "";
    var active = state.currentLevels[state.level].stitches;
    for (var i = 0; i < LANE_ORDER.length; i++) {
      var code = LANE_ORDER[i];
      var s = STITCHES[code];
      var isOn = active.indexOf(code) >= 0;
      var el = document.createElement("div");
      el.className = "stitch-chip" + (isOn ? "" : " muted");
      el.innerHTML =
        '<span class="key">' + s.key + '</span>' +
        '<span style="color:' + s.color + ';font-weight:700;">' + s.symbol + '</span>' +
        '<span>' + s.name + '</span>';
      wrap.appendChild(el);
    }
  }

  // ---------- Start ----------
  function showIntro() {
    state.running = false;
    state.finished = false;
    var lv = state.currentLevels[state.level];
    refreshStitchPanel();
    updateHud();
    renderFabric();
    var stitchesHtml = lv.stitches.map(function(code) {
      var s = STITCHES[code];
      return '<b style="color:' + s.color + '">' + s.key + '</b> = ' + s.name + ' (' + s.symbol + ')';
    }).join(' &nbsp;|&nbsp; ');
    showBanner(
      state.currentSquare.name + " \u00B7 Round " + (state.level + 1) + " of " + state.currentLevels.length,
      lv.intro + "<br><br>" + stitchesHtml + "<br><br><span style='display:inline-block;font-size:15px;font-weight:700;color:var(--coral);animation:gentle-pulse 1.5s ease-in-out infinite;'>&#9654; Press SPACE to start!</span>",
      "Start (\u2423)",
      null,
      startLevel
    );
  }

  function init() {
    buildGallery();
    fitCanvas();
    var muteBtn = document.getElementById("btn-mute");
    if (muteBtn) {
      muteBtn.addEventListener("click", function() {
        muted = !muted;
        muteBtn.textContent = muted ? "🔇" : "🔊";
      });
    }
    window.addEventListener("resize", function() {
      fitCanvas();
      renderFabric();
    });
    requestAnimationFrame(tick);
  }
  document.addEventListener("DOMContentLoaded", init);

  // Expose for debugging
  window.__game = { state: state, SQUARE_LIBRARY: SQUARE_LIBRARY, STITCHES: STITCHES, LANE_ORDER: LANE_ORDER };
})();
