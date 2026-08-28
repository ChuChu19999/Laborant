import { PermissionsContext, type PermissionsContextValue } from '@/entities/Role';
import type { ReactNode } from 'react';

/** Wiring прав в дерево: value задаётся layout после /me; Context и хуки — entities/Role. */
export function PermissionsProvider({
  value,
  children,
}: {
  value: PermissionsContextValue;
  children: ReactNode;
}) {
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}
