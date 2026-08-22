import { JSON5 } from 'bun';

import type { JsonRpcV2, UploadedImage } from '@/types/shared';

/** base */

export const isArrayBuffer = (value: unknown): value is ArrayBuffer => {
  return value instanceof ArrayBuffer;
};

export const isBlob = (x: unknown): x is Blob => {
  if (typeof Blob === 'undefined') {
    return false;
  }

  return x instanceof Blob;
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isBuffer = (value: unknown): boolean => {
  return typeof globalThis.Buffer !== 'undefined' && globalThis.Buffer.isBuffer(value);
};

export const isDate = (value: unknown): value is Date => {
  return value instanceof Date;
};

export const isError = (value: unknown): value is Error => {
  return value instanceof Error;
};

export const isFile = (value: unknown): value is File => {
  if (typeof File === 'undefined') {
    return false;
  }

  return isBlob(value) && value instanceof File;
};

export const isFunction = (value: any): value is (...args: any[]) => any => {
  return typeof value === 'function';
};

export const isJSONStr = (value: unknown, strict: boolean = false): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    if (strict) {
      JSON.parse(value);
    } else {
      JSON5.parse(value);
    }
    return true;
  } catch {
    return false;
  }
};

export const isJSONArray = (value: unknown): value is any[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => isJSONValue(item));
};

export const isJSONObject = (obj: unknown): obj is Record<string, any> => {
  if (!isPlainObject(obj)) {
    return false;
  }

  const keys = Reflect.ownKeys(obj);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = obj[key];

    if (typeof key !== 'string') {
      return false;
    }

    if (!isJSONValue(value)) {
      return false;
    }
  }

  return true;
};

export const isJSONValue = (
  value: unknown,
): value is Record<string, any> | any[] | string | number | boolean | null => {
  switch (typeof value) {
    case 'object': {
      return value === null || isJSONArray(value) || isJSONObject(value);
    }
    case 'string':
    case 'number':
    case 'boolean': {
      return true;
    }
    default: {
      return false;
    }
  }
};

export const isMap = (value: unknown): value is Map<any, any> => {
  return value instanceof Map;
};

export const isNil = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

export const isNotNil = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

export const isNull = (value: unknown): value is null => {
  return value === null;
};

export const isNumber = (value: unknown): value is number | bigint => {
  return typeof value === 'number' || typeof value === 'bigint';
};

export const isPlainObject = (value: unknown): value is Record<PropertyKey, any> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as typeof Object.prototype | null;

  const hasObjectPrototype =
    proto === null ||
    proto === Object.prototype ||
    // Required to support node:vm.runInNewContext({})
    Object.getPrototypeOf(proto) === null;

  if (!hasObjectPrototype) {
    return false;
  }

  return Object.prototype.toString.call(value) === '[object Object]';
};

export const isPromise = (value: unknown): value is Promise<any> => {
  return value instanceof Promise;
};

export const isRegExp = (value: unknown): value is RegExp => {
  return value instanceof RegExp;
};

export const isSet = (value: unknown): value is Set<any> => {
  return value instanceof Set;
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isSymbol = (value: unknown): value is symbol => {
  return typeof value === 'symbol';
};

export const isTypedArray = (
  value: unknown,
): value is
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | BigUint64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Float32Array
  | Float64Array => {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
};

export const isUndefined = (value: any): value is undefined => {
  return value === undefined;
};

export const isWeakMap = (value: unknown): value is WeakMap<WeakKey, any> => {
  return value instanceof WeakMap;
};

export const isWeakSet = (value: unknown): value is WeakSet<WeakKey> => {
  return value instanceof WeakSet;
};

/** extend */

export const isBufferFile = (obj: unknown): obj is UploadedImage => {
  if (!isPlainObject(obj)) return false;
  if (!('mimetype' in obj) || !('buffer' in obj)) return false;

  return isString(obj.mimetype) && isBuffer(obj.buffer);
};

export const isHttp = (value: unknown): boolean => {
  return isString(value) && /^https?:\/\//i.test(value);
};

export const isImageMime = (value: unknown): value is string => {
  return isString(value) && value.toLowerCase().startsWith('image/');
};

export const isJSONRpcV2 = (value: unknown): value is JsonRpcV2 => {
  if (!isPlainObject(value)) return false;
  if (!('jsonrpc' in value) || !('method' in value)) return false;

  return isString(value.jsonrpc) && value.jsonrpc === '2.0';
};
