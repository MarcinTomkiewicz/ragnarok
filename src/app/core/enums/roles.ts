export enum CoworkerRoles {
  Owner = 'owner',
  Coowner = 'coowner',
  Gm = 'gm',
  Reception = 'reception',
  Member = 'member',
  Golden = 'golden',
  User = 'user',
}

export const RoleDisplay: Record<CoworkerRoles, string> = {
  [CoworkerRoles.Owner]: 'Właściciel',
  [CoworkerRoles.Coowner]: 'Specjalistka d/s Marketingu',
  [CoworkerRoles.Gm]: 'Mistrz Gry',
  [CoworkerRoles.Reception]: 'Recepcja',
  [CoworkerRoles.Member]: 'Członek Klubu',
  [CoworkerRoles.Golden]: 'Złoty Bilet',
  [CoworkerRoles.User]: 'Użytkownik',
};