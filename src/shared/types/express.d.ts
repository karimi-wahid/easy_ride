import type { AuthenticatedUser } from '../auth/types/authenticated-user';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
