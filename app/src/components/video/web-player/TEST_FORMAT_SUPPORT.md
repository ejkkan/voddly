# Testing the Format Support System

## ✅ **Issue Fixed**

The main error has been resolved:

- **Problem**: `apiClient.metadata.detectEmbeddedTracks` didn't exist
- **Solution**: Changed to `apiClient.user.detectEmbeddedSubtitles`
- **Result**: Format support analysis should now work correctly

## 🧪 **How to Test**

### 1. **Load a Video with Format Support**

- Navigate to any video player page
- The format support indicator should appear above the video
- You should see format information (MKV, MP4, etc.) and support level

### 2. **Check Console for Success**

- Open browser developer tools
- Look for successful API calls to `/user/subtitles/detect-embedded`
- Should see format analysis results instead of errors

### 3. **Verify UI Components**

- **Format Support Indicator**: Shows container format and support level
- **Enhanced Controls**: Subtitle and audio buttons adapt to available features
- **Track Information**: Displays available subtitle and audio tracks

## 🔍 **Expected Behavior**

### **For MKV Files**:

```
🟢 MKV - EXCELLENT
📝 2 subtitles (English, Spanish)
🔊 3 audio tracks (English, German, French)
```

### **For MP4 Files**:

```
🟦 MP4 - GOOD
📝 1 subtitle (English TTXT)
🔊 2 audio tracks (English, Spanish)
```

### **For AVI Files**:

```
🟡 AVI - LIMITED
📝 0 subtitles
🔊 1 audio track (English)
```

## 🚨 **If Issues Persist**

### **Check Backend Logs**:

```bash
# Look for FFmpeg errors or API endpoint issues
tail -f backend/logs/app.log | grep "detect-embedded"
```

### **Verify FFmpeg Installation**:

```bash
# Ensure FFmpeg is available on the backend
ffprobe -version
```

### **Test API Endpoint Directly**:

```bash
curl -X POST "http://localhost:4000/user/subtitles/detect-embedded" \
  -H "Content-Type: application/json" \
  -d '{"streamUrl":"test-url","quickScan":true}'
```

## 🎯 **Success Indicators**

1. **No more console errors** about "Cannot read properties of undefined"
2. **Format support indicator appears** above video player
3. **API calls succeed** with proper response data
4. **UI controls adapt** to available features
5. **Track information displays** correctly

## 🔧 **Next Steps After Testing**

1. **Verify track selection** works for embedded subtitles
2. **Test audio track switching** functionality
3. **Check subtitle modal** shows both embedded and external options
4. **Validate format recommendations** are accurate

The format support system should now work correctly and provide users with clear information about their video's capabilities! 🎉
