export enum CoworkerRoles {
  Owner = 'owner',
  Coowner = 'coowner',
  Reception = 'reception',
  Coordinator = 'coordinator',
  Gm = 'gm',
  Member = 'member',
  Golden = 'golden',
  User = 'user',
}

export const RoleDisplay: Record<CoworkerRoles, string> = {
  [CoworkerRoles.Owner]: 'Właściciel',
  [CoworkerRoles.Coowner]: 'Specjalistka d/s Marketingu',
  [CoworkerRoles.Reception]: 'Recepcja',
  [CoworkerRoles.Coordinator]: 'Koordynator Mistrzów Gry',
  [CoworkerRoles.Gm]: 'Mistrz Gry',
  [CoworkerRoles.Member]: 'Członek Klubu',
  [CoworkerRoles.Golden]: 'Złoty Bilet',
  [CoworkerRoles.User]: 'Użytkownik',
};