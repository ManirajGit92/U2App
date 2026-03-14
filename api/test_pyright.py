import difflib

def compute_diff(content1: str, content2: str) -> dict:
    lines1 = content1.splitlines(keepends=True)
    lines2 = content2.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, lines1, lines2)
    diffs = []
    mismatches = []
    
    for op in matcher.get_opcodes():
        tag = str(op[0])
        i1 = int(op[1])
        i2 = int(op[2])
        j1 = int(op[3])
        j2 = int(op[4])
        
        if tag == "replace":
            for line in lines2[j1:j2]:
                stripped = line.rstrip("\n")
                diffs.append({"value": stripped, "type": "added"})
                mismatches.append(f"+ {stripped}")
    
    return {"diffs": diffs}
