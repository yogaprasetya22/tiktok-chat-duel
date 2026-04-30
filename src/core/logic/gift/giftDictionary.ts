import { UnitRarity } from "../../domain/unit.types";

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
    spawn_tier: number;
    picture?: string;

    // New: Unit composition for this gift (optional, uses defaults from tier if not specified)
    composition?: UnitCompositionEntry[];

    // New: Unit properties (naming, scale, stats) (optional, uses defaults from tier if not specified)
    unitProperties?: GiftUnitProperties;

    // Kept for compatibility: total count (sum of composition.count)
    spawn_count: number;
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

export const GIFT_FORMATIONS: Record<string, GiftFormation> = {
    // 🟢 TIER 1: BASIC SWARMS (Mulai dari Kroco yang overpower)
    kroco_swarm: {
        id: "kroco_swarm",
        name: "Kroco Militia",
        description: "8 Common Fighters + 2 Common Assassins",
        rules: [
            { unitClass: "fighter", count: 8, rarity: "common" },
            { unitClass: "assassin", count: 2, rarity: "common" },
        ],
    },
    shield_wall: {
        id: "shield_wall",
        name: "Phalanx Defense",
        description: "3 Elite Tanks + 2 Common Mages",
        rules: [
            { unitClass: "tank", count: 3, rarity: "elite" },
            { unitClass: "mage", count: 2, rarity: "common" },
        ],
    },
    ranger_patrol: {
        id: "ranger_patrol",
        name: "Forest Rangers",
        description: "4 Common Marksman + 1 Elite Fighter",
        rules: [
            { unitClass: "marksman", count: 4, rarity: "common" },
            { unitClass: "fighter", count: 1, rarity: "elite" },
        ],
    },

    // 🔵 TIER 2: INTERMEDIATE FORCES (Pasukan khusus)
    assassin_squad: {
        id: "assassin_squad",
        name: "Shadow Strike",
        description: "4 Elite Assassins + 1 Epic Assassin",
        rules: [
            { unitClass: "assassin", count: 4, rarity: "elite" },
            { unitClass: "assassin", count: 1, rarity: "epic" },
        ],
    },
    mage_artillery: {
        id: "mage_artillery",
        name: "Arcane Barrage",
        description: "3 Epic Mages + 2 Elite Tanks",
        rules: [
            { unitClass: "mage", count: 3, rarity: "epic" },
            { unitClass: "tank", count: 2, rarity: "elite" },
        ],
    },
    sniper_nest: {
        id: "sniper_nest",
        name: "Sharpshooter Den",
        description: "4 Epic Marksman + 1 Elite Tank",
        rules: [
            { unitClass: "marksman", count: 4, rarity: "epic" },
            { unitClass: "tank", count: 1, rarity: "elite" },
        ],
    },
    berserker_gang: {
        id: "berserker_gang",
        name: "Rage Inducers",
        description: "5 Epic Fighters + 1 Elite Assassin",
        rules: [
            { unitClass: "fighter", count: 5, rarity: "epic" },
            { unitClass: "assassin", count: 1, rarity: "elite" },
        ],
    },

    // 🟣 TIER 3: ADVANCED ELITES (Petinggi kerajaan & jendral)
    royal_guard: {
        id: "royal_guard",
        name: "King's Shield",
        description: "3 Epic Tanks + 2 Epic Mages + 1 Legendary Fighter",
        rules: [
            { unitClass: "tank", count: 3, rarity: "epic" },
            { unitClass: "mage", count: 2, rarity: "epic" },
            { unitClass: "fighter", count: 1, rarity: "legendary" },
        ],
    },
    death_squad: {
        id: "death_squad",
        name: "Grim Reapers",
        description: "2 Legendary Assassins + 3 Epic Marksman",
        rules: [
            { unitClass: "assassin", count: 2, rarity: "legendary" },
            { unitClass: "marksman", count: 3, rarity: "epic" },
        ],
    },
    dragon_slayers: {
        id: "dragon_slayers",
        name: "Beast Hunters",
        description: "3 Legendary Marksman + 2 Epic Tanks",
        rules: [
            { unitClass: "marksman", count: 3, rarity: "legendary" },
            { unitClass: "tank", count: 2, rarity: "epic" },
        ],
    },
    arcane_council: {
        id: "arcane_council",
        name: "Supreme Wizards",
        description: "3 Legendary Mages + 2 Epic Tanks",
        rules: [
            { unitClass: "mage", count: 3, rarity: "legendary" },
            { unitClass: "tank", count: 2, rarity: "epic" },
        ],
    },

    // 🟡 TIER 4: GOD CLASS & BOSSES (Kiamat skala kecil)
    boss_arrival: {
        id: "boss_arrival",
        name: "Titan Fall",
        description: "1 Legendary Boss + 2 Legendary Tanks",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "tank", count: 2, rarity: "legendary" },
        ],
    },
    doomsday_legion: {
        id: "doomsday_legion",
        name: "Apocalypse Bringers",
        description: "1 Legendary Boss + 2 Legendary Mages + 3 Epic Fighters",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "mage", count: 2, rarity: "legendary" },
            { unitClass: "fighter", count: 3, rarity: "epic" },
        ],
    },
    shadow_monarch: {
        id: "shadow_monarch",
        name: "Lord of Shadows",
        description: "1 Legendary Boss + 4 Legendary Assassins",
        rules: [
            { unitClass: "boss", count: 1, rarity: "legendary" },
            { unitClass: "assassin", count: 4, rarity: "legendary" },
        ],
    },
};

export const GIFT_DICTIONARY: GiftDictionary = {
    rose: {
        name: "Rose",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    },
    gg: {
        name: "GG",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3f02fa9594bd1495ff4e8aa5ae265eef~tplv-obj.webp",
    },
    pop: {
        name: "Pop",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0b4f61e8ab637f11449300d03929ef87.png~tplv-obj.webp",
    },
    creeper: {
        name: "Creeper",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d686d45bd66e16b0aca8b0e5eb52a977.png~tplv-obj.webp",
    },
    youre_awesome: {
        name: "You're awesome",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e9cafce8279220ed26016a71076d6a8a.png~tplv-obj.webp",
    },
    love_you_so_much: {
        name: "Love you so much",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fc549cf1bc61f9c8a1c97ebab68dced7.png~tplv-obj.webp",
    },
    tiktok: {
        name: "TikTok",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.webp",
    },
    wink_wink: {
        name: "Wink wink",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4a68411b3e92fc2bf68d458d5f906b74.png~tplv-obj.webp",
    },
    ice_cream_cone: {
        name: "Ice Cream Cone",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/968820bc85e274713c795a6aef3f7c67~tplv-obj.webp",
    },
    glow_stick: {
        name: "Glow Stick",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8e1a5d66370c5586545e358e37c10d25~tplv-obj.webp",
    },
    freestyle: {
        name: "Freestyle",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1f5ca5cfb4b98c2761fb85987f47c641.png~tplv-obj.webp",
    },
    cake_slice: {
        name: "Cake Slice",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f681afb4be36d8a321eac741d387f1e2~tplv-obj.webp",
    },
    oldies: {
        name: "Oldies",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/77f6ab69b0b03bda98a0a3d2bfdeb46f.png~tplv-obj.webp",
    },
    heart_me: {
        name: "Heart Me",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.webp",
    },
    so_cute: {
        name: "So Cute",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d40d31241efcf57c630e894bb3007b8a.png~tplv-obj.webp",
    },
    placeholder: {
        name: "Placeholder",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
    },
    coffee: {
        name: "Coffee",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/02492214b9bd50fee2d69fd0d089c025~tplv-obj.webp",
    },
    orange_juice: {
        name: "Orange Juice",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/7244832db46b7ea5d7d6e280719ddea2~tplv-obj.webp",
    },
    thumbs_up: {
        name: "Thumbs Up",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/570a663e27bdc460e05556fd1596771a~tplv-obj.webp",
    },
    heart: {
        name: "Heart",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dd300fd35a757d751301fba862a258f1~tplv-obj.webp",
    },
    love_you: {
        name: "Love you",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/ab0a7b44bfc140923bb74164f6f880ab~tplv-obj.webp",
    },
    fairy_wings: {
        name: "Fairy wings",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e504dc2f313b8c6df9e99a848e1b3a99.png~tplv-obj.webp",
    },
    headphone: {
        name: "Headphone",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d250b93197c151c45a08ab5f4db805d6.png~tplv-obj.webp",
    },
    blow_a_kiss: {
        name: "Blow a kiss",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/cdb55940740d5c83879b2934f9a7d08e.png~tplv-obj.webp",
    },
    power_hug: {
        name: "Power hug",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/9578adce6e3da2d211583212bdfd1b0e.png~tplv-obj.webp",
    },
    congratulations: {
        name: "Congratulations",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8e73d843b23a9e68f8d3cf8c46fc0bee.png~tplv-obj.webp",
    },
    fried: {
        name: "Fried",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/003103053dbf1fc8c01a81fcec61a28a.png~tplv-obj.webp",
    },
    music_album: {
        name: "Music Album",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
    },
    wink_charm: {
        name: "Wink Charm",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/295d753e095c6ac8b180691f20d64ea8.png~tplv-obj.webp",
    },
    go_popular: {
        name: "Go Popular",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b342e28d73dac6547e0b3e2ad57f6597.png~tplv-obj.webp",
    },
    club_cheers: {
        name: "Club Cheers",
        coin_value: 1,
        spawn_tier: 1,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6a934c90e5533a4145bed7eae66d71bd.png~tplv-obj.webp",
    },

    team_bracelet: {
        name: "Team Bracelet",
        coin_value: 2,
        spawn_tier: 1,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp",
    },

    finger_heart: {
        name: "Finger Heart",
        coin_value: 5,
        spawn_tier: 2,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp",
    },
    overreact: {
        name: "Overreact",
        coin_value: 5,
        spawn_tier: 2,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dfd48ef1952b6d315856adda7705d02d.png~tplv-obj.webp",
    },
    name_shoutout: {
        name: "Name shoutout",
        coin_value: 5,
        spawn_tier: 2,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9b1d432109c95e77e8de11dd442c0a1f.png~tplv-obj.webp",
    },
    duit_raya: {
        name: "Duit Raya",
        coin_value: 5,
        spawn_tier: 2,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/af543ee556c1c3d3e2610a24d8d02c94~tplv-obj.webp",
    },
    padang_rice: {
        name: "Padang Rice",
        coin_value: 5,
        spawn_tier: 2,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/bd6e927cd68db696f2a27d4e2c7d0c34.png~tplv-obj.webp",
    },

    super_popular: {
        name: "Super Popular",
        coin_value: 9,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2fa794a99919386b85402d9a0a991b2b.png~tplv-obj.webp",
    },
    cheer_you_up: {
        name: "Cheer You Up",
        coin_value: 9,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/97e0529ab9e5cbb60d95fc9ff1133ea6~tplv-obj.webp",
    },
    club_power: {
        name: "Club Power",
        coin_value: 9,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/fb8da877eabca4ae295483f7cdfe7d31.png~tplv-obj.webp",
    },

    rosa: {
        name: "Rosa",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp",
    },
    friendship_necklace: {
        name: "Friendship Necklace",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e033c3f28632e233bebac1668ff66a2f.png~tplv-obj.webp",
    },
    journey_pass: {
        name: "Journey Pass",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/551ecaf639c5e02354f9e7c1a763ec72.png~tplv-obj.webp",
    },
    slow_motion: {
        name: "Slow motion",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/12374117770f779919bf002461fdfac0.png~tplv-obj.webp",
    },
    chocolate: {
        name: "Chocolate",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8e8bfebfad922eed81f4a31a114fc0d3.png~tplv-obj.webp",
    },
    lucky_pony: {
        name: "Lucky Pony",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8d005c54c988a6353777ce9c06cfb9cc.png~tplv-obj.webp",
    },
    league_ball: {
        name: "League Ball",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/85e79c76fd9b5ded418565427a67f424.png~tplv-obj.webp",
    },
    i_love_you: {
        name: "I love you",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/beaaa3a78a00b5b20661b00924ab0e7f~tplv-obj.webp",
    },
    style_me_up: {
        name: "Style Me Up",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b676cd3356e7dc11d4dad13fed18d29e.png~tplv-obj.webp",
    },
    heart_gaze: {
        name: "Heart Gaze",
        coin_value: 10,
        spawn_tier: 2,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/0fe120fdb52724dd157e41cc5c00a924.png~tplv-obj.webp",
    },

    bravo: {
        name: "Bravo!",
        coin_value: 15,
        spawn_tier: 3,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/075e206d6da035f10ff5f8fecd82abcc.png~tplv-obj.webp",
    },
    perfume: {
        name: "Perfume",
        coin_value: 20,
        spawn_tier: 3,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp",
    },
    doughnut: {
        name: "Doughnut",
        coin_value: 30,
        spawn_tier: 3,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",
    },
    bouquet_flower: {
        name: "Bouquet Flower",
        coin_value: 30,
        spawn_tier: 3,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b158b8493b51a3f30c59710c39d1dc96~tplv-obj.webp",
    },

    paper_crane: {
        name: "Paper Crane",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/0f158a08f7886189cdabf496e8a07c21~tplv-obj.webp",
    },
    little_crown: {
        name: "Little Crown",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cf3db11b94a975417043b53401d0afe1~tplv-obj.webp",
    },
    cap: {
        name: "Cap",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6c2ab2da19249ea570a2ece5e3377f04~tplv-obj.webp",
    },
    hat_and_mustache: {
        name: "Hat and Mustache",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/2f1e4f3f5c728ffbfa35705b480fdc92~tplv-obj.webp",
    },
    like_pop: {
        name: "Like-Pop",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/75eb7b4aca24eaa6e566b566c7d21e2f~tplv-obj.webp",
    },
    cupids_bow: {
        name: "Cupid's Bow",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
    },
    love_painting: {
        name: "Love Painting",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/de6f01cb2a0deb2da24cb5d1ecf9a23b.png~tplv-obj.webp",
    },
    bubble_gum: {
        name: "Bubble Gum",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/52ebbe9f3f53b5567ad11ad6f8303c58.png~tplv-obj.webp",
    },
    mark_of_love: {
        name: "Mark of Love",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/582475419a820e0b0dbc964799b6146e.png~tplv-obj.webp",
    },
    batik_bucket_hat: {
        name: "Batik Bucket Hat",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3247fb4f03d2dafb7417ab980c12438e.png~tplv-obj.webp",
    },
    sundae_bowl: {
        name: "Sundae Bowl",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/725ba28c17d775db510ca7b240cdd84e.png~tplv-obj.webp",
    },
    charmer_bow: {
        name: "Charmer Bow",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3cbe9384885eab12ace419cc4f28cf4f.png~tplv-obj.webp",
    },
    club_victory: {
        name: "Club Victory",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6639eb3590a59052babc9cb772ae4f5b.png~tplv-obj.webp",
    },
    level_up_sparks: {
        name: "Level-up Sparks",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/c6c5b0efea6f1f7e1fd1f3909284d12c.png~tplv-obj.webp",
    },
    greeting_heart: {
        name: "Greeting Heart",
        coin_value: 99,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9325524bd9ca181bd8e76eb99b44c042.png~tplv-obj.webp",
    },

    game_controller: {
        name: "Game Controller",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20ec0eb50d82c2c445cb8391fd9fe6e2~tplv-obj.webp",
    },
    super_gg: {
        name: "Super GG",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/cbd7588c53ec3df1af0ed6d041566362.png~tplv-obj.webp",
    },
    mishka_bear: {
        name: "Mishka Bear",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d78ed6496fd57286b42ac033acbee299.png~tplv-obj.webp",
    },
    confetti: {
        name: "Confetti",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp",
    },
    hand_hearts: {
        name: "Hand Hearts",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6cd022271dc4669d182cad856384870f~tplv-obj.webp",
    },
    chicken_and_cola: {
        name: "Chicken and Cola",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/21f59a5f320712ab4a6d5f28ba618ffd.png~tplv-obj.webp",
    },
    bouquet: {
        name: "Bouquet",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1bdf0b38142a94af0f71ea53da82a3b1.png~tplv-obj.webp",
    },
    singing_magic: {
        name: "Singing Magic",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1b76de4373dec56480903c3d5367fd13.png~tplv-obj.webp",
    },
    marvelous_confetti: {
        name: "Marvelous Confetti",
        coin_value: 100,
        spawn_tier: 4,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/fccc851d351716bc8b34ec65786c727d~tplv-obj.webp",
    },

    bowknot: {
        name: "Bowknot",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dd02c4c2cb726134314e89abec0b5476.png~tplv-obj.webp",
    },
    big_shout_out: {
        name: "Big Shout Out",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d79737225a5c68dee52b34d1a7c7dec9.png~tplv-obj.webp",
    },
    chatting_popcorn: {
        name: "Chatting Popcorn",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f4813ddce6a6b3268df01af9fe3764d9.png~tplv-obj.webp",
    },
    masquerade: {
        name: "Masquerade",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8fde56ae6a7ea22d3d17184ac362585f.png~tplv-obj.webp",
    },
    balloon_crown: {
        name: "Balloon Crown",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d1cc3f587941bd7af50929aee49ac070.png~tplv-obj.webp",
    },
    feather_tiara: {
        name: "Feather Tiara",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/23a0d8c3317d8be5e5a63488a7b2b8c4.png~tplv-obj.webp",
    },
    caterpillar_chaos: {
        name: "Caterpillar Chaos",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5fc71d8f491568b0e258e2de1718e37c.png~tplv-obj.webp",
    },
    catrina: {
        name: "Catrina",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fadb0050e89ad6a1731c1a4742360846.png~tplv-obj.webp",
    },
    raving_snail: {
        name: "Raving Snail",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ef4e1229a2f0b67f7d4e92b508667060.png~tplv-obj.webp",
    },
    santa_cocoa: {
        name: "Santa Cocoa",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8d188b6a7cfd7b98f778f18302a8f7f4.png~tplv-obj.webp",
    },
    love_glasses: {
        name: "Love Glasses",
        coin_value: 149,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7b3f141efe8a943faba19f855a003943.png~tplv-obj.webp",
    },

    song_of_harvest: {
        name: "Song of Harvest",
        coin_value: 150,
        spawn_tier: 5,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8af5604b926b8d045246d25d4de24550.png~tplv-obj.webp",
    },

    league_countdown: {
        name: "League Countdown",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/936d94c2e9267c3fa099127fba4e30a2.png~tplv-obj.webp",
    },
    sunglasses: {
        name: "Sunglasses",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/08af67ab13a8053269bf539fd27f3873.png~tplv-obj.webp",
    },
    hearts: {
        name: "Hearts",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/934b5a10dee8376df5870a61d2ea5cb6.png~tplv-obj.webp",
    },
    garland_headpiece: {
        name: "Garland Headpiece",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/bdbdd8aeb2b69c173a3ef666e63310f3~tplv-obj.webp",
    },
    love_you_199: {
        name: "Love You",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/134e51c00f46e01976399883ca4e4798~tplv-obj.webp",
    },
    pinch_cheek: {
        name: "Pinch Cheek",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d1c75692e369466b4fd23546e513caed~tplv-obj.webp",
    },
    cheer_for_you: {
        name: "Cheer For You",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/1059dfa76c78dc17d7cf0a1fc2ece185~tplv-obj.webp",
    },
    the_crown: {
        name: "The Crown",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5bf798f92fe96ba53c0f4d28f052f9bb~tplv-obj.webp",
    },
    stinging_bee: {
        name: "Stinging Bee",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/c37b8f76d503f5787407a8d7c52f8cb7.png~tplv-obj.webp",
    },
    massage_for_you: {
        name: "Massage for You",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3ebdd3746d91eb06bdd4a04c49c3b04a.png~tplv-obj.webp",
    },
    coffee_magic: {
        name: "Coffee Magic",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/0cb623f44c34f77fe14c2e11bfe4ee62.png~tplv-obj.webp",
    },
    cheering_crab: {
        name: "Cheering Crab",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/7d729b6a8104f5d349ba887608cd35bc.png~tplv-obj.webp",
    },
    dancing_hands: {
        name: "Dancing Hands",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d5d829bbca08bd500317991fbaa84bc3.png~tplv-obj.webp",
    },
    floating_octopus: {
        name: "Floating Octopus",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/022d496f79aa50d3042f0660d37ed48a.png~tplv-obj.webp",
    },
    flower_headband: {
        name: "Flower Headband",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/eaec5f24e45bc66ec44830fa5024ab45.png~tplv-obj.webp",
    },
    goalkeeper_save: {
        name: "Goalkeeper Save",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/92a80ca0eef371f0b7ae70f76f0f29d5.png~tplv-obj.webp",
    },
    sour_buddy: {
        name: "Sour Buddy",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/963e12ba84805721d96b06deaf5d660b.png~tplv-obj.webp",
    },
    rose_hand: {
        name: "Rose Hand",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/805e6b8051d50ca6e6c9b74d5fc89045.png~tplv-obj.webp",
    },
    indoor_fan: {
        name: "Indoor Fan",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d7a39c48861a021d99523bc89af99df0.png~tplv-obj.webp",
    },
    melon_juice: {
        name: "Melon Juice",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/912d29e708fe00d72487908114803e77.png~tplv-obj.webp",
    },
    coconut_juice: {
        name: "Coconut Juice",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8157f47f794c8395969034574dd12082.png~tplv-obj.webp",
    },
    chirpy_kisses: {
        name: "Chirpy Kisses",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c75ec50c453f5b09e4d25c5c69c30ed5.png~tplv-obj.webp",
    },
    side_by_side: {
        name: "Side by Side",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/14b52e1933131d94a2634acf1625559d.png~tplv-obj.webp",
    },
    juicy_smile: {
        name: "Juicy Smile",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b897b374103a142ce550afec4c54d9aa.png~tplv-obj.webp",
    },
    joker_ball: {
        name: "Joker Ball",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4227bdbc22921d8cdceb3ab14366624d.png~tplv-obj.webp",
    },
    heart_hood: {
        name: "Heart Hood",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/79801ad5ce9f4a97793be5b06ac6804b.png~tplv-obj.webp",
    },
    party_pony: {
        name: "Party Pony",
        coin_value: 199,
        spawn_tier: 5,
        spawn_count: 2,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/07c5a2297a00cacc94d329d047d045c8.png~tplv-obj.webp",
    },

    diamond_heart_necklace: {
        name: "Diamond Heart necklace",
        coin_value: 200,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9651f80586431e85dbf4d96c067b22f9.png~tplv-obj.webp",
    },
    gold_necklace: {
        name: "Gold necklace",
        coin_value: 200,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/21549ba24f76a01d00373cb8e35660ae.png~tplv-obj.webp",
    },
    balloons: {
        name: "Balloons",
        coin_value: 200,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/49d51360108c4ff1770f2d7c59d7d7cb.png~tplv-obj.webp",
    },
    magic_genie: {
        name: "Magic Genie",
        coin_value: 200,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c750548817a633185d2c46391cc64214.png~tplv-obj.webp",
    },

    rose_bear: {
        name: "Rose Bear",
        coin_value: 214,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/adf6e9bd6219788151edb9fa026a0481.png~tplv-obj.webp",
    },
    cat: {
        name: "Cat",
        coin_value: 222,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ed64975b4e809224ec3dffc616840205.png~tplv-obj.webp",
    },

    pinch_face: {
        name: "Pinch Face",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/a10aab8940d3d5aee14b14cde033ab2a.png~tplv-obj.webp",
    },
    candy_bouquet: {
        name: "Candy Bouquet",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/13a78105483d213723d66d7fbf308001.png~tplv-obj.webp",
    },
    ice_cream_mic: {
        name: "Ice Cream Mic",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7f784d1ec7b26d7d8cfd05faede11d76.png~tplv-obj.webp",
    },
    star_goggles: {
        name: "Star Goggles",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e14483e67a44ce522ba583ec923941fa.png~tplv-obj.webp",
    },
    cheer_mic: {
        name: "Cheer Mic",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cf2c95f9642541fa9ebe9bdcfe6e7359.png~tplv-obj.webp",
    },
    music_bubbles: {
        name: "Music Bubbles",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b5786e09eb50f1ea512b2ae9f7034254.png~tplv-obj.webp",
    },
    palm_breeze: {
        name: "Palm Breeze",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dc8043965da9348b305de279cb2fb451.png~tplv-obj.webp",
    },
    forest_elf: {
        name: "Forest Elf",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1aeb39ecbb493ea520e23588df61caa1.png~tplv-obj.webp",
    },
    face_pulling: {
        name: "Face-pulling",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fbbe8af4280240dfdb11ad1100be0282.png~tplv-obj.webp",
    },
    treasured_voice: {
        name: "Treasured Voice",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/99bb73b9eb5851a2bcafadb6fe9a9815.png~tplv-obj.webp",
    },
    melodic_birds: {
        name: "Melodic birds",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/345514d111481a58d76bd53c42f0445d.png~tplv-obj.webp",
    },
    surfing_penguin: {
        name: "Surfing Penguin",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f13a3c11c4156fe89397c66300d6ce20.png~tplv-obj.webp",
    },
    party_blossom: {
        name: "Party Blossom",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3065f931274a9c1e6d4cdd0b29ff3c8d.png~tplv-obj.webp",
    },
    dreamy_strings: {
        name: "Dreamy Strings",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/68e68d79a6ad382321c9cbdee966c025.png~tplv-obj.webp",
    },
    sweet_flutter: {
        name: "Sweet Flutter",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f70e199a23a5ff232ce241d07c3dc99b.png~tplv-obj.webp",
    },
    snow_bloom: {
        name: "Snow Bloom",
        coin_value: 249,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8384e240d21a75fd1084e6f9da833ab6.png~tplv-obj.webp",
    },

    tiny_diny_float: {
        name: "Tiny Diny Float",
        coin_value: 250,
        spawn_tier: 6,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/07f2f1c77323dc05300d25723fc6453a.png~tplv-obj.webp",
    },

    live_ranking_crown: {
        name: "LIVE Ranking Crown",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1bb7f00a3adeb932e5f5518d723fedb5.png~tplv-obj.webp",
    },
    boxing_gloves: {
        name: "Boxing Gloves",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9f8bd92363c400c284179f6719b6ba9c~tplv-obj.webp",
    },
    corgi: {
        name: "Corgi",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/148eef0884fdb12058d1c6897d1e02b9~tplv-obj.webp",
    },
    fruit_friends: {
        name: "Fruit Friends",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1153dd51308c556cb4fcc48c7d62209f.png~tplv-obj.webp",
    },
    naughty_chicken: {
        name: "Naughty Chicken",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/46a839dbc1c3e9103c71d82b35b21ad4.png~tplv-obj.webp",
    },
    play_for_you: {
        name: "Play for You",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/34201b86430742595e4dcb5b39560b7a.png~tplv-obj.webp",
    },
    rock_star: {
        name: "Rock Star",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/57acaf0590c56c219493b71fe8d2961d.png~tplv-obj.webp",
    },
    butterfly_for_you: {
        name: "Butterfly for You",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e02af5a7d59a958bd38536f7e3473f75.png~tplv-obj.webp",
    },
    starlight_compass: {
        name: "Starlight Compass",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/239d5419829614a89000230ece14b287.png~tplv-obj.webp",
    },
    puppy_kisses: {
        name: "Puppy Kisses",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4ae998a21159b60484169864f8968ba9.png~tplv-obj.webp",
    },
    united_heart: {
        name: "United Heart",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/72ff280b8c6ce16f6efc9bf4cd6a036b.png~tplv-obj.webp",
    },
    kicker_challenge: {
        name: "Kicker Challenge",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8065704646452387f6bed049b194f214.png~tplv-obj.webp",
    },
    hi_rosie: {
        name: "Hi! Rosie!",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c5d90ed49d326785882decc35c4200b0.png~tplv-obj.webp",
    },
    pawfect: {
        name: "Pawfect",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/8710c33f4929aa91c7ec7154f5f90268.png~tplv-obj.webp",
    },
    go_hamster: {
        name: "Go Hamster",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/582131434f4f6edc3f97b96fbc33a492.png~tplv-obj.webp",
    },
    tiktok_crown: {
        name: "TikTok Crown",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/77289ae44d635380fa88e7bdfcfdc408.png~tplv-obj.webp",
    },
    bat_headwear: {
        name: "Bat Headwear",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1ba0996c3dd7db45807fd7f255eb66a4.png~tplv-obj.webp",
    },
    melody_glasses: {
        name: "Melody Glasses",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7e4e83b1f8746e2c3205e14f99eaae08.png~tplv-obj.webp",
    },
    penguin_snowpal: {
        name: "Penguin Snowpal",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/29828fedfc36982c9395822e9e5aab20.png~tplv-obj.webp",
    },
    music_mate: {
        name: "Music Mate",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/789d404702b42340359a4b5ea9366dbb.png~tplv-obj.webp",
    },
    love_call: {
        name: "Love Call",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b9f95b541fa21eb5325fd8f6ffe1a551.png~tplv-obj.webp",
    },
    pony_lantern: {
        name: "Pony Lantern",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/513e60117034e851dc6c923ea8a3125b.png~tplv-obj.webp",
    },
    spring_sprout: {
        name: "Spring Sprout",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b81807a156aad66d757bacffebae830f.png~tplv-obj.webp",
    },
    eid_gift_box: {
        name: "EID Gift Box",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ec3bedf704efdbbcfdfd36a99c98d94a.png~tplv-obj.webp",
    },
    budding_heart: {
        name: "Budding Heart",
        coin_value: 299,
        spawn_tier: 7,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/80cc308eca861fccd859c089b0647193.png~tplv-obj.webp",
    },

    diamond_ring_of_love: {
        name: "Diamond ring of love",
        coin_value: 300,
        spawn_tier: 8,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d623197cd4a72db871b3755b4ed6894c.png~tplv-obj.webp",
    },
    tambourine: {
        name: "Tambourine",
        coin_value: 300,
        spawn_tier: 8,
        spawn_count: 1,
    },
    feather_mask: {
        name: "Feather Mask",
        coin_value: 300,
        spawn_tier: 8,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/088bdb48e5051844d154948b4eb75e5f.png~tplv-obj.webp",
    },
    air_dancer: {
        name: "Air Dancer",
        coin_value: 300,
        spawn_tier: 8,
        spawn_count: 1,
        picture:
            "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/97c975dcce2483027ececde2b6719761.png~tplv-obj.webp",
    },
};

/**
 * Helper function to look up a gift by matching keywords
 * Returns the first matching gift definition or undefined
 */
export function lookupGiftByKeyword(
    giftName: string,
): GiftDefinition | undefined {
    const normalizedName = giftName.toLowerCase().replace(/\s+/g, "_");
    return GIFT_DICTIONARY[normalizedName];
}

/**
 * Helper function to get spawn count from gift dictionary
 * Falls back to 1 if gift not found
 */
export function getGiftSpawnCount(giftName: string): number {
    const gift = lookupGiftByKeyword(giftName);
    return gift?.spawn_count ?? 1;
}

/**
 * Helper function to get coin value from gift dictionary
 * Falls back to 1 if gift not found
 */
export function getGiftCoinValue(giftName: string): number {
    const gift = lookupGiftByKeyword(giftName);
    return gift?.coin_value ?? 1;
}

/**
 * Helper function to get spawn tier from gift dictionary
 * Useful for determining unit type/rarity
 */
export function getGiftSpawnTier(giftName: string): number {
    const gift = lookupGiftByKeyword(giftName);
    return gift?.spawn_tier ?? 1;
}
