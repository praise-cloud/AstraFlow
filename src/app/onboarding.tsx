import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppColor } from '@/hooks/useAppColor';
import { completeOnboarding } from '@/services/onboarding';

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const colors = useAppColor();
  const { t } = useTranslation();

  const isLastSlide = currentIndex === 2;

  const slides = [
    {
      id: 'welcome',
      iconSet: 'MaterialCommunityIcons' as const,
      iconName: 'gas-station' as const,
      title: t('onboarding.slide1_title'),
      description: t('onboarding.slide1_desc'),
    },
    {
      id: 'features',
      iconSet: 'Ionicons' as const,
      iconName: 'analytics' as const,
      title: t('onboarding.slide2_title'),
      description: t('onboarding.slide2_desc'),
    },
    {
      id: 'start',
      iconSet: 'Ionicons' as const,
      iconName: 'rocket-outline' as const,
      title: t('onboarding.slide3_title'),
      description: t('onboarding.slide3_desc'),
    },
  ];

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      setCurrentIndex(index);
    },
    [width]
  );

  const handleNext = () => {
    if (isLastSlide) {
      handleGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleGetStarted = async () => {
    await completeOnboarding();
    router.replace('/login');
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace('/login');
  };

  const renderSlide = ({ item }: { item: typeof slides[0] }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.iconContainer}>
        <View style={[styles.iconBox, { backgroundColor: colors.bgPrimary }]}>
          {item.iconSet === 'Ionicons' ? (
            <Ionicons name={item.iconName} size={64} color={colors.textWhite} />
          ) : (
            <MaterialCommunityIcons name={item.iconName} size={64} color={colors.textWhite} />
          )}
        </View>
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {item.description}
      </Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {slides.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === currentIndex ? colors.accentPetrol : colors.border,
              width: index === currentIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            {t('onboarding.skip')}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
      />

      {renderDots()}

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.accentPetrol }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.textWhite }]}>
            {isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
          <Ionicons
            name={isLastSlide ? 'checkmark-circle' : 'arrow-forward'}
            size={20}
            color={colors.textWhite}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
