import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import PagerView from "react-native-pager-view";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Maximum width for carousel in message bubble (accounting for padding and margins)
const MAX_CAROUSEL_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);
const IMAGE_HEIGHT = 200;

interface MediaCarouselProps {
  imageUrls: string[];
  onImagePress?: (index: number, imageUrl: string) => void;
  containerWidth?: number;
  borderRadius?: number;
  showPageIndicator?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  imageUrls,
  onImagePress,
  containerWidth = MAX_CAROUSEL_WIDTH,
  borderRadius = 16,
  showPageIndicator = true,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});
  const pagerRef = useRef<PagerView>(null);
  const pageOffset = useSharedValue(0);

  const handlePageSelected = useCallback((e: any) => {
    const newPage = e.nativeEvent.position;
    setCurrentPage(newPage);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePageScroll = useCallback((e: any) => {
    const { position, offset } = e.nativeEvent;
    pageOffset.value = position + offset;
  }, []);

  const handleImageLoadStart = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  }, []);

  const handleImageLoad = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  }, []);

  const handleImagePress = useCallback((index: number) => {
    if (onImagePress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onImagePress(index, imageUrls[index]);
    }
  }, [onImagePress, imageUrls]);

  // Single image - no carousel needed
  if (imageUrls.length === 1) {
    return (
      <Pressable
        onPress={() => handleImagePress(0)}
        style={[
          styles.singleImageContainer,
          { width: containerWidth, borderRadius },
        ]}
      >
        {loadingStates[0] && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
        <Image
          source={{ uri: imageUrls[0] }}
          style={[styles.singleImage, { borderRadius }]}
          resizeMode="cover"
          onLoadStart={() => handleImageLoadStart(0)}
          onLoad={() => handleImageLoad(0)}
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {/* Pager View for smooth swiping */}
      <View style={[styles.pagerContainer, { borderRadius }]}>
        <PagerView
          ref={pagerRef}
          style={[styles.pager, { height: IMAGE_HEIGHT }]}
          initialPage={0}
          onPageSelected={handlePageSelected}
          onPageScroll={handlePageScroll}
          pageMargin={0}
          overdrag={true}
        >
          {imageUrls.map((url, index) => (
            <Pressable
              key={index}
              onPress={() => handleImagePress(index)}
              style={styles.pageContainer}
            >
              {loadingStates[index] && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
              <Image
                source={{ uri: url }}
                style={[styles.image, { borderRadius }]}
                resizeMode="cover"
                onLoadStart={() => handleImageLoadStart(index)}
                onLoad={() => handleImageLoad(index)}
              />
            </Pressable>
          ))}
        </PagerView>

        {/* Image count badge */}
        <View style={styles.countBadge}>
          <Animated.Text style={styles.countText}>
            {currentPage + 1}/{imageUrls.length}
          </Animated.Text>
        </View>
      </View>

      {/* Page indicator dots */}
      {showPageIndicator && imageUrls.length > 1 && (
        <View style={styles.dotsContainer}>
          {imageUrls.map((_, index) => (
            <PageDot
              key={index}
              index={index}
              currentPage={currentPage}
              pageOffset={pageOffset}
              total={imageUrls.length}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// Animated page indicator dot
interface PageDotProps {
  index: number;
  currentPage: number;
  pageOffset: Animated.SharedValue<number>;
  total: number;
}

const PageDot: React.FC<PageDotProps> = ({ index, pageOffset, total }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Calculate distance from current position (0 = at this page, 1 = one page away)
    const distance = Math.abs(pageOffset.value - index);
    
    // Animate width and opacity based on distance
    const width = interpolate(
      distance,
      [0, 0.5, 1],
      [16, 10, 6],
      "clamp"
    );
    
    const opacity = interpolate(
      distance,
      [0, 0.5, 1],
      [1, 0.6, 0.4],
      "clamp"
    );

    return {
      width: withSpring(width, { damping: 15, stiffness: 150 }),
      opacity: withSpring(opacity, { damping: 15, stiffness: 150 }),
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  pagerContainer: {
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  pager: {
    width: "100%",
  },
  pageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  singleImageContainer: {
    height: IMAGE_HEIGHT,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  singleImage: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 1,
  },
  countBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
});

export default MediaCarousel;

