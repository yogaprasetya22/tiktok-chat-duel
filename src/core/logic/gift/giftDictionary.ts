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
    // 🔥 TIER 5: NERFED (Balancing for 4GB RAM & Gameplay Fairness)
    // 2 Epic + 1 Legendary = 3 units total (70% Epic / 30% Legendary split)
    tier5_test: {
        id: "tier5_test",
        name: "Test Squad",
        description: "2 Epic Marksman + 1 Legendary Marksman",
        rules: [
            { unitClass: "marksman", count: 2, rarity: "epic" },
            { unitClass: "marksman", count: 1, rarity: "epic" }
        ],
    },
    tier5_vanguard: {
        id: "tier5_vanguard",
        name: "Aegis Squad",
        description: "1 Legendary Boss + 2 Epic Tanks",
        rules: [
            { unitClass: "boss", count: 1, rarity: "epic" },
            { unitClass: "tank", count: 2, rarity: "epic" },
        ],
    },
    tier5_artillery: {
        id: "tier5_artillery",
        name: "Precision Strike",
        description: "1 Legendary Tank + 2 Epic Marksman",
        rules: [
            { unitClass: "tank", count: 1, rarity: "epic" },
            { unitClass: "marksman", count: 2, rarity: "epic" },
        ],
    },
    tier5_sorcery: {
        id: "tier5_sorcery",
        name: "Arcane Trio",
        description: "1 Legendary Fighter + 2 Epic Mages",
        rules: [
            { unitClass: "fighter", count: 1, rarity: "epic" },
            { unitClass: "mage", count: 2, rarity: "epic" },
        ],
    },
    tier5_assassins: {
        id: "tier5_assassins",
        name: "Phantom Cell",
        description: "1 Legendary Assassin + 2 Epic Assassins",
        rules: [
            { unitClass: "assassin", count: 1, rarity: "epic" },
            { unitClass: "assassin", count: 2, rarity: "epic" },
        ],
    },
    tier5_berserkers: {
        id: "tier5_berserkers",
        name: "Elite Raid",
        description: "1 Legendary Boss + 2 Epic Fighters",
        rules: [
            { unitClass: "boss", count: 1, rarity: "epic" },
            { unitClass: "fighter", count: 2, rarity: "epic" },
        ],
    },
    tier5_apocalypse: {
        id: "tier5_apocalypse",
        name: "The Trinity",
        description: "1 Legendary Boss + 1 Epic Mage + 1 Epic Marksman",
        rules: [
            { unitClass: "boss", count: 1, rarity: "epic" },
            { unitClass: "mage", count: 1, rarity: "epic" },
            { unitClass: "marksman", count: 1, rarity: "epic" },
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

export const GIFT_DICTIONARY: GiftDictionary = {
    adam_s_dream: {
        name: "Adam’s Dream",
        coin_value: 25999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9a586391fbb1e21621c4203e5563a9e0~tplv-obj.webp",
    },
    air_dancer: {
        name: "Air Dancer",
        coin_value: 300,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/97c975dcce2483027ececde2b6719761.png~tplv-obj.webp",
    },
    alien_buddy: {
        name: "Alien Buddy",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4d39819a9bd9731b747e42a1ee650406.png~tplv-obj.webp",
    },
    amusement_park: {
        name: "Amusement Park",
        coin_value: 17000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/12ecc01c2984c5d85bb508e80103a3cb.png~tplv-obj.webp",
    },
    animal_band: {
        name: "Animal Band",
        coin_value: 2500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/60d8c4148c9cd0c268e570741ccf4150.png~tplv-obj.webp",
    },
    astrobear: {
        name: "Astrobear",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9a8c487c3245fbce45f83f1d4dbb956e.png~tplv-obj.webp",
    },
    atlantis: {
        name: "Atlantis",
        coin_value: 13000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b3608b2f24ff9367e1f9edf0e8b50fc9.png~tplv-obj.webp",
    },
    baby_chicks: {
        name: "Baby Chicks",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f1b0b043890f33ba610f2b30fffad49f.png~tplv-obj.webp",
    },
    backing_monkey: {
        name: "Backing Monkey",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/758b0367f5746ec6335f4374dd9b45c3.png~tplv-obj.webp",
    },
    balloon_crown: {
        name: "Balloon Crown",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d1cc3f587941bd7af50929aee49ac070.png~tplv-obj.webp",
    },
    balloons: {
        name: "Balloons",
        coin_value: 200,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/49d51360108c4ff1770f2d7c59d7d7cb.png~tplv-obj.webp",
    },
    bat_headwear: {
        name: "Bat Headwear",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1ba0996c3dd7db45807fd7f255eb66a4.png~tplv-obj.webp",
    },
    batik_bucket_hat: {
        name: "Batik Bucket Hat",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3247fb4f03d2dafb7417ab980c12438e.png~tplv-obj.webp",
    },
    batting_cutie: {
        name: "Batting Cutie",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/94b42ab4ffd5ccc79279dffc6b109de2.png~tplv-obj.webp",
    },
    battle_champion: {
        name: "Battle Champion",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/adc6156cc7bfb49f336c6f329ebc2830.png~tplv-obj.webp",
    },
    batwing_hat: {
        name: "Batwing Hat",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/973267050ccb12c111d8048226ac7218.png~tplv-obj.webp",
    },
    beach_maracas: {
        name: "Beach Maracas",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/db8bf15e39052e17289b70d9eaa926e0.png~tplv-obj.webp",
    },
    beating_heart: {
        name: "Beating Heart",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/11769d71ebd3c6a21f4baa7184791da9.png~tplv-obj.webp",
    },
    become_kitten: {
        name: "Become Kitten",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2d89dbc83a0999ebab98b4b06d6f5ce1.png~tplv-obj.webp",
    },
    big_shout_out: {
        name: "Big Shout Out",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d79737225a5c68dee52b34d1a7c7dec9.png~tplv-obj.webp",
    },
    bird_of_paradise: {
        name: "Bird of Paradise",
        coin_value: 8000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6ac6a0d3e86061023a2638ba903edf09.png~tplv-obj.webp",
    },
    blind_box_nyota: {
        name: "Blind Box Nyota",
        coin_value: 599,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/039661e798b1e1a3b0fd8eba5780c998.png~tplv-obj.webp",
    },
    blooming_heart: {
        name: "Blooming Heart",
        coin_value: 1599,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ff5453b7569d482c873163ce4b1fb703.png~tplv-obj.webp",
    },
    blooming_ribbons: {
        name: "Blooming Ribbons",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f76750ab58ee30fc022c9e4e11d25c9d.png~tplv-obj.webp",
    },
    blossom_fairy: {
        name: "Blossom Fairy",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6bfb67efafa3b5fb509cee8b05a1418f.png~tplv-obj.webp",
    },
    blow_a_kiss: {
        name: "Blow a kiss",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/cdb55940740d5c83879b2934f9a7d08e.png~tplv-obj.webp",
    },
    blow_rosie_kisses: {
        name: "Blow Rosie Kisses",
        coin_value: 2199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/710076b6be7de742f800c4ab88fab9ff.png~tplv-obj.webp",
    },
    boba: {
        name: "Boba",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp",
    },
    bounce_speakers: {
        name: "Bounce Speakers",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fc25829fc12db52196c8606000ae17f0.png~tplv-obj.webp",
    },
    bouquet: {
        name: "Bouquet",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1bdf0b38142a94af0f71ea53da82a3b1.png~tplv-obj.webp",
    },
    bouquet_flower: {
        name: "Bouquet Flower",
        coin_value: 30,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b158b8493b51a3f30c59710c39d1dc96~tplv-obj.webp",
    },
    bowknot: {
        name: "Bowknot",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dd02c4c2cb726134314e89abec0b5476.png~tplv-obj.webp",
    },
    boxing_gloves: {
        name: "Boxing Gloves",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9f8bd92363c400c284179f6719b6ba9c~tplv-obj.webp",
    },
    bravo: {
        name: "Bravo!",
        coin_value: 15,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/075e206d6da035f10ff5f8fecd82abcc.png~tplv-obj.webp",
    },
    bubble_gum: {
        name: "Bubble Gum",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/52ebbe9f3f53b5567ad11ad6f8303c58.png~tplv-obj.webp",
    },
    bubbly_kiss: {
        name: "Bubbly Kiss",
        coin_value: 530,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/780e304a1f0926d9e4b08e4665bbc93d.png~tplv-obj.webp",
    },
    budding_heart: {
        name: "Budding Heart",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/80cc308eca861fccd859c089b0647193.png~tplv-obj.webp",
    },
    bunny_crown: {
        name: "Bunny Crown",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/296fc5bf7a4df1db6de50d80414c5407.png~tplv-obj.webp",
    },
    butterfly_for_you: {
        name: "Butterfly for You",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e02af5a7d59a958bd38536f7e3473f75.png~tplv-obj.webp",
    },
    by_the_glaziers: {
        name: "By the Glaziers",
        coin_value: 2380,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/89106a5f53730a2aa745d74602bb9e1c.png~tplv-obj.webp",
    },
    cactus_shuffle: {
        name: "Cactus Shuffle",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b243b36466f8e18116deb7be245e1a56.png~tplv-obj.webp",
    },
    cake_slice: {
        name: "Cake Slice",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f681afb4be36d8a321eac741d387f1e2~tplv-obj.webp",
    },
    candy_bouquet: {
        name: "Candy Bouquet",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/13a78105483d213723d66d7fbf308001.png~tplv-obj.webp",
    },
    candy_loot: {
        name: "Candy Loot",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/942191ca3bdc5b648c725e2800a1c3d2.png~tplv-obj.webp",
    },
    candy_puffs: {
        name: "Candy Puffs",
        coin_value: 1030,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/776b2cab31f92e2592d27a4c6bd3df53.png~tplv-obj.webp",
    },
    cap: {
        name: "Cap",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6c2ab2da19249ea570a2ece5e3377f04~tplv-obj.webp",
    },
    captured_vocals: {
        name: "Captured Vocals",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/73613a349fbac56473acd823675f5752.png~tplv-obj.webp",
    },
    castle_fantasy: {
        name: "Castle Fantasy",
        coin_value: 20000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8173e9b07875cca37caa5219e4903a40~tplv-obj.webp",
    },
    cat: {
        name: "Cat",
        coin_value: 222,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ed64975b4e809224ec3dffc616840205.png~tplv-obj.webp",
    },
    caterpillar_chaos: {
        name: "Caterpillar Chaos",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5fc71d8f491568b0e258e2de1718e37c.png~tplv-obj.webp",
    },
    catrina: {
        name: "Catrina",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fadb0050e89ad6a1731c1a4742360846.png~tplv-obj.webp",
    },
    celebration_hat: {
        name: "Celebration Hat",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/39ae5c2723ac3754b25c05ef7c6744c3.png~tplv-obj.webp",
    },
    celebration_time: {
        name: "Celebration Time",
        coin_value: 6999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/e73e786041d8218d8e9dbbc150855f1b~tplv-obj.webp",
    },
    charmer_bow: {
        name: "Charmer Bow",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3cbe9384885eab12ace419cc4f28cf4f.png~tplv-obj.webp",
    },
    chasing_the_dream: {
        name: "Chasing the Dream",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/1ea8dbb805466c4ced19f29e9590040f~tplv-obj.webp",
    },
    chatting_popcorn: {
        name: "Chatting Popcorn",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f4813ddce6a6b3268df01af9fe3764d9.png~tplv-obj.webp",
    },
    cheeky_pup: {
        name: "Cheeky Pup",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e9fbad0840d145dd95dabede5a309587.png~tplv-obj.webp",
    },
    cheer_for_you: {
        name: "Cheer For You",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/1059dfa76c78dc17d7cf0a1fc2ece185~tplv-obj.webp",
    },
    cheer_mic: {
        name: "Cheer Mic",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cf2c95f9642541fa9ebe9bdcfe6e7359.png~tplv-obj.webp",
    },
    cheer_you_up: {
        name: "Cheer You Up",
        coin_value: 9,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/97e0529ab9e5cbb60d95fc9ff1133ea6~tplv-obj.webp",
    },
    cheering_crab: {
        name: "Cheering Crab",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/7d729b6a8104f5d349ba887608cd35bc.png~tplv-obj.webp",
    },
    cherry_blossoms: {
        name: "Cherry Blossoms",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/2deac1e9bfb27620b8ed4053fbb03a18.png~tplv-obj.webp",
    },
    chick_stampede: {
        name: "Chick Stampede",
        coin_value: 6000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/33798b669e13c98ea076ed8eaabc8810.png~tplv-obj.webp",
    },
    chicken_and_cola: {
        name: "Chicken and Cola",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/21f59a5f320712ab4a6d5f28ba618ffd.png~tplv-obj.webp",
    },
    chirpy_kisses: {
        name: "Chirpy Kisses",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c75ec50c453f5b09e4d25c5c69c30ed5.png~tplv-obj.webp",
    },
    chocolate: {
        name: "Chocolate",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8e8bfebfad922eed81f4a31a114fc0d3.png~tplv-obj.webp",
    },
    city_pop: {
        name: "City Pop",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d70148f36f3f740123bb9be341c13d77.png~tplv-obj.webp",
    },
    clover_hat: {
        name: "Clover Hat",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c53bd514827a6c5db739540ea4b8d126.png~tplv-obj.webp",
    },
    clown_boogie: {
        name: "Clown Boogie",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/379f132acd166deee7b1db9132b29342.png~tplv-obj.webp",
    },
    club_cheers: {
        name: "Club Cheers",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6a934c90e5533a4145bed7eae66d71bd.png~tplv-obj.webp",
    },
    club_music: {
        name: "Club Music",
        coin_value: 2000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/610d14c4f6e25a5ae4c8dfc0e82ec909.png~tplv-obj.webp",
    },
    club_power: {
        name: "Club Power",
        coin_value: 9,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/fb8da877eabca4ae295483f7cdfe7d31.png~tplv-obj.webp",
    },
    club_victory: {
        name: "Club Victory",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6639eb3590a59052babc9cb772ae4f5b.png~tplv-obj.webp",
    },
    coconut_juice: {
        name: "Coconut Juice",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8157f47f794c8395969034574dd12082.png~tplv-obj.webp",
    },
    coffee: {
        name: "Coffee",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/02492214b9bd50fee2d69fd0d089c025~tplv-obj.webp",
    },
    coffee_magic: {
        name: "Coffee Magic",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/0cb623f44c34f77fe14c2e11bfe4ee62.png~tplv-obj.webp",
    },
    coldy: {
        name: "coldy",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d25321ec8d38f41a39854878606751ac.png~tplv-obj.webp",
    },
    colorful_wings: {
        name: "Colorful Wings",
        coin_value: 700,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/67f29babb4506da83fed2d9143e6079b.png~tplv-obj.webp",
    },
    confetti: {
        name: "Confetti",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp",
    },
    confetti_bear: {
        name: "Confetti Bear",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6e2944bf91135c52cc8004d9b7ef36ab.png~tplv-obj.webp",
    },
    congratulations: {
        name: "Congratulations",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8e73d843b23a9e68f8d3cf8c46fc0bee.png~tplv-obj.webp",
    },
    cooper_flies_home: {
        name: "Cooper Flies Home",
        coin_value: 1999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3f1945b0d96e665a759f747e5e0cf7a9~tplv-obj.webp",
    },
    coral: {
        name: "Coral",
        coin_value: 499,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d4faa402c32bf4f92bee654b2663d9f1~tplv-obj.webp",
    },
    corgi: {
        name: "Corgi",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/148eef0884fdb12058d1c6897d1e02b9~tplv-obj.webp",
    },
    cozy_xmas_set: {
        name: "Cozy Xmas Set",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cea35adc166d87bd2f9ca00580ce80e2.png~tplv-obj.webp",
    },
    creeper: {
        name: "Creeper",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d686d45bd66e16b0aca8b0e5eb52a977.png~tplv-obj.webp",
    },
    crocodile: {
        name: "Crocodile",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/68d0ab787e32a0d3229dcbf1cfe6e250.png~tplv-obj.webp",
    },
    crystal_crown: {
        name: "Crystal Crown",
        coin_value: 2000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/4f7f618d209c8fb1f99757a42f65fa71.png~tplv-obj.webp",
    },
    crystal_dreams: {
        name: "Crystal Dreams",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4e21d2956bd289847ab8c006d499d25b.png~tplv-obj.webp",
    },
    crystal_heart: {
        name: "Crystal Heart",
        coin_value: 14999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/08095e18ae3da6ad5dcf23ce68eb1483.png~tplv-obj.webp",
    },
    cub_on_clouds: {
        name: "Cub on Clouds",
        coin_value: 5888,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e9c3eec846fb6be179ded64e57252918.png~tplv-obj.webp",
    },
    cupid_koala: {
        name: "Cupid Koala",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/823041a7f03f56fafd40b7b8c9812bd8.png~tplv-obj.webp",
    },
    cupid_s_bow: {
        name: "Cupid’s Bow",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f6dd3172f50e4f4ff8d7a6bbce9d4150.png~tplv-obj.webp",
    },
    cute_cat: {
        name: "Cute Cat",
        coin_value: 799,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6973dd1b6d3dee3ca3f0ebac3c1d2977.png~tplv-obj.webp",
    },
    cyber_roar: {
        name: "Cyber Roar",
        coin_value: 25999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e36175fdd1bdcda3716a857a509042b2.png~tplv-obj.webp",
    },
    dancing_hands: {
        name: "Dancing Hands",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d5d829bbca08bd500317991fbaa84bc3.png~tplv-obj.webp",
    },
    desert_blitzy: {
        name: "Desert Blitzy",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/802026bfb4c7aa6d267bc773ac2a4746.png~tplv-obj.webp",
    },
    desert_cooper: {
        name: "Desert Cooper",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4c571e1b88028b8abc1758c8f55fd383.png~tplv-obj.webp",
    },
    desert_diny: {
        name: "Desert Diny",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f113fb9245bd7a936ddbedaf0a0f42b9.png~tplv-obj.webp",
    },
    desert_nyota: {
        name: "Desert Nyota",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2f0dac5db644f0e372cfa488b2c6c24a.png~tplv-obj.webp",
    },
    desert_tom: {
        name: "Desert Tom",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/97c9e63f89ad26b6b84a471ae60f1935.png~tplv-obj.webp",
    },
    desert_wolf: {
        name: "Desert Wolf",
        coin_value: 5500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/ae6cb704ca336271b4f4799675229eeb.png~tplv-obj.webp",
    },
    devoted_heart: {
        name: "Devoted Heart",
        coin_value: 5999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/bc3e9b4ce077044956fee2ded85f8ff7.png~tplv-obj.webp",
    },
    diamond_flight: {
        name: "Diamond flight",
        coin_value: 18000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ada51a63094568b529b5efd83b182bc4.png~tplv-obj.webp",
    },
    diamond_gun: {
        name: "Diamond Gun",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/651e705c26b704d03bc9c06d841808f1.png~tplv-obj.webp",
    },
    diamond_heart_necklace: {
        name: "Diamond Heart necklace",
        coin_value: 200,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9651f80586431e85dbf4d96c067b22f9.png~tplv-obj.webp",
    },
    diamond_ring_of_love: {
        name: "Diamond ring of love",
        coin_value: 300,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d623197cd4a72db871b3755b4ed6894c.png~tplv-obj.webp",
    },
    diamond_tree: {
        name: "Diamond Tree",
        coin_value: 1088,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/b2aafe2ca2e529b10194d143ef86a31b.png~tplv-obj.webp",
    },
    dj_glasses: {
        name: "DJ Glasses",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d4aad726e2759e54a924fbcd628ea143.png~tplv-obj.webp",
    },
    doll_new_year_greeting: {
        name: "Doll New Year Greeting",
        coin_value: 1999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5ec37123593a6fd309cee3ddc1f93de6.png~tplv-obj.webp",
    },
    doughnut: {
        name: "Doughnut",
        coin_value: 30,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",
    },
    dragon_crown: {
        name: "Dragon Crown",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1d3f3738f57d6a45dd6df904bedd59ae.png~tplv-obj.webp",
    },
    dragon_flame: {
        name: "Dragon Flame",
        coin_value: 26999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/89b4d1d93c1cc614e3a0903ac7a94e0c~tplv-obj.webp",
    },
    dream_big: {
        name: "Dream Big",
        coin_value: 3350,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7bc2c2c9cccc164f07841e6575972311.png~tplv-obj.webp",
    },
    dreamy_hat: {
        name: "Dreamy Hat",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5074a9b0dd0de8ba6fc8573913ed9cde.png~tplv-obj.webp",
    },
    dreamy_strings: {
        name: "Dreamy Strings",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/68e68d79a6ad382321c9cbdee966c025.png~tplv-obj.webp",
    },
    drum_hamster: {
        name: "Drum Hamster",
        coin_value: 549,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/a7b5c0dd3569b6bea5e4456bd8b38da7.png~tplv-obj.webp",
    },
    duit_raya: {
        name: "Duit Raya",
        coin_value: 5,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/af543ee556c1c3d3e2610a24d8d02c94~tplv-obj.webp",
    },
    dynamic_music: {
        name: "Dynamic Music",
        coin_value: 4888,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/001c4ea85c78e9b35b5ae3228686a24c.png~tplv-obj.webp",
    },
    eid_gift_box: {
        name: "EID Gift Box",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ec3bedf704efdbbcfdfd36a99c98d94a.png~tplv-obj.webp",
    },
    encore_clap: {
        name: "Encore Clap",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5b5e6863e349500d0c8ad6d67353728b.png~tplv-obj.webp",
    },
    exclusive_spark: {
        name: "Exclusive Spark",
        coin_value: 1099,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9108da5ad7e112db04db2ce97b81d527.png~tplv-obj.webp",
    },
    face_pulling: {
        name: "Face-pulling",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fbbe8af4280240dfdb11ad1100be0282.png~tplv-obj.webp",
    },
    fairy_locket: {
        name: "Fairy Locket",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/02549f9db46985f897f0597b21939947.png~tplv-obj.webp",
    },
    fairy_wings: {
        name: "Fairy Wings",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d9798af8e406e718e66322caddf04440.png~tplv-obj.webp",
    },
    falcon: {
        name: "Falcon",
        coin_value: 10999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6026505eea9b9bce071dd699253abf6a~tplv-obj.webp",
    },
    feather_mask: {
        name: "Feather Mask",
        coin_value: 300,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/088bdb48e5051844d154948b4eb75e5f.png~tplv-obj.webp",
    },
    feather_tiara: {
        name: "Feather Tiara",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/23a0d8c3317d8be5e5a63488a7b2b8c4.png~tplv-obj.webp",
    },
    festival_bracelet: {
        name: "Festival Bracelet",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6faf18511ee366ec80c955d8e6b4153a.png~tplv-obj.webp",
    },
    fiery_dragon: {
        name: "Fiery Dragon",
        coin_value: 4888,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/8d1281789de0a5dfa69f90ecf0dc1534.png~tplv-obj.webp",
    },
    finger_heart: {
        name: "Finger Heart",
        coin_value: 5,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp",
    },
    fire_phoenix: {
        name: "Fire Phoenix",
        coin_value: 41999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/bfb8425a7e8fa03f9fec05a973a4a506.png~tplv-obj.webp",
    },
    firepit_blitzy: {
        name: "Firepit Blitzy",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8aa0c072b2c5d71f4d2504a00c5fe08a.png~tplv-obj.webp",
    },
    firepit_cooper: {
        name: "Firepit Cooper",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f464e4a99446b547d6b2249a962c7086.png~tplv-obj.webp",
    },
    firepit_diny: {
        name: "Firepit Diny",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/72a65ac318d312205722af6155d0f515.png~tplv-obj.webp",
    },
    firepit_nyota: {
        name: "Firepit Nyota",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ecc780757cd8b258cd94429b668eac73.png~tplv-obj.webp",
    },
    firepit_tom: {
        name: "Firepit Tom",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f6667616681d4ef9f5945ccef351c854.png~tplv-obj.webp",
    },
    fireworks: {
        name: "Fireworks",
        coin_value: 1088,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9494c8a0bc5c03521ef65368e59cc2b8~tplv-obj.webp",
    },
    flamingo_groove: {
        name: "Flamingo Groove",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ef1e4cf78bb27e6164f53e1695e7a5bc.png~tplv-obj.webp",
    },
    floating_octopus: {
        name: "Floating Octopus",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/022d496f79aa50d3042f0660d37ed48a.png~tplv-obj.webp",
    },
    flower_headband: {
        name: "Flower Headband",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/eaec5f24e45bc66ec44830fa5024ab45.png~tplv-obj.webp",
    },
    fluffy_buddies: {
        name: "Fluffy Buddies",
        coin_value: 5388,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/368504add2c0f4369d6940552783510e.png~tplv-obj.webp",
    },
    fly_love: {
        name: "Fly Love",
        coin_value: 19999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a598ba4c7024f4d46c1268be4d82f901~tplv-obj.webp",
    },
    flying_jets: {
        name: "Flying Jets",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1d067d13988e8754ed6adbebd89b9ee8.png~tplv-obj.webp",
    },
    forest_elf: {
        name: "Forest Elf",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1aeb39ecbb493ea520e23588df61caa1.png~tplv-obj.webp",
    },
    forever_rosa: {
        name: "Forever Rosa",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/863e7947bc793f694acbe970d70440a1.png~tplv-obj.webp",
    },
    four_king: {
        name: "Four King",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fbd0a42339abe8d3687d432835117fcd.png~tplv-obj.webp",
    },
    fox_legend: {
        name: "Fox Legend",
        coin_value: 1800,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fac01b1cc3a676a38e749959faca9fb2.png~tplv-obj.webp",
    },
    freestyle: {
        name: "Freestyle",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1f5ca5cfb4b98c2761fb85987f47c641.png~tplv-obj.webp",
    },
    fried: {
        name: "Fried",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/003103053dbf1fc8c01a81fcec61a28a.png~tplv-obj.webp",
    },
    friendship_necklace: {
        name: "Friendship Necklace",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e033c3f28632e233bebac1668ff66a2f.png~tplv-obj.webp",
    },
    frozen_magic: {
        name: "Frozen Magic",
        coin_value: 1299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b6433ca3480a06676159fc0d45cbd075.png~tplv-obj.webp",
    },
    fruit_friends: {
        name: "Fruit Friends",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1153dd51308c556cb4fcc48c7d62209f.png~tplv-obj.webp",
    },
    fully_bloomed_sakura: {
        name: "Fully Bloomed Sakura",
        coin_value: 599,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/138d5ae217170678f87d632d1b3649e6.png~tplv-obj.webp",
    },
    future_city: {
        name: "Future City",
        coin_value: 6000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/963b7c25aa2cedc0de22358342645e87.png~tplv-obj.webp",
    },
    future_encounter: {
        name: "Future Encounter",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/af980f4ec9ed73f3229df8dfb583abe6.png~tplv-obj.webp",
    },
    future_journey: {
        name: "Future Journey",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/dd615b15ed696ee886064d5415dab688.png~tplv-obj.webp",
    },
    galaxy: {
        name: "Galaxy",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/79a02148079526539f7599150da9fd28.png~tplv-obj.webp",
    },
    game_controller: {
        name: "Game Controller",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20ec0eb50d82c2c445cb8391fd9fe6e2~tplv-obj.webp",
    },
    garland_headpiece: {
        name: "Garland Headpiece",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/bdbdd8aeb2b69c173a3ef666e63310f3~tplv-obj.webp",
    },
    gem_gun: {
        name: "Gem Gun",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dd06007ade737f1001977590b11d3f61~tplv-obj.webp",
    },
    gg: {
        name: "GG",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3f02fa9594bd1495ff4e8aa5ae265eef~tplv-obj.webp",
    },
    gingerbread_man: {
        name: "Gingerbread Man",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/47417dd0758e895c33632863017f5d78.png~tplv-obj.webp",
    },
    glow_stick: {
        name: "Glow Stick",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8e1a5d66370c5586545e358e37c10d25~tplv-obj.webp",
    },
    glowing_jellyfish: {
        name: "Glowing Jellyfish",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/96d9226ef1c33784a24d0779ad3029d3.png~tplv-obj.webp",
    },
    go_hamster: {
        name: "Go Hamster",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/582131434f4f6edc3f97b96fbc33a492.png~tplv-obj.webp",
    },
    go_home: {
        name: "Go Home",
        coin_value: 3999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fa586ca53d45cd656d4df2f4624da2a0.png~tplv-obj.webp",
    },
    go_popular: {
        name: "Go Popular",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b342e28d73dac6547e0b3e2ad57f6597.png~tplv-obj.webp",
    },
    goalkeeper_save: {
        name: "Goalkeeper Save",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/92a80ca0eef371f0b7ae70f76f0f29d5.png~tplv-obj.webp",
    },
    gold_necklace: {
        name: "Gold necklace",
        coin_value: 200,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/21549ba24f76a01d00373cb8e35660ae.png~tplv-obj.webp",
    },
    golden_gallop: {
        name: "Golden Gallop",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ec26ec5a61ad0490b70e31d6dbe128bc.png~tplv-obj.webp",
    },
    gorilla: {
        name: "Gorilla",
        coin_value: 30000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/57619959bddbe35d8c684750a1d41d62.png~tplv-obj.webp",
    },
    grand_show: {
        name: "Grand show",
        coin_value: 999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/61348c8f1a776122088de3d43fc16fab.png~tplv-obj.webp",
    },
    greeting_card: {
        name: "Greeting Card",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/dac91f95d4135654fe16d09369dd8355.png~tplv-obj.webp",
    },
    greeting_heart: {
        name: "Greeting Heart",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9325524bd9ca181bd8e76eb99b44c042.png~tplv-obj.webp",
    },
    guiding_star: {
        name: "Guiding Star",
        coin_value: 3999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/950c054074266eb2f7bba703fea98a3f.png~tplv-obj.webp",
    },
    halloween_fun_hat: {
        name: "Halloween Fun Hat",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/45a573035e301087d1ffe91e0f1513cb.png~tplv-obj.webp",
    },
    halo_kiss: {
        name: "Halo Kiss",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/55be9984069e03c571a0d411216b0fe8.png~tplv-obj.webp",
    },
    hand_hearts: {
        name: "Hand Hearts",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6cd022271dc4669d182cad856384870f~tplv-obj.webp",
    },
    hands_up: {
        name: "Hands Up",
        coin_value: 499,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f4d906542408e6c87cf0a42f7426f0c6~tplv-obj.webp",
    },
    happy_party: {
        name: "Happy Party",
        coin_value: 6999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/41774a8ba83c59055e5f2946d51215b4~tplv-obj.webp",
    },
    hat_and_mustache: {
        name: "Hat and Mustache",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/2f1e4f3f5c728ffbfa35705b480fdc92~tplv-obj.webp",
    },
    hat_of_joy: {
        name: "Hat of Joy",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9fcbc11bf61ee4b5790f2b3677a45ac6.png~tplv-obj.webp",
    },
    headphone: {
        name: "Headphone",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d250b93197c151c45a08ab5f4db805d6.png~tplv-obj.webp",
    },
    heart: {
        name: "Heart",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dd300fd35a757d751301fba862a258f1~tplv-obj.webp",
    },
    heart_gaze: {
        name: "Heart Gaze",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/0fe120fdb52724dd157e41cc5c00a924.png~tplv-obj.webp",
    },
    heart_guitar: {
        name: "Heart Guitar",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5fcee4f89ea8119ecc5e9c47c008d54b.png~tplv-obj.webp",
    },
    heart_hood: {
        name: "Heart Hood",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/79801ad5ce9f4a97793be5b06ac6804b.png~tplv-obj.webp",
    },
    heart_it_out: {
        name: "Heart It Out",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3b2a7f10c7db029726c1cf636106c969.png~tplv-obj.webp",
    },
    heart_me: {
        name: "Heart Me",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.webp",
    },
    hearts: {
        name: "Hearts",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/934b5a10dee8376df5870a61d2ea5cb6.png~tplv-obj.webp",
    },
    here_we_go: {
        name: "Here We Go",
        coin_value: 1799,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/61b76a51a3757f0ff1cdc33b16c4d8ae~tplv-obj.webp",
    },
    hi_rosie: {
        name: "Hi! Rosie!",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c5d90ed49d326785882decc35c4200b0.png~tplv-obj.webp",
    },
    hip_hop_hen: {
        name: "Hip-Hop Hen",
        coin_value: 3200,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/796b15068f06c947eeead7517e0bd5e4.png~tplv-obj.webp",
    },
    hive_escape: {
        name: "Hive Escape",
        coin_value: 549,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/92bd8c4f0d4fef2cee16e9adcd50a222.png~tplv-obj.webp",
    },
    i_love_you: {
        name: "I love you",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/beaaa3a78a00b5b20661b00924ab0e7f~tplv-obj.webp",
    },
    ice_cream_cone: {
        name: "Ice Cream Cone",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/968820bc85e274713c795a6aef3f7c67~tplv-obj.webp",
    },
    ice_cream_mic: {
        name: "Ice Cream Mic",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7f784d1ec7b26d7d8cfd05faede11d76.png~tplv-obj.webp",
    },
    indoor_fan: {
        name: "Indoor Fan",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d7a39c48861a021d99523bc89af99df0.png~tplv-obj.webp",
    },
    infinite_heart: {
        name: "Infinite Heart",
        coin_value: 23999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/de31974d7a94525c6f31872b5b38f76e.png~tplv-obj.webp",
    },
    interstellar: {
        name: "Interstellar",
        coin_value: 10000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8520d47b59c202a4534c1560a355ae06~tplv-obj.webp",
    },
    invincible_hammer: {
        name: "Invincible Hammer",
        coin_value: 14999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/52d8c2e23c1800e85ad621e431220724.png~tplv-obj.webp",
    },
    join_butterflies: {
        name: "Join Butterflies",
        coin_value: 600,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/79afcda7ceb1228d393f4987e12a857c.png~tplv-obj.webp",
    },
    joker_ball: {
        name: "Joker Ball",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4227bdbc22921d8cdceb3ab14366624d.png~tplv-obj.webp",
    },
    jollie_s_heartland: {
        name: "Jollie's Heartland",
        coin_value: 2199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0eafd5c28cdb2563f3386679643abb29.png~tplv-obj.webp",
    },
    jollie_the_joy_bean: {
        name: "Jollie the Joy Bean",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/0e3769575f5b7b27b67c6330376961a4.png~tplv-obj.webp",
    },
    journey_pass: {
        name: "Journey Pass",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/551ecaf639c5e02354f9e7c1a763ec72.png~tplv-obj.webp",
    },
    joy_floats: {
        name: "Joy Floats",
        coin_value: 1030,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/be17076f04429b60eb2d7c3e03a2ea9d.png~tplv-obj.webp",
    },
    juicy_cap: {
        name: "Juicy Cap",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e6ce2ee0daae3693268b77efec17507f.png~tplv-obj.webp",
    },
    juicy_smile: {
        name: "Juicy Smile",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b897b374103a142ce550afec4c54d9aa.png~tplv-obj.webp",
    },
    julius_the_champion: {
        name: "Julius the Champion",
        coin_value: 43999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/78260c7f1dac82bd979279b5e04bffeb.png~tplv-obj.webp",
    },
    jungle_blitzy: {
        name: "Jungle Blitzy",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d82ab0f0fbcf33755e41f4542b94dadd.png~tplv-obj.webp",
    },
    jungle_cooper: {
        name: "Jungle Cooper",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e5fb5ade8480a67eb34604672bd47aa8.png~tplv-obj.webp",
    },
    jungle_diny: {
        name: "Jungle Diny",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e45ac77c24fb1cbe25bdfeffdf648b4e.png~tplv-obj.webp",
    },
    jungle_nyota: {
        name: "Jungle Nyota",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/66be5f9574b5699dd4a78f396f336c5e.png~tplv-obj.webp",
    },
    jungle_tom: {
        name: "Jungle Tom",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/35ee084d755964dca0d11fb4c2d47108.png~tplv-obj.webp",
    },
    kicker_challenge: {
        name: "Kicker Challenge",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8065704646452387f6bed049b194f214.png~tplv-obj.webp",
    },
    kitten_kneading: {
        name: "Kitten Kneading",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/40938efafa13a17de483949934570461.png~tplv-obj.webp",
    },
    league_ball: {
        name: "League Ball",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/85e79c76fd9b5ded418565427a67f424.png~tplv-obj.webp",
    },
    league_countdown: {
        name: "League Countdown",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/936d94c2e9267c3fa099127fba4e30a2.png~tplv-obj.webp",
    },
    league_fandom: {
        name: "League Fandom",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b49db707b60b5e71e7fc2335a5d93b22.png~tplv-obj.webp",
    },
    league_trophy: {
        name: "League Trophy",
        coin_value: 599,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fe5bf1d97adafcdc675222a9facfe6ee.png~tplv-obj.webp",
    },
    legend_marcellus: {
        name: "Legend Marcellus ",
        coin_value: 42999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2493534c2e9d914e6b503c3a836e72e9.png~tplv-obj.webp",
    },
    leon_and_lili: {
        name: "Leon and Lili",
        coin_value: 9699,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6958244f3eeb69ce754f735b5833a4aa.png~tplv-obj.webp",
    },
    leon_and_lion: {
        name: "Leon and Lion",
        coin_value: 34000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a291aedacf27d22c3fd2d83575d2bee9~tplv-obj.webp",
    },
    leon_s_sigil_cape: {
        name: "Leon's Sigil Cape",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/385d00992b83a2e8a2ab5d8ec82d9715.png~tplv-obj.webp",
    },
    leon_the_kitten: {
        name: "Leon the Kitten",
        coin_value: 4888,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a7748baba012c9e2d98a30dce7cc5a27~tplv-obj.webp",
    },
    leopard: {
        name: "Leopard",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3d837cfcac70929abc0f45e4dc7cee04.png~tplv-obj.webp",
    },
    let_butterfly_dances: {
        name: " Let butterfly dances ",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/754effcbfbc5c6708c32552ab780e14b.png~tplv-obj.webp",
    },
    level_ship: {
        name: "Level Ship",
        coin_value: 21000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/aca72c59f99d08b0c0d1cd6cc79dbb16.png~tplv-obj.webp",
    },
    level_up_sparks: {
        name: "Level-up Sparks",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/c6c5b0efea6f1f7e1fd1f3909284d12c.png~tplv-obj.webp",
    },
    level_up_spectacle: {
        name: "Level-up Spectacle",
        coin_value: 12999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/52a09724bbe8d78227db67bc5fe78613.png~tplv-obj.webp",
    },
    level_up_spotlight: {
        name: "Level-up Spotlight",
        coin_value: 2999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/9a87567b4bb63b175f146745af412bb5.png~tplv-obj.webp",
    },
    life_star: {
        name: "Life Star",
        coin_value: 59,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/30f8efbb46b3310156ffeeb7090a12ac.png~tplv-obj.webp",
    },
    lightning_your_world: {
        name: "Lightning your world",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/827dcf6f5a588b32b02c578e2954a271.png~tplv-obj.webp",
    },
    like_pop: {
        name: "Like-Pop",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/75eb7b4aca24eaa6e566b566c7d21e2f~tplv-obj.webp",
    },
    lili_the_leopard: {
        name: "Lili the Leopard",
        coin_value: 6599,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/7be03e1af477d1dbc6eb742d0c969372.png~tplv-obj.webp",
    },
    lion: {
        name: "Lion",
        coin_value: 29999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp",
    },
    little_crown: {
        name: "Little Crown",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cf3db11b94a975417043b53401d0afe1~tplv-obj.webp",
    },
    live_ranking_crown: {
        name: "LIVE Ranking Crown",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1bb7f00a3adeb932e5f5518d723fedb5.png~tplv-obj.webp",
    },
    look_up: {
        name: "Look Up",
        coin_value: 3350,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/87ed725a0b451b9d007a27fb4e315ab9.png~tplv-obj.webp",
    },
    love_call: {
        name: "Love Call",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b9f95b541fa21eb5325fd8f6ffe1a551.png~tplv-obj.webp",
    },
    love_drop: {
        name: "Love Drop",
        coin_value: 1800,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/1ea684b3104abb725491a509022f7c02~tplv-obj.webp",
    },
    love_flight: {
        name: "Love Flight",
        coin_value: 800,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ed700c6f77e12689ca0e8f9b3bd90982.png~tplv-obj.webp",
    },
    love_glasses: {
        name: "Love Glasses",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7b3f141efe8a943faba19f855a003943.png~tplv-obj.webp",
    },
    love_painting: {
        name: "Love Painting",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/de6f01cb2a0deb2da24cb5d1ecf9a23b.png~tplv-obj.webp",
    },
    love_you: {
        name: "Love You",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/134e51c00f46e01976399883ca4e4798~tplv-obj.webp",
    },
    love_you_so_much: {
        name: "Love you so much",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fc549cf1bc61f9c8a1c97ebab68dced7.png~tplv-obj.webp",
    },
    lover_s_lock: {
        name: "Lover’s Lock",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f3010d1fcb008ce1b17248e5ea18b178.png~tplv-obj.webp",
    },
    lucky_airdrop_box: {
        name: "Lucky Airdrop Box",
        coin_value: 999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6ae56f08ae3ee57ea2dda0025bfd39d3.png~tplv-obj.webp",
    },
    lucky_pony: {
        name: "Lucky Pony",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8d005c54c988a6353777ce9c06cfb9cc.png~tplv-obj.webp",
    },
    magic_genie: {
        name: "Magic Genie",
        coin_value: 200,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c750548817a633185d2c46391cc64214.png~tplv-obj.webp",
    },
    magic_prop: {
        name: "Magic Prop",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/51b0adff1cf290651c87ec26128658b9.png~tplv-obj.webp",
    },
    magic_rhythm: {
        name: "Magic Rhythm",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/00f1882035fcf9407e4b1955f0b4c48b.png~tplv-obj.webp",
    },
    magic_role: {
        name: "Magic Role",
        coin_value: 1088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/690125ff0a089e5dfc2721d6a6f35fa9.png~tplv-obj.webp",
    },
    magic_stage: {
        name: "Magic Stage",
        coin_value: 2599,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d2297d8da4f6a4da942d4c55f3fb5a3f~tplv-obj.webp",
    },
    magic_world: {
        name: "Magic World",
        coin_value: 4088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/a91fdba590b29bab1287ec746d8323a8.png~tplv-obj.webp",
    },
    majestic_hearts: {
        name: "Majestic Hearts",
        coin_value: 7238,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/a4585c4d71865a5193fafe229c09512b.png~tplv-obj.webp",
    },
    manifesting: {
        name: "Manifesting",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/ca11566ae5a41ec8971cc00b51f78dac.png~tplv-obj.webp",
    },
    mark_of_love: {
        name: "Mark of Love",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/582475419a820e0b0dbc964799b6146e.png~tplv-obj.webp",
    },
    marked_with_love: {
        name: "Marked with Love",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2859c21a400e1f40d93da7b68c0254d0.png~tplv-obj.webp",
    },
    marvelous_confetti: {
        name: "Marvelous Confetti",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/fccc851d351716bc8b34ec65786c727d~tplv-obj.webp",
    },
    masquerade: {
        name: "Masquerade",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8fde56ae6a7ea22d3d17184ac362585f.png~tplv-obj.webp",
    },
    massage_for_you: {
        name: "Massage for You",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3ebdd3746d91eb06bdd4a04c49c3b04a.png~tplv-obj.webp",
    },
    melodic_birds: {
        name: "Melodic birds",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/345514d111481a58d76bd53c42f0445d.png~tplv-obj.webp",
    },
    melody_glasses: {
        name: "Melody Glasses",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7e4e83b1f8746e2c3205e14f99eaae08.png~tplv-obj.webp",
    },
    melon_juice: {
        name: "Melon Juice",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/912d29e708fe00d72487908114803e77.png~tplv-obj.webp",
    },
    meteor_shower: {
        name: "Meteor Shower",
        coin_value: 3000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/71883933511237f7eaa1bf8cd12ed575~tplv-obj.webp",
    },
    mic_champ: {
        name: "Mic Champ",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d8678a19d13ab6e2feffbea41acd0ed9.png~tplv-obj.webp",
    },
    milk_tea: {
        name: "Milk Tea",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp",
    },
    mishka_bear: {
        name: "Mishka Bear",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d78ed6496fd57286b42ac033acbee299.png~tplv-obj.webp",
    },
    money_gun: {
        name: "Money Gun",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/e0589e95a2b41970f0f30f6202f5fce6~tplv-obj.webp",
    },
    motorcycle: {
        name: "Motorcycle",
        coin_value: 2988,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/motor_icon_green.png~tplv-obj.webp",
    },
    music_album: {
        name: "Music  Album",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2a5378fbb272f5b4be0678084c66bdc1.png~tplv-obj.webp",
    },
    music_bubbles: {
        name: "Music Bubbles",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b5786e09eb50f1ea512b2ae9f7034254.png~tplv-obj.webp",
    },
    music_conductor: {
        name: "Music Conductor",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1351df201d2481a07a33af2ea06af84f.png~tplv-obj.webp",
    },
    music_mate: {
        name: "Music Mate",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/789d404702b42340359a4b5ea9366dbb.png~tplv-obj.webp",
    },
    mystery_box: {
        name: "Mystery Box",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/17667837f58f77f6e189617880315f7c.png~tplv-obj.webp",
    },
    mystery_firework: {
        name: "Mystery Firework",
        coin_value: 1999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c110230c5db903db5f060a432f5a86cd~tplv-obj.webp",
    },
    mystic_drink: {
        name: "Mystic Drink",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/aa2791b5b47ef26b948ed0ff76f878b5.png~tplv-obj.webp",
    },
    name_shoutout: {
        name: "Name shoutout",
        coin_value: 5,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9b1d432109c95e77e8de11dd442c0a1f.png~tplv-obj.webp",
    },
    naughty_chicken: {
        name: "Naughty Chicken",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/46a839dbc1c3e9103c71d82b35b21ad4.png~tplv-obj.webp",
    },
    nyota: {
        name: "Nyota",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/88ed13f411c260572efde90e6a7000c4.png~tplv-obj.webp",
    },
    oldies: {
        name: "Oldies",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/77f6ab69b0b03bda98a0a3d2bfdeb46f.png~tplv-obj.webp",
    },
    orange_juice: {
        name: "Orange Juice",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/7244832db46b7ea5d7d6e280719ddea2~tplv-obj.webp",
    },
    overreact: {
        name: "Overreact",
        coin_value: 5,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dfd48ef1952b6d315856adda7705d02d.png~tplv-obj.webp",
    },
    padang_rice: {
        name: "Padang Rice",
        coin_value: 5,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/bd6e927cd68db696f2a27d4e2c7d0c34.png~tplv-obj.webp",
    },
    palm_breeze: {
        name: "Palm Breeze",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dc8043965da9348b305de279cb2fb451.png~tplv-obj.webp",
    },
    panda_hug: {
        name: "Panda Hug",
        coin_value: 499,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6a00e64d9582d0e1f4ef0ac66132c272.png~tplv-obj.webp",
    },
    panda_snap: {
        name: "Panda Snap",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/a96c32f3272df1905eb3f3d51b53308b.png~tplv-obj.webp",
    },
    paper_crane: {
        name: "Paper Crane",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/0f158a08f7886189cdabf496e8a07c21~tplv-obj.webp",
    },
    paris: {
        name: "Paris",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f7a810a338bc0e69709badd3a596559c.png~tplv-obj.webp",
    },
    party_blossom: {
        name: "Party Blossom",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3065f931274a9c1e6d4cdd0b29ff3c8d.png~tplv-obj.webp",
    },
    party_bus: {
        name: "Party Bus",
        coin_value: 2999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/719e1f271c29f2165bda5d787501c307.png~tplv-obj.webp",
    },
    party_laser: {
        name: "Party Laser",
        coin_value: 1300,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/469999dc1598d243114e9969f8d19467.png~tplv-obj.webp",
    },
    party_on_on: {
        name: "Party On&On",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/c45505ece4a91d9c43e4ba98a000b006.png~tplv-obj.webp",
    },
    party_pony: {
        name: "Party Pony",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/07c5a2297a00cacc94d329d047d045c8.png~tplv-obj.webp",
    },
    paw_call: {
        name: "Paw Call",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0be8fcd307c249a9051dcc4e9dc51507.png~tplv-obj.webp",
    },
    pawfect: {
        name: "Pawfect",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/8710c33f4929aa91c7ec7154f5f90268.png~tplv-obj.webp",
    },
    pegasus: {
        name: "Pegasus",
        coin_value: 42999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f600a2495ab5d250e7da2066484a9383.png~tplv-obj.webp",
    },
    penguin_snowpal: {
        name: "Penguin Snowpal",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/29828fedfc36982c9395822e9e5aab20.png~tplv-obj.webp",
    },
    perfume: {
        name: "Perfume",
        coin_value: 20,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp",
    },
    phoenix: {
        name: "Phoenix",
        coin_value: 25999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/ef248375c4167d70c1642731c732c982~tplv-obj.webp",
    },
    pinch_cheek: {
        name: "Pinch Cheek",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d1c75692e369466b4fd23546e513caed~tplv-obj.webp",
    },
    pinch_face: {
        name: "Pinch Face",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/a10aab8940d3d5aee14b14cde033ab2a.png~tplv-obj.webp",
    },
    pirate_s_treasure: {
        name: "Pirate's Treasure",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ec205551b4ed75a5a12e2dd49e70b723.png~tplv-obj.webp",
    },
    play_for_you: {
        name: "Play for You",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/34201b86430742595e4dcb5b39560b7a.png~tplv-obj.webp",
    },
    polaris: {
        name: "Polaris",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6abb39fb8088a1897b8163e54394845c.png~tplv-obj.webp",
    },
    pony_lantern: {
        name: "Pony Lantern",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/513e60117034e851dc6c923ea8a3125b.png~tplv-obj.webp",
    },
    pop: {
        name: "Pop",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0b4f61e8ab637f11449300d03929ef87.png~tplv-obj.webp",
    },
    power_hug: {
        name: "Power hug",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/9578adce6e3da2d211583212bdfd1b0e.png~tplv-obj.webp",
    },
    powerful_mind: {
        name: "Powerful Mind",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2184128b55eaef8a390a1a43a2ffdf16.png~tplv-obj.webp",
    },
    prairie_blitzy: {
        name: "Prairie Blitzy",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/1ccdd049480b94bb71516e554802024f.png~tplv-obj.webp",
    },
    prairie_cooper: {
        name: "Prairie Cooper",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9af6a041ed6a17c927a9065970c34baf.png~tplv-obj.webp",
    },
    prairie_diny: {
        name: "Prairie Diny",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/adfedd8992012cf75ddce5496335d16c.png~tplv-obj.webp",
    },
    prairie_nyota: {
        name: "Prairie Nyota",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3456fcb2546cb2477336bf80e64a7494.png~tplv-obj.webp",
    },
    prairie_tom: {
        name: "Prairie Tom",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/32154aa9a0fab3d772475044c03e5dc7.png~tplv-obj.webp",
    },
    premium_shuttle: {
        name: "Premium Shuttle",
        coin_value: 20000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c2b287adee5151b7889d6e3d45b72e44~tplv-obj.webp",
    },
    prince: {
        name: "Prince",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ea1fc9cb68514ec3c844179c6f09e8de.png~tplv-obj.webp",
    },
    private_jet: {
        name: "Private Jet",
        coin_value: 4888,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/airplane_icon_gold.png~tplv-obj.webp",
    },
    puppy_kisses: {
        name: "Puppy Kisses",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4ae998a21159b60484169864f8968ba9.png~tplv-obj.webp",
    },
    racing_debut: {
        name: "Racing Debut",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b5ac8bb9da5569185bfdc1be357d3906.png~tplv-obj.webp",
    },
    racing_helmet: {
        name: "Racing Helmet",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b9321d0563504990e8fcf73466f4c895.png~tplv-obj.webp",
    },
    raving_snail: {
        name: "Raving Snail",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ef4e1229a2f0b67f7d4e92b508667060.png~tplv-obj.webp",
    },
    raya_gift_card: {
        name: "Raya Gift Card",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b83e4e9e80e501617b6d01582109c00f.png~tplv-obj.webp",
    },
    red_lightning: {
        name: "Red Lightning",
        coin_value: 12000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5f48599c8d2a7bbc6e6fcf11ba2c809f~tplv-obj.webp",
    },
    reindeer_milk: {
        name: "Reindeer Milk",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/c7b922a59b8e77e748803717bd483ccf.png~tplv-obj.webp",
    },
    relaxed_goose: {
        name: "Relaxed Goose",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3961645e741423d7b334fb4b6488852f.png~tplv-obj.webp",
    },
    rhythmic_bear: {
        name: "Rhythmic Bear",
        coin_value: 2999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/380ced1977319859807292ce490993d2.png~tplv-obj.webp",
    },
    ring_of_honor_cube: {
        name: "Ring Of Honor-Cube",
        coin_value: 2999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/bb5cbc1ff2bf4370873a1fe98e2b6b50.png~tplv-obj.webp",
    },
    rock_star: {
        name: "Rock Star",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/57acaf0590c56c219493b71fe8d2961d.png~tplv-obj.webp",
    },
    rocking_shroom: {
        name: "Rocking Shroom",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cbc0508afc678106f11392ae1ed3c055.png~tplv-obj.webp",
    },
    rocky_s_punch: {
        name: "Rocky's Punch",
        coin_value: 2199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d17fb8a57c708c4f07f95884131df654.png~tplv-obj.webp",
    },
    rocky_the_rock_bean: {
        name: "Rocky the Rock Bean",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/767d7ea90f58f3676bbc5b1ae3c9851d.png~tplv-obj.webp",
    },
    rosa: {
        name: "Rosa",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp",
    },
    rosa_nebula: {
        name: "Rosa Nebula",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f722088231103b66875dae33f13f8719.png~tplv-obj.webp",
    },
    rose: {
        name: "Rose",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    },
    rose_bear: {
        name: "Rose Bear",
        coin_value: 214,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/adf6e9bd6219788151edb9fa026a0481.png~tplv-obj.webp",
    },
    rose_hand: {
        name: "Rose Hand",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/805e6b8051d50ca6e6c9b74d5fc89045.png~tplv-obj.webp",
    },
    rose_soundwave: {
        name: "Rose Soundwave",
        coin_value: 499,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/116f10b4d15bcfc0c945554778d52c7c.png~tplv-obj.webp",
    },
    roses: {
        name: "Roses",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5bbfdb351eb6d69cfe9576b4f3683709.png~tplv-obj.webp",
    },
    rosie_s_concert: {
        name: "Rosie's Concert",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9e9ccba3ad69fb79462faad2d4bab4a5.png~tplv-obj.webp",
    },
    rosie_the_rose_bean: {
        name: "Rosie the Rose Bean",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3cbaea405cc61e8eaab6f5a14d127511.png~tplv-obj.webp",
    },
    sage_s_coinbot: {
        name: "Sage's Coinbot",
        coin_value: 2199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/443c163954f4f7636909fb6980518745.png~tplv-obj.webp",
    },
    sage_s_slash: {
        name: "Sage's Slash",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/213605d4582aa3e35b51712c7a0909aa.png~tplv-obj.webp",
    },
    sage_s_venture: {
        name: "Sage’s Venture",
        coin_value: 4999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ea291160b9b69dc5d13938433ba0fae9.png~tplv-obj.webp",
    },
    sage_the_smart_bean: {
        name: "Sage the Smart Bean",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/ed2cc456ab1a8619c5093eb8cfd3d303.png~tplv-obj.webp",
    },
    sam_in_new_city: {
        name: "Sam in New City",
        coin_value: 6000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/291de897e4a8c3b72c358a9734c5b7d8.png~tplv-obj.webp",
    },
    samfaring_tom: {
        name: "Samfaring Tom",
        coin_value: 2850,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d170a2612408d59bde870ffae406747b.png~tplv-obj.webp",
    },
    santa_cocoa: {
        name: "Santa Cocoa",
        coin_value: 149,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8d188b6a7cfd7b98f778f18302a8f7f4.png~tplv-obj.webp",
    },
    santa_owl_surprise: {
        name: "Santa Owl Surprise",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/d70298039a39a03723b95b9a76421bc1.png~tplv-obj.webp",
    },
    sax_groove: {
        name: "Sax Groove",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/48af771dd2405a0d01b4dd7184e8cfad.png~tplv-obj.webp",
    },
    sea_blitzy: {
        name: "Sea Blitzy",
        coin_value: 3088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fc9a249032a0dedd01f86106ff0b54d9.png~tplv-obj.webp",
    },
    sea_cooper: {
        name: "Sea Cooper",
        coin_value: 3088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8833bf214cd51ae9d03bcc784815c0e6.png~tplv-obj.webp",
    },
    sea_diny: {
        name: "Sea Diny",
        coin_value: 3088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cbe9ac457d2cb8f0fb83fbc51997707b.png~tplv-obj.webp",
    },
    sea_nyota: {
        name: "Sea Nyota",
        coin_value: 3088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ebeaf8610af9835d761e5cb88e253a59.png~tplv-obj.webp",
    },
    sea_shell: {
        name: "SEA Shell",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/04d53e1019450131a4054d84e0f89c85.png~tplv-obj.webp",
    },
    sea_tom: {
        name: "Sea Tom",
        coin_value: 3088,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/52dd3147fb1e1ac1d8c0674a5437d98f.png~tplv-obj.webp",
    },
    seahorse_pop: {
        name: "Seahorse Pop",
        coin_value: 649,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7b023066149c8d1f865348257d49556f.png~tplv-obj.webp",
    },
    seaside_romance: {
        name: "Seaside Romance",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/610396183e45c4fbf333382abdbc7db7.png~tplv-obj.webp",
    },
    shell_energy: {
        name: "Shell Energy",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/563b478b293a94fbe82f87d68d6489ea.png~tplv-obj.webp",
    },
    shine_bright: {
        name: "Shine Bright",
        coin_value: 4088,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d4234483e15952a992ae58a088291be1.png~tplv-obj.webp",
    },
    shiny_air_balloon: {
        name: "Shiny air balloon",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9e7ebdca64b8f90fcc284bb04ab92d24~tplv-obj.webp",
    },
    shoot_the_apple: {
        name: "Shoot the Apple",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/12a72eac62721ef031f22d935f6aac4b.png~tplv-obj.webp",
    },
    side_by_side: {
        name: "Side by Side",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/14b52e1933131d94a2634acf1625559d.png~tplv-obj.webp",
    },
    signature_jet: {
        name: "Signature Jet",
        coin_value: 4888,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/fe27eba54a50c0a687e3dc0f2c02067d~tplv-obj.webp",
    },
    singing_magic: {
        name: "Singing Magic",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1b76de4373dec56480903c3d5367fd13.png~tplv-obj.webp",
    },
    singing_sax: {
        name: "Singing Sax",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0962211de9b80bda00a7da89400d2a5a.png~tplv-obj.webp",
    },
    sky_drift: {
        name: "Sky Drift",
        coin_value: 2000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/761bac6eb7c53852bfc702282fd9be85.png~tplv-obj.webp",
    },
    sloth_peek: {
        name: "Sloth Peek",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/602e3444f1810b8b048a2e706eb19898.png~tplv-obj.webp",
    },
    slow_motion: {
        name: "Slow motion",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/12374117770f779919bf002461fdfac0.png~tplv-obj.webp",
    },
    sneaky_jockey: {
        name: "Sneaky Jockey",
        coin_value: 15000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6401ca229c2a1a07f88701da7a5b2925.png~tplv-obj.webp",
    },
    snow_bloom: {
        name: "Snow Bloom",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8384e240d21a75fd1084e6f9da833ab6.png~tplv-obj.webp",
    },
    so_cute: {
        name: "So Cute",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/d40d31241efcf57c630e894bb3007b8a.png~tplv-obj.webp",
    },
    song_of_harvest: {
        name: "Song of Harvest",
        coin_value: 150,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/8af5604b926b8d045246d25d4de24550.png~tplv-obj.webp",
    },
    sour_buddy: {
        name: "Sour Buddy",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/963e12ba84805721d96b06deaf5d660b.png~tplv-obj.webp",
    },
    space_love: {
        name: "Space Love",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/186d36ad446fe5336a3ddce47eae5dab.png~tplv-obj.webp",
    },
    sparkle_dance: {
        name: "Sparkle Dance",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/6d934aacf296e6f24d75b8b2aa4fb22f.png~tplv-obj.webp",
    },
    sparkle_pony: {
        name: "Sparkle Pony",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/28bf38fda66300cd185fd8e3dc28d716.png~tplv-obj.webp",
    },
    sports_car: {
        name: "Sports Car",
        coin_value: 7000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/e7ce188da898772f18aaffe49a7bd7db~tplv-obj.webp",
    },
    spring_bouquet: {
        name: "Spring Bouquet",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/97a432fdd0ec5b9a30b2a8bc4d594700.png~tplv-obj.webp",
    },
    spring_sprout: {
        name: "Spring Sprout",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b81807a156aad66d757bacffebae830f.png~tplv-obj.webp",
    },
    star_goggles: {
        name: "Star Goggles",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e14483e67a44ce522ba583ec923941fa.png~tplv-obj.webp",
    },
    star_of_red_carpet: {
        name: "Star of Red Carpet",
        coin_value: 1999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5b9bf90278f87b9ca0c286d3c8a12936~tplv-obj.webp",
    },
    star_throne: {
        name: "Star Throne",
        coin_value: 7999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/30063f6bc45aecc575c49ff3dbc33831~tplv-obj.webp",
    },
    stargazing: {
        name: "Stargazing",
        coin_value: 2200,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/5792ef0fde9ca93d8ce1d793ede8aacc.png~tplv-obj.webp",
    },
    starlight_compass: {
        name: "Starlight Compass",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/239d5419829614a89000230ece14b287.png~tplv-obj.webp",
    },
    starlight_sceptre: {
        name: "Starlight Sceptre",
        coin_value: 1200,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/bcb3636b904fe6050d6a47efb1eafd2c.png~tplv-obj.webp",
    },
    starry_fluff: {
        name: "Starry Fluff",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f5e709a56ba9e238f0a87dfd4510b44f.png~tplv-obj.webp",
    },
    stinging_bee: {
        name: "Stinging Bee",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/c37b8f76d503f5787407a8d7c52f8cb7.png~tplv-obj.webp",
    },
    strong_finish: {
        name: "Strong Finish",
        coin_value: 6000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/9ad035b088dfeaf298fdc9cd84d50000.png~tplv-obj.webp",
    },
    style_me_up: {
        name: "Style Me Up",
        coin_value: 10,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b676cd3356e7dc11d4dad13fed18d29e.png~tplv-obj.webp",
    },
    sugar_whiskers: {
        name: "Sugar Whiskers",
        coin_value: 4918,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3d306be32f7d6d52c4e74df15a063d45.png~tplv-obj.webp",
    },
    sundae_bowl: {
        name: "Sundae Bowl",
        coin_value: 99,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/725ba28c17d775db510ca7b240cdd84e.png~tplv-obj.webp",
    },
    sunglasses: {
        name: "Sunglasses",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/08af67ab13a8053269bf539fd27f3873.png~tplv-obj.webp",
    },
    sunset_in_bali: {
        name: "Sunset in Bali",
        coin_value: 799,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c208fcd7a4ec15f8ba8f379031be404d~tplv-obj.webp",
    },
    sunset_speedway: {
        name: "Sunset Speedway",
        coin_value: 10000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/df63eee488dc0994f6f5cb2e65f2ae49~tplv-obj.webp",
    },
    super_gg: {
        name: "Super GG",
        coin_value: 100,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/cbd7588c53ec3df1af0ed6d041566362.png~tplv-obj.webp",
    },
    super_popular: {
        name: "Super Popular",
        coin_value: 9,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2fa794a99919386b85402d9a0a991b2b.png~tplv-obj.webp",
    },
    superwoman: {
        name: "Superwoman",
        coin_value: 450,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0b229a89d79cee14ca681b1ce2abac9b.png~tplv-obj.webp",
    },
    surfing_penguin: {
        name: "Surfing Penguin",
        coin_value: 499,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f13a3c11c4156fe89397c66300d6ce20.png~tplv-obj.webp",
    },
    surprise_baby_mob: {
        name: "Surprise Baby Mob",
        coin_value: 2999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f074f1f73a40902e6087c6ccc747b88f.png~tplv-obj.webp",
    },
    swan: {
        name: "Swan",
        coin_value: 699,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/97a26919dbf6afe262c97e22a83f4bf1~tplv-obj.webp",
    },
    sweet_flutter: {
        name: "Sweet Flutter",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f70e199a23a5ff232ce241d07c3dc99b.png~tplv-obj.webp",
    },
    team_bracelet: {
        name: "Team Bracelet",
        coin_value: 2,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/54cb1eeca369e5bea1b97707ca05d189.png~tplv-obj.webp",
    },
    the_crown: {
        name: "The Crown",
        coin_value: 199,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5bf798f92fe96ba53c0f4d28f052f9bb~tplv-obj.webp",
    },
    thumbs_up: {
        name: "Thumbs Up",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/570a663e27bdc460e05556fd1596771a~tplv-obj.webp",
    },
    thunder_falcon: {
        name: "Thunder Falcon",
        coin_value: 39999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/26f3fbcda383e6093a19b8e7351a164c~tplv-obj.webp",
    },
    tidecaller_trident: {
        name: "Tidecaller Trident",
        coin_value: 14999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/7bb5606841ee8deaec981c85587ab2be.png~tplv-obj.webp",
    },
    tiger_lift: {
        name: "Tiger Lift",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5150422ca02095eef30bd508fe0b7cdd.png~tplv-obj.webp",
    },
    tiktok: {
        name: "TikTok",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.webp",
    },
    tiktok_crown: {
        name: "TikTok Crown",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/77289ae44d635380fa88e7bdfcfdc408.png~tplv-obj.webp",
    },
    tiktok_shuttle: {
        name: "TikTok Shuttle",
        coin_value: 20000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8ef48feba8dd293a75ae9d4376fb17c9~tplv-obj.webp",
    },
    tiktok_stars: {
        name: "TikTok Stars",
        coin_value: 39999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b1667c891ed39fd68ba7252fff7a1e7c~tplv-obj.webp",
    },
    tiktok_universe: {
        name: "TikTok Universe",
        coin_value: 44999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8f471afbcebfda3841a6cc515e381f58~tplv-obj.webp",
    },
    tiny_diny_float: {
        name: "Tiny Diny Float",
        coin_value: 250,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/07f2f1c77323dc05300d25723fc6453a.png~tplv-obj.webp",
    },
    tom_s_hug: {
        name: "Tom's Hug",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/30ba2b172614d3c2da0e7caaca333b41.png~tplv-obj.webp",
    },
    train: {
        name: "Train",
        coin_value: 899,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4227ed71f2c494b554f9cbe2147d4899~tplv-obj.webp",
    },
    travel_with_you: {
        name: "Travel with You",
        coin_value: 999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/753098e5a8f45afa965b73616c04cf89~tplv-obj.webp",
    },
    treasured_voice: {
        name: "Treasured Voice",
        coin_value: 249,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/99bb73b9eb5851a2bcafadb6fe9a9815.png~tplv-obj.webp",
    },
    trending_figure: {
        name: "Trending Figure",
        coin_value: 999,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/df7b556ccf369bf9a42fe83ec8a77acf.png~tplv-obj.webp",
    },
    tundra_blitzy: {
        name: "Tundra Blitzy",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/eedbfd263f8817d34f3690900cb571b9.png~tplv-obj.webp",
    },
    tundra_cooper: {
        name: "Tundra Cooper",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/2a60e733698f3cb36904bb716d736d2a.png~tplv-obj.webp",
    },
    tundra_diny: {
        name: "Tundra Diny",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/a689e0a5a9f88b2f6225f5db8411f8ca.png~tplv-obj.webp",
    },
    tundra_nyota: {
        name: "Tundra Nyota",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5d9f94bcddf86ff5e6c37c518af3b72e.png~tplv-obj.webp",
    },
    tundra_tom: {
        name: "Tundra Tom",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dfee67f570dd81056ac2f3d783959a98.png~tplv-obj.webp",
    },
    umbrella_of_love: {
        name: "Umbrella of Love",
        coin_value: 1200,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3b1e8de86d841496b87567014827537b.png~tplv-obj.webp",
    },
    under_control: {
        name: "Under Control",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/af67b28480c552fd8e8c0ae088d07a1d.png~tplv-obj.webp",
    },
    undersea_kingdom: {
        name: "Undersea Kingdom",
        coin_value: 25999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/13f9ea9d3798f67f6d55cc612c152338.png~tplv-obj.webp",
    },
    unicorn_fantasy: {
        name: "Unicorn Fantasy",
        coin_value: 5000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/483c644e67e9bb1dd5970f2df00b7576~tplv-obj.webp",
    },
    uniform: {
        name: "Uniform",
        coin_value: 999,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/cf2cc168b7a01054788c551a83dd0380.png~tplv-obj.webp",
    },
    united_heart: {
        name: "United Heart",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/72ff280b8c6ce16f6efc9bf4cd6a036b.png~tplv-obj.webp",
    },
    valiant_odyssey: {
        name: "Valiant Odyssey",
        coin_value: 5888,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3b238017dd782ab45f8243abde1406e7.png~tplv-obj.webp",
    },
    vibrant_stage: {
        name: "Vibrant Stage",
        coin_value: 1400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/ae0a1abca4313c916e2a4e40813d90d6.png~tplv-obj.webp",
    },
    viking_hammer: {
        name: "Viking Hammer",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5b95101816bc9f61f65bd265641ef4d6.png~tplv-obj.webp",
    },
    vintage_flight: {
        name: "Vintage flight",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e9764af4b6dce95b8f993b3902eb1d76.png~tplv-obj.webp",
    },
    vinyl_flip: {
        name: "Vinyl Flip",
        coin_value: 349,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5f5ed81e3e714fc1a30ec6efd379cd91.png~tplv-obj.webp",
    },
    vocal_bear: {
        name: "Vocal Bear",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/3afb4aeb6abf9335864ce85f364156e2.png~tplv-obj.webp",
    },
    vr_goggles: {
        name: "VR Goggles",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/18c51791197b413bbd1b4f1b983bda36.png~tplv-obj.webp",
    },
    wakey_mallow: {
        name: "Wakey Mallow",
        coin_value: 299,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dc170f6fcc00a7253cd0744d7b01809d.png~tplv-obj.webp",
    },
    watermelon_love: {
        name: "Watermelon Love",
        coin_value: 1000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/1d1650cd9bb0e39d72a6e759525ffe59~tplv-obj.webp",
    },
    wave_lights: {
        name: "Wave Lights",
        coin_value: 2200,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/5734e71ba84d872c08d8c68e94b5ce36.png~tplv-obj.webp",
    },
    whale_diving: {
        name: "Whale Diving",
        coin_value: 2150,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/46fa70966d8e931497f5289060f9a794~tplv-obj.webp",
    },
    wild_mic: {
        name: "Wild Mic",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/61e7dc294d766a81abf7bce5591db60c.png~tplv-obj.webp",
    },
    wink_charm: {
        name: "Wink Charm",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/295d753e095c6ac8b180691f20d64ea8.png~tplv-obj.webp",
    },
    wink_wink: {
        name: "Wink wink",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4a68411b3e92fc2bf68d458d5f906b74.png~tplv-obj.webp",
    },
    wishing_cake: {
        name: "Wishing Cake",
        coin_value: 400,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6142c30d6b06c1c7748709e02f1293ab.png~tplv-obj.webp",
    },
    wolf: {
        name: "Wolf",
        coin_value: 5500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/002d5e13fd6cd18b7574b43dc4fd13ae.png~tplv-obj.webp",
    },
    work_hard_play_harder: {
        name: "Work Hard Play Harder",
        coin_value: 6000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/3257e15b3f6697aed88b4ac51b816603.png~tplv-obj.webp",
    },
    xmas_tree_hat: {
        name: "Xmas Tree Hat",
        coin_value: 449,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/07611650030bc00a33787a7a0d91dcec.png~tplv-obj.webp",
    },
    xxxl_flowers: {
        name: "XXXL Flowers",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/f1ead695e8281b7387e40d48fc6b1fb0.png~tplv-obj.webp",
    },
    you_are_loved: {
        name: "You Are Loved",
        coin_value: 399,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/4d9bbf004850dfc97cfaae9859c1c28d.png~tplv-obj.webp",
    },
    you_re_amazing: {
        name: "You’re Amazing",
        coin_value: 500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/b48c69f4df49c28391bcc069bbc31b41.png~tplv-obj.webp",
    },
    you_re_awesome: {
        name: "You're awesome",
        coin_value: 1,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/e9cafce8279220ed26016a71076d6a8a.png~tplv-obj.webp",
    },
    you_re_so_fly: {
        name: "You're So Fly",
        coin_value: 1500,
        picture: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/6250163a81c588fca53191e2ae01031a.png~tplv-obj.webp",
    },
    your_concert: {
        name: "Your Concert",
        coin_value: 4500,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/86c9c8fb5aa76488b075f139dd575dfe.png~tplv-obj.webp",
    },
    zeus: {
        name: "Zeus",
        coin_value: 34000,
        picture: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/01793f9afe15f5037a9dc10435c37c85.png~tplv-obj.webp",
    },
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
