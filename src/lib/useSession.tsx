import { authClient } from "./authClient";

// IMPORTANT: Use this hook for global state management of the user session
// This hook can be used to get the current user session
// The type looks like this:
// const useSession: () => {
// data: {
//   user: {
//       id: string;
//       createdAt: Date;
//       updatedAt: Date;
//       email: string;
//       emailVerified: boolean;
//       name: string;
//       image?: string | null | undefined;
//   };
//   session: {
//       id: string;
//       createdAt: Date;
//       updatedAt: Date;
//       userId: string;
//       expiresAt: Date;
//       token: string;
//       ipAddress?: string | null | undefined;
//       userAgent?: string | null | undefined;
//   };
// } | null;
//   isPending: boolean;
//   error: BetterFetchError | null;
//   refetch: (queryParams?: {
//     query?: SessionQueryParams;
//   }) => void;
// }

export const useSession = () => authClient.useSession();
