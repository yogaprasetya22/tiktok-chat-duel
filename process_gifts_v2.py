import re

content = open('/home/yoga/Dokumen/kroco/tiktok-next/src/core/logic/gift/giftDictionary.ts', 'r').read()

# Extract keys and coin values
gifts = []
matches = re.finditer(r'^\s{4}([a-z0-9_]+):\s+\{.*?name:\s+"(.*?)".*?coin_value:\s+(\d+)', content, re.DOTALL | re.MULTILINE)

for match in matches:
    key = match.group(1).replace('_', ' ')
    name = match.group(2).lower()
    coin = int(match.group(3))
    gifts.append({'keyword': key, 'coin': coin})

gifts.sort(key=lambda x: x['coin'])

side_a = []
side_b = []

for i, g in enumerate(gifts):
    if i % 2 == 0:
        side_a.append(g)
    else:
        side_b.append(g)

def get_formation(coin, keyword):
    if coin >= 1000:
        return "tier5_apocalypse"
    
    k = keyword.lower()
    # Logic to map to only the IDs in GIFT_FORMATIONS: 
    # tier5_vanguard, tier5_artillery, tier5_sorcery, tier5_assassins, tier5_berserkers, tier4_vanguard
    
    if any(x in k for x in ['rose', 'heart', 'love', 'flower', 'perfume', 'crown', 'necklace', 'bouquet', 'kiss', 'hug', 'awesome', 'amazing']):
        return "tier5_vanguard"
    if any(x in k for x in ['gg', 'weight', 'gun', 'bow', 'star', 'ball', 'trophy', 'game', 'helmet', 'boxing', 'sport']):
        return "tier5_artillery"
    if any(x in k for x in ['tiktok', 'ice cream', 'candy', 'cake', 'doughnut', 'magic', 'wand', 'potion', 'crystal', 'boba', 'tea', 'juice', 'coffee', 'food', 'rice', 'chocolate', 'gum']):
        return "tier5_sorcery"
    if any(x in k for x in ['cat', 'cheetah', 'bird', 'jet', 'plane', 'car', 'speed', 'fast', 'wing', 'wind', 'falcon', 'assassin', 'phantom', 'ninja', 'run', 'fly']):
        return "tier5_assassins"
    if any(x in k for x in ['fire', 'hammer', 'axe', 'sword', 'dragon', 'lion', 'wolf', 'bear', 'gorilla', 'punch', 'berserker', 'raid', 'elite', 'champion']):
        return "tier5_berserkers"
    
    # User's manual diff shows they like tier5_vanguard as a default for small things
    return "tier5_vanguard"

print("PLAYER A BINDINGS:")
for g in side_a:
    form = get_formation(g['coin'], g['keyword'])
    print(f'              {{ keyword: "{g["keyword"]}", formationId: "{form}" }},')

print("\nENEMY B BINDINGS:")
for g in side_b:
    form = get_formation(g['coin'], g['keyword'])
    print(f'              {{ keyword: "{g["keyword"]}", formationId: "{form}" }},')

