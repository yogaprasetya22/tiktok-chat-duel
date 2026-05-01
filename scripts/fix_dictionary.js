const fs = require('fs');

// Data sources
const giftsExtracted = JSON.parse(fs.readFileSync('gifts_extracted.json', 'utf8'));
const allGiftsFromHtml = JSON.parse(fs.readFileSync('all_gifts_from_html.json', 'utf8'));

// Helper to decode basic HTML entities
const decodeEntities = (s) => {
    return s.replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
};

// Helper for normalization
const normalize = (name) => {
    return name.toLowerCase()
               .replace(/[^a-z0-9]+/g, '_')
               .replace(/^_+|_+$/g, '');
};

// Merge data
const masterDict = {};

// 1. Process gifts_extracted.json (name -> img)
Object.entries(giftsExtracted).forEach(([name, img]) => {
    const decodedName = decodeEntities(name);
    const key = normalize(decodedName);
    masterDict[key] = {
        name: decodedName,
        picture: img,
        coin_value: 1 // Default if not found in HTML
    };
});

// 2. Process all_gifts_from_html.json (richer data)
allGiftsFromHtml.forEach(g => {
    const decodedName = decodeEntities(g.name);
    const key = normalize(decodedName);
    
    if (masterDict[key]) {
        masterDict[key].coin_value = g.price;
        masterDict[key].picture = g.img; // Update if HTML has better/newer one
    } else {
        masterDict[key] = {
            name: decodedName,
            coin_value: g.price,
            picture: g.img
        };
    }
});

// Manual Additions (Common ones that might be missing or regional)
const manualAdditions = {
    "milk_tea": { name: "Milk Tea", coin_value: 1, picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp" }, // Using Team Bracelet as fallback for now if missing
    "boba": { name: "Boba", coin_value: 1, picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp" },
};

Object.entries(manualAdditions).forEach(([key, val]) => {
    if (!masterDict[key]) masterDict[key] = val;
});

// Generate TypeScript content
let output = `import { UnitRarity } from "../../domain/unit.types";

/**
 * Unit composition for a single spawned unit from a gift
 * Defines which class and how many of each to spawn
 */
export interface UnitCompositionEntry {
    class: "tank" | "marksman" | "mage" | "assassin" | "fighter";
    count: number;
}

/**
 * Properties for units spawned from a gift
 * Includes naming, scale, and stat multipliers
 */
export interface GiftUnitProperties {
    // Naming convention for units from this gift
    namePrefix: string; // e.g., "Rose", "Sky", "Fire" - prepended to unit name

    // Visual scale multiplier (1.0 = default size, 2.0 = 2x larger)
    scaleMultiplier: number;

    // Stats multipliers applied to spawned units
    statsMultiplier: {
        hp: number; // HP multiplier (1.0 = default)
        attack: number; // Attack multiplier
        defense: number; // Defense (physical + magic) multiplier
        speed: number; // Movement speed multiplier
    };
}

/**
 * Enhanced gift definition including unit composition and properties
 */
export interface GiftDefinition {
    name: string;
    coin_value: number;
    picture?: string;

    // New: Unit composition for this gift (optional, uses defaults from tier if not specified)
    composition?: UnitCompositionEntry[];

    // New: Unit properties (naming, scale, stats) (optional, uses defaults from tier if not specified)
    unitProperties?: GiftUnitProperties;
}

export interface GiftDictionary {
    [key: string]: GiftDefinition;
}

export interface SpawnRule {
    unitClass: "fighter" | "tank" | "mage" | "marksman" | "assassin" | "boss";
    count: number;
    rarity: UnitRarity;
}

export interface GiftFormation {
    id: string;
    name: string;
    description: string;
    rules: SpawnRule[];
}

export const DEFAULT_GIFT_PICTURE = "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/cdb55940740d5c83879b2934f9a7d08e.png~tplv-obj.webp";

export const GIFT_FORMATIONS: Record<string, GiftFormation> = {
    // 🔥 TIER 5: 1-COIN GOD MODE (Kiamat Instan dari 1 Koin)
    tier5_vanguard: {
        id: "tier5_vanguard",
        name: "Aegis Titan",
        description: "1 Legendary Boss + 3 Legendary Tanks",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "tank", count: 3, rarity: "legendary" },
        ],
    },
    tier5_artillery: {
        id: "tier5_artillery",
        name: "Meteor Shower",
        description: "4 Legendary Marksman + 1 Legendary Tank",
        rules: [
            { unitClass: "marksman", count: 4, rarity: "legendary" },
            { unitClass: "tank", count: 1, rarity: "legendary" },
        ],
    },
    tier5_sorcery: {
        id: "tier5_sorcery",
        name: "Cataclysmic Mages",
        description: "3 Legendary Mages + 2 Legendary Fighters",
        rules: [
            { unitClass: "mage", count: 3, rarity: "legendary" },
            { unitClass: "fighter", count: 2, rarity: "legendary" },
        ],
    },
    tier5_assassins: {
        id: "tier5_assassins",
        name: "Void Walkers",
        description: "5 Legendary Assassins",
        rules: [{ unitClass: "assassin", count: 5, rarity: "legendary" }],
    },
    tier5_berserkers: {
        id: "tier5_berserkers",
        name: "Warlord's March",
        description: "1 Legendary Boss + 4 Legendary Fighters",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "fighter", count: 4, rarity: "legendary" },
        ],
    },
    tier5_apocalypse: {
        id: "tier5_apocalypse",
        name: "The Exodia",
        description: "1 Boss + 1 Tank + 1 Mage + 1 Marksman + 1 Assassin",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "tank", count: 1, rarity: "legendary" },
            { unitClass: "mage", count: 1, rarity: "legendary" },
            { unitClass: "marksman", count: 1, rarity: "legendary" },
            { unitClass: "assassin", count: 1, rarity: "legendary" },
        ],
    },
    // 🔥 TIER 4: 100-COIN (ELITE SQUAD)
    tier4_vanguard: {
        id: "tier4_vanguard",
        name: "Royal Guard",
        description: "2 Epic Tanks + 3 Epic Fighters",
        rules: [
            { unitClass: "tank", count: 2, rarity: "epic" },
            { unitClass: "fighter", count: 3, rarity: "epic" },
        ],
    },
    // Add more tiers as needed or keep simple
};

export const GIFT_DICTIONARY: GiftDictionary = {`;

Object.keys(masterDict).sort().forEach(key => {
    const g = masterDict[key];
    output += `
    ${key}: {
        name: "${g.name}",
        coin_value: ${g.coin_value},
        picture: "${g.picture}",
    },`;
});

output += `
};

/**
 * Helper function to look up a gift by matching keywords
 * Returns the first matching gift definition or undefined
 */
export function lookupGiftByKeyword(
    giftName: string,
): GiftDefinition | undefined {
    if (!giftName) return undefined;
    const normalizedName = giftName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const gift = GIFT_DICTIONARY[normalizedName];
    
    if (gift) return gift;
    
    // If not found, return a fallback definition with the name and default picture
    return {
        name: giftName,
        coin_value: 1,
        picture: DEFAULT_GIFT_PICTURE
    };
}
`;

fs.writeFileSync('src/core/logic/gift/giftDictionary.ts', output);
console.log("Dictionary updated and fixed.");
