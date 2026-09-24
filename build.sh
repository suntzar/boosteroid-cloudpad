#!/bin/bash
# Build an Android APK entirely from Termux
# Run setup.sh first to install dependencies
set -e

PROJECT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_JAR="$HOME/android-sdk/android.jar"
BUILD="$PROJECT/build"
GEN="$BUILD/gen"
OBJ="$BUILD/obj"
APK_DIR="$BUILD/apk"
COMPILED_RES="$BUILD/compiled_res"
APK_NAME="boosteroid-pad"

if [ ! -f "$ANDROID_JAR" ]; then
    echo "ERROR: android.jar not found at $ANDROID_JAR"
    echo "Run setup.sh first to download it."
    exit 1
fi

echo "=== Cleaning build artifacts ==="
rm -rf "$GEN" "$OBJ" "$APK_DIR" "$COMPILED_RES" "$BUILD/classes.dex"
mkdir -p "$GEN" "$OBJ" "$APK_DIR" "$COMPILED_RES"

echo "=== Step 0: Bundle JS Modules & CSS Themes ==="
cat assets/gamepad/00_header.js \
    assets/gamepad/01_core.js \
    assets/gamepad/02_layout.js \
    assets/gamepad/03_ui.js \
    assets/gamepad/04_edit.js \
    assets/gamepad/05_input.js \
    assets/gamepad/06_init.js \
    assets/gamepad/99_footer.js > assets/gamepad.js

cat assets/theme/*.css > assets/theme.css


echo "=== Step 1: Compile resources ==="
aapt2 compile --dir "$PROJECT/res" -o "$COMPILED_RES/"

echo "=== Step 2: Link resources ==="
aapt2 link \
    -I "$ANDROID_JAR" \
    --manifest "$PROJECT/AndroidManifest.xml" \
    -A assets \
    --java "$GEN" \
    -o "$APK_DIR/${APK_NAME}-unaligned.apk" \
    "$COMPILED_RES"/*.flat

echo "=== Step 3: Compile Java ==="
javac \
    -source 1.8 -target 1.8 \
    -classpath "$ANDROID_JAR" \
    -d "$OBJ" \
    "$GEN/com/cloudpad/boosteroid/R.java" \
    "$PROJECT/src/com/cloudpad/boosteroid/MainActivity.java"

echo "=== Step 4: DEX ==="
dx --dex --output="$BUILD/classes.dex" "$OBJ"

echo "=== Step 5: Package APK ==="
cp "$APK_DIR/${APK_NAME}-unaligned.apk" "$APK_DIR/${APK_NAME}.apk"
cd "$BUILD" && zip -j "$APK_DIR/${APK_NAME}.apk" classes.dex
cd "$PROJECT"

echo "=== Step 6: Sign ==="
if [ ! -f "$HOME/.debug.keystore" ]; then
    keytool -genkeypair \
        -keystore "$HOME/.debug.keystore" \
        -alias debug \
        -keyalg RSA -keysize 2048 \
        -validity 10000 \
        -storepass android \
        -keypass android \
        -dname "CN=Debug, OU=Debug, O=Debug, L=Debug, ST=Debug, C=US"
fi

apksigner sign \
    --ks "$HOME/.debug.keystore" \
    --ks-key-alias debug \
    --ks-pass pass:android \
    --key-pass pass:android \
    "$APK_DIR/${APK_NAME}.apk"

echo ""
echo "=== BUILD SUCCESSFUL ==="
ls -lh "$APK_DIR/${APK_NAME}.apk"
echo ""
echo "To install:"
echo "  cp $APK_DIR/${APK_NAME}.apk ~/storage/shared/ && termux-open ~/storage/shared/${APK_NAME}.apk"
