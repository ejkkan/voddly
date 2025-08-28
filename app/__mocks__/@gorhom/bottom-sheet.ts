declare module '@gorhom/bottom-sheet/mock';

const mock = {
  default: {
    BottomSheetModal: () => null,
    BottomSheetView: () => null,
    BottomSheetScrollView: () => null,
    BottomSheetFlatList: () => null,
    BottomSheetTextInput: () => null,
    BottomSheetTouchableOpacity: () => null,
    BottomSheetTouchableHighlight: () => null,
    BottomSheetBackdrop: () => null,
    BottomSheetHandle: () => null,
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    useBottomSheetModal: () => ({
      dismiss: () => {},
      expand: () => {},
      collapse: () => {},
      close: () => {},
    }),
    useBottomSheetDynamicSnapPoints: () => ({
      animatedHandleHeight: { value: 0 },
      animatedSnapPoints: { value: ['25%', '50%', '90%'] },
      animatedContentHeight: { value: 0 },
      handleContentLayout: () => {},
    }),
  },
};

export default mock.default;
