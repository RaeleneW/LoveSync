// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg'

function HomeIcon({ focused, color }: { focused: boolean; color: string }) {
  const c = focused ? color : '#8B8B9E'
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}
function HistoryIcon({ focused, color }: { focused: boolean; color: string }) {
  const c = focused ? color : '#8B8B9E'
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={c} strokeWidth={1.8}/>
      <Polyline points="12 6 12 12 16 14" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}
function GamesIcon({ focused, color }: { focused: boolean; color: string }) {
  const c = focused ? color : '#8B8B9E'
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={3} width={20} height={14} rx={2} stroke={c} strokeWidth={1.8}/>
      <Path d="M8 21h8M12 17v4" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
}
function ProfileIcon({ focused, color }: { focused: boolean; color: string }) {
  const c = focused ? color : '#8B8B9E'
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx={12} cy={7} r={4} stroke={c} strokeWidth={1.8}/>
    </Svg>
  )
}
function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1={12} y1={19} x2={12} y2={23} stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
      <Line x1={8}  y1={23} x2={16} y2={23} stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
}

export default function TabLayout() {
  const { theme } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { backgroundColor: theme.bg4, borderTopColor: theme.border }],
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.text3,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen name="index"   options={{ title: '主页',  tabBarIcon: ({ focused }) => <HomeIcon focused={focused} color={theme.primary} /> }} />
      <Tabs.Screen name="history" options={{ title: '记录',  tabBarIcon: ({ focused }) => <HistoryIcon focused={focused} color={theme.primary} /> }} />
      <Tabs.Screen name="record"  options={{
        title: '',
        tabBarIcon: () => (
          <View style={[styles.micButton, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
            <MicIcon color={theme.text} />
          </View>
        ),
        tabBarItemStyle: { marginTop: -14 },
      }} />
      <Tabs.Screen name="games"   options={{ title: '游戏',  tabBarIcon: ({ focused }) => <GamesIcon focused={focused} color={theme.primary} /> }} />
      <Tabs.Screen name="profile" options={{ title: '我的',  tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} color={theme.primary} /> }} />
      <Tabs.Screen name="checkin" options={{ tabBarButton: () => null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: 82,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabLabel: { fontSize: 10, marginTop: 2 },
  tabItem: { paddingTop: 0 },
  micButton: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
})
