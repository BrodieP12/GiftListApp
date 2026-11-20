/**
 * react-native.d.ts
 *
 * Module augmentation for 'react-native': adds an optional `className`
 * prop to several core component prop interfaces (View, Text, TextInput,
 * TouchableOpacity, ScrollView, FlatList, Modal, Pressable, Image,
 * ActivityIndicator). This exists to satisfy TypeScript when a NativeWind-
 * style/Tailwind `className` prop (seen in use elsewhere in this codebase,
 * e.g. `ScrollToBottomFab.tsx`) is passed to these otherwise-standard React
 * Native components, which don't natively declare that prop.
 */
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface FlatListProps<ItemT> {
    className?: string;
  }
  interface ModalProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
}

