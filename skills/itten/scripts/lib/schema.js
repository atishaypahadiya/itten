// A small JSON Schema validator covering the keywords used by
// schema/system.schema.json and schema/overrides.schema.json. No dependencies.
// Supported: type, required, properties, additionalProperties, items,
// minItems, maxItems, enum, minimum, maximum, exclusiveMinimum, minLength,
// minProperties, propertyNames, pattern, oneOf, anyOf, uniqueItems, $ref (local #/..., or another
// schema given to register(), by its $id or a path relative to this one's), and one ITTEN keyword:
// "ascending": true, which requires a number array in ascending order with
// no repeats.

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function matchesType(v, t) {
  if (t === 'integer') return Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
}

const registry = new Map();
// Makes a schema reachable by $ref from other schemas, by its $id.
export function register(schema) { registry.set(schema.$id, schema); return schema; }

// Returns [the schema a $ref points to, the root it is to be read against].
function deref(root, ref) {
  if (ref.startsWith('#/')) return [ref.slice(2).split('/').reduce((n, k) => n?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], root), root];
  const id = root.$id ? new URL(ref, root.$id).href : ref;
  const other = registry.get(id);
  if (!other || id.includes('#')) throw new Error(`$ref ${ref} is not a registered schema`);
  return [other, other];
}

export function validate(schema, value, root = schema, path = '') {
  const errors = [];
  const at = path || '(root)';
  if (schema.$ref) { const [s, r] = deref(root, schema.$ref); return validate(s, value, r, path); }
  if (schema.type) {
    const types = [schema.type].flat();
    if (!types.some((t) => matchesType(value, t))) return [`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: ${value} is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: ${value} is above ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${at}: ${value} must be above ${schema.exclusiveMinimum}`);
  }
  if (typeof value === 'string' && schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: allows at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(`${at}: items must not repeat`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, root, `${path}[${i}]`)));
    if (schema.ascending) {
      for (let i = 1; i < value.length; i++) {
        if (!(value[i] > value[i - 1])) errors.push(`${at}: values must ascend without repeats (${value[i - 1]} then ${value[i]})`);
      }
    }
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) errors.push(`${at}: missing required "${k}"`);
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push(`${at}: needs at least ${schema.minProperties} entries`);
    if (schema.propertyNames) for (const k of Object.keys(value)) for (const e of validate(schema.propertyNames, k, root, path)) errors.push(`${at}: property name ${e.slice(e.indexOf(':') + 2)}`);
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties?.[k];
      if (sub) errors.push(...validate(sub, v, root, `${path}.${k}`));
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown property "${k}"`);
      else if (typeof schema.additionalProperties === 'object') errors.push(...validate(schema.additionalProperties, v, root, `${path}.${k}`));
    }
  }
  if (schema.oneOf) {
    const passing = schema.oneOf.filter((s) => validate(s, value, root, path).length === 0).length;
    if (passing !== 1) errors.push(`${at}: must match exactly one of: ${schema.oneOf.map((s) => (s.title ?? (s.required ? s.required.join(' + ') : 'a form'))).join(', ')} (matched ${passing})`);
  }
  if (schema.anyOf && !schema.anyOf.some((s) => validate(s, value, root, path).length === 0)) {
    errors.push(`${at}: must match at least one of: ${schema.anyOf.map((s) => (s.title ?? (s.required ? s.required.join(' + ') : 'a form'))).join(', ')}`);
  }
  return errors;
}
