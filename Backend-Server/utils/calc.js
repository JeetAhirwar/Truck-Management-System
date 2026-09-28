/**
 * Core Calculation Engine
 * All formulas live here — frontend only displays results + breakdown
 */

function calculateFuel(distance, mileage) {
  try {
    const dist = Number(distance);
    const mil = Number(mileage) || 1;
    if (!Number.isFinite(dist) || dist < 0) {
      return { fuelRequired: 0, formula: 'Invalid distance' };
    }
    if (mil <= 0) return { fuelRequired: 0, formula: 'Invalid mileage' };
    const fuelRequired = Math.round((dist / mil) * 100) / 100;
    return {
      fuelRequired,
      formula: `${dist} km ÷ ${mil} km/L = ${fuelRequired} L`
    };
  } catch (err) {
    return { fuelRequired: 0, formula: 'Error' };
  }
}

function calculateFuelCost(fuelRequired, fuelPrice) {
  try {
    const fuel = Number(fuelRequired) || 0;
    const price = Number(fuelPrice) || 0;
    const cost = Math.round(fuel * price);
    return {
      fuelCost: cost,
      formula: `${fuel} L × ₹${price}/L = ₹${cost.toLocaleString()}`
    };
  } catch (err) {
    return { fuelCost: 0, formula: 'Error' };
  }
}

/**
 * Format seconds -> "2h 15m".
 * Rounding is done once on total minutes so "1h 60m" can never happen.
 */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

function calculateTravelTime(distance, avgSpeed) {
  try {
    const dist = Number(distance);
    const speed = Number(avgSpeed);
    if (!Number.isFinite(dist) || dist < 0) {
      return { hours: 0, display: '0h 0m', formula: 'Invalid distance' };
    }
    if (!Number.isFinite(speed) || speed <= 0) {
      return { hours: 0, display: '0h 0m', formula: 'Invalid speed' };
    }
    const hours = dist / speed;
    const display = formatDuration(hours * 3600);
    return {
      hours: Math.round(hours * 10) / 10,
      display,
      formula: `${dist} km ÷ ${speed} km/h = ${display}`
    };
  } catch (err) {
    return { hours: 0, display: '0h 0m', formula: 'Error' };
  }
}

function calculateProfit({ revenue, fuelCost, tollCost, driverExpense, otherExpenses }) {
  try {
    const rev = Number(revenue) || 0;
    const fuel = Number(fuelCost) || 0;
    const toll = Number(tollCost) || 0;
    const driver = Number(driverExpense) || 0;
    const other = Number(otherExpenses) || 0;
    const totalExpense = fuel + toll + driver + other;
    const profit = rev - totalExpense;
    const profitPercent = rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0;
    return {
      totalExpense,
      profit,
      profitPercent,
      breakdown: {
        fuel,
        toll,
        driver,
        other,
        totalExpense,
        revenue: rev,
        profit,
        profitPercent
      }
    };
  } catch (err) {
    return { totalExpense: 0, profit: 0, profitPercent: 0, breakdown: {} };
  }
}

function fullTripCalc({ distance, mileage, fuelPrice, avgSpeed, revenue, tollCost, driverExpense, otherExpenses }) {
  try {
    const fuel = calculateFuel(distance, mileage);
    const fuelCost = calculateFuelCost(fuel.fuelRequired, fuelPrice);
    const time = calculateTravelTime(distance, avgSpeed);
    const profit = calculateProfit({
      revenue,
      fuelCost: fuelCost.fuelCost,
      tollCost,
      driverExpense,
      otherExpenses
    });
    return {
      distance: Number(distance) || 0,
      mileage: Number(mileage) || 0,
      fuelRequired: fuel.fuelRequired,
      fuelFormula: fuel.formula,
      fuelCost: fuelCost.fuelCost,
      fuelCostFormula: fuelCost.formula,
      travelTime: time.display,
      travelTimeHours: time.hours,
      travelTimeFormula: time.formula,
      ...profit
    };
  } catch (err) {
    console.error('Calc error:', err.message);
    return null;
  }
}

/**
 * Rejects negative / NaN / empty distances before any math runs.
 */
function validateDistance(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: false, error: 'Distance is required' };
  }
  const d = Number(value);
  if (!Number.isFinite(d)) {
    return { ok: false, error: 'Distance must be a valid number' };
  }
  if (d <= 0) {
    return { ok: false, error: 'Distance must be greater than 0' };
  }
  return { ok: true, value: d };
}

module.exports = {
  calculateFuel,
  calculateFuelCost,
  calculateTravelTime,
  calculateProfit,
  fullTripCalc,
  formatDuration,
  validateDistance
};
