import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTROL_NAMES = ("button", "input", "select", "textarea")
CONTROL_START = re.compile(r"<(" + "|".join(CONTROL_NAMES) + r")\b")


def production_control_tags():
    for path in sorted((ROOT / "src").rglob("*.tsx")):
        if path.name.endswith(".test.tsx"):
            continue

        source = path.read_text(encoding="utf-8")
        for match in CONTROL_START.finditer(source):
            index = match.start()
            cursor = match.end()
            brace_depth = 0
            quote = None
            while cursor < len(source):
                character = source[cursor]
                if quote:
                    if character == quote and source[cursor - 1] != "\\":
                        quote = None
                elif character in ('"', "'", "`"):
                    quote = character
                elif character == "{":
                    brace_depth += 1
                elif character == "}" and brace_depth:
                    brace_depth -= 1
                elif character == ">" and brace_depth == 0:
                    break
                cursor += 1

            line = source.count("\n", 0, index) + 1
            yield path.relative_to(ROOT), line, source[index : cursor + 1]


class AccessibilityLabelTests(unittest.TestCase):
    def test_production_controls_have_explicit_aria_labels(self):
        unlabeled = [
            f"{path}:{line}: <{tag.split()[0][1:]}...>"
            for path, line, tag in production_control_tags()
            if "aria-label=" not in tag
        ]
        self.assertEqual([], unlabeled, "Controls without aria-label:\n" + "\n".join(unlabeled))


if __name__ == "__main__":
    unittest.main()
