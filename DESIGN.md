---
version: alpha
name: Daylight Heroic 3D Chibi Diorama
description: Visual design system for "Hào Khí Đại Việt — Tứ Đạo Công Thành 3D Chibi", a bright, vibrant 3D isometric classroom RPG boardgame where 4 student groups attack from 4 cardinal directions (East, West, South, North) across 4 stages toward the central Imperial Citadel.
colors:
  sky-top: "#E0F2FE"
  sky-horizon: "#FEF3C7"
  terrain-grass: "#4ADE80"
  terrain-meadow: "#22C55E"
  terrain-earth: "#D97706"
  water-river: "#0EA5E9"
  surface-card: "#FFFFFF"
  surface-cream: "#FFFBEB"
  border-gold: "#F59E0B"
  border-warm: "#E2E8F0"
  primary-crimson: "#DC2626"
  primary-gold: "#F59E0B"
  accent-jade: "#10B981"
  accent-east-cyan: "#0284C7"
  accent-west-fire: "#EA580C"
  accent-south-emerald: "#16A34A"
  accent-north-royal: "#2563EB"
  text-ink: "#0F172A"
  text-slate: "#334155"
  text-muted: "#64748B"
typography:
  headline-hero:
    fontFamily: Be Vietnam Pro
    fontSize: 34px
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-stage:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.25
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.55
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: 10px
  md: 16px
  lg: 22px
  xl: 28px
  full: 9999px
spacing:
  xs: 6px
  sm: 12px
  md: 18px
  lg: 24px
  xl: 32px
components:
  button-3d-gold:
    backgroundColor: "{colors.primary-gold}"
    textColor: "#0F172A"
    rounded: "{rounded.md}"
    padding: 14px
  card-toybox:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Hào Khí Đại Việt — Tứ Đạo Công Thành 3D Chibi

## Overview
A bright, cheerful, heroic 3D Toy-Box Diorama aesthetic inspired by Clash Royale and Nintendo 3D boardgames. Built for classroom projectors and student laptops/phones so that all 4 groups (East, West, South, North) see each other marching, slashing gates, and firing cannons across a sunny 3D battlefield.

## Colors
- **Daylight Sky & Lush Terrain (`#E0F2FE` -> `#4ADE80`):** Bright sunny battlefield with emerald meadows, sparkling rivers, and golden stone roads.
- **4 Cardinal Faction Colors:**
  - **Đông Đạo (Thủy Quân Ngô Quyền):** Ocean Cyan (`#0284C7`)
  - **Tây Đạo (Kỵ Binh Quang Trung):** Blazing Flame (`#EA580C`)
  - **Nam Đạo (Tượng Binh Tây Sơn):** Jungle Emerald (`#16A34A`)
  - **Bắc Đạo (Thiết Giáp Lý Thường Kiệt):** Royal Sapphire & Gold (`#2563EB`)

## Typography
- **Be Vietnam Pro (ExtraBold / Black):** Crisp, joyful, high-contrast Vietnamese typography with subtle 3D text shadows for battle callouts (`TUYỆT CHIÊU CÔNG THÀNH!`, `PHÁ ẢI THÀNH CÔNG!`).

## Layout
- ** Onboarding Gate Modal:** Full-screen 3D Chibi Hero selection where students type their Group Name and pick 1 of the 4 Cardinal Directions.
- **3D Isometric Battlefield Viewport:** Center interactive 3D-tilted diorama showing all 4 lanes (4 Stages per lane: Chặng 1 -> Chặng 2 -> Chặng 3 -> Chặng 4 Kinh Thành Trung Tâm) and all 4 animated 3D Chibi Commanders moving in real time.
- **3D Battle Arena Modal:** Appears when attacking a Stage — features the group's 3D Chibi Hero facing off against the Gate Guardian with animated sword slash, cannon fire, lightning bolts, and instant Knowledge Table unlocking.

## Do's and Don'ts
- Do randomize the question sequence per direction (`East`, `West`, `South`, `North`) so each group faces a distinct order of challenges across Stages 1–3 before converging on Stage 4.
- Do keep all 4 lanes populated and visibly advancing (combining real connected student groups + smart AI rival groups for any unoccupied lane).
- Do keep the exact 3 rows of Vietnamese History (**Chiến thắng Bạch Đằng**, **Kháng chiến chống Xiêm & Thanh**, **Kháng chiến chống Tống** ↔ **Vai trò rút ra**) verbatim.
