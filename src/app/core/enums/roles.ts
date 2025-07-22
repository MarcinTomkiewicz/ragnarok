export enum Roles {
  Owner = 'owner',
  Coowner = 'coowner',
  Gm = 'gm',
  Reception = 'reception',
  Member = 'member',
  Golden = 'golden',
  User = 'user',
}

export const RoleDisplay: Record<Roles, string> = {
  [Roles.Owner]: 'Właściciel',
  [Roles.Coowner]: 'Specjalistka d/s Marketingu',
  [Roles.Gm]: 'Mistrz Gry',
  [Roles.Reception]: 'Recepcja',
  [Roles.Member]: 'Członek Klubu',
  [Roles.Golden]: 'Złoty Bilet',
  [Roles.User]: 'Użytkownik',
};