/**
 * Manual test script for calculator tool
 *
 * Usage:
 *   bun run src/lib/tools/test-calculator.ts
 *
 * No environment variables required - this tool works standalone.
 */

import { createCalculatorTool } from './calculator';

async function main() {
  console.log('=== Calculator Tool Test ===\n');

  const tools = createCalculatorTool();
  const calculator = tools.calculator;

  // Test 1: Basic arithmetic
  console.log('--- Test 1: Basic arithmetic ---');
  const basicExpressions = [
    '2 + 2',
    '10 - 3',
    '6 * 7',
    '100 / 4',
    '17 % 5',
    '2 ** 10',
    '(2 + 3) * 4',
    '10 / 3',
  ];
  for (const expr of basicExpressions) {
    try {
      const result = await calculator.execute(
        { expression: expr },
        { toolCallId: `test-1-${expr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${expr} = ERROR: ${result.error}`);
      } else if ('result' in result) {
        console.log(`  ${expr} = ${result.result}`);
      }
    } catch (error) {
      console.error(`  ${expr}: Failed -`, error);
    }
  }
  console.log();

  // Test 2: Math functions
  console.log('--- Test 2: Math functions ---');
  const mathFunctions = [
    'sqrt(16)',
    'sqrt(2)',
    'pow(2, 8)',
    'abs(-42)',
    'floor(3.7)',
    'ceil(3.2)',
    'round(3.5)',
    'sin(0)',
    'cos(0)',
    'sin(pi/2)',
    'cos(pi)',
    'log(e)',
    'log10(100)',
    'log2(8)',
    'max(1, 5, 3)',
    'min(1, 5, 3)',
  ];
  for (const expr of mathFunctions) {
    try {
      const result = await calculator.execute(
        { expression: expr },
        { toolCallId: `test-2-${expr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${expr} = ERROR: ${result.error}`);
      } else if ('result' in result) {
        console.log(`  ${expr} = ${result.result}`);
      }
    } catch (error) {
      console.error(`  ${expr}: Failed -`, error);
    }
  }
  console.log();

  // Test 3: Constants
  console.log('--- Test 3: Constants ---');
  const constants = ['pi', 'e', 'PI', 'E', 'pi * 2', 'e ** 2'];
  for (const expr of constants) {
    try {
      const result = await calculator.execute(
        { expression: expr },
        { toolCallId: `test-3-${expr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${expr} = ERROR: ${result.error}`);
      } else if ('result' in result) {
        console.log(`  ${expr} = ${result.result}`);
      }
    } catch (error) {
      console.error(`  ${expr}: Failed -`, error);
    }
  }
  console.log();

  // Test 4: Complex expressions
  console.log('--- Test 4: Complex expressions ---');
  const complexExpressions = [
    'sqrt(pow(3, 2) + pow(4, 2))', // Pythagorean theorem: sqrt(9 + 16) = 5
    '(1 + sqrt(5)) / 2', // Golden ratio
    'sin(pi/4) ** 2 + cos(pi/4) ** 2', // Should equal 1
    '2 * pi * 10', // Circumference of circle with radius 10
    'pi * 5 ** 2', // Area of circle with radius 5
  ];
  for (const expr of complexExpressions) {
    try {
      const result = await calculator.execute(
        { expression: expr },
        { toolCallId: `test-4-${expr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${expr} = ERROR: ${result.error}`);
      } else if ('result' in result) {
        console.log(`  ${expr} = ${result.result}`);
      }
    } catch (error) {
      console.error(`  ${expr}: Failed -`, error);
    }
  }
  console.log();

  // Test 5: Length conversions
  console.log('--- Test 5: Length conversions ---');
  const lengthConversions = [
    { value: 1, from: 'mile', to: 'km' },
    { value: 100, from: 'meters', to: 'feet' },
    { value: 12, from: 'inches', to: 'cm' },
    { value: 1, from: 'km', to: 'miles' },
    { value: 5280, from: 'feet', to: 'miles' },
    { value: 1, from: 'yard', to: 'meters' },
  ];
  for (const conv of lengthConversions) {
    try {
      const result = await calculator.execute(
        { convert: conv },
        { toolCallId: `test-5-${conv.from}-${conv.to}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${conv.value} ${conv.from} to ${conv.to} = ERROR: ${result.error}`);
      } else if ('conversion' in result) {
        console.log(`  ${conv.value} ${conv.from} = ${result.conversion.result} ${conv.to}`);
      }
    } catch (error) {
      console.error(`  ${conv.from} to ${conv.to}: Failed -`, error);
    }
  }
  console.log();

  // Test 6: Weight conversions
  console.log('--- Test 6: Weight conversions ---');
  const weightConversions = [
    { value: 1, from: 'kg', to: 'pounds' },
    { value: 100, from: 'pounds', to: 'kg' },
    { value: 16, from: 'ounces', to: 'pounds' },
    { value: 1000, from: 'grams', to: 'kg' },
    { value: 1, from: 'ton', to: 'kg' },
    { value: 1, from: 'tonne', to: 'kg' },
  ];
  for (const conv of weightConversions) {
    try {
      const result = await calculator.execute(
        { convert: conv },
        { toolCallId: `test-6-${conv.from}-${conv.to}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${conv.value} ${conv.from} to ${conv.to} = ERROR: ${result.error}`);
      } else if ('conversion' in result) {
        console.log(`  ${conv.value} ${conv.from} = ${result.conversion.result} ${conv.to}`);
      }
    } catch (error) {
      console.error(`  ${conv.from} to ${conv.to}: Failed -`, error);
    }
  }
  console.log();

  // Test 7: Volume conversions
  console.log('--- Test 7: Volume conversions ---');
  const volumeConversions = [
    { value: 1, from: 'gallon', to: 'liters' },
    { value: 1, from: 'liter', to: 'cups' },
    { value: 4, from: 'cups', to: 'quarts' },
    { value: 1000, from: 'ml', to: 'liters' },
    { value: 8, from: 'floz', to: 'cups' },
  ];
  for (const conv of volumeConversions) {
    try {
      const result = await calculator.execute(
        { convert: conv },
        { toolCallId: `test-7-${conv.from}-${conv.to}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${conv.value} ${conv.from} to ${conv.to} = ERROR: ${result.error}`);
      } else if ('conversion' in result) {
        console.log(`  ${conv.value} ${conv.from} = ${result.conversion.result} ${conv.to}`);
      }
    } catch (error) {
      console.error(`  ${conv.from} to ${conv.to}: Failed -`, error);
    }
  }
  console.log();

  // Test 8: Temperature conversions
  console.log('--- Test 8: Temperature conversions ---');
  const tempConversions = [
    { value: 32, from: 'fahrenheit', to: 'celsius' },
    { value: 100, from: 'celsius', to: 'fahrenheit' },
    { value: 0, from: 'celsius', to: 'kelvin' },
    { value: 273.15, from: 'kelvin', to: 'celsius' },
    { value: -40, from: 'c', to: 'f' }, // -40 is same in both scales
    { value: 98.6, from: 'f', to: 'c' }, // Body temperature
  ];
  for (const conv of tempConversions) {
    try {
      const result = await calculator.execute(
        { convert: conv },
        { toolCallId: `test-8-${conv.from}-${conv.to}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${conv.value} ${conv.from} to ${conv.to} = ERROR: ${result.error}`);
      } else if ('conversion' in result) {
        console.log(`  ${conv.value} ${conv.from} = ${result.conversion.result} ${conv.to}`);
      }
    } catch (error) {
      console.error(`  ${conv.from} to ${conv.to}: Failed -`, error);
    }
  }
  console.log();

  // Test 9: Error handling
  console.log('--- Test 9: Error handling ---');
  const invalidInputs = [
    { expression: 'eval("alert(1)")' },
    { expression: 'require("fs")' },
    { expression: '1/0' },
    { expression: 'sqrt(-1)' },
    { convert: { value: 1, from: 'miles', to: 'kg' } }, // incompatible units
    { convert: { value: 1, from: 'invalid', to: 'unit' } },
    {}, // no input
  ];
  for (const input of invalidInputs) {
    try {
      const result = await calculator.execute(input, { toolCallId: 'test-9', messages: [] });
      if ('error' in result) {
        console.log(`  ${JSON.stringify(input)}: Handled error - "${result.error}"`);
      } else {
        console.log(`  ${JSON.stringify(input)}: Result - ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error(`  ${JSON.stringify(input)}: Threw -`, error);
    }
  }
  console.log();

  // Test 10: Unicode operators
  console.log('--- Test 10: Unicode operator support ---');
  const unicodeExpressions = [
    '5 × 4',
    '20 ÷ 4',
    '10 − 3',
    '2^8',
  ];
  for (const expr of unicodeExpressions) {
    try {
      const result = await calculator.execute(
        { expression: expr },
        { toolCallId: `test-10-${expr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${expr} = ERROR: ${result.error}`);
      } else if ('result' in result) {
        console.log(`  ${expr} = ${result.result}`);
      }
    } catch (error) {
      console.error(`  ${expr}: Failed -`, error);
    }
  }
  console.log();

  console.log('=== All tests complete ===');
}

main().catch(console.error);
