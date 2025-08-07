export function getSupabaseErrorMessage(code: (string & {}) | undefined): string {
  const errorMessages: { [key: string]: string } = {
    'invalid_credentials': 'Niepoprawne dane logowania (email lub hasło).',
    'email_exists': 'Adres email już istnieje w systemie.',
    'email_address_invalid': 'Adres email jest niepoprawny.',
    'email_not_confirmed': 'Adres email nie został potwierdzony.',
    'user_not_found': 'Użytkownik nie został znaleziony.',
    'user_banned': 'Twoje konto zostało zablokowane.',
    'signup_disabled': 'Rejestracja nowych użytkowników jest wyłączona.',
    'provider_disabled': 'Logowanie z wybranym dostawcą jest wyłączone.',
    'bad_json': 'Wystąpił problem z formatem danych.',
    'bad_jwt': 'Token JWT jest niepoprawny.',
    'weak_password': 'Hasło jest za słabe. Użyj silniejszego hasła.',
    'too_many_enrolled_mfa_factors': 'Przekroczono limit włączonych czynników MFA.',
    'request_timeout': 'Czas oczekiwania na odpowiedź przekroczony, spróbuj ponownie później.',
  };

  // Zwrócenie domyślnej wiadomości, jeśli kod błędu nie znajduje się w mapie
  return code ? errorMessages[code] : 'Wystąpił błąd, spróbuj ponownie później.';
}
