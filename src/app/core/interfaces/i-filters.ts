import { FilterOperator } from "../enums/filterOperator";

export interface IFilter {
    operator: FilterOperator;
    value: any;
  }
  
  export interface IFilters {
    [key: string]: IFilter;
  }