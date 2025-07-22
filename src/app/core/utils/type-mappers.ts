export function toCamelCase<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as any;
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = toCamelCase(value);
      return acc;
    }, {} as any) as T;
  }

  return obj;
}

export function toSnakeCase<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase) as any;
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(value);
      return acc;
    }, {} as any) as T;
  }

  return obj;
}
