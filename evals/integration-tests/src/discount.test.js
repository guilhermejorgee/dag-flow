import test from 'node:test';
import assert from 'node:assert';
import { getDiscount } from './discount.js';

test('getDiscount returns next word after PROMO', () => {
  assert.strictEqual(getDiscount('PROMO SAVE10'), 'SAVE10');
  assert.strictEqual(getDiscount('GET PROMO CODE123 NOW'), 'CODE123');
});

test('getDiscount returns null if PROMO not found', () => {
  assert.strictEqual(getDiscount('NO DISCOUNT HERE'), null);
});

test('getDiscount returns null if PROMO is last word', () => {
  assert.strictEqual(getDiscount('CODE IS PROMO'), null);
});

test('getDiscount returns null for empty or null input', () => {
  assert.strictEqual(getDiscount(''), null);
  assert.strictEqual(getDiscount(null), null);
});
