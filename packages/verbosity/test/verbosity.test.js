/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { 
  Levels, 
  parseLevel, 
  getVerbosity, 
  useVerbosity, 
  TieredOutput, 
  select, 
  project 
} = require('../index');

test('Levels and Parsing', (t) => {
  assert.strictEqual(parseLevel('silent'), Levels.SILENT);
  assert.strictEqual(parseLevel('VERBOSE'), Levels.VERBOSE);
  assert.strictEqual(parseLevel('vv'), Levels.VERBOSE);
  assert.strictEqual(parseLevel('q'), Levels.SILENT);
  assert.strictEqual(parseLevel(null), Levels.NORMAL);
});

test('Async Context Resolution', (t) => {
  assert.strictEqual(getVerbosity(), Levels.NORMAL);
  
  useVerbosity('detailed', () => {
    assert.strictEqual(getVerbosity(), Levels.DETAILED);
    
    useVerbosity('silent', () => {
      assert.strictEqual(getVerbosity(), Levels.SILENT);
    });
    
    assert.strictEqual(getVerbosity(), Levels.DETAILED);
  });
});

test('TieredOutput Rendering', (t) => {
  const output = new TieredOutput()
    .add('silent', 'Header')
    .add('normal', 'Main content')
    .add('detailed', () => 'Metadata: 123');
    
  assert.strictEqual(output.render('silent'), 'Header');
  assert.strictEqual(output.render('normal'), 'Header\nMain content');
  assert.strictEqual(output.render('detailed'), 'Header\nMain content\nMetadata: 123');
});

test('Select Formatter', (t) => {
  const options = {
    [Levels.TERSE]: 'Short',
    [Levels.VERBOSE]: 'Very long description'
  };
  
  assert.strictEqual(select(options, 'terse'), 'Short');
  assert.strictEqual(select(options, 'normal'), 'Short'); // Fallback to lower matching level
  assert.strictEqual(select(options, 'verbose'), 'Very long description');
});

test('Project Formatter', (t) => {
  const data = { id: 1, secret: 'password', meta: 'data' };
  const schema = { id: 'silent', meta: 'normal', secret: 'verbose' };
  
  const silent = project(data, schema, 'silent');
  assert.deepStrictEqual(silent, { id: 1 });
  
  const normal = project(data, schema, 'normal');
  assert.deepStrictEqual(normal, { id: 1, meta: 'data' });
  
  const verbose = project(data, schema, 'verbose');
  assert.deepStrictEqual(verbose, { id: 1, meta: 'data', secret: 'password' });
});
