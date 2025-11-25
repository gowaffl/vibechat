import type { NativeStackScreenProps } from "@react-navigation/native-stack";

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

export type RootStackParamList = {
  Welcome: undefined;
  PhoneAuth: undefined;
  Birthdate: { userId: string; hasCompletedOnboarding: boolean };
  OnboardingName: undefined;
  OnboardingPhoto: { name: string; bio?: string };
  ChatList: undefined;
  Chat: { chatId: string; chatName: string };
  Profile: undefined;
  GroupSettings: { chatId: string };
  InviteMembers: { chatId: string; chatName: string };
  Invite: { token: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
