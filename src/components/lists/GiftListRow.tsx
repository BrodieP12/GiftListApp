import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from '../common/Button';
import { GiftList } from '../../types/models';
import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/ThemeContext';

interface GiftListRowProps {
  list: GiftList;
  onPress: () => void;
  onDelete: (id: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  deleteActionStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subTitleStyle?: StyleProp<TextStyle>;
  revealWidth?: number;
  // Icon shown for the swipe action. Defaults to 'trash' (delete); shared
  // lists pass 'sign-out-alt' to represent "leave".
  actionIcon?: string;
}

export const GiftListRow = ({
                              list,
                              onPress,
                              onDelete,
                              containerStyle,
                              cardStyle,
                              deleteActionStyle,
                              titleStyle,
                              subTitleStyle,
                              revealWidth = 100,
                              actionIcon = 'trash',
                            }: GiftListRowProps) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
        <View style={[
          styles.deleteActionContainer,
          { width: revealWidth, backgroundColor: colors.danger },
          deleteActionStyle
        ]}>
          <TouchableOpacity
              style={styles.deleteActionButton}
              onPress={() => onDelete(list.id)}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <FontAwesome5 name={actionIcon} size={24} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        </View>
    );
  };

  return (
      <View style={[styles.swipeContainer, containerStyle]}>
        <Swipeable
            renderRightActions={renderRightActions}
            friction={2}
            containerStyle={[styles.swipeableElement, { backgroundColor: colors.danger }]}
        >
          <View style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            cardStyle
          ]}>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }, titleStyle]}>
                {list.title}
              </Text>
              <Text style={[styles.cardSub, { color: colors.textDim }, subTitleStyle]}>
                {list.ownerId === user?.uid ? 'Owner: Me' : 'Shared With Me'}
              </Text>
            </View>
            <Button
                title="View"
                variant="secondary"
                icon="chevron-right"
                iconPosition="right"
                onPress={onPress}
            />
          </View>
        </Swipeable>
      </View>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeableElement: {
    borderRadius: 12,
  },
  card: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardSub: {
    marginTop: 4,
  },
  deleteActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  deleteActionButton: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});