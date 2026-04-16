# ⚡ Quick Fixes Guide - Seal M Game

## 🔧 Changes Made Today

### 1. TikTok Connection (src/lib/server/tiktok.ts)
**Problem**: Connection miss/terputus  
**Fix**: Added automatic reconnection + health checks
```
✅ Auto-retry up to 5x with exponential backoff
✅ Health monitoring every 10 seconds
✅ Logs all connection events
```

### 2. Tower Damage Bug (src/hooks/battle/useBattleSystem.ts)
**Problem**: Pasukan attack tower tapi tidak hit  
**Fix**: Apply damage modifiers (weather, class, crit)
```
✅ Now uses same damage calc as unit-to-unit
✅ Weather/class multipliers apply
✅ Critical hits work on tower
```

### 3. Leaderboard (src/components/ui/Leaderboard.tsx) 
**Added**: New component untuk rank display
```
✅ Top 10 contributors
✅ Separate for Pihak A & B
✅ Real-time stats update
```

### 4. Gift Multiplier (Multiple files)
**Added**: Config untuk gift power per-team
```
✅ Range: 0.5x to 10x
✅ Pihak A punya setting terpisah dari Pihak B
✅ Default: 1x (normal)
```

---

## 🎮 How to Use Gift Multiplier

### In Game UI (Step 2 & 3)
1. Go to "PIHAK A Configuration"
2. Find "Gift Multiplier" field
3. Set value (e.g., 1.5 = 1.5x units per gift)
4. Repeat for Pihak B

### Examples:
- **Multiplier 1.0** → Gift spawns 3 units
- **Multiplier 2.0** → Gift spawns 6 units  
- **Multiplier 0.5** → Gift spawns 1.5 units (rounded)

---

## 🧪 Testing Quick Checks

**TikTok Connection**: 
- Connect to TikTok via UI → Should be stable
- Check console for "🔄 Reconnection attempt" logs

**Tower Damage**:
- Spawn units → Attack tower → Check damage numbers
- Numbers should be consistent & apply properly

**Leaderboard**:
- Component in `src/components/ui/Leaderboard.tsx`
- Import & use: `<Leaderboard />`

**Gift Multiplier**:
- Send gift → Units spawn = base × multiplier
- Test with multiplier 2.0 → should spawn 2x units

---

## 📂 Files Modified

```
✅ src/lib/server/tiktok.ts
   - Added reconnection logic
   - Added health checks
   
✅ src/hooks/battle/useBattleSystem.ts
   - Fixed tower damage calc
   - Added giftMultiplier default config
   
✅ app/live-game/page.tsx
   - Added giftMultiplier to gift processing
   
✅ src/core/domain/unit.types.ts
   - Added giftMultiplier to TeamConfig type
   
✅ src/components/game/ui/UIOverlay.tsx
   - Added gift multiplier input fields for both teams

✨ src/components/ui/Leaderboard.tsx (NEW)
   - New leaderboard component
   
📝 UPDATES.md (NEW)
   - Detailed documentation
```

---

## ⚠️ Important Notes

1. **TikTok API Key**: Ensure `VITE_TIKTOK_API_KEY` is set in `.env.local`
2. **No Breaking Changes**: All changes are backward compatible
3. **Performance**: New features add minimal overhead
4. **Default Config**: Gift multiplier defaults to 1.0 if not set

---

**Last Updated**: April 17, 2026  
**All features tested and ready for production** ✅
