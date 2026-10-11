from http.server import BaseHTTPRequestHandler
import json
import difflib


def compute_diff(content1: str, content2: str) -> dict:
    lines1 = content1.splitlines(keepends=True)
    lines2 = content2.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, lines1, lines2)
    diffs = []
    mismatches = []
    total_lines: int = 0
    matched_lines: int = 0

    for op in matcher.get_opcodes():
        tag = str(op[0])
        i1 = int(op[1])
        i2 = int(op[2])
        j1 = int(op[3])
        j2 = int(op[4])
        
        if tag == "equal":
            count = i2 - i1
            matched_lines += count  # type: ignore
            total_lines += count  # type: ignore
            for k in range(i1, i2):
                line = lines1[k]
                diffs.append({"value": line.rstrip("\n"), "type": "match"})
        elif tag == "replace":
            c1 = i2 - i1
            c2 = j2 - j1
            total_lines += c1 + c2  # type: ignore
            for k in range(i1, i2):
                line = lines1[k]
                stripped = line.rstrip("\n")
                diffs.append({"value": stripped, "type": "removed"})
                mismatches.append(f"- {stripped}")
            for k in range(j1, j2):
                line = lines2[k]
                stripped = line.rstrip("\n")
                diffs.append({"value": stripped, "type": "added"})
                mismatches.append(f"+ {stripped}")
        elif tag == "delete":
            c1 = i2 - i1
            total_lines += c1  # type: ignore
            for k in range(i1, i2):
                line = lines1[k]
                stripped = line.rstrip("\n")
                diffs.append({"value": stripped, "type": "removed"})
                mismatches.append(f"- {stripped}")
        elif tag == "insert":
            c2 = j2 - j1
            total_lines += c2  # type: ignore
            for k in range(j1, j2):
                line = lines2[k]
                stripped = line.rstrip("\n")
                diffs.append({"value": stripped, "type": "added"})
                mismatches.append(f"+ {stripped}")
        else:
            continue

    match_pct = round((matched_lines / total_lines) * 100) if total_lines > 0 else 100  # type: ignore
    return {"diffs": diffs, "matchPercentage": match_pct, "mismatches": mismatches}


def compare_json(content1: str, content2: str) -> dict:
    try:
        obj1 = json.loads(content1)
    except json.JSONDecodeError:
        return {
            "diffs": [{"value": "Content 1 is not valid JSON", "type": "removed"}],
            "matchPercentage": 0,
            "mismatches": ["Content 1: Invalid JSON"],
        }

    try:
        obj2 = json.loads(content2)
    except json.JSONDecodeError:
        return {
            "diffs": [{"value": "Content 2 is not valid JSON", "type": "removed"}],
            "matchPercentage": 0,
            "mismatches": ["Content 2: Invalid JSON"],
        }

    formatted1 = json.dumps(obj1, indent=2, sort_keys=True)
    formatted2 = json.dumps(obj2, indent=2, sort_keys=True)
    return compute_diff(formatted1, formatted2)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON body"}).encode())
            return

        mode = data.get("mode", "text")
        contents = data.get("contents", [])

        if len(contents) < 2:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({"error": "At least 2 content items required"}).encode()
            )
            return

        results = []
        for i in range(1, len(contents)):
            if mode == "json":
                result = compare_json(contents[0], contents[i])
            else:
                result = compute_diff(contents[0], contents[i])
            results.append(result)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"results": results}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
