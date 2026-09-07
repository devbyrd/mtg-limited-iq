import { Card, MTGColor, GradeTier } from '../types/mtg';
import { GUILD_ARCHETYPES, getDevelopedArchetypeCodes } from './archetypeEvaluator';

export interface WOTCArchetype {
  code: string; // 'WU', 'UB', etc.
  colors: [MTGColor, MTGColor];
  name: string; // 'Azorius', 'Silverquill', etc.
  headline: string; // 'Birds • Fliers & Spells', etc.
  description: string; // Official WOTC description of archetype strategy
  mechanics: string[];
}

/**
 * Curated WOTC Official Supported Archetypes per MTG Set.
 * Contains official descriptions from Wizards of the Coast design and prerelease primers.
 */
const SET_WOTC_ARCHETYPES: Record<string, Record<string, { name: string; headline: string; description: string; mechanics: string[] }>> = {
  // Bloomburrow (BLB)
  BLB: {
    WU: {
      name: 'Birds (Azorius)',
      headline: 'Birds of a Feather • Noncreature Spells & Flying Tempo',
      description: 'Wizards designed White-Blue Birds around aerial superiority and noncreature spell synergy. Flying creatures pressure opponents while instant and sorcery spells provide tempo, evasion boosts, and protective countermagic.',
      mechanics: ['Flying', 'Noncreature Spells', 'Tempo'],
    },
    UB: {
      name: 'Rats (Dimir)',
      headline: 'Clever Rats • Threshold Control & Graveyard Recursion',
      description: 'Dimir Rats play a patient attrition game, utilizing self-mill, card draw, and targeted removal to achieve threshold (seven or more cards in your graveyard), unlocking amplified payoffs and recursion.',
      mechanics: ['Threshold (7+ Graveyard)', 'Control', 'Recursion'],
    },
    BR: {
      name: 'Lizards (Rakdos)',
      headline: 'Cold-Blooded Lizards • Opponent Loss of Life Aggro',
      description: 'Rakdos Lizards reward aggressive attacks and noncombat ping damage. Lizard cards gain substantial power, menace, or draw cards if an opponent lost life during the current turn.',
      mechanics: ['Opponent Lost Life', 'Aggro', 'Direct Damage'],
    },
    RG: {
      name: 'Raccoons (Gruul)',
      headline: 'Trash & Treasure • Expend 4 & Heavy Beatdown',
      description: 'Gruul Raccoons utilize the Expend mechanic, tracking total mana spent on spells each turn. Spending four or more mana triggers explosive power buffs, trample, and card advantage.',
      mechanics: ['Expend 4', '4+ Power', 'Trample Stompy'],
    },
    GW: {
      name: 'Rabbits (Selesnya)',
      headline: 'Bountiful Rabbits • Swarm Tokens & Go-Wide Anthems',
      description: 'Selesnya Rabbits flood the battlefield with 1/1 Rabbit creature tokens. The archetype excels at going wide and capitalizing on team-wide stat buffs, convoke-style abilities, and overwhelming board presence.',
      mechanics: ['Go-Wide Tokens', 'Anthems', '+1/+1 Buffs'],
    },
    WB: {
      name: 'Bats (Orzhov)',
      headline: 'Night & Day • Life Gain and Loss Fluctuation',
      description: 'Orzhov Bats operate around life total movement. Whether you gain life from lifelink or sacrifice life to pay spell costs, fluctuating your life total on your turn supercharges Bat synergies.',
      mechanics: ['Life Fluctuation', 'Lifelink & Drain', 'Evasion'],
    },
    UR: {
      name: 'Otters (Izzet)',
      headline: 'Playful Otters • Noncreature Spellslinger & Prowess',
      description: 'Izzet Otters chain inexpensive instants and sorceries with prowess-style triggers. Play cheap cantrips and burn spells to multiply combat power and out-tempo slower decks.',
      mechanics: ['Spellslinger', 'Prowess', 'Card Velocity'],
    },
    BG: {
      name: 'Squirrels (Golgari)',
      headline: 'Resourceful Squirrels • Forage & Food Graveyard Value',
      description: 'Golgari Squirrels create Food tokens and utilize the Forage mechanic (exiling three cards from your graveyard or sacrificing a Food). This fuels endless recursion, +1/+1 counters, and grinding attrition.',
      mechanics: ['Forage', 'Food Tokens', 'Graveyard Recycling'],
    },
    RW: {
      name: 'Mice (Boros)',
      headline: 'Valiant Mice • Heroic Targeting & Lightning Aggro',
      description: 'Boros Mice are fast, low-to-the-ground aggro creatures with the Valiant ability, triggering the first time each turn a mouse becomes the target of a spell or ability you control.',
      mechanics: ['Valiant', 'Targeting Spells', 'Fast Combat'],
    },
    GU: {
      name: 'Frogs (Simic)',
      headline: 'Pond Hoppers • Enter-the-Battlefield Bounce & Blink',
      description: 'Simic Frogs jump into and out of combat, bouncing your own creatures to hand or flickering them to trigger powerful enter-the-battlefield abilities repeatedly.',
      mechanics: ['ETB Value', 'Self-Bounce', 'Blink & Ramp'],
    },
  },

  // Duskmourn: House of Horror (DSK)
  DSK: {
    WU: {
      name: 'Azorius (WU)',
      headline: 'Eerie • Rooms & Enchantment Tempo',
      description: 'White-Blue locks down opposing nightmares with enchantment Auras and unlocks Rooms to trigger Eerie, generating flying spirits, tapping blockers, and controlling the pace of combat.',
      mechanics: ['Eerie', 'Rooms', 'Enchantments'],
    },
    UB: {
      name: 'Dimir (UB)',
      headline: 'Eerie Control • Graveyard Reanimation & Card Draw',
      description: 'Blue-Black pilots an eerie control strategy, filling the graveyard with high-cost horrors and reanimating them ahead of curve while drawing through the deck with insidious card filtering.',
      mechanics: ['Eerie', 'Reanimation', 'Card Filtering'],
    },
    BR: {
      name: 'Rakdos (BR)',
      headline: 'Sacrifice Aggro • Room Detonation & Reckless Damage',
      description: 'Black-Red aggressively unleashes terror, sacrificing disposable room permanents and fodder creatures to deal direct damage and punish opponents who fail to block.',
      mechanics: ['Sacrifice', 'Room Synergy', 'Direct Burn'],
    },
    RG: {
      name: 'Gruul (RG)',
      headline: 'Delirium Stompy • 4+ Power Diverse Threat Beatdown',
      description: 'Red-Green accelerates diverse card types into the graveyard to unlock Delirium, producing massive 4+ power trampling beasts that overwhelm defensive lines.',
      mechanics: ['Delirium (4+ Types)', '4+ Power', 'Trample'],
    },
    GW: {
      name: 'Selesnya (GW)',
      headline: 'Survival • Tapped Creatures Value & Defense',
      description: 'Green-White features the Survival mechanic. When your creatures tap (via attacking or crew-style abilities) and survive until your second main phase, they generate substantial card advantage and counters.',
      mechanics: ['Survival', 'Tap Triggers', 'Anthems'],
    },
    WB: {
      name: 'Orzhov (WB)',
      headline: 'Reanimation & Drain • Small Creature Attrition',
      description: 'White-Black recurs low-mana creatures from the graveyard and bleeds opponent life totals with death triggers and lifegain payoffs.',
      mechanics: ['Reanimation <= 3 CMC', 'Lifegain & Drain', 'Aristocrats'],
    },
    UR: {
      name: 'Izzet (UR)',
      headline: 'Rooms & Spellslinger • Door Velocity & Direct Damage',
      description: 'Blue-Red synergizes opening unlocked Room doors with noncreature spells, burning blockers and drawing cards in a rush of tempo.',
      mechanics: ['Rooms', 'Noncreature Spells', 'Burn & Tempo'],
    },
    BG: {
      name: 'Golgari (BG)',
      headline: 'Delirium & Morbid • Graveyard Recursion & Deathtouch',
      description: 'Black-Green fills the graveyard with artifacts, enchantments, creatures, and lands to trigger Delirium and assemble unstoppable recursive threats.',
      mechanics: ['Delirium', 'Graveyard Mill', 'Deathtouch Attrition'],
    },
    RW: {
      name: 'Boros (RW)',
      headline: 'Survival Aggro • Equipment & First Strike Attacks',
      description: 'Red-White uses equipment, combat tricks, and high power to attack safely, triggering Survival abilities while keeping pressure on the opponent.',
      mechanics: ['Survival', 'Equipment', 'Aggressive Pump'],
    },
    GU: {
      name: 'Simic (GU)',
      headline: 'Manifest Dread • Face-Down Horrors & Ramp',
      description: 'Green-Blue uses Manifest Dread (looking at top two cards, putting one onto battlefield face-down as a 2/2 and one into graveyard) to cheat mana costs and flip colossal creatures.',
      mechanics: ['Manifest Dread', 'Face-Down 2/2s', 'Big Mana'],
    },
  },

  // Foundations (FDN)
  FDN: {
    WU: {
      name: 'Azorius (WU)',
      headline: 'Fliers & Flash • Classical Sky Dominance & Tempo',
      description: 'Wizards designed White-Blue in Foundations as the quintessential flying and tempo archetype. Airborne threats clock the opponent while flash creatures and instant tricks disrupt ground attacks.',
      mechanics: ['Flying', 'Flash', 'Countermagic & Bounce'],
    },
    UB: {
      name: 'Dimir (UB)',
      headline: 'Flashback & Control • Graveyard Card Advantage',
      description: 'Blue-Black plays a patient, classic control strategy using targeted removal, counterspells, and Flashback spells to out-value opponents into the late game.',
      mechanics: ['Flashback', 'Removal', 'Card Advantage'],
    },
    BR: {
      name: 'Rakdos (BR)',
      headline: 'Raid & Sacrifice • Direct Damage & Aggressive Bleed',
      description: 'Black-Red attacks relentlessly each turn to trigger Raid bonuses, turning expendable goblins and skeletons into direct damage and removal.',
      mechanics: ['Raid', 'Sacrifice Fodder', 'Direct Damage'],
    },
    RG: {
      name: 'Gruul (RG)',
      headline: 'Ferocious Stompy • 4+ Power Ramp & Trample',
      description: 'Red-Green accelerates mana to cast huge creatures with 4 or more power, leveraging Ferocious attack bonuses to demolish opposing defenses.',
      mechanics: ['4+ Power (Ferocious)', 'Mana Ramp', 'Trample'],
    },
    GW: {
      name: 'Selesnya (GW)',
      headline: '+1/+1 Counters & Tokens • Go-Wide Army Growth',
      description: 'Green-White generates creature tokens and distributes permanent +1/+1 counters across its battlefield, building an impenetrable defensive line and lethal alpha strike.',
      mechanics: ['+1/+1 Counters', 'Tokens', 'Anthems'],
    },
    WB: {
      name: 'Orzhov (WB)',
      headline: 'Morbid & Lifegain • Aristocrats Death Triggers',
      description: 'White-Black thrives on death and lifegain. When creatures die on either side, Morbid triggers activate to drain life, draw cards, and punish removal.',
      mechanics: ['Morbid (Death Triggers)', 'Lifegain & Drain', 'Aristocrats'],
    },
    UR: {
      name: 'Izzet (UR)',
      headline: 'Spellslinger • Instant/Sorcery Velocity & Prowess',
      description: 'Blue-Red is the premier spellslinger pairing. Chaining cheap cantrips and burn spells pumps prowess creatures and clears the way for lethal burst damage.',
      mechanics: ['Prowess', 'Instants & Sorceries', 'Burn'],
    },
    BG: {
      name: 'Golgari (BG)',
      headline: 'Morbid Recursion • Graveyard Recycling & Attrition',
      description: 'Black-Green leverages creature deaths to fuel graveyard recursion, bringing back fallen bombs and winning through inevitable resource advantage.',
      mechanics: ['Morbid', 'Graveyard Recursion', 'Deathtouch'],
    },
    RW: {
      name: 'Boros (RW)',
      headline: 'Battalion Aggro • Low-Curve Swarm & Combat Tricks',
      description: 'Red-White curves out with aggressive 1- and 2-drops. Attacking with three or more creatures activates Battalion triggers for explosive combat buffs.',
      mechanics: ['Battalion (3+ Attackers)', 'Combat Tricks', 'Low Curve'],
    },
    GU: {
      name: 'Simic (GU)',
      headline: 'Ramp & Big Spells • Colossal Sea Beasts & Card Draw',
      description: 'Green-Blue ramps extra lands onto the battlefield to deploy giant 6+ mana leviathans, drawing extra cards to sustain limitless threats.',
      mechanics: ['Land Ramp', 'Big Mana (6+)', 'Card Draw'],
    },
  },

  // Strixhaven: School of Mages (STX) - 5 Developed Colleges
  STX: {
    WB: {
      name: 'Silverquill College (WB)',
      headline: 'The College of Eloquence • Inklings, Counters & Aggro',
      description: 'Wizards designed Silverquill as an aggressive, sharp-witted college focusing on fast attackers, flying 2/1 Inkling tokens, and distributing +1/+1 counters through verbal and magical debate.',
      mechanics: ['Inkling Tokens', '+1/+1 Counters', 'Aggressive Flier Tempo'],
    },
    UR: {
      name: 'Prismari College (UR)',
      headline: 'The College of Elemental Arts • Big Mana 5+ Spells & Treasures',
      description: 'Prismari expresses magic through grand, theatrical performances. The archetype ramps with Treasure tokens to cast devastating 5+ mana value instants and sorceries.',
      mechanics: ['5+ Cost Spells', 'Treasure Ramping', 'Elemental Sorceries'],
    },
    BG: {
      name: 'Witherbloom College (BG)',
      headline: 'The College of Essence Studies • Pest Tokens & Lifegain/Drain',
      description: 'Witherbloom investigates the cycle of life and death. You create 1/1 Pest tokens that gain 1 life when they die, sacrificing them to fuel insidious drain and growth abilities.',
      mechanics: ['Pest Tokens (1/1 Gain Life)', 'Life Drain & Gain', 'Sacrifice'],
    },
    RW: {
      name: 'Lorehold College (RW)',
      headline: 'The College of Archaeomancy • Spirit Tokens & Graveyard Archaeology',
      description: 'Lorehold excavates history by interacting with cards leaving your graveyard. Spirit tokens, artifact recursion, and aggressive archaeomancers bring ancient power into the present.',
      mechanics: ['Cards Leaving Graveyard', 'Spirit Tokens', 'Artifact Recursion'],
    },
    GU: {
      name: 'Quandrix College (GU)',
      headline: 'The College of Numerology • Fractal Tokens & 8+ Land Scale',
      description: 'Quandrix manipulates the mathematical patterns of nature and the multiverse. The archetype ramps to eight lands and generates Fractal tokens with variable +1/+1 counters that grow exponentially.',
      mechanics: ['Fractal Tokens', '8+ Lands Scale', 'Mana Ramp & Math'],
    },
  },

  // Secrets of Strixhaven (SOS)
  SOS: {
    WU: {
      name: 'Chronomancy (WU)',
      headline: 'Time Manipulation • Scrying, Library Pacing & Fliers',
      description: 'Wizards designed White-Blue Chronomancy around temporal pacing, foresight library manipulation, and aerial control, rewarding players who anticipate future turns.',
      mechanics: ['Foresight / Scry', 'Flying Tempo', 'Library Manipulation'],
    },
    UB: {
      name: 'Shadow Saboteurs (UB)',
      headline: 'Forbidden Archives • Stealth Rogues & Graveyard Secrets',
      description: 'Blue-Black operates from the shadows, infiltrating enemy defenses with unblockable saboteurs that extract valuable secrets and recursive spells from the graveyard.',
      mechanics: ['Saboteur Combat', 'Unblockable', 'Graveyard Secrets'],
    },
    BR: {
      name: 'Blood Magic (BR)',
      headline: 'Reckless Sac • High-Risk Life Payment & Burst Damage',
      description: 'Black-Red practices forbidden blood casting, paying life and sacrificing experimental creations to trigger devastating spikes of direct damage.',
      mechanics: ['Life Payment', 'Sacrifice', 'Direct Burst Burn'],
    },
    RG: {
      name: 'Elemental Geocasting (RG)',
      headline: 'Earth & Flame • 4+ Power Stompy & Geological Might',
      description: 'Red-Green channels raw elemental earth magic, accelerating mana into towering geological behemoths that smash through enemy lines with trample.',
      mechanics: ['4+ Power', 'Geological Ramp', 'Trample'],
    },
    GW: {
      name: 'Biomancy Cultivation (GW)',
      headline: 'Living Ecology • +1/+1 Bio-Counters & Flourishing Swarm',
      description: 'Green-White cultivates living magical ecosystems, generating flourishing token creatures and distributing bio-counters across the team.',
      mechanics: ['Bio-Counters', 'Tokens', 'Anthems'],
    },
    WB: {
      name: 'Silverquill Debate (WB)',
      headline: 'Inkling Duels • Wordplay Combat & Political Bleed',
      description: 'White-Black deploys razor-sharp rhetoric and flying Inkling tokens, bleeding opponent life totals while maneuvering through debate duels.',
      mechanics: ['Inkling Tokens', 'Debate Triggers', 'Life Drain'],
    },
    UR: {
      name: 'Prismari Expression (UR)',
      headline: 'Kinetic Artistry • 5+ Mana Big Spells & Dramatic Velocity',
      description: 'Blue-Red unleashes flamboyant kinetic sorceries, using spell velocity and treasure ramp to cast high-mana elemental masterworks.',
      mechanics: ['5+ Mana Spells', 'Spell Velocity', 'Elemental Arts'],
    },
    BG: {
      name: 'Witherbloom Herbalism (BG)',
      headline: 'Essence Extraction • Pest Swarms & Vitality Cycles',
      description: 'Black-Green brews potions and cultivates Pest tokens, draining life essence from the living to nourish necrotic growth and graveyard recursion.',
      mechanics: ['Pest Tokens', 'Life Essence', 'Attrition'],
    },
    RW: {
      name: 'Lorehold Excavation (RW)',
      headline: 'Archaeology • Spirit Legions & Ancient Relics',
      description: 'Red-White unearths historical relics and awakens Spirit armies, recurring artifacts and historical permanents from the graveyard into relentless attacks.',
      mechanics: ['Relic Recursion', 'Spirit Legions', 'Excavation'],
    },
    GU: {
      name: 'Quandrix Numerology (GU)',
      headline: 'Fractal Scale • Geometric Growth & Exponential Big Mana',
      description: 'Green-Blue solves the equations of the multiverse, generating geometric Fractal tokens that scale exponentially alongside big mana ramp.',
      mechanics: ['Fractal Scale', 'Doubling Counters', 'Exponential Ramp'],
    },
  },

  // Outlaws of Thunder Junction (OTJ)
  OTJ: {
    WU: {
      name: 'Azorius (WU)',
      headline: 'Plot & Patience • "No Spells Cast" Trigger Payoffs',
      description: 'White-Blue rewards plotting spells into future turns. Casting no spells from your hand on your turn activates massive bonuses on end step.',
      mechanics: ['Plot', 'No Spells Cast', 'Tempo Control'],
    },
    UB: {
      name: 'Dimir (UB)',
      headline: 'Crime & Sabotage • Targeting Opponents & Blackmail',
      description: 'Blue-Black commits crimes by targeting opponents, their spells, or their permanents. Committing a crime each turn unlocks card draw and stat buffs.',
      mechanics: ['Crimes (Target Opponent)', 'Saboteurs', 'Control'],
    },
    BR: {
      name: 'Rakdos (BR)',
      headline: 'Outlaws United • Assassins, Mercenaries, Pirates, Rogues & Warlocks',
      description: 'Black-Red bands the five outlaw creature types together for blistering aggro, removal, and explosive combat damage.',
      mechanics: ['Outlaws (5 Types)', 'Removal', 'Aggro'],
    },
    RG: {
      name: 'Gruul (RG)',
      headline: 'Ferocious Outlaws • 4+ Power Beatdown & Trample',
      description: 'Red-Green brings heavy muscle to Thunder Junction, trampling blockers with 4+ power bruisers and ferocious payoffs.',
      mechanics: ['4+ Power', 'Trample', 'Combat Pump'],
    },
    GW: {
      name: 'Selesnya (GW)',
      headline: 'Mounts & Vehicles • Saddling Up for Attack Triggers',
      description: 'Green-White saddles Mounts with willing riders, activating game-changing combat triggers and token generation.',
      mechanics: ['Mounts & Saddle', 'Attack Triggers', 'Tokens'],
    },
    WB: {
      name: 'Orzhov (WB)',
      headline: 'Reanimation & Drain • Gang Loyalty & Grave Attrition',
      description: 'White-Black recurs fallen outlaws from the graveyard and drains opponent life totals through calculated attrition.',
      mechanics: ['Reanimation', 'Life Drain', 'Death Triggers'],
    },
    UR: {
      name: 'Izzet (UR)',
      headline: 'Two-Spell Velocity • Double-Barreled Spellcasting',
      description: 'Blue-Red rewards casting two or more spells in a single turn, chaining cheap plotted cards with burn spells for double the impact.',
      mechanics: ['Cast 2+ Spells/Turn', 'Plot Velocity', 'Burn'],
    },
    BG: {
      name: 'Golgari (BG)',
      headline: 'Deserts & Graveyard • Recycling the Badlands',
      description: 'Black-Green turns desert lands and graveyard recursion into steady card advantage, grinding opponents down with poisonous patience.',
      mechanics: ['Deserts', 'Graveyard Recursion', 'Deathtouch'],
    },
    RW: {
      name: 'Boros (RW)',
      headline: 'Mercenary Tokens • Go-Wide Aggro & Power Pump',
      description: 'Red-White creates 1/1 Mercenary tokens with "{T}: Target creature gets +1/+0", stacking buffs on primary attackers for lethal strikes.',
      mechanics: ['Mercenary Tokens (+1/+0)', 'Go-Wide Aggro', 'First Strike'],
    },
    GU: {
      name: 'Simic (GU)',
      headline: 'Plot & Big Ramp • Heavy Payoffs Ahead of Curve',
      description: 'Green-Blue plots expensive spells into exile, setting up turns where you cast multiple high-impact bombs while ramping lands.',
      mechanics: ['Plot', 'Land Ramp', 'Big Spells'],
    },
  },
};

/**
 * Standard WOTC Guild Archetype Baseline for any MTG set.
 */
const DEFAULT_GUILD_WOTC_ARCHETYPES: Record<string, { name: string; headline: string; description: string; mechanics: string[] }> = {
  WU: {
    name: 'Azorius (White/Blue)',
    headline: 'Aerial Superiority • Flying Creatures & Defensive Tempo',
    description: 'Wizards of the Coast designs White-Blue around evasive flying threats supported by countermagic, bouncing blockers, and protective defensive tricks.',
    mechanics: ['Flying', 'Blink / Bounce', 'Tempo & Counterspells'],
  },
  UB: {
    name: 'Dimir (Blue/Black)',
    headline: 'Sabotage & Control • Card Advantage, Removal & Graveyard Value',
    description: 'Blue-Black excels at disruption, using efficient black removal and blue counterspells to clear threats while saboteur creatures draw extra cards.',
    mechanics: ['Targeted Removal', 'Card Advantage', 'Saboteur Combat'],
  },
  BR: {
    name: 'Rakdos (Black/Red)',
    headline: 'Aggression & Sacrifice • High Damage, Burn & Morbid Triggers',
    description: 'Black-Red prioritizes relentless offensive speed, using cheap aggressive creatures and sacrificial synergies to burn through opposing life totals.',
    mechanics: ['Sacrifice Fodder', 'Direct Burn', 'Fast Aggro'],
  },
  RG: {
    name: 'Gruul (Red/Green)',
    headline: 'Primal Stompy • 4+ Power Creatures & Trample Pressure',
    description: 'Red-Green ramps into massive, high-stat creatures with trample and haste, forcing opponents into losing combat trades.',
    mechanics: ['4+ Power Threshold', 'Mana Ramp', 'Trample Beatdown'],
  },
  GW: {
    name: 'Selesnya (Green/White)',
    headline: 'Go-Wide Swarm • Creature Tokens & +1/+1 Anthems',
    description: 'Green-White floods the battlefield with multiple small creatures and tokens, then buffs the entire army with permanent +1/+1 counters and anthem effects.',
    mechanics: ['Creature Tokens', '+1/+1 Counters', 'Anthem Buffs'],
  },
  WB: {
    name: 'Orzhov (White/Black)',
    headline: 'Aristocrats & Bleed • Death Triggers & Life Total Drain',
    description: 'White-Black grinds out value through death triggers and incremental drain, profiting every time a creature leaves the battlefield.',
    mechanics: ['Aristocrats', 'Life Gain & Drain', 'Graveyard Recursion'],
  },
  UR: {
    name: 'Izzet (Blue/Red)',
    headline: 'Spellslinger Velocity • Instant/Sorcery Chaining & Prowess',
    description: 'Blue-Red rewards chaining multiple noncreature spells in a single turn, triggering prowess buffs, card draw, and targeted burn.',
    mechanics: ['Instants & Sorceries', 'Prowess / Velocity', 'Burn & Draw'],
  },
  BG: {
    name: 'Golgari (Black/Green)',
    headline: 'Graveyard Attrition • Morbid Recycling & Deathtouch Midrange',
    description: 'Black-Green treats the graveyard as an extension of the hand, milling cards to recur bombs and deploying deathtouch blockers to stall aggressive decks.',
    mechanics: ['Self-Mill', 'Graveyard Recursion', 'Deathtouch Attrition'],
  },
  RW: {
    name: 'Boros (Red/White)',
    headline: 'Go-Wide Aggro • Equipment, Valiant & Fast Attack Triggers',
    description: 'Red-White curves out with low-mana attackers, using combat tricks, equipment, and attack-phase bonuses to end games before opponents establish control.',
    mechanics: ['Fast Curve', 'Equipment & Combat Tricks', 'Attack Triggers'],
  },
  GU: {
    name: 'Simic (Green/Blue)',
    headline: 'Ramp & Growth • Extra Lands, Big Mana & Card Flow',
    description: 'Green-Blue accelerates extra lands onto the battlefield, translating excess mana into colossal late-game threats and recurring card draw.',
    mechanics: ['Land Ramp', 'Big Mana Monsters', 'Card Draw'],
  },
};

/**
 * Resolves the WOTC supported archetypes for a given MTG set.
 * Returns only the intentionally designed/supported archetypes (e.g. 5 for Strixhaven, 10 for standard sets).
 */
export function getWOTCArchetypesForSet(setCode: string, cards: Card[]): WOTCArchetype[] {
  const upperCode = (setCode || '').toUpperCase().trim();
  const developedCodes = getDevelopedArchetypeCodes(upperCode, cards);
  const curatedSet = SET_WOTC_ARCHETYPES[upperCode] || {};

  const archetypes: WOTCArchetype[] = [];

  GUILD_ARCHETYPES.forEach((guild) => {
    // Check if this pair is supported/developed for the set
    if (!developedCodes.has(guild.code)) return;

    const curated = curatedSet[guild.code] || DEFAULT_GUILD_WOTC_ARCHETYPES[guild.code];

    archetypes.push({
      code: guild.code,
      colors: guild.colors,
      name: curated ? curated.name : guild.name,
      headline: curated ? curated.headline : guild.defaultTheme,
      description: curated ? curated.description : `WOTC designed ${guild.name} around ${guild.defaultTheme}.`,
      mechanics: curated ? curated.mechanics : ['Synergy', 'Combat'],
    });
  });

  return archetypes;
}

/**
 * Finds signpost cards (2-color uncommons or specific archetype tag cards)
 * that anchor a specific archetype in the set.
 */
export function getSignpostsForArchetype(archetypeCode: string, cards: Card[]): Card[] {
  const guild = GUILD_ARCHETYPES.find((g) => g.code === archetypeCode);
  if (!guild || !cards || cards.length === 0) return [];

  const [c1, c2] = guild.colors;

  // 1. First priority: 2-color uncommons of this exact color pair
  const uncommonGold = cards.filter((c) => {
    const colors = c.colors || [];
    return (
      c.rarity === 'uncommon' &&
      colors.length === 2 &&
      colors.includes(c1) &&
      colors.includes(c2)
    );
  });

  if (uncommonGold.length > 0) return uncommonGold;

  // 2. Second priority: any gold cards of this exact color pair (rare/common)
  const allGold = cards.filter((c) => {
    const colors = c.colors || [];
    return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
  });

  return allGold;
}
