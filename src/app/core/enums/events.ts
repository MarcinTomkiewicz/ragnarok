export enum EventTag {
  Beginners = 'BEGINNERS',
  Session = 'SESSION',
  Discussion = 'DISCUSSION',
  Entertainment = 'ENTERTAINMENT',
}
export const EventTagLabel: Record<EventTag, string> = {
  [EventTag.Beginners]: 'Dla początkujących',
  [EventTag.Session]: 'Sesja',
  [EventTag.Discussion]: 'Dyskusja',
  [EventTag.Entertainment]: 'Rozrywka',
};

export enum AttractionKind {
  Session = 'SESSION',
  Discussion = 'DISCUSSION',
  Entertainment = 'ENTERTAINMENT',
  None = 'NONE',
}
export const AttractionKindLabel: Record<AttractionKind, string> = {
  [AttractionKind.Session]: 'Sesja RPG',
  [AttractionKind.Discussion]: 'Dyskusja',
  [AttractionKind.Entertainment]: 'Rozrywka',
  [AttractionKind.None]: 'Rozrywka',
};

export enum HostSignupScope {
  Any = 'ANY',
  Staff = 'STAFF',
}
export const HostSignupScopeLabel: Record<HostSignupScope, string> = {
  [HostSignupScope.Any]: 'Zalogowani użytkownicy',
  [HostSignupScope.Staff]: 'Współpracownicy',
};

export enum RecurrenceKind {
  Weekly = 'WEEKLY',
  MonthlyNthWeekday = 'MONTHLY_NTH_WEEKDAY',
  MonthlyDayOfMonth = 'MONTHLY_DAY_OF_MONTH',
}
export const RecurrenceKindLabel: Record<RecurrenceKind, string> = {
  [RecurrenceKind.Weekly]: 'Tygodniowo',
  [RecurrenceKind.MonthlyNthWeekday]: 'Raz w miesiącu (N-ty dzień tygodnia)',
  [RecurrenceKind.MonthlyDayOfMonth]: 'Raz w miesiącu (zawsze tego samego dnia)',
};

export enum WeeklyInterval {
  EveryWeek = 1,
  EveryTwoWeeks = 2,
}
export const WeeklyIntervalLabel: Record<WeeklyInterval, string> = {
  [WeeklyInterval.EveryWeek]: 'Co tydzień',
  [WeeklyInterval.EveryTwoWeeks]: 'Co dwa tygodnie',
};

export enum MonthlyNth {
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  Last = -1,
}
export const MonthlyNthLabel: Record<MonthlyNth, string> = {
  [MonthlyNth.First]: 'Pierwszy',
  [MonthlyNth.Second]: 'Drugi',
  [MonthlyNth.Third]: 'Trzeci',
  [MonthlyNth.Fourth]: 'Czwarty',
  [MonthlyNth.Last]: 'Ostatni',
};

export enum ExcludeNth {
  None = 0,
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  Last = -1,
}
export const ExcludeNthLabel: Record<ExcludeNth, string> = {
  [ExcludeNth.None]: 'Brak',
  [ExcludeNth.First]: 'Wyklucz pierwszy',
  [ExcludeNth.Second]: 'Wyklucz drugi',
  [ExcludeNth.Third]: 'Wyklucz trzeci',
  [ExcludeNth.Fourth]: 'Wyklucz czwarty',
  [ExcludeNth.Last]: 'Wyklucz ostatni',
};

export enum ParticipantSignupScope {
  None = 'NONE',
  Whole = 'WHOLE',
  Session = 'SESSION',
  Both = 'BOTH',
}
