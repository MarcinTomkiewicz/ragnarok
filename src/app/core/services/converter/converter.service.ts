import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConverterService {
  constructor() {}

  /**
   * Główna metoda do konwersji danych.
   * @param value - Wartość wejściowa do konwersji (np. timestamp)
   * @param type - Typ konwersji (np. 'date', 'temperature', 'length')
   * @param format - Opcjonalny format dla daty (np. 'dd-MM-yyyy HH:mm')
   * @returns Przekonwertowana wartość
   */
  convert(value: any, type: 'date' | 'temperature' | 'length', format?: string): string | number {
    switch (type) {
      case 'date':
        return this.convertDate(value, format || 'dd-MM-yyyy HH:mm');
      default:
        throw new Error(`Unsupported conversion type: ${type}`);
    }
  }

  /**
   * Konwertuje timestamp do określonego formatu daty.
   * @param timestamp - Timestamp w formacie ISO (np. '2025-02-09T08:09:40.836356+00:00')
   * @param format - Format wyjściowy (np. 'dd-MM-yyyy HH:mm')
   * @returns Sformatowana data
   */
  private convertDate(timestamp: string, format: string): string {
    const date = new Date(timestamp);

    const day = this.padZero(date.getDate());
    const month = this.padZero(date.getMonth() + 1);
    const year = date.getFullYear();

    const hours = this.padZero(date.getHours());
    const minutes = this.padZero(date.getMinutes());

    return format
      .replace('dd', day.toString())
      .replace('MM', month.toString())
      .replace('yyyy', year.toString())
      .replace('HH', hours.toString())
      .replace('mm', minutes.toString());
  }

  private padZero(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}