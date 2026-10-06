package expo.modules.safsave

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

// expo-file-system can't stream into a folder the user picked (a content://
// SAF document): its copy only writes to plain files, and the base64 write
// holds the whole file in memory. This copies with a small buffer, so a large
// PDF/audio/video saves to «الملفات» at any size.
class SafSaveModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafSave")

    // Copies `from` (file:// or content://) into the SAF document `to`.
    // Resolves with the number of bytes written.
    AsyncFunction("copyToUri") { from: String, to: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val src = Uri.parse(from)
      val input: InputStream = if (src.scheme == "file" || src.scheme == null) {
        FileInputStream(File(src.path ?: from))
      } else {
        context.contentResolver.openInputStream(src) ?: throw IllegalStateException("Cannot open source")
      }
      val output = context.contentResolver.openOutputStream(Uri.parse(to), "w")
        ?: throw IllegalStateException("Cannot open target")
      var written = 0L
      input.use { i -> output.use { o -> written = i.copyTo(o, 256 * 1024) } }
      written.toDouble()
    }
  }
}
