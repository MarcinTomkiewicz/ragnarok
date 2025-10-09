export enum MenuItemKey {
  // Rezerwacje
  ReserveRoom = 'ReserveRoom',
  MyReservations = 'MyReservations',

  // Drużyny
  FindParty = 'FindParty',
  CreateParty = 'CreateParty',
  MyParties = 'MyParties',

  // Wydarzenia
  HostEvent = 'HostEvent',

  // Konto
  EditData = 'EditData',
  MyBenefits = 'MyBenefits',

  // MG
  GmProfile = 'GmProfile',
  UpcomingSessions = 'UpcomingSessions',
  GmAvailability = 'GmAvailability',
  ReceptionAvailability = 'ReceptionAvailability',

  // Pozycje wspólne (mogą wystąpić w MG i w Recepcji)
  MyRoster = 'MyRoster',
  WorkLog = 'WorkLog',
  CoworkerFiles = 'CoworkerFiles',
  RosterOverview = 'RosterOverview',

  // Recepcja-only (oprócz wspólnych)
  GuestReservation = 'GuestReservation',
  ReservationsCalendar = 'ReservationsCalendar',
  UsersAdmin = 'UsersAdmin',
  PartyList = 'PartyList',
  ManageEvents = 'ManageEvents',
  NewEvent = 'NewEvent',
  AvailabilityOverview = 'AvailabilityOverview',
  WorkLogsOverview = 'WorkLogsOverview',
  ReceptionRoster = 'ReceptionRoster', // Owner+
}