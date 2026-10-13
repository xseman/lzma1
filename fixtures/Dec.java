import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import org.tukaani.xz.LZMAInputStream;
import org.tukaani.xz.MemoryLimitException;

// Batch driver for recording the Java decoder's outcome per stream.
// Usage: java -cp <classes> Dec <memLimitKiB> < list-of-paths
// For each input line (a .lzma file path), prints one TSV line:
//   <path>\tok\t<decodedLength>\t<sha256hex>
//   <path>\terror\t<ExceptionSimpleName>
// Only an IOException from the decoder counts as the Java decoder rejecting
// the stream (CorruptedInputException, EOFException and the rest of the
// XZIOException family are IOExceptions). A MemoryLimitException is the
// harness's own limit, not a verdict on the stream, so it aborts
// generation, as do JVM errors and runtime exceptions; so does failing to
// read a case file. The memory limit is recorded in the manifest.
public class Dec {
	public static void main(String[] args) throws Exception {
		int memLimitKiB = Integer.parseInt(args[0]);
		BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));
		StringBuilder out = new StringBuilder();
		String path;
		while ((path = stdin.readLine()) != null) {
			if (path.isEmpty()) continue;
			byte[] data = Files.readAllBytes(Paths.get(path));
			MessageDigest sha = MessageDigest.getInstance("SHA-256");
			out.append(path).append('\t');
			try {
				long total = 0;
				try (LZMAInputStream s = new LZMAInputStream(new ByteArrayInputStream(data), memLimitKiB)) {
					byte[] buf = new byte[65536];
					int n;
					while ((n = s.read(buf)) != -1) {
						sha.update(buf, 0, n);
						total += n;
					}
				}
				out.append("ok\t").append(total).append('\t').append(hex(sha.digest()));
			} catch (MemoryLimitException e) {
				throw e;
			} catch (IOException e) {
				out.append("error\t").append(e.getClass().getSimpleName());
			}
			out.append('\n');
		}
		System.out.print(out);
	}

	static String hex(byte[] b) {
		StringBuilder s = new StringBuilder();
		for (byte x : b) s.append(String.format("%02x", x));
		return s.toString();
	}
}
