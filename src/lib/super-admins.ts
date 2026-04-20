export const SUPER_ADMIN_EMAILS = [
  'natia.tchintcharauli@tripleten.com',
  'andres.quevedo@tripleten.com',
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email);
}
