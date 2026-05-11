import re

content = open('/home/yoga/Dokumen/kroco/tiktok-next/src/core/logic/gift/giftDictionary.ts', 'r').read()

# Extract keys and coin values
gifts = []
# Match keys that look like:   key_name: {
# Using a simpler regex to catch more
matches = re.finditer(r'^\s{4}([a-z0-9_]+):\s+\{.*?name:\s+"(.*?)".*?coin_value:\s+(\d+)', content, re.DOTALL | re.MULTILINE)

for match in matches:
    key = match.group(1).replace('_', ' ')
    name = match.group(2).lower()
    coin = int(match.group(3))
    gifts.append({'keyword': key, 'coin': coin})

# Sort by coin value to distribute evenly
gifts.sort(key=lambda x: x['coin'])

# Divide into A and B
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
    if any(x in k for x in ['rose', 'heart', 'love', 'flower', 'perfume', 'crown', 'necklace', 'bouquet']):
        return "tier5_vanguard"
    if any(x in k for x in ['gg', 'weight', 'gun', 'bow', 'star', 'ball', 'trophy', 'game']):
        return "tier5_artillery"
    if any(x in k for x in ['tiktok', 'ice cream', 'candy', 'cake', 'doughnut', 'magic', 'wand', 'potion', 'crystal']):
        return "tier5_sorcery"
    if any(x in k for x in ['cat', 'cheetah', 'bird', 'jet', 'plane', 'car', 'speed', 'fast', 'wing', 'wind', 'falcon']):
        return "tier5_assassins"
    if any(x in k for x in ['fire', 'boxing', 'hammer', 'axe', 'sword', 'dragon', 'lion', 'wolf', 'bear', 'gorilla', 'punch']):
        return "tier5_berserkers"
    
    return "tier4_vanguard"

print("PLAYER A BINDINGS:")
for g in side_a:
    form = get_formation(g['coin'], g['keyword'])
    print(f'              {{ keyword: "{g["keyword"]}", formationId: "{form}" }},')

print("\nENEMY B BINDINGS:")
for g in side_b:
    form = get_formation(g['coin'], g['keyword'])
    print(f'              {{ keyword: "{g["keyword"]}", formationId: "{form}" }},')

