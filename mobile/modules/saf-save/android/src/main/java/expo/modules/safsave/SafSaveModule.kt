package expo.modules.safsave

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
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

    // Saves a downloaded image/video into the phone's gallery (Pictures/ or
    // Movies/ «folder»), streamed, via MediaStore. On Android 10+ an app may add
    // its own media there WITHOUT any storage/media permission — so the app no
    // longer needs READ_MEDIA_IMAGES / READ_MEDIA_VIDEO (Play policy). Older
    // Android rejects this; the JS side then saves to a picked folder instead.
    // Resolves with the new content:// URI.
    AsyncFunction("saveToGallery") { from: String, displayName: String, mimeType: String, folder: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw IllegalStateException("Gallery save needs Android 10+")
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val isVideo = mimeType.startsWith("video/")
      val collection = if (isVideo) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        else MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val base = if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        put(MediaStore.MediaColumns.RELATIVE_PATH, "$base/$folder")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val resolver = context.contentResolver
      val target = resolver.insert(collection, values) ?: throw IllegalStateException("Cannot create media entry")
      try {
        val src = Uri.parse(from)
        val input: InputStream = if (src.scheme == "file" || src.scheme == null) FileInputStream(File(src.path ?: from))
          else resolver.openInputStream(src) ?: throw IllegalStateException("Cannot open source")
        val output = resolver.openOutputStream(target, "w") ?: throw IllegalStateException("Cannot open target")
        input.use { i -> output.use { o -> i.copyTo(o, 256 * 1024) } }
        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(target, values, null, null)
      } catch (e: Exception) {
        resolver.delete(target, null, null)
        throw e
      }
      target.toString()
    }
  }
}
