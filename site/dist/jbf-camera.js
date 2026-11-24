/*!
 * Reads the five jars from a photo of the Jumbleberry Fields game screen.
 *
 *   const r = await JBFCamera.read(fileOrImage);
 *   r.status: 'ok' | 'empty' (dice not rolled yet) | 'partial' | 'nojars' (couldn't find five still jars)
 *   r.jars:   ['J','S','P','M','F' or null] left to right, r.locked: [bool x5]
 *   r.boxes:  where each jar is, as fractions of the image ({x, y, w, h})
 *   r.board:  the rest of the screen, or null if the scorecard isn't in view:
 *             { cells: [true/false/null x9] (box shows a number), rollActive (false = ROLL greyed out),
 *               counter: { left: 3|2|1|0 } rolls left this round from the x3 sign, or null if it isn't in view,
 *               score: { value, conf } the SCORE number, or null if it couldn't be read for sure,
 *               quads: { roll, score, cells[9] } corner points as fractions of the image }
 *   r.view:   { size (jar spacing in camera pixels), out: { top, bottom, left, right } (edges that cut off the game) }
 *   r.cut:    with 'nojars', the frame edge that cuts through the jars, if any ('top', 'bottom', 'left', 'right')
 *   JBFCamera.readFrame(video) does the same for the current frame of a live camera <video>.
 *
 * How it works: the dice faces are a distinctive light cyan. We find cyan blobs, keep the
 * diamond-shaped ones, pick the five that form an evenly spaced row, then classify each by the
 * coloured pixels inside (red / yellow / green / purple berry, or a grey-black Fly in the middle).
 * A red lid just above a jar means it is locked. Dice that are mid-roll are tilted and blurred,
 * so they fail the shape test and the photo is rejected rather than misread.
 * From the jar row it then finds the scorecard, the ROLL button, the roll counter and the SCORE field,
 * and reads the SCORE and the counter with a small built-in shape matcher (no OCR library to download).
 * Tuned and checked on 16 phone photos and 18 phone screenshots of a laptop screen.
 */
(function (root) {
  'use strict';
  const SIDE = 720;

  function toHsv(data, n) {
    const H = new Float32Array(n), S = new Float32Array(n), V = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[4 * i] / 255, g = data[4 * i + 1] / 255, b = data[4 * i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn + 1e-9;
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
      H[i] = h; S[i] = mx > 0 ? (mx - mn) / (mx + 1e-9) : 0; V[i] = mx;
    }
    return { H, S, V };
  }

  function components(mask, w, h) {
    const lab = new Int32Array(w * h).fill(-1), comps = [], stack = new Int32Array(w * h);
    for (let start = 0; start < w * h; start++) {
      if (!mask[start] || lab[start] >= 0) continue;
      const id = comps.length; let sp = 0, n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0;
      stack[sp++] = start; lab[start] = id;
      while (sp) {
        const p = stack[--sp], y = (p / w) | 0, x = p - y * w;
        n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of nb) if (q >= 0 && mask[q] && lab[q] < 0) { lab[q] = id; stack[sp++] = q; }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      comps.push({ n, x0, x1, y0, y1, w: bw, h: bh, cx: sx / n, cy: sy / n, fill: n / (bw * bh) });
    }
    return comps;
  }

  function* combos(arr, k, start = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };

  let canvas = null;
  function readPixels(img) {   // an <img>, a playing <video>, or a <canvas>
    const sw = img.videoWidth || img.naturalWidth || img.width, sh = img.videoHeight || img.naturalHeight || img.height;
    const scale = SIDE / Math.min(sw, sh);           // the short side becomes SIDE pixels, held either way up
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const c = canvas || (canvas = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h, src: img, scale };
  }

  // ---- the SCORE number ------------------------------------------------------------------------
  // SCORE is dark digits on a white field. We cut that field out of the full-size frame, straighten
  // it, split it into digits and match each digit's shape against digit shapes taken from bold fonts
  // and from the game's own digits. No OCR library to download: a few milliseconds a frame.
  const SCORE_AREA = [0.28, 0.8, 1.28, 1.32];        // the white SCORE field plus a margin, in jar spacings
  const OW = 200, OH = Math.round(OW * (SCORE_AREA[3] - SCORE_AREA[1]) / (SCORE_AREA[2] - SCORE_AREA[0]));
  const GW = 8, GH = 12;                              // grid a digit's shape is sampled on
  let MIN_SIM = 0.6, MIN_MARGIN = 0.08;               // how sure a digit match must be
  const MIN_AREA_PX = 90;                             // the SCORE area must be at least this wide in the camera frame
  let PAD = 0, INK_T = 0.5, DESKEW = true;            // digit box: extra columns, the ink level that counts, straighten slant
  // One template per entry: the digit, then GW*GH ink levels (hex), rendered from each font at 72 px
  // and put through shape() below, plus the game's own digits cut from photos. Checked on the 27
  // photos where the SCORE is visible, leaving each photo out of the game digits in turn: 22 read
  // right, 5 too blurry to be sure, none wrong. The game's 4 and 8 haven't been seen yet; the fonts
  // stand in for them.
  let TEMPLATES = [
    '00002200006effe605ffddff5afe11efbefc00bfeffb00affffb00affdfb00bfdafe11efa4ffddff506effe6000022000 100005ff80004eff7029ffff54ffffff37fe8fff26822fff00004ffe00005ffc00007ffb00008ff90000aff80000bff60 20000000006cdca307fffffe3dfd13ff845402ff80001cff3003dff6004efd4002eff75549ffffffebddddddd00000000 30002200007effe906ffddff66bb03ff80006cfe2000dffa100067ffb00000bffacb01dfd9ffddff709effe7000022000 4000000000002bb40000cff60008fff7004fdbf802ef49fa0bf707fb0fffffffddfffffff12225ff200002bb000000000 5000000000cfffffb1efffffa2ff644435ff9bb608ffffff759923efe00000bffcdc11efc8ffeeff507dffc5000000000 60001210002afffb11dffcffa7ff50887bff26730efeefff5eff96efddfd008ffafe10afe4ffecff806dffe8000022000 700000000cddddddbdffffffe46668ff80000bfb00004ff30000afc00001ef800003ff500005ff400005dd30000000000 80012200008effe807ffddff7afd00efa6ff9aff61cffffc1aff88ff9efb00cfeefd11dfe9ffddff91affff9100122100 90002200008effe607ffdeff4efb01efbff900dfddfe69ffe5fffeefe03772ffc68905ff7affcffd11bfffb2000121000',   // Arial Black
    '001aefa200bffffd14ff43ef57fc00af9afa008fbaf9007fbaf9007fbafa008fb8fc00af94ff42ef50bffffd1019efa20 100004fb00003efa0018eff8009fedf700ba2cf500100df400001ef300002ff100003ff000004fe000006fc000007fb00 205ceea205fffffd1cfb24ef7bd500af800000bf800006ff20005ff60005ff70004ff60001efb55557ffffffeaeeeeeee 303bfea202effffd18fb13ff524201ef40006bfb0000dfe4000057ef5000008fb8b4007fcafc23df93effffd203bfea20 4000057100003ff30000cff40007fef5002ecaf600bf39f705f808f80dfa9cfd8dfffffff44448fc400004fc000001760 507eeeee80afffff80df755531fe110004fedfd507ffffff56c812cfc000006fead6007fdafd34df93effffd103bed910 6006cfd6007fffff52ff71afb7fd00252afa37510bfdfffc1cffb9ef9bfc006fcafa004fc6fe41afa1cffffe302aefb30 7cddddddacffffffd57777df800004fd10000bf600003fe100008f900000cf600000ef300001ff100002fe100001dd100 804bffb302efddfe27fc00cf67fa00bf62ef99fd106ffff504fe67ef4bf7008facf6007fbbfb01cf94ffddfe204bffb30 903bfea202effffd19fb13ef7df5009facf700bfc8fe9bffd1cfffdfc005739fb24200cf8afa16ff35fffff8006dfd600',   // Arial Bold
    '0019dd8101dfccfc17fa00af6cf5005fbef3003fdff2003feff2003feef3004fdcf5006fb7fa00bf61dfccfc1018dc810 1000008d000007fe0002affc009ffcfb00db37f9000008f800000af600000cf500000df300000ef200001ff000001da00 2027984004efeff90cf603ef4ed0009f754000bf600005fe10007fe50008fe40007fd30005ff522218ffffffe29999997 3029dda203eebcfd19f600cf659000af600147fd100bfff8000356df6220004fdec0003fecf6008fb3efbcfe303add920 4000011000000ce100008ff30004fdf4001db6f5009e25f605f504f60dfbbcfd97ccccfea00001f9000000e9000000110 503bbbbb80bfffffc0de100002fc000005fcbfd608fe99ef7392005fe000001ffbb0002fecf700afa4efddfc1028ba610 60049b93007fecfe33fd206f89f700052cf59cb40efecbff4efa007fbef4002fdcf5003fd7fb009f81cfddfc1017bb610 7acccccc9affffffe000009f800003fd10000af600001ee100006fb000009f800000df600000ef600000ef5000007c200 803adda303efbbfe29f8009f8af5007f95fd55df309ffff807fd66df6ef3004feff1002ffdf6007fd5ffbbff504adda40 9029cd9202dfccfd2af800af8ef2004fdff1004ffcf600afe5ffbcefe05cda5fd240006faaf401cf45febdf9005bdb600',   // Arial Rounded Bold
    '00000000006cffc405ffdeff3cfc01ef9ff800afdff7009feff7009feff800afccfc01ef95ffdeff306cffc4000000000 10005cc30147eff304fffff204bbfff10001efe00001ffd00002ffc00004ffb00005ffa00237ffa33dffffffeccccccca 2002210009efffc30efcdffe182009ff500005ff40000bfe10007ff60008ff7001afe5000cffdcccbefffffff22222222 301343100aeffffa1cfcbdff771001ef900236ff400bffe600069bff600000cfd71001dfdfebbdff8cffffe8001343100 40000000000019950000bff90008fef9005f7af903ea0afa0de54bfb4fffffffe7888cfd700008fa00000596000000000 5011111113ffffffd4ffdcccb5ff200005ffa98206ffffff548448ffd00000afe93002dfcefddfff49dffeb4000111000 600000000005befe309ffece35ff70011afc6aa50dffffff6efa02cfddf9008ffafd00bfc3ffcbff504cffc5000000000 700000000cdddddd9bffffffd00000dfc00004ff60000bfe10002ff900008ff30001efc00006ff60000add10000000000 80000000005beeb606ffccff7bfb00afb9fe72cf61bffff804de9eff7df701afeef9008fe8ffdcff806ceeb6000000000 90000000005cffc505ffccff4cfb00cfbef9008fecfd209ff6ffffffe049a7bfb11006ff52eceffa02efeb60000000000',   // Verdana Bold
    '0003663000affff906ffbbff6cfd00dfbefa00afeff9009ffff9009ffefa00afecfd00dfb6ffbbff60affff9000366300 10006ff50169eff404fffff303aaeff20000dfe10000efe00001ffd00002ffc00003ffb00115ffa11dffffffeeffffffd 203565100cffffe50deabffe161008ff400006ff40000bfe10007ff50007ff80008ff7000affda999effffffe66666666 3269aa720cfffffe3cc87bffa40001ffb00349ff400afff60006acff700000cff40000cfffc77affcffffffe337aaa710 4000000000004ee80001dff9000afef9007f7cfa03fb0bfa0de54cfb4ffffffffaaaadfea0000afb000009eb000000000 5155555552ffffffc3ffbaaa84ff400004ffcb9305ffffff536459ffc00000cfe71001efbeebaeff5cffffe7002554100 60003777102cffff41dffa8b38ff40000dfc8cc70effffff8ffa02dfeff900affdfb00bfe8ff77ff91bffffc100477400 722222221dffffffa9ddddffd00001efb00006ff50000cfe10003ff900009ff40001efd00005ff80000bff20000122000 80002200007effe807ffaaff7afc00cf98ff82ef51affff703de9eff5cf801cfcef9009fd9ffa9ff919effe8000022000 90025630008ffffa16ff98ff8cfc00bfdefb008ffcfe309ff6fffffff05bb8bfc00003ef71c9affd12ffffb2005652000',   // Tahoma Bold
    '0006aa6100afeefc06fb11bf6bf4004fbef1001feff1001feef1000ffdf2001febf5003fc5fc10af70bfeefb1006ab710 100002c500004df4001afff3004faff200341ff000002fe000003fd000004fc000005fb000006fa000007f9000008f800 218efd810afedefa06b103ff200001ef300005fe00000cf700007fd10003ef40000cf900007fd10003efeddddafffffff 307dfe9102eecefc004104ff200001ef300028fc0002ffe300019dfc100001cf7000009f907101df76fecefe219efe920 40000043000004f600002df70000bff90009e7fa006f62fa03e901fb0cffffffd78888ee700000de000000ce100000571 509fffffc0bfdccc90cf300000df553000effffb11fc89ff7040009fa000007fa000009f817103ef49fecffa03befd700 600018d30001cfd4001cfb10009fb00003ff997208fffffe3bfd54cfbcf6005fccf4004fb9f800af93efddfe204bffa20 7bccccccbcffffffd11111af800001ef200005fc00000bf700001ef300005fd000009f900000df500002ff200004cb000 803bffb302efddfe27fb00cf66fc00cf51dfb9fc105ffff303ef8cfd2bf701afadf3004fdcf8008fc6ffddff505cffc50 902aefb401dfdcfe38fb008f9bf5004fbcf5006fc9fc23dfb2efffff8028aaff20000bf90001afc1003cfc20003d81000',   // Trebuchet Bold
    '00026630008ffff905ffeeff6bff56ffceff22ffefff21ffffff21fffeff32ffebff65ffc5ffeeff608ffff9000266300 100018ff306aefff21efffff02fedffe01209ffc0000bffb0000cff90000eff80001eff60002fff50003fff30005fff20 227ab9500efffff90dffffff48302eff60000dff60008fff201afff601bffd4008ffb1000dffffffdeffffffe9bbbbbbb 34befea308fffffe28b8afff71000dff70469ffe30bfffd400bffffc20225dffa10008ffcba89effbcffffff47cffea30 4000000000007bb20001eff40008fff4002eeff600af8ff706fd1ef80dfdbffdadfffffff3333cfc300008b8000000000 53ffffff74ffffff75ffeddd66ff700007ffcb9308ffffff49ffffffc0113cffe10009ffdeb9bfff9ffffffc19cefd810 60015998202dffff41dffebc47ffb1000bff69b70effffff8fffdcffeeff41effcff51fff6ffedffa0bffffd200599610 745555554effffffddffffffd34448ff80000cfe10005ffa0000bff50002ffe10006ffc00009ff90000cff80000455200 8004774001bffffc18ffccff9aff21ffb6ff87ff709ffff904effffe4dfe33efdffd00dffcffbbffc2cffffd300477400 9003773001bffff808ffeeff5eff25ffafff14ffdcffcdffe4fffeffd02764ffa0001bff56ddeffc17ffffc2015774000',   // Segoe UI Black
    '0016bb7101bffffc06ff55ff6bfb00bfbef8008feff7007feef8007ffef9008febfc00afc6ff64ef70bffffc1016bb710 100018f90028eff8008ffff6008a5ff500004ff300005ff200006ff000008fe000009fd00000bfb00000cfa00000df800 228bb9300efffff60d845dfe120006ff300007ff20003efc0005efe3006ffc2003efa10009fe54443affffffd7bbbbbba 32aefea205feeffd134119ff400005ff40124cfc108fffa1007ddffb100005ff700000ef843116ff88feeffe25cffd920 4000033000005ff30000cff30005fff5001ecbf600af49f706fa09f80ef98cfc7effffffe12226fc200004fc000001330 50afffffa0bfffff90df522210ff200002ff885103fffffd23878dff900001efc00000dfb63118ff7bfefffb17dffc710 60029ded403effef61dfc31227fe10000bfa48830efdffff5ffe75dfdef9007ffcf9007ff8fe32cfb1dffffe302adea20 799999998effffffe56666dfa00003ff300009fc00001ef600006ff20000afc00000ef900002ff600005ff40000499200 8018bb8201dffffd27fd22df88fa00af93fe54ee305ffff502dfccfd3bf9009fcef6005fecfb11bfc4effffe4028bb830 9029dea302dffffe29fe32df9df8007feef9007ffbfe55efe4efffdfe038968fd00000cf933129fe27fefff604ceda400',   // Segoe UI Bold
    '002aeea302efddfe28fb01cf8cf6007fcef5005feef4004feef5004fedf6004febf8006fd8fc10bf92efddfe202aeea30 10019ff1005dffe101edbfe101518fd000009fc00000afb00000bfa00000cf900000df800000ef7006ccffec89ffffff8 228dec600dfffff80c624efe11000aff20000bfe10002efa0000afe20007ff60004ff80002efa00009ffddddb7eeeeeed 307cffb308fdcffd165007ff400004ff30002bfc00afffc2008bcffd200004ff900000dfb41003ff9bfccffe35cefea20 400026620000cff90005fef9001dd8f9007f67f901ec07fa08f406fa0ee99bfd8effffffe11116fb100005fb000001640 509fffffb0bfffffa0cf311100de100000ee664101fffffd317669ffb00000afd00000afc51003ef8dfccffc17cffc710 6004bffd306ffcbe62ef500007fa00000af757720cfffffe4cfc54cfbdf5006fdcf6006fcafb00bf94ffcdfe205dfea20 7deeeeeebcffffffe12222bfd00001ef800005ff30000afd00001ef900005ff40000afe10001efa00005ff500008ed100 805cffc604ffcdff5af900bf9af900af85ff86fe207fffe3009feffc29fc22dfbef5005ffef7006fe9ffccff808dffc60 903aefc502efdcff49fb00afacf7006fdcf7005fdafd55bfd3efffffc026756fb000009f810004ff28ebcff704cffc500',   // Calibri Bold
    '00003310004dffe502efeeff39ff43ff9cff10efdeff10efeeff10effcff11efd8ff43ff92efeeff304effe5000033000 100005510002aff401bffff302fffff10394eff10001efe00002ffd00003ffc00115ffb11dfffffffeffffffd55555554 20001100005dffc305fffffe3bfd49ff87a804ffa0000bff6001bffa002cff8005effb666affffffeaffffffe11111111 30001200004cffe703efffff68ed35ffa00347ff8005fffc1004cdff856500dffcfe44eff4ffffffa05dffe9100012100 400000000000affb0005fffb001efffa00af8efa05fc1efa0efa8ffd8ffffffffbbbbffeb0001efa00001efa000000000 5012222210efffffb1ffffff93ff866634ff8ba506ffffff74bd67ffe45400dffdfd45ffd6ffffff606dffd5000021000 60002410002cfff900cffdff86ff70cecbff36830dffefff5effdbffddff20dffaff21efe3ffeeff805effe8000033100 755555554dffffffddffffffd45557ff60000cfd00006ff70000dff20004ffd00008ffb0000bffa0000cffa0000455400 80002200007effd606ffefff5bfe12ef8bff95ef54fffffa04efffff6efb4affdffa01efdcffeeff82aeffd7000122000 90013310008effe707ffeeff4dfe13ffaefd02ffecffbdffe4effeffe02672efb7bb17ff78fffffd11bfffc2000242000',   // Franklin Gothic Heavy
    '00003310004effe402ef98fe28fc00bf8cf9008fcdf8007fedf8007fecf9008fc8fc00bf82ef98fe204effe4000033100 1000000000002ce10017efe001efefd002c47fc000008fa000009f900000bf700000cf600bddffedddeeeeeec00000000 20001100007dfeb205ffcefd1bf702ef648200df800006ff40006ff80019ff6003cfc30009ffffffe8ffffffd01111111 30013310006effe804fe88ff66b700bf900012ef5004fff800039bff5131008fdcf6007fe6fe88ef907efffa100134100 4000000000008ff70003fff7000ccbf7007f3af703e90af70be21bf81fffffffebbbbefda0000bf800000bf8000000000 5024444430bfffffa0dfeeee71ed000002fb598304ffffff53cc33dfd000007fead5009fc9fe8aff61afffe6000133000 60015640003dfffc11efa5cfa7fd004d8cf914300efbeffc2fff98efadf9008febf8008fd5fe66ef707ffff9000266300 789999998dffffffeabbbbcfe00001cf600009fc00002ff600008fe10000dfb00003ff900005ff800006ff80000499500 80013410007efff905fe87ef79fa007fa8fe71af61dffff902bfefff5cf605dfeef3005ffbfd77cfa2bffffa100243100 9005874001cffffa0afe56ef6ef6009fbff600afecfe89ffe3dffebfe014419fb36200cf7cfb49fe14efffe4002686100',   // Franklin Gothic Demi
    '002afea201dffffd17fe55ef8bf7007fcef4004feff3002ffff3002ffef4004fecf7007fc8fe55ef81dffffe202bffb30 1004fff5001dfff400011ef300001ff200001ff000003fe000004fd000005fc000006fa000008f9000009f800000af700 2029dc8102effffb09fe67ff5cf6009f9451009f800002ef30000bfa0000afd1000afe20009ff52229ffffffecddddddd 302afe9101dffffc06fd56ff335301ef30008dfa0000efe500006aff5000007fcef4004fdafd55cfa3effffe303bfea30 400008a400005ff80001eff90009fffa003fe7fb00cf84fc06fd13fd0dfc9afe8dffffffe44445ff500000ef2000008a2 502fffff705fffff807f900000af720000dfffd401fffffe318a33dfa000005fd662006fdbfd55df93effffe203aefa20 60002c5000009fb00002ef400008fb00002ef500008fffc301efeefe27fc11cf79f9008f96fe55ef71cffffd1019efa20 7cffffffbaffffffc00001df700003ff200007fc00000cf800002ff300006fd00000bf900001ef400006fe10000289000 803bfea201effffd16fe55ef56fb00cf62efaafe20bffffa07ffbbff6df6006fdff3003fecfc44cfc6ffffff506cffc50 902aeea201dffffd15fe65ef77fa008f86fd11bf71dfeeff202bfffa00004ff20000afa00003ff30000afa000004b3000',   // Century Gothic Bold
    '00014410005effe503ffa9ff3af7006f9ee1001fdfd0000eefd0000eede1001fc9f6007f93ffaaff306effe6000144100 10004d900008ffa0006fff90002abf8000009f700000af600000af600000bf500000bf400003cf61009ffffa008ffff80 2005872002cffff60cfd8aff19b100cf300004ff10006ef8001bff7000bfc30003fd100005fc777613ffffffd06888886 304bfe9205fffffd14e723cf400000af5005aefe200dfff800048dff400000af9470005faaf923cf94fffffe204bfea20 4000003000000cf700008ff80004fef8001de6f800af64f807ffabfd7cffffffe03446fa200003f9000002f8000000210 52bbbbbb74ffffffb3fc444305fb8ba407ffffff4afe749fb5a2001fe000001fe450006fbef748ff48fffff7005ab9300 600019d10001bfd1001cfd20009fc10003ff886208fffffe4cfd88dfcef2002fedf2003fdbfa33cf94fffffd205ced910 700000000cfedccc99deefffb00002ee200009f700001ee100005fa000009f500000df100003fc000002e700000000000 802aefb302effffe18fb22df59f600bf66ffacfe20dffff907ffabff7df5006fdfe1002ffef8229fd8ffffff606cffb50 903add9104effffd2bf934dfaee1002feef2001efafd77dfe2dfffffb01698ef700007fe1004aff501dffd4001cc60000',   // Comic Sans Bold
    '000000000017bb7101dffffd17ff66ff8cfd00cfcdfb00afeefb00bfecfd00dfc8ff66ff81cffffd1017bb71000000000 1007efff10bffffe00dffffd00d9fffb0022fffa0003fff80004fff70005fff60007fff40008fff3000afff2000bfff20 2000000009cddda30dfffffe33224eff90001eff60009ffd1006fff4005fff7004eff9223affffffe8ddddddd00000000 3011110008efffd80aeeffff71001cffa0345dff80affff8008cdffd300007ffc7523affebffffffa8efffe9101111000 40000000000068870003fffc001dfdfb00af9afb06fc1afa0dfb9dfecdfffffff4446ffa40004ff800003884000000000 5011111113ffffffd5ffffffc6ffa00007ffb54009fffffd37889effc00009ffe5436effcdffffff4bfffea3001110000 600000000002bbb4000cff80007ffb0002efe57308ff7dff7efe4affdffc01ffeefe57ffa7fffffd2049ba71000000000 700000000deeeeeebbffffffd1222affe0000eff90004fff4000affe0001eff90005fff4000affe1001eeea0000000000 80000000006cffc607ffffff6cfd22efaafd12ef92cffffa15efddff6efc00cfeffd22dfebffffff918cffc6000000000 9000000000169a8302dfffff59ff75ffddfd00dfecff93efc5ffb8ff70265ffe1001cff6000affb0003aaa10000000000',   // Eras Bold
    '00025510007fffe504ffcdfe2bf901cf8ef3006fcff1004feff1004fdef3006fcbf900cf84ffccfe206effe4000255100 100cfff2002efff100029ff100009fe00000bfd00000bfc00000cfb00000dfa00000ef900001ef800002ff700002ff600 2006ab8201bffffe38ff65efbdfa008fe78400afd00002ef80000cfd10009ff50006ff90003efe5431dfffffc7bbbbbb9 302aefb401dfffff47fe32cfb696008fb00015ef60009ffb00009efe500001cfd795007fe9fd32cfc2efffff503bffc50 4000035300002efa0000cffa0008fcfb004f97fc01dd17fd0af417fd1fffffffebcccdffc00004fe100003ff100001551 50afffff30bfffff30cfa11100dfd84000effff801b88dff500002efb00000bfc72001dfbbe85bff6cfffffa019efc600 600026620001dfb0000afe20006ff40001effdb507ffffff5cfb21cfcef5007fedf800bfc8ffcdff51afffe7000365100 744444444dffffffc5888aff700006ff20000bfc00001ef700006ff20000bfb00002ff600006ff200002bb00000001000 803bffb302effffe27fe43ef88fd00bf84ff54ef509ffffa01bfeefb18fd11cf9cf9008fcbfe32dfc5ffffff604bffc50 90015630007efffa16ffdcff7cfb008fcef7005fecfc22cfc5ffffff705cdffe10004ff60002efa0001cfd10002663000',   // Tw Cen Bold
    '003bffb201dfeefd16ff23ff5afd00ef9cfc00dfbcfc00cfccfc00cfccfc00dfbafd00ef96ff33ff51dfeefd103bffb20 10007fe10019ffd000bfffd000c9dfc00030dfb00001efa00001ff900002ff800003ff700004ff6003ffffff44ffffff3 205dfe9105fffffc0bfc4aff4ef604ff714205ff60000bfe20007ff80006ffa0006ff80006ff83333affffffd9ffffffd 303bffb302effffe18fc37ff513302ff600138fe2006fff50004befd200002ef97a500dfbafc36ffa3efffff403bffb40 40005eea0000cffb0006fefb001dd9fb008f59fb02ec08fc09f508fc0efaadffddfffffff3444cfd40000bfd00000aec0 509fffff90bfffff70df533311ef111001fe9fe913ffffff829b34efd000009fd58500afcdfc46ef96fffffe206cfea20 6007dfd5007ffeff42ef50afa6fd003519fb26500afceffc1aff99ff7afc00cf98fa00cf95fd12ef71cfeefe202bfea20 79ffffff89ffffff924444df500005fc00001df600005ff20000afd00001dfa00002ff900004ff800004ff800004ff800 804bffc402efccfe38fd00cf79fd10bf76ffd7fe20bffff701afffff49fb17ffbcf5009fccf800afb7ffbcff406dffb40 903bffb202efeefc18fe22ef4afa00bf7afc01df97ffcdff91cffeef801562cf712201ef49fb06fd14ffeff6006dfd600',   // Franklin Gothic Demi Cond
    '001aee9101cffffb06ff46ff4bfb00df9df900cfbdf900bfcdf900bfcdf900cfbbfc00ef96ff46ff41cffffb002afe910 1003ff300003ff300003ff300003ff300003ff300003ff300003ff300003ff300003ff300003ff300003ff300003ff300 206cfea208fffffe18b43bff630004ff700004ff400009fc00002ff50000cfa00007fd10004ff96651dfffffdbffffffd 32cffd8103fdeffb01201bff200007ff10002df90001ffc10001dffa000009ff400004ff64301aff46fdeffc03befd810 400002a700001cfb00009ffc0005fffc002edbfd01bf48fe08f707fe1dffefffcbeeeeffc00005ff300004ff400002bb3 509fffff709fffff70afc66630afa00000bfc63000bffff800679eff400004ff800003ff75734cff57fffffc03befd810 60009ff40003ffa0000cfe20006ff70001effb8207fffffe2bff99ff9dfb00bfccfa00afcafe44ef93effffe203bffa20 7cffffffcbffffff822227ff40000afe10000dfb00003ff700007ff30000bfd00001efa00004ff600008ff2000028b000 804bfeb203efccfe18fe11ef69fd01ef74ff45ff309ffff704efbbfe3cfc01dfadfa00bfccfc01efa5ffccfe305cffb30 902aefb302dffffe38fe54efacfb00bfdcfc00cfd9ff9affb2dfffff7028affe10006ff70002efc1000aff40004ff9000',   // Gill Sans Bold
    '0038ba8302aeffe926eecced59fc44ce8af912aeaae8119eaae8119faaf912afa9ec44df86eecced529efee92038aa830 100688631019cc84102add94115bffb6235aefc63348dfc63236cfb53225beb52125ad9310149b7100138a60000268400 2369a842059ceea6248befd832589dd9313569a7212457852135676311588741029dc85103bfeb8422aeecb83159aa973 30599a96106aceb51036bd710016cc510038cb7310257ab8201126cc401115de514338ee44a89dfd34bcdfd81269a9730 5036bdb71158dfc711568863015553100169a85300358996100125771000146710224798117adeea11aeffe81169cb730 6001356520159a85104bda41019ed83203cfda7526efcaba58fe86bd79fc439e99fc43ae97dd78de64adbcea314677741 75bbbbbb47effffd54abbef921224cd500005da200019e810003ce600005ee500006ed400006ee500007ee610005ba500 91589a8524adddea46ccaadc68b9559b88b9559b87bb99cd74accdfd6258befc40137bc8301369951247a952036875200',   // the game's own 0, 1, 2, 3, 5, 6, 7 and 9, averaged from 27 phone photos and screenshots
  ].join(' ');
  let TPL = null, lastField = null;
  const unit = (v) => {
    let m = 0; for (let i = 0; i < v.length; i++) m += v[i];
    m /= v.length;
    const o = new Float32Array(v.length); let s = 0;
    for (let i = 0; i < v.length; i++) { o[i] = v[i] - m; s += o[i] * o[i]; }
    if (s < 1e-6) return null;
    s = Math.sqrt(s); for (let i = 0; i < o.length; i++) o[i] /= s;
    return o;
  };
  function templates() {
    if (TPL) return TPL;
    TPL = [];
    for (const t of TEMPLATES.split(' ')) {
      if (t.length !== 1 + GW * GH) continue;
      const v = new Float32Array(GW * GH);
      for (let i = 0; i < GW * GH; i++) v[i] = parseInt(t[i + 1], 16) / 15;
      const u = unit(v); if (u) TPL.push({ d: +t[0], v: u });
    }
    return TPL;
  }
  // a digit's ink (0..1 per pixel of a w-wide image) inside [x0,x1) x [y0,y1), resampled onto the
  // GW x GH grid. Proportions are kept, so a narrow 1 stays narrow.
  // A camera at an angle leans the digits, so each digit is first stood upright by its own slant
  // (from the ink's second moments); the templates go through the same step.
  function shape(ink, w, X0, y0, X1, y1) {
    let m = 0, mx = 0, my = 0;
    for (let y = y0; y < y1; y++) for (let x = X0; x < X1; x++) { const k = ink[y * w + x]; m += k; mx += k * x; my += k * y; }
    if (!m) return new Float32Array(GW * GH);
    mx /= m; my /= m;
    let m11 = 0, m02 = 0;
    for (let y = y0; y < y1; y++) for (let x = X0; x < X1; x++) { const k = ink[y * w + x]; m11 += k * (x - mx) * (y - my); m02 += k * (y - my) * (y - my); }
    const sk = DESKEW ? Math.max(-0.4, Math.min(0.4, m11 / m02)) : 0;
    // upright x = x - sk*(y - my); the box in upright coordinates
    let x0 = Infinity, x1 = -Infinity;
    for (let y = y0; y < y1; y++) for (let x = X0; x < X1; x++) if (ink[y * w + x] > 0.5) { const u = x - sk * (y + 0.5 - my); if (u < x0) x0 = u; if (u + 1 > x1) x1 = u + 1; }
    if (!(x1 > x0)) { x0 = X0; x1 = X1; }
    const bw = x1 - x0, bh = y1 - y0, sc = Math.min(GW / bw, GH / bh);
    const offx = (GW - bw * sc) / 2, offy = (GH - bh * sc) / 2, v = new Float32Array(GW * GH), SS = 4;
    const px = (x, y) => (x < X0 || y < y0 || x >= X1 || y >= y1 ? 0 : ink[y * w + x]);
    const at = (x, y) => {
      x -= 0.5; y -= 0.5;
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      return (px(xi, yi) * (1 - fx) + px(xi + 1, yi) * fx) * (1 - fy) + (px(xi, yi + 1) * (1 - fx) + px(xi + 1, yi + 1) * fx) * fy;
    };
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      let t = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const y = y0 + (gy + (j + 0.5) / SS - offy) / sc;
        t += at(x0 + (gx + (i + 0.5) / SS - offx) / sc + sk * (y - my), y);
      }
      v[gy * GW + gx] = t / (SS * SS);
    }
    return v;
  }
  function classify(v) {
    const u = unit(v); if (!u) return null;
    const per = Array(10).fill(-1);
    for (const t of templates()) {
      let s = 0; for (let i = 0; i < u.length; i++) s += u[i] * t.v[i];
      if (s > per[t.d]) per[t.d] = s;
    }
    const order = per.map((s, d) => [s, d]).sort((a, b) => b[0] - a[0]);
    return { d: order[0][1], s: order[0][0], m: order[0][0] - order[1][0], alt: order[1][1] };
  }
  // read the number in a straightened picture of the SCORE area (luminance L, saturation S, w x h)
  function readField(L, S, w, h, debug) {
    const n = w * h, hi = Float32Array.from(L).sort()[Math.floor(0.95 * n)];
    if (hi < 0.35) return null;
    const white = new Uint8Array(n);
    for (let i = 0; i < n; i++) white[i] = L[i] > 0.78 * hi && S[i] < 0.3 ? 1 : 0;
    // the field's rows: the longest run of mostly-white rows
    let r0 = 0, r1 = -1;
    for (let j = 0, start = -1; j <= h; j++) {
      let c = 0;
      if (j < h) for (let i = 0; i < w; i++) c += white[j * w + i];
      if (j < h && c > 0.3 * w) { if (start < 0) start = j; } else if (start >= 0) { if (j - start > r1 - r0 + 1) { r0 = start; r1 = j - 1; } start = -1; }
    }
    const fh = r1 - r0 + 1;
    if (fh < 10) return null;
    // its columns: grow out from the whitest middle column while columns stay partly white
    // (columns through a digit are still partly white; the field's border isn't)
    const col = new Float32Array(w);
    for (let i = 0; i < w; i++) { let c = 0; for (let j = r0; j <= r1; j++) c += white[j * w + i]; col[i] = c / fh; }
    let mid = Math.floor(w / 4);
    for (let i = mid; i < 0.75 * w; i++) if (col[i] > col[mid]) mid = i;
    let c0 = mid, c1 = mid;
    while (c0 > 0 && col[c0 - 1] > 0.2) c0--;
    while (c1 < w - 1 && col[c1 + 1] > 0.2) c1++;
    const fw = c1 - c0 + 1;
    if (fw < 2 * fh || fw > 7 * fh) return null;
    // dark digits on the white field
    const ix0 = c0 + 2, ix1 = c1 - 1, iy0 = r0 + 1, iy1 = r1;
    const vals = [];
    for (let j = iy0; j < iy1; j++) for (let i = ix0; i < ix1; i++) vals.push(L[j * w + i]);
    vals.sort((a, b) => a - b);
    const lw = vals[Math.floor(0.6 * vals.length)], ld = vals[Math.floor(0.01 * vals.length)];
    if (!(lw - ld > 0.25)) return null;
    const ink = new Float32Array(n), dark = new Uint8Array(n);
    for (let j = iy0; j < iy1; j++) for (let i = ix0; i < ix1; i++) {
      const p = j * w + i, k = Math.min(1, Math.max(0, (lw - L[p]) / (lw - ld)));
      ink[p] = k; dark[p] = k > 0.5 ? 1 : 0;
    }
    // pieces of ink; pieces that overlap left-to-right belong to one digit
    const parts = components(dark, w, h).filter((c) => c.n >= 4).sort((a, b) => a.x0 - b.x0), glyphs = [];
    for (const c of parts) {
      const p = glyphs[glyphs.length - 1];
      if (p && c.x0 <= p.x1 - 0.3 * Math.min(p.x1 - p.x0 + 1, c.w)) {
        p.x0 = Math.min(p.x0, c.x0); p.x1 = Math.max(p.x1, c.x1); p.y0 = Math.min(p.y0, c.y0); p.y1 = Math.max(p.y1, c.y1); p.n += c.n;
      } else glyphs.push({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, n: c.n });
    }
    let digs = glyphs.filter((g) => g.y1 - g.y0 + 1 >= 0.3 * fh && g.y1 - g.y0 + 1 < 0.95 * fh && g.n >= 0.015 * fh * fh);
    if (!digs.length) return null;
    const tall = Math.max(...digs.map((g) => g.y1 - g.y0 + 1));
    digs = digs.filter((g) => g.y1 - g.y0 + 1 >= 0.75 * tall);
    // digits that touch: split a too-wide piece at its thinnest columns
    const split = [];
    for (const g of digs) {
      const gw = g.x1 - g.x0 + 1, gh = g.y1 - g.y0 + 1, k = gw > 1.1 * gh ? Math.round(gw / (0.68 * gh)) : 1;
      if (k <= 1) { split.push(g); continue; }
      let x = g.x0;
      for (let s = 1; s <= k; s++) {
        let cut = g.x1 + 1;
        if (s < k) {
          const aim = Math.round(g.x0 + s * gw / k), r = Math.max(1, Math.round(0.15 * gw / k));
          let best = Infinity;
          for (let i = aim - r; i <= aim + r; i++) {
            let t = 0; for (let j = g.y0; j <= g.y1; j++) t += ink[j * w + i];
            if (t < best) { best = t; cut = i; }
          }
        }
        split.push({ x0: x, x1: cut - 1, y0: g.y0, y1: g.y1 }); x = cut;
      }
    }
    if (split.length > 3) return null;
    const out = [];
    split.forEach((g, k) => {
      // the digit's box: its own columns (plus PAD), rows tightened to its ink above INK_T
      const lo = Math.max(ix0, g.x0 - PAD, k ? split[k - 1].x1 + 1 : 0), hi = Math.min(ix1 - 1, g.x1 + PAD, k < split.length - 1 ? split[k + 1].x0 - 1 : w);
      let x0 = hi, x1 = lo, y0 = iy1, y1 = iy0;
      for (let j = Math.max(iy0, g.y0 - PAD); j <= Math.min(iy1 - 1, g.y1 + PAD); j++) for (let i = lo; i <= hi; i++) {
        if (ink[j * w + i] > INK_T) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
      }
      const r = x1 >= x0 && y1 >= y0 ? classify(shape(ink, w, x0, y0, x1 + 1, y1 + 1)) : null;
      out.push(r ? (debug ? { ...r, box: [x0, y0, x1 + 1, y1 + 1] } : r) : null);
    });
    if (out.includes(null)) return null;
    const value = +out.map((o) => o.d).join('');
    const sure = out.every((o) => o.s >= MIN_SIM && o.m >= MIN_MARGIN) && !(out.length > 1 && out[0].d === 0);
    if (debug) return { value, sure, digits: out, field: [c0, r0, c1, r1], ink };
    return sure ? { value, conf: +Math.min(...out.map((o) => o.m)).toFixed(3) } : null;
  }
  // cut the SCORE area out of the full-size source and straighten it with the fitted layout model P
  let scoreCanvas = null;
  function readScore(src, P, scale) {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    const A = SCORE_AREA, cs = [[A[0], A[1]], [A[2], A[1]], [A[2], A[3]], [A[0], A[3]]].map(([u, v]) => P(u, v).map((t) => t / scale));
    const x0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[0]))) - 2), x1 = Math.min(sw, Math.ceil(Math.max(...cs.map((p) => p[0]))) + 2);
    const y0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[1]))) - 2), y1 = Math.min(sh, Math.ceil(Math.max(...cs.map((p) => p[1]))) + 2);
    const rw = x1 - x0, rh = y1 - y0;
    if (rw < MIN_AREA_PX) return null;                // too far away: the digits would be a few pixels tall
    const c = scoreCanvas || (scoreCanvas = document.createElement('canvas'));
    if (c.width !== rw || c.height !== rh) { c.width = rw; c.height = rh; }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, x0, y0, rw, rh, 0, 0, rw, rh);
    const d = ctx.getImageData(0, 0, rw, rh).data;
    const L = new Float32Array(OW * OH), S = new Float32Array(OW * OH), ss = Math.max(1, Math.min(3, Math.round(rw / OW)));
    const rgb = [0, 0, 0];
    const sample = (x, y) => {          // bilinear, in region pixels (centres at +0.5)
      x = Math.min(rw - 1.001, Math.max(0, x - 0.5)); y = Math.min(rh - 1.001, Math.max(0, y - 0.5));
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, p = (yi * rw + xi) * 4, q = p + rw * 4;
      for (let k = 0; k < 3; k++) rgb[k] += (d[p + k] * (1 - fx) + d[p + 4 + k] * fx) * (1 - fy) + (d[q + k] * (1 - fx) + d[q + 4 + k] * fx) * fy;
    };
    for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
      rgb[0] = rgb[1] = rgb[2] = 0;
      for (let b = 0; b < ss; b++) for (let a = 0; a < ss; a++) {
        const [x, y] = P(A[0] + (i + (a + 0.5) / ss) / OW * (A[2] - A[0]), A[1] + (j + (b + 0.5) / ss) / OH * (A[3] - A[1]));
        sample(x / scale - x0, y / scale - y0);
      }
      const r = rgb[0] / (ss * ss * 255), g = rgb[1] / (ss * ss * 255), bl = rgb[2] / (ss * ss * 255);
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), o = j * OW + i;
      L[o] = 0.299 * r + 0.587 * g + 0.114 * bl; S[o] = mx > 0 ? (mx - mn) / mx : 0;
    }
    lastField = { L, S, w: OW, h: OH };
    return readField(L, S, OW, OH);
  }


  // ---- the rest of the game screen, located from the jar row ----------------------------------
  // Layout in units of the jar spacing g, from the first jar's face centre (u to the right, v down).
  // Measured on straight-on photos; a small perspective model (vertical stretch sy, keystone a,
  // slant k) is fitted per frame by lining up the scorecard's coloured rows.
  const GRID_U0 = -0.36, COL_W = 1.545, GRID_V0 = 1.36, ROW_H = 0.325;
  const SCORE_BOX = [0.42, 0.95, 1.14, 1.16], ROLL_BTN = [2.7, 0.98, 4.0, 1.15];
  const CELL_COL = ['red', 'yellow', 'green', 'purple', 'blue', 'blue', 'blue', 'blue', 'blue'];   // box order: col*3 + row
  const HUE = {
    red: (h) => h < 22 || h > 345, yellow: (h) => h > 38 && h < 62, green: (h) => h > 70 && h < 130,
    purple: (h) => h > 245 && h < 300, blue: (h) => h > 185 && h < 215,
  };
  const cellBox = (b, part) => {
    const u0 = GRID_U0 + Math.floor(b / 3) * COL_W, v0 = GRID_V0 + (b % 3) * ROW_H;
    if (part === 'bar') return [u0 + 0.35 * COL_W, v0 + 0.62 * ROW_H, u0 + 0.9 * COL_W, v0 + 0.88 * ROW_H];
    if (part === 'num') return [u0 + 0.47 * COL_W, v0 + 0.55 * ROW_H, u0 + 0.75 * COL_W, v0 + 0.9 * ROW_H];
    if (part === 'sideL') return [u0 + 0.3 * COL_W, v0 + 0.55 * ROW_H, u0 + 0.42 * COL_W, v0 + 0.9 * ROW_H];
    if (part === 'sideR') return [u0 + 0.8 * COL_W, v0 + 0.55 * ROW_H, u0 + 0.95 * COL_W, v0 + 0.9 * ROW_H];
    return [u0, v0, u0 + COL_W, v0 + ROW_H];
  };

  // ---- the roll counter ------------------------------------------------------------------------
  // A tilted green sign right of ROLL shows yellow "x3", "x2" or "x1": the rolls left this round.
  // It is blank once the last roll is used. x3 with berries in the jars means a box was just scored.
  const SIGN_AREA = [4.25, 0.55, 5.6, 1.85], SIGN_PX = 60;   // where to look (jar spacings), samples per spacing
  // the counter's 1, 2 and 3, averaged from 16 photos (checked leaving each photo out: no wrong reads)
  let COUNTER_TPL = '101369d5006efff5004ffff3001aefe30001cfd10000bfc10001dfa00002efa00002ef800003ef900005ff8000049c700 206cca6004efffe504ccbefd204209fe40001afe40019efb203bed9301bfc40005ef821003efedca21cfffff30359bcd3 305da742006ffffd2014aff70002bf91000bff800003aef8000008fe300002ff73b626ff98ffefff73cffffc2027cea30', CTPL = null;
  function counterTemplates() {
    if (CTPL) return CTPL;
    CTPL = [];
    for (const t of COUNTER_TPL.split(' ')) {
      if (t.length !== 1 + GW * GH) continue;
      const v = new Float32Array(GW * GH);
      for (let i = 0; i < GW * GH; i++) v[i] = parseInt(t[i + 1], 16) / 15;
      const u = unit(v); if (u) CTPL.push({ d: +t[0], v: u });
    }
    return CTPL;
  }
  let lastCounter = null;
  function readCounter(H, S, V, w, h, P) {
    const A = SIGN_AREA, gw = Math.round((A[2] - A[0]) * SIGN_PX), gh = Math.round((A[3] - A[1]) * SIGN_PX), n = gw * gh;
    const yel = new Uint8Array(n), grn = new Uint8Array(n), seen = new Uint8Array(n);
    let inside = 0, ng = 0;
    lastCounter = null;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const [x, y] = P(A[0] + (i + 0.5) / SIGN_PX, A[1] + (j + 0.5) / SIGN_PX), xi = Math.round(x), yi = Math.round(y), o = j * gw + i;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
      seen[o] = 1; inside++;
      const p = yi * w + xi, hh = H[p], ss = S[p], vv = V[p];
      if (hh > 42 && hh < 70 && ss > 0.45 && vv > 0.6) yel[o] = 1;
      else if (hh >= 70 && hh < 135 && ss > 0.4 && vv > 0.35) { grn[o] = 1; ng++; }
    }
    if (inside < 0.3 * n || ng < 0.12 * SIGN_PX * SIGN_PX) return null;   // the sign isn't in view
    // the digit: a yellow piece about half a jar spacing tall, with the green sign all round it
    const ringGreen = (c) => {
      let g = 0, t = 0; const m = Math.round(0.08 * SIGN_PX);
      for (let j = c.y0 - m; j <= c.y1 + m; j++) for (let i = c.x0 - m; i <= c.x1 + m; i++) {
        if (i < 0 || j < 0 || i >= gw || j >= gh) { t++; continue; }
        if (j >= c.y0 && j <= c.y1 && i >= c.x0 && i <= c.x1) continue;
        t++; if (grn[j * gw + i] || yel[j * gw + i]) g++;
      }
      return t ? g / t : 0;
    };
    const parts = components(yel, gw, gh).filter((c) => c.n >= 8);
    const onSign = parts.filter((c) => ringGreen(c) > 0.45);
    const digs = onSign.filter((c) => c.h >= 0.3 * SIGN_PX && c.h <= 0.7 * SIGN_PX && c.w <= 0.55 * SIGN_PX && c.fill < 0.75);
    lastCounter = { yel, grn, seen, gw, gh, parts, digs };
    // a blank sign (no rolls left): a big green sign with nothing yellow on it
    if (!digs.length) return !onSign.length && ng >= 0.3 * SIGN_PX * SIGN_PX ? { left: 0 } : null;
    const d = digs.reduce((a, c) => (c.h * c.n > a.h * a.n ? c : a));
    if (d.x1 >= gw - 1 || d.y1 >= gh - 1 || d.x0 <= 0 || d.y0 <= 0) return null;   // cut off by the region edge
    for (let j = d.y0; j <= d.y1; j++) for (let i = d.x0; i <= d.x1; i++) if (!seen[j * gw + i]) return null;   // cut off by the frame edge
    const ink = new Float32Array(n);
    for (let j = d.y0; j <= d.y1; j++) for (let i = d.x0; i <= d.x1; i++) ink[j * gw + i] = yel[j * gw + i];
    const u = unit(shape(ink, gw, d.x0, d.y0, d.x1 + 1, d.y1 + 1));
    lastCounter.shape = u ? shape(ink, gw, d.x0, d.y0, d.x1 + 1, d.y1 + 1) : null;
    if (!u) return null;
    const per = [-1, -1, -1, -1];
    for (const t of counterTemplates()) { let s = 0; for (let i = 0; i < u.length; i++) s += u[i] * t.v[i]; if (s > per[t.d]) per[t.d] = s; }
    const order = [1, 2, 3].map((k) => [per[k], k]).sort((a, b) => b[0] - a[0]);
    lastCounter.sims = order;
    if (order[0][0] < 0.6 || order[0][0] - order[1][0] < 0.1) return null;
    return { left: order[0][1] };
  }

  function board(grp, H, S, V, w, h) {
    const xs = grp.map((d) => d.cx), ys = grp.map((d) => d.cy);
    const g = Math.hypot(xs[4] - xs[0], ys[4] - ys[0]) / 4, ang = Math.atan2(ys[4] - ys[0], xs[4] - xs[0]);
    const c = Math.cos(ang), sn = Math.sin(ang), ox = xs[0], oy = ys[0];
    const model = (sy, a, k) => (u, v) => {
      const x = u * (1 + a * v) + k * v, y = v * sy;
      return [ox + g * (x * c - y * sn), oy + g * (x * sn + y * c)];
    };
    // fraction of sample points in a layout box that pass a pixel test
    const frac = (P, box, nx, ny, test) => {
      let hit = 0, n = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const [x, y] = P(box[0] + (i + 0.5) / nx * (box[2] - box[0]), box[1] + (j + 0.5) / ny * (box[3] - box[1]));
        n++;
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
        const p = yi * w + xi;
        if (test(H[p], S[p], V[p])) hit++;
      }
      return hit / n;
    };
    const score = (P) => {
      let t = 0;
      for (let b = 0; b < 9; b++) { const hue = HUE[CELL_COL[b]]; t += frac(P, cellBox(b, 'bar'), 6, 3, (hh, ss, vv) => ss > 0.35 && vv > 0.35 && hue(hh)); }
      t += frac(P, SCORE_BOX, 6, 2, (hh, ss, vv) => ss < 0.2 && vv > 0.7);
      return t / 10;
    };
    let best = { s: -1 };
    const tryP = (sy, a, k) => { const sc = score(model(sy, a, k)); if (sc > best.s) best = { s: sc, sy, a, k }; };
    for (let sy = 0.6; sy <= 1.401; sy += 0.1) for (let a = -0.2; a <= 0.201; a += 0.1) for (let k = -0.5; k <= 0.501; k += 0.125) tryP(sy, a, k);
    for (let pass = 0; pass < 2; pass++) {
      const b0 = best, st = pass ? 0.5 : 1;
      for (const dsy of [-0.05, 0, 0.05]) for (const da of [-0.05, 0, 0.05]) for (const dk of [-0.06, 0, 0.06]) tryP(b0.sy + dsy * st, b0.a + da * st, b0.k + dk * st);
    }
    if (best.s < 0.7) return null;                         // scorecard not in view (or not lined up)
    const P = model(best.sy, best.a, best.k);
    const quad = (box) => [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([u, v]) => { const [x, y] = P(u, v); return [x / w, y / h]; });
    const white = (hh, ss, vv) => ss < 0.3 && vv > 0.7;
    // a scored box shows a white number under its label. Glare makes the whole bar white, so compare with the sides.
    // how much of a layout box is inside the camera picture: a box cut off by the edge would read as blank
    const inFrame = (box) => frac(P, box, 8, 4, () => true);
    const cells = [], raw = [];
    for (let b = 0; b < 9; b++) {
      if (inFrame(cellBox(b, 'num')) < 0.95) { cells.push(null); raw.push(null); continue; }   // can't tell
      const num = frac(P, cellBox(b, 'num'), 30, 14, white);
      const side = Math.max(frac(P, cellBox(b, 'sideL'), 12, 10, white), frac(P, cellBox(b, 'sideR'), 12, 10, white));
      // empty boxes read as no white at all; small or blurry digits (phone upright, far away) can be as faint as 1%,
      // so only "no white" counts as blank, and faint white is "can't tell" rather than either
      cells.push(num < 0.004 ? false : side > 0.2 ? null : num >= 0.025 && num >= 1.3 * side ? true : null);
      raw.push([+num.toFixed(3), +side.toFixed(3)]);
    }
    const green = frac(P, ROLL_BTN, 10, 3, (hh, ss, vv) => hh > 65 && hh < 115 && ss > 0.45 && vv > 0.45);
    let counter = null;
    try { counter = readCounter(H, S, V, w, h, P); } catch (e) { counter = null; }
    return {
      P, fit: +best.s.toFixed(2), raw, prm: [best.sy, best.a, best.k].map((x) => +x.toFixed(2)),
      cells,                                            // true = shows a number, false = blank, null = can't tell (glare)
      rollActive: inFrame(ROLL_BTN) < 0.95 ? null : green > 0.4 ? true : green < 0.1 ? false : null,   // greyed out = no rolls left
      counter,                                          // { left: 3|2|1|0 } rolls left this round, or null if not in view
      quads: { roll: quad(ROLL_BTN), score: quad(SCORE_BOX), cells: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((b) => quad(cellBox(b, 'cell'))) },
    };
  }

  function analyse({ data, w, h, src, scale }) {
    const n = w * h, { H, S, V } = toHsv(data, n);
    const isCyan = (i, vmin) => H[i] > 172 && H[i] < 208 && S[i] > 0.12 && V[i] > vmin;
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = isCyan(i, 0.62) && S[i] < 0.55 ? 1 : 0;
    const blobs = components(mask, w, h);
    let cand = blobs.filter((c) => c.n > 60 && c.w / c.h > 0.6 && c.w / c.h < 1.6 && c.fill > 0.38 && c.fill < 0.68);
    cand = cand.sort((a, b) => b.n - a.n).slice(0, 14);
    let best = null;
    for (let grp of combos(cand, 5)) {
      grp = grp.sort((a, b) => a.cx - b.cx);
      const ns = grp.map((d) => d.n), gaps = grp.slice(1).map((d, i) => d.cx - grp[i].cx);
      if (Math.max(...ns) / Math.min(...ns) > 3.0) continue;   // perspective: near jars look bigger
      const cys = grp.map((d) => d.cy);
      if (Math.max(...cys) - Math.min(...cys) > 0.5 * mean(grp.map((d) => d.h))) continue;
      const ratio = mean(gaps) / mean(grp.map((d) => d.w));
      if (ratio < 1.05 || ratio > 2.3) continue;
      const score = std(gaps) / mean(gaps) + 0.5 * std(ns) / mean(ns);
      if (!best || score < best.score) best = { score, grp };
    }
    if (!best) {
      // dice cut off by an edge of the frame: say which edge, so the player can aim the camera
      const edge = { top: 0, bottom: 0, left: 0, right: 0 };
      for (const c of blobs) {
        if (c.n < 150) continue;
        if (c.y0 === 0) edge.top++; if (c.y1 === h - 1) edge.bottom++; if (c.x0 === 0) edge.left++; if (c.x1 === w - 1) edge.right++;
      }
      const cut = Object.keys(edge).find((k) => edge[k] >= 3) || null;
      return { status: 'nojars', cut };
    }

    const jars = [], locked = [], detail = [];
    // where each jar is, as fractions of the frame (for drawing on top of a live camera view)
    const boxes = best.grp.map((d) => ({ x: d.x0 / w, y: d.y0 / h, w: d.w / w, h: d.h / h }));
    for (const d of best.grp) {
      // berry colour inside the face (inset 15%)
      const cnt = { J: 0, S: 0, P: 0, M: 0 }; let tot = 0;
      for (let y = Math.floor(d.y0 + 0.15 * d.h); y < d.y1 - 0.15 * d.h; y++) {
        for (let x = Math.floor(d.x0 + 0.15 * d.w); x < d.x1 - 0.15 * d.w; x++) {
          const i = y * w + x, hh = H[i], ss = S[i], vv = V[i]; tot++;
          if ((hh < 18 || hh > 340) && ss > 0.45 && vv > 0.3) cnt.J++;
          else if (hh >= 25 && hh < 62 && ss > 0.45 && vv > 0.5) cnt.S++;
          else if (hh >= 62 && hh < 150 && ss > 0.3 && vv > 0.3) cnt.P++;
          else if (hh >= 245 && hh < 320 && ss > 0.18 && vv > 0.3) cnt.M++;
        }
      }
      const k = Object.keys(cnt).reduce((a, b) => (cnt[b] > cnt[a] ? b : a));
      const frac = cnt[k] / Math.max(tot, 1);
      // a Fly: grey/black pixels that aren't background, in the middle 40% of the face
      let dark = 0, ct = 0;
      for (let y = Math.floor(d.y0 + 0.3 * d.h); y < d.y1 - 0.3 * d.h; y++) {
        for (let x = Math.floor(d.x0 + 0.3 * d.w); x < d.x1 - 0.3 * d.w; x++) {
          const i = y * w + x; ct++;
          if (!(isCyan(i, 0.55)) && S[i] < 0.5) dark++;
        }
      }
      dark /= Math.max(ct, 1);
      jars.push(frac > 0.025 ? k : dark > 0.06 ? 'F' : null);
      // red lid in a band just above the face
      let red = 0, lt = 0;
      for (let y = Math.max(0, Math.floor(d.cy - 1.25 * d.h)); y < Math.max(0, d.cy - 0.62 * d.h); y++) {
        for (let x = d.x0; x <= d.x1; x++) {
          const i = y * w + x; lt++;
          if ((H[i] < 15 || H[i] > 345) && S[i] > 0.5 && V[i] > 0.35) red++;
        }
      }
      locked.push(lt > 0 && red / lt > 0.12);
      detail.push({ frac: +frac.toFixed(3), dark: +dark.toFixed(3), fill: +d.fill.toFixed(2) });
    }
    let brd = null;
    try { brd = board(best.grp, H, S, V, w, h); } catch (e) { brd = null; }
    const view = framing(best.grp, brd && brd.P, w, h, scale);
    if (brd) {
      try { brd.score = src ? readScore(src, brd.P, scale) : null; } catch (e) { brd.score = null; }
      lastP = { P: brd.P, scale, w, h };
      delete brd.P;
    }
    if (jars.every((j) => j === null)) return { status: 'empty', jars, locked, boxes, board: brd, view, detail };
    return { status: jars.includes(null) ? 'partial' : 'ok', jars, locked, boxes, board: brd, view, detail };
  }

  // How big the game looks and which edges of the frame cut it off, for "move closer / move back"
  // hints. The whole game runs from the jars' lids to the scorecard's bottom edge, and from the
  // scorecard's left edge to the roll counter (in jar spacings from the first jar).
  const GAME_AREA = [-0.55, -0.95, 5.15, 2.4];
  let lastP = null;
  function framing(grp, P, w, h, scale) {
    const xs = grp.map((d) => d.cx), ys = grp.map((d) => d.cy);
    const g = Math.hypot(xs[4] - xs[0], ys[4] - ys[0]) / 4, ang = Math.atan2(ys[4] - ys[0], xs[4] - xs[0]);
    const c = Math.cos(ang), sn = Math.sin(ang);
    const at = P || ((u, v) => [xs[0] + g * (u * c - v * sn), ys[0] + g * (u * sn + v * c)]);   // no scorecard yet: assume straight on
    const A = GAME_AREA, out = { top: false, bottom: false, left: false, right: false }, m = 0.01;
    for (const t of [0, 0.5, 1]) {
      for (const [u, v] of [[A[0] + t * (A[2] - A[0]), A[1]], [A[0] + t * (A[2] - A[0]), A[3]], [A[0], A[1] + t * (A[3] - A[1])], [A[2], A[1] + t * (A[3] - A[1])]]) {
        const [x, y] = at(u, v);
        if (y < -m * h) out.top = true; if (y > (1 + m) * h) out.bottom = true;
        if (x < -m * w) out.left = true; if (x > (1 + m) * w) out.right = true;
      }
    }
    return { size: +(g / scale).toFixed(1), out };    // size: jar spacing in camera pixels
  }

  // onload rather than img.decode(): works in every browser, including older phone browsers
  const loaded = (img) => new Promise((res, rej) => {
    if (img.complete && img.naturalWidth) return res(img);
    img.onload = () => res(img); img.onerror = () => rej(new Error('could not open the image'));
  });
  async function toImage(src) {
    if (src instanceof HTMLImageElement) return loaded(src);
    const url = URL.createObjectURL(src), img = new Image();
    const p = loaded(img);
    img.src = url;
    try { return await p; } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }

  root.JBFCamera = {
    read: async (src) => analyse(readPixels(await toImage(src))),
    // one frame of a live <video>, synchronously (about 30 ms)
    readFrame: (video) => analyse(readPixels(video)),
    // internals of the SCORE reader, for the tests and the template maker
    _ocr: { readField, shape, classify, GW, GH, OW, OH, last: () => lastField, lastP: () => lastP,
      setTemplates: (t) => { TEMPLATES = t; TPL = null; }, setSure: (s, m) => { MIN_SIM = s; MIN_MARGIN = m; }, setBox: (p, t, ds) => { PAD = p; INK_T = t; DESKEW = ds !== 0; } },
    _counter: { last: () => lastCounter, setTemplates: (t) => { COUNTER_TPL = t; CTPL = null; } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
