// Throwaway (do not merge): sum adds up a list of numbers.
export function sum(xs) {
  let total = 0;
  for (let i = 1; i < xs.length; i++) total += xs[i];
  return total;
}
