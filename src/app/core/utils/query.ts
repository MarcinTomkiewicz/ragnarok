import { IFilter } from '../interfaces/i-filters';
import { FilterOperator } from '../enums/filterOperator';
import { toSnakeKey } from './type-mappers';

export function applyFilters<T>(
  query: any,
  filters?: { [key: string]: IFilter }
): any {
  if (!filters) return query;

  for (const [key, filter] of Object.entries(filters)) {
    if (filter.value !== undefined) {
      const operator = filter.operator || FilterOperator.EQ;
      const snakeKey = toSnakeKey(key);
      switch (operator) {
        case FilterOperator.EQ:
          query = query.eq(snakeKey, filter.value);
          break;
        case FilterOperator.GTE:
          query = query.gte(snakeKey, filter.value);
          break;
        case FilterOperator.LTE:
          query = query.lte(snakeKey, filter.value);
          break;
        case FilterOperator.GT:
          query = query.gt(snakeKey, filter.value);
          break;
        case FilterOperator.LT:
          query = query.lt(snakeKey, filter.value);
          break;
        case FilterOperator.LIKE:
          query = query.like(snakeKey, filter.value);
          break;
        case FilterOperator.IN:
          query = query.in(snakeKey, filter.value);
          break;
        case FilterOperator.IS:
          query = query.is(snakeKey, filter.value);
          break;
        default:
          throw new Error(`Unsupported filter operator: ${operator}`);
      }
    }
  }

  return query;
}
