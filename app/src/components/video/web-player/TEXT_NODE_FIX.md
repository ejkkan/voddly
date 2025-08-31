# Text Node Fix for React Native

## 🚨 **Issue Fixed**

**Error**: `Unexpected text node: . A text node cannot be a child of a <View>.`

**Cause**: Text nodes (plain text) were being rendered as direct children of `<View>` components, which is not allowed in React Native.

## 🔍 **Root Causes Found**

### 1. **Text Concatenation with Line Breaks**

```tsx
// ❌ WRONG - Creates text nodes
<Text>
  {formatInfo.subtitleTracks.length} subtitle
  {formatInfo.subtitleTracks.length !== 1 ? 's' : ''}
</Text>

// ✅ CORRECT - Single text expression
<Text>
  {`${formatInfo.subtitleTracks.length} subtitle${formatInfo.subtitleTracks.length !== 1 ? 's' : ''}`}
</Text>
```

### 2. **Newline Characters in Text**

```tsx
// ❌ WRONG - Creates text nodes with newlines
<Text>
  • AAC: High quality{'\n'}• MP3: Good quality{'\n'}• AC3: Surround sound
</Text>

// ✅ CORRECT - Separate Text components
<View className="space-y-1">
  <Text>• AAC: High quality</Text>
  <Text>• MP3: Good quality</Text>
  <Text>• AC3: Surround sound</Text>
</View>
```

## 🛠️ **Files Fixed**

1. **`FormatSupportIndicator.tsx`**
   - Fixed subtitle count text concatenation
   - Fixed audio track count text concatenation

2. **`AudioTrackModal.tsx`**
   - Fixed audio quality info with newlines
   - Replaced single Text with multiple Text components

## 📋 **Best Practices**

### **Always Wrap Text in Text Components**

```tsx
// ❌ Never do this
<View>
  Some plain text here
</View>

// ✅ Always do this
<View>
  <Text>Some plain text here</Text>
</View>
```

### **Use Template Literals for Dynamic Text**

```tsx
// ❌ Avoid concatenation with line breaks
<Text>
  {count} items
  {count !== 1 ? 's' : ''}
</Text>

// ✅ Use template literals
<Text>
  {`${count} item${count !== 1 ? 's' : ''}`}
</Text>
```

### **Handle Multi-line Content Properly**

```tsx
// ❌ Don't use newlines in single Text
<Text>
  Line 1{'\n'}Line 2{'\n'}Line 3
</Text>

// ✅ Use separate Text components
<View className="space-y-1">
  <Text>Line 1</Text>
  <Text>Line 2</Text>
  <Text>Line 3</Text>
</View>
```

## 🧪 **Testing the Fix**

1. **Load a series/movie detail page**
2. **Check for format support indicator**
3. **Open subtitle or audio track modals**
4. **Verify no console errors about text nodes**

## 🔮 **Prevention**

### **ESLint Rules to Add**

```json
{
  "rules": {
    "react-native/no-raw-text": "error",
    "react-native/no-inline-styles": "warn"
  }
}
```

### **Code Review Checklist**

- [ ] All text is wrapped in `<Text>` components
- [ ] No plain text as direct children of `<View>`
- [ ] No `{'\n'}` characters in text content
- [ ] Dynamic text uses template literals
- [ ] Multi-line content uses separate `<Text>` components

## 🎯 **Result**

After this fix:

- ✅ No more text node errors
- ✅ Format support indicator displays correctly
- ✅ Subtitle and audio modals work properly
- ✅ All text is properly contained in Text components

The format support system should now work without React Native text node errors! 🎉
