import { ActiveUnit, UnitRuntimeData } from "../../domain/unit.types";

export interface CombatResult {
    damage: number;
    isCrit: boolean;
    lethal: boolean;
}

export const calculateProcessedDamage = (
    attacker: ActiveUnit,
    target: ActiveUnit,
    isPendingCrit: boolean
): { dmg: number; isCrit: boolean } => {
    let dmg = attacker.attack;
    const isCrit = Math.random() < (attacker.critChance || 0) || isPendingCrit;
    
    if (isCrit) {
        dmg *= 1.8; // Reduced from 2.5 for better combat stability
    }

    // Defense logic
    let targetDefense = attacker.unitClass === 'mage' 
        ? (target.magicDefense || 0) 
        : (target.physicalDefense || 0);

    if (target.isArmorBroken && attacker.unitClass !== 'mage') {
        targetDefense = 0;
    }
        
    const armorPierce = attacker.unitClass === 'marksman' ? 0.4 : 0;
    const effectiveDefense = Math.max(0, targetDefense * (1 - armorPierce));
    
    // Percentage-based damage reduction (MOBA style)
    // 100 defense = 50% damage taken, 200 defense = 33% damage taken, 400 defense = 20% damage taken
    const damageMultiplier = 100 / (100 + effectiveDefense);
    
    dmg = Math.max(1, dmg * damageMultiplier);

    // Fortress Shield (Immunity - 100% Damage Reduction)
    if (target.isShield) {
        dmg = 0;
    }

    return { dmg, isCrit };
};

export const applySustain = (unit: ActiveUnit, uData: UnitRuntimeData, dmg: number, vhArray: Float32Array, idx: number) => {
    const healPerc = unit.unitClass === 'mage' ? (unit.spellVamp || 0) : (unit.lifesteal || 0);
    if (healPerc > 0 && unit.hp < unit.maxHp) {
        const healAmount = dmg * healPerc;
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        uData.hp = unit.hp;
        vhArray[idx] = unit.hp;
    }
};
