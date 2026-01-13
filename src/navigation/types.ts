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
  Chat: { chatId: string; chatName?: string; messageId?: string; forceRefresh?: boolean };
  PersonalChat: { conversationId?: string; agentId?: string };
  Profile: undefined; // Kept for backward compatibility references if any
  GroupSettings: { chatId: string };
  GroupSettingsAiFriends: { chatId: string };
  GroupSettingsWorkflows: { chatId: string };
  GroupSettingsCommands: { chatId: string };
  GroupSettingsMembers: { chatId: string };
  GroupSettingsMedia: { chatId: string };
  GroupSettingsLinks: { chatId: string };
  InviteMembers: { chatId: string; chatName: string };
  Invite: { token: string };
  JoinChat: undefined;
  Feedback: undefined;
};

export type TabParamList = {
  Chats: undefined;
  Profile: undefined;
  Community: undefined;
  More: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;
