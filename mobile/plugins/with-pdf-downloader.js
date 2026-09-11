const { withDangerousMod, withMainApplication } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.join('app', 'almaseed', 'pdf');

const MODULE_JAVA = `package app.almaseed.pdf;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.InputStream;
import java.io.OutputStream;

public class PdfDownloaderModule extends ReactContextBaseJavaModule {
  public PdfDownloaderModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "PdfDownloader";
  }

  @ReactMethod
  public void saveToDownloads(String sourceUri, String fileName, Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED_ANDROID", "Automatic PDF saving requires Android 10 or newer.");
      return;
    }

    Context context = getReactApplicationContext();
    android.content.ContentResolver resolver = context.getContentResolver();
    Uri targetUri = null;
    String safeName = sanitize(fileName);
    if (!safeName.toLowerCase().endsWith(".pdf")) safeName += ".pdf";

    try {
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
      values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);

      targetUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (targetUri == null) throw new IllegalStateException("Android could not create the download file.");

      Uri source = Uri.parse(sourceUri);
      try (InputStream input = resolver.openInputStream(source);
           OutputStream output = resolver.openOutputStream(targetUri)) {
        if (input == null || output == null) throw new IllegalStateException("Could not open the PDF stream.");
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        output.flush();
      }

      ContentValues published = new ContentValues();
      published.put(MediaStore.MediaColumns.IS_PENDING, 0);
      resolver.update(targetUri, published, null, null);
      promise.resolve(targetUri.toString());
    } catch (Exception e) {
      if (targetUri != null) {
        try { resolver.delete(targetUri, null, null); } catch (Exception ignored) {}
      }
      promise.reject("PDF_SAVE_FAILED", e.getMessage(), e);
    }
  }

  private static String sanitize(String value) {
    String name = value == null ? "document.pdf" : value.trim();
    name = name.replaceAll("[\\\\/:*?\\\"<>|]", "_");
    return name.isEmpty() ? "document.pdf" : name;
  }
}
`;

const PACKAGE_JAVA = `package app.almaseed.pdf;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PdfDownloaderPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new PdfDownloaderModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;

module.exports = function withPdfDownloader(config) {
  config = withDangerousMod(config, ['android', async (config) => {
    const dir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...PACKAGE_DIR.split(path.sep));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'PdfDownloaderModule.java'), MODULE_JAVA);
    fs.writeFileSync(path.join(dir, 'PdfDownloaderPackage.java'), PACKAGE_JAVA);
    return config;
  }]);

  return withMainApplication(config, (config) => {
    let src = config.modResults.contents;

    if (!src.includes('import app.almaseed.pdf.PdfDownloaderPackage')) {
      src = src.replace(/^(package [^\n]+\n)/, '$1\nimport app.almaseed.pdf.PdfDownloaderPackage\n');
    }

    if (!src.includes('PdfDownloaderPackage()')) {
      const applyMarker = 'PackageList(this).packages.apply {';
      if (src.includes(applyMarker)) {
        src = src.replace(applyMarker, `${applyMarker}\n                  add(PdfDownloaderPackage())`);
      } else {
        const method = /override fun getPackages\(\): List<ReactPackage> \{\n([\s\S]*?)\n\s*\}/;
        if (!method.test(src)) {
          throw new Error('Could not find MainApplication.getPackages() for PdfDownloader registration.');
        }
        src = src.replace(method, (all, body) => {
          if (body.includes('return packages')) {
            return all.replace('return packages', 'packages.add(PdfDownloaderPackage())\n    return packages');
          }
          return `override fun getPackages(): List<ReactPackage> {\n    val packages = PackageList(this).packages.toMutableList()\n    packages.add(PdfDownloaderPackage())\n    return packages\n  }`;
        });
      }
    }

    config.modResults.contents = src;
    return config;
  });
};
