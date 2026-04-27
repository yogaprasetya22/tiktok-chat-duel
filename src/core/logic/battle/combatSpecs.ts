import { ClassKey } from "../../domain/unit.types";

export const RARITY_WEIGHTS = {
    common: 75,
    elite: 15,
    epic: 8,
    legendary: 2
};

export const RARITY_BONUS_MATRIX = {
    common:    { hp: 0,    atk: 0,    as: 0,    crit: 0,    ls: 0,    def: 0 },
    elite:     { hp: 0.3,  atk: 0.2,  as: 0.1,  crit: 0.05, ls: 0.05, def: 10 },
    epic:      { hp: 0.7,  atk: 0.5,  as: 0.25, crit: 0.15, ls: 0.1,  def: 25 },
    legendary: { hp: 1.5,  atk: 1.2,  as: 0.5,  crit: 0.35, ls: 0.2,  def: 50 }
};

export const applyClassSpecialization = (u: any, unitClass: ClassKey, rarityBonus: any, classConfig: any, settings: any) => {
    const baseAS = classConfig.attack_speed_mult || 1.0;
    let asMult = 1.0;

    switch (unitClass) {
        case 'marksman':
            u.hp *= (1 + rarityBonus.hp * 0.6);
            u.attack *= (1 + rarityBonus.atk * 1.8);
            asMult = (1 + rarityBonus.as * 2.0);
            u.critChance = 0.05 + rarityBonus.crit * 0.8;
            break;
        case 'assassin':
            u.hp *= (1 + rarityBonus.hp * 0.5); // Reduced from 1.2 (Glass Cannon)
            u.attack *= (1 + rarityBonus.atk * 1.0);
            asMult = (1 + rarityBonus.as * 0.8);
            u.critChance = 0.10 + rarityBonus.crit * 1.5;
            u.lifesteal = rarityBonus.ls * 0.4; // Reduced from 1.2 to prevent "immortality"
            break;
        case 'tank':
            u.hp *= (1 + rarityBonus.hp * 3.5); // Buffed from 2.5 to be a true wall
            u.attack *= (1 + rarityBonus.atk * 0.4);
            u.physicalDefense = 35 + rarityBonus.def * 2.5; // Buffed base from 20
            u.magicDefense = 20 + rarityBonus.def * 2.0;    // Buffed base from 10
            break;
        case 'fighter':
            u.hp *= (1 + rarityBonus.hp * 1.5);
            u.attack *= (1 + rarityBonus.atk * 1.2);
            u.lifesteal = rarityBonus.ls * 0.8;
            break;
        case 'mage':
            u.hp *= (1 + rarityBonus.hp * 0.8);
            u.attack *= (1 + rarityBonus.atk * 2.2);
            asMult = (1 + rarityBonus.as * 1.2);
            u.spellVamp = rarityBonus.ls || 0;
            break;
    }

    u.attackCooldown = settings.globalAttackCooldown / (baseAS * asMult);
    return u;
};
