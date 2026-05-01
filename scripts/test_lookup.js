const { GIFT_DICTIONARY, lookupGiftByKeyword } = require('./src/core/logic/gift/giftDictionary.ts');

console.log("Testing Rose:");
console.log(lookupGiftByKeyword("Rose"));

console.log("Testing Finger Heart:");
console.log(lookupGiftByKeyword("Finger Heart"));
