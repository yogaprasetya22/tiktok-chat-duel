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
    const targetDefense = attacker.unitClass === 'mage' 
        ? (target.magicDefense || 0) 
        : (target.physicalDefense || 0);
        
    const armorPierce = attacker.unitClass === 'marksman' ? 0.4 : 0;
    const effectiveDefense = targetDefense * (1 - armorPierce);
    
    dmg = Math.max(dmg * 0.1, dmg - effectiveDefense);

    // Fortress Shield (70% Damage Reduction)
    if (target.isShield) {
        dmg *= 0.3;
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
