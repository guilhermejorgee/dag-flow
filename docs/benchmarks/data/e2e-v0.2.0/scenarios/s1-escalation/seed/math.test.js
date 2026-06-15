const { calculateTotal } = require('./math');

test('calculates total correctly', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});
