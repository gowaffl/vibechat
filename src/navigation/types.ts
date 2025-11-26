import type { StackScreenProps } from "@react-navigation/stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";

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
  MainTabs: NavigatorScreenParams<TabParamList>;
  ChatList: undefined; // Kept for backward compatibility references if any
  Chat: { chatId: string; chatName: string };
  Profile: undefined; // Kept for backward compatibility references if any
  GroupSettings: { chatId: string; expandAIFriends?: boolean; createAIFriend?: boolean };
  InviteMembers: { chatId: string; chatName: string };
  Invite: { token: string };
};

export type TabParamList = {
  Chats: undefined;
  CreateChat: undefined;
  JoinChat: undefined;
  Profile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;
