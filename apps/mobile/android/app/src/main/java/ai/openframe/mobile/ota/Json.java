package ai.openframe.mobile.ota;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// JSON as RFC 8259 writes it and nothing else: valid UTF-8 with no byte order mark, no comment, no
// trailing comma, no single quote, and only whitespace after the value. Not org.json, which takes all
// of those.
//
// Values keep JSON's own types, so true is never the number 1, and a missing member (Map.get returning
// null) is never JSON's null, which is NULL.
public final class Json {

    public static final Object NULL = new Object() {
        @Override
        public String toString() {
            return "null";
        }
    };

    // The parser descends once per level, so the bound is what keeps a manifest of ten thousand brackets
    // from overflowing the stack. Nothing this format reads nests past two.
    static final int MAX_DEPTH = 32;

    public static final class Num {
        public final String text;

        Num(String text) {
            this.text = text;
        }

        // Digits only, at most eighteen of them, so it fits a long. -1 for anything else, including the
        // spellings 1.0 and 1e0, which the release never writes.
        public long positiveInteger() {
            if (text.isEmpty() || text.length() > 18 || text.charAt(0) < '1' || text.charAt(0) > '9') {
                return -1;
            }
            long value = 0;
            for (int i = 0; i < text.length(); i++) {
                char digit = text.charAt(i);
                if (digit < '0' || digit > '9') {
                    return -1;
                }
                value = value * 10 + (digit - '0');
            }
            return value;
        }

        @Override
        public String toString() {
            return text;
        }
    }

    public static final class Malformed extends Exception {
        Malformed(String message) {
            super(message);
        }
    }

    private final CharSequence text;
    private int at;

    private Json(CharSequence text) {
        this.text = text;
    }

    public static Object parse(byte[] utf8) throws Malformed {
        Json json;
        try {
            json = new Json(
                StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(utf8))
            );
        } catch (CharacterCodingException e) {
            throw new Malformed("not UTF-8");
        }
        Object value = json.value(0);
        json.skipWhitespace();
        if (json.at != json.text.length()) {
            throw new Malformed("text after the value at " + json.at);
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(byte[] utf8) throws Malformed {
        Object value = parse(utf8);
        if (!(value instanceof Map)) {
            throw new Malformed("not a JSON object");
        }
        return (Map<String, Object>) value;
    }

    private int peek() {
        return at < text.length() ? text.charAt(at) : -1;
    }

    private void skipWhitespace() {
        while (at < text.length()) {
            char c = text.charAt(at);
            if (c != ' ' && c != '\t' && c != '\n' && c != '\r') {
                return;
            }
            at++;
        }
    }

    private Object value(int depth) throws Malformed {
        skipWhitespace();
        switch (peek()) {
            case '{':
                return object(depth);
            case '[':
                return array(depth);
            case '"':
                return string();
            case 't':
                literal("true");
                return Boolean.TRUE;
            case 'f':
                literal("false");
                return Boolean.FALSE;
            case 'n':
                literal("null");
                return NULL;
            default:
                return number();
        }
    }

    private Map<String, Object> object(int depth) throws Malformed {
        if (depth >= MAX_DEPTH) {
            throw new Malformed("nested past " + MAX_DEPTH + " levels");
        }
        at++;
        // A name written twice keeps its last value, as JSON.parse does.
        Map<String, Object> members = new LinkedHashMap<>();
        skipWhitespace();
        if (peek() == '}') {
            at++;
            return members;
        }
        for (;;) {
            skipWhitespace();
            if (peek() != '"') {
                throw new Malformed("no member name at " + at);
            }
            String name = string();
            skipWhitespace();
            if (peek() != ':') {
                throw new Malformed("no ':' at " + at);
            }
            at++;
            members.put(name, value(depth + 1));
            skipWhitespace();
            int next = peek();
            at++;
            if (next == '}') {
                return members;
            }
            if (next != ',') {
                throw new Malformed("no ',' or '}' at " + (at - 1));
            }
        }
    }

    private List<Object> array(int depth) throws Malformed {
        if (depth >= MAX_DEPTH) {
            throw new Malformed("nested past " + MAX_DEPTH + " levels");
        }
        at++;
        List<Object> items = new ArrayList<>();
        skipWhitespace();
        if (peek() == ']') {
            at++;
            return items;
        }
        for (;;) {
            items.add(value(depth + 1));
            skipWhitespace();
            int next = peek();
            at++;
            if (next == ']') {
                return items;
            }
            if (next != ',') {
                throw new Malformed("no ',' or ']' at " + (at - 1));
            }
        }
    }

    private void literal(String word) throws Malformed {
        for (int i = 0; i < word.length(); i++) {
            if (peek() != word.charAt(i)) {
                throw new Malformed("unknown literal at " + at);
            }
            at++;
        }
    }

    private Num number() throws Malformed {
        int start = at;
        if (peek() == '-') {
            at++;
        }
        if (peek() == '0') {
            at++;
        } else if (!digits()) {
            throw new Malformed("no value at " + start);
        }
        if (peek() == '.') {
            at++;
            if (!digits()) {
                throw new Malformed("no digit after '.' at " + at);
            }
        }
        if (peek() == 'e' || peek() == 'E') {
            at++;
            if (peek() == '+' || peek() == '-') {
                at++;
            }
            if (!digits()) {
                throw new Malformed("no digit in the exponent at " + at);
            }
        }
        return new Num(text.subSequence(start, at).toString());
    }

    // Character.isDigit would take any Unicode digit.
    private boolean digits() {
        int start = at;
        while (peek() >= '0' && peek() <= '9') {
            at++;
        }
        return at > start;
    }

    private String string() throws Malformed {
        at++;
        StringBuilder out = new StringBuilder();
        for (;;) {
            int c = peek();
            at++;
            if (c == '"') {
                return out.toString();
            }
            if (c < 0x20) {
                throw new Malformed(c == -1 ? "unterminated string" : "control character in a string at " + (at - 1));
            }
            if (c != '\\') {
                out.append((char) c);
                continue;
            }
            int escape = peek();
            at++;
            switch (escape) {
                case '"':
                case '\\':
                case '/':
                    out.append((char) escape);
                    break;
                case 'b':
                    out.append('\b');
                    break;
                case 'f':
                    out.append('\f');
                    break;
                case 'n':
                    out.append('\n');
                    break;
                case 'r':
                    out.append('\r');
                    break;
                case 't':
                    out.append('\t');
                    break;
                case 'u':
                    escapedUnit(out);
                    break;
                default:
                    throw new Malformed("unknown escape at " + (at - 1));
            }
        }
    }

    // Half a surrogate pair is refused, so every string this parser returns encodes back to the UTF-8 it
    // stands for and the byte comparisons made on it stay exact.
    private void escapedUnit(StringBuilder out) throws Malformed {
        char unit = hex4();
        if (Character.isLowSurrogate(unit)) {
            throw new Malformed("lone surrogate escape at " + at);
        }
        out.append(unit);
        if (!Character.isHighSurrogate(unit)) {
            return;
        }
        if (peek() != '\\') {
            throw new Malformed("lone surrogate escape at " + at);
        }
        at++;
        if (peek() != 'u') {
            throw new Malformed("lone surrogate escape at " + at);
        }
        at++;
        char low = hex4();
        if (!Character.isLowSurrogate(low)) {
            throw new Malformed("lone surrogate escape at " + at);
        }
        out.append(low);
    }

    private char hex4() throws Malformed {
        int value = 0;
        for (int i = 0; i < 4; i++) {
            int c = peek();
            at++;
            int digit;
            if (c >= '0' && c <= '9') {
                digit = c - '0';
            } else if (c >= 'a' && c <= 'f') {
                digit = c - 'a' + 10;
            } else if (c >= 'A' && c <= 'F') {
                digit = c - 'A' + 10;
            } else {
                throw new Malformed("bad \\u escape at " + (at - 1));
            }
            value = value << 4 | digit;
        }
        return (char) value;
    }
}
