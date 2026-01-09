export function getRoleBase(pathname?: string): string {
  const seg = (pathname || '').split('/')[1];
  switch (seg) {
    case 'admin':
    case 'employee':
    case 'hr':
    case 'super-admin':
      return `/${seg}`;
    default:
      return '/admin';
  }
}

export function buildRoleHref(roleBase: string, subPath: string): string {
  const base = roleBase.endsWith('/') ? roleBase.slice(0, -1) : roleBase;
  return `${base}${subPath.startsWith('/') ? '' : '/'}${subPath}`;
}


