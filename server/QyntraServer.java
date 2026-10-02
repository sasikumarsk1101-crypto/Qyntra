import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;

public final class QyntraServer {
    private static final Path ROOT = Path.of("").toAbsolutePath().normalize();
    private static final int MAX_REQUEST_BYTES = 12_000_000;
    private static final int MAX_LOGIN_BYTES = 16_384;
    private static final long DEVELOPER_SESSION_MILLIS = Duration.ofHours(8).toMillis();
    private static final String DEVELOPER_USERNAME = System.getenv().getOrDefault("QYNTRA_DEVELOPER_USERNAME", "");
    private static final String DEVELOPER_PASSWORD = System.getenv().getOrDefault("QYNTRA_DEVELOPER_PASSWORD", "");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Map<String, DeveloperSession> DEVELOPER_SESSIONS = new ConcurrentHashMap<>();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private QyntraServer() {}

    public static void main(String[] args) throws IOException, InterruptedException {
        int port = Integer.parseInt(System.getenv().getOrDefault("QYNTRA_PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress("localhost", port), 0);
        server.createContext("/api/developer-login", QyntraServer::developerLogin);
        server.createContext("/api/developer-session", QyntraServer::developerSession);
        server.createContext("/api/developer-logout", QyntraServer::developerLogout);
        server.createContext("/api/generate-test-cases", QyntraServer::generateTestCases);
        server.createContext("/", QyntraServer::serveFile);
        server.start();
        System.out.println("Qyntra is running at http://localhost:" + port);
        System.out.println("Developer portal: http://localhost:" + port + "/developer.html");
        System.out.println("Press Ctrl+C to stop the local server.");
        new CountDownLatch(1).await();
    }

    private static void developerLogin(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestMethod().equals("POST")) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed."));
            return;
        }
        if (DEVELOPER_USERNAME.isBlank() || DEVELOPER_PASSWORD.isBlank()) {
            sendJson(exchange, 503, Map.of("error", "Developer login is not configured. Restart Qyntra and set developer credentials."));
            return;
        }

        byte[] requestBytes = exchange.getRequestBody().readNBytes(MAX_LOGIN_BYTES + 1);
        if (requestBytes.length > MAX_LOGIN_BYTES) {
            sendJson(exchange, 413, Map.of("error", "The login request is too large."));
            return;
        }
        try {
            Map<String, Object> input = object(Json.parse(new String(requestBytes, StandardCharsets.UTF_8)));
            String username = string(input.get("username"));
            String password = string(input.get("password"));
            if (!constantTimeEquals(username, DEVELOPER_USERNAME) || !constantTimeEquals(password, DEVELOPER_PASSWORD)) {
                sendJson(exchange, 401, Map.of("error", "Incorrect developer username or password."));
                return;
            }

            byte[] tokenBytes = new byte[32];
            RANDOM.nextBytes(tokenBytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
            long now = System.currentTimeMillis();
            long expiresAt = now + DEVELOPER_SESSION_MILLIS;
            DEVELOPER_SESSIONS.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= now);
            DEVELOPER_SESSIONS.put(token, new DeveloperSession(username, expiresAt));
            exchange.getResponseHeaders().add("Set-Cookie", "QyntraDeveloperSession=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800");
            sendJson(exchange, 200, Map.of("authenticated", true, "username", username));
        } catch (IllegalArgumentException exception) {
            sendJson(exchange, 400, Map.of("error", "Enter a valid username and password."));
        }
    }

    private static void developerSession(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestMethod().equals("GET")) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed."));
            return;
        }
        DeveloperSession session = getDeveloperSession(exchange);
        if (session == null) {
            sendJson(exchange, 200, Map.of("authenticated", false));
            return;
        }
        sendJson(exchange, 200, Map.of("authenticated", true, "username", session.username()));
    }

    private static void developerLogout(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestMethod().equals("POST")) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed."));
            return;
        }
        String token = developerSessionToken(exchange);
        if (token != null) DEVELOPER_SESSIONS.remove(token);
        exchange.getResponseHeaders().add("Set-Cookie", "QyntraDeveloperSession=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        sendJson(exchange, 200, Map.of("authenticated", false));
    }

    private static DeveloperSession getDeveloperSession(HttpExchange exchange) {
        String token = developerSessionToken(exchange);
        if (token == null) return null;
        DeveloperSession session = DEVELOPER_SESSIONS.get(token);
        if (session == null) return null;
        if (session.expiresAt() <= System.currentTimeMillis()) {
            DEVELOPER_SESSIONS.remove(token, session);
            return null;
        }
        return session;
    }

    private static String developerSessionToken(HttpExchange exchange) {
        List<String> cookies = exchange.getRequestHeaders().get("Cookie");
        if (cookies == null) return null;
        for (String cookieHeader : cookies) {
            for (String cookie : cookieHeader.split(";")) {
                String[] pair = cookie.trim().split("=", 2);
                if (pair.length == 2 && pair[0].equals("QyntraDeveloperSession")) return pair[1];
            }
        }
        return null;
    }

    private static boolean constantTimeEquals(String input, String expected) {
        return MessageDigest.isEqual(input.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8));
    }

    private record DeveloperSession(String username, long expiresAt) {}

    private static void serveFile(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestMethod().equals("GET")) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed."));
            return;
        }

        String requested = URI.create(exchange.getRequestURI().toString()).getPath();
        if (requested.equals("/")) requested = "/index.html";
        Path file = ROOT.resolve(requested.substring(1)).normalize();
        if (!file.startsWith(ROOT) || !Files.isRegularFile(file)) {
            sendJson(exchange, 404, Map.of("error", "File not found."));
            return;
        }

        String contentType = switch (extension(file)) {
            case ".html" -> "text/html; charset=utf-8";
            case ".css" -> "text/css; charset=utf-8";
            case ".js" -> "text/javascript; charset=utf-8";
            default -> "application/octet-stream";
        };
        byte[] body = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.sendResponseHeaders(200, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private static void generateTestCases(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestMethod().equals("POST")) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed."));
            return;
        }

        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            sendJson(exchange, 503, Map.of("error", "Set OPENAI_API_KEY in the server environment to enable AI generation."));
            return;
        }

        byte[] requestBytes = exchange.getRequestBody().readNBytes(MAX_REQUEST_BYTES + 1);
        if (requestBytes.length > MAX_REQUEST_BYTES) {
            sendJson(exchange, 413, Map.of("error", "The request is too large. Use smaller screenshots."));
            return;
        }

        try {
            Map<String, Object> input = object(Json.parse(new String(requestBytes, StandardCharsets.UTF_8)));
            String prompt = string(input.get("prompt")).trim();
            List<Object> images = array(input.get("images"));
            if (prompt.isBlank() || prompt.length() > 8_000) {
                sendJson(exchange, 400, Map.of("error", "Enter a screen description under 8,000 characters."));
                return;
            }
            if (images.isEmpty() || images.size() > 5) {
                sendJson(exchange, 400, Map.of("error", "Upload between one and five screenshots."));
                return;
            }

            List<Object> content = new ArrayList<>();
            content.add(Map.of(
                    "type", "text",
                    "text", "Analyze the product screenshot and description. Generate 3 to 6 QA test cases in the Qyntra project template. Include a concise featureName, preconditions, numbered actionable steps, relevant test data and expected results. Set actualResult to exactly 'Not run' and testResult to exactly 'Not Run' because the test has not been executed. Leave bugDescription, testerComments, developerComments, fixStatusIT1, testResultIT2, fixStatusIT2 and testResultIT3 as empty strings; never invent execution results or developer feedback. Cover a main success flow and relevant invalid or boundary cases. Do not invent behaviors unsupported by the evidence. User description: " + prompt
            ));
            for (Object value : images) {
                String dataUrl = string(value);
                if (!dataUrl.matches("^data:image/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$")) {
                    sendJson(exchange, 400, Map.of("error", "A screenshot is not a supported PNG, JPG, or WEBP image."));
                    return;
                }
                content.add(Map.of("type", "image_url", "image_url", Map.of("url", dataUrl, "detail", "high")));
            }

            Map<String, Object> schema = testCaseSchema();
            Map<String, Object> apiRequest = Map.of(
                    "model", "gpt-4o-mini",
                    "temperature", 0.2,
                    "messages", List.of(
                            Map.of("role", "system", "content", "You are a careful QA test engineer. Return concise test cases in the requested template. Only infer behavior supported by the screenshot or user description."),
                            Map.of("role", "user", "content", content)
                    ),
                    "response_format", Map.of(
                            "type", "json_schema",
                            "json_schema", Map.of("name", "qyntra_test_cases", "strict", true, "schema", schema)
                    )
            );

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.openai.com/v1/chat/completions"))
                    .timeout(Duration.ofSeconds(90))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(Json.stringify(apiRequest)))
                    .build();
            HttpResponse<String> response;
            try {
                response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (java.net.http.HttpTimeoutException exception) {
                sendJson(exchange, 504, Map.of("error", "OpenAI took too long to respond. Please try again."));
                return;
            } catch (IOException exception) {
                System.err.println("OpenAI request failed: " + exception.getClass().getSimpleName());
                sendJson(exchange, 502, Map.of("error", "Could not connect to OpenAI. Check the server's network connection and try again."));
                return;
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                System.err.println("OpenAI returned HTTP " + response.statusCode());
                sendJson(exchange, 502, Map.of("error", "OpenAI could not generate cases. Check API key, model access, and billing."));
                return;
            }

            Map<String, Object> responseBody = object(Json.parse(response.body()));
            List<Object> choices = array(responseBody.get("choices"));
            if (choices.isEmpty()) {
                sendJson(exchange, 502, Map.of("error", "OpenAI returned no test cases. Please try again."));
                return;
            }
            Map<String, Object> message = object(object(choices.getFirst()).get("message"));
            Map<String, Object> generated = object(Json.parse(string(message.get("content"))));
            List<Object> testCases = array(generated.get("testCases"));
            if (testCases.isEmpty() || testCases.size() > 10) {
                sendJson(exchange, 502, Map.of("error", "OpenAI returned an invalid number of test cases."));
                return;
            }
            sendJson(exchange, 200, Map.of("testCases", testCases));
        } catch (IllegalArgumentException exception) {
            sendJson(exchange, 400, Map.of("error", "The request was invalid. Check required fields and try again."));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            sendJson(exchange, 503, Map.of("error", "The AI request was interrupted. Please try again."));
        }
    }

    private static Map<String, Object> testCaseSchema() {
        Map<String, Object> properties = Map.ofEntries(
                Map.entry("title", Map.of("type", "string")),
                Map.entry("featureName", Map.of("type", "string")),
                Map.entry("preconditions", Map.of("type", "string")),
                Map.entry("steps", Map.of("type", "array", "items", Map.of("type", "string"))),
                Map.entry("testData", Map.of("type", "string")),
                Map.entry("expectedResult", Map.of("type", "string")),
                Map.entry("bugDescription", Map.of("type", "string")),
                Map.entry("testerComments", Map.of("type", "string")),
                Map.entry("testResult", Map.of("type", "string")),
                Map.entry("developerComments", Map.of("type", "string")),
                Map.entry("fixStatusIT1", Map.of("type", "string")),
                Map.entry("testResultIT2", Map.of("type", "string")),
                Map.entry("fixStatusIT2", Map.of("type", "string")),
                Map.entry("testResultIT3", Map.of("type", "string")),
                Map.entry("actualResult", Map.of("type", "string"))
        );
        return Map.of(
                "type", "object",
                "properties", Map.of("testCases", Map.of(
                        "type", "array",
                        "items", Map.of(
                                "type", "object",
                                "properties", properties,
                                "required", List.of("title", "featureName", "preconditions", "steps", "testData", "expectedResult", "bugDescription", "testerComments", "testResult", "developerComments", "fixStatusIT1", "testResultIT2", "fixStatusIT2", "testResultIT3", "actualResult"),
                                "additionalProperties", false
                        )
                )),
                "required", List.of("testCases"),
                "additionalProperties", false
        );
    }

    private static void sendJson(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String extension(Path file) {
        String name = file.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot).toLowerCase();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) {
        if (!(value instanceof Map<?, ?>)) throw new IllegalArgumentException("Expected JSON object.");
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> array(Object value) {
        if (!(value instanceof List<?>)) throw new IllegalArgumentException("Expected JSON array.");
        return (List<Object>) value;
    }

    private static String string(Object value) {
        return value instanceof String text ? text : "";
    }

    private static final class Json {
        private final String text;
        private int index;

        private Json(String text) {
            this.text = text;
        }

        static Object parse(String text) {
            Json parser = new Json(text);
            Object value = parser.readValue();
            parser.skipWhitespace();
            if (parser.index != text.length()) throw new IllegalArgumentException("Trailing JSON data.");
            return value;
        }

        static String stringify(Object value) {
            if (value == null) return "null";
            if (value instanceof String text) return quote(text);
            if (value instanceof Number || value instanceof Boolean) return value.toString();
            if (value instanceof Map<?, ?> map) {
                List<String> entries = new ArrayList<>();
                map.forEach((key, item) -> entries.add(quote(String.valueOf(key)) + ":" + stringify(item)));
                return "{" + String.join(",", entries) + "}";
            }
            if (value instanceof Iterable<?> items) {
                List<String> values = new ArrayList<>();
                items.forEach(item -> values.add(stringify(item)));
                return "[" + String.join(",", values) + "]";
            }
            throw new IllegalArgumentException("Unsupported JSON value.");
        }

        private static String quote(String value) {
            StringBuilder output = new StringBuilder("\"");
            for (char character : value.toCharArray()) {
                switch (character) {
                    case '"' -> output.append("\\\"");
                    case '\\' -> output.append("\\\\");
                    case '\b' -> output.append("\\b");
                    case '\f' -> output.append("\\f");
                    case '\n' -> output.append("\\n");
                    case '\r' -> output.append("\\r");
                    case '\t' -> output.append("\\t");
                    default -> {
                        if (character < 0x20) output.append(String.format("\\u%04x", (int) character));
                        else output.append(character);
                    }
                }
            }
            return output.append('"').toString();
        }

        private Object readValue() {
            skipWhitespace();
            if (index >= text.length()) throw new IllegalArgumentException("Unexpected end of JSON.");
            return switch (text.charAt(index)) {
                case '{' -> readObject();
                case '[' -> readArray();
                case '"' -> readString();
                case 't' -> readLiteral("true", true);
                case 'f' -> readLiteral("false", false);
                case 'n' -> readLiteral("null", null);
                default -> readNumber();
            };
        }

        private Map<String, Object> readObject() {
            Map<String, Object> result = new LinkedHashMap<>();
            index++;
            skipWhitespace();
            if (consume('}')) return result;
            do {
                skipWhitespace();
                if (index >= text.length() || text.charAt(index) != '"') throw new IllegalArgumentException("Expected JSON object key.");
                String key = readString();
                skipWhitespace();
                require(':');
                result.put(key, readValue());
                skipWhitespace();
                if (consume('}')) return result;
                require(',');
            } while (true);
        }

        private List<Object> readArray() {
            List<Object> result = new ArrayList<>();
            index++;
            skipWhitespace();
            if (consume(']')) return result;
            do {
                result.add(readValue());
                skipWhitespace();
                if (consume(']')) return result;
                require(',');
            } while (true);
        }

        private String readString() {
            require('"');
            StringBuilder result = new StringBuilder();
            while (index < text.length()) {
                char character = text.charAt(index++);
                if (character == '"') return result.toString();
                if (character != '\\') {
                    result.append(character);
                    continue;
                }
                if (index >= text.length()) throw new IllegalArgumentException("Incomplete JSON escape.");
                char escaped = text.charAt(index++);
                switch (escaped) {
                    case '"', '\\', '/' -> result.append(escaped);
                    case 'b' -> result.append('\b');
                    case 'f' -> result.append('\f');
                    case 'n' -> result.append('\n');
                    case 'r' -> result.append('\r');
                    case 't' -> result.append('\t');
                    case 'u' -> {
                        if (index + 4 > text.length()) throw new IllegalArgumentException("Incomplete Unicode escape.");
                        result.append((char) Integer.parseInt(text.substring(index, index + 4), 16));
                        index += 4;
                    }
                    default -> throw new IllegalArgumentException("Invalid JSON escape.");
                }
            }
            throw new IllegalArgumentException("Unclosed JSON string.");
        }

        private Object readNumber() {
            int start = index;
            if (consume('-')) {}
            while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
            if (consume('.')) while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
            if (index < text.length() && (text.charAt(index) == 'e' || text.charAt(index) == 'E')) {
                index++;
                if (index < text.length() && (text.charAt(index) == '+' || text.charAt(index) == '-')) index++;
                while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
            }
            if (start == index) throw new IllegalArgumentException("Invalid JSON value.");
            return Double.parseDouble(text.substring(start, index));
        }

        private Object readLiteral(String literal, Object value) {
            if (!text.startsWith(literal, index)) throw new IllegalArgumentException("Invalid JSON literal.");
            index += literal.length();
            return value;
        }

        private void skipWhitespace() {
            while (index < text.length() && Character.isWhitespace(text.charAt(index))) index++;
        }

        private boolean consume(char expected) {
            if (index < text.length() && text.charAt(index) == expected) {
                index++;
                return true;
            }
            return false;
        }

        private void require(char expected) {
            if (!consume(expected)) throw new IllegalArgumentException("Expected '" + expected + "'.");
        }
    }
}
