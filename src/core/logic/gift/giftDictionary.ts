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
    hp: number;              // HP multiplier (1.0 = default)
    attack: number;          // Attack multiplier
    defense: number;         // Defense (physical + magic) multiplier
    speed: number;           // Movement speed multiplier
  };
}

/**
 * Enhanced gift definition including unit composition and properties
 */
export interface GiftDefinition {
  name: string;
  coin_value: number;
  spawn_tier: number;
  
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

export const GIFT_DICTIONARY: GiftDictionary = {
  rose: { name: "Rose", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  gg: { name: "GG", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  pop: { name: "Pop", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  creeper: { name: "Creeper", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  youre_awesome: { name: "You're awesome", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  love_you_so_much: { name: "Love you so much", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  tiktok: { name: "TikTok", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  wink_wink: { name: "Wink wink", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  ice_cream_cone: { name: "Ice Cream Cone", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  glow_stick: { name: "Glow Stick", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  freestyle: { name: "Freestyle", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  cake_slice: { name: "Cake Slice", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  oldies: { name: "Oldies", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  heart_me: { name: "Heart Me", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  so_cute: { name: "So Cute", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  placeholder: { name: "Placeholder", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  coffee: { name: "Coffee", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  orange_juice: { name: "Orange Juice", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  thumbs_up: { name: "Thumbs Up", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  heart: { name: "Heart", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  love_you: { name: "Love you", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  fairy_wings: { name: "Fairy wings", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  headphone: { name: "Headphone", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  blow_a_kiss: { name: "Blow a kiss", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  power_hug: { name: "Power hug", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  congratulations: { name: "Congratulations", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  fried: { name: "Fried", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  music_album: { name: "Music Album", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  wink_charm: { name: "Wink Charm", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  go_popular: { name: "Go Popular", coin_value: 1, spawn_tier: 1, spawn_count: 1 },
  club_cheers: { name: "Club Cheers", coin_value: 1, spawn_tier: 1, spawn_count: 1 },

  team_bracelet: { name: "Team Bracelet", coin_value: 2, spawn_tier: 1, spawn_count: 2 },

  finger_heart: { name: "Finger Heart", coin_value: 5, spawn_tier: 2, spawn_count: 1 },
  overreact: { name: "Overreact", coin_value: 5, spawn_tier: 2, spawn_count: 1 },
  name_shoutout: { name: "Name shoutout", coin_value: 5, spawn_tier: 2, spawn_count: 1 },
  duit_raya: { name: "Duit Raya", coin_value: 5, spawn_tier: 2, spawn_count: 1 },
  padang_rice: { name: "Padang Rice", coin_value: 5, spawn_tier: 2, spawn_count: 1 },

  super_popular: { name: "Super Popular", coin_value: 9, spawn_tier: 2, spawn_count: 2 },
  cheer_you_up: { name: "Cheer You Up", coin_value: 9, spawn_tier: 2, spawn_count: 2 },
  club_power: { name: "Club Power", coin_value: 9, spawn_tier: 2, spawn_count: 2 },

  rosa: { name: "Rosa", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  friendship_necklace: { name: "Friendship Necklace", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  journey_pass: { name: "Journey Pass", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  slow_motion: { name: "Slow motion", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  chocolate: { name: "Chocolate", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  lucky_pony: { name: "Lucky Pony", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  league_ball: { name: "League Ball", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  i_love_you: { name: "I love you", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  style_me_up: { name: "Style Me Up", coin_value: 10, spawn_tier: 2, spawn_count: 2 },
  heart_gaze: { name: "Heart Gaze", coin_value: 10, spawn_tier: 2, spawn_count: 2 },

  bravo: { name: "Bravo!", coin_value: 15, spawn_tier: 3, spawn_count: 1 },
  perfume: { name: "Perfume", coin_value: 20, spawn_tier: 3, spawn_count: 1 },
  doughnut: { name: "Doughnut", coin_value: 30, spawn_tier: 3, spawn_count: 2 },
  bouquet_flower: { name: "Bouquet Flower", coin_value: 30, spawn_tier: 3, spawn_count: 2 },

  paper_crane: { name: "Paper Crane", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  little_crown: { name: "Little Crown", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  cap: { name: "Cap", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  hat_and_mustache: { name: "Hat and Mustache", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  like_pop: { name: "Like-Pop", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  cupids_bow: { name: "Cupid's Bow", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  love_painting: { name: "Love Painting", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  bubble_gum: { name: "Bubble Gum", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  mark_of_love: { name: "Mark of Love", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  batik_bucket_hat: { name: "Batik Bucket Hat", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  sundae_bowl: { name: "Sundae Bowl", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  charmer_bow: { name: "Charmer Bow", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  club_victory: { name: "Club Victory", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  level_up_sparks: { name: "Level-up Sparks", coin_value: 99, spawn_tier: 4, spawn_count: 1 },
  greeting_heart: { name: "Greeting Heart", coin_value: 99, spawn_tier: 4, spawn_count: 1 },

  game_controller: { name: "Game Controller", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  super_gg: { name: "Super GG", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  mishka_bear: { name: "Mishka Bear", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  confetti: { name: "Confetti", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  hand_hearts: { name: "Hand Hearts", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  chicken_and_cola: { name: "Chicken and Cola", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  bouquet: { name: "Bouquet", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  singing_magic: { name: "Singing Magic", coin_value: 100, spawn_tier: 4, spawn_count: 1 },
  marvelous_confetti: { name: "Marvelous Confetti", coin_value: 100, spawn_tier: 4, spawn_count: 1 },

  bowknot: { name: "Bowknot", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  big_shout_out: { name: "Big Shout Out", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  chatting_popcorn: { name: "Chatting Popcorn", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  masquerade: { name: "Masquerade", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  balloon_crown: { name: "Balloon Crown", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  feather_tiara: { name: "Feather Tiara", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  caterpillar_chaos: { name: "Caterpillar Chaos", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  catrina: { name: "Catrina", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  raving_snail: { name: "Raving Snail", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  santa_cocoa: { name: "Santa Cocoa", coin_value: 149, spawn_tier: 5, spawn_count: 1 },
  love_glasses: { name: "Love Glasses", coin_value: 149, spawn_tier: 5, spawn_count: 1 },

  song_of_harvest: { name: "Song of Harvest", coin_value: 150, spawn_tier: 5, spawn_count: 1 },

  league_countdown: { name: "League Countdown", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  sunglasses: { name: "Sunglasses", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  hearts: { name: "Hearts", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  garland_headpiece: { name: "Garland Headpiece", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  love_you_199: { name: "Love You", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  pinch_cheek: { name: "Pinch Cheek", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  cheer_for_you: { name: "Cheer For You", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  the_crown: { name: "The Crown", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  stinging_bee: { name: "Stinging Bee", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  massage_for_you: { name: "Massage for You", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  coffee_magic: { name: "Coffee Magic", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  cheering_crab: { name: "Cheering Crab", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  dancing_hands: { name: "Dancing Hands", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  floating_octopus: { name: "Floating Octopus", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  flower_headband: { name: "Flower Headband", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  goalkeeper_save: { name: "Goalkeeper Save", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  sour_buddy: { name: "Sour Buddy", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  rose_hand: { name: "Rose Hand", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  indoor_fan: { name: "Indoor Fan", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  melon_juice: { name: "Melon Juice", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  coconut_juice: { name: "Coconut Juice", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  chirpy_kisses: { name: "Chirpy Kisses", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  side_by_side: { name: "Side by Side", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  juicy_smile: { name: "Juicy Smile", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  joker_ball: { name: "Joker Ball", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  heart_hood: { name: "Heart Hood", coin_value: 199, spawn_tier: 5, spawn_count: 2 },
  party_pony: { name: "Party Pony", coin_value: 199, spawn_tier: 5, spawn_count: 2 },

  diamond_heart_necklace: { name: "Diamond Heart necklace", coin_value: 200, spawn_tier: 6, spawn_count: 1 },
  gold_necklace: { name: "Gold necklace", coin_value: 200, spawn_tier: 6, spawn_count: 1 },
  balloons: { name: "Balloons", coin_value: 200, spawn_tier: 6, spawn_count: 1 },
  magic_genie: { name: "Magic Genie", coin_value: 200, spawn_tier: 6, spawn_count: 1 },

  rose_bear: { name: "Rose Bear", coin_value: 214, spawn_tier: 6, spawn_count: 1 },
  cat: { name: "Cat", coin_value: 222, spawn_tier: 6, spawn_count: 1 },

  pinch_face: { name: "Pinch Face", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  candy_bouquet: { name: "Candy Bouquet", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  ice_cream_mic: { name: "Ice Cream Mic", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  star_goggles: { name: "Star Goggles", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  cheer_mic: { name: "Cheer Mic", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  music_bubbles: { name: "Music Bubbles", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  palm_breeze: { name: "Palm Breeze", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  forest_elf: { name: "Forest Elf", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  face_pulling: { name: "Face-pulling", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  treasured_voice: { name: "Treasured Voice", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  melodic_birds: { name: "Melodic birds", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  surfing_penguin: { name: "Surfing Penguin", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  party_blossom: { name: "Party Blossom", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  dreamy_strings: { name: "Dreamy Strings", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  sweet_flutter: { name: "Sweet Flutter", coin_value: 249, spawn_tier: 6, spawn_count: 1 },
  snow_bloom: { name: "Snow Bloom", coin_value: 249, spawn_tier: 6, spawn_count: 1 },

  tiny_diny_float: { name: "Tiny Diny Float", coin_value: 250, spawn_tier: 6, spawn_count: 1 },

  live_ranking_crown: { name: "LIVE Ranking Crown", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  boxing_gloves: { name: "Boxing Gloves", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  corgi: { name: "Corgi", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  fruit_friends: { name: "Fruit Friends", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  naughty_chicken: { name: "Naughty Chicken", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  play_for_you: { name: "Play for You", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  rock_star: { name: "Rock Star", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  butterfly_for_you: { name: "Butterfly for You", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  starlight_compass: { name: "Starlight Compass", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  puppy_kisses: { name: "Puppy Kisses", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  united_heart: { name: "United Heart", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  kicker_challenge: { name: "Kicker Challenge", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  hi_rosie: { name: "Hi! Rosie!", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  pawfect: { name: "Pawfect", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  go_hamster: { name: "Go Hamster", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  tiktok_crown: { name: "TikTok Crown", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  bat_headwear: { name: "Bat Headwear", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  melody_glasses: { name: "Melody Glasses", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  penguin_snowpal: { name: "Penguin Snowpal", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  music_mate: { name: "Music Mate", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  love_call: { name: "Love Call", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  pony_lantern: { name: "Pony Lantern", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  spring_sprout: { name: "Spring Sprout", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  eid_gift_box: { name: "EID Gift Box", coin_value: 299, spawn_tier: 7, spawn_count: 1 },
  budding_heart: { name: "Budding Heart", coin_value: 299, spawn_tier: 7, spawn_count: 1 },

  diamond_ring_of_love: { name: "Diamond ring of love", coin_value: 300, spawn_tier: 8, spawn_count: 1 },
  tambourine: { name: "Tambourine", coin_value: 300, spawn_tier: 8, spawn_count: 1 },
  feather_mask: { name: "Feather Mask", coin_value: 300, spawn_tier: 8, spawn_count: 1 },
  air_dancer: { name: "Air Dancer", coin_value: 300, spawn_tier: 8, spawn_count: 1 },
};

/**
 * Helper function to look up a gift by matching keywords
 * Returns the first matching gift definition or undefined
 */
export function lookupGiftByKeyword(giftName: string): GiftDefinition | undefined {
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
