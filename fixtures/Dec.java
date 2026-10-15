import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import org.tukaani.xz.LZMA2InputStream;
import org.tukaani.xz.LZMAInputStream;
import org.tukaani.xz.MemoryLimitException;

// Batch driver for recording the Java decoder's outcome per stream.
// Usage: java -cp <classes> Dec <memLimitKiB> [lzma1|lzma2] < list
// Without a format, each input line is a .lzma file path. With "lzma1",
// a line is "<path>\t<lc>\t<lp>\t<pb>\t<dictSize>\t<uncompressedSize>"
// for raw LZMA1 (-1 for an unknown size), decoded with the relaxed end
// condition. With "lzma2", a line is "<path>\t<dictSize>" for raw LZMA2.
// The raw constructors take no memory limit.
// For each input line, prints one TSV line:
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
		String format = args.length > 1 ? args[1] : "lzma";
		BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));
		StringBuilder out = new StringBuilder();
		String line;
		while ((line = stdin.readLine()) != null) {
			if (line.isEmpty()) continue;
			String[] fields = line.split("\t");
			String path = fields[0];
			byte[] data = Files.readAllBytes(Paths.get(path));
			MessageDigest sha = MessageDigest.getInstance("SHA-256");
			out.append(path).append('\t');
			try {
				long total = 0;
				try (InputStream s = open(format, fields, new ByteArrayInputStream(data), memLimitKiB)) {
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

	static InputStream open(String format, String[] fields, InputStream in, int memLimitKiB) throws IOException {
		if (format.equals("lzma1")) {
			long size = Long.parseLong(fields[5]);
			LZMAInputStream s = new LZMAInputStream(in, size, Integer.parseInt(fields[1]), Integer.parseInt(fields[2]), Integer.parseInt(fields[3]), Integer.parseInt(fields[4]), null);
			s.enableRelaxedEndCondition();
			return s;
		}

		if (format.equals("lzma2")) {
			return new LZMA2InputStream(in, Integer.parseInt(fields[1]));
		}

		return new LZMAInputStream(in, memLimitKiB);
	}

	static String hex(byte[] b) {
		StringBuilder s = new StringBuilder();
		for (byte x : b) s.append(String.format("%02x", x));
		return s.toString();
	}
}
