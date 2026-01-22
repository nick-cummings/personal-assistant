import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

// Safe math expression evaluator using Function constructor
// Only allows numbers, operators, parentheses, and Math functions
function evaluateExpression(expression: string): number {
  // Whitelist of allowed Math functions
  const allowedFunctions = [
    'abs',
    'acos',
    'asin',
    'atan',
    'atan2',
    'ceil',
    'cos',
    'exp',
    'floor',
    'log',
    'log10',
    'log2',
    'max',
    'min',
    'pow',
    'random',
    'round',
    'sign',
    'sin',
    'sqrt',
    'tan',
    'trunc',
  ];

  // Whitelist of allowed constants
  const allowedConstants = ['PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2'];

  // Clean the expression
  let cleaned = expression
    .replace(/\s+/g, '') // Remove whitespace
    .replace(/×/g, '*') // Replace × with *
    .replace(/÷/g, '/') // Replace ÷ with /
    .replace(/−/g, '-') // Replace − with -
    .replace(/\^/g, '**'); // Replace ^ with ** for exponentiation

  // Replace pi and e with Math constants
  cleaned = cleaned.replace(/\bpi\b/gi, 'Math.PI');
  cleaned = cleaned.replace(/\be\b/gi, 'Math.E');

  // Replace function names with Math.function
  for (const fn of allowedFunctions) {
    const regex = new RegExp(`\\b${fn}\\(`, 'gi');
    cleaned = cleaned.replace(regex, `Math.${fn}(`);
  }

  // Replace constants with Math.constant
  for (const constant of allowedConstants) {
    const regex = new RegExp(`\\bMath\\.${constant}\\b`, 'g');
    // Already has Math. prefix from PI/E replacement, just ensure it's there
  }

  // Validate the expression only contains allowed characters
  // Allow: digits, operators, parentheses, dots, Math., function names
  const validPattern = /^[0-9+\-*/%().,\s]|Math\.[a-zA-Z0-9_]+/;

  // More comprehensive validation: only allow safe tokens
  const safePattern =
    /^(Math\.(abs|acos|asin|atan2?|ceil|cos|exp|floor|log(10|2)?|max|min|pow|random|round|sign|sin|sqrt|tan|trunc|PI|E|LN2|LN10|LOG2E|LOG10E|SQRT2|SQRT1_2)|[0-9.+\-*/%(),\s])+$/;

  if (!safePattern.test(cleaned)) {
    throw new Error(
      'Invalid expression. Only numbers, basic operators (+, -, *, /, %, **), parentheses, and Math functions are allowed.'
    );
  }

  // Evaluate using Function constructor (safer than eval, but still isolated)
  try {
    const fn = new Function(`"use strict"; return (${cleaned});`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Expression did not evaluate to a valid number');
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
    throw new Error('Failed to evaluate expression');
  }
}

// Unit conversion data
const unitConversions: Record<string, Record<string, number>> = {
  // Length (base: meters)
  length: {
    m: 1,
    meter: 1,
    meters: 1,
    km: 1000,
    kilometer: 1000,
    kilometers: 1000,
    cm: 0.01,
    centimeter: 0.01,
    centimeters: 0.01,
    mm: 0.001,
    millimeter: 0.001,
    millimeters: 0.001,
    mi: 1609.344,
    mile: 1609.344,
    miles: 1609.344,
    yd: 0.9144,
    yard: 0.9144,
    yards: 0.9144,
    ft: 0.3048,
    foot: 0.3048,
    feet: 0.3048,
    in: 0.0254,
    inch: 0.0254,
    inches: 0.0254,
  },
  // Weight (base: kilograms)
  weight: {
    kg: 1,
    kilogram: 1,
    kilograms: 1,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
    mg: 0.000001,
    milligram: 0.000001,
    milligrams: 0.000001,
    lb: 0.453592,
    pound: 0.453592,
    pounds: 0.453592,
    oz: 0.0283495,
    ounce: 0.0283495,
    ounces: 0.0283495,
    ton: 907.185,
    tons: 907.185,
    tonne: 1000,
    tonnes: 1000,
  },
  // Volume (base: liters)
  volume: {
    l: 1,
    liter: 1,
    liters: 1,
    ml: 0.001,
    milliliter: 0.001,
    milliliters: 0.001,
    gal: 3.78541,
    gallon: 3.78541,
    gallons: 3.78541,
    qt: 0.946353,
    quart: 0.946353,
    quarts: 0.946353,
    pt: 0.473176,
    pint: 0.473176,
    pints: 0.473176,
    cup: 0.236588,
    cups: 0.236588,
    floz: 0.0295735,
    'fluid ounce': 0.0295735,
    'fluid ounces': 0.0295735,
  },
  // Temperature handled separately
};

function convertUnits(value: number, fromUnit: string, toUnit: string): number | null {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();

  // Temperature conversions (special case)
  if (['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'].includes(from)) {
    // Convert to Celsius first
    let celsius: number;
    if (['c', 'celsius'].includes(from)) {
      celsius = value;
    } else if (['f', 'fahrenheit'].includes(from)) {
      celsius = (value - 32) * (5 / 9);
    } else if (['k', 'kelvin'].includes(from)) {
      celsius = value - 273.15;
    } else {
      return null;
    }

    // Convert from Celsius to target
    if (['c', 'celsius'].includes(to)) {
      return celsius;
    } else if (['f', 'fahrenheit'].includes(to)) {
      return celsius * (9 / 5) + 32;
    } else if (['k', 'kelvin'].includes(to)) {
      return celsius + 273.15;
    }
    return null;
  }

  // Find the category for the units
  for (const [, conversions] of Object.entries(unitConversions)) {
    if (from in conversions && to in conversions) {
      // Convert: value * (from unit in base) / (to unit in base)
      return (value * conversions[from]) / conversions[to];
    }
  }

  return null;
}

export function createCalculatorTool(): ToolSet {
  const calculator = tool({
    description:
      'Evaluate mathematical expressions and perform unit conversions. Supports basic arithmetic (+, -, *, /, %, **), parentheses, and Math functions (sin, cos, sqrt, pow, log, etc.). Also converts between common units of length, weight, volume, and temperature.',
    inputSchema: z.object({
      expression: z
        .string()
        .optional()
        .describe(
          'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(pi/2)", "2^10"). Use this OR the conversion parameters.'
        ),
      convert: z
        .object({
          value: z.number().describe('The numeric value to convert'),
          from: z.string().describe('The unit to convert from (e.g., "miles", "kg", "celsius")'),
          to: z.string().describe('The unit to convert to (e.g., "km", "pounds", "fahrenheit")'),
        })
        .optional()
        .describe('Unit conversion parameters. Use this OR the expression parameter.'),
    }),
    execute: async ({ expression, convert }) => {
      console.log(`[Calculator ${new Date().toISOString()}] Input:`, { expression, convert });

      try {
        // Handle unit conversion
        if (convert) {
          const result = convertUnits(convert.value, convert.from, convert.to);

          if (result === null) {
            return {
              error: `Cannot convert between ${convert.from} and ${convert.to}. Supported conversions: length (m, km, mi, ft, in, etc.), weight (kg, g, lb, oz, etc.), volume (l, ml, gal, cup, etc.), temperature (c, f, k).`,
            };
          }

          console.log(
            `[Calculator ${new Date().toISOString()}] Converted ${convert.value} ${convert.from} = ${result} ${convert.to}`
          );

          return {
            conversion: {
              value: convert.value,
              from: convert.from,
              to: convert.to,
              result: Math.round(result * 1000000) / 1000000, // Round to 6 decimal places
            },
          };
        }

        // Handle mathematical expression
        if (expression) {
          const result = evaluateExpression(expression);

          console.log(`[Calculator ${new Date().toISOString()}] ${expression} = ${result}`);

          return {
            expression,
            result: Math.round(result * 1000000000000) / 1000000000000, // Round to avoid floating point issues
          };
        }

        return {
          error: 'Please provide either an expression to evaluate or conversion parameters.',
        };
      } catch (error) {
        console.error(`[Calculator ${new Date().toISOString()}] Error:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message };
      }
    },
  });

  return { calculator };
}
