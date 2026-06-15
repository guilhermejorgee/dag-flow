function calculateTotal(items) {
  let totla = 0; // Intentional typo
  for (let item of items) {
    totla += item.price;
  }
  return total; // Will throw ReferenceError: total is not defined
}

module.exports = { calculateTotal };
