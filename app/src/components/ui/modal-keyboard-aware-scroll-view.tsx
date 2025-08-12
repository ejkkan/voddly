// source https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view
/**
 * This component is used to handle the keyboard in a modal.
 * It is a wrapper around the `KeyboardAwareScrollView` component from `react-native-keyboard-controller`.
 * It is used to handle the keyboard in a modal.
 * example usage:
      export function Example() {
        return (
          <Modal>
            <BottomSheetKeyboardAwareScrollView>
            </BottomSheetKeyboardAwareScrollView>
          </Modal>
        );
        }
 */
import {
  type BottomSheetScrollViewMethods,
  createBottomSheetScrollableComponent,
  SCROLLABLE_TYPE,
} from '@gorhom/bottom-sheet';
import { type BottomSheetScrollViewProps } from '@gorhom/bottom-sheet/src/components/bottomSheetScrollable/types';
import { memo } from 'react';
import { ScrollView } from 'react-native';
import Reanimated from 'react-native-reanimated';

// Use regular ScrollView for all platforms now
const AnimatedScrollView = Reanimated.createAnimatedComponent(ScrollView);

const BottomSheetScrollViewComponent = createBottomSheetScrollableComponent<
  BottomSheetScrollViewMethods,
  BottomSheetScrollViewProps
>(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedScrollView);
const BottomSheetKeyboardAwareScrollView = memo(BottomSheetScrollViewComponent);

BottomSheetKeyboardAwareScrollView.displayName =
  'BottomSheetKeyboardAwareScrollView';

export default BottomSheetKeyboardAwareScrollView;
