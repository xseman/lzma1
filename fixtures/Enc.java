import java.io.*;
import java.nio.file.*;
import org.tukaani.xz.*;
// Usage: java -cp /tmp/xzj Enc in out dictSize lc lp pb mode(fast|normal) mf(hc4|bt4) nice depth
public class Enc {
  public static void main(String[] a) throws Exception {
    byte[] in = Files.readAllBytes(Paths.get(a[0]));
    LZMA2Options o = new LZMA2Options();
    o.setDictSize(Integer.parseInt(a[2]));
    o.setLcLp(Integer.parseInt(a[3]), Integer.parseInt(a[4]));
    o.setPb(Integer.parseInt(a[5]));
    o.setMode(a[6].equals("fast") ? LZMA2Options.MODE_FAST : LZMA2Options.MODE_NORMAL);
    o.setMatchFinder(a[7].equals("hc4") ? LZMA2Options.MF_HC4 : LZMA2Options.MF_BT4);
    o.setNiceLen(Integer.parseInt(a[8]));
    o.setDepthLimit(Integer.parseInt(a[9]));
    boolean marker = a.length > 10 && a[10].equals("marker");
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    try (LZMAOutputStream s = new LZMAOutputStream(bos, o, marker ? -1 : in.length)) { s.write(in); }
    Files.write(Paths.get(a[1]), bos.toByteArray());
  }
}
