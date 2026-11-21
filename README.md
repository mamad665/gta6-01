[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mamad665/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mamad665/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City — Open-World Crime

A top-down 2D open-world crime game in the fictional coastal city of Solmar. You are **Marco Vale**, a wheelman working four chained jobs for Rosa Delgado — run packages, steal a Comet GT, make a quiet drop, and intercept a bank van — while the Solmar PD hunts you with a wanted-star system.

Entry for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

## Play

Serve the repo root and open `game/index.html` in a browser.

- **WASD** — move on foot / drive
- **E** — enter or steal a car
- **F** — punch
- **G** or **click** — shoot the pistol
- **P** — pause, **M** — mute

Follow the gold star to each job marker. Watch your health, your ammo, and your wanted stars.

## Build

`main.ts` (Node 22) generates the entry dossier:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Vanilla ES modules, canvas 2D, no libraries, no network. Every name, story beat, and sound is invented for this game — nothing from any commercial title.
