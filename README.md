# MTG Limited IQ

> **Elevate your Limited game with active recall drills, card evaluations, and empirical 17Lands draft telemetry.**

**MTG Limited IQ** is an advanced Magic: The Gathering Limited format training platform and evaluation suite designed to build card recognition, test metagame heuristics, and sharpen draft and sealed decision-making.

---

## Key Features

### 1. Card Quiz & Flashcard Drills
- **Active Recall**: Test your memory of mana costs, power/toughness, combat tricks, and removal at instant speed.
- **Drill Modes**: Standard Quiz, Spaced Repetition, and Flashcard Review.
- **Granular Customization**: Filter practice sessions by set, mana colors, card types, and rarities.

### 2. Set Explorer & Scryfall / Arena Search
- **Arena & Scryfall Search Engine**: Direct in-set filtering using standard tokens:
  - Text & Types: `t:creature`, `t:instant`, `o:"draw a card"`, `name:"Shock"`
  - Colors: `c:w`, `c>=g`, `c<=wgb`, `c=r`, `c:colorless`
  - Numbers & Stats: `pow>3`, `tou>=4`, `mv<3`, `cmc=2`
  - Rarities: `r:common`, `r=u`, `r>=r`
  - Negation: `-t:creature`, `-c:u`
- **Visual Advanced Search Modal**: Build complex queries with interactive sliders, type chips, and color toggles.
- **Search Syntax Cheat Sheet**: Built-in 1-click reference with copyable examples.
- **Filtered Subset Notice**: Keep context while inspecting cards, with instant "Clear Filter" navigation.

### 3. Evaluation Hub & Metagame Synthesis
- **Personal Card Grading**: Assign letter tiers (`S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F`) with notes.
- **Rapid Grader**: Fast keyboard-driven grading flow (`A-F` keys) with smooth transition animations.
- **17Lands Reality Calibration**: Direct integration with empirical 17Lands Game-in-Hand (GIH) win rates and pick priority.
- **Side-by-Side Mode**: Compare personal intuition against empirical win rates to discover personal traps and sleeper cards.
- **Archetype Forecast**: Monocolor and 2-color archetype rankings, speed indicators, and draft reads with creator-style synthesis reports.
- **Unreleased Set Guardrails**: Automatic TBD indicators for unreleased sets awaiting initial 17Lands match telemetry.

### 4. Cloud Sync & Offline-First Architecture
- **Supabase Integration**: Cloud sync across devices for evaluations and study progress.
- **Offline Storage**: Built with IndexedDB (`idb-keyval`) and localStorage fallbacks for offline practice.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Tooling**: Vite 6
- **Data Providers**: Scryfall REST API + 17Lands Public Telemetry

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm / yarn / pnpm

### Installation

```bash
# Clone or navigate to the repository
cd "MTG Limited IQ"

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## License
MIT
